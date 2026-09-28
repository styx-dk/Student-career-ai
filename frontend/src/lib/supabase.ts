import { createClient } from "@supabase/supabase-js";

const url =
  import.meta.env.VITE_SUPABASE_URL || "https://configuration-required.invalid";
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "configuration-required";
export const supabase = createClient(url, key);
export const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
);
