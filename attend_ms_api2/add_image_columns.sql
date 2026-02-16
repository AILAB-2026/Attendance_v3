-- Add columns to store face recognition images for clock-in and clock-out
-- Run this SQL script in PostgreSQL to add the necessary columns

ALTER TABLE employee_clocking_line 
ADD COLUMN IF NOT EXISTS clock_in_image_uri TEXT,
ADD COLUMN IF NOT EXISTS clock_out_image_uri TEXT;

-- Add comments to document the columns
COMMENT ON COLUMN employee_clocking_line.clock_in_image_uri IS 'URI/path to face recognition image captured during clock-in';
COMMENT ON COLUMN employee_clocking_line.clock_out_image_uri IS 'URI/path to face recognition image captured during clock-out';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'employee_clocking_line' 
  AND column_name IN ('clock_in_image_uri', 'clock_out_image_uri');
