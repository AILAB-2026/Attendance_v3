import express from 'express';
import { getCompanyPool } from './multiCompanyDb.js';

const router = express.Router();

// SIMPLE: Get all sites from project_project table
router.get('/simple-sites', async (req, res) => {
  try {
    const companyCode = req.query.companyCode || req.headers['x-company-code'];
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required' });
    }

    console.log(`📍 GET /simple-sites - Fetching sites from project_project for ${companyCode}`);

    const pool = await getCompanyPool(companyCode);

    // Get all active projects from project_project
    const result = await pool.query(`
      SELECT 
        id,
        name,
        active
      FROM project_project
      WHERE active = true
      ORDER BY id
    `);

    console.log(`Found ${result.rows.length} active projects in database`);

    // Extract site names from the name field (which is JSONB)
    const sites = result.rows.map(row => {
      let siteName = 'Unknown';

      // The name field is JSONB type, so it's already an object
      if (row.name && typeof row.name === 'object') {
        siteName = row.name.en_US || row.name.en_us || 'Unknown';
      } else if (typeof row.name === 'string') {
        // Fallback: if it's a string, try to parse it
        try {
          const parsed = JSON.parse(row.name);
          siteName = parsed.en_US || parsed.en_us || row.name;
        } catch (e) {
          siteName = row.name;
        }
      }

      return {
        siteId: row.id,
        siteName: siteName.trim()
      };
    });

    // Filter out any "Unknown" sites
    const validSites = sites.filter(s => s.siteName !== 'Unknown');

    console.log(`✅ Returning ${validSites.length} valid sites`);

    res.json({
      success: true,
      message: `Found ${validSites.length} sites`,
      data: {
        sites: validSites
      }
    });

  } catch (error) {
    console.error('❌ Error fetching simple sites:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sites',
      error: error.message
    });
  }
});

// OPTIMIZED: Get all sites WITH their projects in a SINGLE call
// Sites come from site_location column, Projects come from name column
// When employeeNo is provided and employee has x_site_popup=true, filter by assignment
router.get('/simple-sites-with-projects', async (req, res) => {
  try {
    const companyCode = req.query.companyCode || req.headers['x-company-code'];
    const employeeNo = req.query.employeeNo;

    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required' });
    }

    console.log(`📍 GET /simple-sites-with-projects - Fetching sites with projects for ${companyCode}${employeeNo ? ` (employee: ${employeeNo})` : ''}`);

    const pool = await getCompanyPool(companyCode);

    // Check if we should filter by employee assignment
    let filterByEmployee = false;
    let employeeId = null;

    if (employeeNo) {
      const empQuery = `
        SELECT id, "x_site_popup"
        FROM hr_employee 
        WHERE "x_Emp_No" = $1 
          AND active = true
      `;
      const empResult = await pool.query(empQuery, [employeeNo]);

      if (empResult.rows.length > 0) {
        const employee = empResult.rows[0];
        if (employee.x_site_popup) {
          filterByEmployee = true;
          employeeId = employee.id;
          console.log(`🔒 Employee ${employeeNo} has x_site_popup=true. Filtering by assignment.`);
        }
      }
    }

    let result;

    if (filterByEmployee && employeeId) {
      // Fetch only assigned projects from project_employee_details
      result = await pool.query(`
        SELECT 
          pp.id,
          pp.name,
          COALESCE(ped.site_location, pp.site_location) as site_location,
          pp.active
        FROM project_employee_details ped
        JOIN project_project pp ON ped.project_id = pp.id
        WHERE ped.employee_id = $1
          AND pp.active = true
        ORDER BY site_location, pp.id
      `, [employeeId]);

      console.log(`Found ${result.rows.length} assigned projects for employee ${employeeNo}`);
    } else {
      // Get all active projects from project_project (original behavior)
      result = await pool.query(`
        SELECT 
          id,
          name,
          site_location,
          active
        FROM project_project
        WHERE active = true
        ORDER BY site_location, id
      `);

      console.log(`Found ${result.rows.length} active projects in database (no filtering)`);
    }

    // Build sites array and site-to-project mapping
    // site_location = Site Name
    // name (JSONB en_US) = Project Name
    const siteSet = new Set();
    const sites = [];
    const siteProjectMap = {};

    result.rows.forEach(row => {
      // Get site name from site_location column
      let siteName = row.site_location?.trim() || '';

      // Get project name from name column (JSONB)
      let projectName = 'Unknown';
      if (row.name && typeof row.name === 'object') {
        projectName = row.name.en_US || row.name.en_us || 'Unknown';
      } else if (typeof row.name === 'string') {
        try {
          const parsed = JSON.parse(row.name);
          projectName = parsed.en_US || parsed.en_us || row.name;
        } catch (e) {
          projectName = row.name;
        }
      }
      projectName = projectName.trim();

      // Only add unique sites (including empty site as a special case)
      const siteKey = siteName || '__NO_SITE__';
      if (!siteSet.has(siteKey)) {
        siteSet.add(siteKey);
        // Only add to sites array if there's an actual site name
        if (siteName) {
          sites.push({
            siteId: row.id,
            siteName: siteName
          });
        }
      }

      // Build site to projects mapping
      // For projects without a site, they will still be in the allProjects list below
      if (projectName !== 'Unknown') {
        if (siteName) {
          // Project has a site - add to site mapping
          if (!siteProjectMap[siteName]) {
            siteProjectMap[siteName] = [];
          }
          // Avoid duplicate projects under the same site
          if (!siteProjectMap[siteName].includes(projectName)) {
            siteProjectMap[siteName].push(projectName);
          }
        }
        // Also add ALL projects (with or without site) to a special "__ALL__" list
        // This ensures projects without a site are still visible
        if (!siteProjectMap['__ALL__']) {
          siteProjectMap['__ALL__'] = [];
        }
        if (!siteProjectMap['__ALL__'].includes(projectName)) {
          siteProjectMap['__ALL__'].push(projectName);
        }
      }
    });

    // Log details for debugging
    console.log(`✅ Returning ${sites.length} unique sites with project mappings${filterByEmployee ? ' (filtered by employee assignment)' : ''}`);
    console.log(`📦 Site count: ${sites.length}, Sites:`, sites.map(s => s.siteName));
    console.log(`📦 All projects (__ALL__):`, siteProjectMap['__ALL__'] || []);

    res.json({
      success: true,
      message: `Found ${sites.length} sites${filterByEmployee ? ' (filtered)' : ''}`,
      data: {
        sites: sites,
        siteProjectMap: siteProjectMap
      }
    });

  } catch (error) {
    console.error('❌ Error fetching sites with projects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sites with projects',
      error: error.message
    });
  }
});

// SIMPLE: Get projects for a specific site (same as site, since we're using project_project)
router.get('/simple-projects/:siteId', async (req, res) => {
  try {
    const { siteId } = req.params;
    const companyCode = req.query.companyCode || req.headers['x-company-code'];
    if (!companyCode) {
      return res.status(400).json({ success: false, message: 'companyCode is required' });
    }

    console.log(`📍 GET /simple-projects/${siteId} for ${companyCode}`);

    const pool = await getCompanyPool(companyCode);

    // For now, just return the same site as a project
    const result = await pool.query(`
      SELECT 
        id,
        name,
        active
      FROM project_project
      WHERE active = true AND id = $1
    `, [siteId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        message: 'No projects found for this site',
        data: { projects: [] }
      });
    }

    const row = result.rows[0];
    let projectName = 'Unknown';

    if (row.name && typeof row.name === 'object') {
      projectName = row.name.en_US || row.name.en_us || 'Unknown';
    }

    const projects = [{
      projectId: row.id,
      projectName: projectName.trim(),
      isOpen: true,
      siteId: row.id,
      siteName: projectName.trim()
    }];

    console.log(`✅ Returning ${projects.length} project(s)`);

    res.json({
      success: true,
      data: {
        siteId: siteId,
        projects: projects
      }
    });

  } catch (error) {
    console.error('❌ Error fetching simple projects:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch projects',
      error: error.message
    });
  }
});

export default router;
