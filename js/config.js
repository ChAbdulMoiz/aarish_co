// Fill these two values from Supabase: Project Settings → API.
window.SUPABASE_URL = "https://qesfmpqwybqewepgfrsk.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_Iu4QRN6NwCag3EqUBBemjQ_MpeWVtsf";
// Public/anon key is intended for browser use. NEVER put a service_role key here.
window.sb = (window.supabase && window.SUPABASE_URL.startsWith("https://") && !window.SUPABASE_URL.includes("YOUR_"))
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;