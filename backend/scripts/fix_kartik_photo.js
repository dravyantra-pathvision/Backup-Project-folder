// scripts/fix_kartik_photo.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3');
const { pool } = require('../config/dbconfig');

async function main() {
  // Use any existing driver file or create a clean profile image for testing
  const existingFiles = fs.readdirSync(path.join(__dirname, '../public/uploads/driver_docs'));
  const karthikFiles = existingFiles.filter(f => f.toLowerCase().includes('karthik'));

  if (karthikFiles.length > 0) {
    const localFile = path.join(__dirname, '../public/uploads/driver_docs', karthikFiles[0]);
    const s3Key = `driver_docs/${karthikFiles[0]}`;

    // Upload to S3
    const buffer = fs.readFileSync(localFile);
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: 'image/jpeg'
    }));

    const s3Url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // Update DB
    await pool.query(
      `UPDATE drivers SET image_url = $1 WHERE name LIKE '%Kartik%' OR name LIKE '%karthik%'`,
      [s3Url]
    );

    console.log(`✅ Set Kartik's driver photo to valid S3 URL: ${s3Url}`);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
