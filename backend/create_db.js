const { Client } = require('pg');
require('dotenv').config();

async function createDatabase() {
    const dbName = process.env.PG_DATABASE || 'dravyantra';
    const client = new Client({
        user: process.env.PG_USER || 'postgres',
        host: process.env.PG_HOST || 'localhost',
        password: process.env.PG_PASSWORD || 'password',
        port: process.env.PG_PORT || 5432,
        database: 'postgres' // Connect to default database
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
        if (res.rowCount === 0) {
            console.log(`Database ${dbName} does not exist. Creating...`);
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`Database ${dbName} created successfully.`);
        } else {
            console.log(`Database ${dbName} already exists.`);
        }
    } catch (err) {
        console.error('Error creating database:', err);
    } finally {
        await client.end();
    }
}

createDatabase();
