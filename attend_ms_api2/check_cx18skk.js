import pkg from 'pg';
const { Pool } = pkg;

// Config for the target DB directly
const companyPool = new Pool({
    host: "localhost",
    port: 5432,
    user: "openpg",
    password: "openpgpwd",
    database: "CX18SKK_TECH",
});

async function check() {
    try {
        console.log("Connecting to CX18SKK_TECH DB...");
        const surveyCount = await companyPool.query("SELECT count(*) FROM survey_survey");
        console.log(`Total Surveys in CX18SKK_TECH: ${surveyCount.rows[0].count}`);

        const activeSurveys = await companyPool.query("SELECT id, title, active, access_mode FROM survey_survey");
        activeSurveys.rows.forEach(s => {
            console.log(`Title Type: ${typeof s.title}`);
            console.log(`Title Value: ${JSON.stringify(s.title)}`);
            console.log(` - [${s.id}] "${s.title}" (Active: ${s.active}, Access: ${s.access_mode})`);
        });

    } catch (err) {
        console.error("Error connecting/querying CX18SKK_TECH:", err.message);
    } finally {
        await companyPool.end();
    }
}

check();
