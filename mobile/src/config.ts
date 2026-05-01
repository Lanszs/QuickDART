// Backend host. Swap to a deployed HTTPS URL when ready (and remove
// `usesCleartextTraffic` from app.json). For LAN dev, set this to your
// laptop's IPv4 address (run `ipconfig` on Windows). The phone and
// laptop must be on the same Wi-Fi.
// Production URL — ngrok fixed domain. Works from any network (phone, friend's device).
// For local emulator testing, swap to: http://10.0.2.2:5000
// For LAN phone testing, swap to: http://192.168.254.175:5000
export const BACKEND_URL = 'https://ankle-preppy-audience.ngrok-free.dev';

export const NOMINATIM_USER_AGENT = 'QuickDART-Mobile/1.0';

export const DEFAULT_LATITUDE = 14.7546;
export const DEFAULT_LONGITUDE = 120.9466;
