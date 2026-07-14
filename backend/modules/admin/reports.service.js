const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/dbconfig');
const PDFDocument = require('pdfkit-table');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const crypto = require('crypto');

// Re-use filter builder from analytics or implement a focused one
const buildReportFilter = (filters, tableAlias = '') => {
  const conditions = [];
  const params = [];
  let idx = 1;
  const prefix = tableAlias ? `${tableAlias}.` : '';

  if (filters.organization_id) {
    if (tableAlias === 'devices') {
      conditions.push(`devices.assigned_organization = $${idx++}`);
    } else {
      conditions.push(`${prefix}uid = $${idx++}`);
    }
    params.push(filters.organization_id);
  }

  if (filters.vehicle_plate) {
    const plate = `%${filters.vehicle_plate.replace(/\s+/g, '')}%`;
    if (['vehicles', 'v'].includes(tableAlias)) {
      conditions.push(`REPLACE(${prefix}plate, ' ', '') ILIKE $${idx++}`);
    } else if (['alerts', 'a'].includes(tableAlias)) {
      conditions.push(`REPLACE(${prefix}vehicle_plate, ' ', '') ILIKE $${idx++}`);
    } else if (tableAlias === 'devices') {
      conditions.push(`REPLACE(devices.assigned_vehicle, ' ', '') ILIKE $${idx++}`);
    } else if (tableAlias === 'd') {
      conditions.push(`REPLACE(d.vehicle, ' ', '') ILIKE $${idx++}`);
    } else if (tableAlias === 't') {
      conditions.push(`REPLACE(t.vehicle, ' ', '') ILIKE $${idx++}`);
    }
    if (['vehicles', 'v', 'alerts', 'a', 'devices', 'd', 't'].includes(tableAlias)) {
        params.push(plate);
    }
  }

  const dateCol = (tableAlias === 'alerts' || tableAlias === 'a') ? 'detected_at' : 'created_at';
  if (filters.from_date) {
    conditions.push(`${prefix}${dateCol} >= $${idx++}`);
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    conditions.push(`${prefix}${dateCol} <= $${idx++}`);
    params.push(filters.to_date + ' 23:59:59');
  }

  return {
    where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
    params
  };
};

const fetchReportData = async (reportType, filters) => {
  let query = '';
  let f = { where: '', params: [] };

  switch (reportType) {
    case 'Fleet Summary Report':
      f = buildReportFilter(filters, 'fo');
      query = `
        SELECT 
          fo.company_name AS "Organization",
          u.email AS "Owner Email",
          (SELECT COUNT(*) FROM vehicles v WHERE v.uid = fo.uid) AS "Vehicles",
          (SELECT COUNT(*) FROM drivers d WHERE d.uid = fo.uid) AS "Drivers",
          (SELECT COUNT(*) FROM devices dev WHERE dev.assigned_organization = fo.uid) AS "Devices",
          COALESCE((SELECT SUM(distance) FROM trips t WHERE t.uid = fo.uid), 0) AS "Total Distance (km)"
        FROM fleet_onboarding fo
        JOIN users u ON fo.uid = u.uid
        ${f.where}
      `;
      break;
    case 'Vehicle Report':
      f = buildReportFilter(filters, 'v');
      query = `SELECT plate AS "Plate", make AS "Make", model AS "Model", year AS "Year", status AS "Status", driver AS "Driver", uid AS "Org ID", created_at AS "Added On" FROM vehicles v ${f.where}`;
      break;
    case 'Driver Report':
      f = buildReportFilter(filters, 'd');
      query = `SELECT name AS "Name", phone AS "Phone", lic AS "License", vehicle AS "Assigned Vehicle", score AS "Safety Score", rating AS "Rating", uid AS "Org ID" FROM drivers d ${f.where}`;
      break;
    case 'Trip Report':
      f = buildReportFilter(filters, 't');
      query = `SELECT vehicle AS "Vehicle", driver AS "Driver", distance AS "Distance (km)", from_location AS "Start", to_location AS "End", status AS "Status", fuel_used AS "Fuel Used (L)", created_at AS "Started At" FROM trips t ${f.where}`;
      break;
    case 'Fuel Consumption Report':
      f = buildReportFilter(filters, 't');
      query = `SELECT vehicle AS "Vehicle", SUM(distance) AS "Total Distance", SUM(fuel_used) AS "Fuel Used", SUM(fuel_saved) AS "Fuel Saved" FROM trips t ${f.where} GROUP BY vehicle`;
      break;
    case 'Fuel Theft Report':
      f = buildReportFilter(filters, 'a');
      // Add fuel theft type condition to params
      if (f.where) {
        f.where = f.where + " AND type = 'Fuel Theft'";
      } else {
        f.where = "WHERE type = 'Fuel Theft'";
      }
      query = `SELECT vehicle_plate AS "Vehicle", driver AS "Driver", detected_at AS "Detected At", message AS "Details", CONCAT(lat, ', ', lng) AS "Location", status AS "Status" FROM alerts a ${f.where}`;
      break;
    case 'Idle Time Report':
      f = buildReportFilter(filters, 't');
      query = `SELECT vehicle AS "Vehicle", driver AS "Driver", SUM(total_idle_time)/3600.0 AS "Idle Time (hrs)", SUM(total_idle_time * 1.7 / COALESCE(fuel_price_per_liter, 100)) AS "Wasted Fuel (L)" FROM trips t ${f.where} GROUP BY vehicle, driver`;
      break;
    case 'Alert Report':
      f = buildReportFilter(filters, 'a');
      query = `SELECT type AS "Alert Type", severity AS "Severity", vehicle_plate AS "Vehicle", driver AS "Driver", detected_at AS "Time", message AS "Message", CONCAT(lat, ', ', lng) AS "Location", status AS "Status" FROM alerts a ${f.where}`;
      break;
    case 'Organization Report':
      f = buildReportFilter(filters, 'fo');
      query = `SELECT company_name AS "Name", contact_number AS "Contact", address AS "Address", fleet_size AS "Fleet Size", uid AS "Org ID", created_at AS "Joined At" FROM fleet_onboarding fo ${f.where}`;
      break;
    case 'Device Health Report':
      f = buildReportFilter(filters, 'devices');
      query = `SELECT device_id AS "Device ID", device_type AS "Type", status AS "Status", battery_level AS "Battery (%)", signal_strength AS "Signal (%)", assigned_vehicle AS "Vehicle", assigned_organization AS "Org ID", last_heartbeat AS "Last Heartbeat", firmware_version AS "Firmware" FROM devices ${f.where}`;
      break;
    case 'Carbon Reduction Report':
      f = buildReportFilter(filters, 't');
      query = `SELECT vehicle AS "Vehicle", SUM(fuel_saved) AS "Fuel Saved (L)", SUM(fuel_saved)*2.68 AS "CO2 Reduced (kg)" FROM trips t ${f.where} GROUP BY vehicle`;
      break;
    case 'Subscription Report':
      query = `SELECT 'Not Implemented' AS "Status"`; // Placeholder
      break;
    default:
      throw new Error('Unknown report type: ' + reportType);
  }

  const result = await pool.query(query, f.params);
  return result.rows;
};

const generatePDF = async (data, reportType, filePath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(20).text(reportType, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();

    if (data.length === 0) {
      doc.fontSize(12).text('No data available for the selected filters.', { align: 'center' });
    } else {
      const headers = Object.keys(data[0]);
      const rows = data.map(row => headers.map(h => String(row[h] || '')));
      
      const table = {
        title: reportType,
        headers: headers,
        rows: rows,
      };

      doc.table(table, { 
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
        prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
          doc.font("Helvetica").fontSize(8);
        },
      });
    }

    doc.end();
    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
};

const generateCSV = async (data, filePath) => {
  if (data.length === 0) {
    fs.writeFileSync(filePath, 'No data available');
    return filePath;
  }
  const parser = new Parser();
  const csv = parser.parse(data);
  fs.writeFileSync(filePath, csv);
  return filePath;
};

const generateExcel = async (data, reportType, filePath) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportType.substring(0, 31));

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
    worksheet.addRows(data);
    worksheet.getRow(1).font = { bold: true };
  } else {
    worksheet.addRow(['No data available']);
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
};

const generateReport = async (adminUid, reportType, filters, format) => {
  const data = await fetchReportData(reportType, filters);
  
  const fileName = `${reportType.replace(/\s+/g, '_')}_${Date.now()}`;
  let ext = '';
  if (format === 'PDF') ext = '.pdf';
  else if (format === 'CSV') ext = '.csv';
  else if (format === 'Excel') ext = '.xlsx';
  else throw new Error('Invalid format');

  const relativePath = `reports/${fileName}${ext}`;
  const filePath = path.join(__dirname, '../../uploads', relativePath);

  // Ensure dir exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (format === 'PDF') await generatePDF(data, reportType, filePath);
  else if (format === 'CSV') await generateCSV(data, filePath);
  else if (format === 'Excel') await generateExcel(data, reportType, filePath);

  const fileUrl = `/uploads/${relativePath}`;

  // Insert history
  const insertQuery = `
    INSERT INTO report_history (admin_uid, report_type, filters, format, file_url, status)
    VALUES ($1, $2, $3, $4, $5, 'Completed')
    RETURNING *;
  `;
  const res = await pool.query(insertQuery, [adminUid, reportType, JSON.stringify(filters), format, fileUrl]);
  return res.rows[0];
};

const getReportHistory = async (adminUid) => {
  const res = await pool.query(`SELECT * FROM report_history ORDER BY generated_at DESC LIMIT 50`);
  return res.rows;
};

const deleteReport = async (id) => {
  const res = await pool.query(`DELETE FROM report_history WHERE id = $1 RETURNING file_url`, [id]);
  if (res.rows.length > 0) {
    const fileUrl = res.rows[0].file_url;
    const filePath = path.join(__dirname, '../../', fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  return true;
};

const scheduleReport = async (adminUid, reportType, filters, format, scheduleType, emailRecipients) => {
  const now = new Date();
  let nextRun = new Date();
  
  if (scheduleType === 'Daily') nextRun.setDate(now.getDate() + 1);
  else if (scheduleType === 'Weekly') nextRun.setDate(now.getDate() + 7);
  else if (scheduleType === 'Monthly') nextRun.setMonth(now.getMonth() + 1);
  
  const query = `
    INSERT INTO scheduled_reports (admin_uid, report_type, filters, format, schedule_type, email_recipients, next_run_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const res = await pool.query(query, [adminUid, reportType, JSON.stringify(filters), format, scheduleType, emailRecipients, nextRun]);
  return res.rows[0];
};

const getScheduledReports = async () => {
  const res = await pool.query(`SELECT * FROM scheduled_reports ORDER BY created_at DESC`);
  return res.rows;
};

const deleteSchedule = async (id) => {
  await pool.query(`DELETE FROM scheduled_reports WHERE id = $1`, [id]);
  return true;
};

module.exports = {
  generateReport,
  getReportHistory,
  deleteReport,
  scheduleReport,
  getScheduledReports,
  deleteSchedule,
  fetchReportData,
  generatePDF,
  generateCSV,
  generateExcel
};
