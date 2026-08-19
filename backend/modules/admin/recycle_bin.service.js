// modules/admin/recycle_bin.service.js
const { pool } = require('../../config/dbconfig');
const adminService = require('./admin.service');
const vehiclesService = require('./vehicles.service');
const driversService = require('./drivers.service');
const tripsService = require('./trips.service');

const getRecycledItems = async ({ type, search, page = 1, limit = 50 }) => {
  const items = [];

  // 1. Fleet Owners (Users)
  if (!type || type === 'all' || type === 'fleet_owner') {
    let query = `
      SELECT u.uid AS id, 'fleet_owner' AS entity_type, u.full_name AS title, u.email AS subtitle, 
             COALESCE(fo.company_name, 'N/A') AS organization, u.deleted_at, u.created_at
      FROM users u
      LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
      WHERE u.role = 'fleet_owner' AND (u.is_deleted = true OR u.account_status = 'Deleted')
    `;
    const params = [];
    if (search) {
      query += ` AND (u.full_name ILIKE $1 OR u.email ILIKE $1 OR fo.company_name ILIKE $1)`;
      params.push(`%${search}%`);
    }
    const res = await pool.query(query, params);
    items.push(...res.rows.map(r => ({ ...r, deleted_at: r.deleted_at || r.created_at })));
  }

  // 2. Organizations
  if (!type || type === 'all' || type === 'organization') {
    let query = `
      SELECT fo.id::text AS id, 'organization' AS entity_type, fo.company_name AS title, fo.contact_email AS subtitle,
             fo.city AS organization, fo.deleted_at, fo.created_at
      FROM fleet_onboarding fo
      WHERE fo.is_deleted = true OR fo.status = 'Deleted'
    `;
    const params = [];
    if (search) {
      query += ` AND (fo.company_name ILIKE $1 OR fo.contact_email ILIKE $1 OR fo.city ILIKE $1)`;
      params.push(`%${search}%`);
    }
    const res = await pool.query(query, params);
    items.push(...res.rows.map(r => ({ ...r, deleted_at: r.deleted_at || r.created_at })));
  }

  // 3. Vehicles
  if (!type || type === 'all' || type === 'vehicle') {
    let query = `
      SELECT v.plate AS id, 'vehicle' AS entity_type, v.plate AS title, 
             CONCAT(COALESCE(v.make, ''), ' ', COALESCE(v.model, '')) AS subtitle,
             COALESCE(fo.company_name, 'N/A') AS organization, v.deleted_at, v.created_at
      FROM vehicles v
      LEFT JOIN users u ON v.uid = u.uid
      LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
      WHERE v.is_deleted = true OR v.status = 'Deleted'
    `;
    const params = [];
    if (search) {
      query += ` AND (v.plate ILIKE $1 OR v.make ILIKE $1 OR v.model ILIKE $1)`;
      params.push(`%${search}%`);
    }
    const res = await pool.query(query, params);
    items.push(...res.rows.map(r => ({ ...r, deleted_at: r.deleted_at || r.created_at })));
  }

  // 4. Drivers
  if (!type || type === 'all' || type === 'driver') {
    let query = `
      SELECT d.id AS id, 'driver' AS entity_type, d.name AS title, d.phone AS subtitle,
             COALESCE(fo.company_name, 'N/A') AS organization, d.deleted_at, d.created_at
      FROM drivers d
      LEFT JOIN users u ON d.uid = u.uid
      LEFT JOIN fleet_onboarding fo ON u.uid = fo.uid
      WHERE d.is_deleted = true OR d.status = 'Deleted'
    `;
    const params = [];
    if (search) {
      query += ` AND (d.name ILIKE $1 OR d.phone ILIKE $1 OR d.lic ILIKE $1)`;
      params.push(`%${search}%`);
    }
    const res = await pool.query(query, params);
    items.push(...res.rows.map(r => ({ ...r, deleted_at: r.deleted_at || r.created_at })));
  }

  // 5. Trips
  if (!type || type === 'all' || type === 'trip') {
    let query = `
      SELECT t.id AS id, 'trip' AS entity_type, t.id AS title,
             CONCAT(COALESCE(t.vehicle, ''), ' • ', COALESCE(t.driver, '')) AS subtitle,
             CONCAT(COALESCE(t.from_location, ''), ' ➔ ', COALESCE(t.to_location, '')) AS organization,
             t.deleted_at, t.created_at
      FROM trips t
      WHERE t.is_deleted = true OR t.status = 'Deleted'
    `;
    const params = [];
    if (search) {
      query += ` AND (t.id ILIKE $1 OR t.vehicle ILIKE $1 OR t.driver ILIKE $1)`;
      params.push(`%${search}%`);
    }
    const res = await pool.query(query, params);
    items.push(...res.rows.map(r => ({ ...r, deleted_at: r.deleted_at || r.created_at })));
  }

  // Sort descending by deleted_at date
  items.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));

  // Client-side offset/limit pagination over merged items
  const offset = (page - 1) * limit;
  const paginated = items.slice(offset, offset + limit);

  return {
    data: paginated,
    total: items.length,
    page: Number(page),
    limit: Number(limit),
  };
};

const restoreItem = async ({ entity_type, id }) => {
  switch (entity_type) {
    case 'fleet_owner':
      await pool.query(
        `UPDATE users SET is_deleted = false, account_status = 'Active', deleted_at = NULL WHERE uid = $1`,
        [id]
      );
      break;

    case 'organization':
      await pool.query(
        `UPDATE fleet_onboarding SET is_deleted = false, status = 'Approved', deleted_at = NULL WHERE id = $1 OR uid = $1`,
        [id]
      );
      break;

    case 'vehicle':
      await pool.query(
        `UPDATE vehicles SET is_deleted = false, status = 'Active', deleted_at = NULL WHERE plate = $1`,
        [id]
      );
      break;

    case 'driver':
      await pool.query(
        `UPDATE drivers SET is_deleted = false, status = 'Active', deleted_at = NULL WHERE id = $1`,
        [id]
      );
      break;

    case 'trip':
      await pool.query(
        `UPDATE trips SET is_deleted = false, status = 'Scheduled', deleted_at = NULL WHERE id = $1`,
        [id]
      );
      break;

    default:
      throw new Error(`Unsupported entity type for restore: ${entity_type}`);
  }

  return { success: true, message: `${entity_type} restored successfully` };
};

const hardDeleteItem = async ({ entity_type, id, adminId }) => {
  switch (entity_type) {
    case 'fleet_owner':
      await adminService.hardDeleteFleetOwner(id, adminId);
      break;

    case 'organization':
      await adminService.hardDeleteOrganization(id, adminId);
      break;

    case 'vehicle':
      await vehiclesService.deleteVehiclePermanent(id, adminId);
      break;

    case 'driver':
      await driversService.deleteDriverPermanent(id, adminId);
      break;

    case 'trip':
      await tripsService.deleteTripPermanent(id, adminId);
      break;

    default:
      throw new Error(`Unsupported entity type for permanent deletion: ${entity_type}`);
  }

  return { success: true, message: `${entity_type} permanently deleted from database` };
};

module.exports = {
  getRecycledItems,
  restoreItem,
  hardDeleteItem,
};
