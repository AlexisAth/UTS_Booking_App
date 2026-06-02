import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://tkfpjfxhbxccwhjjwbpl.supabase.co";

// Χρησιμοποίησε το "Publishable key" που βλέπεις στην οθόνη σου
const supabaseAnonKey = "sb_publishable_DFPgnp7DilGD0q-gKnVJ4w_POaU7bmk";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
