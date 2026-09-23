// controllers/savingsWalletController.js
'use strict';
const savingsWalletEngine = require('../services/savingsWalletEngine');

exports.getSavingsWallet = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { period, from, to } = req.query;

    const data = await savingsWalletEngine.getSavingsWallet(uid, period || 'month', from, to);
    return res.json(data);
  } catch (error) {
    console.error('Error fetching savings wallet stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve savings wallet metrics' });
  }
};

exports.seedBaselines = async (req, res) => {
  try {
    const { pool } = require('../config/dbconfig');
    const userRes = await pool.query(`SELECT uid FROM users WHERE role = 'fleet_owner' LIMIT 1`);
    const uid = req.user?.uid || userRes.rows[0]?.uid || 'MFtOK0bjikd4s1YPq8Ok9dnXTsI2';

    const simVehicles = [
      { plate: 'KA 01 AB 1234', deviceId: 'DEV-SIM-001', driverId: 'DRV-KARTIK-01', driverName: 'Kartik' },
      { plate: 'KA 02 CD 5678', deviceId: 'DEV-SIM-002', driverId: 'DRV-ANAND-02', driverName: 'Anand' },
      { plate: 'KA 03 EF 9012', deviceId: 'DEV-SIM-003', driverId: 'DRV-CHAKRA-03', driverName: 'Chakravarthi' },
      { plate: 'KA 33 W 1234', deviceId: 'DEV-001', driverId: 'DRV-RAJESH-01', driverName: 'Rajesh Kumar' },
      { plate: 'KA 33 W 5678', deviceId: 'DEV-002', driverId: 'DRV-SURESH-02', driverName: 'Suresh Patel' },
      { plate: 'KA 33 W 6777', deviceId: 'DEV-003', driverId: 'DRV-AMIT-03', driverName: 'Amit Sharma' },
    ];

    const now = new Date();
    const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    for (const v of simVehicles) {
      await pool.query(`
        INSERT INTO vehicles (plate, device_id, uid, driver, status, speed, fuel, is_active, is_deleted)
        VALUES ($1, $2, $3, $4, 'moving', 0, 90.0, true, false)
        ON CONFLICT (plate) DO UPDATE SET is_active = true, is_deleted = false
      `, [v.plate, v.deviceId, uid, v.driverName]);

      await pool.query(`
        INSERT INTO drivers (id, uid, name, phone, lic, vehicle, status, score)
        VALUES ($1, $2, $3, '9876543210', 'DL-IND-999', $4, 'Active', 100)
        ON CONFLICT (id) DO UPDATE SET vehicle = $4, status = 'Active'
      `, [v.driverId, uid, v.driverName, v.plate]);

      await pool.query(`
        INSERT INTO vehicle_baselines (
          uid, vehicle_id, baseline_start_date, baseline_end_date, baseline_duration_days,
          baseline_distance, baseline_fuel_consumed, baseline_efficiency,
          baseline_idle_hours, baseline_idle_fuel, baseline_overspeed_events, baseline_status
        )
        VALUES ($1, $2, $3, $4, 29, 3000.0, 750.0, 4.00, 30.0, 24.0, 30, 'completed')
        ON CONFLICT (uid, vehicle_id) DO UPDATE SET
          baseline_start_date = EXCLUDED.baseline_start_date,
          baseline_end_date = EXCLUDED.baseline_end_date,
          baseline_duration_days = 29,
          baseline_distance = 3000.0,
          baseline_fuel_consumed = 750.0,
          baseline_efficiency = 4.00,
          baseline_idle_hours = 30.0,
          baseline_idle_fuel = 24.0,
          baseline_overspeed_events = 30,
          baseline_status = 'completed',
          updated_at = CURRENT_TIMESTAMP
      `, [uid, v.plate, startDate, endDate]);
    }

    const baselinesRes = await pool.query(`
      SELECT b.id, b.uid, b.vehicle_id, v.driver, b.baseline_start_date, b.baseline_end_date,
             b.baseline_distance, b.baseline_fuel_consumed, b.baseline_efficiency,
             b.baseline_idle_hours, b.baseline_idle_fuel, b.baseline_overspeed_events, b.baseline_status
      FROM vehicle_baselines b
      LEFT JOIN vehicles v ON b.vehicle_id = v.plate
      WHERE b.baseline_status = 'completed'
      ORDER BY b.id ASC
    `);

    return res.json({ success: true, count: baselinesRes.rows.length, baselines: baselinesRes.rows });
  } catch (error) {
    console.error('Error seeding vehicle baselines:', error);
    return res.status(500).json({ error: error.message });
  }
};

