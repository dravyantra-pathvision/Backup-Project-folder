const admin = require('../config/firebase');
const notificationService = require('../services/notificationService');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/dbconfig');

const JWT_SECRET = process.env.JWT_SECRET || 'dravyantra_auth_verification_secret_key_2026';

/**
 * Sends custom email verification via Nodemailer SMTP.
 * Bypasses Firebase rate limits by generating a secure backend JWT token if needed.
 */
async function sendVerificationEmail(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    let link = '';

    // Try generating native Firebase verification link first
    try {
      link = await admin.auth().generateEmailVerificationLink(email);
      console.log(`[sendVerificationEmail] Generated Firebase verification link for ${email}`);
    } catch (linkErr) {
      console.warn(`[sendVerificationEmail] Firebase link notice (${linkErr.message}) - generating secure backend token link.`);
    }

    // Fallback: If Firebase rate-limited or user not propagated yet, generate custom signed token link
    if (!link) {
      const customToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '24h' });
      link = `https://16-112-99-7.nip.io/api/auth/verify-email?token=${customToken}`;
      console.log(`[sendVerificationEmail] Generated custom backend verification link for ${email}`);
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
                  ✓ Verify Email Address
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

    await notificationService.sendEmail(email, subject, text, html);
    console.log(`[sendVerificationEmail] Verification email sent via Nodemailer SMTP to ${email}`);

    return res.status(200).json({ success: true, message: 'Verification email sent successfully.', email });

  } catch (error) {
    console.error('sendVerificationEmail error:', error && error.message);
    return res.status(500).json({ error: 'Failed to process verification email.' });
  }
}

/**
 * Handles web verification when user clicks link in custom verification email.
 */
async function verifyEmailToken(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h2>Invalid verification request: Missing token</h2>');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const email = decoded.email;

    if (!email) {
      return res.status(400).send('<h2>Invalid verification token</h2>');
    }

    // 1. Update Firebase Auth user emailVerified flag
    try {
      const user = await admin.auth().getUserByEmail(email);
      if (user) {
        await admin.auth().updateUser(user.uid, { emailVerified: true });
        console.log(`[verifyEmailToken] Firebase user ${email} marked as verified.`);
      }
    } catch (fbErr) {
      console.warn(`[verifyEmailToken] Firebase update notice: ${fbErr.message}`);
    }

    // 2. Update PostgreSQL database
    try {
      await pool.query('UPDATE fleet_owners SET email_verified = true WHERE email = $1', [email]);
      await pool.query('UPDATE users SET email_verified = true WHERE email = $1', [email]);
    } catch (pgErr) {
      console.warn(`[verifyEmailToken] PostgreSQL update notice: ${pgErr.message}`);
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email Verified - DravYantra</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 40px; border-radius: 16px; text-align: center; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          .icon { font-size: 48px; margin-bottom: 16px; color: #22c55e; }
          h2 { margin: 0 0 12px 0; color: #ffffff; }
          p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
          .btn { background: #0047AB; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Email Verified Successfully!</h2>
          <p>Your email <strong>${email}</strong> has been verified. You can now return to the DravYantra app and log in.</p>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error('[verifyEmailToken] Token verification failed:', err.message);
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Verification Link Expired</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Link Expired or Invalid</h2>
        <p>This verification link is invalid or has expired. Please request a new verification email from the DravYantra app.</p>
      </body>
      </html>
    `);
  }
}

module.exports = {
  sendVerificationEmail,
  verifyEmailToken
};
