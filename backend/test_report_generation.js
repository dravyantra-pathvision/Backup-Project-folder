require('dotenv').config();
const { pool } = require('./config/dbconfig');
const { Parser } = require('json2csv');

async function testReportGeneration() {
  console.log("Testing Report Generation for all report types...\n");
  const uid = 'default_user';

  const reportTypes = [
    { type: 'fleet_summary', query: `SELECT id,vehicle,driver,from_location,to_location,status,distance,fuel_used,date FROM trips ORDER BY created_at DESC LIMIT 500`, fields: ['id','vehicle','driver','from_location','to_location','status','distance','fuel_used','date'] },
    { type: 'driver_compliance', query: `SELECT id,name,phone,lic,lic_exp,score,trips,rating,status FROM drivers ORDER BY name`, fields: ['id','name','phone','lic','lic_exp','score','trips','rating','status'] },
    { type: 'fuel_audit', query: `SELECT id,vehicle,driver,station,liters,rate,cost,odometer,date,is_suspect,suspect_reason FROM fuel_logs ORDER BY created_at DESC`, fields: ['id','vehicle','driver','station','liters','rate','cost','odometer','date','is_suspect','suspect_reason'] },
    { type: 'expense_toll', query: `SELECT id,vehicle,driver,toll_count,date FROM trips ORDER BY created_at DESC`, fields: ['id','vehicle','driver','toll_count','date'] },
    { type: 'vehicle_health', query: `SELECT plate,model,year,type,status,driver,health,odo,next_service,insurance,permit,puc FROM vehicles`, fields: ['plate','model','year','type','status','driver','health','odo','next_service','insurance','permit','puc'] },
    { type: 'trip_efficiency', query: `SELECT id,vehicle,driver,from_location,to_location,distance,fuel_used,delay_minutes,score,status FROM trips ORDER BY created_at DESC`, fields: ['id','vehicle','driver','from_location','to_location','distance','fuel_used','delay_minutes','score','status'] },
    { type: 'idle_analysis', query: `SELECT id,vehicle,driver,idle_duration,status,date FROM trips ORDER BY idle_duration DESC`, fields: ['id','vehicle','driver','idle_duration','status','date'] },
    { type: 'alert_history', query: `SELECT id,vehicle_plate,driver,type,message,severity,status,detected_at,acknowledged_at FROM alerts ORDER BY detected_at DESC LIMIT 500`, fields: ['id','vehicle_plate','driver','type','message','severity','status','detected_at','acknowledged_at'] },
    { type: 'client_billing', query: `SELECT id,client,vehicle,driver,from_location,to_location,load,distance,fuel_used,date,status FROM trips ORDER BY created_at DESC`, fields: ['id','client','vehicle','driver','from_location','to_location','load','distance','fuel_used','date','status'] },
  ];

  for (const rep of reportTypes) {
    try {
      const res = await pool.query(rep.query);
      let data = res.rows;
      let fields = rep.fields;

      if (data.length === 0) {
        data = [{ message: 'No data found for this report' }];
        fields = ['message'];
      }

      const parser = new Parser({ fields });
      const csv = parser.parse(data);
      console.log(`[PASS] Report type: '${rep.type}' -> Rows: ${res.rows.length} -> CSV Bytes: ${csv.length}`);
    } catch (err) {
      console.error(`[FAIL] Report type: '${rep.type}' failed:`, err.message);
    }
  }

  process.exit(0);
}

testReportGeneration();
