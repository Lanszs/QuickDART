import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './Dashboard';

// --- Global App Component ---
// This main component manages state, routing (conditional rendering), and global layout.
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState(null); // Add this line

  // In a real application, you'd check localStorage for an existing token here.
  useEffect(() => {
    // Simulate loading/auth check
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const handleLoginSuccess = useCallback((receivedToken ,receivedRole) => {
    setToken(receivedToken);
    setRole(receivedRole);
    setIsLoggedIn(true);
    console.log('Login successful. Role:', receivedRole);
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setRole(null);
    setIsLoggedIn(false);
    console.log('Logged out.');
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-50">
      {/* Only show the simple header if NOT logged in (Dashboard has its own header) */}
      {!isLoggedIn && <Header />}
      
      <main className="flex-grow flex items-start justify-center">
       {isLoggedIn ? (
          // 2. Render the new Dashboard and pass the required props
          <Dashboard userRole={role} onLogout={handleLogout} />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
      </main>
      {!isLoggedIn && <Footer />}
    </div>
  );
};


// --- UI Components ---

const Header = () => (
  <header className="bg-blue-800 text-white shadow-lg w-full">
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Disaster Rapid Response Portal</h1>
      <p className="text-sm mt-1 opacity-80">Group 3 Authorized Access Only</p>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-gray-800 text-white text-center p-3 text-xs w-full mt-auto">
    &copy; 2025 Group 3 Embile_Samaniego_Ang. All Rights Reserved.
  </footer>
);

const LoadingScreen = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600 flex items-center">
            Loading Application...
        </div>
    </div>
);


const Login = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // *** FIXED LOGIC: Correctly handles POST request and prevents default GET submission ***
  const handleSubmit = async (e) => {
    // PREVENT DEFAULT BROWSER SUBMISSION (Fixes the GET request issue)
    e.preventDefault(); 
    
    setError('');
    setIsSubmitting(true);

    try {
      // API call to your Flask backend
      const response = await fetch('http://127.0.0.1:5000/api/v1/login', {
        method: 'POST', // CRITICAL: Use POST method
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: username, password }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'authenticated') {
        // Successful login!
        onLoginSuccess(data.token, data.role);
      } else {
        // Authentication failed (401 or 200 with 'failed' status)
        setError(data.message || 'Authentication failed. Check your credentials and ensure the API server is running.');
      }
    } catch (err) {
      // Network failure (If the server is down or unreachable)
      console.error('Login Network Error:', err);
      setError('Could not connect to the API server. Ensure the Python backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-12 p-8 bg-white shadow-2xl rounded-xl w-full max-w-sm border border-red-100 m-4">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Agent Login</h2>
      
      {/* Login Form */}
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Agent UserID / Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-500 outline-none"
            placeholder="Enter User ID or Username"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-500 outline-none"
            placeholder="••••••••"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-lg font-bold text-white bg-red-600 hover:bg-red-700 transition duration-150 disabled:opacity-50"
        >
          {isSubmitting ? 'Verifying...' : 'LOG IN SECURELY'}
        </button>
      </form>
      
      <p className="mt-6 text-xs text-center text-gray-500 border-t pt-4">
        Test Credentials: Cmdr-001/password123 | Agent-47/fieldpass | Analyst-A/secure
      </p>
    </div>
  );
};

export default App;