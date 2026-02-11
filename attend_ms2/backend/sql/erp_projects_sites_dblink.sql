-- erp_projects_sites_dblink.sql (run on ERP DB: CX18AILABDEMO)
-- Purpose: On INSERT/UPDATE of ERP projects and sites, push to attendance_db via dblink.

CREATE EXTENSION IF NOT EXISTS dblink;

-- Push one project to mobile DB
CREATE OR REPLACE FUNCTION public.push_project_to_mobile()
RETURNS trigger AS $fn$
DECLARE
  v_conn text := 'host=localhost port=5432 dbname=attendance_db user=openpg password=openpgpwd';
  v_name text;
  v_sql text;
BEGIN
  v_name := COALESCE(NEW.name->>'en_US', NEW.name::text);

  v_sql := format(
    'DO $$ BEGIN PERFORM public.upsert_project_from_erp(%s, %L, %L, %s, %s, %L::timestamptz); END $$;',
    NEW.id,
    v_name,
    NEW.project_id,
    CASE WHEN COALESCE(NEW.active, TRUE) THEN 'TRUE' ELSE 'FALSE' END,
    COALESCE(NEW.company_id, 0),
    COALESCE(to_char(NEW.write_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS TZH:TZM'), to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS TZH:TZM'))
  );

  PERFORM dblink_exec(v_conn, v_sql);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_push_project_to_mobile ON public.project_project;
CREATE TRIGGER trg_push_project_to_mobile
AFTER INSERT OR UPDATE ON public.project_project
FOR EACH ROW EXECUTE FUNCTION public.push_project_to_mobile();

-- Push one site to mobile DB
-- Assumes ERP table name: public.site_location
CREATE OR REPLACE FUNCTION public.push_site_to_mobile()
RETURNS trigger AS $fn$
DECLARE
  v_conn text := 'host=localhost port=5432 dbname=attendance_db user=openpg password=openpgpwd';
  v_sql text;
BEGIN
  v_sql := format(
    'DO $$ BEGIN PERFORM public.upsert_site_from_erp(%s, %L, %L, %s, %s, %s, %s, %L, %L::timestamptz); END $$;',
    NEW.id,
    NEW.name,
    NEW.sitecode,
    CASE WHEN COALESCE(NEW.active, TRUE) THEN 'TRUE' ELSE 'FALSE' END,
    COALESCE(NEW.company_id, 0),
    CASE WHEN NEW.ai_lat IS NULL THEN 'NULL' ELSE quote_literal(NEW.ai_lat)::text END,
    CASE WHEN NEW.ai_log IS NULL THEN 'NULL' ELSE quote_literal(NEW.ai_log)::text END,
    NEW.site_location, -- address/text if present; NULL ok
    COALESCE(to_char(NEW.write_date, 'YYYY-MM-DD"T"HH24:MI:SS.MS TZH:TZM'), to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS TZH:TZM'))
  );

  PERFORM dblink_exec(v_conn, v_sql);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_push_site_to_mobile ON public.site_location;
CREATE TRIGGER trg_push_site_to_mobile
AFTER INSERT OR UPDATE ON public.site_location
FOR EACH ROW EXECUTE FUNCTION public.push_site_to_mobile();
