import dotenv from "dotenv";
dotenv.config();
import { query } from "../src/dbconn.js";

async function fixAuditTable() {
    try {
        console.log("Checking and fixing app_audit_logs table...");

        // Create table if not exists (covering all columns)
        await query(`
      CREATE TABLE IF NOT EXISTS app_audit_logs (
        id SERIAL PRIMARY KEY,
        company_code VARCHAR(20),
        emp_no VARCHAR(50),
        user_id VARCHAR(50),
        action VARCHAR(50),
        status VARCHAR(20),
        remark TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
        console.log("✅ Verified table existence.");

        // Add columns if they don't exist
        const columnsToAdd = [
            "user_id VARCHAR(50)",
            "action VARCHAR(50)",
            "status VARCHAR(20)",
            "emp_no VARCHAR(50)",
            "company_code VARCHAR(20)",
            "remark TEXT",
            "metadata JSONB"
        ];

        for (const col of columnsToAdd) {
            const colName = col.split(' ')[0];
            try {
                await query(`ALTER TABLE app_audit_logs ADD COLUMN IF NOT EXISTS ${col}`);
                console.log(`✅ Ensured column ${colName} exists.`);
            } catch (e) {
                console.log(`⚠️ Note on column ${colName}: ${e.message}`);
            }
        }

        console.log("✅ Audit table fix completed.");

    } catch (err) {
        console.error("❌ Error fixing table:", err);
    } finally {
        process.exit();
    }
}

fixAuditTable();
