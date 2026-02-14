import express from "express";
import multer from "multer";
import { createCanvas, loadImage } from "canvas";
import { query } from "./dbconn.js";
import { getCompanyPool } from "./multiCompanyDb.js";
import { logActivity } from "./utils/auditLogger.js";
const router = express.Router();

// Memory storage for image processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Backend-only hide rules for specific employees and dates (YYYY-MM-DD)
// This allows us to hide legacy/invalid rows from API responses without changing the mobile app build.
const HIDE_RULES = {
  'B1-W422': new Set(['2025-11-07', '2025-11-10', '2025-11-11', '2025-11-12'])
};

function shouldHideForEmployeeDate(employeeNo, dateKey) {
  const set = HIDE_RULES[employeeNo];
  return !!(set && set.has(dateKey));
}

// Clock In
router.post("/clock-in", upload.single('image'), async (req, res) => {
  try {
    let { companyCode, employeeNo, timestamp, latitude, longitude, address, method, siteName, projectName, imageUri } = req.body;

    // Handle multipart/lighter format upload
    if (req.file) {
      try {
        console.log('📸 Processing uploaded image file...');
        const img = await loadImage(req.file.buffer);
        // Resize image to max 500px to reduce DB size (user request)
        const maxDim = 500;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = w / h;
          if (w > h) { w = maxDim; h = maxDim / ratio; }
          else { h = maxDim; w = maxDim * ratio; }
        }
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        // Convert to optimized base64
        imageUri = canvas.toDataURL('image/jpeg', 0.6);
        console.log('✅ Image processed and resized');
      } catch (e) {
        console.error('❌ Image processing error:', e);
        imageUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    }
    const latExact = (latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null);
    const lngExact = (longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null);

    console.log('⏰ Clock In request:', {
      companyCode,
      employeeNo,
      method,
      siteName: siteName || 'NOT PROVIDED',
      projectName: projectName || 'NOT PROVIDED',
      latitude,
      longitude,
      imageUri: imageUri ? 'provided' : 'none'
    });
    console.log('🔍 DETAILED REQUEST BODY:', {
      siteName: `"${siteName}" (type: ${typeof siteName}, length: ${siteName?.length || 0})`,
      projectName: `"${projectName}" (type: ${typeof projectName}, length: ${projectName?.length || 0})`
    });

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    // Get employee ID (and company_id for header record)
    const empResult = await pool.query(
      `SELECT id, "x_Emp_No" as employee_no, name, company_id 
       FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true`,
      [employeeNo]
    );

    if (empResult.rows.length === 0) {
      // Check if employee exists but is inactive
      const inactiveCheck = await pool.query(
        `SELECT id, active FROM hr_employee 
         WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))`,
        [employeeNo]
      );

      if (inactiveCheck.rows.length > 0 && !inactiveCheck.rows[0].active) {
        return res.status(403).json({
          success: false,
          message: "🔒 Your account is inactive. Please contact HR to reactivate your access."
        });
      }

      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.id;
    const companyId = employee.company_id ?? null;

    // Get project ID by name (name is JSONB in database)
    let projectId = null;
    if (projectName) {
      console.log('🔍 Looking up project:', projectName);
      try {
        const projectResult = await pool.query(
          `SELECT id FROM project_project WHERE name->>'en_US' = $1 LIMIT 1`,
          [projectName]
        );
        if (projectResult.rows.length > 0) {
          projectId = projectResult.rows[0].id;
          console.log('✅ Found project ID:', projectId);
        } else {
          console.log('⚠️ Project not found, will use NULL');
        }
      } catch (err) {
        console.error('❌ Project lookup error:', err.message);
        // Continue with null project ID
      }
    }

    // Get site ID by name (sites are also stored in project_project table)
    let siteId = null;
    if (siteName) {
      console.log('🔍 Looking up site:', siteName);
      try {
        const siteResult = await pool.query(
          `SELECT id FROM project_project WHERE site_location = $1 LIMIT 1`,
          [siteName]
        );
        if (siteResult.rows.length > 0) {
          siteId = siteResult.rows[0].id;
          console.log('✅ Found site ID:', siteId);
        } else {
          console.log('⚠️ Site not found, will use NULL');
        }
      } catch (err) {
        console.error('❌ Site lookup error:', err.message);
        // Continue with null site ID
      }
    }

    // Get or create employee_clocking record for today (header record)
    // Use Singapore timezone for date comparison. We scope by date and optionally company_id
    // (derived from hr_employee). If the employee_clocking table is missing for a company,
    // we gracefully skip the header and continue with a NULL attendance_id on the line table.
    let clockingId = null;
    try {
      const clockingResult = await pool.query(
        `SELECT id FROM employee_clocking 
         WHERE ($1::integer IS NULL OR company_id = $1::integer)
           AND DATE(date) = (NOW() AT TIME ZONE 'Asia/Singapore')::date 
         LIMIT 1`,
        [companyId]
      );

      if (clockingResult.rows.length > 0) {
        clockingId = clockingResult.rows[0].id;
      } else {
        // Create new employee_clocking record for today
        // Handle schema inconsistency: some DBs have 'attendance_type', others 'attendance_types'
        try {
          const newClockingResult = await pool.query(
            `INSERT INTO employee_clocking (company_id, date, attendance_type, state, create_date, write_date)
             VALUES ($1::integer, (NOW() AT TIME ZONE 'Asia/Singapore')::date, 'sign_in', 'draft', NOW(), NOW())
             RETURNING id`,
            [companyId]
          );
          clockingId = newClockingResult.rows[0].id;
        } catch (insertErr) {
          // If column doesn't exist (code 42703), try 'attendance_types'
          if (insertErr.code === '42703') {
            console.log("⚠️ Column 'attendance_type' not found, retrying with 'attendance_types'");
            const newClockingResultRetry = await pool.query(
              `INSERT INTO employee_clocking (company_id, date, attendance_types, state, create_date, write_date)
               VALUES ($1::integer, (NOW() AT TIME ZONE 'Asia/Singapore')::date, 'sign_in', 'draft', NOW(), NOW())
               RETURNING id`,
              [companyId]
            );
            clockingId = newClockingResultRetry.rows[0].id;
          } else {
            throw insertErr;
          }
        }
      }
    } catch (dbErr) {
      if (dbErr && dbErr.code === '42P01') {
        console.error('⚠️ employee_clocking table not found, proceeding without header record:', dbErr.message);
        clockingId = null;
      } else {
        // Rethrow other errors
        throw dbErr;
      }
    }

    // Check if already clocked in for this project
    const openCheck = await pool.query(
      `SELECT id FROM employee_clocking_line 
       WHERE employee_id = $1 AND project_id = $2 AND clock_out IS NULL`,
      [employeeId, projectId]
    );

    if (openCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You already have an open clock-in for this project. Please clock out first."
      });
    }

    // Insert clock in record
    const clockInTime = timestamp ? new Date(timestamp) : new Date();
    const clockInTimeStr = clockInTime.toTimeString().split(' ')[0]; // HH:MM:SS format

    console.log('📝 Inserting clock in:', {
      clockingId,
      employeeId,
      siteId,
      siteName,
      projectId,
      projectName,
      clockInTimeStr,
      address: address || siteName,
      latitude,
      longitude
    });

    const insertParams = [clockingId, employeeId, employee.employee_no, siteId, siteName, projectId, projectName, clockInTimeStr, address || siteName || 'Mobile Clock-in', latitude || '', longitude || '', latExact, lngExact, address || siteName || '', imageUri || null];

    console.log('💾 SQL INSERT Parameters:', {
      param4_siteId: insertParams[3],
      param5_siteName: insertParams[4],
      param6_projectId: insertParams[5],
      param7_projectName: insertParams[6]
    });

    const insertResult = await pool.query(
      `INSERT INTO employee_clocking_line 
       (attendance_id, employee_id, employee_no, site_id, site_name, project_id, project_name,
        clock_in_date, clock_in, clock_in_location, in_lat, in_lan, in_lat_exact, in_lng_exact, in_addr, clock_in_image_uri,
        state, create_date, write_date, is_mobile_clocking)
       VALUES ($1, $2, $3, $4, $5, $6, $7, (NOW() AT TIME ZONE 'Asia/Singapore')::date, $8, $9, $10, $11, $12, $13, $14, $15, 'draft', NOW(), NOW(), 1)
       RETURNING id, clock_in`,
      insertParams
    );

    console.log('✅ Clock in successful:', insertResult.rows[0]);
    logActivity("clock-in", "success", "Clock in successful", {
      companyCode,
      employeeNo,
      userId: employeeId,
      metadata: { latitude, longitude, address, method, siteName, projectName }
    });

    res.json({
      success: true,
      message: "Clock in successful",
      data: {
        id: insertResult.rows[0].id,
        employeeNo: employee.employee_no,
        name: employee.name,
        clockInTime: insertResult.rows[0].clock_in,
        method,
        location: {
          latitude,
          longitude,
          address
        }
      }
    });

  } catch (error) {
    console.error("❌ Clock in error:", error);
    res.status(500).json({
      success: false,
      message: "Clock in failed",
      error: error.message
    });
    logActivity("clock-in", "failure", error.message, { companyCode, employeeNo, metadata: { method } });
  }
});

// Clock Out
router.post("/clock-out", upload.single('image'), async (req, res) => {
  try {
    let { companyCode, employeeNo, timestamp, latitude, longitude, address, method, projectName, siteName, imageUri, isImproperClocking } = req.body;

    // Handle multipart/lighter format upload
    if (req.file) {
      try {
        console.log('📸 Processing uploaded image file for clock-out...');
        const img = await loadImage(req.file.buffer);
        const maxDim = 500;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = w / h;
          if (w > h) { w = maxDim; h = maxDim / ratio; }
          else { h = maxDim; w = maxDim * ratio; }
        }
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        imageUri = canvas.toDataURL('image/jpeg', 0.6);
        console.log('✅ Clock-out image processed');
      } catch (e) {
        console.error('❌ Clock-out image processing error:', e);
        imageUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    }
    const latExact = (latitude !== undefined && latitude !== null && latitude !== '' ? parseFloat(latitude) : null);
    const lngExact = (longitude !== undefined && longitude !== null && longitude !== '' ? parseFloat(longitude) : null);

    console.log('⏰ Clock Out request received:', {
      companyCode,
      employeeNo,
      method,
      projectName: projectName || 'NOT PROVIDED',
      siteName: siteName || 'NOT PROVIDED',
      latitude,
      longitude,
      address: address || 'NOT PROVIDED',
      imageUri: imageUri ? 'provided' : 'none'
    });

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    // Get employee ID
    const empResult = await pool.query(
      `SELECT id, "x_Emp_No" as employee_no, name 
       FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true`,
      [employeeNo]
    );

    if (empResult.rows.length === 0) {
      // Check if employee exists but is inactive
      const inactiveCheck = await pool.query(
        `SELECT id, active FROM hr_employee 
         WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))`,
        [employeeNo]
      );

      if (inactiveCheck.rows.length > 0 && !inactiveCheck.rows[0].active) {
        return res.status(403).json({
          success: false,
          message: "🔒 Your account is inactive. Please contact HR to reactivate your access."
        });
      }

      logActivity("clock-out", "failure", "Employee not found", { companyCode, employeeNo });
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employee = empResult.rows[0];
    const employeeId = employee.id;

    // Get project ID if projectName provided
    let projectId = null;
    if (projectName) {
      console.log('🔍 Looking up project for clock out:', projectName);
      const projectResult = await pool.query(
        `SELECT id FROM project_project WHERE name->>'en_US' = $1 LIMIT 1`,
        [projectName]
      );
      if (projectResult.rows.length > 0) {
        projectId = projectResult.rows[0].id;
        console.log('✅ Found project ID for clock out:', projectId);
      }
    }

    // Get site ID if siteName provided
    let siteId = null;
    if (siteName) {
      console.log('🔍 Looking up site for clock out:', siteName);
      try {
        const siteResult = await pool.query(
          `SELECT id FROM project_project WHERE site_location = $1 LIMIT 1`,
          [siteName]
        );
        if (siteResult.rows.length > 0) {
          siteId = siteResult.rows[0].id;
          console.log('✅ Found site ID for clock out:', siteId);
        } else {
          console.log('⚠️ Site not found for clock out, will use NULL');
        }
      } catch (err) {
        console.error('❌ Site lookup error for clock out:', err.message);
        // Continue with null site ID
      }
    }

    // Find the open clocking for this specific project (or most recent if no project specified)
    let openClockingResult;
    if (projectId) {
      console.log('🔍 Finding open clocking for employee:', employeeId, 'project:', projectId);
      openClockingResult = await pool.query(
        `SELECT id, clock_in, clock_in_location, clock_in_date, project_id
         FROM employee_clocking_line 
         WHERE employee_id = $1 AND project_id = $2 AND clock_out IS NULL 
         ORDER BY clock_in_date DESC, clock_in DESC 
         LIMIT 1`,
        [employeeId, projectId]
      );
      console.log('📊 Query result for project', projectId, ':', openClockingResult.rows);
      // Fallback if no open record for this project: pick the most recent open record for the employee
      if (openClockingResult.rows.length === 0) {
        console.log('⚠️ No open clocking found for project. Falling back to any open clocking for employee:', employeeId);
        openClockingResult = await pool.query(
          `SELECT id, clock_in, clock_in_location, clock_in_date, project_id
           FROM employee_clocking_line 
           WHERE employee_id = $1 AND clock_out IS NULL 
           ORDER BY clock_in_date DESC, clock_in DESC 
           LIMIT 1`,
          [employeeId]
        );
        console.log('📊 Fallback open clocking result:', openClockingResult.rows);
      }
    } else {
      // Fallback: find most recent open clocking
      console.log('🔍 Finding most recent open clocking for employee:', employeeId, '(no project filter)');
      openClockingResult = await pool.query(
        `SELECT id, clock_in, clock_in_location, clock_in_date, project_id
         FROM employee_clocking_line 
         WHERE employee_id = $1 AND clock_out IS NULL 
         ORDER BY clock_in_date DESC, clock_in DESC 
         LIMIT 1`,
        [employeeId]
      );
      console.log('📊 Query result (no project filter):', openClockingResult.rows);
    }

    console.log('📊 Total open clockings found:', openClockingResult.rows.length);

    if (openClockingResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: projectName
          ? `No open clock in found for project "${projectName}". Please clock in first.`
          : "No open clock in found. Please clock in first."
      });
    }

    const openClocking = openClockingResult.rows[0];
    const clockOutTime = timestamp ? new Date(timestamp) : new Date();
    const clockOutTimeStr = clockOutTime.toTimeString().split(' ')[0]; // HH:MM:SS format

    // Update with clock out time, address, images, exact coords, site and project (both ID and name)
    let updateResult;

    // 1. First perform a reliable basic update to ensure the clock-out is recorded no matter what
    try {
      console.log('📝 Updating clock out:', {
        clockOutTimeStr,
        address,
        siteId,
        siteName,
        projectId,
        projectName,
        clockingId: openClocking.id
      });

      const updateParams = [clockOutTimeStr, address || 'Unknown', siteId, siteName, projectId, projectName, latitude || '', longitude || '', address || '', imageUri || null, latExact, lngExact, openClocking.id, employee.employee_no, isImproperClocking === 'true' || isImproperClocking === true];

      console.log('💾 SQL UPDATE Parameters:', {
        param3_siteId: updateParams[2],
        param4_siteName: updateParams[3],
        param5_projectId: updateParams[4],
        param6_projectName: updateParams[5],
        param15_isImproperClocking: updateParams[14]
      });

      updateResult = await pool.query(
        `UPDATE employee_clocking_line ecl
         SET clock_out = $1,
             clock_out_date = (NOW() AT TIME ZONE 'Asia/Singapore')::date,
             clock_out_location = $2,
             clock_out_site_id = $3,
             clock_out_site_name = $4,
             clock_out_project_id = $5,
             clock_out_project_name = $6,
             out_lat = $7,
             out_lan = $8,
             out_add = $9,
             clock_out_image_uri = $10,
             out_lat_exact = $11,
             out_lng_exact = $12,
             employee_no = COALESCE(employee_no, $14),
             is_improper_clocking = COALESCE($15, false),
             state = 'done',
             write_date = NOW()
         WHERE id = $13
         RETURNING id, clock_in, clock_out, clock_in_date`,
        updateParams
      );

      if (updateResult.rowCount === 0) {
        throw new Error("Clock-out update failed: record may have been closed or modified concurrently");
      }

      // Initialize default hours in response
      updateResult.rows[0].tot_hrs = 0;
      updateResult.rows[0].normal_hrs = 0;
      updateResult.rows[0].rest_hrs = 0;
      updateResult.rows[0].ot_hours = 0;

    } catch (err) {
      console.error("❌ Clock out basic update failed:", err);
      throw err;
    }

    // 2. Attempt rigorous hours computation in a separate step (non-blocking for success)
    try {
      const hoursUpdate = await pool.query(
        `UPDATE employee_clocking_line ecl
         SET tot_hrs = TRUNC((FLOOR(EXTRACT(EPOCH FROM ((COALESCE(ecl.clock_out_date, ecl.clock_in_date)::date + ecl.clock_out::time) - (ecl.clock_in_date::date + ecl.clock_in::time))) / 60.0) / 60.0)::numeric, 2),
             normal_hrs = TRUNC(LEAST((FLOOR(EXTRACT(EPOCH FROM ((COALESCE(ecl.clock_out_date, ecl.clock_in_date)::date + ecl.clock_out::time) - (ecl.clock_in_date::date + ecl.clock_in::time))) / 60.0) / 60.0)::numeric, COALESCE(NULLIF(he."x_Actual_shift_hours", 0), 8)::numeric), 2),
             rest_hrs = TRUNC(LEAST(GREATEST((FLOOR(EXTRACT(EPOCH FROM ((COALESCE(ecl.clock_out_date, ecl.clock_in_date)::date + ecl.clock_out::time) - (ecl.clock_in_date::date + ecl.clock_in::time))) / 60.0) / 60.0)::numeric - COALESCE(NULLIF(he."x_Actual_shift_hours", 0), 8)::numeric, 0), 1), 2),
             ot_hours = TRUNC(GREATEST((FLOOR(EXTRACT(EPOCH FROM ((COALESCE(ecl.clock_out_date, ecl.clock_in_date)::date + ecl.clock_out::time) - (ecl.clock_in_date::date + ecl.clock_in::time))) / 60.0) / 60.0)::numeric - COALESCE(NULLIF(he."x_Actual_shift_hours", 0), 8)::numeric - LEAST(GREATEST((FLOOR(EXTRACT(EPOCH FROM ((COALESCE(ecl.clock_out_date, ecl.clock_in_date)::date + ecl.clock_out::time) - (ecl.clock_in_date::date + ecl.clock_in::time))) / 60.0) / 60.0)::numeric - COALESCE(NULLIF(he."x_Actual_shift_hours", 0), 8)::numeric, 0), 1), 0), 2),
             write_date = NOW()
         FROM hr_employee he
         WHERE ecl.id = $1 AND he.id = ecl.employee_id
         RETURNING ecl.tot_hrs, ecl.normal_hrs, ecl.rest_hrs, ecl.ot_hours`
        , [openClocking.id]
      );
      if (hoursUpdate.rows?.length) {
        updateResult.rows[0].tot_hrs = hoursUpdate.rows[0].tot_hrs;
        updateResult.rows[0].normal_hrs = hoursUpdate.rows[0].normal_hrs;
        updateResult.rows[0].rest_hrs = hoursUpdate.rows[0].rest_hrs;
        updateResult.rows[0].ot_hours = hoursUpdate.rows[0].ot_hours;
      }
    } catch (hoursErr) {
      console.error('⚠️ Hours computation failed (non-blocking):', hoursErr.message);
    }

    // Upsert daily attendance flags and totals for this employee and date (based on clock_in_date)
    const attendanceDate = openClocking.clock_in_date;
    try {
      const upsertDaily = await pool.query(
        `WITH day_lines AS (
           SELECT
             MIN(ecl.clock_in::time) AS first_in,
             MAX(ecl.clock_out::time) AS last_out,
             -- Sum whole minutes across all lines to avoid rounding up from seconds
             SUM(FLOOR(EXTRACT(EPOCH FROM (
                   (COALESCE(ecl.clock_out_date, ecl.clock_in_date)::date + NULLIF(TRIM(ecl.clock_out::text), '')::time)
                 - (ecl.clock_in_date::date + NULLIF(TRIM(ecl.clock_in::text), '')::time)
             )) / 60.0)) AS tot_mins
           FROM employee_clocking_line ecl
           WHERE ecl.employee_id = $1
             AND ecl.clock_in_date = $2::date
             AND ecl.clock_out IS NOT NULL
             AND NULLIF(TRIM(ecl.clock_out::text), '') IS NOT NULL
         ),
         shift AS (
           SELECT COALESCE(NULLIF(he."x_Actual_shift_hours", 0), 8) AS shift_hours,
                  TIME '08:00:00' AS shift_start
           FROM hr_employee he
           WHERE he.id = $1
         ),
         calc AS (
          SELECT dl.first_in,
                 dl.last_out,
                 TRUNC((COALESCE(dl.tot_mins, 0) / 60.0)::numeric, 2) AS tot_hrs,
                 -- Derive normal/rest/ot from truncated total hours and employee shift
                 TRUNC(LEAST((COALESCE(dl.tot_mins, 0) / 60.0)::numeric, s.shift_hours::numeric), 2) AS normal_hrs,
                 TRUNC(LEAST(GREATEST((COALESCE(dl.tot_mins, 0) / 60.0)::numeric - s.shift_hours::numeric, 0), 1), 2) AS rest_hrs,
                 TRUNC(GREATEST((COALESCE(dl.tot_mins, 0) / 60.0)::numeric - s.shift_hours::numeric - LEAST(GREATEST((COALESCE(dl.tot_mins, 0) / 60.0)::numeric - s.shift_hours::numeric, 0), 1), 0), 2) AS ot_hrs,
                 s.shift_hours,
                 s.shift_start,
                 (s.shift_start + (s.shift_hours::int) * interval '1 hour')::time AS shift_end,
                 (s.shift_start + interval '15 minutes')::time AS late_threshold,
                 ((s.shift_start + (s.shift_hours::int) * interval '1 hour')::time - interval '15 minutes')::time AS early_threshold,
                 (dl.first_in IS NOT NULL AND dl.last_out IS NOT NULL) AS present
          FROM day_lines dl CROSS JOIN shift s
        )
         INSERT INTO employee_daily_attendance
           (employee_id, attendance_date, is_present, is_late, is_early_exit, day_status,
            normal_hours, overtime_hours, rest_hours, total_hours, first_clock_in, last_clock_out, created_at, updated_at)
         SELECT
           $1 AS employee_id, $2::date AS attendance_date,
           COALESCE(c.present, false) AS is_present,
           COALESCE(c.present AND (c.first_in > c.late_threshold), false) AS is_late,
           COALESCE(c.present AND (c.last_out < c.early_threshold), false) AS is_early_exit,
           COALESCE(CASE
             WHEN NOT c.present THEN 'absent'
             WHEN (c.present AND (c.first_in > c.late_threshold) AND (c.last_out < c.early_threshold)) THEN 'late_and_early'
             WHEN (c.present AND (c.first_in > c.late_threshold)) THEN 'late'
             WHEN (c.present AND (c.last_out < c.early_threshold)) THEN 'early_exit'
             ELSE 'present'
           END, 'absent') AS day_status,
           COALESCE(c.normal_hrs, 0) AS normal_hours,
           COALESCE(c.ot_hrs, 0) AS overtime_hours,
           COALESCE(c.rest_hrs, 0) AS rest_hours,
           COALESCE(c.tot_hrs, 0) AS total_hours,
           c.first_in AS first_clock_in,
           c.last_out AS last_clock_out,
           NOW(), NOW()
         FROM calc c
         ON CONFLICT (employee_id, attendance_date) DO UPDATE
         SET is_present = EXCLUDED.is_present,
             is_late = EXCLUDED.is_late,
             is_early_exit = EXCLUDED.is_early_exit,
             day_status = EXCLUDED.day_status,
             normal_hours = EXCLUDED.normal_hours,
             overtime_hours = EXCLUDED.overtime_hours,
             rest_hours = EXCLUDED.rest_hours,
             total_hours = EXCLUDED.total_hours,
             first_clock_in = EXCLUDED.first_clock_in,
             last_clock_out = EXCLUDED.last_clock_out,
             updated_at = NOW()
         RETURNING day_status, is_late, is_early_exit, total_hours, normal_hours, overtime_hours, rest_hours` ,
        [employeeId, attendanceDate]
      );
      console.log('🗂️ Daily attendance upserted:', upsertDaily.rows[0]);
    } catch (e) {
      console.error('⚠️ Daily attendance upsert warning:', e.message);
    }

    console.log('✅ Clock out successful:', updateResult.rows[0]);
    logActivity("clock-out", "success", "Clock out successful", {
      companyCode,
      employeeNo,
      userId: employeeId,
      metadata: { latitude, longitude, address, method, siteName, projectName }
    });

    res.json({
      success: true,
      message: "Clock out successful",
      data: {
        id: updateResult.rows[0].id,
        employeeNo: employee.employee_no,
        name: employee.name,
        clockInTime: updateResult.rows[0].clock_in,
        clockOutTime: updateResult.rows[0].clock_out,
        totals: {
          totalHours: updateResult.rows[0].tot_hrs ?? null,
          normalHours: updateResult.rows[0].normal_hrs ?? null,
          restHours: updateResult.rows[0].rest_hrs ?? null,
          overtimeHours: updateResult.rows[0].ot_hours ?? null
        },
        method,
        location: {
          latitude,
          longitude,
          address
        }
      }
    });

  } catch (error) {
    console.error("❌ Clock out error:", error);
    res.status(500).json({
      success: false,
      message: "Clock out failed",
      error: error.message
    });
    logActivity("clock-out", "failure", error.message, { companyCode, employeeNo, metadata: { method } });
  }
});

// Check clock status for a specific project/site
router.get("/status", async (req, res) => {
  try {
    const { companyCode, employeeNo, projectName } = req.query;

    if (!companyCode || !employeeNo) {
      return res.status(400).json({
        success: false,
        message: "Company code and employee number are required"
      });
    }

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    // Get employee (use same query as clock-in endpoint)
    console.log('🔍 Looking up employee for status check:', employeeNo, 'company:', companyCode);
    const empResult = await pool.query(
      `SELECT id, "x_Emp_No" as employee_no, name 
       FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true`,
      [employeeNo]
    );

    console.log('📊 Employee lookup result:', empResult.rows);

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employeeId = empResult.rows[0].id;
    console.log('✅ Found employee ID:', employeeId);

    // Get project ID if projectName provided
    let projectId = null;
    if (projectName) {
      console.log('🔍 Looking up project for status check:', projectName);
      const projectResult = await pool.query(
        `SELECT id FROM project_project WHERE name->>'en_US' = $1 LIMIT 1`,
        [projectName]
      );
      if (projectResult.rows.length > 0) {
        projectId = projectResult.rows[0].id;
        console.log('✅ Found project ID for status check:', projectId);
      } else {
        console.log('⚠️ Project not found for status check');
      }
    }

    console.log('🔍 Checking open clocking for employee:', employeeId, 'project:', projectId);

    // Check if there's an open clocking for TODAY (ignore old open records)
    const openClockingResult = await pool.query(
      `SELECT id, clock_in, clock_in_location 
       FROM employee_clocking_line 
       WHERE employee_id = $1 
         AND ($2::integer IS NULL OR project_id = $2)
         AND clock_out IS NULL 
         AND clock_in_date = (NOW() AT TIME ZONE 'Asia/Singapore')::date
       ORDER BY clock_in DESC 
       LIMIT 1`,
      [employeeId, projectId]
    );

    console.log('📊 Open clocking result:', openClockingResult.rows);

    if (openClockingResult.rows.length > 0) {
      const openClocking = openClockingResult.rows[0];
      res.json({
        success: true,
        isClockedIn: true,
        action: "clock_out",
        data: {
          clockingLineId: openClocking.id,
          clockInTime: openClocking.clock_in,
          siteName: openClocking.clock_in_location
        }
      });
    } else {
      res.json({
        success: true,
        isClockedIn: false,
        action: "clock_in"
      });
    }

  } catch (error) {
    console.error("❌ Check status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check clock status",
      error: error.message
    });
  }
});

// Check for missed clock-outs from previous days
// This is called when the app opens to alert users about unclosed records
router.get("/missed-clockout", async (req, res) => {
  try {
    const { companyCode, employeeNo } = req.query;

    if (!companyCode || !employeeNo) {
      return res.status(400).json({
        success: false,
        message: "Company code and employee number are required"
      });
    }

    const pool = await getCompanyPool(companyCode);

    // Get employee ID
    const empResult = await pool.query(
      `SELECT id, name FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true`,
      [employeeNo]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employeeId = empResult.rows[0].id;
    const employeeName = empResult.rows[0].name;

    // Check for open clocking records from PREVIOUS days (not today)
    const missedResult = await pool.query(
      `SELECT 
        ecl.id,
        to_char(ecl.clock_in_date, 'YYYY-MM-DD') as clock_in_date,
        ecl.clock_in::text as clock_in_time,
        ecl.site_name,
        ecl.project_name
       FROM employee_clocking_line ecl
       WHERE ecl.employee_id = $1 
         AND ecl.clock_out IS NULL 
         AND ecl.clock_in_date < (NOW() AT TIME ZONE 'Asia/Singapore')::date
       ORDER BY ecl.clock_in_date DESC, ecl.clock_in DESC
       LIMIT 1`,
      [employeeId]
    );

    if (missedResult.rows.length > 0) {
      const missed = missedResult.rows[0];
      res.json({
        success: true,
        hasMissedClockout: true,
        data: {
          clockingLineId: missed.id,
          clockInDate: missed.clock_in_date,
          clockInTime: missed.clock_in_time,
          siteName: missed.site_name,
          projectName: missed.project_name,
          employeeName: employeeName
        }
      });
    } else {
      res.json({
        success: true,
        hasMissedClockout: false
      });
    }

  } catch (error) {
    console.error("❌ Check missed clock-out error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check missed clock-out",
      error: error.message
    });
  }
});

// Get today's attendance
router.get("/today", async (req, res) => {
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

    // Get employee ID
    const empResult = await pool.query(
      `SELECT id FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true`,
      [employeeNo]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employeeId = empResult.rows[0].id;

    // Get today's clockings with full details including images
    // Properly compare dates in Singapore timezone on both sides
    const result = await pool.query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.in_lat,
        ecl.in_lan,
        ecl.in_lat_exact,
        ecl.in_lng_exact,
        ecl.in_addr,
        ecl.out_lat,
        ecl.out_lan,
        ecl.out_lat_exact,
        ecl.out_lng_exact,
        ecl.tot_hrs,
        ecl.normal_hrs,
        ecl.rest_hrs,
        ecl.ot_hours,
        ecl.out_add,
        ecl.clock_in_image_uri,
        ecl.clock_out_image_uri,
        COALESCE(pp_project.name->>'en_US', ecl.project_name) as project_name,
        COALESCE(ecl.site_name, pp_site.site_location) as site_name,
        ecl.clock_in_location as location_fallback
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp_project ON ecl.project_id = pp_project.id
       LEFT JOIN project_project pp_site ON ecl.site_id = pp_site.id
       WHERE ecl.employee_id = $1 
         AND ecl.clock_in_date = (NOW() AT TIME ZONE 'Asia/Singapore')::date
       ORDER BY ecl.clock_in ASC`,
      [employeeId]
    );
    // Optionally hide rows for specific employee+date (server-side only)
    const rows = (employeeNo && HIDE_RULES[employeeNo])
      ? result.rows.filter(row => {
        try {
          const dateKey = new Date(row.clock_in_date).toISOString().split('T')[0];
          return !shouldHideForEmployeeDate(employeeNo, dateKey);
        } catch (_) {
          return true;
        }
      })
      : result.rows;

    // Format response to match mobile app expectations
    const entries = rows.map(row => {
      const entry = {
        // Site from site_location, Project from name.en_US - no address fallback
        siteName: row.site_name || undefined,
        projectName: row.project_name || undefined
      };

      if (row.clock_in) {
        // Use the actual clock_in_date from database, not today's date
        const clockInDate = row.clock_in_date ? new Date(row.clock_in_date) : new Date();
        const [hours, minutes, seconds] = row.clock_in.split(':');
        clockInDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);

        entry.clockIn = {
          timestamp: clockInDate.getTime(),
          location: {
            latitude: (row.in_lat_exact !== null && row.in_lat_exact !== undefined) ? row.in_lat_exact : (parseFloat(row.in_lat) || 0),
            longitude: (row.in_lng_exact !== null && row.in_lng_exact !== undefined) ? row.in_lng_exact : (parseFloat(row.in_lan) || 0),
            latitudeExact: (row.in_lat_exact !== null && row.in_lat_exact !== undefined) ? row.in_lat_exact : undefined,
            longitudeExact: (row.in_lng_exact !== null && row.in_lng_exact !== undefined) ? row.in_lng_exact : undefined,
            address: row.in_addr || undefined
          },
          imageUri: row.clock_in_image_uri || undefined
        };
      }

      if (row.clock_out) {
        // Use the actual clock_out_date from database if available, otherwise use clock_in_date
        const clockOutDate = row.clock_out_date ? new Date(row.clock_out_date) :
          row.clock_in_date ? new Date(row.clock_in_date) : new Date();
        const [hours, minutes, seconds] = row.clock_out.split(':');
        clockOutDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);

        entry.clockOut = {
          timestamp: clockOutDate.getTime(),
          location: {
            latitude: (row.out_lat_exact !== null && row.out_lat_exact !== undefined) ? row.out_lat_exact : (parseFloat(row.out_lat) || 0),
            longitude: (row.out_lng_exact !== null && row.out_lng_exact !== undefined) ? row.out_lng_exact : (parseFloat(row.out_lan) || 0),
            latitudeExact: (row.out_lat_exact !== null && row.out_lat_exact !== undefined) ? row.out_lat_exact : undefined,
            longitudeExact: (row.out_lng_exact !== null && row.out_lng_exact !== undefined) ? row.out_lng_exact : undefined,
            address: row.out_add || undefined
          },
          imageUri: row.clock_out_image_uri || undefined
        };
      }

      return entry;
    });

    // Compute totals for the day
    const totalNormal = rows.reduce((acc, r) => acc + (parseFloat(r.normal_hrs) || 0), 0);
    const totalOT = rows.reduce((acc, r) => acc + (parseFloat(r.ot_hours) || 0), 0);
    const totalRest = rows.reduce((acc, r) => acc + (parseFloat(r.rest_hrs) || 0), 0);
    const totalWorked = rows.reduce((acc, r) => acc + (parseFloat(r.tot_hrs) || 0), 0);

    // Get most recent clock-in (latest entry) and most recent clock-out for summary
    const lastEntry = entries[entries.length - 1]; // Most recent entry

    // Find the most recent clock-in (prioritize entries without clock-out, otherwise use latest)
    const openEntry = entries.slice().reverse().find(e => e.clockIn && !e.clockOut);
    const mostRecentClockIn = openEntry || lastEntry;

    const responseData = {
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }), // YYYY-MM-DD (Singapore Time)
      clockIn: mostRecentClockIn?.clockIn || undefined,
      clockOut: lastEntry?.clockOut || undefined,
      entries: entries,
      normalHours: Number(totalNormal.toFixed(2)),
      overtimeHours: Number(totalOT.toFixed(2)),
      restHours: Number(totalRest.toFixed(2)),
      totalHours: Number(totalWorked.toFixed(2)),
      status: entries.some(e => e.clockIn && !e.clockOut) ? 'present' :
        entries.some(e => e.clockIn && e.clockOut) ? 'present' : 'absent'
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error("❌ Get today attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance",
      error: error.message
    });
  }
});

// Read-only verification: check if rows exist for given dates for an employee
router.get("/verify-rows", async (req, res) => {
  try {
    const { companyCode, employeeNo } = req.query;
    let { dates } = req.query;

    if (!companyCode || !employeeNo) {
      return res.status(400).json({ success: false, message: "companyCode and employeeNo are required" });
    }

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    // Parse dates list or fallback to configured hide rules for the employee
    let dateList = [];
    if (typeof dates === 'string' && dates.trim().length > 0) {
      dateList = dates.split(',').map(s => s.trim()).filter(Boolean);
    } else if (HIDE_RULES[employeeNo]) {
      dateList = Array.from(HIDE_RULES[employeeNo]);
    }

    if (dateList.length === 0) {
      return res.status(400).json({ success: false, message: "No dates provided and no defaults available for this employee." });
    }

    // Get employee ID
    const empResult = await pool.query(
      `SELECT id FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))`,
      [employeeNo]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    const employeeId = empResult.rows[0].id;

    // Read-only aggregated check for the provided dates
    const verifyRes = await pool.query(
      `WITH dates(d) AS (
         SELECT UNNEST($2::date[])
       )
       SELECT to_char(d, 'YYYY-MM-DD') AS date,
              COALESCE(COUNT(ecl.id), 0) AS rows,
              COALESCE(bool_or(ecl.clock_in_image_uri IS NOT NULL OR ecl.clock_out_image_uri IS NOT NULL), false) AS has_images,
              MIN(ecl.clock_in) AS first_in,
              MAX(ecl.clock_out) AS last_out
       FROM dates
       LEFT JOIN employee_clocking_line ecl 
         ON ecl.employee_id = $1 AND ecl.clock_in_date = d
       GROUP BY d
       ORDER BY d` ,
      [employeeId, dateList]
    );

    res.json({ success: true, employeeNo, companyCode, dates: dateList, data: verifyRes.rows });
  } catch (error) {
    console.error("❌ Verify rows error:", error);
    res.status(500).json({ success: false, message: "Verification failed", error: error.message });
  }
});

// Get attendance history
router.get("/history", async (req, res) => {
  try {
    const { companyCode, employeeNo, startDate, endDate } = req.query;

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    // Get employee ID
    const empResult = await pool.query(
      `SELECT id FROM hr_employee 
       WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1)) AND active = true`,
      [employeeNo]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employeeId = empResult.rows[0].id;

    // Get attendance history with full details including images
    const result = await pool.query(
      `SELECT 
        ecl.id,
        ecl.clock_in,
        ecl.clock_out,
        ecl.clock_in_date,
        ecl.clock_out_date,
        ecl.in_lat,
        ecl.in_lan,
        ecl.in_lat_exact,
        ecl.in_lng_exact,
        ecl.in_addr,
        ecl.out_lat,
        ecl.out_lan,
        ecl.out_lat_exact,
        ecl.out_lng_exact,
        ecl.out_add,
        (ecl.clock_in_image_uri IS NOT NULL AND ecl.clock_in_image_uri <> '') as has_clock_in_image,
        (ecl.clock_out_image_uri IS NOT NULL AND ecl.clock_out_image_uri <> '') as has_clock_out_image,
        COALESCE(pp_project.name->>'en_US', ecl.project_name) as project_name,
        COALESCE(ecl.site_name, pp_site.site_location) as site_name,
        ecl.clock_in_location as location_fallback,
        COALESCE(ecl.is_improper_clocking, false) as is_improper_clocking
       FROM employee_clocking_line ecl
       LEFT JOIN project_project pp_project ON ecl.project_id = pp_project.id
       LEFT JOIN project_project pp_site ON ecl.site_id = pp_site.id
       WHERE ecl.employee_id = $1 
         AND DATE(ecl.clock_in_date) BETWEEN $2 AND $3
       ORDER BY ecl.clock_in_date DESC, ecl.clock_in ASC`,
      [employeeId, startDate || '2024-01-01', endDate || '2025-12-31']
    );

    // Apply backend hide filter for specific employee+dates
    const historyRows = (employeeNo && HIDE_RULES[employeeNo])
      ? result.rows.filter(row => {
        try {
          // Use Singapore timezone for date key to align with grouping below
          const singaporeDate = new Date(row.clock_in_date.getTime() + (8 * 60 * 60 * 1000));
          const dateKey = singaporeDate.toISOString().split('T')[0];
          return !shouldHideForEmployeeDate(employeeNo, dateKey);
        } catch (_) {
          return true;
        }
      })
      : result.rows;

    // Fetch persisted daily flags and totals (if any) for this range
    let dailyFlagsRes;
    const dailyFlags = {};
    try {
      dailyFlagsRes = await pool.query(
        `SELECT attendance_date, day_status, is_present, is_late, is_early_exit,
                normal_hours, overtime_hours, rest_hours, total_hours,
                first_clock_in, last_clock_out
         FROM employee_daily_attendance
         WHERE employee_id = $1
           AND attendance_date BETWEEN $2 AND $3`,
        [employeeId, startDate || '2024-01-01', endDate || '2025-12-31']
      );
      (dailyFlagsRes.rows || []).forEach(r => {
        const key = new Date(r.attendance_date).toISOString().split('T')[0];
        dailyFlags[key] = r;
      });
    } catch (dbErr) {
      // If the summary table doesn't exist in this company's DB, log and continue using computed values
      if (dbErr && dbErr.code === '42P01') {
        console.error('⚠️ employee_daily_attendance table not found, using computed history only:', dbErr.message);
      } else {
        throw dbErr;
      }
    }

    // Group by date and format response
    const groupedByDate = {};
    const groupedSums = {};

    historyRows.forEach(row => {
      // Use Singapore timezone for date grouping to avoid timezone conversion issues
      const singaporeDate = new Date(row.clock_in_date.getTime() + (8 * 60 * 60 * 1000)); // Add 8 hours for Singapore timezone
      const dateKey = singaporeDate.toISOString().split('T')[0];

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      if (!groupedSums[dateKey]) {
        groupedSums[dateKey] = { normal: 0, ot: 0, rest: 0, total: 0 };
      }

      const entry = {
        // Site from site_location, Project from name.en_US - no address fallback
        siteName: row.site_name || undefined,
        projectName: row.project_name || undefined,
        isImproperClocking: row.is_improper_clocking || false
      };

      if (row.clock_in) {
        const clockInDate = new Date(row.clock_in_date);
        const [hours, minutes, seconds] = row.clock_in.split(':');
        clockInDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);

        entry.clockIn = {
          timestamp: clockInDate.getTime(),
          location: {
            latitude: (row.in_lat_exact !== null && row.in_lat_exact !== undefined) ? row.in_lat_exact : (parseFloat(row.in_lat) || 0),
            longitude: (row.in_lng_exact !== null && row.in_lng_exact !== undefined) ? row.in_lng_exact : (parseFloat(row.in_lan) || 0),
            address: row.in_addr || undefined
          },
          // Use hasImage flag instead of full base64 to reduce payload
          hasImage: !!(row.has_clock_in_image),
          imageId: row.has_clock_in_image ? row.id : undefined
        };
      }

      if (row.clock_out) {
        // Use clock_out_date if available, otherwise fallback to clock_in_date
        const clockOutDate = row.clock_out_date ? new Date(row.clock_out_date) : new Date(row.clock_in_date);
        const [hours, minutes, seconds] = row.clock_out.split(':');
        clockOutDate.setHours(parseInt(hours), parseInt(minutes), parseInt(seconds || 0), 0);

        entry.clockOut = {
          timestamp: clockOutDate.getTime(),
          location: {
            latitude: (row.out_lat_exact !== null && row.out_lat_exact !== undefined) ? row.out_lat_exact : (parseFloat(row.out_lat) || 0),
            longitude: (row.out_lng_exact !== null && row.out_lng_exact !== undefined) ? row.out_lng_exact : (parseFloat(row.out_lan) || 0),
            address: row.out_add || undefined
          },
          // Use hasImage flag instead of full base64 to reduce payload
          hasImage: !!(row.has_clock_out_image),
          imageId: row.has_clock_out_image ? row.id : undefined
        };
      }

      groupedByDate[dateKey].push(entry);
      groupedSums[dateKey].normal += (parseFloat(row.normal_hrs) || 0);
      groupedSums[dateKey].ot += (parseFloat(row.ot_hours) || 0);
      groupedSums[dateKey].rest += (parseFloat(row.rest_hrs) || 0);
      groupedSums[dateKey].total += (parseFloat(row.tot_hrs) || 0);
    });

    // Format as array of daily records
    const historyData = Object.keys(groupedByDate).map(date => {
      const entries = groupedByDate[date];
      const lastEntry = entries[entries.length - 1]; // Most recent entry

      // Find the most recent clock-in (prioritize entries without clock-out, otherwise use latest)
      const openEntry = entries.slice().reverse().find(e => e.clockIn && !e.clockOut);
      const mostRecentClockIn = openEntry || lastEntry;
      const computedStatus = entries.some(e => e.clockIn && !e.clockOut) ? 'present' :
        entries.some(e => e.clockIn && e.clockOut) ? 'present' : 'absent';
      const persisted = dailyFlags[date];
      const normalHours = persisted && persisted.normal_hours != null ? Number(parseFloat(persisted.normal_hours).toFixed(2)) : Number((groupedSums[date].normal || 0).toFixed(2));
      const overtimeHours = persisted && persisted.overtime_hours != null ? Number(parseFloat(persisted.overtime_hours).toFixed(2)) : Number((groupedSums[date].ot || 0).toFixed(2));
      const restHours = persisted && persisted.rest_hours != null ? Number(parseFloat(persisted.rest_hours).toFixed(2)) : Number((groupedSums[date].rest || 0).toFixed(2));
      const totalHours = persisted && persisted.total_hours != null ? Number(parseFloat(persisted.total_hours).toFixed(2)) : Number((groupedSums[date].total || 0).toFixed(2));

      return {
        date: date,
        clockIn: mostRecentClockIn?.clockIn || undefined,
        clockOut: lastEntry?.clockOut || undefined,
        entries: entries,
        normalHours: normalHours,
        overtimeHours: overtimeHours,
        restHours: restHours,
        totalHours: totalHours,
        status: computedStatus,
        dayStatus: persisted?.day_status || computedStatus
      };
    });

    // Build top-level summary across days: count only days with at least one completed entry (has clockIn and clockOut)
    const completedDays = historyData.filter(d => (d.entries || []).some(e => e.clockIn && e.clockOut));
    const summaryDays = completedDays.length;
    const totalNormalHours = completedDays.reduce((acc, d) => acc + (d.normalHours || 0), 0);
    const totalOvertimeHours = completedDays.reduce((acc, d) => acc + (d.overtimeHours || 0), 0);
    const summary = {
      days: summaryDays,
      totalNormalHours: Number(totalNormalHours.toFixed(2)),
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
      label: `${summaryDays} Days | ${Number(totalNormalHours.toFixed(2))} Hours Normal | ${Number(totalOvertimeHours.toFixed(2))} Hours Overtime`
    };

    res.json({
      success: true,
      data: historyData,
      summary
    });

  } catch (error) {
    console.error("❌ Get attendance history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance history",
      error: error.message
    });
  }
});

// Get attendance image by clocking line ID and type (clock_in or clock_out)
// GET /attendance/image/:id?type=clock_in|clock_out&companyCode=XXX
router.get("/image/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { type, companyCode } = req.query;

    if (!id || !type || !companyCode) {
      return res.status(400).json({
        success: false,
        message: "id, type (clock_in or clock_out), and companyCode are required"
      });
    }

    if (type !== 'clock_in' && type !== 'clock_out') {
      return res.status(400).json({
        success: false,
        message: "type must be 'clock_in' or 'clock_out'"
      });
    }

    // Get company-specific database pool
    const pool = await getCompanyPool(companyCode);

    const column = type === 'clock_in' ? 'clock_in_image_uri' : 'clock_out_image_uri';
    const result = await pool.query(
      `SELECT ${column} as image_uri FROM employee_clocking_line WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Clocking record not found"
      });
    }

    const imageUri = result.rows[0].image_uri;
    if (!imageUri) {
      return res.status(404).json({
        success: false,
        message: "No image found for this record"
      });
    }

    res.json({
      success: true,
      data: {
        imageUri: imageUri
      }
    });

  } catch (error) {
    console.error("❌ Get attendance image error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get attendance image",
      error: error.message
    });
  }
});

export default router;
