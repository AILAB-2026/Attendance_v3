-- Migration: Add clock-out site_id and project_id columns
-- Purpose: Track where employee clocked out (may be different from clock-in location)
-- Date: 2026-01-09

-- Add clock_out_site_id column
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_out_site_id INTEGER;

-- Add clock_out_project_id column
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_out_project_id INTEGER;

-- Add foreign key constraints
ALTER TABLE employee_clocking_line 
ADD CONSTRAINT fk_employee_clocking_line_clock_out_site 
FOREIGN KEY (clock_out_site_id) REFERENCES project_project(id) 
ON DELETE SET NULL;

ALTER TABLE employee_clocking_line 
ADD CONSTRAINT fk_employee_clocking_line_clock_out_project 
FOREIGN KEY (clock_out_project_id) REFERENCES project_project(id) 
ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_clock_out_site_id 
ON employee_clocking_line(clock_out_site_id);

CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_clock_out_project_id 
ON employee_clocking_line(clock_out_project_id);

-- Add comments for documentation
COMMENT ON COLUMN employee_clocking_line.clock_out_site_id 
IS 'Foreign key to project_project table representing the site/location where clock-out occurred';

COMMENT ON COLUMN employee_clocking_line.clock_out_project_id 
IS 'Foreign key to project_project table representing the project where clock-out occurred';

-- Verification query
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'employee_clocking_line' 
--   AND column_name IN ('clock_out_site_id', 'clock_out_project_id');
