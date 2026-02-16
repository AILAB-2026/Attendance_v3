
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

async function debugSetup() {
    const client = await masterPool.connect();
    try {
        // Check if table exists
        const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'schema_mappings'
    `);
        console.log("Table exists:", tableCheck.rows.length > 0);

        if (tableCheck.rows.length === 0) {
            console.log("Creating table...");
            await client.query(`
        CREATE TABLE schema_mappings (
          id SERIAL PRIMARY KEY,
          company_code VARCHAR(50) NOT NULL,
          endpoint VARCHAR(100) NOT NULL,
          mapping_json JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(company_code, endpoint)
        );
      `);
            console.log("Table created.");
        }

        // Check columns
        const cols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'schema_mappings'
    `);
        console.log("Columns:", cols.rows.map(r => r.column_name));

        // Check current data
        const data = await client.query("SELECT * FROM schema_mappings");
        console.log("Current rows:", data.rows.length);

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        client.release();
        await masterPool.end();
    }
}

debugSetup();
