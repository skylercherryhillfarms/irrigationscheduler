import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// SQL to run in Supabase SQL editor to create the table:
// CREATE TABLE schedule_entries (
//   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//   week_start DATE NOT NULL,
//   set_name TEXT NOT NULL,
//   location TEXT NOT NULL,
//   grouping TEXT DEFAULT '',
//   acres NUMERIC,
//   gpm NUMERIC,
//   day_of_week INTEGER NOT NULL,
//   shift TEXT NOT NULL CHECK (shift IN ('AM', 'PM', 'Both')),
//   notes TEXT DEFAULT '',
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX idx_schedule_week ON schedule_entries(week_start);
