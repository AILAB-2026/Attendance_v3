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
        console.log("Checking survey_user_input columns...");
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'survey_user_input'
    `);
        const cols = res.rows.map(r => r.column_name);
        console.log("Columns:", cols.sort().join(", "));

        console.log("Has email?", cols.includes('email'));

        // Check Employee TEST-001
        console.log("\nChecking Employee TEST-001...");
        const empRes = await pool.query(`
        SELECT id, name, "x_Emp_No", user_id
        FROM hr_employee 
        WHERE "x_Emp_No" = 'TEST-001'
    `);
        const emp = empRes.rows[0];
        console.log("Employee Data:", emp);

        if (emp && emp.user_id) {
            console.log("Checking User:", emp.user_id);
            const userRes = await pool.query(`SELECT id, partner_id FROM res_users WHERE id = $1`, [emp.user_id]);
            console.log("User Data:", userRes.rows[0]);
        } else {
            console.log("Employee has NO user_id.");
        }

    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkColumns();
