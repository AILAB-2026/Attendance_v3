
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "openpg",
    password: "openpgpwd",
    database: "attendance_db"
});

async function checkCompanies() {
    try {
        console.log("Checking companies table in attendance_db...");
        const result = await pool.query('SELECT * FROM companies');
        console.log(`Found ${result.rows.length} companies.`);
        result.rows.forEach(r => {
            console.log(`- [${r.company_code}] ${r.company_name} (Active: ${r.active}) DB: ${r.database_name}`);
        });

        const skk = result.rows.find(r => r.company_code?.toUpperCase() === 'SKK');
        if (!skk) {
            console.log("\n❌ SKK company NOT found in table.");
        } else {
            console.log("\n✅ SKK company found:", skk);
        }

    } catch (err) {
        console.error("Error querying companies:", err);
    } finally {
        pool.end();
    }
}

checkCompanies();
