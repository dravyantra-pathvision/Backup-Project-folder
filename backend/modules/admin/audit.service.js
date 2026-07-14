const { pool } = require('../../config/dbconfig');

const getSystemAuditLogs = async ({ page = 1, limit = 25, module, user, startDate, endDate }) => {
  let query = `
    SELECT 
      l.id, l.timestamp, l.module, l.action, l.old_value, l.new_value, l.ip_address, l.browser,
      u.full_name as user_name, u.email as user_email, u.role as user_role,
      o.company_name as organization_name
    FROM system_audit_logs l
    LEFT JOIN users u ON l.user_uid = u.uid
    LEFT JOIN fleet_onboarding o ON l.org_uid = o.uid
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (module) {
    query += ` AND l.module = $${paramCount++}`;
    params.push(module);
  }
  if (user) {
    query += ` AND (u.full_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
    params.push(`%${user}%`);
    paramCount++;
  }
  if (startDate) {
    query += ` AND l.timestamp >= $${paramCount++}`;
    params.push(startDate);
  }
  if (endDate) {
    query += ` AND l.timestamp <= $${paramCount++}`;
    params.push(endDate);
  }

  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_table`;
  const countResult = await pool.query(countQuery, params);
  const totalItems = parseInt(countResult.rows[0].count, 10);
  const totalPages = Math.ceil(totalItems / limit);

  query += ` ORDER BY l.timestamp DESC LIMIT $${paramCount++} OFFSET $${paramCount}`;
  params.push(limit, (page - 1) * limit);

  const logsResult = await pool.query(query, params);

  return {
    data: logsResult.rows,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      limit,
    }
  };
};

module.exports = {
  getSystemAuditLogs,
};
