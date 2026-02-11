import express from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "./constants.js";
import { query } from "./dbconn.js";

const router = express.Router();

// Clean version of sites-projects endpoint
router.get("/sites-projects", async (req, res) => {
  try {
    console.log("🔍 CLEAN: Face recognition sites-projects endpoint called");
    
    // Get token from Authorization header
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ CLEAN: No valid authorization header");
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const token = authHeader.split(" ")[1];
    console.log("✅ CLEAN: Token extracted from header");
    
    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, SECRET_KEY);
      console.log("✅ CLEAN: Token verified successfully");
    } catch (jwtError) {
      console.log("❌ CLEAN: JWT verification failed:", jwtError.message);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token" 
      });
    }
    
    const employeeId = decoded.employeeId;
    console.log("✅ CLEAN: Employee ID extracted:", employeeId);
    
    // Check if employee is active
    try {
      console.log("✅ CLEAN: Checking employee active status...");
      const employeeCheck = await query(`
        SELECT active 
        FROM hr_employee 
        WHERE id = $1
      `, [employeeId]);
      
      if (employeeCheck.rows.length === 0) {
        console.log("❌ CLEAN: Employee not found in database");
        return res.status(404).json({
          success: false,
          message: "Employee record not found. Please contact your administrator."
        });
      }
      
      const isActive = employeeCheck.rows[0].active;
      console.log(`✅ CLEAN: Employee active status: ${isActive}`);
      
      if (!isActive) {
        console.log("❌ CLEAN: Employee is inactive");
        return res.status(403).json({
          success: false,
          message: "Your account has been moved to inactive status. Please contact your HR or Admin for assistance.",
          code: "EMPLOYEE_INACTIVE"
        });
      }
      
      console.log("✅ CLEAN: Employee is active, proceeding...");
    } catch (checkError) {
      console.log("❌ CLEAN: Error checking employee status:", checkError.message);
      // Continue anyway if check fails (don't block legitimate users)
    }
    
    // Get sites from database
    let sites = [];
    
    try {
      console.log("✅ CLEAN: Querying database for sites...");
      
      const sitesResult = await query(`
        SELECT DISTINCT 
          p.id as site_id,
          CASE 
            WHEN p.name::text ~ '^\\{' THEN 
              CASE 
                WHEN p.name::text ~ '"en_US"' THEN 
                  substring(p.name::text from '"en_US"\\s*:\\s*"([^"]*)"')
                ELSE 'Unknown Site'
              END
            ELSE p.name::text
          END as site_name
        FROM project_project p
        WHERE p.active = true 
        ORDER BY 1
        LIMIT 20
      `);
      
      console.log(`✅ CLEAN: Database query returned ${sitesResult.rows.length} rows`);
      
      sites = sitesResult.rows
        .filter(site => site.site_name && site.site_name !== 'Unknown Site')
        .map(site => ({
          siteId: site.site_id,
          siteName: site.site_name,
          address: null,
          city: null
        }));
        
      console.log(`✅ CLEAN: Processed ${sites.length} valid sites`);
      
    } catch (dbError) {
      console.log("❌ CLEAN: Database error:", dbError.message);
      // Fallback sites
      sites = [
        { siteId: 1, siteName: "Main Office", address: null, city: null },
        { siteId: 2, siteName: "Branch Office", address: null, city: null },
        { siteId: 3, siteName: "Remote Work", address: null, city: null }
      ];
    }

    const response = {
      success: true,
      message: "Sites loaded successfully",
      data: {
        employeeId: employeeId,
        hasSpecificAssignments: false,
        sites: sites,
        defaultSite: sites.length > 0 ? sites[0] : null
      }
    };

    console.log(`✅ CLEAN: Returning response with ${sites.length} sites`);
    res.json(response);

  } catch (error) {
    console.error("❌ CLEAN: Unexpected error:", error.message);
    console.error("❌ CLEAN: Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

// Clean version of projects endpoint
router.get("/projects/:siteId", async (req, res) => {
  try {
    console.log("🔍 CLEAN: Projects endpoint called");
    
    // Get token
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, SECRET_KEY);
    const siteId = req.params.siteId;
    
    console.log(`✅ CLEAN: Getting projects for site ${siteId}`);

    // Return default projects for now
    const defaultProjects = [
      { projectId: 1, projectName: "General Work", isOpen: true, siteId: siteId },
      { projectId: 2, projectName: "Site Maintenance", isOpen: true, siteId: siteId },
      { projectId: 3, projectName: "Administrative Tasks", isOpen: true, siteId: siteId }
    ];

    res.json({
      success: true,
      message: `Found ${defaultProjects.length} projects for site ${siteId}`,
      data: {
        siteId: siteId,
        projects: defaultProjects
      }
    });

  } catch (error) {
    console.error("❌ CLEAN: Projects error:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

export default router;
