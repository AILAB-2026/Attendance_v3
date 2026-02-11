-- Setup test user for attendance app
-- Employee Number: 362
-- Password: test123

-- Update employee 362 with hashed password
UPDATE hr_employee 
SET l_password_encrypted = '$2b$05$T4XmvIlTnctLq9wPXzleqO.fH.htixrZaNqrA3YyJQbzSgB2Mh946',
    active = true
WHERE "x_Emp_No" = '362';

-- Verify the update
SELECT id, "x_Emp_No", name, l_role_id, active, company_id
FROM hr_employee 
WHERE "x_Emp_No" = '362';
