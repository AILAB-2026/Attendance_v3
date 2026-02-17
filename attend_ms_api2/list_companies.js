
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function list() {
    try {
        const res = await pool.query('SELECT company_code, db_name FROM companies');
        console.log('Companies:', res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

list();
