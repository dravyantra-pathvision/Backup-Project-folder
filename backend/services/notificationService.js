const twilio = require('twilio');
const nodemailer = require('nodemailer');
require('dotenv').config();

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized');
  } catch (err) {
    console.error('Twilio initialization failed:', err);
  }
}

let emailTransporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    emailTransporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT || 587,
      secure: SMTP_PORT == 465, 
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.log('Nodemailer transporter initialized');
  } catch (err) {
    console.error('Nodemailer initialization failed:', err);
  }
}

/**
 * Sends real-time alerts via Email, SMS, and WhatsApp.
 * @param {string} type - The type of alert (e.g. 'FUEL_THEFT')
 * @param {string} message - The alert message content
 * @param {object} contactInfo - { email, phone }
 */
async function dispatchAlert(type, message, contactInfo) {
  const { email, phone } = contactInfo;
  
  if (!email && !phone) {
    console.warn(`[NotificationService] No contact info available for alert: ${message}`);
    return;
  }

  const subject = `[URGENT] DravYantra Alert: ${type}`;
  const text = `DravYantra Alert:\n\nType: ${type}\nMessage: ${message}\n\nPlease check your dashboard for details.`;

  // 1. Send Email
  if (email) {
    if (emailTransporter) {
      try {
        await emailTransporter.sendMail({
          from: EMAIL_FROM || SMTP_USER,
          to: email,
          subject,
          text,
        });
        console.log(`[NotificationService] Email sent successfully to ${email}`);
      } catch (err) {
        console.error(`[NotificationService] Failed to send Email to ${email}:`, err);
      }
    } else {
      console.log(`[MOCK EMAIL] To: ${email} | Subject: ${subject} | Body: ${text.replace(/\n/g, ' ')}`);
    }
  }

  // 2. Send SMS & WhatsApp
  if (phone) {
    // Format phone number to E.164 if necessary. We assume the phone starts with +91 etc.
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

    if (twilioClient && TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: text,
          from: TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });
        console.log(`[NotificationService] SMS sent successfully to ${formattedPhone}`);
      } catch (err) {
        console.error(`[NotificationService] Failed to send SMS to ${formattedPhone}:`, err);
      }
    } else {
      console.log(`[MOCK SMS] To: ${formattedPhone} | Body: ${text.replace(/\n/g, ' ')}`);
    }

    if (twilioClient && TWILIO_WHATSAPP_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: text,
          from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${formattedPhone}`,
        });
        console.log(`[NotificationService] WhatsApp msg sent successfully to ${formattedPhone}`);
      } catch (err) {
        console.error(`[NotificationService] Failed to send WhatsApp to ${formattedPhone}:`, err);
      }
    } else {
      console.log(`[MOCK WHATSAPP] To: whatsapp:${formattedPhone} | Body: ${text.replace(/\n/g, ' ')}`);
    }
  }
}

/**
 * Sends a standard email (e.g. for Verification Links)
 */
async function sendEmail(to, subject, text, html, customFrom = null) {
  if (!emailTransporter) {
    console.log(`[MOCK EMAIL] To: ${to} | Subject: ${subject} | Body: ${text}`);
    return;
  }
  try {
    const fromAddress = customFrom || `"DravYantra" <${SMTP_USER}>`;
    await emailTransporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High',
        'X-Entity-Ref-ID': `dravyantra-verify-${Date.now()}`
      }
    });
    console.log(`[NotificationService] Email sent successfully to ${to} from ${fromAddress}`);
  } catch (err) {
    console.error(`[NotificationService] Failed to send Email to ${to}:`, err);
    throw err;
  }
}

module.exports = {
  dispatchAlert,
  sendEmail
};
