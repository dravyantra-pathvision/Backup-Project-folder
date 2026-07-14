// modules/admin/subscriptions.service.js
// Business logic for subscription & billing management.

const { pool } = require('../../config/dbconfig');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const paginate = (page, limit) => ({
  offset: (page - 1) * limit,
  limit,
});

const generateInvoiceNumber = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${y}${m}-${rnd}`;
};

// ─── Audit ────────────────────────────────────────────────────────────────────

const logAudit = async (client, { subscriptionId, orgUid, adminUid, action, details }) => {
  await client.query(
    `INSERT INTO subscription_audit_log (subscription_id, org_uid, admin_uid, action, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [subscriptionId, orgUid, adminUid, action, JSON.stringify(details || {})]
  );
};

// ─── Plans CRUD ───────────────────────────────────────────────────────────────

const getAllPlans = async () => {
  const res = await pool.query(
    `SELECT sp.*, 
            COALESCE(json_agg(json_build_object(
              'id', pf.id, 'feature_key', pf.feature_key, 'feature_label', pf.feature_label, 
              'is_enabled', pf.is_enabled, 'feature_limit', pf.feature_limit
            )) FILTER (WHERE pf.id IS NOT NULL), '[]') AS features
     FROM subscription_plans sp
     LEFT JOIN plan_features pf ON pf.plan_id = sp.id
     GROUP BY sp.id
     ORDER BY sp.sort_order`
  );
  return res.rows;
};

const getPlanById = async (id) => {
  const res = await pool.query(
    `SELECT sp.*, 
            COALESCE(json_agg(json_build_object(
              'id', pf.id, 'feature_key', pf.feature_key, 'feature_label', pf.feature_label,
              'is_enabled', pf.is_enabled, 'feature_limit', pf.feature_limit
            )) FILTER (WHERE pf.id IS NOT NULL), '[]') AS features
     FROM subscription_plans sp
     LEFT JOIN plan_features pf ON pf.plan_id = sp.id
     WHERE sp.id = $1
     GROUP BY sp.id`,
    [id]
  );
  return res.rows[0] || null;
};

const createPlan = async (data) => {
  const {
    name, slug, description, plan_type = 'paid', billing_cycle = 'monthly',
    price = 0, trial_days = 0, max_vehicles = 0, max_drivers = 0,
    max_storage_gb = 1, is_custom = false, sort_order = 0, features = []
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `INSERT INTO subscription_plans (name, slug, description, plan_type, billing_cycle, price, trial_days, max_vehicles, max_drivers, max_storage_gb, is_custom, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, slug, description, plan_type, billing_cycle, price, trial_days, max_vehicles, max_drivers, max_storage_gb, is_custom, sort_order]
    );
    const plan = res.rows[0];

    if (features.length > 0) {
      for (const f of features) {
        await client.query(
          `INSERT INTO plan_features (plan_id, feature_key, feature_label, is_enabled, feature_limit)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (plan_id, feature_key) DO UPDATE SET is_enabled = $4, feature_limit = $5`,
          [plan.id, f.feature_key, f.feature_label || f.feature_key, f.is_enabled !== false, f.feature_limit || null]
        );
      }
    }

    await client.query('COMMIT');
    return await getPlanById(plan.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const updatePlan = async (id, data) => {
  const fields = [];
  const values = [];
  let idx = 1;

  const allowed = ['name', 'slug', 'description', 'plan_type', 'billing_cycle', 'price', 'trial_days', 'max_vehicles', 'max_drivers', 'max_storage_gb', 'is_active', 'is_custom', 'sort_order'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0 && !data.features) throw new Error('No fields to update');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (fields.length > 0) {
      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);
      await client.query(`UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    }

    if (data.features && Array.isArray(data.features)) {
      for (const f of data.features) {
        await client.query(
          `INSERT INTO plan_features (plan_id, feature_key, feature_label, is_enabled, feature_limit)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT (plan_id, feature_key) DO UPDATE SET is_enabled = $4, feature_label = $3, feature_limit = $5`,
          [id, f.feature_key, f.feature_label || f.feature_key, f.is_enabled !== false, f.feature_limit || null]
        );
      }
    }

    await client.query('COMMIT');
    return await getPlanById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deletePlan = async (id) => {
  // Check if any active subscriptions use this plan
  const check = await pool.query(
    `SELECT COUNT(*) FROM organization_subscriptions WHERE plan_id = $1 AND status NOT IN ('cancelled', 'expired')`,
    [id]
  );
  if (parseInt(check.rows[0].count, 10) > 0) {
    throw new Error('Cannot delete plan with active subscriptions');
  }
  await pool.query(`DELETE FROM subscription_plans WHERE id = $1`, [id]);
};

// ─── Organization Subscriptions ───────────────────────────────────────────────

const getAllSubscriptions = async ({ page = 1, limit = 50, status, search }) => {
  const { offset } = paginate(page, limit);
  let where = [];
  let params = [];
  let idx = 1;

  if (status) {
    where.push(`os.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    where.push(`(fo.company_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM organization_subscriptions os
     LEFT JOIN fleet_onboarding fo ON fo.uid = os.org_uid
     LEFT JOIN users u ON u.uid = os.org_uid
     ${whereClause}`,
    params
  );

  const res = await pool.query(
    `SELECT os.*, 
            sp.name AS plan_name, sp.slug AS plan_slug, sp.price AS plan_price, sp.billing_cycle,
            sp.max_vehicles, sp.max_drivers, sp.max_storage_gb,
            fo.company_name AS org_name, fo.city AS org_city, fo.state AS org_state,
            u.email AS org_email, u.full_name AS owner_name,
            (SELECT COUNT(*) FROM vehicles v WHERE v.uid = os.org_uid) AS actual_vehicles,
            (SELECT COUNT(*) FROM drivers d WHERE d.uid = os.org_uid) AS actual_drivers
     FROM organization_subscriptions os
     LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
     LEFT JOIN fleet_onboarding fo ON fo.uid = os.org_uid
     LEFT JOIN users u ON u.uid = os.org_uid
     ${whereClause}
     ORDER BY os.updated_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    data: res.rows,
    total: parseInt(countRes.rows[0].count, 10),
    page,
    limit,
  };
};

const getSubscriptionByOrg = async (orgUid) => {
  const res = await pool.query(
    `SELECT os.*, 
            sp.name AS plan_name, sp.slug AS plan_slug, sp.price AS plan_price, sp.billing_cycle,
            sp.max_vehicles, sp.max_drivers, sp.max_storage_gb, sp.plan_type,
            sp.trial_days, sp.description AS plan_description,
            fo.company_name AS org_name, fo.city AS org_city,
            u.email AS org_email, u.full_name AS owner_name,
            (SELECT COUNT(*) FROM vehicles v WHERE v.uid = os.org_uid) AS actual_vehicles,
            (SELECT COUNT(*) FROM drivers d WHERE d.uid = os.org_uid) AS actual_drivers,
            COALESCE(json_agg(json_build_object(
              'id', pf.id, 'feature_key', pf.feature_key, 'feature_label', pf.feature_label, 'is_enabled', pf.is_enabled
            )) FILTER (WHERE pf.id IS NOT NULL), '[]') AS features
     FROM organization_subscriptions os
     LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
     LEFT JOIN plan_features pf ON pf.plan_id = sp.id
     LEFT JOIN fleet_onboarding fo ON fo.uid = os.org_uid
     LEFT JOIN users u ON u.uid = os.org_uid
     WHERE os.org_uid = $1
     GROUP BY os.id, sp.id, fo.id, u.uid
     ORDER BY os.created_at DESC LIMIT 1`,
    [orgUid]
  );
  return res.rows[0] || null;
};

const assignPlan = async ({ orgUid, planId, adminUid, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the plan details
    const planRes = await client.query(`SELECT * FROM subscription_plans WHERE id = $1`, [planId]);
    if (planRes.rows.length === 0) throw new Error('Plan not found');
    const plan = planRes.rows[0];

    // Check org exists
    const orgRes = await client.query(`SELECT uid FROM fleet_onboarding WHERE uid = $1`, [orgUid]);
    if (orgRes.rows.length === 0) throw new Error('Organization not found');

    // Deactivate existing active subscriptions for this org
    await client.query(
      `UPDATE organization_subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE org_uid = $1 AND status NOT IN ('cancelled', 'expired')`,
      [orgUid]
    );

    const now = new Date();
    let status = 'active';
    let trialEndsAt = null;
    let periodStart = now;
    let periodEnd = null;

    if (plan.plan_type === 'trial') {
      status = 'trial';
      trialEndsAt = new Date(now.getTime() + (plan.trial_days || 14) * 24 * 60 * 60 * 1000);
      periodEnd = trialEndsAt;
    } else if (plan.billing_cycle === 'monthly') {
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (plan.billing_cycle === 'annual') {
      periodEnd = new Date(now);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const subRes = await client.query(
      `INSERT INTO organization_subscriptions 
       (org_uid, plan_id, status, started_at, trial_ends_at, current_period_start, current_period_end, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [orgUid, planId, status, now, trialEndsAt, periodStart, periodEnd, notes || null]
    );

    await logAudit(client, {
      subscriptionId: subRes.rows[0].id, orgUid, adminUid,
      action: 'plan_assigned',
      details: { plan_name: plan.name, plan_id: planId }
    });

    await client.query('COMMIT');
    return subRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const activateSubscription = async (id, adminUid) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE organization_subscriptions SET status = 'active', suspended_at = NULL, suspension_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    if (res.rows.length === 0) throw new Error('Subscription not found');
    await logAudit(client, { subscriptionId: id, orgUid: res.rows[0].org_uid, adminUid, action: 'activated' });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

const suspendSubscription = async (id, adminUid, reason) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE organization_subscriptions SET status = 'suspended', suspended_at = CURRENT_TIMESTAMP, suspension_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, reason || 'Suspended by admin']
    );
    if (res.rows.length === 0) throw new Error('Subscription not found');
    await logAudit(client, { subscriptionId: id, orgUid: res.rows[0].org_uid, adminUid, action: 'suspended', details: { reason } });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

const renewSubscription = async (id, adminUid) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(`SELECT os.*, sp.billing_cycle FROM organization_subscriptions os JOIN subscription_plans sp ON sp.id = os.plan_id WHERE os.id = $1`, [id]);
    if (subRes.rows.length === 0) throw new Error('Subscription not found');
    const sub = subRes.rows[0];

    const now = new Date();
    let newEnd = new Date(now);
    if (sub.billing_cycle === 'annual') {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setMonth(newEnd.getMonth() + 1);
    }

    const res = await client.query(
      `UPDATE organization_subscriptions SET status = 'active', current_period_start = $2, current_period_end = $3, renewed_at = $2, suspended_at = NULL, suspension_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, now, newEnd]
    );
    await logAudit(client, { subscriptionId: id, orgUid: sub.org_uid, adminUid, action: 'renewed', details: { new_period_end: newEnd } });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

const extendTrial = async (id, adminUid, extraDays = 7) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const subRes = await client.query(`SELECT * FROM organization_subscriptions WHERE id = $1`, [id]);
    if (subRes.rows.length === 0) throw new Error('Subscription not found');
    const sub = subRes.rows[0];

    const baseDate = sub.trial_ends_at ? new Date(sub.trial_ends_at) : new Date();
    const newTrialEnd = new Date(baseDate.getTime() + extraDays * 24 * 60 * 60 * 1000);

    const res = await client.query(
      `UPDATE organization_subscriptions SET trial_ends_at = $2, current_period_end = $2, status = 'trial', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, newTrialEnd]
    );
    await logAudit(client, { subscriptionId: id, orgUid: sub.org_uid, adminUid, action: 'trial_extended', details: { extra_days: extraDays, new_trial_end: newTrialEnd } });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

const cancelSubscription = async (id, adminUid, reason) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE organization_subscriptions SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, suspension_reason = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, reason || null]
    );
    if (res.rows.length === 0) throw new Error('Subscription not found');
    await logAudit(client, { subscriptionId: id, orgUid: res.rows[0].org_uid, adminUid, action: 'cancelled', details: { reason } });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

// ─── Invoices ─────────────────────────────────────────────────────────────────

const generateInvoice = async ({ orgUid, subscriptionId, adminUid, notes }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const subRes = await client.query(
      `SELECT os.*, sp.price, sp.name AS plan_name, sp.billing_cycle FROM organization_subscriptions os JOIN subscription_plans sp ON sp.id = os.plan_id WHERE os.id = $1`,
      [subscriptionId]
    );
    if (subRes.rows.length === 0) throw new Error('Subscription not found');
    const sub = subRes.rows[0];

    const amount = parseFloat(sub.price) || 0;
    const taxRate = 0.18; // 18% GST
    const taxAmount = Math.round(amount * taxRate * 100) / 100;
    const totalAmount = Math.round((amount + taxAmount) * 100) / 100;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const res = await client.query(
      `INSERT INTO subscription_invoices 
       (invoice_number, subscription_id, org_uid, plan_id, amount, tax_amount, total_amount, billing_period_start, billing_period_end, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [generateInvoiceNumber(), subscriptionId, orgUid || sub.org_uid, sub.plan_id, amount, taxAmount, totalAmount, sub.current_period_start, sub.current_period_end, dueDate, notes || null]
    );

    await logAudit(client, { subscriptionId, orgUid: sub.org_uid, adminUid, action: 'invoice_generated', details: { invoice_number: res.rows[0].invoice_number, total: totalAmount } });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

const getAllInvoices = async ({ page = 1, limit = 50, status, orgUid }) => {
  const { offset } = paginate(page, limit);
  let where = [];
  let params = [];
  let idx = 1;

  if (status) { where.push(`si.status = $${idx++}`); params.push(status); }
  if (orgUid) { where.push(`si.org_uid = $${idx++}`); params.push(orgUid); }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*) FROM subscription_invoices si ${whereClause}`, params);
  const res = await pool.query(
    `SELECT si.*, sp.name AS plan_name, fo.company_name AS org_name, u.email AS org_email
     FROM subscription_invoices si
     LEFT JOIN subscription_plans sp ON sp.id = si.plan_id
     LEFT JOIN fleet_onboarding fo ON fo.uid = si.org_uid
     LEFT JOIN users u ON u.uid = si.org_uid
     ${whereClause}
     ORDER BY si.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return { data: res.rows, total: parseInt(countRes.rows[0].count, 10), page, limit };
};

const getInvoiceById = async (id) => {
  const res = await pool.query(
    `SELECT si.*, sp.name AS plan_name, fo.company_name AS org_name, u.email AS org_email,
            COALESCE(json_agg(json_build_object(
              'id', spm.id, 'amount', spm.amount, 'payment_method', spm.payment_method,
              'status', spm.status, 'created_at', spm.created_at
            )) FILTER (WHERE spm.id IS NOT NULL), '[]') AS payments
     FROM subscription_invoices si
     LEFT JOIN subscription_plans sp ON sp.id = si.plan_id
     LEFT JOIN fleet_onboarding fo ON fo.uid = si.org_uid
     LEFT JOIN users u ON u.uid = si.org_uid
     LEFT JOIN subscription_payments spm ON spm.invoice_id = si.id
     WHERE si.id = $1
     GROUP BY si.id, sp.id, fo.id, u.uid`,
    [id]
  );
  return res.rows[0] || null;
};

const markInvoicePaid = async (id, adminUid, paymentMethod) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invRes = await client.query(
      `UPDATE subscription_invoices SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );
    if (invRes.rows.length === 0) throw new Error('Invoice not found');
    const inv = invRes.rows[0];

    await client.query(
      `INSERT INTO subscription_payments (invoice_id, org_uid, amount, payment_method, status)
       VALUES ($1, $2, $3, $4, 'success')`,
      [id, inv.org_uid, inv.total_amount, paymentMethod || 'manual']
    );

    await logAudit(client, { subscriptionId: inv.subscription_id, orgUid: inv.org_uid, adminUid, action: 'invoice_paid', details: { invoice_number: inv.invoice_number, amount: inv.total_amount } });
    await client.query('COMMIT');
    return inv;
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

const getSubscriptionDashboard = async () => {
  const [
    totalRes, activeRes, trialRes, suspendedRes, expiredRes,
    mrrRes, planDistRes, recentRes
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) FROM organization_subscriptions`),
    pool.query(`SELECT COUNT(*) FROM organization_subscriptions WHERE status = 'active'`),
    pool.query(`SELECT COUNT(*) FROM organization_subscriptions WHERE status = 'trial'`),
    pool.query(`SELECT COUNT(*) FROM organization_subscriptions WHERE status = 'suspended'`),
    pool.query(`SELECT COUNT(*) FROM organization_subscriptions WHERE status IN ('expired', 'cancelled')`),
    pool.query(`
      SELECT COALESCE(SUM(sp.price), 0) AS mrr
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON sp.id = os.plan_id
      WHERE os.status = 'active' AND sp.billing_cycle = 'monthly'
    `),
    pool.query(`
      SELECT sp.name, sp.slug, COUNT(os.id) AS count
      FROM subscription_plans sp
      LEFT JOIN organization_subscriptions os ON os.plan_id = sp.id AND os.status NOT IN ('cancelled', 'expired')
      GROUP BY sp.id ORDER BY sp.sort_order
    `),
    pool.query(`
      SELECT sal.*, fo.company_name AS org_name
      FROM subscription_audit_log sal
      LEFT JOIN fleet_onboarding fo ON fo.uid = sal.org_uid
      ORDER BY sal.created_at DESC LIMIT 10
    `),
  ]);

  // Revenue stats
  const revenueRes = await pool.query(`
    SELECT COALESCE(SUM(total_amount), 0) AS total_revenue,
           COALESCE(SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END), 0) AS pending_revenue,
           COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_invoices,
           COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_invoices
    FROM subscription_invoices
  `);

  return {
    statistics: {
      totalSubscriptions: parseInt(totalRes.rows[0].count, 10),
      activeSubscriptions: parseInt(activeRes.rows[0].count, 10),
      trialSubscriptions: parseInt(trialRes.rows[0].count, 10),
      suspendedSubscriptions: parseInt(suspendedRes.rows[0].count, 10),
      expiredSubscriptions: parseInt(expiredRes.rows[0].count, 10),
      mrr: parseFloat(mrrRes.rows[0].mrr) || 0,
      totalRevenue: parseFloat(revenueRes.rows[0].total_revenue) || 0,
      pendingRevenue: parseFloat(revenueRes.rows[0].pending_revenue) || 0,
      pendingInvoices: parseInt(revenueRes.rows[0].pending_invoices, 10),
      paidInvoices: parseInt(revenueRes.rows[0].paid_invoices, 10),
    },
    planDistribution: planDistRes.rows,
    recentActivity: recentRes.rows,
  };
};

// ─── Payments ─────────────────────────────────────────────────────────────────

const getPayments = async ({ page = 1, limit = 50 }) => {
  const { offset } = paginate(page, limit);
  const countRes = await pool.query(`SELECT COUNT(*) FROM subscription_payments`);
  const res = await pool.query(
    `SELECT spm.*, si.invoice_number, fo.company_name AS org_name
     FROM subscription_payments spm
     LEFT JOIN subscription_invoices si ON si.id = spm.invoice_id
     LEFT JOIN fleet_onboarding fo ON fo.uid = spm.org_uid
     ORDER BY spm.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { data: res.rows, total: parseInt(countRes.rows[0].count, 10), page, limit };
};

module.exports = {
  getAllPlans, getPlanById, createPlan, updatePlan, deletePlan,
  getAllSubscriptions, getSubscriptionByOrg, assignPlan,
  activateSubscription, suspendSubscription, renewSubscription, extendTrial, cancelSubscription,
  generateInvoice, getAllInvoices, getInvoiceById, markInvoicePaid,
  getSubscriptionDashboard, getPayments,
};
