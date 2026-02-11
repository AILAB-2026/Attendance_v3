import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'SKK';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Get all columns from project_project table
        console.log("=== project_project columns ===");
        const colQuery = `
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'project_project'
            ORDER BY ordinal_position;
        `;
        const colRes = await pool.query(colQuery);
        colRes.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });

        // Get a sample row with key columns
        console.log("\n=== Sample rows (name and site_location) ===");
        const sampleQuery = `
            SELECT id, name, site_location
            FROM project_project
            WHERE active = true AND site_location IS NOT NULL
            LIMIT 5;
        `;
        const sampleRes = await pool.query(sampleQuery);
        sampleRes.rows.forEach((row, i) => {
            const projectName = row.name?.en_US || row.name?.en_us || JSON.stringify(row.name);
            console.log(`\nRow ${i + 1}:`);
            console.log(`  id: ${row.id}`);
            console.log(`  name (Project): ${projectName}`);
            console.log(`  site_location (Site): ${row.site_location}`);
        });

        // Count distinct site_locations
        console.log("\n=== Distinct site_location values ===");
        const distinctQuery = `
            SELECT DISTINCT site_location 
            FROM project_project 
            WHERE active = true AND site_location IS NOT NULL AND site_location != ''
            ORDER BY site_location
            LIMIT 10;
        `;
        const distinctRes = await pool.query(distinctQuery);
        distinctRes.rows.forEach(row => {
            console.log(`  - ${row.site_location}`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
