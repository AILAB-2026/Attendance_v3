
import dotenv from 'dotenv';
dotenv.config();
import pkg from 'pg';
const { Pool } = pkg;

async function debugAilab() {
    // 1. Connect to master DB
    const masterPool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'attendance_db'
    });

    try {
        console.log('--- Checking Master DB for AILAB ---');
        const companyRes = await masterPool.query("SELECT * FROM companies WHERE company_code = 'AILAB'");

        if (companyRes.rows.length === 0) {
            console.log('❌ Company AILAB not found in master DB.');
            return;
        }

        const company = companyRes.rows[0];
        console.log('✅ Found Company AILAB:');
        console.log(`   DB Name: ${company.database_name}`);
        console.log(`   Host: ${company.server_host}`);
        console.log(`   Active: ${company.active}`);

        if (!company.active) {
            console.log('❌ Company is inactive.');
            return;
        }

        // 2. Connect to Company DB
        const companyPool = new Pool({
            host: company.server_host,
            port: Number(company.server_port || 5432),
            user: company.server_user,
            password: company.server_password,
            database: company.database_name
        });

        console.log(`--- Connecting to Company DB: ${company.database_name} ---`);
        try {
            const userRes = await companyPool.query(
                'SELECT id, "x_Emp_No" as employeeNo, name, password, active FROM hr_employee WHERE LOWER("x_Emp_No") = LOWER($1)',
                ['AILAB0007']
            );

            if (userRes.rows.length === 0) {
                console.log('❌ User AILAB0007 not found in hr_employee table.');

                // Debug: list some users
                console.log('   List of some users in this DB to verify:');
                const listRes = await companyPool.query('SELECT "x_Emp_No", name FROM hr_employee LIMIT 5');
                console.table(listRes.rows);
            } else {
                const user = userRes.rows[0];
                console.log('✅ Found User:');
                console.log(`   ID: ${user.id}`);
                console.log(`   Name: ${user.name}`);
                console.log(`   Employee No: ${user.employeeNo}`);
                console.log(`   Active: ${user.active}`);
                console.log(`   Password in DB: ${user.password}`);

                // Check password match manually
                const inputPass = 'Test@123';
                if (user.password === inputPass) {
                    console.log('✅ Password "Test@123" matches.');
                } else {
                    console.log(`❌ Password mismatch. Expected "${user.password}", got "${inputPass}"`);
                }
            }
        } catch (err) {
            console.error('Error querying company DB:', err.message);
        } finally {
            await companyPool.end();
        }

    } catch (err) {
        console.error('Error querying master DB:', err.message);
    } finally {
        await masterPool.end();
    }
}

debugAilab();
