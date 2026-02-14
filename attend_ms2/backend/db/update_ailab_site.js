
const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

async function run() {
    const companyCode = 'AILAB';
    const employeeNo = 'RMSB001';
    const newSiteName = 'AILAB-HQ'; // Customize this

    console.log(`🚀 Updating Site Name for ${employeeNo} in ${companyCode}...`);

    // 1. Connect to Master DB to get Company Config
    const masterPool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    let companyConfig = null;
    try {
        const res = await masterPool.query(
            'SELECT * FROM companies WHERE company_code = $1',
            [companyCode]
        );
        if (res.rows.length === 0) {
            console.error('❌ Company AILAB not found in Master DB.');
            process.exit(1);
        }
        companyConfig = res.rows[0];
    } catch (err) {
        console.error('❌ Master DB Error:', err.message);
        process.exit(1);
    } finally {
        await masterPool.end();
    }

    // 2. Connect to AILAB DB
    const companyPool = new Pool({
        host: companyConfig.server_host === 'localhost' ? '127.0.0.1' : companyConfig.server_host,
        port: Number(companyConfig.server_port),
        user: companyConfig.server_user,
        password: companyConfig.server_password,
        database: companyConfig.database_name,
    });

    try {
        const client = await companyPool.connect();

        // 3. Update Employee's x_site_popup (optional but good practice)
        // and find/update any associated project/site records if needed.
        // For this specific request, we might need to know WHERE the site name is stored.
        // Based on `simpleSitesRoutes.js`, site names come from `project_project.site_location` 
        // OR `project_employee_details` if linked.

        // Let's assume we want to update/insert a project assignment for this user with the new site name.

        // First, find the employee ID
        const empRes = await client.query('SELECT id FROM hr_employee WHERE "x_Emp_No" = $1', [employeeNo]);
        if (empRes.rows.length === 0) {
            console.error(`❌ Employee ${employeeNo} not found in AILAB DB.`);
        } else {
            const empId = empRes.rows[0].id;
            console.log(`✅ Found Employee ID: ${empId}`);

            // Fetch current assignments
            const projDetails = await client.query('SELECT * FROM project_employee_details WHERE employee_id = $1', [empId]);
            console.log(`ℹ️ Current assignments found: ${projDetails.rows.length}`);

            if (projDetails.rows.length > 0) {
                // Update all assignments for this user to have the correct site location
                // This is a bulk update for this user to 'fix' their site name.
                const updateRes = await client.query(
                    'UPDATE project_employee_details SET site_location = $1 WHERE employee_id = $2 RETURNING id, site_location',
                    [newSiteName, empId]
                );
                console.log(`✅ Updated ${updateRes.rowCount} assignment(s) to site: ${newSiteName}`);
            } else {
                console.log('⚠️ No existing project assignments found. Searching for a default project to assign...');

                // Find ANY active project to link to, just so they have a site
                const projRes = await client.query('SELECT id, name FROM project_project WHERE active = true LIMIT 1');
                if (projRes.rows.length > 0) {
                    const defaultProjId = projRes.rows[0].id;
                    const defaultProjName = projRes.rows[0].name;
                    console.log(`ℹ️ Found available project: ${JSON.stringify(defaultProjName)} (ID: ${defaultProjId})`);

                    await client.query(
                        'INSERT INTO project_employee_details (project_id, employee_id, site_location) VALUES ($1, $2, $3)',
                        [defaultProjId, empId, newSiteName]
                    );
                    console.log(`✅ Created new assignment for ${employeeNo} linked to project ${defaultProjId} with site ${newSiteName}`);
                } else {
                    console.error('❌ No active projects found in DB to link to.');
                }
            }

            // Ensure popup is enabled so they can see/change it if needed
            await client.query('UPDATE hr_employee SET "x_site_popup" = true WHERE id = $1', [empId]);
            console.log(`✅ Enabled x_site_popup for ${employeeNo}`);
        }

        client.release();
    } catch (err) {
        console.error('❌ Company DB Error:', err.message);
    } finally {
        await companyPool.end();
    }
}

run();
