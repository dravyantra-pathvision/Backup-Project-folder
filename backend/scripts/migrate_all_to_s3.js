// scripts/migrate_all_to_s3.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { pool } = require('../config/dbconfig');

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.pdf':
      return 'application/pdf';
    case '.mp4':
      return 'video/mp4';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.doc':
      return 'application/msword';
    case '.csv':
      return 'text/csv';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

async function uploadFileToS3(localFilePath, s3Key) {
  const fileBuffer = fs.readFileSync(localFilePath);
  const contentType = getContentType(localFilePath);

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  return `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

async function main() {
  if (!s3Client) {
    console.error('❌ AWS S3 is not configured in .env. Exiting migration.');
    process.exit(1);
  }

  const uploadsDir = path.join(__dirname, '../public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('No public/uploads directory found. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`🚀 Starting S3 Migration to bucket: ${process.env.AWS_S3_BUCKET}...`);

  function getLocalFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
      const fullPath = path.join(dir, item.name);
      return item.isDirectory() ? getLocalFiles(fullPath) : [fullPath];
    });
  }

  const filePaths = getLocalFiles(uploadsDir);
  console.log(`📦 Found ${filePaths.length} local files in public/uploads/`);

  const urlMap = new Map(); // fileName -> S3 URL
  let uploadSuccessCount = 0;
  let uploadFailCount = 0;

  for (const filePath of filePaths) {
    const relativePath = path.relative(uploadsDir, filePath).replace(/\\/g, '/');
    const fileName = path.basename(filePath);
    const s3Key = relativePath;

    try {
      const s3Url = await uploadFileToS3(filePath, s3Key);
      urlMap.set(fileName, s3Url);
      uploadSuccessCount++;
    } catch (err) {
      uploadFailCount++;
      console.error(`❌ Failed to upload ${relativePath}:`, err.message);
    }
  }

  console.log(`✅ Upload Phase Complete: ${uploadSuccessCount} files processed on S3.\n`);

  // 2. Database URL Updates
  console.log('🔄 Updating PostgreSQL database records to point to S3 URLs...');

  const targets = [
    { table: 'drivers', cols: ['image_url', 'aadhar_url', 'license_url'] },
    { table: 'vehicles', cols: ['rc_url', 'insurance_url', 'puc_url'] },
    { table: 'trips', cols: ['eway_bill_url'] },
    { table: 'users', cols: ['profile_photo'] },
    { table: 'fleet_onboarding', cols: ['company_logo'] },
    { table: 'report_history', cols: ['file_url'] },
  ];

  let totalDbUpdates = 0;

  for (const [fileName, s3Url] of urlMap.entries()) {
    for (const { table, cols } of targets) {
      for (const col of cols) {
        try {
          const res = await pool.query(
            `UPDATE "${table}" SET "${col}" = $1 WHERE "${col}" LIKE $2 AND "${col}" != $1`,
            [s3Url, `%${fileName}`]
          );
          if (res.rowCount > 0) {
            totalDbUpdates += res.rowCount;
            console.log(`  Updated ${res.rowCount} row(s) in ${table}.${col} -> ${fileName}`);
          }
        } catch (err) {
          // Ignore table/column mismatch errors
        }
      }
    }
  }

  console.log(`\n🎉 MIGRATION FINISHED! Total DB fields updated: ${totalDbUpdates}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
