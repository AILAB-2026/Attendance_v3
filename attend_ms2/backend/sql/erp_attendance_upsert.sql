-- erp_attendance_upsert.sql (run on ERP DB: CX18AILABDEMO)
-- Purpose: Provide a single function to upsert hr_attendance by Employee No, with duplicate prevention.

-- 1) Helper: resolve employee_id by Employee No (handles various custom field names)
CREATE OR REPLACE FUNCTION public._emp_id_by_empno(p_emp_no text)
RETURNS integer AS $fn$
DECLARE v_id integer;
BEGIN
  SELECT id INTO v_id
  FROM public.hr_employee e
  WHERE COALESCE(
    to_jsonb(e)->>'x_Emp_No',
    to_jsonb(e)->>'x_emp_no',
    to_jsonb(e)->>'emp_no',
    to_jsonb(e)->>'employee_no',
    to_jsonb(e)->>'employee_number',
    to_jsonb(e)->>'x_empno',
    to_jsonb(e)->>'x_employee_no'
  ) = p_emp_no
  LIMIT 1;
  RETURN v_id;
END;
$fn$ LANGUAGE plpgsql;

-- 2) Upsert hr_attendance by Employee No + check_in (exact match). Optional check_out update.
CREATE OR REPLACE FUNCTION public.upsert_hr_attendance_by_empno(
  p_emp_no   text,
  p_check_in timestamptz,
  p_check_out timestamptz DEFAULT NULL
) RETURNS void AS $fn$
DECLARE v_emp_id integer;
BEGIN
  IF p_emp_no IS NULL OR p_check_in IS NULL THEN
    RETURN; -- insufficient data
  END IF;
  v_emp_id := public._emp_id_by_empno(p_emp_no);
  IF v_emp_id IS NULL THEN
    RETURN; -- no corresponding employee in ERP
  END IF;

  -- Try update existing by exact (employee_id, check_in)
  UPDATE public.hr_attendance
  SET check_out = COALESCE(p_check_out, check_out)
  WHERE employee_id = v_emp_id AND check_in = p_check_in;

  IF NOT FOUND THEN
    -- Insert only if there is no near-duplicate within 60s around check_in
    IF NOT EXISTS (
      SELECT 1 FROM public.hr_attendance
      WHERE employee_id = v_emp_id
        AND ABS(EXTRACT(EPOCH FROM (check_in - p_check_in))) <= 60
    ) THEN
      INSERT INTO public.hr_attendance (employee_id, check_in, check_out)
      VALUES (v_emp_id, p_check_in, p_check_out);
    END IF;
  END IF;
END;
$fn$ LANGUAGE plpgsql;
