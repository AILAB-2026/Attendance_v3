
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres' // Connect to default DB to list others
});

async function listDbs() {
    try {
        const res = await pool.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
        console.log('Databases found:', res.rows.map(r => r.datname).join(', '));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

listDbs();
