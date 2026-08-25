require('dotenv').config();
const notificationService = require('./services/notificationService');

async function main() {
  console.log("Sending verification email to avulachakravarthi@gmail.com...");
  const subject = "Verify your email for DravYantra";
  const text = "Welcome to DravYantra! Please verify your email to complete your registration.";
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2>Welcome to DravYantra!</h2>
      <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
      <div style="margin: 30px 0;">
        <a href="https://dravyantra-7d2a1.firebaseapp.com" style="background-color: #0047AB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Verify Email
        </a>
      </div>
      <p>If the button doesn't work, copy and paste this link: https://dravyantra-7d2a1.firebaseapp.com</p>
    </div>
  `;

  try {
    await notificationService.sendEmail('avulachakravarthi@gmail.com', subject, text, html);
    console.log("SUCCESS: Verification email delivered to avulachakravarthi@gmail.com!");
  } catch (err) {
    console.error("FAILURE:", err);
  } finally {
    process.exit(0);
  }
}

main();
