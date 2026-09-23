// services/uploadService.js
// Upload priority:
//   1. AWS S3 (if AWS_ACCESS_KEY_ID configured) — permanent cloud storage
//   2. Local disk fallback (dev / emergency) — unchanged from original behaviour
const fs = require('fs');
const path = require('path');
const { PutObjectCommand, DeleteObjectCommand, ListObjectVersionsCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');

const uploadFile = async (bucket, file, req) => {
  // Sanitise filename: timestamp + original name (spaces → underscores)
  const fileName = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
  // S3 key: <bucket-param>/<filename>  e.g. vehicle_docs/1234567890_rc.pdf
  const s3Key = `${bucket}/${fileName}`;

  // ── 1. AWS S3 (primary) ────────────────────────────────────────────────────
  if (s3Client) {
    try {
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      // Permanent public URL — no expiry, no signed token needed (bucket is public-read)
      const publicUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
      console.log(`✅ S3 upload OK: ${publicUrl}`);
      return { url: publicUrl };
    } catch (err) {
      console.error('❌ S3 upload failed, falling back to local storage:', err.message);
    }
  }

  // ── 2. Local disk fallback ─────────────────────────────────────────────────
  const uploadDir = path.join(__dirname, '../public/uploads', bucket);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, file.buffer);

  const publicBase =
    process.env.PUBLIC_URL ||
    (req.get('x-forwarded-proto') && req.get('x-forwarded-host')
      ? `${req.get('x-forwarded-proto')}://${req.get('x-forwarded-host')}`
      : `${req.protocol}://${req.get('host')}`);

  const publicUrl = `${publicBase}/uploads/${bucket}/${fileName}`;
  console.warn(`⚠️  Local fallback upload: ${publicUrl}`);
  return { url: publicUrl };
};

/**
 * deleteFile
 * Physically deletes a file from S3 (including object versions if versioned) or local disk.
 * Idempotent: Does not throw if file is already missing.
 */
const deleteFile = async (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') return;

  // ── S3 URL Handling ────────────────────────────────────────────────────────
  if (fileUrl.includes('.amazonaws.com/') || fileUrl.includes('s3.')) {
    if (s3Client && process.env.AWS_S3_BUCKET) {
      try {
        const urlObj = new URL(fileUrl);
        const s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
        
        // 1. Delete main object
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: s3Key,
        }));

        // 2. Check and delete versioned objects if bucket has versioning
        try {
          const versions = await s3Client.send(new ListObjectVersionsCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Prefix: s3Key,
          }));

          const objectsToDelete = [];
          if (versions.Versions) {
            versions.Versions.forEach(v => {
              if (v.Key === s3Key) objectsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
            });
          }
          if (versions.DeleteMarkers) {
            versions.DeleteMarkers.forEach(v => {
              if (v.Key === s3Key) objectsToDelete.push({ Key: v.Key, VersionId: v.VersionId });
            });
          }

          if (objectsToDelete.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
              Bucket: process.env.AWS_S3_BUCKET,
              Delete: { Objects: objectsToDelete },
            }));
          }
        } catch (vErr) {
          // Non-critical if versioning isn't enabled
        }
        console.log(`✅ S3 file deleted: ${s3Key}`);
      } catch (err) {
        console.warn(`⚠️  S3 file deletion notice for ${fileUrl}:`, err.message);
      }
    }
  }

  // ── Local Disk Handling ───────────────────────────────────────────────────
  if (fileUrl.includes('/uploads/')) {
    try {
      const relativePath = fileUrl.split('/uploads/')[1];
      if (relativePath) {
        const localPath = path.join(__dirname, '../public/uploads', relativePath);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          console.log(`✅ Local file deleted: ${localPath}`);
        }
      }
    } catch (err) {
      console.warn(`⚠️  Local file deletion notice for ${fileUrl}:`, err.message);
    }
  }
};

module.exports = { uploadFile, deleteFile };
