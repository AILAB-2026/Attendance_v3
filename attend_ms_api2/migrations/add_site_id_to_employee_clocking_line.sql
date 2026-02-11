-- Migration: Add site_id column to employee_clocking_line table
-- Purpose: Track both site and project separately for attendance records
-- Date: 2026-01-09

-- Add site_id column (nullable for backward compatibility)
ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS site_id INTEGER;

-- Add foreign key constraint to project_project table (sites are stored there)
-- Note: In Odoo/ERP systems, sites are typically stored in project_project table
ALTER TABLE employee_clocking_line 
ADD CONSTRAINT fk_employee_clocking_line_site 
FOREIGN KEY (site_id) REFERENCES project_project(id) 
ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_employee_clocking_line_site_id 
ON employee_clocking_line(site_id);

-- Add comment for documentation
COMMENT ON COLUMN employee_clocking_line.site_id IS 'Foreign key to project_project table representing the site/location where clock-in occurred';

-- Verification query (optional - run this to verify the column was added)
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'employee_clocking_line' AND column_name = 'site_id';
