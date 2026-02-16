import pkg from 'pg';
const { Pool } = pkg;

// Connect to the database
const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'CX18AILABDEMO',  // Replace with your database name
    user: 'odoo',  // Replace with your username
    password: 'cx123',  // Replace with your password
});

async function checkEmployee() {
    try {
        const result = await pool.query(
            `SELECT id, "x_Emp_No", name, "x_working_days" FROM hr_employee WHERE "x_Emp_No" = 'TEST-001' LIMIT 1`
        );

        if (result.rows.length > 0) {
            const emp = result.rows[0];
            console.log('\n===== Employee Info =====');
            console.log(`Employee No: ${emp.x_Emp_No}`);
            console.log(`Name: ${emp.name}`);
            console.log(`Working Days: ${emp.x_working_days}`);
            console.log(`ID: ${emp.id}`);
        } else {
            console.log('Employee TEST-001 not found');
        }
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkEmployee();
