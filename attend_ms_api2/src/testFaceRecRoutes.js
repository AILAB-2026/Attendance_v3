import express from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";

const router = express.Router();

// Minimal test version of sites-projects endpoint
router.get("/sites-projects", async (req, res) => {
  try {
    console.log("🔍 TEST: Face recognition sites-projects endpoint called");
    
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      console.log("❌ TEST: No token provided");
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    console.log("✅ TEST: Token found, verifying...");
    const decoded = jwt.verify(userToken, SECRET_KEY);
    const employeeId = decoded.employeeId;
    console.log("✅ TEST: Token verified, employeeId:", employeeId);
    
    // Get sites from database using safe query
    console.log("✅ TEST: Fetching sites from database...");
    
    let assignedSites = [];
    let hasAssignments = false;

    try {
      // Get all available sites using safe JSON extraction
      const allSitesResult = await query(`
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
      `);
      
      console.log(`✅ TEST: Database query returned ${allSitesResult.rows.length} rows`);
      
      if (allSitesResult.rows.length > 0) {
        assignedSites = allSitesResult.rows
          .filter(site => site.site_name && site.site_name !== 'Unknown Site')
          .map(site => ({
            siteId: site.site_id,
            siteName: site.site_name,
            address: null,
            city: null
          }));
        console.log(`✅ TEST: Processed ${assignedSites.length} valid sites`);
      }
    } catch (dbError) {
      console.log("❌ TEST: Database query failed:", dbError.message);
      // Fallback to hardcoded sites
      assignedSites = [
        { siteId: 1, siteName: "Main Office", address: null, city: null },
        { siteId: 2, siteName: "Branch Office", address: null, city: null },
        { siteId: 3, siteName: "Remote Work", address: null, city: null }
      ];
    }

    const response = {
      success: true,
      message: hasAssignments ? "Employee site assignments found" : "No specific site assignments, showing all available sites",
      data: {
        employeeId: employeeId,
        hasSpecificAssignments: hasAssignments,
        sites: assignedSites,
        defaultSite: assignedSites.length > 0 ? assignedSites[0] : null
      }
    };

    console.log(`✅ TEST: Returning ${assignedSites.length} sites`);
    res.json(response);

  } catch (error) {
    console.error("❌ TEST: Error in test endpoint:", error);
    console.error("❌ TEST: Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Test endpoint error",
      error: error.message 
    });
  }
});

// Get projects by site ID for face recognition
router.get("/projects/:siteId", async (req, res) => {
  try {
    console.log("🔍 TEST: Face recognition projects endpoint called");
    
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      console.log("❌ TEST: No token provided");
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const decoded = jwt.verify(userToken, SECRET_KEY);
    const employeeId = decoded.employeeId;
    const siteId = req.params.siteId;
    
    console.log(`✅ TEST: Fetching projects for site ${siteId} and employee ${employeeId}`);

    try {
      // Get projects for specific site from project_project table
      const projectsResult = await query(`
        SELECT 
          p.id,
          CASE 
            WHEN p.name::text ~ '^\\{' THEN 
              CASE 
                WHEN p.name::text ~ '"en_US"' THEN 
                  substring(p.name::text from '"en_US"\\s*:\\s*"([^"]*)"')
                ELSE 'Unknown Project'
              END
            ELSE p.name::text
          END as name,
          p.active,
          p.partner_id,
          partner.name as partner_name
        FROM project_project p
        LEFT JOIN res_partner partner ON p.partner_id = partner.id
        WHERE p.active = true 
          AND p.partner_id = $1::integer
        ORDER BY 1
      `, [siteId]);
      
      const projects = projectsResult.rows.map(project => ({
        projectId: project.id,
        projectName: project.name,
        isOpen: project.active,
        siteId: project.partner_id,
        siteName: project.partner_name
      }));

      console.log(`✅ TEST: Found ${projects.length} projects for site ${siteId}`);

      res.json({
        success: true,
        message: `Found ${projects.length} projects for site ${siteId}`,
        data: {
          siteId: siteId,
          projects: projects
        }
      });

    } catch (error) {
      console.log("❌ TEST: Error fetching projects for site:", error.message);
      
      // Final fallback: return default projects for the site
      const defaultProjects = [
        { projectId: 1, projectName: "General Work", isOpen: true, siteId: siteId },
        { projectId: 2, projectName: "Site Maintenance", isOpen: true, siteId: siteId },
        { projectId: 3, projectName: "Administrative Tasks", isOpen: true, siteId: siteId }
      ];

      res.json({
        success: true,
        message: "Using default projects for site",
        data: {
          siteId: siteId,
          projects: defaultProjects
        }
      });
    }

  } catch (error) {
    console.error("❌ TEST: Error in projects by site:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

export default router;
