-- Migration: Add missing columns to SKK and AILAB databases
-- BRK already has these columns, so this is for SKK and AILAB only

-- ============================================
-- Add exact coordinates to employee_clocking_line
-- ============================================

ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS in_lat_exact DOUBLE PRECISION;

ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS in_lng_exact DOUBLE PRECISION;

ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS out_lat_exact DOUBLE PRECISION;

ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS out_lng_exact DOUBLE PRECISION;

-- ============================================
-- Add face descriptor to hr_employee
-- ============================================

ALTER TABLE hr_employee 
ADD COLUMN IF NOT EXISTS l_face_descriptor BYTEA;

-- ============================================
-- Add holiday_type to hr_leave
-- ============================================

ALTER TABLE hr_leave 
ADD COLUMN IF NOT EXISTS holiday_type VARCHAR(50);

-- ============================================
-- Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ecl_in_lat_exact 
ON employee_clocking_line(in_lat_exact);

CREATE INDEX IF NOT EXISTS idx_ecl_in_lng_exact 
ON employee_clocking_line(in_lng_exact);

CREATE INDEX IF NOT EXISTS idx_ecl_out_lat_exact 
ON employee_clocking_line(out_lat_exact);

CREATE INDEX IF NOT EXISTS idx_ecl_out_lng_exact 
ON employee_clocking_line(out_lng_exact);

CREATE INDEX IF NOT EXISTS idx_hr_employee_face 
ON hr_employee(l_face_descriptor) 
WHERE l_face_descriptor IS NOT NULL;

-- ============================================
-- Verification queries
-- ============================================

-- Verify columns were added to employee_clocking_line
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employee_clocking_line' 
AND column_name IN ('in_lat_exact', 'in_lng_exact', 'out_lat_exact', 'out_lng_exact')
ORDER BY column_name;

-- Verify columns were added to hr_employee
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hr_employee' 
AND column_name = 'l_face_descriptor';

-- Verify columns were added to hr_leave
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hr_leave' 
AND column_name = 'holiday_type';
