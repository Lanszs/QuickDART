// Backend host — production Render service.
// For local emulator testing, swap to: http://10.0.2.2:5000
// For LAN phone testing, swap to: http://<your-LAN-IPv4>:5000
//   (and re-enable usesCleartextTraffic in app.json for non-HTTPS dev URLs)
export const BACKEND_URL = 'https://quickdart-backend.onrender.com';

export const NOMINATIM_USER_AGENT = 'QuickDART-Mobile/1.0';

export const DEFAULT_LATITUDE = 14.7546;
export const DEFAULT_LONGITUDE = 120.9466;
