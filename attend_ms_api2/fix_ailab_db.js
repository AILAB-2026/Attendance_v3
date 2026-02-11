
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'attendance_db'
});

async function fixAilab() {
    try {
        console.log('Updating AILAB to point to localhost...');
        const res = await pool.query(`
            UPDATE companies 
            SET server_host = 'localhost',
                server_port = 5432,
                server_user = 'postgres',
                server_password = $1
            WHERE company_code = 'AILAB'
        `, [process.env.DB_PASSWORD]);
        console.log(`Updated ${res.rowCount} row(s).`);
    } catch (err) {
        console.error('Error updating company:', err);
    } finally {
        await pool.end();
    }
}

fixAilab();
