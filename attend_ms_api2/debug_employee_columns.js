import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
    host: "localhost",
    port: 5432,
    user: "openpg",
    password: "openpgpwd",
    database: "CX18SKK_TECH",
});

async function checkColumns() {
    try {
        console.log("Checking hr_employee columns...");
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'hr_employee'
    `);
        const cols = res.rows.map(r => r.column_name);
        console.log("Columns:", cols.sort().join(", "));

        // Check for specific interest
        console.log("Has user_id?", cols.includes('user_id'));
        console.log("Has address_home_id?", cols.includes('address_home_id'));
        console.log("Has partner_id?", cols.includes('partner_id')); // Maybe direct link?

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkColumns();
