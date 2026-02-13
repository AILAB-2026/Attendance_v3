import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";
import { getCompanyPool, getCompanyConfig } from "./multiCompanyDb.js";


const router = express.Router();
const saltRounds = 5;

router.post("/login", async (req, res) => {
  try {
    const loginArgs = req.body;
    const companyCode = String(loginArgs.companyCode ?? '').trim();
    const employeeNo = String(loginArgs.employeeNo ?? '').trim();
    const password = String(loginArgs.password ?? '');
    console.log("Login attempt - Company: " + companyCode + ", Employee: " + employeeNo);

    // Query hr_employee table only (using actual column names)
    const queryString = `
      SELECT 
        id,
        "x_Emp_No" AS "employeeNo",
        name,
        company_id AS "companyId",
        password,
        "profile_image_uri" AS "profileImageUri"
      FROM hr_employee
      WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))
        AND company_id = $2::integer
    `;

    const dbResponse = await query(queryString, [employeeNo, companyCode]);

    if (!dbResponse || dbResponse.rows.length === 0) {
      console.log("User not found or invalid company");
      return res.status(401).json({
        success: false,
        message: "Login failed. Invalid credentials."
      });
    }

    const user = dbResponse.rows[0];
    console.log("Found user: " + user.employeeNo + " from company ID: " + user.companyId);

    // Enforce exact password match against hr_employee.password (plain text)
    const storedPassword = user.password;
    const enteredPassword = password;
    const isValid = storedPassword != null && enteredPassword === storedPassword;
    console.log("Password valid: " + isValid);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        title: "Invalid credentials",
        message: "• Invalid credentials.\n• Please check and try again.\n• Enter correct details."
      });
    }

    const token = jwt.sign(
      {
        employeeId: user.id,
        employeeNo: user.employeeNo,
        customerId: user.companyId,
        name: user.name,
      },
      SECRET_KEY,
      { expiresIn: "90d" }
    );

    console.log("Login successful for: " + user.employeeNo);

    // Return format compatible with AIAttend_v2 mobile app
    return res.json({
      success: true,
      message: "Login success",
      data: {
        employeeNo: user.employeeNo,
        name: user.name,
        email: user.employeeNo.toLowerCase() + "@company.com", // Generate email from employee number
        role: "employee", // Default role
        companyCode: loginArgs.companyCode,
        sessionToken: token,
        profileImageUri: user.profileImageUri
      }
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Multi-company dynamic login.
// This endpoint resolves the company DB from attendance_db.companies,
// connects to the company-specific database, and validates the user
// against that database. It does not alter the existing /login route.
router.post("/login-multi", async (req, res) => {
  try {
    const loginArgs = req.body || {};
    const companyCode = String(loginArgs.companyCode ?? "").trim();
    const employeeNo = String(loginArgs.employeeNo ?? "").trim();
    const password = String(loginArgs.password ?? "");

    console.log('\n' + '='.repeat(70));
    console.log(`[MultiLogin] 🔐 LOGIN ATTEMPT STARTED`);
    console.log('='.repeat(70));
    console.log(`[MultiLogin] 📊 Request Details:`);
    console.log(`   Company Code: "${companyCode}" (length: ${companyCode.length})`);
    console.log(`   Employee No: "${employeeNo}" (length: ${employeeNo.length})`);
    console.log(`   Password: ${password ? '***PROVIDED***' : '<EMPTY>'} (length: ${password.length})`);
    console.log(`   Request Body Keys: ${Object.keys(loginArgs).join(', ')}`);

    // Basic validation (fail-fast, no DB calls yet)
    if (!companyCode || !employeeNo || !password) {
      console.log(`[MultiLogin] ❌ VALIDATION FAILED - Missing required fields`);
      console.log(`   companyCode empty: ${!companyCode}`);
      console.log(`   employeeNo empty: ${!employeeNo}`);
      console.log(`   password empty: ${!password}`);
      console.log('='.repeat(70) + '\n');
      return res.status(400).json({
        success: false,
        message: "Login failed. Invalid credentials.",
      });
    }

    console.log(`[MultiLogin] ✅ Basic validation passed`);
    console.log(`[MultiLogin] 🔍 Attempting to get company pool for: ${companyCode}`);

    let pool;
    try {
      pool = await getCompanyPool(companyCode);
      console.log(`[MultiLogin] ✅ Company pool obtained successfully`);
    } catch (err) {
      console.log(`[MultiLogin] ❌ COMPANY POOL ERROR`);
      console.log(`   Error Type: ${err?.constructor?.name || 'Unknown'}`);
      console.log(`   Error Message: ${err?.message || err}`);
      console.log(`   Error Code: ${err?.code || 'N/A'}`);
      if (err?.stack) {
        console.log(`   Stack Trace: ${err.stack.split('\n').slice(0, 3).join('\n   ')}`);
      }
      console.log('='.repeat(70) + '\n');
      return res.status(401).json({
        success: false,
        title: "Company not found",
        message: "• The company code you entered was not found.\n• Please check and try again.\n• Enter correct company code.",
      });
    }

    // Query hr_employee table on the company-specific database.
    // We intentionally mirror the field mappings from the existing /login route
    // but rely on the per-company DB instead of company_id filter.
    const queryString = `
      SELECT 
        id,
        "x_Emp_No" AS "employeeNo",
        name,
        company_id AS "companyId",
        password,
        "profile_image_uri" AS "profileImageUri"
      FROM hr_employee
      WHERE LOWER(TRIM("x_Emp_No")) = LOWER(TRIM($1))
      LIMIT 1
    `;

    console.log(`[MultiLogin] 🔍 Querying hr_employee table`);
    console.log(`   Query: ${queryString.replace(/\s+/g, ' ').trim()}`);
    console.log(`   Parameter: "${employeeNo}"`);

    let dbResponse;
    try {
      dbResponse = await pool.query(queryString, [employeeNo]);
      console.log(`[MultiLogin] ✅ Query executed successfully`);
      console.log(`   Rows returned: ${dbResponse.rows.length}`);
    } catch (queryErr) {
      console.log(`[MultiLogin] ❌ DATABASE QUERY ERROR`);
      console.log(`   Error Type: ${queryErr?.constructor?.name || 'Unknown'}`);
      console.log(`   Error Message: ${queryErr?.message || queryErr}`);
      console.log(`   Error Code: ${queryErr?.code || 'N/A'}`);
      console.log('='.repeat(70) + '\n');
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }

    if (!dbResponse || dbResponse.rows.length === 0) {
      console.log(`[MultiLogin] ❌ USER NOT FOUND`);
      console.log(`   Employee No searched: "${employeeNo}"`);
      console.log(`   Company: ${companyCode}`);
      console.log('='.repeat(70) + '\n');
      return res.status(401).json({
        success: false,
        title: "Employee not found",
        message: "• The employee number you entered was not found.\n• Please check and try again.\n• Enter correct employee number.",
      });
    }

    const user = dbResponse.rows[0];
    console.log(`[MultiLogin] ✅ USER FOUND`);
    console.log(`   Employee ID: ${user.id}`);
    console.log(`   Employee No: "${user.employeeNo}"`);
    console.log(`   Name: "${user.name}"`);
    console.log(`   Company ID: ${user.companyId}`);
    console.log(`   Password stored: ${user.password ? 'YES' : 'NO'}`);
    console.log(`   Password length: ${user.password ? user.password.length : 0}`);

    // Plain-text password comparison as per current requirement.
    const storedPassword = user.password ?? "";
    const enteredPassword = password;
    const isValid = storedPassword !== "" && enteredPassword === storedPassword;

    console.log(`[MultiLogin] 🔐 PASSWORD VERIFICATION`);
    console.log(`   Stored password empty: ${storedPassword === ""}`);
    console.log(`   Entered password empty: ${enteredPassword === ""}`);
    console.log(`   Passwords match: ${isValid}`);
    console.log(`   Stored length: ${storedPassword.length}`);
    console.log(`   Entered length: ${enteredPassword.length}`);

    if (!isValid) {
      console.log(`[MultiLogin] ❌ PASSWORD MISMATCH`);
      console.log('='.repeat(70) + '\n');
      return res.status(401).json({
        success: false,
        title: "Password not found",
        message: "• The password you entered is incorrect.\n• Please check and try again.\n• Enter correct password.",
      });
    }

    // Include companyCode in the token payload while keeping
    // existing fields for compatibility.
    const tokenPayload = {
      employeeId: user.id,
      employeeNo: user.employeeNo,
      customerId: user.companyId,
      name: user.name,
      companyCode,
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "90d" });

    console.log(`[MultiLogin] ✅ TOKEN GENERATED`);
    console.log(`   Token Payload: ${JSON.stringify(tokenPayload, null, 2)}`);
    console.log(`   Token Length: ${token.length}`);
    console.log(`[MultiLogin] 🎉 LOGIN SUCCESSFUL`);
    console.log(`   Employee: ${user.employeeNo}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Company: ${companyCode}`);
    console.log('='.repeat(70) + '\n');

    const companyConfig = await getCompanyConfig(companyCode);

    return res.json({
      success: true,
      message: "Login success",
      data: {
        employeeNo: user.employeeNo,
        name: user.name,
        email: user.employeeNo.toLowerCase() + "@company.com",
        role: "employee",
        companyCode,
        sessionToken: token,
        profileImageUri: user.profileImageUri,
        modules: companyConfig?.modules || {}
      },
    });
  } catch (error) {
    console.log('\n' + '='.repeat(70));
    console.log(`[MultiLogin] ❌ UNEXPECTED ERROR`);
    console.log('='.repeat(70));
    console.log(`   Error Type: ${error?.constructor?.name || 'Unknown'}`);
    console.log(`   Error Message: ${error?.message || error}`);
    console.log(`   Error Code: ${error?.code || 'N/A'}`);
    if (error?.stack) {
      console.log(`   Stack Trace:`);
      console.log(error.stack.split('\n').slice(0, 5).map(line => `     ${line}`).join('\n'));
    }
    console.log('='.repeat(70) + '\n');
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/validatetoken", (req, res) => {
  console.log("running validatetoken");
  const userToken = getTokenFromHeader(req);
  console.log("running validatetoken userToken " + userToken);
  if (userToken == null)
    return res.status(401).json({ message: "No token provided" });
  else {
    try {
      const decoded = jwt.verify(userToken, SECRET_KEY);
      console.log("running validatetoken employeeId " + decoded.employeeId);
      const queryString = `select 
                  id,
                  "x_Emp_No" as "employeeNo",
                  name,
                  company_id,
                  "profile_image_uri" as "profileImageUri" 
                from hr_employee
                where id=$1::integer
                  and active=true`;
      query(queryString, [decoded.employeeId], (error, dbResponse) => {
        if (!error) {
          if (dbResponse.rows.length === 0) {
            // No user found
            return res.status(401).json({
              message:
                "Authentication failed. Please try again or contact your admin.",
            });
          }
          const user = dbResponse.rows[0];

          const token = jwt.sign(
            {
              employeeId: user.id,
              employeeNo: user.employeeNo,
              customerId: user.company_id,
            },
            SECRET_KEY,
            {
              expiresIn: "90d",
            }
          );

          res.json({
            token,
            employeeId: user.id,
            employeeNo: user.employeeNo,
            name: user.name,
            customerId: user.company_id,
            profileImageUri: user.profileImageUri
          });
        }
        if (error) {
          // Handle database errors
          console.error("Database Error:", error);
          return res.status(500).json({ message: "Internal server error" });
        }
      });
    } catch (error) {
      res.status(401).json({ message: "Invalid session" });
    }
  }
});

router.post("/register", async (req, res) => {
  try {
    const { employeeNo, password } = req.body;

    // Generate salt and hash the password
    // console.log("Registering user with req.body: " + JSON.stringify(req.body));
    // console.log("Registering user with employeeNo: " + employeeNo);
    // console.log("Registering user with password: " + password);
    // console.log("Registering user with saltRounds: " + saltRounds);

    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);

    const queryString = `SELECT * FROM public.udf_hr_employee_register($1, $2)`;
    query(queryString, [hashedPassword, employeeNo], (error, dbResponse) => {
      if (error) {
        console.error("Registration DB error:", error);
        return res.status(500).json({
          success: false,
          message: "Error during registration",
        });
      }

      const result = dbResponse.rows[0];
      if (result.status_code == 0) {
        res.status(201).json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
        });
      }
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Error during registration",
    });
  }
});

// Multi-company token validation. Keeps existing /validatetoken intact and
// uses the companyCode embedded in the token payload to validate the
// employee against the correct company database.
//
// Expected token payload (from /login-multi):
// {
//   employeeId,
//   employeeNo,
//   customerId,
//   name,
//   companyCode,
//   iat,
//   exp
// }
router.get("/validatetoken-multi", async (req, res) => {
  console.log("[MultiLogin] running validatetoken-multi");
  const userToken = getTokenFromHeader(req);

  if (!userToken) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(userToken, SECRET_KEY);
    const companyCode = String(decoded.companyCode || "").trim();
    const employeeId = decoded.employeeId;

    if (!companyCode || !employeeId) {
      return res.status(401).json({ message: "Invalid session" });
    }

    let pool;
    try {
      pool = await getCompanyPool(companyCode);
    } catch (err) {
      console.error(
        "[MultiLogin] Company resolution/DB error in validatetoken-multi:",
        err?.message || err
      );
      return res.status(401).json({ message: "Invalid session" });
    }

    const queryString = `
      SELECT 
        id,
        "x_Emp_No" AS "employeeNo",
        name,
        company_id,
        "profile_image_uri" AS "profileImageUri"
      FROM hr_employee
      WHERE id = $1::integer
        AND active = true
      LIMIT 1
    `;

    let dbResponse;
    try {
      dbResponse = await pool.query(queryString, [employeeId]);
    } catch (err) {
      console.error(
        "[MultiLogin] DB error in validatetoken-multi:",
        err?.message || err
      );
      return res.status(500).json({ message: "Internal server error" });
    }

    if (!dbResponse || dbResponse.rows.length === 0) {
      return res.status(401).json({ message: "Invalid session" });
    }

    const user = dbResponse.rows[0];

    const tokenPayload = {
      employeeId: user.id,
      employeeNo: user.employeeNo,
      customerId: user.company_id,
      name: user.name,
      companyCode,
    };

    const token = jwt.sign(tokenPayload, SECRET_KEY, { expiresIn: "90d" });

    const companyConfig = await getCompanyConfig(companyCode);

    return res.json({
      token,
      employeeId: user.id,
      employeeNo: user.employeeNo,
      name: user.name,
      customerId: user.company_id,
      companyCode,
      profileImageUri: user.profileImageUri,
      modules: companyConfig?.modules || {}
    });
  } catch (error) {
    console.error("[MultiLogin] Error in validatetoken-multi:", error);
    return res.status(401).json({ message: "Invalid session" });
  }
});

export default router;