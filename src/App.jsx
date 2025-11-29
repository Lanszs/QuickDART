import React, { useState, useEffect, useCallback } from 'react';
import Dashboard from './Dashboard';
import ResponderDashboard from './ResponderDashboard';
import GuestDashboard from './GuestDashboard';
import { Shield, User, Map as MapIcon, ArrowRight } from 'lucide-react';
import { supabase } from './supabaseClient';

// --- UI COMPONENTS ---

const Header = ({ onBack }) => (
  <header className="bg-blue-800 text-white shadow-lg w-full">
    <div className="container mx-auto p-4 flex justify-between items-center">
       <button onClick={onBack} className="text-blue-200 hover:text-white text-sm">← Back</button>
       <div className="text-center">
         <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">Disaster Rapid Response</h1>
         <p className="text-sm opacity-80">Authorized Access Only</p>
       </div>
       <div className="w-10"></div>
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
        <div className="text-gray-600 flex items-center animate-pulse">
            Loading Application...
        </div>
    </div>
);

// --- SCREEN COMPONENTS ---

const WelcomeScreen = ({ onSelectMode }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-blue-900 p-4">
    <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">
        QUICK<span className="text-red-500">DART</span>
      </h1>
      <p className="text-blue-200 text-lg md:text-xl max-w-2xl mx-auto">
        Disaster Rapid Response & Damage Assessment System
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
      <button 
        onClick={() => onSelectMode('admin')}
        className="group relative flex flex-col items-center p-8 bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl hover:bg-white/20 transition-all duration-300 hover:scale-105 text-left"
      >
        <div className="p-4 bg-red-500 rounded-2xl mb-6 shadow-lg shadow-red-500/20 group-hover:shadow-red-500/40 transition-shadow">
          <Shield size={40} className="text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Authorized Personnel</h3>
        <p className="text-blue-200 text-center text-sm mb-6">
          Log in as Admin or Field Responder to access secure tools.
        </p>
        <div className="mt-auto flex items-center gap-2 text-red-400 font-bold text-sm group-hover:text-red-300">
          Secure Login <ArrowRight size={16} />
        </div>
      </button>

      <button 
        onClick={() => onSelectMode('guest')}
        className="group relative flex flex-col items-center p-8 bg-white/5 backdrop-blur-sm border border-white/5 rounded-3xl hover:bg-white/10 transition-all duration-300 hover:scale-105 text-left"
      >
        <div className="p-4 bg-blue-500 rounded-2xl mb-6 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
          <User size={40} className="text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Public User</h3>
        <p className="text-blue-200 text-center text-sm mb-6">
          Report Public Incidents
        </p>
        <div className="mt-auto flex items-center gap-2 text-blue-400 font-bold text-sm group-hover:text-blue-300">
          Continue as Guest <ArrowRight size={16} />
        </div>
      </button>
    </div>
    
    <p className="mt-12 text-slate-500 text-sm">© 2025 QuickDART System</p>
  </div>
);

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // 1. SUPABASE LOGIN
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      // 2. DETERMINE ROLE
      const userRole = email.includes('admin') ? 'Commander' : 'FieldAgent';
      onLoginSuccess(data.session, userRole);

    } catch (err) {
      console.error('Login Error:', err.message);
      setError('Authentication failed. Please check your email and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-12 p-8 bg-white shadow-2xl rounded-xl w-full max-w-sm border border-red-100 m-4">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">Secure Login</h2>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg">
            {error}
          </div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-500 outline-none"
            placeholder="admin@quickdart.com"
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
        Powered by Supabase Auth
      </p>
    </div>
  );
};

// --- MAIN APP LOGIC ---

const App = () => {
  const [appMode, setAppMode] = useState('welcome'); 
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [session, setSession] = useState(null); 

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        const userEmail = session.user.email;
        const userRole = userEmail.includes('admin') ? 'Commander' : 'FieldAgent';
        handleLoginSuccess(session, userRole);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setIsLoggedIn(false);
        setRole(null);
      }
    });
  
    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = useCallback((session, receivedRole) => {
    setRole(receivedRole);
    setIsLoggedIn(true);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setRole(null);
    setIsLoggedIn(false);
    setAppMode('welcome'); 
  }, []);

  if (isLoading) return <LoadingScreen />;

  if (appMode === 'welcome') return <WelcomeScreen onSelectMode={setAppMode} />;
  if (appMode === 'guest') return <GuestDashboard onBack={() => setAppMode('welcome')} />;

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gray-50">
      {!isLoggedIn && <Header onBack={() => setAppMode('welcome')} />}
      <main className="flex-grow flex items-start justify-center">
        {isLoggedIn ? (
          role === 'FieldAgent' ? (
            <ResponderDashboard userRole={role} onLogout={handleLogout} />
          ) : (
            <Dashboard userRole={role} onLogout={handleLogout} />
          )
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
      </main>
      {!isLoggedIn && <Footer />}
    </div>
  );
};

export default App;