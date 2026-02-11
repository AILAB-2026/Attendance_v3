-- Test record_clock_event function directly
-- Run: $env:PGPASSWORD = "openpgpwd"; psql -U openpg -h localhost -p 5432 -d attendance_db -f test-function-directly.sql

-- Get a test user ID
\echo 'Getting test user...'
SELECT id, emp_no, name FROM users WHERE is_active = true LIMIT 1;

-- Store user ID in a variable and test the function
\echo ''
\echo 'Testing record_clock_event function...'
DO $$
DECLARE
  v_user_id VARCHAR;
  v_event_id VARCHAR;
BEGIN
  -- Get first active user
  SELECT id INTO v_user_id FROM users WHERE is_active = true LIMIT 1;
  
  RAISE NOTICE 'Using user ID: %', v_user_id;
  
  -- Try to call record_clock_event
  BEGIN
    SELECT record_clock_event(
      v_user_id,
      extract(epoch from NOW())::bigint * 1000,
      'in',
      3.1390,
      101.6869,
      'Test Location',
      'button',
      NULL,
      NULL,
      'TNJ - OFFICE',
      'AI LAB'
    ) INTO v_event_id;
    
    RAISE NOTICE 'SUCCESS! Event ID: %', v_event_id;
    
    -- Clean up test data
    DELETE FROM clock_events WHERE id = v_event_id;
    RAISE NOTICE 'Test data cleaned up';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
    RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
    RAISE NOTICE 'DETAIL: %', SQLERRM;
  END;
END $$;
