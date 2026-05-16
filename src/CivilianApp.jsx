import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import { API_URL } from './config';
import { authHeaders } from './lib/authHeaders';
import GuestDashboard from './GuestDashboard';
import {
  ArrowLeft, ShieldCheck, ShieldAlert, UserPlus, LogIn, Mail, Lock, User as UserIcon,
  Upload, Camera, RefreshCw, Loader2, CheckCircle, XCircle, Clock, LogOut
} from 'lucide-react';

// --- Auth screen (toggle Login / Signup) ----------------------------------

const AuthPanel = ({ onAuthed, onBack }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const r = await fetch(`${API_URL}/api/v1/civilian/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, full_name: fullName }),
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || 'signup_failed');
        }
      }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      onAuthed(data.session);
    } catch (err) {
      const code = err?.message || 'unknown_error';
      if (code === 'email_already_registered') setError('That email is already registered. Try logging in.');
      else if (code === 'password_too_short') setError('Password must be at least 8 characters.');
      else setError(typeof code === 'string' ? code : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 to-blue-900">
      <header className="p-4">
        <button onClick={onBack} className="text-blue-200 hover:text-white text-sm flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <ShieldCheck size={32} className="text-blue-700" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-center text-gray-800 mb-1">
            {mode === 'signup' ? 'Create Civilian Account' : 'Civilian Sign In'}
          </h1>
          <p className="text-center text-sm text-gray-500 mb-6">
            Verified civilians can submit damage reports.
          </p>

          <form onSubmit={submit}>
            {error && (
              <div className="p-3 mb-4 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg">
                {error}
              </div>
            )}
            {mode === 'signup' && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-600 mb-1">Full name</label>
                <div className="relative">
                  <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                    placeholder="Juan Dela Cruz"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-600 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                  placeholder="you@example.com"
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-gray-600 mb-1">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 p-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none"
                  placeholder="at least 8 characters"
                  required
                  disabled={submitting}
                  minLength={mode === 'signup' ? 8 : undefined}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Working...</>
                : mode === 'signup'
                  ? <><UserPlus size={16} /> Create account</>
                  : <><LogIn size={16} /> Log in</>}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-gray-500">
            {mode === 'signup' ? 'Already have an account?' : "New here?"}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}
              className="text-blue-600 hover:text-blue-800 font-bold"
            >
              {mode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

// --- ID + selfie upload screen --------------------------------------------

const SelfieCapture = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      } catch (e) {
        setError('Could not access the camera. Check browser permissions.');
      }
    })();
    return () => {
      active = false;
      setStream(prev => { prev?.getTracks().forEach(t => t.stop()); return null; });
    };
  }, []);

  const capture = () => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, 'image/jpeg', 0.9);
  };

  if (error) {
    return <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">{error}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={videoRef} autoPlay playsInline muted className="rounded-xl w-full max-w-sm bg-black aspect-[4/3] object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <button
        type="button"
        onClick={capture}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
      >
        <Camera size={16} /> Take selfie
      </button>
    </div>
  );
};

const IdVerificationUpload = ({ onSubmitted, onSignOut, rejectionReason }) => {
  const [idFile, setIdFile] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [selfieBlob, setSelfieBlob] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onPickId = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('ID must be a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('ID image must be under 8 MB.');
      return;
    }
    setError('');
    setIdFile(file);
    setIdPreview(URL.createObjectURL(file));
  };

  const onCaptureSelfie = (blob) => {
    setSelfieBlob(blob);
    setSelfiePreview(URL.createObjectURL(blob));
  };

  const submit = async () => {
    if (!idFile || !selfieBlob) return;
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('id_document', idFile);
      fd.append('selfie', selfieBlob, 'selfie.jpg');
      const headers = await authHeaders();
      const r = await fetch(`${API_URL}/api/v1/civilian/verification`, {
        method: 'POST',
        headers,
        body: fd,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'upload_failed');
      }
      onSubmitted();
    } catch (e) {
      setError(e.message || 'Upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const ready = idFile && selfieBlob && !submitting;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} className="text-blue-700" />
          <h1 className="font-bold text-gray-800">Identity Verification</h1>
        </div>
        <button onClick={onSignOut} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <LogOut size={14} /> Sign out
        </button>
      </header>

      <main className="flex-1 p-6 max-w-4xl w-full mx-auto">
        {rejectionReason && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
            <ShieldAlert size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-red-800">Your previous submission was rejected</div>
              <div className="text-sm text-red-700 mt-1">{rejectionReason}</div>
              <div className="text-xs text-red-600 mt-2">Please re-upload to try again.</div>
            </div>
          </div>
        )}

        <p className="text-gray-600 mb-6">
          Upload a clear photo of a government-issued ID and take a live selfie.
          A Commander will review your submission before you can submit reports.
        </p>

        {error && (
          <div className="mb-4 p-3 text-sm font-medium text-red-800 bg-red-100 border border-red-300 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Upload size={16} /> Government ID
            </h2>
            {idPreview ? (
              <div className="space-y-2">
                <img src={idPreview} alt="ID preview" className="rounded-lg w-full max-h-64 object-contain bg-gray-100" />
                <button
                  type="button"
                  onClick={() => { setIdFile(null); setIdPreview(null); }}
                  className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Choose a different image
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/40">
                <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                <div className="text-sm font-medium text-gray-700">Choose ID photo</div>
                <div className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP · max 8 MB</div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onPickId(e.target.files?.[0])}
                />
              </label>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Camera size={16} /> Live Selfie
            </h2>
            {selfiePreview ? (
              <div className="space-y-2">
                <img src={selfiePreview} alt="Selfie preview" className="rounded-lg w-full max-h-64 object-contain bg-gray-100" />
                <button
                  type="button"
                  onClick={() => { setSelfieBlob(null); setSelfiePreview(null); }}
                  className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
                >
                  <RefreshCw size={14} /> Retake
                </button>
              </div>
            ) : (
              <SelfieCapture onCapture={onCaptureSelfie} />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!ready}
            onClick={submit}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            Submit for review
          </button>
        </div>
      </main>
    </div>
  );
};

// --- Status screens -------------------------------------------------------

const PendingScreen = ({ submittedAt, onSignOut }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Clock size={20} className="text-amber-600" />
        <h1 className="font-bold text-gray-800">Verification Pending</h1>
      </div>
      <button onClick={onSignOut} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
        <LogOut size={14} /> Sign out
      </button>
    </header>
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
        <div className="inline-flex p-4 bg-amber-100 rounded-2xl mb-4">
          <Clock size={32} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Awaiting review</h2>
        <p className="text-gray-600 text-sm">
          Your ID and selfie were submitted{submittedAt ? ` on ${new Date(submittedAt).toLocaleString()}` : ''}.
          A Commander will review them shortly. This page will update automatically once a decision is made.
        </p>
      </div>
    </main>
  </div>
);

// --- Main funnel ----------------------------------------------------------

const CivilianApp = ({ onBack }) => {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState(null); // null while loading
  const [rejectionReason, setRejectionReason] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const headers = await authHeaders();
      if (!headers.Authorization) {
        setStatus(null);
        setLoading(false);
        return;
      }
      const r = await fetch(`${API_URL}/api/v1/civilian/verification`, { headers });
      if (!r.ok) {
        setStatus('unverified');
        setLoading(false);
        return;
      }
      const body = await r.json();
      setStatus(body.status || 'unverified');
      setRejectionReason(body.rejection_reason || null);
      setSubmittedAt(body.submitted_at || null);
    } catch {
      setStatus('unverified');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial session check.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) fetchStatus();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) fetchStatus();
      else { setStatus(null); setRejectionReason(null); }
    });
    return () => subscription.unsubscribe();
  }, [fetchStatus]);

  // Poll while pending so the UI flips to the dashboard when approved.
  useEffect(() => {
    if (status !== 'pending') return;
    const id = setInterval(fetchStatus, 8000);
    return () => clearInterval(id);
  }, [status, fetchStatus]);

  const onAuthed = async (s) => {
    setSession(s);
    setLoading(true);
    await fetchStatus();
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setStatus(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 size={18} className="animate-spin" /> Loading...
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthPanel onAuthed={onAuthed} onBack={onBack} />;
  }

  if (status === 'approved') {
    // Back returns to the welcome screen but keeps the session alive so the
    // civilian doesn't have to re-login next time they pick "Public User".
    return <GuestDashboard onBack={onBack} />;
  }

  if (status === 'pending') {
    return <PendingScreen submittedAt={submittedAt} onSignOut={onSignOut} />;
  }

  // unverified | rejected → show the upload screen.
  return (
    <IdVerificationUpload
      onSubmitted={fetchStatus}
      onSignOut={onSignOut}
      rejectionReason={status === 'rejected' ? rejectionReason : null}
    />
  );
};

export default CivilianApp;
