const { pool } = require('./config/dbconfig');

async function seedTickets() {
  try {
    // Get a real user UID to assign as fleet owner
    const userRes = await pool.query("SELECT uid FROM users WHERE role='fleet_owner' LIMIT 1");
    if (userRes.rows.length === 0) {
      console.log('No fleet_owner users found. Skipping ticket seed.');
      pool.end();
      return;
    }
    const uid = userRes.rows[0].uid;

    // Check if tickets already exist
    const existing = await pool.query('SELECT COUNT(*) FROM support_tickets');
    if (parseInt(existing.rows[0].count, 10) > 0) {
      console.log('Tickets already seeded. Skipping.');
      pool.end();
      return;
    }

    const tickets = [
      { category: 'Technical', subject: 'GPS device not updating location', description: 'The GPS device on vehicle MH12AB1234 has not updated in 48 hours.', priority: 'High' },
      { category: 'Billing', subject: 'Incorrect invoice for June', description: 'The invoice for June 2025 shows extra charges not authorized.', priority: 'Medium' },
      { category: 'Fuel Sensor', subject: 'Fuel sensor reading inaccurate', description: 'The fuel sensor on KA03XY9090 shows 80% but tank is full.', priority: 'Urgent' },
      { category: 'Device Replacement', subject: 'Damaged GPS device needs replacement', description: 'The device on TN07CD5678 was damaged in an accident.', priority: 'High' },
      { category: 'Account', subject: 'Cannot add new driver', description: 'Getting error when trying to add a new driver to the platform.', priority: 'Low' },
    ];

    for (let i = 0; i < tickets.length; i++) {
      const t = tickets[i];
      const num = `TKT-${String(i + 1).padStart(5, '0')}`;
      const res = await pool.query(
        `INSERT INTO support_tickets (ticket_number, uid, category, subject, description, priority, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ticket_number`,
        [num, uid, t.category, t.subject, t.description, t.priority, i % 2 === 0 ? 'Open' : 'In Progress']
      );
      // Add initial message
      await pool.query(
        `INSERT INTO ticket_messages (ticket_number, sender_id, message) VALUES ($1, $2, $3)`,
        [num, uid, t.description]
      );
      console.log(`✅ Created ${res.rows[0].ticket_number}`);
    }

    console.log('✅ Support tickets seeded successfully!');
  } catch (err) {
    console.error('Error seeding tickets:', err.message);
  } finally {
    pool.end();
  }
}

seedTickets();
