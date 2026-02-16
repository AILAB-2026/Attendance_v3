-- attendance_upsert.sql
-- Creates helper function in attendance_db to upsert mapping and users based on Odoo employee data

CREATE OR REPLACE FUNCTION public.upsert_user_from_employee(
  p_odoo_employee_id integer,
  p_name text,
  p_work_email text,
  p_work_phone text,
  p_mobile_phone text,
  p_barcode text,
  p_identification_id text,
  p_active boolean,
  p_write_date timestamptz,
  p_emp_no text,
  p_default_company_code text DEFAULT 'ABC123',
  p_default_email_domain text DEFAULT 'skktech.com.sg',
  p_default_password text DEFAULT 'password123'
) RETURNS void AS $$
DECLARE
  v_company_id text;
  v_email text;
  v_phone text;
  v_user_id text;
  -- Column existence flags
  has_role boolean;
  has_phone boolean;
  has_company_id boolean;
  has_emp_no boolean;
  has_active boolean;
  has_password boolean;
BEGIN
  -- Resolve company_id default if users.company_id exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='users' AND column_name='company_id'
  ) INTO has_company_id;

  IF has_company_id THEN
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE company_code = p_default_company_code
    LIMIT 1;
    IF v_company_id IS NULL THEN
      SELECT id INTO v_company_id FROM public.companies ORDER BY created_at NULLS LAST, id LIMIT 1;
    END IF;
  END IF;

  -- Determine feature columns in users
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='role') INTO has_role;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='phone') INTO has_phone;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='emp_no') INTO has_emp_no;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='active') INTO has_active;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='password') INTO has_password;

  -- Choose email with fallback if required
  v_email := NULLIF(p_work_email, '');
  IF v_email IS NULL AND p_emp_no IS NOT NULL AND p_default_email_domain IS NOT NULL THEN
    v_email := lower(regexp_replace(p_emp_no, '[^a-zA-Z0-9]+', '.', 'g')) || '@' || p_default_email_domain;
  END IF;

  v_phone := COALESCE(NULLIF(p_mobile_phone,''), NULLIF(p_work_phone,''));

  -- Upsert mapping table (prefer emp_no as canonical mapping key)
  -- 1) Try update by emp_no if a row already exists for this employee number
  PERFORM 1 FROM public.odoo_user_map WHERE emp_no = p_emp_no;
  IF FOUND THEN
    UPDATE public.odoo_user_map SET
      odoo_employee_id   = p_odoo_employee_id,
      user_id            = p_emp_no,
      name               = p_name,
      email              = v_email,
      barcode            = p_barcode,
      work_phone         = p_work_phone,
      mobile_phone       = p_mobile_phone,
      active             = p_active,
      last_hr_write_date = p_write_date,
      updated_at         = now()
    WHERE emp_no = p_emp_no;
  ELSE
    -- 2) Otherwise, try update by odoo_employee_id if present
    PERFORM 1 FROM public.odoo_user_map WHERE odoo_employee_id = p_odoo_employee_id;
    IF FOUND THEN
      UPDATE public.odoo_user_map SET
        emp_no             = p_emp_no,
        user_id            = p_emp_no,
        name               = p_name,
        email              = v_email,
        barcode            = p_barcode,
        work_phone         = p_work_phone,
        mobile_phone       = p_mobile_phone,
        active             = p_active,
        last_hr_write_date = p_write_date,
        updated_at         = now()
      WHERE odoo_employee_id = p_odoo_employee_id;
    ELSE
      -- 3) No existing row by either key; insert new
      INSERT INTO public.odoo_user_map (
        odoo_employee_id, user_id, emp_no, name, email, barcode, work_phone, mobile_phone, active, last_hr_write_date, updated_at
      ) VALUES (
        p_odoo_employee_id, p_emp_no, p_emp_no, p_name, v_email, p_barcode, p_work_phone, p_mobile_phone, p_active, p_write_date, now()
      );
    END IF;
  END IF;

  -- Try to find existing user
  SELECT id INTO v_user_id FROM public.users WHERE v_email IS NOT NULL AND LOWER(email)=LOWER(v_email) LIMIT 1;
  IF v_user_id IS NULL AND has_emp_no AND p_emp_no IS NOT NULL THEN
    SELECT id INTO v_user_id FROM public.users WHERE emp_no = p_emp_no LIMIT 1;
  END IF;
  IF v_user_id IS NULL AND p_barcode IS NOT NULL THEN
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='barcode';
    IF FOUND THEN
      SELECT id INTO v_user_id FROM public.users WHERE barcode = p_barcode LIMIT 1;
    END IF;
  END IF;
  IF v_user_id IS NULL AND p_name IS NOT NULL THEN
    SELECT id INTO v_user_id FROM public.users WHERE name = p_name LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL THEN
    -- Update existing
    EXECUTE format('UPDATE public.users SET name=%L%s%s%s%s%s, updated_at=now() WHERE id=%L',
      p_name,
      CASE WHEN v_email IS NOT NULL THEN format(', email=%L', v_email) ELSE '' END,
      CASE WHEN has_role THEN ', role=''employee''' ELSE '' END,
      CASE WHEN has_active THEN format(', active=%L', p_active) ELSE '' END,
      CASE WHEN has_emp_no AND p_emp_no IS NOT NULL THEN format(', emp_no=%L', p_emp_no) ELSE '' END,
      CASE WHEN has_phone AND v_phone IS NOT NULL THEN format(', phone=%L', v_phone) ELSE '' END,
      v_user_id
    );
  ELSE
    -- Insert new if we can satisfy basic required fields
    -- Determine if email is required (not null without default)
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='email' AND is_nullable='NO' AND column_default IS NULL;
    IF FOUND AND v_email IS NULL THEN
      -- cannot insert without email
      RETURN;
    END IF;

    -- Build and execute insert dynamically
    EXECUTE format('INSERT INTO public.users (%s) VALUES (%s)',
      array_to_string(ARRAY[
        'name',
        CASE WHEN v_email IS NOT NULL THEN 'email' ELSE NULL END,
        CASE WHEN has_role THEN 'role' ELSE NULL END,
        CASE WHEN has_active THEN 'active' ELSE NULL END,
        CASE WHEN has_emp_no AND p_emp_no IS NOT NULL THEN 'emp_no' ELSE NULL END,
        CASE WHEN has_phone AND v_phone IS NOT NULL THEN 'phone' ELSE NULL END,
        CASE WHEN has_company_id AND v_company_id IS NOT NULL THEN 'company_id' ELSE NULL END,
        CASE WHEN has_password THEN 'password' ELSE NULL END
      ]::text[], ', '),
      array_to_string(ARRAY[
        quote_nullable(p_name),
        CASE WHEN v_email IS NOT NULL THEN quote_nullable(v_email) ELSE NULL END,
        CASE WHEN has_role THEN quote_nullable('employee') ELSE NULL END,
        CASE WHEN has_active THEN quote_nullable(p_active::text) ELSE NULL END,
        CASE WHEN has_emp_no AND p_emp_no IS NOT NULL THEN quote_nullable(p_emp_no) ELSE NULL END,
        CASE WHEN has_phone AND v_phone IS NOT NULL THEN quote_nullable(v_phone) ELSE NULL END,
        CASE WHEN has_company_id AND v_company_id IS NOT NULL THEN quote_nullable(v_company_id) ELSE NULL END,
        CASE WHEN has_password THEN quote_nullable(p_default_password) ELSE NULL END
      ]::text[], ', ')
    );
  END IF;
END;
$$ LANGUAGE plpgsql;
