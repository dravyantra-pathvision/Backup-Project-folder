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

    // First, try to find user by UID from Bearer token
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

    // Retry loop to wait for Firebase Auth propagation (up to 5 attempts, 7.5s total)
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (!userRecord) {
          userRecord = await admin.auth().getUserByEmail(email);
        }
        if (userRecord) {
          link = await admin.auth().generateEmailVerificationLink(email);
          if (link && link.includes('oobCode')) {
            console.log(`[sendVerificationEmail] Generated valid oobCode link on attempt ${attempt} for ${email}`);
            break;
          }
        }
      } catch (err) {
        console.warn(`[sendVerificationEmail] Attempt ${attempt} notice for ${email}: ${err.message}`);
      }
      if (attempt < 5) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    // ONLY send Nodemailer email if we have a valid, working Firebase oobCode link!
    if (!link || !link.includes('oobCode')) {
      console.warn(`[sendVerificationEmail] No valid oobCode link generated for ${email}. Native Firebase email is primary.`);
      return res.status(200).json({ message: 'Native Firebase verification email requested.' });
    }

    const subject = 'Action Required: Verify your DravYantra account';
    const text = `Hello,\n\nPlease verify your email address for DravYantra by visiting:\n${link}\n\nThis link will expire in 24 hours.`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden;">
          <tr>
            <td style="background-color: #0047AB; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">DravYantra</h1>
              <p style="color: #93c5fd; margin: 4px 0 0 0; font-size: 13px;">Fleet Management Platform</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 600;">Confirm your email address</h2>
              <p style="margin: 0 0 20px 0; line-height: 1.6; color: #334155; font-size: 15px;">
                Thank you for creating an account with DravYantra. Click the button below to verify your email address and activate your account.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${link}" target="_blank" style="background-color: #0047AB; color: #ffffff; display: inline-block; padding: 14px 32px; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 15px;">
                  Verify Email Address
                </a>
              </div>
              <p style="margin: 20px 0 8px 0; font-size: 12px; color: #64748b;">
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p style="margin: 0; font-size: 12px; word-break: break-all; background: #f8fafc; padding: 10px 12px; border-radius: 6px; color: #2563eb;">
                <a href="${link}" style="color: #2563eb; text-decoration: underline;">${link}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                This link expires in 24 hours. If you did not sign up for DravYantra, please ignore this email.<br/>
                &copy; 2026 DravYantra &bull; PathVision Technologies
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
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
