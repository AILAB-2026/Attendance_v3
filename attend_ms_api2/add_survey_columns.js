import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

// Master DB Config
const masterPoolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "attendance_db",
};

const masterPool = new Pool(masterPoolConfig);

async function addColumnsToCompany(company) {
    console.log(`\n-----------------------------------------------------------`);
    console.log(`Processing company: ${company.company_code} (${company.company_name})`);

    // Fix for localhost ENOTFOUND
    const host = (company.server_host?.trim() === 'localhost') ? '127.0.0.1' : company.server_host?.trim();

    const pool = new Pool({
        host: host,
        port: Number(company.server_port || 5432),
        user: company.server_user,
        password: company.server_password,
        database: company.database_name,
    });

    try {
        await pool.query("SELECT 1"); // Health check
        console.log(`✅ Connected to DB: ${company.database_name}`);

        // 1. Add employee_name column
        await pool.query(`
            ALTER TABLE survey_user_input 
            ADD COLUMN IF NOT EXISTS employee_name TEXT
        `);
        console.log("   -> Added/Verified column: employee_name");

        // 2. Add employee_no column
        await pool.query(`
            ALTER TABLE survey_user_input 
            ADD COLUMN IF NOT EXISTS employee_no TEXT
        `);
        console.log("   -> Added/Verified column: employee_no");

    } catch (err) {
        console.error(`❌ Error updating company ${company.company_code}:`, err.message);
    } finally {
        await pool.end();
    }
}

async function run() {
    try {
        console.log("🚀 Starting database update for survey_user_input columns...");

        const res = await masterPool.query("SELECT * FROM companies WHERE active = true");
        const companies = res.rows;
        console.log(`Found ${companies.length} active companies.`);

        for (const company of companies) {
            await addColumnsToCompany(company);
        }

        console.log("\n✅ All updates completed.");
    } catch (err) {
        console.error("❌ Fatal error:", err);
    } finally {
        await masterPool.end();
    }
}

run();
