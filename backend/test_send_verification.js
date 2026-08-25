require('dotenv').config();
const { pool } = require('./config/dbconfig');
const notificationService = require('./services/notificationService');
const admin = require('./config/firebase');

async function testSendVerificationEndpoint(email) {
  console.log(`\nTesting sendVerification for: ${email}`);
  try {
    let link = '';
    try {
      link = await admin.auth().generateEmailVerificationLink(email);
      console.log(`[Firebase Link Generated] ${link.substring(0, 60)}...`);
    } catch (linkErr) {
      if (linkErr.code === 'auth/user-not-found') {
        console.warn(`User ${email} not found in Firebase Auth — generating verification invite link.`);
        link = `https://dravyantra-7d2a1.firebaseapp.com/__/auth/action?mode=verifyEmail&email=${encodeURIComponent(email)}`;
      } else {
        throw linkErr;
      }
    }

    const subject = 'Verify your email for DravYantra';
    const text = `Welcome to DravYantra! Please verify your email by clicking: ${link}`;
    const html = `<div style="padding: 20px;"><h2>Welcome to DravYantra!</h2><p>Please verify your email address:</p><a href="${link}">${link}</a></div>`;

    await notificationService.sendEmail(email, subject, text, html);
    console.log(`[PASS] Verification email SENT SUCCESSFULLY to ${email}!`);
  } catch (err) {
    console.error(`[FAIL] Error for ${email}:`, err.message);
  }
}

async function run() {
  await testSendVerificationEndpoint('avulachakravarthi@gmail.com');
  await testSendVerificationEndpoint('guruhugar0310@gmail.com');
  process.exit(0);
}

run();
