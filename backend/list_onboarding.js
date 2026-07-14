require('dotenv').config(); 
const {pool} = require('./dbconfig'); 
pool.query('SELECT * FROM fleet_onboarding').then(r => { console.log(r.rows); process.exit(0); }).catch(console.error);
