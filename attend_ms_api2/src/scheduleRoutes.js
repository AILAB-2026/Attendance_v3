import express from "express";
import { getCompanyPool } from "./multiCompanyDb.js";
const router = express.Router();

// Get assigned schedule (sites and projects) for an employee
router.get("/assigned", async (req, res) => {
  try {
    const { companyCode, employeeNo, date } = req.query;

    if (!companyCode || !employeeNo) {
      return res.status(400).json({
        success: false,
        message: "Company code and employee number are required"
      });
    }

    const pool = await getCompanyPool(companyCode);

    // Get employee settings and ID
    const empQuery = `
      SELECT id, "x_site_popup"
      FROM hr_employee 
      WHERE "x_Emp_No" = $1 
        AND active = true
    `;

    const empResult = await pool.query(empQuery, [employeeNo]);

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    const employee = empResult.rows[0];
    const useAssignedOnly = !!employee.x_site_popup;
    const schedule = [];

    if (useAssignedOnly) {
      console.log(`🔒 Employee ${employeeNo} has x_site_popup=true. Fetching assigned projects only.`);

      // Fetch assigned projects from project_employee_details
      // We join with project_project to get the project name
      const query = `
        SELECT 
          ped.project_id,
          pp.name->>'en_US' as project_name,
          ped.site_location as site_name
        FROM project_employee_details ped
        JOIN project_project pp ON ped.project_id = pp.id
        WHERE ped.employee_id = $1
          AND pp.active = true
      `;

      const result = await pool.query(query, [employee.id]);

      for (const row of result.rows) {
        schedule.push({
          id: `${row.project_id}`,
          siteName: row.site_name || row.project_name,
          projectName: row.project_name,
          projectId: row.project_id,
          isOpen: true,
          startDate: date || new Date().toISOString().split('T')[0],
          endDate: null
        });
      }

    } else {
      // Existing behavior: Fetch all active projects
      const projectsQuery = `
        SELECT DISTINCT
          pp.id as project_id,
          pp.name->>'en_US' as project_name,
          pp.active
        FROM project_project pp
        WHERE pp.active = true
        ORDER BY pp.name->>'en_US'
      `;
      const projectsResult = await pool.query(projectsQuery, []);

      for (const project of projectsResult.rows) {
        schedule.push({
          id: `${project.project_id}`,
          siteName: project.project_name,
          projectName: project.project_name,
          projectId: project.project_id,
          isOpen: true,
          startDate: date || new Date().toISOString().split('T')[0],
          endDate: null
        });
      }
    }

    res.json({
      success: true,
      data: schedule
    });

  } catch (error) {
    console.error("Error fetching assigned schedule:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching assigned schedule",
      error: error.message
    });
  }
});

// Get project tasks for a specific project
router.get("/project-tasks", async (req, res) => {
  try {
    const { companyCode, projectName, employeeNo } = req.query;

    if (!projectName) {
      return res.status(400).json({
        success: false,
        message: "Project name is required"
      });
    }

    console.log(`📋 Fetching tasks for project: ${projectName}`);

    const pool = await getCompanyPool(companyCode);

    // First, get the project ID from project name
    const projectQuery = `
      SELECT id 
      FROM project_project 
      WHERE name->>'en_US' = $1 
        AND active = true
      LIMIT 1
    `;

    const projectResult = await pool.query(projectQuery, [projectName]);

    if (projectResult.rows.length === 0) {
      console.log(`⚠️ Project "${projectName}" not found`);
      return res.json({
        success: true,
        data: []
      });
    }

    const projectId = projectResult.rows[0].id;
    console.log(`✅ Found project ID: ${projectId}`);

    // Determine if we should filter by assigned user
    let filterByUser = false;
    let userId = null;

    if (employeeNo) {
      const empQuery = `SELECT "x_site_popup", "user_id" FROM hr_employee WHERE "x_Emp_No" = $1`;
      const empRes = await pool.query(empQuery, [employeeNo]);
      if (empRes.rows.length > 0) {
        if (empRes.rows[0].x_site_popup) {
          filterByUser = true;
          userId = empRes.rows[0].user_id;
          console.log(`🔒 Filtering tasks for user_id: ${userId}`);
        }
      }
    }

    let tasksQuery;
    let params;

    if (filterByUser && userId) {
      // Filter tasks assigned to this user via project_task_user_rel
      tasksQuery = `
        SELECT 
          t.id,
          t.name,
          t.project_id,
          t.description,
          t.date_deadline,
          t.active
        FROM project_task t
        JOIN project_task_user_rel r ON t.id = r.task_id
        WHERE t.project_id = $1::integer
          AND t.active = true
          AND r.user_id = $2
        ORDER BY t.date_deadline ASC NULLS LAST, t.name ASC
      `;
      params = [projectId, userId];
    } else {
      // Show all tasks for project
      tasksQuery = `
        SELECT 
          id,
          name,
          project_id,
          description,
          date_deadline,
          active
        FROM project_task
        WHERE project_id = $1::integer
          AND active = true
        ORDER BY date_deadline ASC NULLS LAST, name ASC
      `;
      params = [projectId];
    }

    const tasksResult = await pool.query(tasksQuery, params);

    console.log(`✅ Found ${tasksResult.rows.length} tasks for project ${projectName} (Filtered: ${filterByUser})`);

    const tasks = tasksResult.rows.map(task => ({
      id: task.id.toString(),
      name: task.name,
      status: 'active'
    }));

    res.json({
      success: true,
      data: tasks
    });

  } catch (error) {
    console.error("❌ Error fetching project tasks:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching project tasks",
      error: error.message
    });
  }
});

export default router;
