
import dotenv from 'dotenv';
import pg from 'pg';
import { getCompanyPool } from './src/multiCompanyDb.js';

dotenv.config();

const { Pool } = pg;

// Connect to Master DB to get list of companies
const masterPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

async function migrate() {
    console.log('Fetching active companies...');
    const companiesRes = await masterPool.query('SELECT company_code FROM companies WHERE active = true');
    const codes = companiesRes.rows.map(r => r.company_code);

    console.log(`Found ${codes.length} active companies. Starting migration...`);

    for (const code of codes) {
        try {
            console.log(`Checking ${code}...`);
            const pool = await getCompanyPool(code);

            // Check if column exists
            const check = await pool.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='app_feedback' AND column_name='submitted_at'
            `);

            if (check.rows.length === 0) {
                console.log(`Adding submitted_at to ${code}...`);
                await pool.query(`ALTER TABLE app_feedback ADD COLUMN submitted_at VARCHAR(100)`);
                console.log(`✅ Added submitted_at to ${code}`);
            } else {
                console.log(`ℹ️ submitted_at already exists in ${code}`);
            }

        } catch (err) {
            console.error(`❌ Error migrating ${code}:`, err.message);
        }
    }

    console.log('Migration complete.');
    process.exit(0);
}

migrate();
