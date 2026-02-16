
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js"; // Adjust path if necessary

const COMPANY_CODE = 'AILAB';

const run = async () => {
    try {
        console.log(`Getting pool for ${COMPANY_CODE}...`);
        const pool = await getCompanyPool(COMPANY_CODE);

        // Query for public holidays
        // Standard Odoo/Resource logic: global leaves have resource_id IS NULL
        const query = `
      SELECT 
        id, 
        name, 
        date_from, 
        date_to,
        x_is_public_holiday
      FROM resource_calendar_leaves 
      WHERE resource_id IS NULL
      ORDER BY date_from DESC;
    `;

        console.log(`Executing query to find public holidays for ${COMPANY_CODE}...`);
        const res = await pool.query(query);

        if (res.rows.length === 0) {
            console.log('No public holidays found.');
        } else {
            console.log(`Found ${res.rows.length} public holidays:`);
            console.log(JSON.stringify(res.rows.map(r => ({
                Name: r.name,
                DateFrom: r.date_from,
                DateTo: r.date_to,
                IsPublic: r.x_is_public_holiday
            })), null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ Error fetching holidays:", err);
        process.exit(1);
    }
};

run();
