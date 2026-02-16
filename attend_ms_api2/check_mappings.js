
import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const masterPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'attendance_db',
});

async function checkMappings() {
    try {
        const result = await masterPool.query("SELECT company_code, endpoint, mapping_json->>'type' as type FROM schema_mappings WHERE endpoint = 'payslips'");
        console.log("Current Schema Mappings:");
        console.table(result.rows);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        masterPool.end();
    }
}

checkMappings();
