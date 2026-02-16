-- =============================================
-- Stored Procedure: usp_projects_by_site
-- Description: Returns projects for a specific site location and employee
-- Parameters:
--   p_site_id: Site location name (can be NULL to get all projects)
--   p_employee_id: Employee ID (used for filtering projects employee has access to)
-- Used by: Mobile app face recognition flow
-- =============================================

CREATE OR REPLACE FUNCTION public.usp_projects_by_site(
    p_site_id VARCHAR DEFAULT NULL,
    p_employee_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    out_project_id INTEGER,
    out_project_name VARCHAR,
    out_is_open BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Return projects based on site location
    -- Also check if employee has an open clocking for each project
    RETURN QUERY
    SELECT 
        pp.id as out_project_id,
        pp.name as out_project_name,
        -- Check if employee has an open clocking (clock_out is NULL) for this project
        CASE 
            WHEN EXISTS (
                SELECT 1 
                FROM employee_clocking_line ecl
                WHERE ecl.project_id = pp.id
                AND ecl.employee_id = p_employee_id
                AND ecl.clock_out_date IS NULL
            ) THEN true
            ELSE false
        END as out_is_open
    FROM 
        project_project pp
    WHERE 
        -- Filter by site location if provided
        (p_site_id IS NULL OR pp.site_location = p_site_id)
        -- Only active projects
        AND pp.active = true
    ORDER BY 
        pp.name;
    
    -- Alternative: If you need to filter by employee permissions/assignments:
    -- RETURN QUERY
    -- SELECT 
    --     pp.id as out_project_id,
    --     pp.name as out_project_name,
    --     CASE 
    --         WHEN EXISTS (
    --             SELECT 1 
    --             FROM employee_clocking_line ecl
    --             WHERE ecl.project_id = pp.id
    --             AND ecl.employee_id = p_employee_id
    --             AND ecl.clock_out_date IS NULL
    --         ) THEN true
    --         ELSE false
    --     END as out_is_open
    -- FROM 
    --     project_project pp
    -- INNER JOIN 
    --     project_employee_rel per ON pp.id = per.project_id
    -- WHERE 
    --     (p_site_id IS NULL OR pp.site_location = p_site_id)
    --     AND per.employee_id = p_employee_id
    --     AND pp.active = true
    -- ORDER BY 
    --     pp.name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.usp_projects_by_site(VARCHAR, INTEGER) TO PUBLIC;

-- Test the function
-- Get all projects for all sites:
-- SELECT * FROM usp_projects_by_site(NULL, NULL);

-- Get projects for specific site:
-- SELECT * FROM usp_projects_by_site('Site A', NULL);

-- Get projects for specific site and employee:
-- SELECT * FROM usp_projects_by_site('Site A', 269);
