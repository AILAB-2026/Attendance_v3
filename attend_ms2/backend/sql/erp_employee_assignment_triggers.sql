-- Real-time push of employee project + site to mobile DB using dblink (run this on Odoo DB)
-- Prereq: attendance DB reachable from Odoo DB server with these creds/host
-- Adjust connection as needed
CREATE EXTENSION IF NOT EXISTS dblink;

-- Connection string to Attendance DB
-- NOTE: Update host/port/db/user/password if different in your environment
DO $$ BEGIN
  PERFORM 1;
END $$;

-- Upsert helper executed on Odoo side; pushes one employee's assignment to Attendance DB
CREATE OR REPLACE FUNCTION public.hr_employee_assignment_push_to_mobile()
RETURNS trigger AS $fn$
DECLARE
  v_conn text := 'host=localhost port=5432 dbname=attendance_db user=openpg password=openpgpwd';
  v_emp_no text;
  v_project_name text;
  v_site_location text;
  v_sql text;
BEGIN
  -- Resolve employee number (prefer custom x_Emp_No, fallback to barcode)
  SELECT COALESCE(
    to_jsonb(NEW)->>'x_Emp_No',
    to_jsonb(NEW)->>'x_emp_no',
    to_jsonb(NEW)->>'emp_no',
    to_jsonb(NEW)->>'employee_no',
    to_jsonb(NEW)->>'employee_number',
    to_jsonb(NEW)->>'barcode',
    to_jsonb(NEW)->>'identification_id'
  ) INTO v_emp_no;

  IF v_emp_no IS NULL OR btrim(v_emp_no) = '' THEN
    RETURN NEW; -- nothing to push
  END IF;

  -- Pull project name + site_location from project_project
  -- Prefer JSON en_US if available, otherwise fallback to raw text; strip quotes
  SELECT
    NULLIF(btrim(regexp_replace(COALESCE(p.name->>'en_US', (p.name)::text), '^"|"$', '', 'g')), '') AS project_name,
    NULLIF(btrim(regexp_replace(COALESCE(p.site_location->>'en_US', (p.site_location)::text), '^"|"$', '', 'g')), '') AS site_location
  INTO v_project_name, v_site_location
  FROM project_project p
  WHERE p.id = NEW.project_id;

  -- Build an UPSERT into mobile.employee_assignments by emp_no
  -- It resolves user_id remotely from users by emp_no, and writes project/site names
  v_sql := format($$WITH u AS (
      SELECT id FROM users WHERE emp_no = %L LIMIT 1
    ), ins AS (
      INSERT INTO employee_assignments (
        user_id, site_name, project_name, start_date, end_date, emp_no, created_at, updated_at
      )
      SELECT u.id, %L, %L, NULL, NULL, %L, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM u
      WHERE u.id IS NOT NULL
      ON CONFLICT (user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm)
      DO UPDATE SET emp_no = EXCLUDED.emp_no, site_name = EXCLUDED.site_name, project_name = EXCLUDED.project_name, updated_at = CURRENT_TIMESTAMP
      RETURNING 1
    )
    SELECT 1;$$,
    v_emp_no, v_site_location, v_project_name, v_emp_no);

  PERFORM dblink_exec(v_conn, v_sql);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- Trigger on hr_employee to push assignment on create/update (project change, active, etc.)
DROP TRIGGER IF EXISTS hr_employee_assignment_push_trg ON public.hr_employee;
CREATE TRIGGER hr_employee_assignment_push_trg
AFTER INSERT OR UPDATE OF project_id, write_date, active ON public.hr_employee
FOR EACH ROW EXECUTE FUNCTION public.hr_employee_assignment_push_to_mobile();

-- Also handle project site changes: when site_location changes, push for all employees on that project
CREATE OR REPLACE FUNCTION public.project_project_site_push_to_mobile()
RETURNS trigger AS $fn$
DECLARE
  v_conn text := 'host=localhost port=5432 dbname=attendance_db user=openpg password=openpgpwd';
  rec record;
  v_project_name text := NULLIF(btrim(regexp_replace(COALESCE(NEW.name->>'en_US', (NEW.name)::text), '^"|"$', '', 'g')), '');
  v_site_location text := NULLIF(btrim(regexp_replace(COALESCE(NEW.site_location->>'en_US', (NEW.site_location)::text), '^"|"$', '', 'g')), '');
  v_emp_no text;
  v_sql text;
BEGIN
  IF TG_OP <> 'UPDATE' OR NOT (NEW.site_location IS DISTINCT FROM OLD.site_location) THEN
    RETURN NEW;
  END IF;

  FOR rec IN
    SELECT e.* FROM hr_employee e WHERE e.project_id = NEW.id
  LOOP
    SELECT COALESCE(
      to_jsonb(rec)->>'x_Emp_No',
      to_jsonb(rec)->>'x_emp_no',
      to_jsonb(rec)->>'emp_no',
      to_jsonb(rec)->>'employee_no',
      to_jsonb(rec)->>'employee_number',
      to_jsonb(rec)->>'barcode',
      to_jsonb(rec)->>'identification_id'
    ) INTO v_emp_no;

    IF v_emp_no IS NULL OR btrim(v_emp_no) = '' THEN
      CONTINUE;
    END IF;

    v_sql := format($$WITH u AS (
        SELECT id FROM users WHERE emp_no = %L LIMIT 1
      ), ins AS (
        INSERT INTO employee_assignments (
          user_id, site_name, project_name, start_date, end_date, emp_no, created_at, updated_at
        )
        SELECT u.id, %L, %L, NULL, NULL, %L, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM u
        WHERE u.id IS NOT NULL
        ON CONFLICT (user_id, site_name_norm, project_name_norm, start_date_norm, end_date_norm)
        DO UPDATE SET emp_no = EXCLUDED.emp_no, site_name = EXCLUDED.site_name, project_name = EXCLUDED.project_name, updated_at = CURRENT_TIMESTAMP
        RETURNING 1
      )
      SELECT 1;$$,
      v_emp_no, v_site_location, v_project_name, v_emp_no);

    PERFORM dblink_exec(v_conn, v_sql);
  END LOOP;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS project_project_site_push_trg ON public.project_project;
CREATE TRIGGER project_project_site_push_trg
AFTER UPDATE OF site_location ON public.project_project
FOR EACH ROW EXECUTE FUNCTION public.project_project_site_push_to_mobile();

-- Usage:
-- Run this entire script on the Odoo DB (CX18AILABDEMO). From then on, inserting/updating
-- hr_employee.project_id or project_project.site_location will push to attendance_db.employee_assignments in real time.
