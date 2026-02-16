-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()

-- Function: upsert_user_session
CREATE OR REPLACE FUNCTION upsert_user_session(
  p_user_id VARCHAR,
  p_session_token VARCHAR,
  p_refresh_token VARCHAR,
  p_expires_at TIMESTAMP,
  p_device_info JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
  v_id VARCHAR;
BEGIN
  INSERT INTO user_sessions (user_id, session_token, refresh_token, expires_at, device_info, ip_address, is_active)
  VALUES (p_user_id, p_session_token, p_refresh_token, p_expires_at, p_device_info, p_ip_address, true)
  ON CONFLICT (session_token)
  DO UPDATE SET refresh_token = EXCLUDED.refresh_token,
                expires_at = EXCLUDED.expires_at,
                device_info = EXCLUDED.device_info,
                ip_address = EXCLUDED.ip_address,
                updated_at = CURRENT_TIMESTAMP,
                is_active = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function: recompute_day_hours
-- Recalculates normal_hours and overtime_hours for a specific (user_id, date)
CREATE OR REPLACE FUNCTION recompute_day_hours(
  p_user_id VARCHAR,
  p_date DATE
) RETURNS VOID AS $$
DECLARE
  v_attendance_id VARCHAR;
  v_work_start VARCHAR(5);
  v_work_end VARCHAR(5);
  v_daily_hours DECIMAL(4,2);
  v_std_start TIMESTAMP;
  v_std_end TIMESTAMP;
  v_within_seconds BIGINT := 0;
  v_before_seconds BIGINT := 0;
  v_after_seconds BIGINT := 0;
  v_break_seconds BIGINT := 0;
  v_ci TIMESTAMP;
  v_co TIMESTAMP;
  v_tmp BIGINT;
  v_normal_hours DECIMAL(4,2);
  v_overtime_hours DECIMAL(4,2);
BEGIN
  SELECT id INTO v_attendance_id FROM attendance_days WHERE user_id = p_user_id AND date = p_date;
  IF v_attendance_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(u.work_start_time, c.work_start_time, '09:00') AS w_start,
    COALESCE(u.work_end_time, c.work_end_time, '18:00') AS w_end,
    COALESCE(c.work_hours_per_day, 8) AS w_hours
  INTO v_work_start, v_work_end, v_daily_hours
  FROM users u
  JOIN companies c ON c.id = u.company_id
  WHERE u.id = p_user_id;

  v_std_start := (p_date::text || ' ' || v_work_start)::timestamp;
  v_std_end := (p_date::text || ' ' || v_work_end)::timestamp;

  FOR v_ci, v_co IN
    SELECT to_timestamp(ci.timestamp/1000), to_timestamp(co.timestamp/1000)
    FROM attendance_entries ae
    JOIN clock_events ci ON ae.clock_in_id = ci.id
    JOIN clock_events co ON ae.clock_out_id = co.id
    WHERE ae.user_id = p_user_id AND ae.date = p_date AND co.timestamp > ci.timestamp
  LOOP
    v_tmp := GREATEST(0, EXTRACT(EPOCH FROM (LEAST(v_co, v_std_end) - GREATEST(v_ci, v_std_start))));
    IF v_tmp > 0 THEN v_within_seconds := v_within_seconds + v_tmp; END IF;
    v_tmp := GREATEST(0, EXTRACT(EPOCH FROM (LEAST(v_co, v_std_start) - v_ci)));
    IF v_tmp > 0 THEN v_before_seconds := v_before_seconds + v_tmp; END IF;
    v_tmp := GREATEST(0, EXTRACT(EPOCH FROM (v_co - GREATEST(v_ci, v_std_end))));
    IF v_tmp > 0 THEN v_after_seconds := v_after_seconds + v_tmp; END IF;
  END LOOP;

  SELECT COALESCE(break_hours, 0) INTO v_normal_hours FROM attendance_days WHERE id = v_attendance_id;
  v_break_seconds := (COALESCE(v_normal_hours, 0)) * 3600;

  v_tmp := GREATEST(0, v_within_seconds - v_break_seconds);
  v_tmp := LEAST(v_tmp, (v_daily_hours * 3600)::bigint);
  v_normal_hours := ROUND( (v_tmp / 3600.0)::numeric, 2);

  v_before_seconds := CASE WHEN v_before_seconds >= 1800 THEN v_before_seconds ELSE 0 END;
  v_after_seconds := CASE WHEN v_after_seconds >= 1800 THEN v_after_seconds ELSE 0 END;
  v_overtime_hours := ROUND( ((v_before_seconds + v_after_seconds) / 3600.0)::numeric, 2);

  UPDATE attendance_days
  SET normal_hours = v_normal_hours,
      overtime_hours = v_overtime_hours,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_attendance_id;
END;
$$ LANGUAGE plpgsql;

-- Migration helper: backfill per-site/project entries from legacy day-level clock_in/clock_out
-- Creates a single default entry (NULL site/project) per day when entries are missing,
-- copying clock_in_id/clock_out_id from attendance_days. Returns number of entries inserted.
CREATE OR REPLACE FUNCTION backfill_attendance_entries() RETURNS INTEGER AS $$
DECLARE
  v_rows INTEGER := 0;
  rec RECORD;
  v_site VARCHAR(100);
  v_project VARCHAR(100);
BEGIN
  FOR rec IN
    SELECT ad.id AS attendance_id, ad.user_id, ad.date, ad.clock_in_id, ad.clock_out_id
    FROM attendance_days ad
    WHERE (ad.clock_in_id IS NOT NULL OR ad.clock_out_id IS NOT NULL)
  LOOP
    -- Derive site/project from clock_in event if present, else from clock_out
    SELECT ce.site_name, ce.project_name
      INTO v_site, v_project
    FROM clock_events ce
    WHERE ce.id = COALESCE(rec.clock_in_id, rec.clock_out_id)
    LIMIT 1;

    -- If no entry exists for this (user, date, site, project), insert one
    IF NOT EXISTS (
      SELECT 1 FROM attendance_entries ae
      WHERE ae.user_id = rec.user_id
        AND ae.date = rec.date
        AND COALESCE(ae.site_name,'') IS NOT DISTINCT FROM COALESCE(v_site,'')
        AND COALESCE(ae.project_name,'') IS NOT DISTINCT FROM COALESCE(v_project,'')
    ) THEN
      INSERT INTO attendance_entries (user_id, date, site_name, project_name, clock_in_id, clock_out_id)
      VALUES (rec.user_id, rec.date, v_site, v_project, rec.clock_in_id, rec.clock_out_id);
      v_rows := v_rows + 1;
    END IF;
  END LOOP;

  RETURN v_rows;
END;
$$ LANGUAGE plpgsql;

-- Function: record_clock_event (creates event and updates attendance_days)
CREATE OR REPLACE FUNCTION record_clock_event(
  p_user_id VARCHAR,
  p_timestamp BIGINT,
  p_type VARCHAR,
  p_latitude DECIMAL(10,8),
  p_longitude DECIMAL(11,8),
  p_address TEXT,
  p_method VARCHAR,
  p_image_uri TEXT,
  p_accuracy DECIMAL(6,2) DEFAULT NULL,
  p_site_name VARCHAR(100) DEFAULT NULL,
  p_project_name VARCHAR(100) DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
  v_event_id VARCHAR;
  v_date DATE;
  v_attendance_id VARCHAR;
  v_clock_in_ts TIMESTAMP;
  v_clock_out_ts TIMESTAMP;
  v_normal_hours DECIMAL(4,2);
  v_overtime_hours DECIMAL(4,2);
  -- Variables for multi-interval calculation
  v_work_start VARCHAR(5);
  v_work_end VARCHAR(5);
  v_daily_hours DECIMAL(4,2);
  v_std_start TIMESTAMP;
  v_std_end TIMESTAMP;
  v_total_seconds BIGINT := 0;
  v_within_seconds BIGINT := 0;
  v_before_seconds BIGINT := 0;
  v_after_seconds BIGINT := 0;
  v_break_seconds BIGINT := 0;
  v_ci TIMESTAMP;
  v_co TIMESTAMP;
  v_tmp BIGINT;
BEGIN
  v_date := to_timestamp(p_timestamp / 1000)::date;

  INSERT INTO clock_events (user_id, timestamp, type, latitude, longitude, address, method, image_uri, accuracy, site_name, project_name)
  VALUES (p_user_id, p_timestamp, p_type, p_latitude, p_longitude, p_address, p_method, p_image_uri, p_accuracy, p_site_name, p_project_name)
  RETURNING id INTO v_event_id;

  -- Ensure attendance day exists
  INSERT INTO attendance_days (user_id, date, status)
  VALUES (p_user_id, v_date, CASE WHEN p_type = 'in' THEN 'present' ELSE 'present' END)
  ON CONFLICT (user_id, date) DO NOTHING;

  -- Upsert into attendance_entries for per-site/project session with uniqueness constraint
  -- If type=in and an entry already has clock_in_id, do not overwrite; raise exception to signal duplicate
  PERFORM 1 FROM attendance_entries
   WHERE user_id = p_user_id AND date = v_date AND
         COALESCE(site_name,'') IS NOT DISTINCT FROM COALESCE(p_site_name,'') AND
         COALESCE(project_name,'') IS NOT DISTINCT FROM COALESCE(p_project_name,'');

  IF FOUND THEN
    -- Entry exists, update appropriate column conditionally
    IF p_type = 'in' THEN
      -- Check if already clocked in for this site/project
      -- Only block if there is an OPEN interval (in without out). If already closed, allow proceeding.
      IF EXISTS (
        SELECT 1 FROM attendance_entries
        WHERE user_id = p_user_id AND date = v_date AND
              COALESCE(site_name,'') IS NOT DISTINCT FROM COALESCE(p_site_name,'') AND
              COALESCE(project_name,'') IS NOT DISTINCT FROM COALESCE(p_project_name,'') AND
              clock_in_id IS NOT NULL AND clock_out_id IS NULL
      ) THEN
        RAISE EXCEPTION 'duplicate clock-in' USING ERRCODE = '23505';
      END IF;
      
      UPDATE attendance_entries
        SET clock_in_id = v_event_id, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id AND date = v_date AND
            COALESCE(site_name,'') IS NOT DISTINCT FROM COALESCE(p_site_name,'') AND
            COALESCE(project_name,'') IS NOT DISTINCT FROM COALESCE(p_project_name,'');
    ELSE
      UPDATE attendance_entries
        SET clock_out_id = v_event_id, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id AND date = v_date AND
            COALESCE(site_name,'') IS NOT DISTINCT FROM COALESCE(p_site_name,'') AND
            COALESCE(project_name,'') IS NOT DISTINCT FROM COALESCE(p_project_name,'');
    END IF;
  ELSE
    -- No entry exists yet: create one
    INSERT INTO attendance_entries (user_id, date, site_name, project_name, clock_in_id, clock_out_id)
    VALUES (
      p_user_id, v_date, p_site_name, p_project_name,
      CASE WHEN p_type = 'in' THEN v_event_id ELSE NULL END,
      CASE WHEN p_type = 'out' THEN v_event_id ELSE NULL END
    );
  END IF;

  -- Attach clock event to attendance day
  UPDATE attendance_days ad
  SET clock_in_id = CASE WHEN p_type = 'in' AND ad.clock_in_id IS NULL THEN v_event_id ELSE ad.clock_in_id END,
      clock_out_id = CASE WHEN p_type = 'out' THEN v_event_id ELSE ad.clock_out_id END,
      updated_at = CURRENT_TIMESTAMP,
      status = 'present'
  WHERE ad.user_id = p_user_id AND ad.date = v_date
  RETURNING id INTO v_attendance_id;

  -- Recompute hours using all intervals for the day (across attendance_entries)
  -- 1) Get schedule (per-user override, else company policy, with defaults)
  SELECT
    COALESCE(u.work_start_time, c.work_start_time, '09:00') AS w_start,
    COALESCE(u.work_end_time, c.work_end_time, '18:00') AS w_end,
    COALESCE(c.work_hours_per_day, 8) AS w_hours
  INTO v_work_start, v_work_end, v_daily_hours
  FROM users u
  JOIN companies c ON c.id = u.company_id
  WHERE u.id = p_user_id;

  -- 2) Build standard window timestamps for the given date
  v_std_start := (v_date::text || ' ' || v_work_start)::timestamp;
  v_std_end := (v_date::text || ' ' || v_work_end)::timestamp;

  -- 3) Iterate through all completed intervals for this user/date
  FOR v_ci, v_co IN
    SELECT to_timestamp(ci.timestamp/1000), to_timestamp(co.timestamp/1000)
    FROM attendance_entries ae
    JOIN clock_events ci ON ae.clock_in_id = ci.id
    JOIN clock_events co ON ae.clock_out_id = co.id
    WHERE ae.user_id = p_user_id AND ae.date = v_date AND co.timestamp > ci.timestamp
  LOOP
    -- total interval seconds
    v_tmp := EXTRACT(EPOCH FROM (v_co - v_ci));
    IF v_tmp > 0 THEN
      v_total_seconds := v_total_seconds + v_tmp;
    END IF;

    -- overlap within standard window
    v_tmp := GREATEST(0, EXTRACT(EPOCH FROM (LEAST(v_co, v_std_end) - GREATEST(v_ci, v_std_start))));
    IF v_tmp > 0 THEN v_within_seconds := v_within_seconds + v_tmp; END IF;

    -- before standard window
    v_tmp := GREATEST(0, EXTRACT(EPOCH FROM (LEAST(v_co, v_std_start) - v_ci)));
    IF v_tmp > 0 THEN v_before_seconds := v_before_seconds + v_tmp; END IF;

    -- after standard window
    v_tmp := GREATEST(0, EXTRACT(EPOCH FROM (v_co - GREATEST(v_ci, v_std_end))));
    IF v_tmp > 0 THEN v_after_seconds := v_after_seconds + v_tmp; END IF;
  END LOOP;

  -- 4) Breaks (stored in attendance_days as hours)
  SELECT COALESCE(break_hours, 0) INTO v_normal_hours FROM attendance_days WHERE id = v_attendance_id;
  v_break_seconds := (COALESCE(v_normal_hours, 0)) * 3600;

  -- 5) Normal hours: time within standard window minus breaks, capped to daily standard hours
  v_tmp := GREATEST(0, v_within_seconds - v_break_seconds);
  v_tmp := LEAST(v_tmp, (v_daily_hours * 3600)::bigint);
  v_normal_hours := ROUND( (v_tmp / 3600.0)::numeric, 2);

  -- 6) Overtime: only before/after standard time and only if >= 30 minutes each side
  v_before_seconds := CASE WHEN v_before_seconds >= 1800 THEN v_before_seconds ELSE 0 END;
  v_after_seconds := CASE WHEN v_after_seconds >= 1800 THEN v_after_seconds ELSE 0 END;
  v_overtime_hours := ROUND( ((v_before_seconds + v_after_seconds) / 3600.0)::numeric, 2);

  -- 7) Persist
  UPDATE attendance_days
  SET normal_hours = v_normal_hours,
      overtime_hours = v_overtime_hours,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = v_attendance_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: get_user_attendance_range
CREATE OR REPLACE FUNCTION get_user_attendance_range(
  p_user_id VARCHAR,
  p_start DATE,
  p_end DATE
) RETURNS TABLE (
  attendance_id VARCHAR,
  attendance_date DATE,
  normal_hours DECIMAL(4,2),
  overtime_hours DECIMAL(4,2),
  status VARCHAR,
  clock_in_time TIMESTAMP,
  clock_out_time TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT ad.id,
         ad.date,
         ad.normal_hours,
         ad.overtime_hours,
         ad.status,
         to_timestamp(ce_in.timestamp / 1000),
         to_timestamp(ce_out.timestamp / 1000)
  FROM attendance_days ad
  LEFT JOIN clock_events ce_in ON ad.clock_in_id = ce_in.id
  LEFT JOIN clock_events ce_out ON ad.clock_out_id = ce_out.id
  WHERE ad.user_id = p_user_id AND ad.date BETWEEN p_start AND p_end
  ORDER BY ad.date ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: apply_leave (validates balance and inserts)
CREATE OR REPLACE FUNCTION apply_leave(
  p_user_id VARCHAR,
  p_start_date DATE,
  p_end_date DATE,
  p_type VARCHAR,
  p_reason TEXT,
  p_attachment_uri TEXT DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
  v_id VARCHAR;
  v_days INTEGER;
  v_balance INTEGER;
BEGIN
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date cannot be before start date';
  END IF;

  v_days := (p_end_date - p_start_date) + 1;

  -- Check balances for paid leave types
  IF p_type IN ('annual','medical','emergency') THEN
    SELECT CASE p_type
             WHEN 'annual' THEN annual_leave_balance
             WHEN 'medical' THEN medical_leave_balance
             WHEN 'emergency' THEN emergency_leave_balance
           END
    INTO v_balance
    FROM users WHERE id = p_user_id FOR UPDATE;

    IF v_balance IS NULL THEN
      RAISE EXCEPTION 'User not found';
    END IF;
    IF v_balance < v_days THEN
      RAISE EXCEPTION 'Insufficient % leave balance. Needed: %, Available: %', p_type, v_days, v_balance;
    END IF;

    -- Reserve balance immediately
    UPDATE users SET
      annual_leave_balance = CASE WHEN p_type='annual' THEN annual_leave_balance - v_days ELSE annual_leave_balance END,
      medical_leave_balance = CASE WHEN p_type='medical' THEN medical_leave_balance - v_days ELSE medical_leave_balance END,
      emergency_leave_balance = CASE WHEN p_type='emergency' THEN emergency_leave_balance - v_days ELSE emergency_leave_balance END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_user_id;
  END IF;

  INSERT INTO leaves (user_id, start_date, end_date, type, reason, attachment_uri, status)
  VALUES (p_user_id, p_start_date, p_end_date, p_type, p_reason, p_attachment_uri, 'pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Procedure: update_leave_status
CREATE OR REPLACE PROCEDURE update_leave_status(
  p_leave_id VARCHAR,
  p_status VARCHAR,
  p_approver_id VARCHAR,
  p_rejected_reason TEXT DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_leave RECORD;
  v_days INTEGER;
BEGIN
  IF p_status NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'Invalid status %', p_status;
  END IF;

  SELECT * INTO v_leave FROM leaves WHERE id = p_leave_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Leave not found';
  END IF;

  v_days := (v_leave.end_date - v_leave.start_date) + 1;

  -- If rejected, restore balance for paid types
  IF p_status = 'rejected' AND v_leave.type IN ('annual','medical','emergency') THEN
    UPDATE users SET
      annual_leave_balance = CASE WHEN v_leave.type='annual' THEN annual_leave_balance + v_days ELSE annual_leave_balance END,
      medical_leave_balance = CASE WHEN v_leave.type='medical' THEN medical_leave_balance + v_days ELSE medical_leave_balance END,
      emergency_leave_balance = CASE WHEN v_leave.type='emergency' THEN emergency_leave_balance + v_days ELSE emergency_leave_balance END,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = v_leave.user_id;
  END IF;

  UPDATE leaves SET
    status = p_status,
    approved_by = p_approver_id,
    approved_at = CASE WHEN p_status='approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
    rejected_reason = CASE WHEN p_status='rejected' THEN p_rejected_reason ELSE NULL END,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_leave_id;
END;
$$;

-- Function: mark_payslip_viewed
CREATE OR REPLACE FUNCTION mark_payslip_viewed(p_payslip_id VARCHAR) RETURNS VOID AS $$
BEGIN
  UPDATE payslips SET status = 'viewed', updated_at = CURRENT_TIMESTAMP WHERE id = p_payslip_id;
END;
$$ LANGUAGE plpgsql;

-- Function: get_payslips_by_user
CREATE OR REPLACE FUNCTION get_payslips_by_user(p_user_id VARCHAR)
RETURNS SETOF payslips AS $$
BEGIN
  RETURN QUERY SELECT * FROM payslips WHERE user_id = p_user_id ORDER BY pay_date DESC;
END;
$$ LANGUAGE plpgsql;
