-- Setup attendance_db with test data
-- This script creates the necessary tables and inserts test data

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    company_code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    emp_no VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    company_id INTEGER REFERENCES companies(id),
    role_id INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert test company
INSERT INTO companies (company_code, company_name) 
VALUES ('AILAB', 'AI Lab Company')
ON CONFLICT (company_code) DO NOTHING;

-- Insert test user with bcrypt hashed password for "password123"
-- Password: password123
INSERT INTO users (emp_no, name, password, company_id, role_id, is_active)
VALUES (
    'AILAB0014', 
    'Test User', 
    '$2b$05$oQYLXEAoRh0NtRumeqPlBef4AizWh4z2QS42S03vcj4tCCofeZSlO',
    (SELECT id FROM companies WHERE company_code = 'AILAB'),
    1,
    true
)
ON CONFLICT (emp_no) DO UPDATE SET password = '$2b$05$oQYLXEAoRh0NtRumeqPlBef4AizWh4z2QS42S03vcj4tCCofeZSlO';

-- Verify the data
SELECT 
    u.id,
    u.emp_no,
    u.name,
    c.company_code,
    c.company_name,
    u.is_active
FROM users u
INNER JOIN companies c ON u.company_id = c.id;
