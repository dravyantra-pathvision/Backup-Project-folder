const admin = require('./config/firebase');
const { pool } = require('./config/dbconfig');

async function seedAdmins() {
  const usersToCreate = [
    { email: 'guruhugar6777@gmail.com', password: 'Guru@6777', name: 'Guru Hugar' },
    { email: 'dravyantra.pathvision@gmail.com', password: 'dravyantrapv@2025', name: 'Pathvision Admin' }
  ];

  try {
    // 1. Remove old user from PG
    const oldEmail = 'guruhugarguruhugar3143@gmail.com';
    await pool.query('DELETE FROM users WHERE email = $1', [oldEmail]);
    console.log(`✅ Removed old user: ${oldEmail} from PostgreSQL`);

    // (Optional) Remove old user from Firebase if it exists
    try {
      const oldUserRecord = await admin.auth().getUserByEmail(oldEmail);
      await admin.auth().deleteUser(oldUserRecord.uid);
      console.log(`✅ Removed old user: ${oldEmail} from Firebase`);
    } catch (e) {
      console.log(`ℹ️ Old user not found in Firebase, skipping delete.`);
    }

    // 2. Create new admins
    for (const u of usersToCreate) {
      let uid;
      try {
        // Create in Firebase
        const userRecord = await admin.auth().createUser({
          email: u.email,
          password: u.password,
          displayName: u.name,
        });
        uid = userRecord.uid;
        console.log(`✅ Created Firebase user: ${u.email} with UID: ${uid}`);
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          console.log(`ℹ️ Firebase user ${u.email} already exists. Updating password...`);
          const userRecord = await admin.auth().getUserByEmail(u.email);
          uid = userRecord.uid;
          await admin.auth().updateUser(uid, { password: u.password });
        } else {
          throw error;
        }
      }

      // Delete first to avoid duplicate email constraint issues if UID changed
      await pool.query('DELETE FROM users WHERE email = $1', [u.email]);
      
      // Upsert in PostgreSQL
      await pool.query(`
        INSERT INTO users (uid, email, full_name, role)
        VALUES ($1, $2, $3, 'admin')
      `, [uid, u.email, u.name]);
      
      console.log(`✅ Upserted ${u.email} into PostgreSQL with role='admin'`);
    }

  } catch (err) {
    console.error('❌ Error seeding admins:', err);
  } finally {
    pool.end();
  }
}

seedAdmins();
