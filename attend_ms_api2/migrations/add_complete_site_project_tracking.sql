-- ============================================================================
-- COMPLETE SITE/PROJECT TRACKING MIGRATION
-- Adds both IDs and TEXT NAMES for clock-in and clock-out
-- ============================================================================
-- Purpose: Store both foreign key IDs AND text names for data integrity
-- Date: 2026-01-09
-- ============================================================================

-- ============================================================================
-- PART 1: CLOCK-IN COLUMNS (Site & Project)
-- ============================================================================

-- Add site_id (foreign key)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS site_id INTEGER;

-- Add site_name (text field for data integrity)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);

-- Add project_name (text field - project_id already exists)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);

-- ============================================================================
-- PART 2: CLOCK-OUT COLUMNS (Site & Project)
-- ============================================================================

-- Add clock_out_site_id (foreign key)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_out_site_id INTEGER;

-- Add clock_out_site_name (text field)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_out_site_name VARCHAR(255);

-- Add clock_out_project_id (foreign key)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_out_project_id INTEGER;

-- Add clock_out_project_name (text field)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_out_project_name VARCHAR(255);

-- ============================================================================
-- PART 3: FOREIGN KEY CONSTRAINTS
-- ============================================================================

-- Clock-IN constraints
ALTER TABLE employee_clocking_line 
ADD CONSTRAINT IF NOT EXISTS fk_employee_clocking_line_site 
FOREIGN KEY (site_id) REFERENCES project_project(id) 
ON DELETE SET NULL;

-- Clock-OUT constraints
ALTER TABLE employee_clocking_line 
ADD CONSTRAINT IF NOT EXISTS fk_employee_clocking_line_clock_out_site 
FOREIGN KEY (clock_out_site_id) REFERENCES project_project(id) 
ON DELETE SET NULL;

ALTER TABLE employee_clocking_line 
ADD CONSTRAINT IF NOT EXISTS fk_employee_clocking_line_clock_out_project 
FOREIGN KEY (clock_out_project_id) REFERENCES project_project(id) 
ON DELETE SET NULL;

-- ============================================================================
-- PART 4: PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_site_id 
ON employee_clocking_line(site_id);

CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_clock_out_site_id 
ON employee_clocking_line(clock_out_site_id);

CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_clock_out_project_id 
ON employee_clocking_line(clock_out_project_id);

-- Additional indexes for text searches (optional)
CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_site_name 
ON employee_clocking_line(site_name);

CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_project_name 
ON employee_clocking_line(project_name);

-- ============================================================================
-- PART 5: DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON COLUMN employee_clocking_line.site_id 
IS 'Foreign key: Site where employee clocked IN';

COMMENT ON COLUMN employee_clocking_line.site_name 
IS 'Text name: Site where employee clocked IN (preserved even if site is deleted)';

COMMENT ON COLUMN employee_clocking_line.project_name 
IS 'Text name: Project where employee clocked IN (preserved even if project is deleted)';

COMMENT ON COLUMN employee_clocking_line.clock_out_site_id 
IS 'Foreign key: Site where employee clocked OUT';

COMMENT ON COLUMN employee_clocking_line.clock_out_site_name 
IS 'Text name: Site where employee clocked OUT (preserved even if site is deleted)';

COMMENT ON COLUMN employee_clocking_line.clock_out_project_id 
IS 'Foreign key: Project where employee clocked OUT';

COMMENT ON COLUMN employee_clocking_line.clock_out_project_name 
IS 'Text name: Project where employee clocked OUT (preserved even if project is deleted)';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'employee_clocking_line' 
  AND column_name IN (
    'site_id', 'site_name', 'project_name',
    'clock_out_site_id', 'clock_out_site_name', 
    'clock_out_project_id', 'clock_out_project_name'
  )
ORDER BY ordinal_position;

-- Expected: 7 rows showing all the new columns

-- ============================================================================
-- SUMMARY OF COLUMNS ADDED
-- ============================================================================

-- Clock IN:
--   site_id              INTEGER     - FK to project_project
--   site_name            VARCHAR(255) - Text name
--   project_name         VARCHAR(255) - Text name (project_id already exists)

-- Clock OUT:
--   clock_out_site_id    INTEGER     - FK to project_project
--   clock_out_site_name  VARCHAR(255) - Text name
--   clock_out_project_id INTEGER     - FK to project_project
--   clock_out_project_name VARCHAR(255) - Text name

-- ============================================================================
