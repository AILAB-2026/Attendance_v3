import express from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";
import { getCompanyPool } from "./multiCompanyDb.js";
import { promisify } from "util";

const router = express.Router();

// Promisified query function for async/await
const queryPromise = (queryText, params) => {
  return new Promise((resolve, reject) => {
    query(queryText, params, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
};

router.get("/types", (req, res) => {
  const userToken = getTokenFromHeader(req);
  const decoded = jwt.verify(userToken, SECRET_KEY);
  const queryString = `select * from usp_leave_type() `;
  query(queryString, (error, dbResponse) => {
    const leaveTypes = dbResponse.rows.map((item) => ({
      leaveId: item.id,
      leaveName: item.name,
    }));
    res.json(leaveTypes);
  });
});

router.get("/allocation", async (req, res) => {
  try {
    const userToken = getTokenFromHeader(req);
    let employeeId;
    if (userToken) {
      const decoded = jwt.verify(userToken, SECRET_KEY);
      employeeId = decoded.employeeId;
    } else {
      // Fallbacks for older clients
      const { employeeId: qEmpId, employeeNo, companyCode } = req.query || {};
      if (qEmpId) employeeId = parseInt(qEmpId, 10);
      else if (employeeNo && companyCode) {
        try {
          const emp = await queryPromise(
            `SELECT id FROM hr_employee WHERE LOWER("x_Emp_No") = LOWER($1) AND company_id = $2::integer AND active = true LIMIT 1`,
            [employeeNo, companyCode]
          );
          if (emp.rows.length > 0) employeeId = emp.rows[0].id;
        } catch (e) {
          console.error('Employee lookup error (/allocation):', e);
        }
      }
      if (!employeeId) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }
    }

    console.log("leave allocation employeeId " + employeeId);
    const queryString = `select * from get_mbl_leave_balance($1) `;
    const dbResponse = await queryPromise(queryString, [employeeId]);
    const leave = dbResponse.rows.map((item) => ({
      leaveType: item.leave_types,
      totalLeave: item.total_leave,
      leaveTaken: item.leave_taken,
      leavePending: item.leave_pending,
      leaveBalance: item.leave_balance,
    }));
    return res.json(leave);
  } catch (error) {
    console.error('Error in /leave/allocation:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch allocation' });
  }
});

// New endpoint: Real-time leave balance from hr_leave_allocation and hr_leave tables
router.get("/balance", async (req, res) => {
  try {
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(userToken, SECRET_KEY);
    } catch (err) {
      console.error("❌ Error verifying token in /leave/balance:", err?.message || err);
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    const employeeId = decoded.employeeId;
    const companyCode = decoded.companyCode;

    if (!companyCode) {
      return res.status(400).json({
        success: false,
        message: "Company code is required in token for leave balance",
      });
    }

    const pool = await getCompanyPool(companyCode);

    console.log("📊 Fetching leave balance for employee:", employeeId);

    // Query to get leave balance by leave type
    const balanceQuery = `
      WITH leave_allocations AS (
        -- Get all valid leave allocations for the employee
        SELECT 
          hla.id as allocation_id,
          hla.employee_id,
          hla.holiday_status_id,
          hla.name as leave_type_name,
          hla.number_of_days as allocated_days,
          hla.state,
          hla.date_from,
          hla.date_to
        FROM hr_leave_allocation hla
        WHERE hla.employee_id = $1
          AND hla.state = 'validate'
          AND CURRENT_DATE >= hla.date_from 
          AND (hla.date_to IS NULL OR CURRENT_DATE <= hla.date_to)
      ),
      leave_taken AS (
        -- Get approved leave days
        SELECT 
          hl.employee_id,
          hl.holiday_status_id,
          COALESCE(SUM(hl.number_of_days), 0) as taken_days
        FROM hr_leave hl
        WHERE hl.employee_id = $1
          AND hl.state IN ('validate', 'confirm')
        GROUP BY hl.employee_id, hl.holiday_status_id
      ),
      leave_pending AS (
        -- Get pending leave days
        SELECT 
          hl.employee_id,
          hl.holiday_status_id,
          COALESCE(SUM(hl.number_of_days), 0) as pending_days
        FROM hr_leave hl
        WHERE hl.employee_id = $1
          AND hl.state IN ('draft', 'confirm')
        GROUP BY hl.employee_id, hl.holiday_status_id
      )
      SELECT 
        la.leave_type_name,
        la.holiday_status_id,
        COALESCE(SUM(la.allocated_days), 0) as total_allocated,
        COALESCE(lt.taken_days, 0) as total_taken,
        COALESCE(lp.pending_days, 0) as total_pending,
        COALESCE(SUM(la.allocated_days), 0) - COALESCE(lt.taken_days, 0) as balance
      FROM leave_allocations la
      LEFT JOIN leave_taken lt ON la.employee_id = lt.employee_id 
        AND la.holiday_status_id = lt.holiday_status_id
      LEFT JOIN leave_pending lp ON la.employee_id = lp.employee_id 
        AND la.holiday_status_id = lp.holiday_status_id
      GROUP BY la.leave_type_name, la.holiday_status_id, lt.taken_days, lp.pending_days
      ORDER BY la.leave_type_name;
    `;

    let balanceResult;
    try {
      balanceResult = await pool.query(balanceQuery, [employeeId]);
    } catch (dbErr) {
      // If leave tables are missing in this company DB, return an empty-but-successful payload
      if (dbErr && dbErr.code === "42P01") {
        console.error(
          "❌ Leave tables not found in company DB (hr_leave_allocation/hr_leave):",
          dbErr.message
        );
        return res.json({
          success: true,
          data: {
            balance: { annual: 0, medical: 0, emergency: 0, unpaid: 0 },
            statistics: {
              totalRequests: 0,
              pendingRequests: 0,
              approvedDays: 0,
            },
            details: [],
          },
        });
      }
      throw dbErr;
    }

    // Map leave types to standard categories
    const leaveBalance = {
      annual: 0,
      medical: 0,
      emergency: 0,
      unpaid: 0
    };

    const leaveDetails = balanceResult.rows.map(row => {
      const leaveTypeName = String(row.leave_type_name || '');
      const leaveTypeLower = leaveTypeName.toLowerCase();

      // Categorize leave types
      if (leaveTypeLower.includes('annual')) {
        leaveBalance.annual += parseFloat(row.balance) || 0;
      } else if (leaveTypeLower.includes('medical')) {
        leaveBalance.medical += parseFloat(row.balance) || 0;
      } else if (leaveTypeLower.includes('emergency')) {
        leaveBalance.emergency += parseFloat(row.balance) || 0;
      } else if (leaveTypeLower.includes('unpaid') || leaveTypeLower.includes('un paid')) {
        leaveBalance.unpaid += parseFloat(row.balance) || 0;
      }

      return {
        leaveType: leaveTypeName,
        leaveTypeId: row.holiday_status_id,
        allocated: parseFloat(row.total_allocated) || 0,
        taken: parseFloat(row.total_taken) || 0,
        pending: parseFloat(row.total_pending) || 0,
        balance: parseFloat(row.balance) || 0
      };
    });

    // Get leave request statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN state IN ('draft', 'confirm') THEN 1 END) as pending_requests,
        COALESCE(SUM(CASE WHEN state IN ('validate', 'confirm') THEN number_of_days ELSE 0 END), 0) as approved_days
      FROM hr_leave
      WHERE employee_id = $1;
    `;
    let statsResult;
    try {
      statsResult = await pool.query(statsQuery, [employeeId]);
    } catch (dbErr) {
      if (dbErr && dbErr.code === "42P01") {
        console.error("❌ hr_leave table not found when fetching leave stats:", dbErr.message);
        statsResult = { rows: [{ total_requests: 0, pending_requests: 0, approved_days: 0 }] };
      } else {
        throw dbErr;
      }
    }
    const stats = statsResult.rows[0] || {
      total_requests: 0,
      pending_requests: 0,
      approved_days: 0,
    };

    console.log("✅ Leave balance fetched successfully");

    res.json({
      success: true,
      data: {
        balance: {
          annual: leaveBalance.annual,
          medical: leaveBalance.medical,
          emergency: leaveBalance.emergency,
          unpaid: leaveBalance.unpaid
        },
        statistics: {
          totalRequests: parseInt(stats.total_requests) || 0,
          pendingRequests: parseInt(stats.pending_requests) || 0,
          approvedDays: parseFloat(stats.approved_days) || 0
        },
        details: leaveDetails
      }
    });

  } catch (error) {
    console.error("❌ Error fetching leave balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch leave balance",
      error: error.message
    });
  }
});

router.get("/requests", async (req, res) => {
  console.log('🔄 FIXED CODE LOADED - Leave requests endpoint v3');
  let employeeId;
  let companyCode;
  let decoded;
  let pool;
  const userToken = getTokenFromHeader(req);

  try {
    if (userToken) {
      try {
        decoded = jwt.verify(userToken, SECRET_KEY);
        employeeId = decoded.employeeId;
        companyCode = decoded.companyCode;
      } catch (jwtErr) {
        console.error('JWT verification error (/leave/requests):', jwtErr.message);
        // Fall through to fallback logic
      }
    }

    // Fallback for older mobile clients: accept employeeNo/companyCode via query
    if (!employeeId || !companyCode) {
      const { employeeNo, companyCode: qCompanyCode, employeeId: qEmpId } = req.query || {};
      if (qEmpId) {
        employeeId = parseInt(qEmpId, 10);
      }
      if (qCompanyCode) {
        companyCode = qCompanyCode;
      }

      if (!employeeId && employeeNo && companyCode) {
        try {
          pool = await getCompanyPool(companyCode);
          const emp = await pool.query(
            `SELECT id FROM hr_employee WHERE LOWER("x_Emp_No") = LOWER($1) AND active = true LIMIT 1`,
            [employeeNo]
          );
          if (emp.rows.length > 0) employeeId = emp.rows[0].id;
        } catch (e) {
          console.error('Employee lookup error (requests fallback):', e);
        }
      }
    }

    if (!employeeId || !companyCode) {
      return res.status(401).json({ success: false, message: 'No token or employee/company info provided' });
    }

    if (!pool) {
      pool = await getCompanyPool(companyCode);
    }

    // Query hr_leave table with correct column names
    const queryString = `
      SELECT 
        hl.id,
        hl.request_date_from,
        hl.request_date_to,
        hl.date_from,
        hl.date_to,
        to_char(hl.request_date_from,'YYYY-MM-DD') AS req_from_date,
        to_char(hl.request_date_to,'YYYY-MM-DD') AS req_to_date,
        to_char((hl.date_from)::date,'YYYY-MM-DD') AS date_from_date,
        to_char((hl.date_to)::date,'YYYY-MM-DD') AS date_to_date,
        COALESCE(hlt.name->>'en_US', 'Leave') as leave_type,
        hl.state as leave_status,
        hl.holiday_status_id as leave_status_id,
        hl.number_of_days as days,
        hl.create_date as apply_date,
        hl.x_employee,
        he."x_Emp_No" AS emp_no_fallback,
        hl.private_name,
        hl.duration_display,
        (hl.x_attachment_data IS NOT NULL) as has_attachment,
        hl.x_attachment_name as attachment_name,
        hl.x_attachment_mime_type as attachment_mime_type
      FROM hr_leave hl
      LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
      LEFT JOIN hr_employee he ON he.id = hl.employee_id
      WHERE hl.employee_id = $1
      ORDER BY hl.create_date DESC NULLS LAST, hl.write_date DESC
    `;

    const dbResponse = await pool.query(queryString, [employeeId]);

    if (!dbResponse || !dbResponse.rows) {
      console.log('⚠️  No leave requests found');
      return res.json([]);
    }

    const leave = dbResponse.rows.map((item) => {
      // Map database states to mobile app status
      let mappedStatus = 'pending';
      switch (item.leave_status) {
        case 'validate':
          mappedStatus = 'approved';
          break;
        case 'confirm':
          mappedStatus = 'pending';
          break;
        case 'draft':
          mappedStatus = 'pending';
          break;
        case 'refuse':
        case 'cancel':
          mappedStatus = 'rejected';
          break;
        default:
          mappedStatus = item.leave_status || 'pending';
      }

      return {
        id: item.id,
        leaveRequestFrom: item.date_from_date || item.req_from_date,
        leaveRequestTo: item.date_to_date || item.req_to_date,
        leaveType: item.leave_type || 'Leave',
        leaveStatus: mappedStatus,
        leaveStatusId: item.leave_status_id,
        days: item.days || 1,
        applyDate: item.apply_date,
        empNo: item.x_employee || item.emp_no_fallback,
        description: item.private_name,
        duration: item.duration_display,
        hasAttachment: !!item.has_attachment,
        attachmentName: item.attachment_name || null,
        attachmentMimeType: item.attachment_mime_type || null
      };
    });

    console.log(`✅ Found ${leave.length} leave requests for employee ${employeeId}`);
    console.log('📋 Leave requests:', leave.map(l => `ID:${l.id} Status:${l.leaveStatus} Type:${l.leaveType} Days:${l.days}`));
    res.json(leave);
  } catch (error) {
    console.error('❌ Error in /leave/requests:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests', error: error.message });
  }
});

// Legacy endpoint for mobile app compatibility - redirects to /requests
router.get("/", async (req, res) => {
  console.log('🔄 Legacy /leave endpoint called - redirecting to /requests logic');
  let employeeId;
  let companyCode;
  let decoded;
  let pool;
  const userToken = getTokenFromHeader(req);

  try {
    if (userToken) {
      try {
        decoded = jwt.verify(userToken, SECRET_KEY);
        employeeId = decoded.employeeId;
        companyCode = decoded.companyCode;

        if (companyCode) {
          pool = await getCompanyPool(companyCode);
        }
      } catch (jwtErr) {
        console.error('JWT verification error:', jwtErr.message);
        // Fall through to fallback logic
      }
    }

    // Fallback for older APKs using query params
    if (!employeeId) {
      const { employeeNo, companyCode: qCompanyCode, employeeId: qEmpId } = req.query || {};
      if (qEmpId) {
        employeeId = parseInt(qEmpId, 10);
      } else if (employeeNo && qCompanyCode) {
        companyCode = qCompanyCode;
        try {
          pool = await getCompanyPool(companyCode);
          const emp = await pool.query(
            `SELECT id FROM hr_employee WHERE LOWER("x_Emp_No") = LOWER($1) AND active = true LIMIT 1`,
            [employeeNo]
          );
          if (emp.rows.length > 0) employeeId = emp.rows[0].id;
        } catch (e) {
          console.error('Employee lookup error (legacy fallback):', e);
        }
      }
      if (!employeeId) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }
    }

    if (!pool) {
      return res.status(400).json({
        success: false,
        message: 'Company code is required for leave requests',
      });
    }

    // Use same query as /requests endpoint
    const queryString = `
    SELECT 
      hl.id,
      hl.request_date_from,
      hl.request_date_to,
      hl.date_from,
      hl.date_to,
      to_char(hl.request_date_from,'YYYY-MM-DD') AS req_from_date,
      to_char(hl.request_date_to,'YYYY-MM-DD') AS req_to_date,
      to_char((hl.date_from)::date,'YYYY-MM-DD') AS date_from_date,
      to_char((hl.date_to)::date,'YYYY-MM-DD') AS date_to_date,
      COALESCE(hlt.name->>'en_US', 'Leave') as leave_type,
      hl.state as leave_status,
      hl.holiday_status_id as leave_status_id,
      hl.number_of_days as days,
      hl.create_date as apply_date,
      hl.x_employee,
      he."x_Emp_No" AS emp_no_fallback,
      hl.private_name,
      hl.duration_display
    FROM hr_leave hl
    LEFT JOIN hr_leave_type hlt ON hl.holiday_status_id = hlt.id
    LEFT JOIN hr_employee he ON he.id = hl.employee_id
    WHERE hl.employee_id = $1
    ORDER BY hl.create_date DESC NULLS LAST, hl.write_date DESC
  `;

    pool.query(queryString, [employeeId], (error, dbResponse) => {
      if (error) {
        console.error('❌ Error fetching leave (legacy endpoint):', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch leave requests', error: error.message });
      }
      if (!dbResponse || !dbResponse.rows) {
        console.log('⚠️  No leave requests found (legacy endpoint)');
        return res.json({ data: [] });
      }

      const leave = dbResponse.rows.map((item) => {
        // Map database states to mobile app status
        let mappedStatus = 'pending';
        switch (item.leave_status) {
          case 'validate':
            mappedStatus = 'approved';
            break;
          case 'confirm':
            mappedStatus = 'pending';
            break;
          case 'draft':
            mappedStatus = 'pending';
            break;
          case 'refuse':
          case 'cancel':
            mappedStatus = 'rejected';
            break;
          default:
            mappedStatus = item.leave_status || 'pending';
        }

        return {
          id: item.id,
          leaveRequestFrom: item.date_from_date || item.req_from_date,
          leaveRequestTo: item.date_to_date || item.req_to_date,
          leaveType: item.leave_type || 'Leave',
          leaveStatus: mappedStatus,
          leaveStatusId: item.leave_status_id,
          days: item.days || 1,
          applyDate: item.apply_date,
          empNo: item.x_employee || item.emp_no_fallback,
          description: item.private_name,
          duration: item.duration_display
        };
      });

      console.log(`✅ Found ${leave.length} leave requests for employee ${employeeId} (legacy endpoint)`);
      console.log('📋 Leave requests:', leave.map(l => `ID:${l.id} Status:${l.leaveStatus} Type:${l.leaveType} Days:${l.days}`));

      // Return in format expected by mobile app
      res.json({ data: leave });
    });
  } catch (error) {
    console.error('❌ Error in legacy /leave endpoint:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leave requests', error: error.message });
  }
});

router.post("/newRequest", async (req, res) => {
  try {
    const { startDate, endDate, selectedLeaveType, halfDay } = req.body;
    let employeeId;
    const userToken = getTokenFromHeader(req);
    if (userToken) {
      const decoded = jwt.verify(userToken, SECRET_KEY);
      employeeId = decoded.employeeId;
    } else {
      // Fallbacks: body or query params
      const { employeeId: bodyEmpId, employeeNo, companyCode } = req.body || {};
      const { employeeId: qEmpId } = req.query || {};
      if (bodyEmpId) employeeId = parseInt(bodyEmpId, 10);
      else if (qEmpId) employeeId = parseInt(qEmpId, 10);
      else if (employeeNo && companyCode) {
        const emp = await queryPromise(
          `SELECT id FROM hr_employee WHERE LOWER("x_Emp_No") = LOWER($1) AND company_id = $2::integer AND active = true LIMIT 1`,
          [employeeNo, companyCode]
        );
        if (emp.rows.length > 0) employeeId = emp.rows[0].id;
      }
      if (!employeeId) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }
    }

    const queryString = `select * from udf_tbl_trans_mobile_leave_insert($1,$2,$3,$4,$5) `;
    const dbResponse = await queryPromise(queryString, [startDate, endDate, selectedLeaveType, employeeId, halfDay]);
    const resultRow = dbResponse.rows && dbResponse.rows[0] ? dbResponse.rows[0] : {};
    console.log("newRequest outputResult " + JSON.stringify(resultRow));
    return res.json({ returnMessage: resultRow.message, statusCode: resultRow.status_code });
  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// New endpoint with validation against allocated leave days
router.post("/apply", async (req, res) => {
  console.log('🔄 [LEAVE-APPLY-v2.1] Weekend exclusion logic active');
  try {
    const { startDate, endDate, leaveTypeId, type, reason, halfDay, duration, halfDayPeriod, attachmentUri, attachmentData, attachmentMimeType, attachmentName } = req.body || {};
    const userToken = getTokenFromHeader(req);
    let employeeId;
    let companyCode = (req.body && req.body.companyCode) || null;
    let decoded;
    let pool;

    if (userToken) {
      try {
        decoded = jwt.verify(userToken, SECRET_KEY);
        if (decoded && decoded.employeeId) {
          employeeId = decoded.employeeId;
        }
        if (decoded && decoded.companyCode) {
          companyCode = decoded.companyCode || companyCode;
        }
      } catch (jwtErr) {
        console.error("JWT verification error (/leave/apply):", jwtErr.message);
        // Fall back to body/query parameters
      }
    }

    if (!companyCode) {
      const { companyCode: qCompanyCode } = req.query || {};
      if (qCompanyCode) {
        companyCode = String(qCompanyCode);
      }
    }

    if (!companyCode) {
      return res.status(400).json({
        success: false,
        message: "Company code is required for leave application",
      });
    }

    pool = await getCompanyPool(companyCode);

    if (!employeeId) {
      const { employeeId: bodyEmpId, employeeNo: bodyEmpNo } = req.body || {};
      const { employeeId: qEmpId, employeeNo: qEmpNo } = req.query || {};
      const employeeNo = bodyEmpNo || qEmpNo;

      if (bodyEmpId) {
        employeeId = parseInt(bodyEmpId, 10);
      } else if (qEmpId) {
        employeeId = parseInt(qEmpId, 10);
      } else if (employeeNo) {
        const emp = await pool.query(
          `SELECT id FROM hr_employee WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true LIMIT 1`,
          [employeeNo]
        );
        if (emp.rows.length > 0) {
          employeeId = emp.rows[0].id;
        }
      }
    }

    if (!employeeId) {
      return res.status(401).json({
        success: false,
        message: "Unable to resolve employee from token or request",
      });
    }

    console.log('📝 Leave application request:', { employeeId, companyCode, leaveTypeId, type, startDate, endDate, halfDay, duration });

    // Map leave type name to ID if type is provided instead of leaveTypeId
    let finalLeaveTypeId = leaveTypeId;
    if (!finalLeaveTypeId && type) {
      // Map type name to leave type in database
      const typeMapping = {
        'annual': 'Annual Leave',
        'medical': 'Medical Leave',
        'compensatory': 'Compensatory',
        'hospitalised': 'Hospitalisation',
        'childcare': 'Child Care',
        'unpaid': 'Unpaid Leave',
        'others': 'Other',
        'other': 'Other'
      };

      const typeName = typeMapping[type.toLowerCase()] || type;
      // hr_leave_type.name is JSONB; compare using the English text value
      // map type name to leave type in database, prioritizing types with allocations
      const typeResult = await pool.query(
        `SELECT t.id 
         FROM hr_leave_type t
         LEFT JOIN hr_leave_allocation a ON t.id = a.holiday_status_id 
             AND a.employee_id = $3 
             AND a.state = 'validate'
         WHERE LOWER(COALESCE(t.name->>'en_US','')) LIKE LOWER($1) 
            OR LOWER(COALESCE(t.name->>'en_US','')) = LOWER($2)
         ORDER BY (a.id IS NOT NULL) DESC, t.id ASC
         LIMIT 1`,
        [`%${type}%`, typeName, employeeId]
      );

      if (typeResult.rows.length > 0) {
        finalLeaveTypeId = typeResult.rows[0].id;
      } else {
        return res.status(400).json({
          success: false,
          message: `Leave type "${type}" not found in system`
        });
      }
    }

    if (!finalLeaveTypeId) {
      return res.status(400).json({
        success: false,
        message: "Leave type is required"
      });
    }

    // Calculate number of days requested
    // Calculate number of days requested (excluding weekends and public holidays based on config)
    const isHalfDay = halfDay || duration === 'half';
    let requestedDays = 0;

    // Fetch employee working configuration and company ID
    const empConfigRes = await pool.query(
      `SELECT "x_working_days", company_id FROM hr_employee WHERE id = $1`,
      [employeeId]
    );
    // Default to 6-day week if not set
    let workingDaysConfig = 6;
    let empCompanyId = null;

    if (empConfigRes.rows.length > 0) {
      const row = empConfigRes.rows[0];
      console.log(`🔍 [DEBUG] Raw x_working_days from DB: ${JSON.stringify(row.x_working_days)} (type: ${typeof row.x_working_days})`);
      if (row.x_working_days != null) workingDaysConfig = parseFloat(row.x_working_days);
      empCompanyId = row.company_id;
    }

    console.log(`📊 Config: Working Days=${workingDaysConfig}, CompanyId=${empCompanyId}, Employee=${employeeId}`);

    if (isHalfDay) {
      requestedDays = 0.5;
    } else {
      // 1. Fetch exact public holidays in the range using optimized range intersection
      const holidaysQuery = `
        WITH rng AS (
          SELECT $1::date AS start_date, $2::date AS end_date
        )
        SELECT DISTINCT to_char(d::date, 'YYYY-MM-DD') AS date
        FROM resource_calendar_leaves r, rng
        CROSS JOIN LATERAL generate_series(
          GREATEST((r.date_from)::date, rng.start_date),
          LEAST(COALESCE((r.date_to)::date, (r.date_from)::date), rng.end_date),
          interval '1 day'
        ) AS d
        WHERE NOT (COALESCE((r.date_to)::date, (r.date_from)::date) < rng.start_date OR (r.date_from)::date > rng.end_date)
          AND (r.company_id = $3::integer OR r.company_id IS NULL)
          AND r.resource_id IS NULL
          AND r.x_is_public_holiday = TRUE
      `;

      let holidaySet = new Set();
      try {
        const hRes = await pool.query(holidaysQuery, [startDate, endDate, empCompanyId]);
        hRes.rows.forEach(r => holidaySet.add(r.date));
      } catch (e) {
        console.error("⚠️ Error fetching holidays for calc:", e.message);
      }

      console.log('📅 Holidays in range:', Array.from(holidaySet));

      // 2. Iterate through range and apply weights
      // Parse dates explicitly to avoid timezone issues
      const [startY, startM, startD] = startDate.split('-').map(Number);
      const [endY, endM, endD] = endDate.split('-').map(Number);
      const current = new Date(startY, startM - 1, startD); // Local time
      const last = new Date(endY, endM - 1, endD); // Local time

      console.log(`📅 Date range: ${startDate} to ${endDate}`)
      console.log(`📅 Working days config: ${workingDaysConfig}`);

      // Helper function to format date as YYYY-MM-DD without timezone conversion
      const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      while (current <= last) {
        const dateStr = formatDate(current); // Use local date formatting
        const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat (using local day)

        let weight = 1;

        if (holidaySet.has(dateStr)) {
          weight = 0;
          console.log(`  ${dateStr} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}): Holiday - weight 0`);
        } else if (dayOfWeek === 0) { // Sunday
          // Off if working days is 5, 5.5, 6. On if 7.
          weight = (workingDaysConfig >= 7) ? 1 : 0;
          console.log(`  ${dateStr} (Sun): Weekend - weight ${weight}`);
        } else if (dayOfWeek === 6) { // Saturday
          if (workingDaysConfig <= 5) weight = 0;
          else if (workingDaysConfig === 5.5) weight = 0.5;
          else weight = 1; // 6 or 7
          console.log(`  ${dateStr} (Sat): Weekend - weight ${weight}`);
        } else {
          console.log(`  ${dateStr} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]}): Working day - weight 1`);
        }

        requestedDays += weight;
        current.setDate(current.getDate() + 1);
      }
    }

    // Safety check
    requestedDays = Math.max(0, requestedDays);

    console.log(`📊 Calculated working days: ${requestedDays}`);
    console.log(`✅ FINAL CALCULATION RESULT: ${requestedDays} days will be saved to database`);

    // Get leave type name
    const leaveTypeResult = await pool.query(
      `SELECT (name->>'en_US') AS name FROM hr_leave_type WHERE id = $1`,
      [finalLeaveTypeId]
    );

    if (leaveTypeResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave type selected"
      });
    }

    const leaveTypeName = leaveTypeResult.rows[0].name;

    // Check leave allocation for this employee and leave type
    const allocationResult = await pool.query(
      `SELECT 
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
       LIMIT 1`,
      [employeeId, finalLeaveTypeId, startDate]
    );

    if (allocationResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: `You don't have any ${leaveTypeName} leave allocation for the selected period. Please contact HR.`
      });
    }

    const allocation = allocationResult.rows[0];
    const allocatedDays = parseFloat(allocation.allocated_days);

    console.log(`📊 Allocated days: ${allocatedDays}`);

    // Calculate already used/pending leave days for this leave type
    const usedLeaveResult = await pool.query(
      `SELECT 
        COALESCE(SUM(hl.number_of_days), 0) as used_days
       FROM hr_leave hl
       WHERE hl.employee_id = $1 
         AND hl.holiday_status_id = $2
         AND hl.state IN ('validate', 'confirm')
         AND hl.date_from >= $3
         AND ($4::timestamp IS NULL OR hl.date_to <= $4)`,
      [employeeId, finalLeaveTypeId, allocation.date_from, allocation.date_to]
    );

    const usedDays = parseFloat(usedLeaveResult.rows[0].used_days);
    const remainingDays = allocatedDays - usedDays;

    console.log(`📊 Used days: ${usedDays}`);
    console.log(`📊 Remaining days: ${remainingDays}`);

    // Validate if employee has enough remaining days
    if (requestedDays > remainingDays) {
      return res.status(400).json({
        success: false,
        message: `Your selected ${requestedDays} day(s) exceeds your available ${leaveTypeName} leave balance of ${remainingDays} day(s). You have ${allocatedDays} day(s) allocated, with ${usedDays} day(s) already used or pending.`,
        data: {
          requestedDays: requestedDays,
          allocatedDays: allocatedDays,
          usedDays: usedDays,
          remainingDays: remainingDays
        }
      });
    }

    // Fetch employee info for company_id and employee number
    const empInfoResult = await pool.query(
      `SELECT "x_Emp_No" AS emp_no, company_id FROM hr_employee WHERE id = $1 LIMIT 1`,
      [employeeId]
    );
    if (empInfoResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Employee not found for leave application' });
    }
    const empInfo = empInfoResult.rows[0];
    const companyId = empInfo.company_id || 1; // Fallback to company 1 if missing

    // Determine duration display as numeric days string (e.g., '0.5 days', '1 days', '2 days')
    const durationDisplay = `${requestedDays} days`;
    const halfDayType = halfDayPeriod || null; // e.g., 'am' or 'pm'

    // Process attachment if provided
    let attachmentBuffer = null;
    let finalAttachmentMimeType = attachmentMimeType || null;
    let finalAttachmentName = attachmentName || null;

    if (attachmentData) {
      try {
        // attachmentData should be base64 encoded
        // Check if it has a data URL prefix (e.g., "data:image/png;base64,...")
        let base64Data = attachmentData;
        if (attachmentData.includes(',')) {
          const parts = attachmentData.split(',');
          base64Data = parts[1];
          // Extract mime type from data URL if not provided
          if (!finalAttachmentMimeType && parts[0]) {
            const mimeMatch = parts[0].match(/data:([^;]+)/);
            if (mimeMatch) {
              finalAttachmentMimeType = mimeMatch[1];
            }
          }
        }
        attachmentBuffer = Buffer.from(base64Data, 'base64');
        console.log(`📎 Attachment received: ${attachmentBuffer.length} bytes, type: ${finalAttachmentMimeType}`);
      } catch (attachErr) {
        console.warn('⚠️ Failed to process attachment:', attachErr.message);
        // Continue without attachment
      }
    } else if (attachmentUri) {
      // If only URI is provided (for reference), we can't store the actual data
      // Just log it - in the future, could fetch the file from the URI
      console.log(`📎 Attachment URI provided (not stored): ${attachmentUri}`);
      finalAttachmentName = attachmentUri.split('/').pop() || 'attachment';
    }

    // Insert leave request with fields expected by ERP (including attachment columns)
    const insertResult = await pool.query(
      `INSERT INTO hr_leave 
       (employee_id, employee_company_id, company_id, holiday_status_id, holiday_type,
        date_from, date_to, number_of_days,
        private_name, duration_display,
        request_date_from, request_date_to, request_unit_half, half_day_type, enable_half_day,
        x_employee, state, create_date, write_date,
        x_attachment_data, x_attachment_mime_type, x_attachment_name)
       VALUES (
        $1, $2, $3, $4, 'employee',
        ($5::date + time '12:00:00')::timestamp, ($6::date + time '12:00:00')::timestamp, $7,
        $8, $9,
        $5::date, $6::date, $10, $11, $12,
        $13, 'confirm', NOW(), NOW(),
        $14, $15, $16
       )
       RETURNING id`,
      [
        employeeId,
        companyId,
        companyId,
        finalLeaveTypeId,
        startDate,
        endDate,
        requestedDays,
        reason || `${leaveTypeName} Leave`,
        durationDisplay,
        !!isHalfDay,
        halfDayType,
        !!isHalfDay,
        empInfo.emp_no,
        attachmentBuffer,
        finalAttachmentMimeType,
        finalAttachmentName
      ]
    );

    console.log('✅ Leave application successful:', insertResult.rows[0]);

    const responseData = {
      success: true,
      message: `Leave application submitted successfully! You have applied for ${requestedDays} day(s) of ${leaveTypeName} leave. Remaining balance: ${remainingDays - requestedDays} day(s).`,
      data: {
        leaveId: insertResult.rows[0].id,
        requestedDays: requestedDays,
        remainingDays: remainingDays - requestedDays,
        leaveType: leaveTypeName
      }
    };

    console.log('📤 SENDING RESPONSE TO CLIENT:', JSON.stringify(responseData, null, 2));
    res.json(responseData);

  } catch (error) {
    if (error && error.code === "42P01") {
      console.error("❌ Leave tables not found in company DB (/leave/apply):", error.message);
      return res.status(503).json({
        success: false,
        message: "Leave module is not configured for this company. Please contact your administrator.",
      });
    }
    console.error("❌ Leave application error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit leave application. Please try again.",
      error: error.message
    });
  }
});

// Get leave attachment by leave ID
router.get("/attachment/:leaveId", async (req, res) => {
  try {
    const { leaveId } = req.params;
    const companyCode = req.query.companyCode || req.headers['x-company-code'];

    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'Company code is required' });
    }

    const pool = await getCompanyPool(companyCode);

    const result = await pool.query(
      `SELECT x_attachment_data, x_attachment_mime_type, x_attachment_name 
       FROM hr_leave 
       WHERE id = $1`,
      [leaveId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    const row = result.rows[0];

    if (!row.x_attachment_data) {
      return res.status(404).json({ success: false, message: 'No attachment found for this leave request' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', row.x_attachment_mime_type || 'application/octet-stream');
    if (row.x_attachment_name) {
      res.setHeader('Content-Disposition', `inline; filename="${row.x_attachment_name}"`);
    }

    // Send the binary data
    res.send(row.x_attachment_data);

  } catch (error) {
    console.error('❌ Error fetching leave attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attachment',
      error: error.message
    });
  }
});

export default router;