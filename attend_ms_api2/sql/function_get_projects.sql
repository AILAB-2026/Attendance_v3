-- DROP FUNCTION public.get_projects(text);

CREATE OR REPLACE FUNCTION public.get_projects(p_customer_id text)
 RETURNS TABLE(project_id text, customer_id text, is_open boolean)
 LANGUAGE sql
AS $function$
    SELECT 
        projects.project_id,
        projects.customer_id,
        (open_activity_count IS NOT NULL) AS is_open
    FROM 
        attendance_projects projects
    LEFT JOIN (
        SELECT 
            project_id, 
            COUNT(*) AS open_activity_count
        FROM 
            attendance_activities
        WHERE 
            end_time IS NULL
        GROUP BY 
            project_id 
    ) open_activity ON projects.project_id = open_activity.project_id
    WHERE 
        projects.customer_id = p_customer_id;
$function$
;
