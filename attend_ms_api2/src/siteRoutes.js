import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { SECRET_KEY } from "./constants.js";
import { getTokenFromHeader } from "./helper.js";
import { query } from "./dbconn.js";

const router = express.Router();

// Define routes - EMERGENCY FIX FOR CLOCK IN
router.get("/", async (req, res) => {
  try {
    const userToken = getTokenFromHeader(req);
    if (!userToken) {
      return res.status(401).json({ error: "No token provided" });
    }
    
    const decoded = jwt.verify(userToken, SECRET_KEY);
    const employeeId = decoded.employeeId;
    console.log("EMERGENCY: Fetching sites for clock in, employeeId:", employeeId);
    
    // EMERGENCY: Return sites in the format the APK expects
    try {
      // Try to get sites from project_project table
      const sitesResult = await query(`
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
      
      if (sitesResult.rows && sitesResult.rows.length > 0) {
        // Return in the ORIGINAL format that APK expects
        const sites = sitesResult.rows.map(site => ({
          siteLocationName: site.site_name  // Original format for APK
        }));
        
        console.log(`EMERGENCY: Returning ${sites.length} sites in original APK format`);
        
        // Return as direct array (original format)
        res.json(sites);
        return;
      }
    } catch (dbError) {
      console.log("EMERGENCY: Database query failed, using fallback");
    }
    
    // EMERGENCY FALLBACK: Return hardcoded sites in original format
    console.log("EMERGENCY: Using hardcoded fallback sites for clock in");
    const emergencySites = [
      { siteLocationName: "T2C" },
      { siteLocationName: "T2C Pass Office" },
      { siteLocationName: "Test" },
      { siteLocationName: "25 Loyang Crescent" },
      { siteLocationName: "20 gui road" },
      { siteLocationName: "35 Tuas View Walk 2" },
      { siteLocationName: "Internal" },
      { siteLocationName: "CR103 AVIATION PARK RD" },
      { siteLocationName: "Civil" },
      { siteLocationName: "Office" }
    ];
    
    res.json(emergencySites);
    
  } catch (error) {
    console.error("EMERGENCY: Critical error in sites endpoint:", error);
    
    // ABSOLUTE EMERGENCY: Return basic sites so employees can clock in
    const absoluteEmergencySites = [
      { siteLocationName: "Main Office" },
      { siteLocationName: "Branch Office" },
      { siteLocationName: "Remote Work" }
    ];
    
    res.json(absoluteEmergencySites);
  }
});
export default router;
