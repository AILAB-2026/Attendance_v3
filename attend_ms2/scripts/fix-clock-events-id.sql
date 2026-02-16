-- Fix clock_events primary key collisions by switching to random short IDs
-- Safer default that avoids sequence resets/race conditions

ALTER TABLE clock_events
  ALTER COLUMN id SET DEFAULT gen_short_id('CLK_');
