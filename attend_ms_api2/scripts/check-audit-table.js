import dotenv from "dotenv";
dotenv.config();
import { query } from "../src/dbconn.js";

async function checkAuditTable() {
    try {
        console.log("Checking for app_audit_logs table...");
        const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'app_audit_logs'
    `);

        if (res.rows.length === 0) {
            console.log("❌ Table 'app_audit_logs' does NOT exist.");
        } else {
            console.log("✅ Table 'app_audit_logs' exists with columns:");
            console.log("✅ Columns:", res.rows.map(r => r.column_name).join(", "));
        }
    } catch (err) {
        console.error("Error checking table:", err);
    } finally {
        process.exit();
    }
}

checkAuditTable();
