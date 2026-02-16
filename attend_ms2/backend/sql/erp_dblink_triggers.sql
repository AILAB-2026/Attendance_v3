-- 1) Enable dblink (once per DB)
CREATE EXTENSION IF NOT EXISTS dblink;

-- 2) Create or replace the function directly (no DO/DECLARE nesting)
CREATE OR REPLACE FUNCTION public.hr_employee_push_to_mobile()
RETURNS trigger AS $fn$
DECLARE
  v_conn text := 'host=localhost port=5432 dbname=attendance_db user=openpg password=openpgpwd';
  v_emp_no text;
  v_sql text;
  v_active_literal text;
BEGIN
  -- Compute Employee No using JSONB-safe extraction similar to app logic
  SELECT COALESCE(
    to_jsonb(NEW)->>'x_Emp_No',
    to_jsonb(NEW)->>'x_emp_no',
    to_jsonb(NEW)->>'emp_no',
    to_jsonb(NEW)->>'employee_no',
    to_jsonb(NEW)->>'employee_number',
    to_jsonb(NEW)->>'x_empno',
    to_jsonb(NEW)->>'x_employee_no'
  ) INTO v_emp_no;

  -- Build boolean literal as TRUE/FALSE (not t/f)
  v_active_literal := CASE WHEN COALESCE(NEW.active, TRUE) THEN 'TRUE' ELSE 'FALSE' END;

  -- Build a remote DO block so dblink_exec runs a no-result command
  v_sql := format('DO $$ BEGIN PERFORM public.upsert_user_from_employee(%s,%L,%L,%L,%L,%L,%L,%s,%L,%L); END $$;',
    NEW.id,                      -- p_odoo_employee_id integer
    NEW.name,                    -- p_name text
    NEW.work_email,              -- p_work_email text
    NEW.work_phone,              -- p_work_phone text
    NEW.mobile_phone,            -- p_mobile_phone text
    NEW.barcode,                 -- p_barcode text
    NEW.identification_id,       -- p_identification_id text
    v_active_literal,            -- p_active boolean as literal
    NEW.write_date,              -- p_write_date timestamptz
    v_emp_no                     -- p_emp_no text
  );

  PERFORM dblink_exec(v_conn, v_sql);

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- 3) Create or replace the trigger on hr_employee
DROP TRIGGER IF EXISTS hr_employee_push_to_mobile_trg ON public.hr_employee;
CREATE TRIGGER hr_employee_push_to_mobile_trg
AFTER INSERT OR UPDATE ON public.hr_employee
FOR EACH ROW EXECUTE FUNCTION public.hr_employee_push_to_mobile();

-- Done: any insert/update on hr_employee will now push into attendance_db
