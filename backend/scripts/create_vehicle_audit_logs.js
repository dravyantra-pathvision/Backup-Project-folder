// scripts/create_vehicle_audit_logs.js
const { pool } = require('../config/dbconfig');

async function createTable() {
  try {
    console.log('Creating vehicle_audit_logs table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicle_audit_logs (
          id SERIAL PRIMARY KEY,
          vehicle_plate VARCHAR(50) NOT NULL,
          action VARCHAR(50) NOT NULL,
          admin_id VARCHAR(100),
          reason TEXT,
          remarks TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_vehicle
            FOREIGN KEY(vehicle_plate) 
            REFERENCES vehicles(plate)
            ON DELETE CASCADE
      );
    `);
    console.log('✅ vehicle_audit_logs table created successfully.');
  } catch (error) {
    console.error('❌ Error creating vehicle_audit_logs table:', error);
  } finally {
    pool.end();
  }
}

createTable();
