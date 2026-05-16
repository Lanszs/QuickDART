// Backend host — production Render service.
// For local emulator testing, swap to: http://10.0.2.2:5000
// For LAN phone testing, swap to: http://<your-LAN-IPv4>:5000
//   (and re-enable usesCleartextTraffic in app.json for non-HTTPS dev URLs)
export const BACKEND_URL = 'https://quickdart-backend.onrender.com';

// Supabase project. Read from EXPO_PUBLIC_* env vars at build time so the same
// .env contract used by the web app keeps working. Falls back to empty strings;
// the supabase client logs a clear error if these are missing.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const NOMINATIM_USER_AGENT = 'QuickDART-Mobile/1.0';

export const DEFAULT_LATITUDE = 14.7546;
export const DEFAULT_LONGITUDE = 120.9466;
