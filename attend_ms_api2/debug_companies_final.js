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
        const res = await pool.query("SELECT id, company_code, database_name FROM companies");
        res.rows.forEach(r => {
            console.log(`${r.id}|${r.company_code}|${r.database_name}`);
        });
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

check();
