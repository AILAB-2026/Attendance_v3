import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { query } from "./dbconn.js";
import { getCompanyPool, masterPool } from "./multiCompanyDb.js";
const router = express.Router();

// Promisified query function
const queryPromise = (queryText, params) => {
  return new Promise((resolve, reject) => {
    query(queryText, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

// Get user profile by company code and employee number
router.get("/profile", async (req, res) => {
  const companyCode = String((req.query.companyCode ?? '')).trim();
  const employeeNo = String((req.query.employeeNo ?? '')).trim();

  if (!companyCode || !employeeNo) {
    return res.status(400).json({
      success: false,
      message: "Company code and employee number are required"
    });
  }

  try {
    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    // Get employee basic info from company database
    const queryString = `
      SELECT 
        id,
        "x_Emp_No" as "employeeNo",
        name,
        work_email as email,
        company_id as "companyId",
        "x_working_days" as "workingDays",
        "profile_image_uri" as "profileImageUri",
        COALESCE(enable_hours, true) as "enableHours",
        'employee' as role
      FROM hr_employee 
      WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))
    `;

    const empResult = await pool.query(queryString, [employeeNo]);

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.id;

    // Get leave balance
    const balanceQuery = `
      WITH leave_allocations AS (
        SELECT 
          hla.employee_id,
          hla.holiday_status_id,
          hla.name as leave_type_name,
          hla.number_of_days as allocated_days
        FROM hr_leave_allocation hla
        WHERE hla.employee_id = $1
          AND hla.state = 'validate'
          AND CURRENT_DATE >= hla.date_from 
          AND (hla.date_to IS NULL OR CURRENT_DATE <= hla.date_to)
      ),
      leave_taken AS (
        SELECT 
          hl.employee_id,
          hl.holiday_status_id,
          COALESCE(SUM(hl.number_of_days), 0) as taken_days
        FROM hr_leave hl
        WHERE hl.employee_id = $1
          AND hl.state IN ('validate', 'confirm')
        GROUP BY hl.employee_id, hl.holiday_status_id
      )
      SELECT 
        la.leave_type_name,
        COALESCE(SUM(la.allocated_days), 0) - COALESCE(lt.taken_days, 0) as balance
      FROM leave_allocations la
      LEFT JOIN leave_taken lt ON la.employee_id = lt.employee_id 
        AND la.holiday_status_id = lt.holiday_status_id
      GROUP BY la.leave_type_name, lt.taken_days;
    `;

    // Fetch public holidays for the next 12 months for the calendar
    // Filter by company_id (specific or global/null) and x_is_public_holiday = true
    const holidaysQuery = `
      SELECT DISTINCT to_char(d, 'YYYY-MM-DD') as date_str
      FROM resource_calendar_leaves
      CROSS JOIN generate_series(date_from, date_to - interval '1 second', '1 day') as d
      WHERE (company_id = $1::integer OR company_id IS NULL)
        AND resource_id IS NULL
        AND x_is_public_holiday = TRUE
        AND date_from >= CURRENT_DATE - INTERVAL '1 year'
        AND date_from <= CURRENT_DATE + INTERVAL '1 year'
      ORDER BY 1
    `;

    let holidayDates = [];
    try {
      const hRes = await pool.query(holidaysQuery, [employee.companyId]);
      holidayDates = hRes.rows.map(r => r.date_str);
    } catch (e) {
      console.warn('Could not fetch holidays:', e.message);
    }

    const balanceResult = await pool.query(balanceQuery, [employeeId]);

    // Map leave types to standard categories
    const leaveBalance = {
      annual: 0,
      medical: 0,
      compensatory: 0,
      hospitalised: 0,
      childcare: 0,
      unpaid: 0,
      others: 0
    };

    balanceResult.rows.forEach(row => {
      const leaveTypeName = String(row.leave_type_name || '').toLowerCase();
      const balance = parseFloat(row.balance) || 0;

      if (leaveTypeName.includes('annual')) {
        leaveBalance.annual += balance;
      } else if (leaveTypeName.includes('medical') || leaveTypeName.includes('sick')) {
        leaveBalance.medical += balance;
      } else if (leaveTypeName.includes('compensatory') || leaveTypeName.includes('replacement')) {
        leaveBalance.compensatory += balance;
      } else if (leaveTypeName.includes('hospital')) {
        leaveBalance.hospitalised += balance;
      } else if (leaveTypeName.includes('child')) {
        leaveBalance.childcare += balance;
      } else if (leaveTypeName.includes('unpaid') || leaveTypeName.includes('un paid')) {
        leaveBalance.unpaid += balance;
      } else {
        // All other types go to 'others'
        leaveBalance.others += balance;
      }
    });

    // Get payroll_enable and other module flags from companies table
    let payrollEnable = true;
    let modules = {
      attendance: true,
      history: true,
      leave: true,
      schedule: true,
      payroll: true,
      feedback: true
    };

    try {
      const companyResult = await masterPool.query(
        `SELECT 
          payroll_enable,
          show_attendance,
          show_history,
          show_leave,
          show_schedule,
          show_payroll,
          show_payroll,
          show_feedback,
          show_survey
         FROM companies WHERE UPPER(TRIM(company_code)) = UPPER(TRIM($1))`,
        [companyCode]
      );
      if (companyResult.rows.length > 0) {
        const row = companyResult.rows[0];
        payrollEnable = row.payroll_enable;
        modules = {
          attendance: row.show_attendance ?? true,
          history: row.show_history ?? true,
          leave: row.show_leave ?? true,
          schedule: row.show_schedule ?? true,
          payroll: row.show_payroll ?? true,
          payroll: row.show_payroll ?? true,
          feedback: row.show_feedback ?? true,
          survey: row.show_survey ?? true
        };
      }
    } catch (err) {
      console.warn('Warning: Could not fetch company module settings:', err.message);
      // Continue with default values
    }

    console.log('✅ User profile with leave balance and payroll_enable:', {
      employeeNo,
      name: employee.name,
      leaveBalance,
      payrollEnable,
      holidaysCount: holidayDates.length
    });

    // Return in the format the mobile app expects
    res.json({
      success: true,
      data: {
        ...employee,
        leaveBalance,
        payrollEnable,
        modules,
        enableHours: employee.enableHours !== false, // Default to true if not set
        config: {
          workingDays: parseFloat(employee.workingDays) || 6, // Default to 6 if missing
          holidays: holidayDates
        }
      }
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user profile"
    });
  }
});

// Get user by email (legacy endpoint)
router.get("/:email", (req, res) => {
  const userEmail = req.params.email;
  // Use hr_employee table from CX18AILABDEMO database instead of attendance_users
  const queryString = `
    SELECT 
      id,
      "x_Emp_No" as "employeeNo",
      name,
      work_email as email,
      company_id as "companyId"
    FROM hr_employee 
    WHERE work_email = $1 AND active = true
  `;
  query(queryString, [userEmail], (error, dbResponse) => {
    if (error) {
      console.log("Error fetching user by email:", error);
      return res.status(500).json({ message: "Error fetching user" });
    }
    if (dbResponse.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(dbResponse.rows[0]);
  });
});
// Configure Multer for profile images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), 'uploads', 'profiles');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `profile-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Update profile image
router.post("/profile-image", upload.single('profileImage'), async (req, res) => {
  const companyCode = String((req.body.companyCode ?? '')).trim();
  const employeeNo = String((req.body.employeeNo ?? '')).trim();

  if (!companyCode || !employeeNo) {
    return res.status(400).json({ success: false, message: "Missing companyCode or employeeNo" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image file provided" });
  }

  try {
    const pool = await getCompanyPool(companyCode);
    const relativePath = `/uploads/profiles/${req.file.filename}`;

    const updateQuery = `
       UPDATE hr_employee 
       SET "profile_image_uri" = $1
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($2))
     `;

    await pool.query(updateQuery, [relativePath, employeeNo]);

    res.json({
      success: true,
      data: {
        profileImageUri: relativePath
      },
      message: "Profile image updated successfully"
    });

  } catch (error) {
    console.error("Profile upload error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
