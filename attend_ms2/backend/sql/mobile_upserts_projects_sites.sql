-- mobile_upserts_projects_sites.sql (run on attendance_db)
-- Purpose: Provide idempotent UPSERTs for projects and sites coming from ERP via dblink.
-- Also defines a simple ERP→mobile company mapping table.

CREATE TABLE IF NOT EXISTS public.company_map (
  erp_company_id integer PRIMARY KEY,
  mobile_company_id varchar(12) NOT NULL REFERENCES public.companies(id)
);

-- Stable ID mappings to ensure mobile IDs (varchar(12)) never overflow
CREATE TABLE IF NOT EXISTS public.project_map (
  erp_id integer PRIMARY KEY,
  mobile_id varchar(12) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.site_map (
  erp_id integer PRIMARY KEY,
  mobile_id varchar(12) NOT NULL UNIQUE
);

-- Helper: resolve mobile company id from ERP company id
CREATE OR REPLACE FUNCTION public._mobile_company_id(p_erp_company_id integer)
RETURNS varchar AS $fn$
DECLARE v_id varchar; v_any varchar;
BEGIN
  IF p_erp_company_id IS NOT NULL THEN
    SELECT mobile_company_id INTO v_id FROM public.company_map WHERE erp_company_id = p_erp_company_id;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;
  -- fallback to first existing company (deterministic by id)
  SELECT id INTO v_any FROM public.companies ORDER BY id LIMIT 1;
  RETURN v_any;
END;
$fn$ LANGUAGE plpgsql;

-- Upsert project
CREATE OR REPLACE FUNCTION public.upsert_project_from_erp(
  p_erp_id integer,
  p_name text,
  p_code text,
  p_active boolean,
  p_erp_company_id integer,
  p_write_date timestamptz
) RETURNS void AS $fn$
DECLARE
  v_id text;
  v_company_id text;
  v_status varchar;
BEGIN
  -- Resolve stable short ID for mobile (<=12 chars)
  SELECT pm.mobile_id INTO v_id FROM public.project_map pm WHERE pm.erp_id = p_erp_id;
  IF v_id IS NULL THEN
    INSERT INTO public.project_map(erp_id, mobile_id)
    VALUES (p_erp_id, gen_short_id('PRJ_'))
    ON CONFLICT (erp_id) DO NOTHING;
    SELECT pm.mobile_id INTO v_id FROM public.project_map pm WHERE pm.erp_id = p_erp_id;
  END IF;
  v_company_id := public._mobile_company_id(p_erp_company_id);
  v_status := CASE WHEN COALESCE(p_active, TRUE) THEN 'active' ELSE 'inactive' END;

  INSERT INTO public.projects (id, company_id, code, name, status, updated_at)
  VALUES (v_id, v_company_id, p_code, p_name, v_status, COALESCE(p_write_date, now()))
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    code       = EXCLUDED.code,
    name       = EXCLUDED.name,
    status     = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;
END;
$fn$ LANGUAGE plpgsql;

-- Upsert site
CREATE OR REPLACE FUNCTION public.upsert_site_from_erp(
  p_erp_id integer,
  p_name text,
  p_code text,
  p_active boolean,
  p_erp_company_id integer,
  p_lat numeric DEFAULT NULL,
  p_lon numeric DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_write_date timestamptz DEFAULT NULL
) RETURNS void AS $fn$
DECLARE
  v_id text;
  v_company_id text;
BEGIN
  -- Resolve stable short ID for mobile (<=12 chars)
  SELECT sm.mobile_id INTO v_id FROM public.site_map sm WHERE sm.erp_id = p_erp_id;
  IF v_id IS NULL THEN
    INSERT INTO public.site_map(erp_id, mobile_id)
    VALUES (p_erp_id, gen_short_id('SIT_'))
    ON CONFLICT (erp_id) DO NOTHING;
    SELECT sm.mobile_id INTO v_id FROM public.site_map sm WHERE sm.erp_id = p_erp_id;
  END IF;
  v_company_id := public._mobile_company_id(p_erp_company_id);

  INSERT INTO public.sites (id, company_id, code, name, latitude, longitude, address, updated_at)
  VALUES (v_id, v_company_id, p_code, p_name, p_lat, p_lon, p_address, COALESCE(p_write_date, now()))
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    code       = EXCLUDED.code,
    name       = EXCLUDED.name,
    latitude   = EXCLUDED.latitude,
    longitude  = EXCLUDED.longitude,
    address    = EXCLUDED.address,
    updated_at = EXCLUDED.updated_at;
END;
$fn$ LANGUAGE plpgsql;
