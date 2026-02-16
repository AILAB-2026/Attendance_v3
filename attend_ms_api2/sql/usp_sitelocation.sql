-- =============================================
-- Stored Procedure: usp_sitelocation
-- Description: Returns list of all site locations
-- Used by: Mobile app face recognition flow
-- =============================================

CREATE OR REPLACE FUNCTION public.usp_sitelocation()
RETURNS TABLE (
    value VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Return distinct site locations from project_project table
    -- Adjust the table and column names based on your actual database schema
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
    
    -- Alternative: If you have a separate site_location table:
    -- RETURN QUERY
    -- SELECT 
    --     sl.name as value
    -- FROM 
    --     site_location sl
    -- WHERE 
    --     sl.active = true
    -- ORDER BY 
    --     sl.name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.usp_sitelocation() TO PUBLIC;

-- Test the function
-- SELECT * FROM usp_sitelocation();
