
import dotenv from "dotenv";
dotenv.config();

const { Pool } = await import("pg").then(pkg => pkg.default);
const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function checkAuditLog() {
    try {
        const res = await pool.query("SELECT created_at, action, status, emp_no, remark FROM app_audit_logs ORDER BY created_at DESC LIMIT 20");
        res.rows.forEach(row => {
            console.log(`${row.created_at.toISOString()} | ${String(row.action).padEnd(25)} | ${String(row.status).padEnd(15)} | ${String(row.emp_no).padEnd(10)} | ${row.remark}`);
        });
    } catch (err) {
        console.error("Error:", err);
    }
    pool.end();
}

checkAuditLog();
