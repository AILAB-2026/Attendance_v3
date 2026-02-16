-- erp_clocking_upsert.sql (run on ERP DB: CX18AILABDEMO)
-- Purpose: Upsert into custom table public.employee_clocking_line using Employee No and in/out timestamps

-- Helper to resolve employee_id from Employee No (covers multiple custom fields)
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

-- Upsert into employee_clocking_line
CREATE OR REPLACE FUNCTION public.upsert_employee_clocking_line_by_empno(
  p_emp_no       text,
  p_in_ts        timestamptz,
  p_out_ts       timestamptz DEFAULT NULL,
  p_in_method    text DEFAULT NULL,    -- 'face' | 'button' or NULL
  p_out_method   text DEFAULT NULL,
  p_in_lat       numeric DEFAULT NULL,
  p_in_lon       numeric DEFAULT NULL,
  p_out_lat      numeric DEFAULT NULL,
  p_out_lon      numeric DEFAULT NULL,
  p_in_addr      text DEFAULT NULL,
  p_out_addr     text DEFAULT NULL,
  p_attendance_type text DEFAULT NULL
) RETURNS void AS $fn$
DECLARE
  v_emp_id integer;
  v_emp_company_id integer;
  v_clock_in_str text;
  v_clock_out_str text;
  v_clock_in_date date;
  v_clock_out_date date;
  v_attendance_date date;
  v_header_id integer;
  v_att_type text;
BEGIN
  IF p_emp_no IS NULL OR p_in_ts IS NULL THEN
    RETURN; -- insufficient data
  END IF;

  v_emp_id := public._emp_id_by_empno(p_emp_no);
  IF v_emp_id IS NULL THEN
    RETURN; -- employee does not exist in ERP
  END IF;

  -- Get employee's company for secondary header match
  SELECT company_id INTO v_emp_company_id FROM public.hr_employee WHERE id = v_emp_id;

  -- Format strings as existing module stores varchar for times
  v_clock_in_str  := to_char(p_in_ts,  'YYYY-MM-DD HH24:MI:SS');
  v_clock_out_str := CASE WHEN p_out_ts IS NULL THEN NULL ELSE to_char(p_out_ts, 'YYYY-MM-DD HH24:MI:SS') END;
  v_clock_in_date := (p_in_ts)::date;
  v_clock_out_date := CASE WHEN p_out_ts IS NULL THEN NULL ELSE (p_out_ts)::date END;
  v_attendance_date := v_clock_in_date;

  -- Try header by company + date
  IF v_emp_company_id IS NOT NULL THEN
    SELECT ec.id INTO v_header_id
    FROM public.employee_clocking ec
    WHERE ec.company_id = v_emp_company_id
      AND ec.date = v_attendance_date
    ORDER BY ec.id DESC
    LIMIT 1;
  END IF;

  -- Fallback: try any header by date
  IF v_header_id IS NULL THEN
    SELECT ec.id INTO v_header_id
    FROM public.employee_clocking ec
    WHERE ec.date = v_attendance_date
    ORDER BY ec.id DESC
    LIMIT 1;
  END IF;

  -- Auto-create header if still not found
  IF v_header_id IS NULL THEN
    -- Decide attendance_type: prefer provided param; else pick most common existing; else 'manual'
    v_att_type := COALESCE(p_attendance_type,
                    (SELECT attendance_type
                     FROM public.employee_clocking
                     WHERE attendance_type IS NOT NULL
                     GROUP BY attendance_type
                     ORDER BY COUNT(*) DESC
                     LIMIT 1),
                    'manual');

    INSERT INTO public.employee_clocking (date, attendance_type, company_id, create_date, write_date)
    VALUES (v_attendance_date, v_att_type, v_emp_company_id, now(), now())
    RETURNING id INTO v_header_id;
  END IF;

  -- Try update existing by exact (employee_id, clock_in)
  UPDATE public.employee_clocking_line
  SET clock_out = COALESCE(v_clock_out_str, clock_out),
      clock_out_date = COALESCE(v_clock_out_date, clock_out_date),
      out_lat = COALESCE(CASE WHEN p_out_lat IS NULL THEN NULL ELSE p_out_lat::text END, out_lat),
      out_lan = COALESCE(CASE WHEN p_out_lon IS NULL THEN NULL ELSE p_out_lon::text END, out_lan),
      clock_out_location = COALESCE(p_out_addr, clock_out_location),
      attendance_id = COALESCE(attendance_id, v_header_id),
      write_date = now()
  WHERE employee_id = v_emp_id AND clock_in = v_clock_in_str;

  IF NOT FOUND THEN
    -- Insert only if no near-duplicate within 60s around in_ts
    IF NOT EXISTS (
      SELECT 1 FROM public.employee_clocking_line ecl
      WHERE ecl.employee_id = v_emp_id
        AND abs(extract(epoch FROM (to_timestamp(ecl.clock_in, 'YYYY-MM-DD HH24:MI:SS') - p_in_ts))) <= 60
    ) THEN
      INSERT INTO public.employee_clocking_line (
        employee_id, employee_no,
        clock_in, clock_out,
        clock_in_date, clock_out_date, attendance_date,
        clock_in_location, clock_out_location,
        in_lat, in_lan, out_lat, out_lan,
        attendance_id,
        is_mobile_clocking,
        create_date, write_date
      ) VALUES (
        v_emp_id, p_emp_no,
        v_clock_in_str, v_clock_out_str,
        v_clock_in_date, v_clock_out_date, v_attendance_date,
        p_in_addr, p_out_addr,
        CASE WHEN p_in_lat  IS NULL THEN NULL ELSE p_in_lat::text  END,
        CASE WHEN p_in_lon  IS NULL THEN NULL ELSE p_in_lon::text  END,
        CASE WHEN p_out_lat IS NULL THEN NULL ELSE p_out_lat::text END,
        CASE WHEN p_out_lon IS NULL THEN NULL ELSE p_out_lon::text END,
        v_header_id,
        1,
        now(), now()
      );
    END IF;
  END IF;
END;
$fn$ LANGUAGE plpgsql;
