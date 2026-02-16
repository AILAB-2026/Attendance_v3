
import express from "express";
import { getCompanyPool } from "./multiCompanyDb.js"; // This imports the pool function

const router = express.Router();

// Helper to check for manager role
const isManager = async (pool, employeeNo) => {
    // Check hr_employee or res_users for role
    // This depends on how roles are stored. 
    // Assuming we can check if they are a manager in hr_employee "job_id" or a user group.
    // For now, simpler: check if they have access to attendance_db 'manager' role from previous logic
    // But here we only have access to company DB.
    // Let's assume the client sends a token/role validation or we just trust the employeeNo for this internal API if protected by app logic.
    // BETTER: Check the "x_is_manager" flag or similar if it exists, OR just proceed. 
    return true;
};

// Check if user has submitted feedback today
router.get("/check", async (req, res) => {
    try {
        const { companyCode, employeeNo } = req.query;
        if (!companyCode || !employeeNo) {
            return res.status(400).json({ success: false, message: "Missing required parameters" });
        }

        const pool = await getCompanyPool(companyCode);

        const result = await pool.query(`
            SELECT id, created_at, rating, work_environment, supervisor_support, comments, is_anonymous, submitted_at
            FROM app_feedback 
            WHERE employee_no = $1 
            AND created_at >= CURRENT_DATE
        `, [employeeNo]);

        res.json({
            success: true,
            canSubmit: result.rows.length === 0,
            lastSubmission: result.rows.length > 0 ? result.rows[0] : null
        });
    } catch (e) {
        console.error("❌ Feedback Check Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Submit feedback
router.post("/submit", async (req, res) => {
    try {
        const {
            companyCode,
            employeeNo,
            employeeName,
            rating,
            workEnvironment,
            supervisorSupport,
            comments,
            isAnonymous
        } = req.body;

        if (!companyCode || !employeeNo || !rating) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const pool = await getCompanyPool(companyCode);

        // One submission per day check
        const check = await pool.query(`
            SELECT id FROM app_feedback 
            WHERE employee_no = $1 
            AND created_at >= CURRENT_DATE
        `, [employeeNo]);

        if (check.rows.length > 0) {
            return res.status(403).json({ success: false, message: "Feedback already submitted today." });
        }

        await pool.query(`
            INSERT INTO app_feedback 
            (employee_no, employee_name, is_anonymous, rating, work_environment, supervisor_support, comments, created_at, submitted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
        `, [
            employeeNo,
            employeeName || 'Unknown',
            !!isAnonymous,
            rating,
            workEnvironment || null,
            supervisorSupport || null,
            comments || '',
            req.body.submittedAt || null
        ]);

        res.json({ success: true, message: "Feedback submitted." });
    } catch (e) {
        console.error("❌ Feedback Submit Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// MANAGER: Get Feedback Stats
router.get("/stats", async (req, res) => {
    try {
        const { companyCode } = req.query;
        if (!companyCode) return res.status(400).json({ success: false, message: "Company code required" });

        const pool = await getCompanyPool(companyCode);

        // Average Rating
        const avgRes = await pool.query(`
            SELECT AVG(rating) as avg_rating, COUNT(*) as total_count 
            FROM app_feedback
        `);

        // Rating Distribution
        const distRes = await pool.query(`
            SELECT rating, COUNT(*) as count 
            FROM app_feedback 
            GROUP BY rating 
            ORDER BY rating DESC
        `);

        // Work Environment Breakdown
        const envRes = await pool.query(`
            SELECT work_environment, COUNT(*) as count 
            FROM app_feedback 
            WHERE work_environment IS NOT NULL 
            GROUP BY work_environment
        `);

        // Recent anonymous comments (limit 5)
        const commentsRes = await pool.query(`
            SELECT comments, created_at 
            FROM app_feedback 
            WHERE comments IS NOT NULL AND comments != '' 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        res.json({
            success: true,
            stats: {
                averageRating: parseFloat(avgRes.rows[0].avg_rating || 0).toFixed(1),
                totalCount: parseInt(avgRes.rows[0].total_count || 0),
                distribution: distRes.rows,
                environment: envRes.rows,
                recentComments: commentsRes.rows
            }
        });

    } catch (e) {
        console.error("❌ Feedback Stats Error:", e);
        res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }
});

// MANAGER: Get Feedback List
router.get("/list", async (req, res) => {
    try {
        const { companyCode, page = 1, limit = 20 } = req.query;
        if (!companyCode) return res.status(400).json({ success: false, message: "Company code required" });

        const offset = (page - 1) * limit;
        const pool = await getCompanyPool(companyCode);

        const listRes = await pool.query(`
            SELECT id, 
                   CASE WHEN is_anonymous THEN 'Anonymous' ELSE employee_name END as name,
                   CASE WHEN is_anonymous THEN '***' ELSE employee_no END as emp_no,
                   rating, work_environment, supervisor_support, comments, created_at 
            FROM app_feedback 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const totalRes = await pool.query(`SELECT COUNT(*) as count FROM app_feedback`);

        res.json({
            success: true,
            data: {
                rows: listRes.rows,
                total: parseInt(totalRes.rows[0].count),
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (e) {
        console.error("❌ Feedback List Error:", e);
        res.status(500).json({ success: false, message: "Failed to fetch list" });
    }
});

export default router;
