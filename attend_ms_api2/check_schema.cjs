
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'attendance_db',
    password: 'pgsql@2025',
    port: 5432,
});

async function checkColumns() {
    const tables = ['hr_employee', 'hr_leave', 'employee_clocking_line'];

    for (const table of tables) {
        console.log(`\n\n--- Columns for ${table} ---`);
        const query = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = '${table}'
      ORDER BY column_name;
    `;

        try {
            const res = await pool.query(query);
            if (res.rows.length === 0) {
                console.log(`Table ${table} not found or no columns.`);
            } else {
                res.rows.forEach(row => {
                    console.log(`${row.column_name} (${row.data_type})`);
                });
            }
        } catch (err) {
            console.error(`Error querying ${table}:`, err.message);
        }
    }

    await pool.end();
}

checkColumns();
