import React, { useState, useEffect, useCallback } from 'react';

// --- Global App Component ---
// This main component manages state, routing (conditional rendering), and global layout.
const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // In a real application, you'd check localStorage for an existing token here.
  useEffect(() => {
    // Simulate loading/auth check
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  const handleLoginSuccess = useCallback((receivedToken) => {
    setToken(receivedToken);
    setIsLoggedIn(true);
    // In a production app, you would save this token in a secure way (e.g., HTTP-only cookie or memory)
    console.log('Login successful. Token received.');
  }, []);

  const handleLogout = useCallback(() => {
    setToken(null);
    setIsLoggedIn(false);
    console.log('Logged out.');
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-50">
      <Header isLoggedIn={isLoggedIn} onLogout={handleLogout} />
      <main className="flex-grow flex items-start justify-center p-4">
        {isLoggedIn ? (
          <Dashboard token={token} />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
      </main>
      <Footer />
    </div>
  );
};


// --- UI Components ---

const Header = ({ isLoggedIn, onLogout }) => (
  <header className="bg-blue-800 text-white shadow-lg">
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Disaster Rapid Response Portal</h1>
      <p className="text-sm mt-1 opacity-80">Group 3 Authorized Access Only</p>
      {isLoggedIn && (
        <button
          onClick={onLogout}
          className="mt-2 text-sm px-3 py-1 border border-white rounded-lg hover:bg-white hover:text-blue-800 transition duration-150"
        >
          Logout
        </button>
      )}
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-gray-800 text-white text-center p-3 text-xs mt-auto">
    &copy; 2025 Group 3 Embile_Samaniego_Ang. All Rights Reserved.
  </footer>
);

const LoadingScreen = () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-gray-600 flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
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
        onLoginSuccess(data.token);
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
    <div className="mt-12 p-8 bg-white shadow-2xl rounded-xl w-full max-w-sm border border-red-100">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Agent Login</h2>
      
      {/* Login Form */}
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg" role="alert">
            {error}
          </div>
        )}
        
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Agent UserID / Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition duration-150"
            placeholder="Enter User ID or Username"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 transition duration-150"
            placeholder="••••••••"
            required
            disabled={isSubmitting}
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 px-4 rounded-lg shadow-md text-base font-semibold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Logging In...
            </span>
          ) : 'LOG IN SECURELY'}
        </button>
      </form>
      
      <p className="mt-6 text-xs text-center text-gray-500 border-t pt-4">
        Test Credentials: Cmdr-001/password123 | Agent-47/fieldpass | Analyst-A/secure
      </p>
    </div>
  );
};

const Dashboard = ({ token }) => {
    // Note: The token is not used here but shows it was received.
    return (
        <div className="mt-12 p-8 bg-white shadow-2xl rounded-xl w-full max-w-4xl border border-green-100">
            <h2 className="text-3xl font-bold text-center mb-4 text-green-700">Access Granted!</h2>
            <p className="text-center text-gray-600 mb-8">
                Welcome to the Disaster Rapid Response Portal Dashboard.
            </p>
            <div className="bg-green-50 p-6 rounded-lg border border-green-300">
                <h3 className="text-xl font-semibold mb-3 text-green-800">Key Status Indicators</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li><span className="font-medium">System Integrity:</span> <span className="text-green-600 font-bold">Optimal</span></li>
                    <li><span className="font-medium">Active Missions:</span> 4 In Progress</li>
                    <li><span className="font-medium">Recent Activity:</span> Updated status reports from Sector Gamma.</li>
                </ul>
            </div>
            <p className="mt-6 text-sm text-center text-gray-500">
                This is the secure application area.
            </p>
        </div>
    );
};

export default App;