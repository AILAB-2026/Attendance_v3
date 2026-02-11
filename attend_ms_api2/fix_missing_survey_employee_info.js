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

async function fixCompanySurveyData(company) {
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

        // 1. Fetch survey inputs with missing info
        const res = await pool.query(`
            SELECT id, partner_id, nickname 
            FROM survey_user_input 
            WHERE employee_no IS NULL OR employee_name IS NULL
        `);

        console.log(`   Found ${res.rows.length} records to update.`);

        let updatedCount = 0;

        for (const row of res.rows) {
            let empName = null;
            let empNo = null;

            if (row.partner_id) {
                // Find employee by partner_id
                const empRes = await pool.query(`
                    SELECT e.name, e."x_Emp_No" 
                    FROM hr_employee e 
                    JOIN res_users u ON e.user_id = u.id 
                    WHERE u.partner_id = $1
                    LIMIT 1
                `, [row.partner_id]);

                if (empRes.rows.length > 0) {
                    empName = empRes.rows[0].name;
                    empNo = empRes.rows[0].x_Emp_No;
                }
            } else if (row.nickname) {
                // Try to find employee by nickname (assuming it's formatted as Emp No)
                const empRes = await pool.query(`
                    SELECT e.name, e."x_Emp_No" 
                    FROM hr_employee e 
                    WHERE LOWER(TRIM(e."x_Emp_No")) = LOWER(TRIM($1))
                    LIMIT 1
                `, [row.nickname]);

                if (empRes.rows.length > 0) {
                    empName = empRes.rows[0].name;
                    empNo = empRes.rows[0].x_Emp_No;
                }
            }

            if (empName || empNo) {
                await pool.query(`
                    UPDATE survey_user_input 
                    SET employee_name = $1, employee_no = $2
                    WHERE id = $3
                `, [empName, empNo, row.id]);
                updatedCount++;
            }
        }

        console.log(`   -> Successfully updated ${updatedCount} records.`);

    } catch (err) {
        console.error(`❌ Error updating company ${company.company_code}:`, err.message);
    } finally {
        await pool.end();
    }
}

async function run() {
    try {
        console.log("🚀 Starting data backfill for survey_user_input...");

        const res = await masterPool.query("SELECT * FROM companies WHERE active = true");
        const companies = res.rows;
        console.log(`Found ${companies.length} active companies.`);

        for (const company of companies) {
            await fixCompanySurveyData(company);
        }

        console.log("\n✅ All backfill operations completed.");
    } catch (err) {
        console.error("❌ Fatal error:", err);
    } finally {
        await masterPool.end();
    }
}

run();
