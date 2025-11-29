import { createClient } from '@supabase/supabase-js';

// REPLACE THESE WITH YOUR ACTUAL SUPABASE KEYS
const supabaseUrl = 'https://udmnaaqvdlckyhexuyqv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbW5hYXF2ZGxja3loZXh1eXF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjk0MDksImV4cCI6MjA3OTc0NTQwOX0.UCgh3_uG-iFvSjoBwaMkppxffLUl1kmG14m7EBFK4Ag';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);