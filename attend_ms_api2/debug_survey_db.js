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
        const companies = await pool.query("SELECT * FROM companies");
        console.log(`Found ${companies.rows.length} companies.`);

        for (const company of companies.rows) {
            console.log(`\nChecking Company: ${company.company_code} (DB: ${company.database_name})`);

            // Connect to Company DB
            const companyPool = new Pool({
                host: company.server_host === 'localhost' ? '127.0.0.1' : company.server_host,
                port: company.server_port,
                user: company.server_user,
                password: company.server_password,
                database: company.database_name,
            });

            try {
                const surveyCount = await companyPool.query("SELECT count(*) FROM survey_survey");
                console.log(`  Total Surveys: ${surveyCount.rows[0].count}`);

                const activeSurveys = await companyPool.query("SELECT id, title, active, access_mode, create_date FROM survey_survey");
                console.log("  Surveys details:");
                activeSurveys.rows.forEach(s => {
                    console.log(`    - [${s.id}] "${s.title}" (Active: ${s.active}) (Access: ${s.access_mode})`);
                });

            } catch (e) {
                console.error(`  ❌ Error querying company DB: ${e.message}`);
            } finally {
                await companyPool.end();
            }
        }

    } catch (err) {
        console.error("Master DB Error:", err);
    } finally {
        await pool.end();
    }
}

check();
