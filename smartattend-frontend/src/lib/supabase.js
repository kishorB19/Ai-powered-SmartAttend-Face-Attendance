import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bjssqridabxydpbuvqse.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wMM7nQKmmM3fBphaJ3djVg_Y26B3WOU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
