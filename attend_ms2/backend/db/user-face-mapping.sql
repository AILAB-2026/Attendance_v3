-- User Face Mapping Table
-- Maps AIAttend_v2 users to attendance_api_mobile employee IDs for face recognition
-- This table resides in the AIAttend_v2 database (attendance_db)

CREATE TABLE IF NOT EXISTS user_face_mapping (
  aiattend_user_id VARCHAR(50) PRIMARY KEY,
  attendance_employee_id INTEGER NOT NULL,
  employee_no VARCHAR(50),
  company_code VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_face_mapping_employee_id 
ON user_face_mapping(attendance_employee_id);

CREATE INDEX IF NOT EXISTS idx_user_face_mapping_employee_no 
ON user_face_mapping(employee_no);

-- Comments
COMMENT ON TABLE user_face_mapping IS 'Maps AIAttend_v2 users to attendance_api_mobile employee IDs for face recognition integration';
COMMENT ON COLUMN user_face_mapping.aiattend_user_id IS 'User ID from AIAttend_v2 system';
COMMENT ON COLUMN user_face_mapping.attendance_employee_id IS 'Employee ID from attendance_api_mobile hr_employee table';
COMMENT ON COLUMN user_face_mapping.employee_no IS 'Employee number for reference';
COMMENT ON COLUMN user_face_mapping.company_code IS 'Company code for reference';
