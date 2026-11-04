import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://bjssqridabxydpbuvqse.supabase.co';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_wMM7nQKmmM3fBphaJ3djVg_Y26B3WOU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
