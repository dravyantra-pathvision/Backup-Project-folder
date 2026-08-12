# DravYantra — Comprehensive Authentication & AWS Backend Troubleshooting Guide

## Executive Summary
This document provides a detailed technical post-mortem and resolution guide for the authentication, AWS EC2 server connectivity, Flutter mobile app onboarding flow, and SMTP email deliverability issues resolved between August 11 and August 12, 2026.

---

## 1. Timeline & Initial Symptoms

| Symptom | Observed Behavior | Root Cause Component |
| :--- | :--- | :--- |
| **Flutter Build Failure** | `Dart Error: Can't load Kernel binary` | Stale Dart isolate cache on local emulator/device |
| **AWS 502 Bad Gateway** | Mobile app showed "AWS Backend is currently unreachable" | NGINX 502 error because PM2 Node server crashed |
| **Empty File on AWS** | `nano authController.js` revealed 0-byte or corrupted file | Incomplete remote file write & untracked Git directory |
| **Missing Verification Emails** | Tapping "Sign Up" created Firebase user but sent no email | Propagation delay & unhandled Firebase rate-limit exception |
| **Emails Landing in Spam** | Emails delivered to Gmail `in:spam` folder | Sender name mismatch (`DravYantra Alerts`) & missing headers |
| **Firebase Quota Error** | `400 TOO_MANY_ATTEMPTS_TRY_LATER` | Google Identity Toolkit API rate-limits on repeated requests |

---

## 2. In-Depth Technical Root Causes

### 1. AWS EC2 PM2 Process Crash
- `/home/ubuntu/backend/controllers/` on AWS EC2 was untracked by Git. Running `git reset --hard` did not fix `authController.js`.
- `authController.js` had a syntax error (`SyntaxError: Unexpected end of input at line 115`), causing Node.js to exit instantly on startup.
- NGINX on port 443 had no active local upstream on port 3000 to proxy requests to, producing `502 Bad Gateway`.

### 2. PostgreSQL Integer Column Type Error
- `tripCalculationEngine.js` passed decimal values (e.g. `"5.035"`) to PostgreSQL integer columns (`total_idle_time`, `moving_time_seconds`, `running_time_seconds`).
- PostgreSQL threw `invalid input syntax for type integer`, triggering transaction rollbacks during live telemetry updates.

### 3. Firebase Auth User Propagation & Quota Limits
- When a user signs up on mobile via `createUserWithEmailAndPassword()`, Firebase Auth takes 2–4 seconds to replicate the record across global regional servers.
- Backend requests executing in under 200ms failed with `auth/user-not-found`.
- Retrying `generateEmailVerificationLink` rapidly exceeded Google's rate limits (`TOO_MANY_ATTEMPTS_TRY_LATER`), causing the backend to exit without sending the email.

### 4. Gmail Spam Classifier Scoring
- Sent using display name `"DravYantra Alerts <dravyantra.pathvision@gmail.com>"`. Gmail flagged the mismatch between an "Alerts" sender profile and a "Security/Account Verification" message type.
- Email lacked explicit high-priority transactional headers (`X-Priority: 1`, `X-Entity-Ref-ID`), causing Gmail to route it to `in:spam`.

---

## 3. Permanent Solutions Applied

### Solution 1: Server Recovery & File Synchronization
- Connected to AWS EC2 via SSH:
  ```bash
  ssh -i "C:\Users\guruh\Downloads\DravYantra.pem" ubuntu@16.112.99.7
  ```
- Uploaded verified local controllers (`authController.js`, `userController.js`, `requireApprovedOrg.js`, `notificationService.js`) using `scp`.
- Verified syntax with `node -c` and restarted PM2 (`pm2 restart all --update-env`).

### Solution 2: Database Parameter Rounding
- Updated `tripCalculationEngine.js` to format integer time parameters:
  ```javascript
  Math.round(idleDeltaSec    || 0),
  Math.round(movingDeltaSec  || 0),
  Math.round(runningDeltaSec || 0)
  ```

### Solution 3: Hybrid JWT Verification Engine
Created a custom fallback system in `authController.js` and `authRoutes.js`:
1. Attempts native Firebase `generateEmailVerificationLink(email)` first.
2. If Firebase rate-limits (`TOO_MANY_ATTEMPTS_TRY_LATER`) or fails, it generates a signed backend JWT verification token (`expiresIn: '24h'`).
3. Constructs verification URL:
   `https://16-112-99-7.nip.io/api/auth/verify-email?token=...`
4. Created `GET /api/auth/verify-email` route:
   - Decodes and verifies token.
   - Updates `emailVerified = true` in Firebase Auth via Admin SDK.
   - Updates `email_verified = true` in PostgreSQL database (`fleet_owners` & `users`).
   - Renders a responsive HTML success page.

### Solution 4: Client Propagation Delay
Added a 2-second pause in `signup_screen.dart` after account creation:
```dart
await Future.delayed(const Duration(seconds: 2));
```

### Solution 5: Gmail Primary Inbox Optimization
- Configured dedicated sender profile: `"DravYantra Account" <dravyantra.pathvision@gmail.com>`.
- Added transactional headers in `notificationService.js`:
  ```javascript
  headers: {
    'X-Priority': '1',
    'X-MSMail-Priority': 'High',
    'Importance': 'High',
    'X-Entity-Ref-ID': `dravyantra-verify-${Date.now()}`
  }
  ```

---

## 4. Summary of Key Files Changed

1. **`backend/controllers/authController.js`**: Replaced unsafe `jwt.decode()` with `admin.auth().verifyIdToken()`, added hybrid JWT verification token generator and `verifyEmailToken` web handler.
2. **`backend/routes/authRoutes.js`**: Registered `GET /api/auth/verify-email` route.
3. **`backend/services/notificationService.js`**: Added custom sender profile support and transactional headers for Inbox deliverability.
4. **`backend/services/tripCalculationEngine.js`**: Added `Math.round()` to prevent integer type errors in PostgreSQL.
5. **`fleet_owner_app/lib/screens/signup_screen.dart`**: Added propagation delay and fallback email dispatch handling.

---

## 5. Verification Commands & Endpoint Testing

- **Backend Health Check**:
  ```bash
  curl https://16-112-99-7.nip.io/api/health
  ```
- **SMTP Verification Test**:
  ```bash
  node -e "
  const https = require('https');
  const data = JSON.stringify({ email: 'test_user@gmail.com' });
  const req = https.request('https://16-112-99-7.nip.io/api/auth/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, res => res.on('data', d => console.log(d.toString())));
  req.write(data);
  req.end();
  "
  ```

*Document created on 2026-08-12 by DravYantra Engineering Team.*
