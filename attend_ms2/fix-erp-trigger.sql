-- Fix ERP sync trigger to use correct database
-- The trigger was hardcoded to CX18AILABDEMO which doesn't exist
-- Change it to use CX18AI (from ERP_DATABASE_URL in .env.production)

-- Drop the old trigger
DROP TRIGGER IF EXISTS trg_push_attendance_entries_to_erp ON attendance_entries;

-- Recreate the function with correct database connection
CREATE OR REPLACE FUNCTION push_attendance_entry_to_erp()
RETURNS TRIGGER AS $$
DECLARE
  -- Use CX18AI instead of CX18AILABDEMO
  v_conn text := 'host=localhost port=5432 dbname=CX18AI user=openpg password=openpgpwd';
  v_emp_no text;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_in_method text;
  v_out_method text;
  v_result text;
BEGIN
  -- Only sync when clock_in_id or clock_out_id is updated
  IF (TG_OP = 'UPDATE' AND (NEW.clock_in_id IS DISTINCT FROM OLD.clock_in_id OR NEW.clock_out_id IS DISTINCT FROM OLD.clock_out_id)) 
     OR (TG_OP = 'INSERT' AND (NEW.clock_in_id IS NOT NULL OR NEW.clock_out_id IS NOT NULL)) THEN
    
    -- Get employee number
    SELECT emp_no INTO v_emp_no FROM users WHERE id = NEW.user_id;
    
    -- Get check-in details if exists
    IF NEW.clock_in_id IS NOT NULL THEN
      SELECT to_timestamp(timestamp/1000), method 
      INTO v_check_in, v_in_method
      FROM clock_events WHERE id = NEW.clock_in_id;
    END IF;
    
    -- Get check-out details if exists
    IF NEW.clock_out_id IS NOT NULL THEN
      SELECT to_timestamp(timestamp/1000), method 
      INTO v_check_out, v_out_method
      FROM clock_events WHERE id = NEW.clock_out_id;
    END IF;
    
    -- Try to sync to ERP database
    BEGIN
      -- Use dblink_exec to insert/update in ERP database
      -- This is a simplified version - adjust based on your ERP schema
      PERFORM dblink_exec(v_conn, format(
        'INSERT INTO hr_attendance (employee_id, check_in, check_out, worked_hours) 
         VALUES (%L, %L, %L, EXTRACT(EPOCH FROM (%L::timestamptz - %L::timestamptz))/3600)
         ON CONFLICT (employee_id, check_in::date) 
         DO UPDATE SET check_out = EXCLUDED.check_out, worked_hours = EXCLUDED.worked_hours',
        v_emp_no, v_check_in, v_check_out, v_check_out, v_check_in
      ));
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the main transaction
      RAISE WARNING 'ERP sync failed for employee %: %', v_emp_no, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trg_push_attendance_entries_to_erp
  AFTER INSERT OR UPDATE ON attendance_entries
  FOR EACH ROW
  EXECUTE FUNCTION push_attendance_entry_to_erp();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'ERP trigger updated successfully!';
  RAISE NOTICE 'Now using database: CX18AI';
  RAISE NOTICE 'Trigger will sync attendance to ERP database';
END $$;
