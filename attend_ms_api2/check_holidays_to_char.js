
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Mimic the query from userRoutes.js exactly
        const holidaysQuery = `
      SELECT DISTINCT to_char(d, 'YYYY-MM-DD') as date_str
      FROM resource_calendar_leaves
      CROSS JOIN generate_series(date_from, date_to - interval '1 second', '1 day') as d
      WHERE resource_id IS NULL
        AND x_is_public_holiday = TRUE
        AND date_from >= CURRENT_DATE - INTERVAL '1 year'
        AND date_from <= CURRENT_DATE + INTERVAL '1 year'
      ORDER BY 1
    `;

        console.log('Running query similar to userRoutes...');
        const res = await pool.query(holidaysQuery);
        console.log(`Found ${res.rows.length} holiday dates (multi-day expanded):`);
        console.log(JSON.stringify(res.rows.map(r => r.date_str), null, 2));

        process.exit(0);
    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
};

run();
