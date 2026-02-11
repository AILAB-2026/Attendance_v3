import express from "express";
import { getCompanyPool, masterPool } from "./multiCompanyDb.js";

const router = express.Router();

// Expose clock method settings and the site/project popup requirement per employee
// GET /settings/clock-methods?companyCode=...&employeeNo=...
router.get("/clock-methods", async (req, res) => {
  try {
    const { companyCode, employeeNo } = req.query;

    // Safe defaults preserve existing app behavior if anything fails
    let allowFace = true;
    let allowButton = true;
    let sitePopup = false;

    if (companyCode && employeeNo) {
      try {
        const pool = await getCompanyPool(companyCode);

        // Check if the optional column exists to avoid runtime SQL errors/noise
        const existsRes = await pool.query(
          `SELECT EXISTS (
             SELECT 1 
             FROM information_schema.columns 
             WHERE table_schema IN ('public') 
               AND table_name = 'hr_employee' 
               AND column_name = 'x_site_popup'
           ) AS exists`);
        const hasColumn = !!existsRes?.rows?.[0]?.exists;

        if (hasColumn) {
          const result = await pool.query(
            `SELECT COALESCE(he."x_site_popup", FALSE) AS site_popup
             FROM hr_employee he
             WHERE LOWER(he."x_Emp_No") = LOWER($1)
               AND he.active = TRUE
             LIMIT 1`,
            [employeeNo]
          );
          if (result?.rows?.length > 0) {
            sitePopup = !!result.rows[0].site_popup;
          }
        } else {
          // Column not present in schema; keep safe default (false)
        }
      } catch (e) {
        // On any DB error, keep safe defaults
        console.error("/settings/clock-methods DB error:", e?.message || e);
      }
    }

    return res.json({
      success: true,
      data: {
        allowFace,
        allowButton,
        sitePopup,
      },
    });
  } catch (error) {
    console.error("/settings/clock-methods error:", error?.message || error);
    // Never break clients; respond with safe defaults
    return res.json({
      success: true,
      data: {
        allowFace: true,
        allowButton: true,
        sitePopup: false,
      },
    });
  }
});

// Get company name by company code
// GET /settings/company-name?companyCode=...
router.get("/company-name", async (req, res) => {
  try {
    const { companyCode } = req.query;

    console.log("[/company-name] Request received with companyCode:", companyCode);

    if (!companyCode) {
      console.log("[/company-name] No company code provided");
      return res.status(400).json({
        success: false,
        message: "Company code is required",
      });
    }

    console.log("[/company-name] Querying companies table for code:", companyCode);
    const result = await masterPool.query(
      `SELECT company_name FROM companies WHERE UPPER(TRIM(company_code)) = UPPER(TRIM($1)) AND active = true LIMIT 1`,
      [companyCode]
    );

    console.log("[/company-name] Query result:", result?.rows);

    if (result?.rows?.length > 0) {
      const companyName = result.rows[0].company_name;
      console.log("[/company-name] Found company name:", companyName);
      return res.json({
        success: true,
        data: {
          companyName: companyName,
        },
      });
    } else {
      console.log("[/company-name] No company found for code:", companyCode);
      return res.json({
        success: true,
        data: {
          companyName: "Company",
        },
      });
    }
  } catch (error) {
    console.error("[/company-name] Error:", error?.message || error);
    console.error("[/company-name] Full error:", error);
    return res.json({
      success: true,
      data: {
        companyName: "Company",
      },
    });
  }
});

export default router;
