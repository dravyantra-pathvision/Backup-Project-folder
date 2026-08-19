const { pool } = require('../../config/dbconfig');
const { parse } = require('json2csv');

const paginate = (page, limit) => ({
  offset: (page - 1) * limit,
  limit,
});

const getAllTrips = async ({ page, limit, search, status, from_date, to_date }) => {
  const { offset } = paginate(page, limit);
  const params = [];
  const conditions = [];
  let idx = 1;

  if (search) {
    conditions.push(`(t.id ILIKE $${idx} OR t.vehicle ILIKE $${idx} OR t.driver ILIKE $${idx} OR fo.organization_name ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  if (status) {
    conditions.push(`t.status ILIKE $${idx}`);
    params.push(status);
    idx++;
  }

  if (from_date) {
    conditions.push(`t.created_at >= $${idx}`);
    params.push(from_date);
    idx++;
  }

  if (to_date) {
    conditions.push(`t.created_at <= $${idx}`);
    params.push(to_date);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT COUNT(*) 
    FROM trips t
    LEFT JOIN users u ON t.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON t.uid = fo.uid
    ${where}
  `;
  const countRes = await pool.query(countQuery, params);

  const dataQuery = `
    SELECT 
      t.*, 
      u.email AS fleet_owner_email, 
      u.full_name AS fleet_owner_name, 
      u.phone AS fleet_owner_phone,
      fo.organization_name
    FROM trips t
    LEFT JOIN users u ON t.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON t.uid = fo.uid
    ${where}
    ORDER BY t.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `;
  const dataRes = await pool.query(dataQuery, [...params, limit, offset]);

  return {
    data: dataRes.rows,
    total: Number(countRes.rows[0].count),
    page: Number(page),
    limit: Number(limit)
  };
};

const getTripById = async (id) => {
  const dataQuery = `
    SELECT 
      t.*, 
      u.email AS fleet_owner_email, 
      u.full_name AS fleet_owner_name, 
      u.phone AS fleet_owner_phone,
      fo.organization_name
    FROM trips t
    LEFT JOIN users u ON t.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON t.uid = fo.uid
    WHERE t.id = $1
  `;
  const res = await pool.query(dataQuery, [id]);
  return res.rows[0];
};

const getTripTimeline = async (id) => {
  // Try to find alerts associated with the trip.
  const query = `
    SELECT *
    FROM alerts
    WHERE trip_id = $1
    ORDER BY detected_at DESC
  `;
  const res = await pool.query(query, [id]);
  return res.rows;
};

const exportTrips = async ({ search, status, from_date, to_date }) => {
  const params = [];
  const conditions = [];
  let idx = 1;

  if (search) {
    conditions.push(`(t.id ILIKE $${idx} OR t.vehicle ILIKE $${idx} OR t.driver ILIKE $${idx} OR fo.organization_name ILIKE $${idx} OR u.full_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  if (status) {
    conditions.push(`t.status ILIKE $${idx}`);
    params.push(status);
    idx++;
  }

  if (from_date) {
    conditions.push(`t.created_at >= $${idx}`);
    params.push(from_date);
    idx++;
  }

  if (to_date) {
    conditions.push(`t.created_at <= $${idx}`);
    params.push(to_date);
    idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const dataQuery = `
    SELECT 
      t.id, t.vehicle, t.driver, t.status, t.distance, t.fuel_used, t.created_at,
      u.email AS owner_email, fo.organization_name
    FROM trips t
    LEFT JOIN users u ON t.uid = u.uid
    LEFT JOIN fleet_onboarding fo ON t.uid = fo.uid
    ${where}
    ORDER BY t.created_at DESC
  `;
  
  const res = await pool.query(dataQuery, params);
  const data = res.rows.map(row => ({
    'Trip ID': row.id,
    'Organization': row.organization_name || 'N/A',
    'Fleet Owner': row.owner_email || 'N/A',
    'Vehicle': row.vehicle,
    'Driver': row.driver,
    'Status': row.status,
    'Distance': row.distance,
    'Fuel Used': row.fuel_used,
    'Created At': new Date(row.created_at).toISOString()
  }));

  if (data.length === 0) return '';
  return parse(data);
};

const deleteTripPermanent = async (id, adminId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const safeExec = async (sql, args = []) => {
      try {
        await client.query('SAVEPOINT sp');
        await client.query(sql, args);
        await client.query('RELEASE SAVEPOINT sp');
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT sp');
      }
    };

    // Remove related data
    await safeExec('DELETE FROM telemetry_history WHERE trip_id = $1', [id]);
    await safeExec('DELETE FROM alerts WHERE trip_id = $1', [id]);
    await safeExec('DELETE FROM fuel_logs WHERE trip_id = $1', [id]);

    // Delete the trip
    await client.query('DELETE FROM trips WHERE id = $1', [id]);

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllTrips,
  getTripById,
  getTripTimeline,
  exportTrips,
  deleteTripPermanent,
};

