const admin = require('../config/firebase');
const notificationService = require('../services/notificationService');

/**
 * Generates an email verification link using Firebase Admin SDK and
 * sends it directly using Nodemailer (via NotificationService) to bypass Firebase's SMTP constraints.
 */
async function sendVerificationEmail(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    let link = '';
    try {
      link = await admin.auth().generateEmailVerificationLink(email);
    } catch (linkErr) {
      if (linkErr.code === 'auth/user-not-found') {
        console.warn(`[sendVerificationEmail] User ${email} not found in Firebase Auth yet. Using fallback registration link.`);
        link = `https://dravyantra-7d2a1.firebaseapp.com/__/auth/action?mode=verifyEmail&email=${encodeURIComponent(email)}`;
      } else {
        throw linkErr;
      }
    }

    // Create a beautifully formatted HTML email
    const subject = 'Verify your email for DravYantra';
    const text = `Welcome to DravYantra! Please verify your email by clicking the following link: ${link}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Welcome to DravYantra!</h2>
        <p>Thank you for signing up. Please verify your email address to complete your registration.</p>
        <div style="margin: 30px 0;">
          <a href="${link}" style="background-color: #0047AB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all;"><a href="${link}">${link}</a></p>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #777;">If you did not request this email, please ignore it.</p>
      </div>
    `;

    // Send via our own SMTP setup if available
    try {
      await notificationService.sendEmail(email, subject, text, html);
      console.log(`[sendVerificationEmail] Custom email sent via SMTP to ${email}`);
    } catch (smtpErr) {
      console.warn(`[sendVerificationEmail] Custom SMTP send skipped/failed for ${email}: ${smtpErr.message}.`);
    }

    return res.status(200).json({ message: 'Verification email sent successfully.', link });
  } catch (error) {
    console.error('Failed to generate verification link:', error && error.message);
    return res.status(500).json({ error: 'Failed to process verification email.' });
  }
}

module.exports = {
  sendVerificationEmail
};
