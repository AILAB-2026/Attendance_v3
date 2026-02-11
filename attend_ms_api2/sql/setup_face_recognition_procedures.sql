-- =============================================
-- Setup Script: Face Recognition Stored Procedures
-- Description: Creates all required stored procedures for face recognition flow
-- Run this script to set up the database for face recognition functionality
-- =============================================

-- =============================================
-- 1. usp_sitelocation - Get all site locations
-- =============================================

CREATE OR REPLACE FUNCTION public.usp_sitelocation()
RETURNS TABLE (
    value VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        pp.site_location as value
    FROM 
        project_project pp
    WHERE 
        pp.site_location IS NOT NULL
        AND pp.site_location <> ''
    ORDER BY 
        pp.site_location;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usp_sitelocation() TO PUBLIC;

-- =============================================
-- 2. usp_projects_by_site - Get projects by site
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
    RETURN QUERY
    SELECT 
        pp.id as out_project_id,
        pp.name as out_project_name,
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
        (p_site_id IS NULL OR pp.site_location = p_site_id)
        AND pp.active = true
    ORDER BY 
        pp.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usp_projects_by_site(VARCHAR, INTEGER) TO PUBLIC;

-- =============================================
-- 3. udf_hr_employee_enroll_or_update_face - Enroll/Update face
-- =============================================

CREATE OR REPLACE FUNCTION public.udf_hr_employee_enroll_or_update_face(
    p_employee_id INTEGER,
    p_face_descriptor TEXT
)
RETURNS TABLE (
    status_code INTEGER,
    message VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_employee_exists BOOLEAN;
BEGIN
    -- Check if employee exists
    SELECT EXISTS(SELECT 1 FROM hr_employee WHERE id = p_employee_id) INTO v_employee_exists;
    
    IF NOT v_employee_exists THEN
        RETURN QUERY SELECT 1::INTEGER, 'Employee not found'::VARCHAR;
        RETURN;
    END IF;
    
    -- Update face descriptor
    UPDATE hr_employee
    SET l_face_descriptor = p_face_descriptor,
        write_date = NOW()
    WHERE id = p_employee_id;
    
    RETURN QUERY SELECT 0::INTEGER, 'Face enrolled successfully'::VARCHAR;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT 1::INTEGER, ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

GRANT EXECUTE ON FUNCTION public.udf_hr_employee_enroll_or_update_face(INTEGER, TEXT) TO PUBLIC;

-- =============================================
-- 4. udf_insert_employee_clocking - Clock In/Out
-- =============================================

CREATE OR REPLACE FUNCTION public.udf_insert_employee_clocking(
    p_nid INTEGER,
    p_create_uid INTEGER,
    p_write_uid INTEGER,
    p_employee_no VARCHAR,
    p_timestamp BIGINT,
    p_datetime TIMESTAMP,
    p_location VARCHAR,
    p_action INTEGER,
    p_lat NUMERIC,
    p_long NUMERIC,
    p_location_name VARCHAR,
    p_project_id INTEGER,
    p_site_id VARCHAR
)
RETURNS TABLE (
    message VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_employee_id INTEGER;
    v_clocking_id INTEGER;
    v_clocking_line_id INTEGER;
    v_message VARCHAR;
BEGIN
    SELECT id INTO v_employee_id
    FROM hr_employee
    WHERE employee_no = p_employee_no
    LIMIT 1;
    
    IF v_employee_id IS NULL THEN
        RETURN QUERY SELECT 'Employee not found'::VARCHAR;
        RETURN;
    END IF;
    
    IF p_action = 1 THEN
        SELECT ecl.id INTO v_clocking_line_id
        FROM employee_clocking_line ecl
        WHERE ecl.employee_id = v_employee_id
        AND ecl.project_id = p_project_id
        AND ecl.clock_out_date IS NULL
        LIMIT 1;
        
        IF v_clocking_line_id IS NOT NULL THEN
            RETURN QUERY SELECT 'You already have an open clock-in for this project. Please clock out first.'::VARCHAR;
            RETURN;
        END IF;
        
        SELECT id INTO v_clocking_id
        FROM employee_clocking
        WHERE employee_id = v_employee_id
        AND DATE(create_date) = CURRENT_DATE
        LIMIT 1;
        
        IF v_clocking_id IS NULL THEN
            INSERT INTO employee_clocking (
                employee_id, create_uid, write_uid, create_date, write_date
            ) VALUES (
                v_employee_id, p_create_uid, p_write_uid, p_datetime, p_datetime
            )
            RETURNING id INTO v_clocking_id;
        END IF;
        
        INSERT INTO employee_clocking_line (
            employee_clocking_id, employee_id, project_id, site_location,
            clock_in_date, clock_in, clock_in_location, in_lat, in_lan,
            create_uid, write_uid, create_date, write_date
        ) VALUES (
            v_clocking_id, v_employee_id, p_project_id, p_site_id,
            CURRENT_DATE, p_datetime::TIME, p_location_name, p_lat, p_long,
            p_create_uid, p_write_uid, p_datetime, p_datetime
        );
        
        v_message := 'Clock in successful at ' || TO_CHAR(p_datetime, 'HH24:MI:SS');
        
    ELSIF p_action = 2 THEN
        SELECT ecl.id INTO v_clocking_line_id
        FROM employee_clocking_line ecl
        WHERE ecl.employee_id = v_employee_id
        AND ecl.project_id = p_project_id
        AND ecl.clock_out_date IS NULL
        LIMIT 1;
        
        IF v_clocking_line_id IS NULL THEN
            RETURN QUERY SELECT 'No open clock-in found for this project. Please clock in first.'::VARCHAR;
            RETURN;
        END IF;
        
        UPDATE employee_clocking_line
        SET 
            clock_out_date = CURRENT_DATE,
            clock_out = p_datetime::TIME,
            clock_out_location = p_location_name,
            out_lat = p_lat,
            out_lan = p_long,
            write_uid = p_write_uid,
            write_date = p_datetime
        WHERE id = v_clocking_line_id;
        
        v_message := 'Clock out successful at ' || TO_CHAR(p_datetime, 'HH24:MI:SS');
        
    ELSE
        RETURN QUERY SELECT 'Invalid action. Use 1 for Clock In or 2 for Clock Out.'::VARCHAR;
        RETURN;
    END IF;
    
    RETURN QUERY SELECT v_message::VARCHAR;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT ('Error: ' || SQLERRM)::VARCHAR;
END;
$$;

GRANT EXECUTE ON FUNCTION public.udf_insert_employee_clocking(
    INTEGER, INTEGER, INTEGER, VARCHAR, BIGINT, TIMESTAMP, 
    VARCHAR, INTEGER, NUMERIC, NUMERIC, VARCHAR, INTEGER, VARCHAR
) TO PUBLIC;

-- =============================================
-- Verification Queries
-- =============================================

-- Test usp_sitelocation
-- SELECT * FROM usp_sitelocation();

-- Test usp_projects_by_site
-- SELECT * FROM usp_projects_by_site(NULL, NULL);

-- Test udf_hr_employee_enroll_or_update_face
-- SELECT * FROM udf_hr_employee_enroll_or_update_face(269, '[-0.088, 0.094, ...]');

-- Test udf_insert_employee_clocking (Clock In)
-- SELECT * FROM udf_insert_employee_clocking(1, 2, 2, 'EMP001', 1234567890000, NOW(), 'Office', 1, 1.3521, 103.8198, 'Office', 1, 'Site A');

-- =============================================
-- Setup Complete
-- =============================================

SELECT 'Face Recognition Stored Procedures Setup Complete!' as status;
