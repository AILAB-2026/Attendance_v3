import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "openpg",
    password: "openpgpwd",
    database: "attendance_db",
});

async function check() {
    try {
        const res = await pool.query("SELECT id, company_code, company_name, database_name, active FROM companies");
        res.rows.forEach(r => {
            console.log(`ID: ${r.id}, Code: ${r.company_code}, Name: ${r.company_name}, DB: ${r.database_name}, Active: ${r.active}`);
        });
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

check();
