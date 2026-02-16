-- Setup Test Employee in hr_employee table for Face Recognition
-- Database: CX18AILABDEMO
-- Table: hr_employee

-- Check if employee with ID 41 exists (Vinoth K)
SELECT id, name, work_email, company_id, l_face_descriptor IS NOT NULL as has_face
FROM hr_employee 
WHERE id = 41;

-- If you want to create a new employee AI-EMP-014, use this:
-- Note: Adjust the ID and other fields as needed

-- Option 1: Update existing employee (ID 41) to have specific details
UPDATE hr_employee 
SET name = 'AI-EMP-014 Test User',
    work_email = 'ai-emp-014@ailab.com'
WHERE id = 41;

-- Option 2: Insert new employee (if ID 14 doesn't exist)
-- INSERT INTO hr_employee (id, name, work_email, company_id)
-- VALUES (14, 'AI-EMP-014 Test User', 'ai-emp-014@ailab.com', 1)
-- ON CONFLICT (id) DO UPDATE 
-- SET name = EXCLUDED.name, work_email = EXCLUDED.work_email;

-- Verify the employee
SELECT id, name, work_email, company_id, 
       l_face_descriptor IS NOT NULL as has_face_enrolled
FROM hr_employee 
WHERE id = 41 OR name LIKE '%AI-EMP-014%';
