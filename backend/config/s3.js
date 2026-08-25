// config/s3.js
// Initializes the AWS S3Client — same graceful pattern as config/supabase.js
// Returns null if credentials are not set, so local fallback still works.
const { S3Client } = require('@aws-sdk/client-s3');

let s3Client = null;

if (
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_S3_BUCKET
) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  console.log(`✅ AWS S3 configured — bucket: ${process.env.AWS_S3_BUCKET} (${process.env.AWS_REGION})`);
} else {
  console.warn('⚠️  AWS S3 not configured; uploads will fall back to local disk');
}

module.exports = s3Client;
