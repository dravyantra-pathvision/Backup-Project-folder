const { pool } = require('../../config/dbconfig');

const generateTicketNumber = async () => {
  const res = await pool.query("SELECT nextval('support_tickets_id_seq') AS id");
  const id = res.rows[0].id;
  return `TKT-${String(id).padStart(5, '0')}`;
};

const createTicket = async (uid, category, subject, description, priority = 'Medium') => {
  const ticketNumber = await generateTicketNumber();
  
  const query = `
    INSERT INTO support_tickets (ticket_number, uid, category, subject, description, priority, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'Open')
    RETURNING *
  `;
  const res = await pool.query(query, [ticketNumber, uid, category, subject, description, priority]);
  return res.rows[0];
};

const getAllTickets = async (filters = {}) => {
  let query = `
    SELECT 
      t.*,
      u.full_name AS fleet_owner_name,
      u.email AS fleet_owner_email,
      f.company_name AS organization_name,
      s.full_name AS assigned_staff_name
    FROM support_tickets t
    LEFT JOIN users u ON t.uid = u.uid
    LEFT JOIN fleet_onboarding f ON u.uid = f.uid
    LEFT JOIN users s ON t.assigned_staff_id = s.uid
    WHERE 1=1
  `;
  const params = [];
  let idx = 1;

  if (filters.status) {
    query += ` AND t.status = $${idx++}`;
    params.push(filters.status);
  }
  if (filters.priority) {
    query += ` AND t.priority = $${idx++}`;
    params.push(filters.priority);
  }
  if (filters.category) {
    query += ` AND t.category = $${idx++}`;
    params.push(filters.category);
  }
  if (filters.uid) {
    query += ` AND t.uid = $${idx++}`;
    params.push(filters.uid);
  }

  query += ` ORDER BY t.created_at DESC`;

  const res = await pool.query(query, params);
  return res.rows;
};

const getTicketDetail = async (ticketNumber) => {
  const ticketQuery = `
    SELECT 
      t.*,
      u.full_name AS fleet_owner_name,
      u.email AS fleet_owner_email,
      f.company_name AS organization_name,
      s.full_name AS assigned_staff_name
    FROM support_tickets t
    LEFT JOIN users u ON t.uid = u.uid
    LEFT JOIN fleet_onboarding f ON u.uid = f.uid
    LEFT JOIN users s ON t.assigned_staff_id = s.uid
    WHERE t.ticket_number = $1
  `;
  const ticketRes = await pool.query(ticketQuery, [ticketNumber]);
  if (ticketRes.rows.length === 0) return null;
  const ticket = ticketRes.rows[0];

  const msgQuery = `
    SELECT 
      m.*,
      u.full_name AS sender_name,
      u.role AS sender_role
    FROM ticket_messages m
    LEFT JOIN users u ON m.sender_id = u.uid
    WHERE m.ticket_number = $1
    ORDER BY m.created_at ASC
  `;
  const msgRes = await pool.query(msgQuery, [ticketNumber]);
  ticket.messages = msgRes.rows;

  return ticket;
};

const updateTicket = async (ticketNumber, updates) => {
  const setClauses = [];
  const params = [ticketNumber];
  let idx = 2;

  if (updates.status !== undefined) {
    setClauses.push(`status = $${idx++}`);
    params.push(updates.status);
    if (updates.status === 'Closed' || updates.status === 'Resolved') {
      setClauses.push(`resolved_at = CURRENT_TIMESTAMP`);
    } else if (updates.status === 'Reopened') {
      setClauses.push(`resolved_at = NULL`);
    }
  }

  if (updates.priority !== undefined) {
    setClauses.push(`priority = $${idx++}`);
    params.push(updates.priority);
  }

  if (updates.assigned_staff_id !== undefined) {
    setClauses.push(`assigned_staff_id = $${idx++}`);
    params.push(updates.assigned_staff_id);
  }

  if (setClauses.length === 0) return null;

  const query = `
    UPDATE support_tickets
    SET ${setClauses.join(', ')}
    WHERE ticket_number = $1
    RETURNING *
  `;
  const res = await pool.query(query, params);
  return res.rows[0];
};

const addMessage = async (ticketNumber, senderId, message, attachments = []) => {
  const query = `
    INSERT INTO ticket_messages (ticket_number, sender_id, message, attachments)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const res = await pool.query(query, [ticketNumber, senderId, message, JSON.stringify(attachments)]);
  return res.rows[0];
};

const getAnalytics = async () => {
  const statusRes = await pool.query(`SELECT status, COUNT(*) as count FROM support_tickets GROUP BY status`);
  const categoryRes = await pool.query(`SELECT category, COUNT(*) as count FROM support_tickets GROUP BY category`);
  const priorityRes = await pool.query(`SELECT priority, COUNT(*) as count FROM support_tickets GROUP BY priority`);
  
  const analytics = {
    byStatus: {},
    byCategory: {},
    byPriority: {},
    total: 0
  };

  statusRes.rows.forEach(r => {
    analytics.byStatus[r.status] = parseInt(r.count, 10);
    analytics.total += parseInt(r.count, 10);
  });
  categoryRes.rows.forEach(r => analytics.byCategory[r.category] = parseInt(r.count, 10));
  priorityRes.rows.forEach(r => analytics.byPriority[r.priority] = parseInt(r.count, 10));

  return analytics;
};

module.exports = {
  createTicket,
  getAllTickets,
  getTicketDetail,
  updateTicket,
  addMessage,
  getAnalytics
};
