// controllers/reportController.js
// Generates CSV reports from live DB data and manages report schedules
const { pool } = require('../config/dbconfig');
const { handleError } = require('../utils/responseHandler');
const { Parser } = require('json2csv');

// ── Report Generation ────────────────────────────────────────────────────────
const generateReport = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { type = 'fleet_summary', format = 'csv' } = req.query;

  try {
    let data = [];
    let fields = [];
    let filename = '';

    let dateFilter = '';
    if (type.startsWith('daily_')) {
      dateFilter = `AND created_at >= CURRENT_DATE`;
    } else if (type.startsWith('monthly_')) {
      dateFilter = `AND created_at >= CURRENT_DATE - INTERVAL '1 month'`;
    }

    switch (type) {
      case 'fleet_summary':
      case 'daily_fleet_summary':
      case 'fleet_performance': {
        const r = await pool.query(`SELECT id,vehicle,driver,from_location,to_location,status,distance,fuel_used,date FROM trips WHERE uid=$1 ${dateFilter} ORDER BY created_at DESC LIMIT 500`, [uid]);
        fields = ['id','vehicle','driver','from_location','to_location','status','distance','fuel_used','date'];
        data = r.rows;
        filename = 'fleet_performance';
        break;
      }
      case 'driver_compliance':
      case 'driver_performance': {
        const r = await pool.query(`SELECT id,name,phone,lic,lic_exp,score,trips,rating,status FROM drivers WHERE uid=$1 ORDER BY name`, [uid]);
        fields = ['id','name','phone','lic','lic_exp','score','trips','rating','status'];
        data = r.rows;
        filename = 'driver_performance';
        break;
      }
      case 'fuel_audit':
      case 'monthly_fuel_audit':
      case 'fuel_savings': {
        const r = await pool.query(`SELECT id,vehicle,driver,station,liters,rate,cost,odometer,date,is_suspect,suspect_reason FROM fuel_logs WHERE uid=$1 ${dateFilter} ORDER BY created_at DESC`, [uid]);
        fields = ['id','vehicle','driver','station','liters','rate','cost','odometer','date','is_suspect','suspect_reason'];
        data = r.rows;
        filename = 'fuel_savings';
        break;
      }
      case 'expense_toll': {
        const r = await pool.query(`SELECT id,vehicle,driver,toll_count,date FROM trips WHERE uid=$1 ${dateFilter} ORDER BY created_at DESC`, [uid]);
        fields = ['id','vehicle','driver','toll_count','date'];
        data = r.rows;
        filename = 'expense_toll';
        break;
      }
      case 'vehicle_health': {
        const r = await pool.query(`SELECT plate,model,year,type,status,driver,health,odo,next_service,insurance,permit,puc FROM vehicles WHERE uid=$1`, [uid]);
        fields = ['plate','model','year','type','status','driver','health','odo','next_service','insurance','permit','puc'];
        data = r.rows;
        filename = 'vehicle_health';
        break;
      }
      case 'trip_efficiency':
      case 'trip_activity': {
        const r = await pool.query(`SELECT id,vehicle,driver,from_location,to_location,distance,fuel_used,delay_minutes,score,status FROM trips WHERE uid=$1 ${dateFilter} ORDER BY created_at DESC`, [uid]);
        fields = ['id','vehicle','driver','from_location','to_location','distance','fuel_used','delay_minutes','score','status'];
        data = r.rows;
        filename = 'trip_activity';
        break;
      }
      case 'idle_analysis':
      case 'fuel_loss': {
        const r = await pool.query(`SELECT id,vehicle,driver,idle_duration,status,date FROM trips WHERE uid=$1 ${dateFilter} ORDER BY idle_duration DESC`, [uid]);
        fields = ['id','vehicle','driver','idle_duration','status','date'];
        data = r.rows;
        filename = 'fuel_loss';
        break;
      }
      case 'carbon_impact': {
        const r = await pool.query(`SELECT id,vehicle,driver,distance,fuel_used,COALESCE(fuel_saved, 0) AS fuel_saved_l, (COALESCE(fuel_saved, 0)*2.68)::numeric(10,2) AS co2_avoided_kg FROM trips WHERE uid=$1 ${dateFilter} ORDER BY created_at DESC`, [uid]);
        fields = ['id','vehicle','driver','distance','fuel_used','fuel_saved_l','co2_avoided_kg'];
        data = r.rows;
        filename = 'carbon_impact';
        break;
      }
      case 'alert_history': {
        const r = await pool.query(`SELECT id,vehicle_plate,driver,type,message,severity,status,detected_at,acknowledged_at FROM alerts WHERE uid=$1 ORDER BY detected_at DESC LIMIT 500`, [uid]);
        fields = ['id','vehicle_plate','driver','type','message','severity','status','detected_at','acknowledged_at'];
        data = r.rows;
        filename = 'alert_history';
        break;
      }
      case 'client_billing': {
        const r = await pool.query(`SELECT id,client,vehicle,driver,from_location,to_location,load,distance,fuel_used,date,status FROM trips WHERE uid=$1 ${dateFilter} ORDER BY created_at DESC`, [uid]);
        fields = ['id','client','vehicle','driver','from_location','to_location','load','distance','fuel_used','date','status'];
        data = r.rows;
        filename = 'client_billing';
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown report type: ${type}` });
    }

    if (data.length === 0) {
      data = [{ message: 'No data found for this report' }];
      fields = ['message'];
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const csvFilename = `dravyantra_${filename}_${dateStr}.csv`;

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${csvFilename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  } catch (err) {
    handleError(res, 'Error generating report', err);
  }
};

// ── Report Schedules ─────────────────────────────────────────────────────────
const getSchedules = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  try {
    const result = await pool.query(
      `SELECT * FROM report_schedules WHERE uid=$1 AND is_active=TRUE ORDER BY created_at DESC`,
      [uid]
    );
    res.json(result.rows);
  } catch (err) {
    handleError(res, 'Error fetching schedules', err);
  }
};

const createSchedule = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { report_type, frequency, channel, recipient } = req.body;
  if (!report_type || !frequency || !channel) {
    return res.status(400).json({ error: 'report_type, frequency, and channel are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO report_schedules (uid, report_type, frequency, channel, recipient, is_active)
       VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *`,
      [uid, report_type, frequency, channel, recipient || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    handleError(res, 'Error creating schedule', err);
  }
};

const deleteSchedule = async (req, res) => {
  const uid = req.user?.uid || 'default_user';
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE report_schedules SET is_active=FALSE, updated_at=NOW()
       WHERE id=$1 AND uid=$2 RETURNING id`,
      [id, uid]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ message: 'Schedule deleted', id });
  } catch (err) {
    handleError(res, 'Error deleting schedule', err);
  }
};

module.exports = { generateReport, getSchedules, createSchedule, deleteSchedule };
