require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Connecting to DB:', process.env.DATABASE_URL);

        // SQL to create the audit logs table
        const sql = `
      -- Self-contained UUID v4 style generator without requiring extensions
      CREATE OR REPLACE FUNCTION app_gen_random_uuid()
      RETURNS uuid
      LANGUAGE SQL
      IMMUTABLE
      AS $$
        SELECT CAST(
          CONCAT(
            SUBSTRING(md5(random()::text || clock_timestamp()::text),1,8), '-',
            SUBSTRING(md5(random()::text || clock_timestamp()::text),1,4), '-',
            '4'||SUBSTRING(md5(random()::text || clock_timestamp()::text),1,3), '-',
            SUBSTRING('89ab', floor(random()*4)::int+1,1) || SUBSTRING(md5(random()::text || clock_timestamp()::text),1,3), '-',
            SUBSTRING(md5(random()::text || clock_timestamp()::text),1,12)
          ) AS uuid
        );
      $$;

      -- Application debug and audit logs
      CREATE TABLE IF NOT EXISTS app_audit_logs (
          id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
          company_code VARCHAR(50),
          emp_no VARCHAR(50),
          user_id VARCHAR(100),
          action VARCHAR(50) NOT NULL, 
          status VARCHAR(20) NOT NULL, 
          remark TEXT, 
          metadata JSONB DEFAULT '{}', 
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_emp_no ON app_audit_logs(emp_no);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON app_audit_logs(company_code);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON app_audit_logs(created_at);
    `;

        console.log('Running SQL...');
        await client.query(sql);
        console.log('✅ app_audit_logs table created successfully.');
    } catch (err) {
        console.error('❌ Error creating table:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
