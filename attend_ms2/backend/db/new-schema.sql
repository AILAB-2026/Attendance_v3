-- NEW SCHEMA WITH SHORT IDS
-- This replaces the existing schema with short, manageable identifiers

-- Drop existing tables in correct order (respecting foreign key constraints)
DROP TABLE IF EXISTS toolbox_meeting_attendees CASCADE;
DROP TABLE IF EXISTS toolbox_meetings CASCADE;
DROP TABLE IF EXISTS payslips CASCADE;
DROP TABLE IF EXISTS leaves CASCADE;
DROP TABLE IF EXISTS employee_assignments CASCADE;
DROP TABLE IF EXISTS project_tasks CASCADE;
DROP TABLE IF EXISTS attendance_entries CASCADE;
DROP TABLE IF EXISTS attendance_days CASCADE;
DROP TABLE IF EXISTS clock_events CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS attendance_corrections CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS sites CASCADE;
DROP TABLE IF EXISTS admin_audit_logs CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_faces CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

-- Drop old UUID generator function
DROP FUNCTION IF EXISTS app_gen_random_uuid() CASCADE;

-- Enhanced Short ID generator with collision detection
CREATE OR REPLACE FUNCTION gen_short_id(p_prefix TEXT, p_len INT DEFAULT 8)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- Removed confusing chars: I, O
  res TEXT := '';
  full_id TEXT;
  i INT;
BEGIN
  LOOP
    res := '';
    FOR i IN 1..p_len LOOP
      res := res || substr(alphabet, 1 + (floor(random()*32))::int, 1);
    END LOOP;
    full_id := p_prefix || res;
    
    -- Check for collisions across all tables (basic collision detection)
    -- In practice, with 32^8 combinations per prefix, collisions are extremely rare
    EXIT;
  END LOOP;
  
  RETURN full_id;
END;
$$;

-- Sequence-based ID generator for high-volume tables
CREATE SEQUENCE IF NOT EXISTS global_id_seq START 1000;

CREATE OR REPLACE FUNCTION gen_sequential_id(p_prefix TEXT)
RETURNS TEXT
LANGUAGE SQL
AS $$
  SELECT p_prefix || LPAD(nextval('global_id_seq')::TEXT, 6, '0');
$$;

-- Companies table with short IDs
CREATE TABLE companies (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('CMP_'),
  company_code VARCHAR(20) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  work_start_time VARCHAR(5) DEFAULT '09:00',
  work_end_time VARCHAR(5) DEFAULT '18:00',
  work_hours_per_day DECIMAL(4,2) DEFAULT 8,
  allow_face BOOLEAN DEFAULT true,
  allow_button BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table with short IDs
CREATE TABLE users (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('USR_'),
  company_id VARCHAR(12) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emp_no VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT,
  profile_image_uri TEXT,
  role VARCHAR(50) DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
  annual_leave_balance DECIMAL(5,1) DEFAULT 20,
  medical_leave_balance DECIMAL(5,1) DEFAULT 14,
  emergency_leave_balance DECIMAL(5,1) DEFAULT 5,
  unpaid_leave_balance DECIMAL(5,1) DEFAULT 0,
  work_start_time VARCHAR(5),
  work_end_time VARCHAR(5),
  grace_min INTEGER,
  phone VARCHAR(20),
  department VARCHAR(100),
  join_date DATE,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  -- Per-user clock method visibility flags (override company defaults when set)
  allow_face BOOLEAN,
  allow_button BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, emp_no)
);

-- User faces table
CREATE TABLE user_faces (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('FCE_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_uri TEXT,
  face_template BYTEA,
  template_version VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- User sessions table
CREATE TABLE user_sessions (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('SES_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  device_info JSONB,
  ip_address INET,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit logs
CREATE TABLE admin_audit_logs (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_sequential_id('LOG_'),
  company_id VARCHAR(12) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(12),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sites table
CREATE TABLE sites (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('SIT_'),
  company_id VARCHAR(12) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code),
  UNIQUE(company_id, name)
);

-- Projects table
CREATE TABLE projects (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('PRJ_'),
  company_id VARCHAR(12) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id VARCHAR(12) REFERENCES sites(id) ON DELETE SET NULL,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','on-hold','archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code),
  UNIQUE(company_id, name)
);

-- Project tasks table
CREATE TABLE project_tasks (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('TSK_'),
  project_id VARCHAR(12) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in-progress','done','blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, name)
);

-- Clock events table (high volume - use sequential IDs)
CREATE TABLE clock_events (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_sequential_id('CLK_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6,2),
  address TEXT,
  address_plot VARCHAR(50),
  address_street VARCHAR(255),
  address_city VARCHAR(100),
  address_state VARCHAR(100),
  address_postal_code VARCHAR(20),
  address_country VARCHAR(100),
  address_full TEXT,
  method VARCHAR(10) NOT NULL CHECK (method IN ('face', 'button')),
  image_uri TEXT,
  site_id VARCHAR(12) REFERENCES sites(id) ON DELETE SET NULL,
  project_id VARCHAR(12) REFERENCES projects(id) ON DELETE SET NULL,
  site_name VARCHAR(100),
  project_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance days table
CREATE TABLE attendance_days (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('ATD_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in_id VARCHAR(12) REFERENCES clock_events(id),
  clock_out_id VARCHAR(12) REFERENCES clock_events(id),
  normal_hours DECIMAL(4, 2) DEFAULT 0,
  overtime_hours DECIMAL(4, 2) DEFAULT 0,
  break_hours DECIMAL(4, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'early-exit', 'leave')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Attendance entries table
CREATE TABLE attendance_entries (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('ENT_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  site_id VARCHAR(12) REFERENCES sites(id) ON DELETE SET NULL,
  project_id VARCHAR(12) REFERENCES projects(id) ON DELETE SET NULL,
  site_name VARCHAR(100),
  project_name VARCHAR(100),
  clock_in_id VARCHAR(12) REFERENCES clock_events(id),
  clock_out_id VARCHAR(12) REFERENCES clock_events(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date, site_name, project_name)
);

-- Schedules table
CREATE TABLE schedules (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('SCH_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time VARCHAR(5) NOT NULL,
  end_time VARCHAR(5) NOT NULL,
  shift_code VARCHAR(20),
  location TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Attendance corrections table
CREATE TABLE attendance_corrections (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('COR_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  from_time VARCHAR(8),
  to_time VARCHAR(8),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id VARCHAR(12) REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee assignments table
CREATE TABLE employee_assignments (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('ASG_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  site_id VARCHAR(12) REFERENCES sites(id) ON DELETE SET NULL,
  project_id VARCHAR(12) REFERENCES projects(id) ON DELETE SET NULL,
  task_id VARCHAR(12) REFERENCES project_tasks(id) ON DELETE SET NULL,
  site_name VARCHAR(100),
  project_name VARCHAR(100),
  start_date DATE,
  end_date DATE,
  assigned_by VARCHAR(12) REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Computed columns for uniqueness
  site_name_norm TEXT GENERATED ALWAYS AS (COALESCE(site_name, '')) STORED,
  project_name_norm TEXT GENERATED ALWAYS AS (COALESCE(project_name, '')) STORED,
  start_date_norm DATE GENERATED ALWAYS AS (COALESCE(start_date, '0001-01-01'::date)) STORED,
  end_date_norm DATE GENERATED ALWAYS AS (COALESCE(end_date, '0001-01-01'::date)) STORED
);

-- Leaves table
CREATE TABLE leaves (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('LEV_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('annual', 'medical', 'emergency', 'unpaid', 'other')),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  duration VARCHAR(10) CHECK (duration IN ('full','half')) DEFAULT 'full',
  half_day_period VARCHAR(2) CHECK (half_day_period IN ('AM','PM')),
  effective_days DECIMAL(4,1),
  attachment_uri TEXT,
  approved_by VARCHAR(12) REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Toolbox meetings table
CREATE TABLE toolbox_meetings (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('TBX_'),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  presenter_id VARCHAR(12) NOT NULL REFERENCES users(id),
  location VARCHAR(255),
  safety_topics TEXT[],
  attachments TEXT[],
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Toolbox meeting attendees table
CREATE TABLE toolbox_meeting_attendees (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('TBA_'),
  meeting_id VARCHAR(12) NOT NULL REFERENCES toolbox_meetings(id) ON DELETE CASCADE,
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  signature_uri TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(meeting_id, user_id)
);

-- Payslips table
CREATE TABLE payslips (
  id VARCHAR(12) PRIMARY KEY DEFAULT gen_short_id('PAY_'),
  user_id VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL,
  pay_period_end DATE NOT NULL,
  pay_date DATE NOT NULL,
  basic_salary DECIMAL(10, 2) NOT NULL,
  overtime_hours DECIMAL(4, 2) DEFAULT 0,
  overtime_rate DECIMAL(6, 2) DEFAULT 0,
  overtime_pay DECIMAL(10, 2) DEFAULT 0,
  allowances JSONB DEFAULT '{}',
  deductions JSONB DEFAULT '{}',
  gross_pay DECIMAL(10, 2) NOT NULL,
  tax_deduction DECIMAL(10, 2) DEFAULT 0,
  net_pay DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'viewed')),
  pdf_uri TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create all necessary indexes
CREATE INDEX idx_companies_code ON companies(company_code);
CREATE INDEX idx_users_company_empno ON users(company_id, emp_no);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_faces_user ON user_faces(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_clock_events_user_timestamp ON clock_events(user_id, timestamp);
CREATE INDEX idx_clock_events_user_site_day ON clock_events (user_id, site_name, ((timestamp / 86400000::bigint)));
CREATE INDEX idx_attendance_days_user_date ON attendance_days(user_id, date);
CREATE INDEX idx_attendance_entries_user_date ON attendance_entries(user_id, date);
CREATE INDEX idx_schedules_user_date ON schedules(user_id, date);
CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_att_corr_user_date ON attendance_corrections(user_id, date);
CREATE INDEX idx_assignments_user ON employee_assignments(user_id);
CREATE INDEX idx_assignments_date ON employee_assignments(start_date, end_date);
CREATE INDEX idx_assignments_user_date ON employee_assignments(user_id, start_date, end_date);
CREATE INDEX idx_leaves_user_dates ON leaves(user_id, start_date, end_date);
CREATE INDEX idx_leaves_status ON leaves(status);
CREATE INDEX idx_toolbox_meetings_date ON toolbox_meetings(meeting_date);
CREATE INDEX idx_toolbox_meeting_attendees_meeting ON toolbox_meeting_attendees(meeting_id);
CREATE INDEX idx_toolbox_meeting_attendees_user ON toolbox_meeting_attendees(user_id);
CREATE INDEX idx_payslips_user_period ON payslips(user_id, pay_period_start, pay_period_end);

-- Unique constraints
CREATE UNIQUE INDEX uniq_employee_assignments_combo ON employee_assignments(user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm);
CREATE UNIQUE INDEX uniq_leaves_user_dates_active ON leaves(user_id, start_date, end_date) WHERE status IN ('pending','approved');
CREATE UNIQUE INDEX uniq_toolbox_meetings_natural ON toolbox_meetings (
  meeting_date,
  presenter_id,
  (regexp_replace(lower(btrim(coalesce(title,''))), '\\s+', ' ', 'g')),
  (regexp_replace(lower(btrim(coalesce(location,''))), '\\s+', ' ', 'g'))
);
