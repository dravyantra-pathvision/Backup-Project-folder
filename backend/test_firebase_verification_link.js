require('dotenv').config();
const admin = require('./config/firebase');

async function testLinkGeneration() {
  const emails = [
    'avulachakravarthi@gmail.com',
    'guruhugar0310@gmail.com',
    'nonexistent_user_123456789@gmail.com'
  ];

  for (const email of emails) {
    try {
      console.log(`Testing link generation for: ${email}`);
      const link = await admin.auth().generateEmailVerificationLink(email);
      console.log(`[SUCCESS] Link generated for ${email}: ${link.substring(0, 60)}...`);
    } catch (err) {
      console.error(`[ERROR] Failed link generation for ${email}:`, err.message, err.code);
    }
  }

  process.exit(0);
}

testLinkGeneration();
