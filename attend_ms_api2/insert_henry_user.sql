-- Insert new user: Henry
-- Based on the hr_employee table structure and existing data format

INSERT INTO hr_employee (
    "x_Emp_No",           -- Employee Number (unique identifier)
    name,                 -- Full name
    company_id,           -- Company ID (1 = AI LAB TECHNOLOGIES)
    active,               -- Active status
    password,             -- Plain text password (for testing)
    l_role_id,            -- Role ID (null for now, can be updated)
    ai_enable_clocking    -- Enable clocking feature
)
VALUES (
    'HENRY-001',          -- Unique employee number
    'Henry',              -- Name
    1,                    -- Company ID (AI LAB TECHNOLOGIES)
    true,                 -- Active
    'Test@123',           -- Password (same as ARDI-0008 for consistency)
    null,                 -- Role ID (can be set later)
    true                  -- Enable clocking
);

-- Verify the insert
SELECT id, "x_Emp_No", name, company_id, active, password, l_role_id
FROM hr_employee
WHERE "x_Emp_No" = 'HENRY-001';

-- Get the new employee ID for reference
SELECT id, "x_Emp_No", name
FROM hr_employee
WHERE "x_Emp_No" = 'HENRY-001';
