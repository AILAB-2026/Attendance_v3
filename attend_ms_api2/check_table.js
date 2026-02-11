
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

async function checkTableStructure() {
    try {
        const result = await masterPool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'schema_mappings'
      ORDER BY ordinal_position
    `);
        console.log("Table Structure:");
        console.table(result.rows);
    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await masterPool.end();
    }
}

checkTableStructure();
