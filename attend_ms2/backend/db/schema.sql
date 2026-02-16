-- Self-contained UUID v4 style generator without requiring extensions
CREATE OR REPLACE FUNCTION app_gen_random_uuid()
RETURNS uuid
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CAST(
    CONCAT(
      SUBSTRING(md5(random()::text || clock_timestamp()::text),1,8), '-',
      SUBSTRING(md5(random()::text || clock_timestamp()::text),1,4), '-',
      '4'||SUBSTRING(md5(random()::text || clock_timestamp()::text),1,3), '-',
      SUBSTRING('89ab', floor(random()*4)::int+1,1) || SUBSTRING(md5(random()::text || clock_timestamp()::text),1,3), '-',
      SUBSTRING(md5(random()::text || clock_timestamp()::text),1,12)
    ) AS uuid
  );
$$;

-- Attendance corrections requested by employees (manager approves/denies)
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  from_time VARCHAR(8), -- optional proposed clock-in e.g., '09:05'
  to_time VARCHAR(8),   -- optional proposed clock-out e.g., '18:10'
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_att_corr_user_date ON attendance_corrections(user_id, date);

-- Work schedules assigned to users (managed by managers/admin)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_schedules_user_date ON schedules(user_id, date);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

-- Short ID generator using company/employee prefixes
CREATE OR REPLACE FUNCTION app_gen_short_id(p_prefix TEXT, p_len INT DEFAULT 8)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  res TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..p_len LOOP
    res := res || substr(alphabet, 1 + (floor(random()*62))::int, 1);
  END LOOP;
  RETURN p_prefix || res;
END;
$$;

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  company_code VARCHAR(20) UNIQUE NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure company policy columns exist (used by clock route)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS work_start_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS work_end_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS work_hours_per_day DECIMAL(4,2) DEFAULT 8,
  -- Company-level method settings
  ADD COLUMN IF NOT EXISTS allow_face BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_button BOOLEAN DEFAULT true;

-- Users table (Enhanced for authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emp_no VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  -- Plaintext password for development environments (do NOT use in production)
  password TEXT,
  profile_image_uri TEXT,
  role VARCHAR(50) DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
  annual_leave_balance DECIMAL(5,1) DEFAULT 20,
  medical_leave_balance DECIMAL(5,1) DEFAULT 14,
  emergency_leave_balance DECIMAL(5,1) DEFAULT 5,
  unpaid_leave_balance DECIMAL(5,1) DEFAULT 0,
  -- Per-employee work schedule configuration
  work_start_time VARCHAR(5),   -- e.g. '09:00'
  work_end_time   VARCHAR(5),   -- e.g. '18:00'
  grace_min       INTEGER,      -- e.g. 5
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, emp_no)
);

-- For existing databases: drop legacy password_hash early so subsequent inserts don't fail
ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash;

-- Add missing fields for employee management
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS join_date DATE;

-- Per-user clock method visibility flags (override company defaults when set)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS allow_face BOOLEAN,
  ADD COLUMN IF NOT EXISTS allow_button BOOLEAN;

-- User faces table for registration and verification metadata
CREATE TABLE IF NOT EXISTS user_faces (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_uri TEXT, -- stored URI of reference face image
  face_template BYTEA, -- optional binary template/embedding for matching
  template_version VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Ensure existing columns are converted to DECIMAL(5,1) to support half-day balances
ALTER TABLE users
  ALTER COLUMN annual_leave_balance TYPE DECIMAL(5,1) USING annual_leave_balance::DECIMAL,
  ALTER COLUMN medical_leave_balance TYPE DECIMAL(5,1) USING medical_leave_balance::DECIMAL,
  ALTER COLUMN emergency_leave_balance TYPE DECIMAL(5,1) USING emergency_leave_balance::DECIMAL,
  ALTER COLUMN unpaid_leave_balance TYPE DECIMAL(5,1) USING unpaid_leave_balance::DECIMAL;

-- Ensure per-employee schedule columns exist (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS work_start_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS work_end_time VARCHAR(5),
  ADD COLUMN IF NOT EXISTS grace_min INTEGER;

-- User sessions table for secure token management
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  refresh_token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  device_info JSONB,
  ip_address INET,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin audit logs (who did what when)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clock events table
CREATE TABLE IF NOT EXISTS clock_events (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  method VARCHAR(10) NOT NULL CHECK (method IN ('face', 'button')),
  image_uri TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure accuracy column exists on clock_events to store GPS accuracy (meters)
ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS accuracy DECIMAL(6,2);

-- Ensure site/project metadata columns exist on clock_events
ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS site_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(100);

-- (FKs for clock_events moved below after sites/projects are defined)

-- Structured address fields captured from reverse geocoding
ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS address_plot VARCHAR(50),
  ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_postal_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address_full TEXT;

-- Helpful index for per-site checks by day
-- Use immutable arithmetic-only day bucket (number of days since epoch)
-- floor(timestamp_ms / 1000 / 86400)
CREATE INDEX IF NOT EXISTS idx_clock_events_user_site_day
  ON clock_events (user_id, site_name, ((timestamp / 86400000::bigint)));

-- Attendance days table
CREATE TABLE IF NOT EXISTS attendance_days (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in_id UUID REFERENCES clock_events(id),
  clock_out_id UUID REFERENCES clock_events(id),
  normal_hours DECIMAL(4, 2) DEFAULT 0,
  overtime_hours DECIMAL(4, 2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'late', 'early-exit', 'leave')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, date)
);

-- Ensure break_hours column exists on attendance_days for per-day break duration (in hours)
ALTER TABLE attendance_days
  ADD COLUMN IF NOT EXISTS break_hours DECIMAL(4, 2) DEFAULT 0;

-- Per-site/project entries for a given day (supports multiple sessions per day)
CREATE TABLE IF NOT EXISTS attendance_entries (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  site_name VARCHAR(100),
  project_name VARCHAR(100),
  clock_in_id UUID REFERENCES clock_events(id),
  clock_out_id UUID REFERENCES clock_events(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Enforce only one entry per user/date/site/project
  UNIQUE(user_id, date, site_name, project_name)
);

CREATE INDEX IF NOT EXISTS idx_attendance_entries_user_date
  ON attendance_entries(user_id, date);

-- Sites (within a company)
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
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

-- Add short_id for human-friendly references on sites
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS short_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_sites_short_id ON sites(short_id);

-- Projects (optionally linked to a site)
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
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

-- Add short_id for human-friendly references on projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS short_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_projects_short_id ON projects(short_id);

-- Now that sites/projects exist, add normalized FK columns for site/project on clock_events (idempotent)
ALTER TABLE clock_events
  ADD COLUMN IF NOT EXISTS site_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'clock_events' AND constraint_name = 'fk_clock_events_site_id'
  ) THEN
    ALTER TABLE clock_events
      ADD CONSTRAINT fk_clock_events_site_id FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'clock_events' AND constraint_name = 'fk_clock_events_project_id'
  ) THEN
    ALTER TABLE clock_events
      ADD CONSTRAINT fk_clock_events_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Optional tasks within a project
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','in-progress','done','blocked')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add short_id to tasks for easier referencing
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS short_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_tasks_short_id ON project_tasks(short_id);

-- Now that sites/projects exist, add normalized FK columns for attendance_entries (idempotent)
ALTER TABLE attendance_entries
  ADD COLUMN IF NOT EXISTS site_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendance_entries' AND constraint_name = 'fk_attendance_entries_site_id'
  ) THEN
    ALTER TABLE attendance_entries
      ADD CONSTRAINT fk_attendance_entries_site_id FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'attendance_entries' AND constraint_name = 'fk_attendance_entries_project_id'
  ) THEN
    ALTER TABLE attendance_entries
      ADD CONSTRAINT fk_attendance_entries_project_id FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Avoid duplicate task names within the same project
CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_tasks_project_name
  ON project_tasks(project_id, name);

-- Assignment of employees to sites/projects/tasks (restricts clocking options)
CREATE TABLE IF NOT EXISTS employee_assignments (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Normalize to entities if present, but also allow free-text fallback to match current clock metadata
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  site_name VARCHAR(100),
  project_name VARCHAR(100),
  start_date DATE,
  end_date DATE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_user ON employee_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON employee_assignments(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_assignments_user_date ON employee_assignments(user_id, start_date, end_date);

-- Prevent exact duplicate assignment rows for same user/site/project/date range.
-- Use generated columns to normalize NULLs for portability across PostgreSQL versions.
ALTER TABLE employee_assignments
  ADD COLUMN IF NOT EXISTS site_name_norm TEXT GENERATED ALWAYS AS (COALESCE(site_name, '')) STORED,
  ADD COLUMN IF NOT EXISTS project_name_norm TEXT GENERATED ALWAYS AS (COALESCE(project_name, '')) STORED,
  ADD COLUMN IF NOT EXISTS start_date_norm DATE GENERATED ALWAYS AS (COALESCE(start_date, '0001-01-01'::date)) STORED,
  ADD COLUMN IF NOT EXISTS end_date_norm DATE GENERATED ALWAYS AS (COALESCE(end_date, '0001-01-01'::date)) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_employee_assignments_combo
  ON employee_assignments(user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm);

-- Leaves table
CREATE TABLE IF NOT EXISTS leaves (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('annual', 'medical', 'emergency', 'unpaid', 'other')),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  attachment_uri TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add half-day support columns (idempotent)
ALTER TABLE leaves
  ADD COLUMN IF NOT EXISTS duration VARCHAR(10) CHECK (duration IN ('full','half')) DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS half_day_period VARCHAR(2) CHECK (half_day_period IN ('AM','PM')),
  ADD COLUMN IF NOT EXISTS effective_days DECIMAL(4,1);

-- Toolbox meetings table
CREATE TABLE IF NOT EXISTS toolbox_meetings (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  presenter_id UUID NOT NULL REFERENCES users(id),
  location VARCHAR(255),
  safety_topics TEXT[],
  attachments TEXT[],
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Toolbox meeting attendees table
CREATE TABLE IF NOT EXISTS toolbox_meeting_attendees (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES toolbox_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attended BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  signature_uri TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(meeting_id, user_id)
);

-- Payslips table
CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT app_gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
CREATE INDEX IF NOT EXISTS idx_users_company_empno ON users(company_id, emp_no);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_faces_user ON user_faces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_clock_events_user_timestamp ON clock_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_days_user_date ON attendance_days(user_id, date);
CREATE INDEX IF NOT EXISTS idx_leaves_user_dates ON leaves(user_id, start_date, end_date);
-- Prevent duplicate active (pending/approved) leave requests for the same user/date range
CREATE UNIQUE INDEX IF NOT EXISTS uniq_leaves_user_dates_active
  ON leaves(user_id, start_date, end_date)
  WHERE status IN ('pending','approved');
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);
CREATE INDEX IF NOT EXISTS idx_toolbox_meetings_date ON toolbox_meetings(meeting_date);

-- Deduplicate existing toolbox meetings using a natural key prior to adding uniqueness
-- Natural key (case-insensitive, trimmed, collapsed spaces):
-- meeting_date + presenter_id + norm(title) + norm(location)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'toolbox_meetings'
  ) THEN
    WITH ranked AS (
      SELECT id,
             row_number() OVER (
               PARTITION BY meeting_date,
                            presenter_id,
                            regexp_replace(lower(btrim(coalesce(title,''))), '\s+', ' ', 'g'),
                            regexp_replace(lower(btrim(coalesce(location,''))), '\s+', ' ', 'g')
               ORDER BY updated_at DESC, created_at DESC, id DESC
             ) AS rn
      FROM toolbox_meetings
    )
    DELETE FROM toolbox_meetings tm USING ranked r
    WHERE tm.id = r.id AND r.rn > 1;
  END IF;
END$$;

-- Enforce backend-level uniqueness to avoid duplicate-like rows surfacing to clients
CREATE UNIQUE INDEX IF NOT EXISTS uniq_toolbox_meetings_natural
  ON toolbox_meetings (
    meeting_date,
    presenter_id,
    (regexp_replace(lower(btrim(coalesce(title,''))), '\\s+', ' ', 'g')),
    (regexp_replace(lower(btrim(coalesce(location,''))), '\\s+', ' ', 'g'))
  );
CREATE INDEX IF NOT EXISTS idx_toolbox_meeting_attendees_meeting ON toolbox_meeting_attendees(meeting_id);
CREATE INDEX IF NOT EXISTS idx_toolbox_meeting_attendees_user ON toolbox_meeting_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_payslips_user_period ON payslips(user_id, pay_period_start, pay_period_end);

-- Disabled demo company seed (ABC123). Keep real companies like AILAB only.
-- INSERT INTO companies (id, company_code, company_name, address, phone, email)
-- VALUES (
--   '550e8400-e29b-41d4-a716-446655440000',
--   'ABC123',
--   'ABC Corporation',
--   '123 Main St, City, State 12345',
--   '+1-555-123-4567',
--   'info@abccorp.com'
-- ) ON CONFLICT (company_code) DO NOTHING;

-- Guard demo user insert so it only runs if the demo company exists
INSERT INTO users (id, company_id, emp_no, name, email, password, profile_image_uri, role)
SELECT
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440000',
  'E12345',
  'John Doe',
  'john.doe@example.com',
  'password123',
  'https://placehold.co/600x400/EEE/31343C?text=No-Image',
  'employee'
WHERE EXISTS (
  SELECT 1 FROM companies WHERE id = '550e8400-e29b-41d4-a716-446655440000'
)
ON CONFLICT DO NOTHING;

-- Ensure plaintext password column exists for existing databases (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password TEXT;

-- Set plaintext password for the seeded demo user (dev only)
UPDATE users SET password = COALESCE(password, 'password123')
WHERE company_id = '550e8400-e29b-41d4-a716-446655440000'
  AND emp_no = 'E12345';

-- Seed default per-employee schedule for demo user if not set
UPDATE users SET
  work_start_time = COALESCE(work_start_time, '09:00'),
  work_end_time = COALESCE(work_end_time, '18:00'),
  grace_min = COALESCE(grace_min, 5),
  updated_at = CURRENT_TIMESTAMP
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Insert sample toolbox meetings (idempotent, respects natural uniqueness)
INSERT INTO toolbox_meetings (id, title, description, meeting_date, presenter_id, location, safety_topics, is_mandatory)
SELECT app_gen_random_uuid(), 'Weekly Safety Briefing', 'Weekly safety briefing covering workplace hazards and safety protocols.', CURRENT_DATE, '550e8400-e29b-41d4-a716-446655440000', 'Main Conference Room', ARRAY['PPE Requirements', 'Emergency Procedures', 'Hazard Identification'], true
WHERE EXISTS (SELECT 1 FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000')
  AND NOT EXISTS (
    SELECT 1 FROM toolbox_meetings tm
    WHERE tm.meeting_date = CURRENT_DATE
      AND tm.presenter_id = '550e8400-e29b-41d4-a716-446655440000'
      AND regexp_replace(lower(btrim(coalesce(tm.title,''))), '\s+', ' ', 'g') = regexp_replace(lower(btrim('Weekly Safety Briefing')), '\s+', ' ', 'g')
      AND regexp_replace(lower(btrim(coalesce(tm.location,''))), '\s+', ' ', 'g') = regexp_replace(lower(btrim('Main Conference Room')), '\s+', ' ', 'g')
  );

INSERT INTO toolbox_meetings (id, title, description, meeting_date, presenter_id, location, safety_topics, is_mandatory)
SELECT app_gen_random_uuid(), 'Fire Safety Training', 'Comprehensive fire safety training including evacuation procedures and fire extinguisher usage.', CURRENT_DATE - INTERVAL '7 days', '550e8400-e29b-41d4-a716-446655440000', 'Training Room A', ARRAY['Fire Prevention', 'Evacuation Routes', 'Fire Extinguisher Types'], true
WHERE EXISTS (SELECT 1 FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000')
  AND NOT EXISTS (
    SELECT 1 FROM toolbox_meetings tm
    WHERE tm.meeting_date = CURRENT_DATE - INTERVAL '7 days'
      AND tm.presenter_id = '550e8400-e29b-41d4-a716-446655440000'
      AND regexp_replace(lower(btrim(coalesce(tm.title,''))), '\s+', ' ', 'g') = regexp_replace(lower(btrim('Fire Safety Training')), '\s+', ' ', 'g')
      AND regexp_replace(lower(btrim(coalesce(tm.location,''))), '\s+', ' ', 'g') = regexp_replace(lower(btrim('Training Room A')), '\s+', ' ', 'g')
  );

-- Insert sample payslip (only if demo user exists)
INSERT INTO payslips (
  user_id, pay_period_start, pay_period_end, pay_date,
  basic_salary, overtime_hours, overtime_rate, overtime_pay,
  allowances, deductions, gross_pay, tax_deduction, net_pay
)
SELECT
  '550e8400-e29b-41d4-a716-446655440000',
  DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'),
  DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day',
  CURRENT_DATE - INTERVAL '5 days',
  5000.00,
  10.5,
  25.00,
  262.50,
  '{"transport": 200, "meal": 150}',
  '{"insurance": 100, "pension": 250}',
  5612.50,
  842.50,
  4770.00
WHERE EXISTS (SELECT 1 FROM users WHERE id = '550e8400-e29b-41d4-a716-446655440000');

-- Add company-level settings columns to companies table to control clock methods
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS allow_face BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_button BOOLEAN DEFAULT true;

-- Set default company policy times for seeded company (no-op if ABC123 absent)
UPDATE companies
SET work_start_time = COALESCE(work_start_time, '09:00'),
    work_end_time = COALESCE(work_end_time, '18:00'),
    work_hours_per_day = COALESCE(work_hours_per_day, 8)
WHERE company_code = 'ABC123';

-- Ensure seeded company has explicit method settings (no-op if ABC123 absent)
UPDATE companies
SET allow_face = COALESCE(allow_face, true),
    allow_button = COALESCE(allow_button, true)
WHERE company_code = 'ABC123';