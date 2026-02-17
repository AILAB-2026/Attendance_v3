
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

// Master DB connection to fetch list of companies
const masterPool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "attendance_db",
});

async function run() {
    console.log('🚀 Starting Multi-Company Audit Log Migration...');

    let companies = [];
    try {
        const res = await masterPool.query('SELECT company_code, company_name, server_host, server_port, server_user, server_password, database_name FROM companies WHERE active = true');
        companies = res.rows;
        console.log(`✅ Found ${companies.length} active companies.`);
    } catch (err) {
        console.error('❌ Failed to fetch companies from Master DB:', err.message);
        process.exit(1);
    } finally {
        await masterPool.end();
    }

    for (const company of companies) {
        console.log(`\n-----------------------------------------------------------`);
        console.log(`🏢 Processing Company: ${company.company_name} (${company.company_code})`);
        console.log(`   Target DB: ${company.database_name} on ${company.server_host}:${company.server_port}`);

        const companyPool = new Pool({
            host: company.server_host === 'localhost' ? '127.0.0.1' : company.server_host,
            port: Number(company.server_port),
            user: company.server_user,
            password: company.server_password,
            database: company.database_name,
            connectionTimeoutMillis: 5000
        });

        try {
            const client = await companyPool.connect();
            try {
                // SQL to create the audit logs table in the company DB
                const sql = `
          -- Self-contained UUID v4 style generator
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

                await client.query(sql);
                console.log(`   ✅ audit_logs table created/verified.`);
            } catch (err) {
                console.error(`   ❌ Failed to execute SQL:`, err.message);
            } finally {
                client.release();
            }
        } catch (err) {
            console.error(`   ❌ Failed to connect to company DB:`, err.message);
        } finally {
            await companyPool.end();
        }
    }

    console.log(`\n-----------------------------------------------------------`);
    console.log('🎉 Migration finished for all companies.');
}

run();
