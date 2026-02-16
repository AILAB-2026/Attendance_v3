import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

// Master DB Config
const masterPoolConfig = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "attendance_db",
};

const masterPool = new Pool(masterPoolConfig);

async function fixCompanySurveyLines(company) {
    console.log(`\n-----------------------------------------------------------`);
    console.log(`Processing company: ${company.company_code} (${company.company_name})`);

    const host = (company.server_host?.trim() === 'localhost') ? '127.0.0.1' : company.server_host?.trim();

    const pool = new Pool({
        host: host,
        port: Number(company.server_port || 5432),
        user: company.server_user,
        password: company.server_password,
        database: company.database_name,
    });

    try {
        await pool.query("SELECT 1"); // Health check
        console.log(`✅ Connected to DB: ${company.database_name}`);

        // Find survey_user_input_line records missing survey_id or answer_type
        const res = await pool.query(`
            SELECT sil.id, sil.user_input_id, sil.question_id, sil.value_char_box, sil.value_text_box, 
                   sil.value_numerical_box, sil.suggested_answer_id
            FROM survey_user_input_line sil
            WHERE sil.survey_id IS NULL OR sil.answer_type IS NULL
        `);

        console.log(`   Found ${res.rows.length} records to fix.`);

        let updatedCount = 0;

        for (const row of res.rows) {
            // Get survey_id from user_input
            const userInputRes = await pool.query(
                `SELECT survey_id FROM survey_user_input WHERE id = $1`,
                [row.user_input_id]
            );

            if (userInputRes.rows.length === 0) {
                console.log(`   ⚠️ No user_input found for line ${row.id}`);
                continue;
            }

            const surveyId = userInputRes.rows[0].survey_id;

            // Get question sequence
            const questionRes = await pool.query(
                `SELECT sequence FROM survey_question WHERE id = $1`,
                [row.question_id]
            );
            const questionSequence = questionRes.rows[0]?.sequence || 0;

            // Determine answer_type
            let answerType = 'char_box';
            if (row.suggested_answer_id) {
                answerType = 'suggestion';
            } else if (row.value_numerical_box !== null) {
                answerType = 'numerical_box';
            } else if (row.value_text_box !== null) {
                answerType = 'text_box';
            } else if (row.value_char_box !== null) {
                answerType = 'char_box';
            }

            // Update the record
            await pool.query(`
                UPDATE survey_user_input_line 
                SET survey_id = $1, 
                    question_sequence = $2, 
                    answer_type = $3, 
                    skipped = COALESCE(skipped, false)
                WHERE id = $4
            `, [surveyId, questionSequence, answerType, row.id]);

            updatedCount++;
        }

        console.log(`   -> Successfully updated ${updatedCount} records.`);

    } catch (err) {
        console.error(`❌ Error updating company ${company.company_code}:`, err.message);
    } finally {
        await pool.end();
    }
}

async function run() {
    try {
        console.log("🚀 Starting data fix for survey_user_input_line...");

        const res = await masterPool.query("SELECT * FROM companies WHERE active = true");
        const companies = res.rows;
        console.log(`Found ${companies.length} active companies.`);

        for (const company of companies) {
            await fixCompanySurveyLines(company);
        }

        console.log("\n✅ All fix operations completed.");
    } catch (err) {
        console.error("❌ Fatal error:", err);
    } finally {
        await masterPool.end();
    }
}

run();
