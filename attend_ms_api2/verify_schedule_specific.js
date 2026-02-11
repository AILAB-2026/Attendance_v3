
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

const COMPANY_CODE = 'SKK';
const BASE_URL = 'http://localhost:7010';
const TARGET_EMP_NO = 'SKK-IND-0002';

const run = async () => {
    try {
        const pool = await getCompanyPool(COMPANY_CODE);

        // Helper
        const getJSON = async (url) => {
            const resp = await fetch(url);
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`HTTP ${resp.status} ${resp.statusText} - ${text}`);
            }
            return resp.json();
        }

        // Check total active projects
        const projCount = await pool.query('SELECT count(*) FROM project_project WHERE active = true');
        console.log(`Total active projects in DB (${COMPANY_CODE}): ${projCount.rows[0].count}`);

        // 1. Get User Details directly from DB
        console.log(`Searching for user ${TARGET_EMP_NO}...`);
        const userRes = await pool.query(`SELECT "x_Emp_No", id, user_id, "x_site_popup" FROM hr_employee WHERE "x_Emp_No" = $1`, [TARGET_EMP_NO]);

        if (userRes.rows.length === 0) {
            console.log("User not found in DB.");
            process.exit(1);
        }

        const user = userRes.rows[0];
        console.log(`Found user: ${user.x_Emp_No} (ID: ${user.id}, UserID: ${user.user_id})`);
        console.log(`x_site_popup: ${user.x_site_popup}`);

        // 2. Check assigned schedule via API
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
                taskRes.data.slice(0, 5).forEach(t => console.log(` - ${t.name}`));
            } else {
                console.log("No assigned projects returned.");
            }
        } catch (e) {
            console.error("API Error:", e.message);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
};

run();
