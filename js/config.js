// Fill these two values from Supabase: Project Settings → API.
window.SUPABASE_URL = "https://rspazksdglscbjfcevdj.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_qDwU64_ENEcQ4k-DTwwhXQ_6cpsp4_3";
// Public/anon key is intended for browser use. NEVER put a service_role key here.
window.sb = (window.supabase && window.SUPABASE_URL.startsWith("https://") && !window.SUPABASE_URL.includes("YOUR_"))
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null;