import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "openpg",
    password: "openpgpwd",
    database: "postgres", // Connect to default DB to list others
});

async function check() {
    try {
        const res = await pool.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
        console.log("Databases:");
        res.rows.forEach(r => console.log(` - ${r.datname}`));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await pool.end();
    }
}

check();
