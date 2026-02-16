-- Migration: Add half_day_type column to hr_leave table
-- Purpose: Fix leave application error for AILAB database
-- Database: AILAB (CX18AI)

-- Add half_day_type column to hr_leave table
ALTER TABLE hr_leave 
ADD COLUMN IF NOT EXISTS half_day_type VARCHAR(20);

-- Add comment to explain the column
COMMENT ON COLUMN hr_leave.half_day_type IS 'Type of half day leave: morning, afternoon, or NULL for full day';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_hr_leave_half_day_type 
ON hr_leave(half_day_type);

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'hr_leave' 
  AND column_name = 'half_day_type';
