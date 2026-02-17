import express from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { getCompanyPool, masterPool } from "./multiCompanyDb.js";
import fs from "fs/promises";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      return res.status(401).json({ error: "No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(userToken, SECRET_KEY);
    } catch (err) {
      console.error("❌ Error verifying token in /payroll:", err?.message || err);
      return res.status(401).json({ error: "Invalid token" });
    }

    const companyCode = decoded.companyCode;
    const employeeNo = decoded.employeeNo;

    if (!companyCode || !employeeNo) {
      return res.status(400).json({ error: "companyCode and employeeNo are required in token" });
    }

    const pool = await getCompanyPool(companyCode);

    console.log("payroll decoded employeeNo " + employeeNo);
    const queryString = `select * from udf_emp_payroll_select_by_emp($1,$2)`;

    let dbResponse;
    try {
      dbResponse = await pool.query(queryString, [employeeNo, null]);
    } catch (dbErr) {
      console.error("Error fetching payrolls (stored function):", dbErr);
      if (dbErr && dbErr.code === "42P01") {
        return res.json([]);
      }
      return res.status(500).json({ error: "Internal server error" });
    }

    const payrolls = dbResponse.rows.map((item) => ({
      payrollId: item.out_payroll_id,
      payrollMonth: item.out_payroll_month,
      payrollYear: item.out_pr_year,
      paymentConfirmDate: item.out_confirm_date,
      basicSalary: item.out_total_payable,
      allowanceAmount: item.out_allowance_amount,
      deductionAmount: item.out_deduction_amount,
      grandTotalPayable: item.out_grand_total_payable,
      payslipUrl: item.out_payslip_url,
    }));
    res.json(payrolls);
  } catch (error) {
    console.error("❌ Error in /payroll:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payslip-download/:payslipURL", (req, res) => {
  const filePath = Buffer.from(req.params.payslipURL, "base64").toString("utf-8");
  console.log("payslip-download filePath: " + filePath);
  res.download(filePath);
});

// Schema Mapping Based Payslips Endpoint
router.get("/payslips", async (req, res) => {
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
      console.error("❌ Error verifying token in /payroll/payslips:", err?.message || err);
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
        message: "Company code is required in token for payslips",
      });
    }

    const pool = await getCompanyPool(companyCode);

    console.log(`📋 Fetching payslips for employee ID: ${employeeId}, Company: ${companyCode}`);

    // Check if employee is active
    let employeeCheck;
    try {
      employeeCheck = await pool.query(
        `SELECT id, name, active FROM hr_employee WHERE id = $1`,
        [employeeId]
      );
    } catch (dbErr) {
      console.error("Error checking employee for payslips:", dbErr);
      if (dbErr && dbErr.code === "42P01") {
        return res.json({
          success: true,
          isActive: false,
          message: "Payslip data not available for this company.",
          data: [],
        });
      }
      throw dbErr;
    }

    if (employeeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
        isActive: false
      });
    }

    const employee = employeeCheck.rows[0];
    const isActive = employee.active === true || employee.active === 't';

    if (!isActive) {
      return res.json({
        success: true,
        isActive: false,
        message: "⚠️ Payslip access is restricted for inactive employees. Please contact HR for assistance.",
        data: []
      });
    }

    // SCHEMA MAPPING STRATEGY
    // 1. Fetch Mapping Rule from Master DB
    let mappingResult;
    try {
      mappingResult = await masterPool.query(
        "SELECT mapping_json FROM schema_mappings WHERE company_code = $1 AND endpoint = 'payslips'",
        [companyCode]
      );
    } catch (e) {
      console.error("Error fetching schema mapping:", e);
    }

    let payslipsResult;
    let payslips = [];

    if (mappingResult && mappingResult.rows.length > 0) {
      const mapping = mappingResult.rows[0].mapping_json;
      let querySql = "";

      if (mapping.type === "raw_sql") {
        // Complex Query (Pre-written in JSON)
        querySql = mapping.query;
      } else if (mapping.type === "simple_table") {
        // Simple Query Construction
        const cols = mapping.columns;
        const selectParts = Object.entries(cols).map(([key, dbCol]) => `${dbCol} as "${key}"`);
        querySql = `
          SELECT ${selectParts.join(', ')} 
          FROM ${mapping.table} 
          WHERE ${mapping.id_column} = $1 
          ORDER BY ${cols.payDate} DESC, ${cols.createDate} DESC 
          LIMIT 12
        `;
      }

      try {
        console.log(`[Payroll] Executing Dynamic Query for ${companyCode} (Type: ${mapping.type})`);
        payslipsResult = await pool.query(querySql, [employeeId]);

        if (payslipsResult.rows.length > 0) {
          console.log("[Payroll] First Raw Row:", payslipsResult.rows[0]);
        } else {
          console.log("[Payroll] Query returned 0 rows.");
        }

        // Map to standardized format
        payslips = payslipsResult.rows.map(row => ({
          id: row.id,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          empNo: row.empNo,
          monthYear: `${row.month}-${row.payYear}`,
          month: row.month,
          year: row.payYear,
          payslipPeriod: row.payslipPeriod,
          payDate: row.payDate,
          basicSalary: parseFloat(row.basicSalary) || 0,
          allowance: parseFloat(row.allowance) || 0,
          deduction: parseFloat(row.deduction) || 0,
          totalSalary: parseFloat(row.netPay) || 0,
          grossPay: parseFloat(row.grossPay) || 0,
          payslipUrl: row.payslipUrl || '',
          status: row.status || 'Processed'
        }));

        console.log(`[Payroll] Sending ${payslips.length} items to frontend.`);

      } catch (dbErr) {
        console.error("Error executing dynamic payslip query:", dbErr);
        throw dbErr;
      }

    } else {
      // FALLBACK: If no mapping exists, return empty
      console.warn(`No schema mapping found for ${companyCode}`);
      return res.json({
        success: true,
        isActive: true,
        message: "Payslip configuration missing for this company.",
        data: [],
      });
    }

    console.log(`✅ Found ${payslips.length} payslips for employee ${employeeId}`);

    res.json({
      success: true,
      isActive: true,
      data: payslips,
      employee: {
        id: employee.id,
        name: employee.name
      }
    });

  } catch (error) {
    console.error("❌ Error fetching payslips:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payslips. Please try again.",
      error: error.message
    });
  }
});

export default router;
