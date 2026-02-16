-- attendance_entries_to_erp.sql (run on attendance_db)
-- Purpose: On insert/update of public.attendance_entries, push to ERP hr_attendance via dblink.
-- Requires on ERP (CX18AILABDEMO): run erp_attendance_upsert.sql first to create
--   public.upsert_hr_attendance_by_empno(emp_no, check_in, check_out)

-- 1) Enable dblink on attendance_db
CREATE EXTENSION IF NOT EXISTS dblink;

-- 2) Trigger function: push one entry to ERP
CREATE OR REPLACE FUNCTION public.push_attendance_entry_to_erp()
RETURNS trigger AS $fn$
DECLARE
  v_conn text := 'host=localhost port=5432 dbname=CX18AILABDEMO user=openpg password=openpgpwd';
  v_emp_no text;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_in_method text;
  v_out_method text;
  v_in_lat numeric;
  v_in_lon numeric;
  v_out_lat numeric;
  v_out_lon numeric;
  v_in_addr text;
  v_out_addr text;
  v_sql text;
BEGIN
  -- Resolve emp_no via users by user_id
  IF NEW.user_id IS NOT NULL THEN
    SELECT u.emp_no INTO v_emp_no FROM public.users u WHERE u.id = NEW.user_id LIMIT 1;
  END IF;

  -- Resolve check-in timestamp from clock_events via clock_in_id
  IF NEW.clock_in_id IS NOT NULL THEN
    SELECT COALESCE(
             to_timestamp(ce."timestamp"/1000.0),
             ce.created_at::timestamptz
           )
         , ce.method, ce.latitude, ce.longitude, ce.address_full
    INTO v_check_in, v_in_method, v_in_lat, v_in_lon, v_in_addr
    FROM public.clock_events ce
    WHERE ce.id = NEW.clock_in_id
    LIMIT 1;
  END IF;

  -- Resolve check-out timestamp from clock_events via clock_out_id
  IF NEW.clock_out_id IS NOT NULL THEN
    SELECT COALESCE(
             to_timestamp(ce."timestamp"/1000.0),
             ce.created_at::timestamptz
           )
         , ce.method, ce.latitude, ce.longitude, ce.address_full
    INTO v_check_out, v_out_method, v_out_lat, v_out_lon, v_out_addr
    FROM public.clock_events ce
    WHERE ce.id = NEW.clock_out_id
    LIMIT 1;
  END IF;

  -- If required data missing, skip
  IF v_emp_no IS NULL OR v_check_in IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build remote DO block that calls ERP clocking upsert (no result set)
  v_sql := format(
    'DO $$ BEGIN PERFORM public.upsert_employee_clocking_line_by_empno(%L, %L::timestamptz, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s); END $$;',
    v_emp_no,
    to_char(v_check_in, 'YYYY-MM-DD"T"HH24:MI:SS.MS TZH:TZM'),
    CASE WHEN v_check_out IS NULL THEN 'NULL' ELSE quote_literal(to_char(v_check_out, 'YYYY-MM-DD"T"HH24:MI:SS.MS TZH:TZM')) || '::timestamptz' END,
    CASE WHEN v_in_method  IS NULL THEN 'NULL' ELSE quote_literal(v_in_method)  END,
    CASE WHEN v_out_method IS NULL THEN 'NULL' ELSE quote_literal(v_out_method) END,
    CASE WHEN v_in_lat IS NULL THEN 'NULL' ELSE v_in_lat::text END,
    CASE WHEN v_in_lon IS NULL THEN 'NULL' ELSE v_in_lon::text END,
    CASE WHEN v_out_lat IS NULL THEN 'NULL' ELSE v_out_lat::text END,
    CASE WHEN v_out_lon IS NULL THEN 'NULL' ELSE v_out_lon::text END,
    CASE WHEN v_in_addr  IS NULL THEN 'NULL' ELSE quote_literal(v_in_addr)  END,
    CASE WHEN v_out_addr IS NULL THEN 'NULL' ELSE quote_literal(v_out_addr) END,
    'NULL'  -- p_attendance_type parameter (12th parameter)
  );

  PERFORM dblink_exec(v_conn, v_sql);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

-- 3) Create trigger on attendance_entries
DROP TRIGGER IF EXISTS trg_push_attendance_entries_to_erp ON public.attendance_entries;
CREATE TRIGGER trg_push_attendance_entries_to_erp
AFTER INSERT OR UPDATE ON public.attendance_entries
FOR EACH ROW EXECUTE FUNCTION public.push_attendance_entry_to_erp();
