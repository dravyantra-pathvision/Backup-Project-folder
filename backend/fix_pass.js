const admin = require('./config/firebase');

async function checkAndFixFirebase() {
  const users = [
    { email: 'guruhugar6777@gmail.com', password: 'Guru@6777' },
    { email: 'dravyantra.pathvision@gmail.com', password: 'dravyantrapv@2025' }
  ];

  for (const u of users) {
    try {
      const userRecord = await admin.auth().getUserByEmail(u.email);
      console.log(`✅ Found user: ${u.email} (UID: ${userRecord.uid})`);
      console.log(`   - Disabled: ${userRecord.disabled}`);
      console.log(`   - Email verified: ${userRecord.emailVerified}`);
      console.log(`   - Provider data: ${JSON.stringify(userRecord.providerData)}`);
      
      // Force password update again to be absolutely sure
      await admin.auth().updateUser(userRecord.uid, { password: u.password });
      console.log(`   -> Forced password update to: ****`);
    } catch (e) {
      console.error(`❌ Error with ${u.email}:`, e.message);
    }
  }
}

checkAndFixFirebase();
