import express from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";

const router = express.Router();

// Get sites and projects for face recognition dropdown
router.get("/sites-projects", async (req, res) => {
  try {
    console.log("🔍 Face recognition sites-projects endpoint called");
    
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      console.log("❌ No token provided");
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    console.log("✅ Token found, verifying...");
    const decoded = jwt.verify(userToken, SECRET_KEY);
    const employeeId = decoded.employeeId;
    console.log("✅ Token verified, employeeId:", employeeId);
    
    console.log(`Fetching sites for employee ID: ${employeeId}`);

    // Get sites for the employee
    let assignedSites = [];
    let hasAssignments = false;

    try {
      console.log(`Checking for employee-specific sites for employee ${employeeId}`);
      
      // First, check if this employee has specific site assignments
      // Use project names as sites since partner_id might be null
      const employeeSitesResult = await query(`
        SELECT DISTINCT 
          p.id as site_id,
          CASE 
            WHEN p.name::text ~ '^\\{' THEN 
              CASE 
                WHEN p.name::text ~ '"en_US"' THEN 
                  substring(p.name::text from '"en_US"[[:space:]]*:[[:space:]]*"([^"]*)"')
                ELSE 'Unknown Site'
              END
            ELSE p.name::text
          END as site_name
        FROM project_project p
        WHERE p.active = true 
          AND p.user_id = $1
        ORDER BY 1
      `, [employeeId]);
      
      console.log(`Employee-specific query returned ${employeeSitesResult.rows.length} rows`);
      
      if (employeeSitesResult.rows.length > 0) {
        // Employee has specific site assignments
        assignedSites = employeeSitesResult.rows.map(site => ({
          siteId: site.site_id,
          siteName: site.site_name || 'Unknown Site',
          address: null,
          city: null
        }));
        hasAssignments = true;
        console.log(`Found ${assignedSites.length} assigned sites for employee ${employeeId}`);
      } else {
        console.log(`No employee-specific sites found, checking all available sites`);
        
        // No specific assignments, get all available sites (use project names as sites)
        const allSitesResult = await query(`
          SELECT DISTINCT 
            p.id as site_id,
            CASE 
              WHEN p.name::text ~ '^\\{' THEN 
                CASE 
                  WHEN p.name::text ~ '"en_US"' THEN 
                    substring(p.name::text from '"en_US"[[:space:]]*:[[:space:]]*"([^"]*)"')
                  ELSE 'Unknown Site'
                END
              ELSE p.name::text
            END as site_name
          FROM project_project p
          WHERE p.active = true 
          ORDER BY 1
        `);
        
        console.log(`All sites query returned ${allSitesResult.rows.length} rows`);
        
        if (allSitesResult.rows.length > 0) {
          assignedSites = allSitesResult.rows.map(site => ({
            siteId: site.site_id,
            siteName: site.site_name || 'Unknown Site',
            address: null,
            city: null
          }));
          console.log(`No specific assignments, showing all ${assignedSites.length} available sites`);
          console.log(`Sample sites:`, assignedSites.slice(0, 3));
        } else {
          console.log(`No sites found in project_project table`);
        }
      }
    } catch (error) {
      console.log("Error fetching sites from project_project:", error.message);
      
      // Fallback: Create default sites
      assignedSites = [
        { siteId: 1, siteName: "Main Office" },
        { siteId: 2, siteName: "Branch Office" },
        { siteId: 3, siteName: "Remote Location" }
      ];
      console.log("Using fallback sites");
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

    console.log(`Returning ${assignedSites.length} sites`);
    res.json(response);

  } catch (error) {
    console.error("❌ Error fetching sites:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

// Get projects by site ID for face recognition
router.get("/projects/:siteId", async (req, res) => {
  try {
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided" 
      });
    }

    const decoded = jwt.verify(userToken, SECRET_KEY);
    const employeeId = decoded.employeeId;
    const siteId = req.params.siteId;
    
    console.log(`Fetching projects for site ${siteId} and employee ${employeeId}`);

    try {
      // Get projects for specific site from project_project table
      const projectsResult = await query(`
        SELECT 
          p.id,
          CASE 
            WHEN p.name::text ~ '^\\{' THEN 
              CASE 
                WHEN p.name::text ~ '"en_US"' THEN 
                  substring(p.name::text from '"en_US"[[:space:]]*:[[:space:]]*"([^"]*)"')
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

      res.json({
        success: true,
        message: `Found ${projects.length} projects for site ${siteId}`,
        data: {
          siteId: siteId,
          projects: projects
        }
      });

    } catch (error) {
      console.log("Error fetching projects for site:", error.message);
      
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
    console.error("Error in projects by site:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: error.message 
    });
  }
});

export default router;
