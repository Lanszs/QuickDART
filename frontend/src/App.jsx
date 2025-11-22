import React, { useState } from 'react';
import { LogOut, UploadCloud, Zap, Map, Settings, FileText } from 'lucide-react';

// Define the base URL for your Flask API
// NOTE: This MUST match the port used in backend/app.py (default: 5000)
const API_BASE_URL = 'http://127.0.0.1:5000/api/v1';

// --- Color definitions for consistent use (based on your CSS) ---
const PRIMARY_BLUE = '#1a4e8d'; // Deep Government Blue
const ACCENT_RED = '#cc0000';   // Emergency Red

/**
 * ----------------------------------------------------------------------
 * 1. Dashboard Component (Tailwind Conversion of Dashboard.jsx/css)
 * ----------------------------------------------------------------------
 */
const Dashboard = ({ agencyId, userRole, onLogout }) => {
    // State logic from your original Dashboard.jsx
    const [uploadedFile, setUploadedFile] = useState(null);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            // In a real application, you would now call the API to upload the file
            console.log("File selected:", file.name);
        }
    };
    
    return (
        // Grid layout equivalent to: grid-template-columns: 200px 1fr; grid-template-rows: 60px 1fr;
        <div className="grid grid-cols-[200px_1fr] grid-rows-[60px_1fr] min-h-screen font-inter bg-gray-50">
            
            {/* Header (Spans both columns) */}
            <header className="col-span-2 bg-[#1a4e8d] text-white flex justify-between items-center px-5 shadow-lg">
                <h1 className="text-xl font-semibold tracking-wide">
                    Disaster Rapid Response and Damage Assessment Command Center
                </h1>
                <div className="flex items-center gap-4">
                    {/* File Upload Control */}
                    <input 
                        type="file" 
                        id="image-upload" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        style={{ display: 'none' }} 
                    />
                    <label htmlFor="image-upload" className="flex items-center gap-2 bg-white text-gray-800 hover:bg-gray-100 py-1.5 px-3 rounded-md font-semibold cursor-pointer transition shadow-sm text-sm">
                        <UploadCloud className="w-4 h-4"/> 
                        Upload Image
                    </label>

                    {/* User Info */}
                    <span className="text-sm opacity-80">
                        Role: <span className="font-bold text-yellow-300">{userRole}</span> | User: <span className="font-bold">{agencyId}</span>
                    </span>

                    {/* Logout Button */}
                    <button 
                        className="flex items-center gap-1 bg-[#cc0000] hover:bg-[#a30000] text-white py-1.5 px-3 rounded-md font-bold transition shadow" 
                        onClick={onLogout}
                    >
                        <LogOut className="w-4 h-4"/>
                        Log Out
                    </button>
                </div>
            </header>

            {/* Sidebar (Navigation) */}
            <nav className="row-start-2 bg-white p-4 border-r border-gray-200 shadow-md">
                <h2 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-gray-200">Quick Actions</h2>
                <div className="space-y-1">
                    <button className={`nav-button w-full text-left py-3 px-3 rounded-lg text-sm transition ${
                        true ? 'bg-[#1a4e8d] text-white font-bold shadow' : 'hover:bg-blue-50 text-gray-700'
                    }`}>
                        <Zap className="w-4 h-4 inline mr-2"/> ⚡ Incidents
                    </button>
                    <button className="nav-button w-full text-left py-3 px-3 rounded-lg text-sm hover:bg-blue-50 text-gray-700 transition">
                        <Map className="w-4 h-4 inline mr-2"/> 🗺️ Assets & Teams
                    </button>
                    <button className="nav-button w-full text-left py-3 px-3 rounded-lg text-sm hover:bg-blue-50 text-gray-700 transition">
                        <FileText className="w-4 h-4 inline mr-2"/> ✍️ Damage Reports
                    </button>
                    <button className="nav-button w-full text-left py-3 px-3 rounded-lg text-sm hover:bg-blue-50 text-gray-700 transition">
                        <Settings className="w-4 h-4 inline mr-2"/> ⚙️ Settings
                    </button>
                </div>
            </nav>

            {/* Main Content Area (grid-template-columns: 2fr 1fr;) converted to grid-cols-3 */}
            <main className="row-start-2 col-start-2 p-6 grid grid-cols-3 gap-6 overflow-y-auto">

                {/* File Information Box (Spans across both main columns) */}
                {uploadedFile && (
                    <div className="col-span-3 bg-blue-50 border border-blue-200 border-l-4 border-l-[#1a4e8d] p-3 rounded-lg text-sm text-gray-800 shadow-sm">
                        <p className="font-semibold">✅ File Selected: <span className="font-mono">{uploadedFile.name}</span></p>
                        <p>Type: {uploadedFile.type} | Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                )}
                
                {/* Map Panel (2/3 width -> col-span-2) */}
                <div className="col-span-2 bg-white p-6 rounded-xl shadow-lg border-t-4 border-blue-500">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Live Incident Map</h2>
                    <div className="h-[600px] bg-gray-200 border border-dashed border-gray-400 flex items-center justify-center text-gray-600 rounded-lg text-lg">
                        [Map Placeholder: Showing Incident Data for {userRole} ({agencyId})]
                    </div>
                </div>

                {/* Incident List Panel (1/3 width -> col-span-1) */}
                <div className="col-span-1 bg-white p-6 rounded-xl shadow-lg border-t-4 border-red-600">
                    <h2 className="text-xl font-bold text-[#1a4e8d] mb-4">Real-Time Incident Log</h2>
                    <div className='space-y-4'>
                        <p className='text-gray-700'>Welcome back! You are logged in with **{userRole}** privileges.</p>
                        <div className="bg-red-50 p-3 rounded-md border border-red-200">
                            <p className="text-red-700 font-semibold text-sm">Critical Alert:</p>
                            <p className="text-xs text-red-600">Typhoon Kiko ETA 6 hours in Central Luzon. Operations escalated.</p>
                        </div>
                        <p className='text-gray-700 text-sm'>This is your operational dashboard. Real-time data will appear here.</p>
                        {/* Example Log Entries */}
                        <ul className='space-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-md max-h-[300px] overflow-y-auto'>
                            <li>[10:30] Agent Joji reported road damage in Tarlac.</li>
                            <li>[10:25] New Drone Assessment received (Zone B).</li>
                            <li>[10:05] Team 4 confirmed dispatch to Pampanga.</li>
                            <li>[09:50] System online check successful.</li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
};

/**
 * ----------------------------------------------------------------------
 * 2. LoginPage Component (Tailwind Conversion of LoginPage.jsx/css)
 * ----------------------------------------------------------------------
 */
const LoginPage = ({ onLogin, loginError }) => {
    const [credentials, setCredentials] = useState({
        agencyId: '',
        password: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prevCreds => ({
            ...prevCreds,
            [name]: value,
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Pass credentials to the parent component (App) for authentication logic
        onLogin(credentials.agencyId, credentials.password);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100 font-inter">
            {/* Header (bg-[#004d99] is your Deep Government Blue) */}
            <header className="bg-[#004d99] text-white p-6 shadow-xl w-full text-center">
                <h1 className="3xl font-extrabold tracking-tight">
                    Disaster Rapid Response Portal
                </h1>
                <p className="text-sm mt-1 opacity-80">
                    Group 3 Authorized Access Only
                </p>
            </header>

            {/* Login Container */}
            <div className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden p-8 border-t-4 border-[#cc0000]">
                    
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">Agent Login</h2>
                        
                        {/* Error Message Display */}
                        {loginError && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
                                <span className="block sm:inline">{loginError}</span>
                            </div>
                        )}

                        {/* Agency ID Input */}
                        <div className="space-y-2">
                            <label htmlFor="agencyId" className="block text-sm font-semibold text-gray-700">
                                Agent UserID / Username
                            </label>
                            <input
                                type="text"
                                id="agencyId"
                                name="agencyId" 
                                placeholder="Enter ID or Username"
                                value={credentials.agencyId}
                                onChange={handleChange}
                                // focus:ring/border color is set to the blue accent
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#004d99] focus:border-[#004d99] transition duration-150"
                                required
                            />
                        </div>
                        
                        {/* Password Input */}
                        <div className="space-y-2">
                            <label htmlFor="password" className="block text-sm font-semibold text-gray-700">
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                placeholder="••••••••"
                                value={credentials.password}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#004d99] focus:border-[#004d99] transition duration-150"
                                required
                            />
                        </div>
                        
                        {/* Login Button (bg-[#cc0000] is your Emergency Red) */}
                        <button 
                            type="submit" 
                            className="w-full bg-[#cc0000] hover:bg-[#a30000] text-white font-bold py-3 px-4 rounded-lg transition duration-300 shadow-lg"
                        >
                            LOG IN SECURELY
                        </button>
                        
                        {/* Form Footer Links */}
                        <div className="text-center text-sm text-gray-500 pt-2">
                            <a href="#tech-issue" className="text-[#004d99] hover:underline transition duration-150">
                                Report an Issue
                            </a>
                            <span className="mx-2 text-gray-400">|</span>
                            <a href="#support" className="text-[#004d99] hover:underline transition duration-150">
                                Forgot Password
                            </a>
                        </div>
                    </form>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-gray-200 text-gray-600 p-3 text-center text-xs border-t border-gray-300">
                <p>&copy; 2025 Group 3 Embile_Samaniego_Ang. All Rights Reserved.</p>
            </footer>
        </div>
    );
};


/**
 * ----------------------------------------------------------------------
 * 3. Main Application Component (Router and State Management)
 * ----------------------------------------------------------------------
 */
const App = () => {
    // State to manage authentication status and user details
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null); // Used for agencyId
    const [userRole, setUserRole] = useState(null);         // Used for the role granted by the API
    const [error, setError] = useState(null);               // Used for login errors

    // Function to handle the actual API call for login
    const loginUser = async (agencyId, password) => {
        setError(null); // Clear previous errors
        
        try {
            // This is the endpoint we are about to create in Flask (backend/app.py)
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ agencyId, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // ASSUME the successful response returns a 'token' and a 'role'
                console.log("Login successful. Token:", data.token); 
                
                setIsLoggedIn(true);
                setCurrentUserId(agencyId);
                // We will rely on the API to send the correct role back
                setUserRole(data.role || 'Unassigned Agent'); 
                
                return true;
            } else {
                // Handle non-200 responses (e.g., 401 Unauthorized, 400 Bad Request)
                setError(data.message || 'Authentication failed. Please check your credentials.');
                setIsLoggedIn(false);
                return false;
            }
        } catch (err) {
            // Handle network errors (e.g., Flask server is down)
            console.error("Network error during login:", err);
            setError('Could not connect to the API server. Ensure the Python backend is running.');
            setIsLoggedIn(false);
            return false;
        }
    };

    // The handler passed to LoginPage to initiate the login process
    const handleLogin = (agencyId, password) => {
        loginUser(agencyId, password);
    };

    const handleLogout = () => {
        // In a real app, you would also clear the JWT token/session here
        setIsLoggedIn(false);
        setCurrentUserId(null);
        setUserRole(null);
        setError(null);
    };

    // --- Conditional Rendering ---
    if (isLoggedIn) {
        return (
            <Dashboard 
                agencyId={currentUserId} 
                userRole={userRole} 
                onLogout={handleLogout} 
            />
        );
    } else {
        return (
            <LoginPage 
                onLogin={handleLogin} 
                loginError={error} 
            />
        );
    }
};

export default App;