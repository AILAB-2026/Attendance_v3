
import pkg from 'pg';
const { Pool } = pkg;

// Master DB connection to get credentials
const masterPool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'pgsql@2025',
    database: 'attendance_db',
});

async function fetchPublicHolidays() {
    let brkPool = null;
    try {
        // 1. Get BRK company config
        console.log('Fetching BRK config from attendance_db...');
        const companyRes = await masterPool.query(
            "SELECT * FROM companies WHERE company_code = 'BRK'"
        );

        if (companyRes.rows.length === 0) {
            console.error('Company BRK not found in companies table.');
            return;
        }

        const company = companyRes.rows[0];

        // 2. Connect to BRK DB
        brkPool = new Pool({
            host: company.server_host,
            port: company.server_port,
            user: company.server_user,
            password: company.server_password,
            database: company.database_name,
        });

        console.log(`Connecting to BRK DB: ${company.database_name} on ${company.server_host}...`);

        // 3. Fetch All Public Holidays
        console.log('\nFetching all public holidays...');
        const query = `
            SELECT id, name, date_from, date_to 
            FROM resource_calendar_leaves 
            WHERE resource_id IS NULL 
              AND x_is_public_holiday = TRUE
            ORDER BY date_from ASC;
        `;

        const res = await brkPool.query(query);

        if (res.rows.length === 0) {
            console.log('No public holidays found.');
        } else {
            console.log(`Found ${res.rows.length} public holidays:\n`);

            // Format nicely
            console.log("ID  | Date (UTC)           | Name");
            console.log("----|----------------------|--------------------------------");
            res.rows.forEach(row => {
                const dateStr = row.date_from.toISOString().replace('T', ' ').substring(0, 10);
                console.log(`${String(row.id).padEnd(3)} | ${dateStr.padEnd(20)} | ${row.name}`);
            });

            // Also print raw JSON for copy-pasting if needed
            // console.log(JSON.stringify(res.rows, null, 2));
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        if (brkPool) await brkPool.end();
        await masterPool.end();
    }
}

fetchPublicHolidays();
