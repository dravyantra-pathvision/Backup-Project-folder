const admin = require('../config/firebase');
const notificationService = require('../services/notificationService');
const jwt = require('jsonwebtoken');

/**
 * Generates an email verification link using Firebase Admin SDK and
 * sends it via Nodemailer (custom SMTP) to ensure delivery from our domain.
 * 
 * Supports both:
 * 1. Authenticated requests (new signups with Bearer token) — uses token uid to find the user
 * 2. Unauthenticated requests (e.g. resend verification from settings)
 */
async function sendVerificationEmail(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    let link = '';
    let userRecord = null;

    // First, try to find user by UID from Bearer token (most reliable for new signups)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        if (uid) {
          userRecord = await admin.auth().getUser(uid);
          console.log(`[sendVerificationEmail] Found user by uid: ${uid}`);
        }
      } catch (tokenErr) {
        console.warn(`[sendVerificationEmail] Token verification for uid failed, trying by email: ${tokenErr.message}`);
      }
    }

    // Fallback: find user by email address
    if (!userRecord) {
      try {
        userRecord = await admin.auth().getUserByEmail(email);
        console.log(`[sendVerificationEmail] Found user by email: ${email}`);
      } catch (emailErr) {
        if (emailErr.code !== 'auth/user-not-found') {
          throw emailErr;
        }
        console.warn(`[sendVerificationEmail] User ${email} not found in Firebase Auth yet.`);
      }
    }

    // Generate the real verification link if we found the user
    if (userRecord) {
      try {
        link = await admin.auth().generateEmailVerificationLink(email);
        console.log(`[sendVerificationEmail] Generated real verification link for ${email}`);
      } catch (linkErr) {
        console.warn(`[sendVerificationEmail] generateEmailVerificationLink failed: ${linkErr.message}`);
      }
    }

    // If still no link, log and return success gracefully
    // (native Firebase sendEmailVerification() from phone is the backup)
    if (!link) {
      console.warn(`[sendVerificationEmail] Could not generate verification link for ${email}. Native Firebase email is the backup.`);
      return res.status(200).json({ message: 'Native Firebase verification email was sent from the app.' });
    }

    const subject = 'Verify your email for DravYantra';
    const text = `Welcome to DravYantra! Please verify your email by clicking the following link: ${link}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #0047AB; margin: 0;">DravYantra</h1>
          <p style="color: #666; margin-top: 5px;">Fleet Management System</p>
        </div>
        <h2>Verify your email address</h2>
        <p>Hi there,</p>
        <p>Thank you for signing up for DravYantra! Please verify your email address to complete your registration and access your fleet dashboard.</p>
        <div style="text-align: center; margin: 35px 0;">
          <a href="${link}" style="background-color: #0047AB; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
            ✓ Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; color: #666;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;"><a href="${link}">${link}</a></p>
        <hr style="margin-top: 40px; border: none; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999; text-align: center;">
          This link expires in 24 hours. If you did not create a DravYantra account, please ignore this email.<br/>
          © 2025 DravYantra - PathVision Technologies
        </p>
      </div>
    `;

    try {
      await notificationService.sendEmail(email, subject, text, html);
      console.log(`[sendVerificationEmail] Verification email sent via SMTP to ${email}`);
    } catch (smtpErr) {
      console.error(`[sendVerificationEmail] SMTP failed for ${email}:`, smtpErr.message);
      return res.status(500).json({ error: 'Failed to send verification email via SMTP.' });
    }

    return res.status(200).json({ message: 'Verification email sent successfully.', email });

  } catch (error) {
    console.error('sendVerificationEmail error:', error && error.message);
    return res.status(500).json({ error: 'Failed to process verification email.' });
  }
}

module.exports = {
  sendVerificationEmail
};
