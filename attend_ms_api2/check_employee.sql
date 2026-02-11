-- Check hr_employee table structure and find AI-EMP-014
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'hr_employee' 
ORDER BY ordinal_position;

-- Find employee AI-EMP-014
SELECT * FROM hr_employee WHERE id = 14 OR name LIKE '%014%' LIMIT 5;
