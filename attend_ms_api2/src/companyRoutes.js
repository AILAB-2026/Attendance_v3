import express from "express";
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();

// Master DB pool for companies table
const masterPool = new Pool({
  host: process.env.MASTER_DB_HOST || process.env.DB_HOST || "localhost",
  port: Number(process.env.MASTER_DB_PORT || process.env.DB_PORT || 5432),
  user: process.env.MASTER_DB_USER || process.env.DB_USER || "postgres",
  password: process.env.MASTER_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.MASTER_DB_NAME || "attendance_db",
});

// Get company logo image by company code
router.get("/logo/:companyCode", async (req, res) => {
  try {
    const { companyCode } = req.params;

    if (!companyCode) {
      return res.status(400).json({
        success: false,
        message: "Company code is required"
      });
    }

    const result = await masterPool.query(
      `SELECT logo_image, logo_mime_type
       FROM companies
       WHERE UPPER(TRIM(company_code)) = UPPER(TRIM($1))
         AND logo_image IS NOT NULL`,
      [companyCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Company logo not found"
      });
    }

    const company = result.rows[0];
    const mimeType = company.logo_mime_type || 'image/png';

    // Set appropriate headers for image response
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Send the binary image data
    res.send(company.logo_image);

  } catch (error) {
    console.error("❌ Get company logo error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company logo",
      error: error.message
    });
  }
});

// Get company information by company code
router.get("/info", async (req, res) => {
  try {
    const { companyCode } = req.query;

    if (!companyCode) {
      return res.status(400).json({
        success: false,
        message: "Company code is required"
      });
    }

    const result = await masterPool.query(
      `SELECT 
        company_code,
        company_name,
        active,
        payroll_enable,
        CASE WHEN logo_image IS NOT NULL THEN true ELSE false END as has_logo
       FROM companies
       WHERE UPPER(TRIM(company_code)) = UPPER(TRIM($1))`,
      [companyCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    const company = result.rows[0];

    res.json({
      success: true,
      data: {
        companyCode: company.company_code,
        companyName: company.company_name,
        active: company.active,
        payrollEnable: company.payroll_enable,
        hasLogo: company.has_logo
      }
    });

  } catch (error) {
    console.error("❌ Get company info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company information",
      error: error.message
    });
  }
});

export default router;
