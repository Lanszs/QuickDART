// Resolves the backend URL automatically.
// - In dev (localhost): points to the local machine's Flask server on port 5000.
// - On any other device on the network: uses the same hostname as the browser,
//   so opening the app at http://192.168.1.x:3000 will talk to http://192.168.1.x:5000.
// - Override at build time via REACT_APP_API_URL env variable.
export const API_BASE = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000`;
