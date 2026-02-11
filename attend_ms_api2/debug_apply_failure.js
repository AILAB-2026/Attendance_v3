
import dotenv from "dotenv";
dotenv.config();
import { getCompanyPool } from "./src/multiCompanyDb.js";

async function run() {
    try {
        const pool = await getCompanyPool('SKK');
        const empRes = await pool.query(`SELECT id FROM hr_employee WHERE "x_Emp_No" = 'SKK-IND-0005'`);
        const empId = empRes.rows[0].id;
        console.log(`Emp ID: ${empId}`);

        // 1. Get Leave Type ID for "annual"
        const typeRes = await pool.query(`
            SELECT id, name->>'en_US' as name 
            FROM hr_leave_type 
            WHERE LOWER(COALESCE(name->>'en_US','')) LIKE '%annual%'
            LIMIT 1
        `);
        const leaveTypeId = typeRes.rows[0].id;
        console.log(`Leave Type ID: ${leaveTypeId} (${typeRes.rows[0].name})`);

        // 2. Check Allocation with "Today"
        const today = '2025-12-30';
        console.log(`Checking allocation for date: ${today}`);

        const query = `
        SELECT 
            hla.id,
            hla.number_of_days as allocated_days,
            hla.date_from,
            hla.date_to
        FROM hr_leave_allocation hla
        WHERE hla.employee_id = $1 
            AND hla.holiday_status_id = $2
            AND hla.state = 'validate'
            AND $3::date >= hla.date_from 
            AND (hla.date_to IS NULL OR $3::date <= hla.date_to)
        ORDER BY hla.date_from DESC
        LIMIT 1
        `;

        const res = await pool.query(query, [empId, leaveTypeId, today]);

        if (res.rows.length === 0) {
            console.log("❌ No allocation found matching the query!");

            // Debug: Show actual allocations to see why mismatch
            const all = await pool.query(`
                SELECT id, date_from, date_to, state, holiday_status_id
                FROM hr_leave_allocation 
                WHERE employee_id = $1
            `, [empId]);
            console.log("All Allocations for User:");
            all.rows.forEach(r => {
                console.log(`  ID: ${r.id}, Type: ${r.holiday_status_id}, From: ${r.date_from}, To: ${r.date_to}, State: ${r.state}`);
            });

        } else {
            console.log("✅ Allocation Found:", res.rows[0]);
        }

    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
run();
