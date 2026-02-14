import express from "express";
import { getCompanyPool } from "./multiCompanyDb.js";

const router = express.Router();

router.get("/profile", async (req, res) => {
    try {
        const { companyCode, employeeNo } = req.query;

        console.log(`[UserRoutes] Fetching profile for: ${employeeNo} (${companyCode})`);

        if (!companyCode || !employeeNo) {
            return res.status(400).json({
                success: false,
                message: "Missing companyCode or employeeNo",
            });
        }

        const pool = await getCompanyPool(companyCode);

        const queryString = `
            SELECT 
                id,
                "x_Emp_No" AS "employeeNo",
                name,
                company_id AS "companyId",
                "profile_image_uri" AS "profileImageUri",
                'employee' as role
            FROM hr_employee
            WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))
            LIMIT 1
        `;

        const dbResponse = await pool.query(queryString, [employeeNo]);

        if (dbResponse.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        const user = dbResponse.rows[0];

        res.json({
            success: true,
            data: {
                employeeNo: user.employeeNo,
                companyCode: companyCode,
                name: user.name,
                role: user.role,
                profileImageUri: user.profileImageUri
            }
        });

    } catch (error) {
        console.error("❌ Profile fetch error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

export default router;
