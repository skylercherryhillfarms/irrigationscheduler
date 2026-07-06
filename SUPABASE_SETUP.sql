-- Run this SQL in the Supabase SQL Editor to create the required table

CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  set_name TEXT NOT NULL,
  location TEXT NOT NULL,
  grouping TEXT DEFAULT '',
  acres NUMERIC,
  gpm NUMERIC,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift TEXT NOT NULL CHECK (shift IN ('AM', 'PM', 'Both')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast week lookups
CREATE INDEX IF NOT EXISTS idx_schedule_week ON schedule_entries(week_start);

-- Location notes (persistent per-location notes shown on master schedule)
CREATE TABLE IF NOT EXISTS location_notes (
  location TEXT PRIMARY KEY,
  notes TEXT DEFAULT ''
);

ALTER TABLE location_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON location_notes
  FOR ALL USING (true) WITH CHECK (true);

-- Per-week AM/PM slot start times (location + week + day + shift)
CREATE TABLE IF NOT EXISTS slot_times (
  location TEXT NOT NULL,
  week_start DATE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  shift TEXT NOT NULL CHECK (shift IN ('AM', 'PM')),
  start_time TEXT DEFAULT '',
  PRIMARY KEY (location, week_start, day_of_week, shift)
);

ALTER TABLE slot_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON slot_times
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Row Level Security (allow public read/write for this app)
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON schedule_entries
  FOR ALL USING (true) WITH CHECK (true);
