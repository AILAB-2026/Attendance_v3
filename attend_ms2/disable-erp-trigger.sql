-- Option 1: Disable ERP sync trigger completely
-- Use this if you don't want automatic ERP sync

-- Disable the trigger (keeps it but doesn't execute)
ALTER TABLE attendance_entries DISABLE TRIGGER trg_push_attendance_entries_to_erp;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'ERP sync trigger DISABLED successfully!';
  RAISE NOTICE 'Clock-in will now work without trying to sync to ERP';
  RAISE NOTICE 'You can manually sync using sync scripts if needed';
  RAISE NOTICE '';
  RAISE NOTICE 'To re-enable later: ALTER TABLE attendance_entries ENABLE TRIGGER trg_push_attendance_entries_to_erp;';
END $$;
