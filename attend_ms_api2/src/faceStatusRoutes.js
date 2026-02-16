import express from "express";
import { query } from "./dbconn.js";
import { getCompanyPool } from "./multiCompanyDb.js";
const router = express.Router();

// Check if employee has enrolled face
router.get("/status", async (req, res) => {
  try {
    const { companyCode, employeeNo } = req.query;

    if (!companyCode || !employeeNo) {
      return res.status(400).json({
        success: false,
        message: "Company code and employee number are required"
      });
    }

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    const queryString = `
      SELECT 
        id,
        "x_Emp_No" as "employeeNo",
        name,
        l_face_descriptor,
        CASE 
          WHEN l_face_descriptor IS NOT NULL THEN true
          ELSE false
        END as "isEnrolled"
      FROM hr_employee 
      WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))
        AND active = true
    `;

    const result = await pool.query(queryString, [employeeNo]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employee = result.rows[0];

    res.json({
      success: true,
      data: {
        employeeNo: employee.employeeNo,
        name: employee.name,
        registered: employee.isEnrolled,
        message: employee.isEnrolled
          ? "Face already enrolled. You can clock in/out."
          : "Face not enrolled. Please register your face first."
      }
    });

  } catch (error) {
    console.error("Error checking face status:", error);
    res.status(500).json({
      success: false,
      message: "Error checking face status",
      error: error.message
    });
  }
});

export default router;
