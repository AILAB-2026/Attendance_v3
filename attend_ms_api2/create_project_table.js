
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        console.log(`Creating project_project table...`);

        await pool.query(`
      CREATE TABLE IF NOT EXISTS project_project (
        id SERIAL PRIMARY KEY,
        name JSONB,
        active BOOLEAN DEFAULT true,
        company_id INTEGER,
        partner_id INTEGER,
        user_id INTEGER,
        date_start DATE,
        date DATE,
        description TEXT,
        privacy_visibility VARCHAR(50) DEFAULT 'portal',
        sequence INTEGER DEFAULT 10,
        create_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        write_date TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        create_uid INTEGER,
        write_uid INTEGER
      );
    `);

        console.log(`✅ project_project table created.`);

        // Insert some sample data
        console.log(`Inserting sample project data...`);

        await pool.query(`
      INSERT INTO project_project (name, active, company_id)
      VALUES 
        ('{"en_US": "Main Office"}', true, 1),
        ('{"en_US": "Branch Office"}', true, 1),
        ('{"en_US": "Remote Site"}', true, 1)
      ON CONFLICT DO NOTHING;
    `);

        console.log(`✅ Sample data inserted.`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
};

run();
