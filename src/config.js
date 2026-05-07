// Read from CRA env at build time. Falls back to local dev URL.
// Set REACT_APP_API_URL in Vercel project settings to your Render backend URL.
export const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000';
