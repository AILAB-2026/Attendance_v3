import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'SKK';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Test 1: Check what site_location values exist
        console.log("=== Sample site_location values ===");
        const sampleSites = await pool.query(`
            SELECT id, site_location, name->>'en_US' as project_name
            FROM project_project
            WHERE active = true AND site_location IS NOT NULL AND site_location != ''
            LIMIT 10
        `);
        sampleSites.rows.forEach(row => {
            console.log(`  ID: ${row.id} | Site: "${row.site_location}" | Project: "${row.project_name}"`);
        });

        // Test 2: Check recent clocking records
        console.log("\n=== Recent employee_clocking_line records ===");
        const recentClocking = await pool.query(`
            SELECT 
                ecl.id, 
                ecl.site_id, 
                ecl.site_name,
                ecl.project_id,
                ecl.project_name,
                ecl.clock_in_date,
                pp_site.site_location as site_from_join,
                pp_project.name->>'en_US' as project_from_join
            FROM employee_clocking_line ecl
            LEFT JOIN project_project pp_site ON ecl.site_id = pp_site.id
            LEFT JOIN project_project pp_project ON ecl.project_id = pp_project.id
            ORDER BY ecl.clock_in_date DESC, ecl.id DESC
            LIMIT 5
        `);
        recentClocking.rows.forEach(row => {
            console.log(`\n  Record ID: ${row.id}`);
            console.log(`    site_id: ${row.site_id} | site_name in table: "${row.site_name}"`);
            console.log(`    site from JOIN (site_location): "${row.site_from_join}"`);
            console.log(`    project_id: ${row.project_id} | project_name in table: "${row.project_name}"`);
            console.log(`    project from JOIN (name.en_US): "${row.project_from_join}"`);
        });

        // Test 3: Try searching for a site by site_location
        if (sampleSites.rows.length > 0) {
            const testSite = sampleSites.rows[0].site_location;
            console.log(`\n=== Testing site lookup for: "${testSite}" ===`);
            const lookup = await pool.query(
                `SELECT id, site_location FROM project_project WHERE site_location = $1 LIMIT 5`,
                [testSite]
            );
            console.log(`  Found ${lookup.rows.length} matches:`);
            lookup.rows.forEach(r => console.log(`    ID: ${r.id} | site_location: "${r.site_location}"`));
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
