-- =============================================
-- Stored Procedure: udf_insert_employee_clocking
-- Description: Handles clock in/out for employees with face recognition
-- Parameters:
--   p_nid: Employee NID
--   p_create_uid: User ID who created the record
--   p_write_uid: User ID who last modified the record
--   p_employee_no: Employee number
--   p_timestamp: Current timestamp (epoch milliseconds)
--   p_datetime: Current datetime
--   p_location: Location name
--   p_action: 1 = Clock In, 2 = Clock Out
--   p_lat: Latitude
--   p_long: Longitude
--   p_location_name: Location name (duplicate of p_location)
--   p_project_id: Project ID
--   p_site_id: Site location name
-- Returns: Message indicating success or failure
-- =============================================

CREATE OR REPLACE FUNCTION public.udf_insert_employee_clocking(
    p_nid INTEGER,
    p_create_uid INTEGER,
    p_write_uid INTEGER,
    p_employee_no VARCHAR,
    p_timestamp BIGINT,
    p_datetime TIMESTAMP,
    p_location VARCHAR,
    p_action INTEGER,  -- 1 = Clock In, 2 = Clock Out
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
    -- Get employee ID from hr_employee using employee number
    SELECT id INTO v_employee_id
    FROM hr_employee
    WHERE employee_no = p_employee_no
    LIMIT 1;
    
    IF v_employee_id IS NULL THEN
        RETURN QUERY SELECT 'Employee not found'::VARCHAR;
        RETURN;
    END IF;
    
    -- CLOCK IN
    IF p_action = 1 THEN
        -- Check if employee already has an open clocking for this project
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
        
        -- Create employee_clocking record (if not exists for today)
        SELECT id INTO v_clocking_id
        FROM employee_clocking
        WHERE employee_id = v_employee_id
        AND DATE(create_date) = CURRENT_DATE
        LIMIT 1;
        
        IF v_clocking_id IS NULL THEN
            INSERT INTO employee_clocking (
                employee_id,
                create_uid,
                write_uid,
                create_date,
                write_date
            ) VALUES (
                v_employee_id,
                p_create_uid,
                p_write_uid,
                p_datetime,
                p_datetime
            )
            RETURNING id INTO v_clocking_id;
        END IF;
        
        -- Create employee_clocking_line record for clock in
        INSERT INTO employee_clocking_line (
            employee_clocking_id,
            employee_id,
            project_id,
            site_location,
            clock_in_date,
            clock_in,
            clock_in_location,
            in_lat,
            in_lan,
            create_uid,
            write_uid,
            create_date,
            write_date
        ) VALUES (
            v_clocking_id,
            v_employee_id,
            p_project_id,
            p_site_id,
            CURRENT_DATE,
            p_datetime::TIME,
            p_location_name,
            p_lat,
            p_long,
            p_create_uid,
            p_write_uid,
            p_datetime,
            p_datetime
        );
        
        v_message := 'Clock in successful at ' || TO_CHAR(p_datetime, 'HH24:MI:SS');
        
    -- CLOCK OUT
    ELSIF p_action = 2 THEN
        -- Find the open clocking line for this employee and project
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
        
        -- Update the clocking line with clock out information
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.udf_insert_employee_clocking(
    INTEGER, INTEGER, INTEGER, VARCHAR, BIGINT, TIMESTAMP, 
    VARCHAR, INTEGER, NUMERIC, NUMERIC, VARCHAR, INTEGER, VARCHAR
) TO PUBLIC;

-- Test the function
-- Clock In:
-- SELECT * FROM udf_insert_employee_clocking(
--     1, 2, 2, 'EMP001', 1234567890000, NOW(), 
--     'Office Location', 1, 1.3521, 103.8198, 
--     'Office Location', 1, 'Site A'
-- );

-- Clock Out:
-- SELECT * FROM udf_insert_employee_clocking(
--     1, 2, 2, 'EMP001', 1234567890000, NOW(), 
--     'Office Location', 2, 1.3521, 103.8198, 
--     'Office Location', 1, 'Site A'
-- );
