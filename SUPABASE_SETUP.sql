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

-- Enable Row Level Security (allow public read/write for this app)
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON schedule_entries
  FOR ALL USING (true) WITH CHECK (true);
