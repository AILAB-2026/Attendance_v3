
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'AILAB';
const BASE_URL = 'http://192.168.1.5:7012';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Check total active projects
        const projCount = await pool.query('SELECT count(*) FROM project_project WHERE active = true');
        console.log(`Total active projects in DB: ${projCount.rows[0].count}`);

        // Helper
        const getJSON = async (url) => {
            const resp = await fetch(url);
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${text}`);
            }
            return resp.json();
        }

        // 1. Find a user with x_site_popup = true
        console.log("Searching for user with x_site_popup = true...");
        const restrictedUserRes = await pool.query(`SELECT "x_Emp_No", id, user_id FROM hr_employee WHERE "x_site_popup" = true AND active = true LIMIT 1`);

        if (restrictedUserRes.rows.length === 0) {
            console.log("No restricted user found. Cannot fully verify strict filtering.");
        } else {
            const user = restrictedUserRes.rows[0];
            console.log(`Found restricted user: ${user.x_Emp_No} (ID: ${user.id}, UserID: ${user.user_id})`);

            // Check assigned projects via API
            console.log(`\nTesting /assigned for ${user.x_Emp_No}...`);
            try {
                const params = new URLSearchParams({ companyCode: COMPANY_CODE, employeeNo: user.x_Emp_No });
                const res = await getJSON(`${BASE_URL}/schedule/assigned?${params}`);
                console.log(`Returned ${res.data.length} projects.`);
                res.data.forEach(p => console.log(` - ${p.projectName} (ID: ${p.id})`));

                if (res.data.length > 0) {
                    const firstProj = res.data[0];
                    console.log(`\nTesting /project-tasks for ${firstProj.projectName} with employeeNo...`);
                    const tParams = new URLSearchParams({
                        companyCode: COMPANY_CODE,
                        projectName: firstProj.projectName,
                        employeeNo: user.x_Emp_No
                    });
                    const taskRes = await getJSON(`${BASE_URL}/schedule/project-tasks?${tParams}`);
                    console.log(`Returned ${taskRes.data.length} tasks.`);
                    taskRes.data.slice(0, 3).forEach(t => console.log(` - ${t.name}`));
                } else {
                    console.log("User has no assigned projects, so skipping task check.");
                }
            } catch (e) {
                console.error("API Error:", e.message);
            }
        }

        // 2. Find a user with x_site_popup = false (or null)
        console.log("\nSearching for normal user...");
        const normalUserRes = await pool.query(`SELECT "x_Emp_No" FROM hr_employee WHERE "x_site_popup" IS NOT true AND active = true LIMIT 1`);

        if (normalUserRes.rows.length > 0) {
            const user = normalUserRes.rows[0];
            console.log(`Found normal user: ${user.x_Emp_No}`);

            console.log(`\nTesting /assigned for ${user.x_Emp_No}...`);
            try {
                const params = new URLSearchParams({ companyCode: COMPANY_CODE, employeeNo: user.x_Emp_No });
                const res = await getJSON(`${BASE_URL}/schedule/assigned?${params}`);
                console.log(`Returned ${res.data.length} projects.`);
            } catch (e) {
                console.error("API Error:", e.message);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();


