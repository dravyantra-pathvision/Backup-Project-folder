const { pool } = require('../../config/dbconfig');

const paginate = (page, limit) => ({
  offset: (page - 1) * limit,
  limit,
});

const getAllSettings = async () => {
  const query = `SELECT * FROM system_settings ORDER BY category, key`;
  const res = await pool.query(query);
  
  // Group by category for easier UI consumption
  const grouped = {};
  for (const row of res.rows) {
    if (!grouped[row.category]) {
      grouped[row.category] = [];
    }
    grouped[row.category].push({
      key: row.key,
      value: row.value,
      category: row.category,
      isSensitive: row.is_sensitive,
      requiresSuperAdmin: row.requires_super_admin,
      description: row.description,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at
    });
  }
  
  return grouped;
};

const getSettingByKey = async (key) => {
  const query = `SELECT * FROM system_settings WHERE key = $1`;
  const res = await pool.query(query, [key]);
  if (res.rows.length === 0) return null;
  
  const row = res.rows[0];
  return {
    key: row.key,
    value: row.value,
    category: row.category,
    isSensitive: row.is_sensitive,
    requiresSuperAdmin: row.requires_super_admin,
    description: row.description,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
};

const updateSetting = async (key, value, adminUid, isSuperAdmin, reason = '') => {
  const current = await getSettingByKey(key);
  if (!current) {
    throw new Error('Setting not found');
  }

  if (current.requiresSuperAdmin && !isSuperAdmin) {
    throw new Error('Super Admin privileges required to update this setting');
  }

  const updateQuery = `
    UPDATE system_settings
    SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
    WHERE key = $3
    RETURNING *
  `;
  
  const res = await pool.query(updateQuery, [JSON.stringify(value), adminUid, key]);

  // Insert history
  const historyQuery = `
    INSERT INTO settings_history (setting_key, old_value, new_value, changed_by, change_reason)
    VALUES ($1, $2, $3, $4, $5)
  `;
  await pool.query(historyQuery, [
    key, 
    JSON.stringify(current.value), 
    JSON.stringify(value), 
    adminUid, 
    reason || 'Manual update'
  ]);

  const row = res.rows[0];
  return {
    key: row.key,
    value: row.value,
    category: row.category,
    isSensitive: row.is_sensitive,
    requiresSuperAdmin: row.requires_super_admin,
    description: row.description,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
};

const getSettingsHistory = async (key, page = 1, limit = 50) => {
  const { offset } = paginate(page, limit);
  let query = `
    SELECT h.*, u.email as changed_by_email 
    FROM settings_history h
    LEFT JOIN users u ON h.changed_by = u.uid
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (key) {
    query += ` AND h.setting_key = $${idx}`;
    params.push(key);
    idx++;
  }

  const countQuery = `SELECT COUNT(*) FROM (${query}) AS subquery`;
  const countRes = await pool.query(countQuery, params);
  const total = parseInt(countRes.rows[0].count, 10);

  query += ` ORDER BY h.changed_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
  params.push(limit, offset);

  const res = await pool.query(query, params);

  return {
    history: res.rows,
    total,
    page: parseInt(page, 10),
    totalPages: Math.ceil(total / limit)
  };
};

module.exports = {
  getAllSettings,
  getSettingByKey,
  updateSetting,
  getSettingsHistory
};
