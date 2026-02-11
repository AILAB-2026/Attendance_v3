import pkg from 'pg';
const { Pool } = pkg;

const dbConfig = {
    host: "localhost",
    port: 5432,
    user: "openpg",
    password: "openpgpwd",
    database: "attendance_db",
};

const pool = new Pool(dbConfig);

async function check() {
    try {
        console.log("Connecting to Master DB...");
        const companies = await pool.query("SELECT company_code, company_name, database_name FROM companies");
        console.table(companies.rows);
    } catch (err) {
        console.error("Master DB Error:", err);
    } finally {
        await pool.end();
    }
}

check();
