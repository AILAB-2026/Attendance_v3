-- Check hr_employee table for AI-EMP-014
SELECT id, name, work_email, company_id 
FROM hr_employee 
WHERE name LIKE '%014%' OR id = 14 OR id = 41
LIMIT 10;

-- Check all employees
SELECT id, name, work_email, company_id
FROM hr_employee
ORDER BY id
LIMIT 20;
