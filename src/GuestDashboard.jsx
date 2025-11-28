import React, { useState, useEffect } from 'react';
import { UploadCloud, MapPin, AlertTriangle, CheckCircle, ArrowLeft, Activity, Send, Camera, Info, Clock } from 'lucide-react';

const GuestDashboard = ({ onBack }) => {
    const [uploading, setUploading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [submissionStatus, setSubmissionStatus] = useState(null); // 'success' | 'error' | null
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // --- 1. AI IMAGE ANALYSIS ---
    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        setAiResult(null);
        setSubmissionStatus(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/analyze', {
                method: 'POST',
                body: formData,
            });
            
            if (response.ok) {
                const result = await response.json();
                setAiResult(result);
            } else {
                alert("Unable to analyze image. Please try again.");
            }
        } catch (error) {
            console.error("AI Connection Error", error);
            alert("Could not connect to QuickDART server.");
        } finally {
            setUploading(false);
        }
    };

    // --- 2. SUBMIT PUBLIC REPORT ---
    const submitPublicReport = async () => {
        if (!aiResult) return;

        console.log("--- DEBUG: STARTING SUBMISSION ---"); // <--- LOG 1
        console.log("AI Result being used:", aiResult);

        setSubmissionStatus('submitting');

        // Attempt to get location, default to Marilao if denied/unavailable
        const getLocation = () => {
            return new Promise((resolve) => {
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        (err) => {
                            console.warn("GPS denied:", err);
                            resolve({ lat: 14.7546, lng: 120.9466 }); // Marilao Fallback
                        }
                    );
                } else {
                    resolve({ lat: 14.7546, lng: 120.9466 });
                }
            });
        };

        const loc = await getLocation();

        const newReport = {
            title: `Public Report: ${aiResult.type}`,
            description: `Citizen submission. Assessment: ${aiResult.damage}. AI Confidence: ${aiResult.confidence}`,
            status: 'Active', // Admins see this as a live active report
            location: `Public User @ ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`,
            latitude: loc.lat,
            longitude: loc.lng,
            damage_level: aiResult.damage
        };
        
        console.log("PAYLOAD being sent to backend:", newReport);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReport)
            });

            if (response.ok) {
                setSubmissionStatus('success');
                setAiResult(null);
            } else {
                setSubmissionStatus('error');
            }
        } catch (e) {
            setSubmissionStatus('error');
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* --- Public Header --- */}
            <header className="bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <Activity className="text-blue-600" />
                    <span className="font-extrabold text-lg tracking-tight text-slate-800">
                        QuickDART <span className="text-blue-600 font-medium">Public</span>
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {/* Clock Display (Now beside Exit) */}
                    <div className="hidden md:flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-200">
                        <Clock size={18} className="text-blue-600" />
                        <div className="flex flex-col leading-tight text-right">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-sm font-bold font-mono text-slate-800">
                                {time.toLocaleTimeString()}
                            </span>
                        </div>
                    </div>


                    <button 
                    onClick={onBack} 
                    className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
                     >
                    <ArrowLeft size={16} /> Exit
                    </button>
                </div>
            </header>

            <main className="flex-grow flex flex-col items-center p-6 max-w-xl mx-auto w-full">
                
                {/* --- Intro Section --- */}
                {!aiResult && !submissionStatus && (
                    <div className="text-center mb-8 mt-4">
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Report a Disaster</h2>
                        <p className="text-slate-500 text-sm">
                            Upload a photo of the incident. Our AI will analyze it and alert nearby response teams immediately.
                        </p>
                    </div>
                )}

                {/* --- SUCCESS STATE --- */}
                {submissionStatus === 'success' && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center w-full animate-in zoom-in duration-300">
                        <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="text-green-600" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-green-800 mb-2">Report Submitted</h3>
                        <p className="text-green-600 mb-6 text-sm">
                            Thank you. Emergency responders have been notified of your location.
                        </p>
                        <button 
                            onClick={() => setSubmissionStatus(null)}
                            className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-green-700 transition-colors w-full"
                        >
                            Submit Another Report
                        </button>
                    </div>
                )}

                {/* --- UPLOAD CARD --- */}
                {!aiResult && !submissionStatus && (
                    <label className="w-full aspect-[4/3] bg-white border-2 border-dashed border-slate-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all group shadow-sm">
                        {uploading ? (
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                                <p className="font-bold text-slate-700">Analyzing Scene...</p>
                                <p className="text-xs text-slate-400">Please wait</p>
                            </div>
                        ) : (
                            <>
                                <div className="bg-blue-100 p-5 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                    <Camera className="w-10 h-10 text-blue-600" />
                                </div>
                                <p className="font-bold text-slate-700 text-lg">Tap to Upload Photo</p>
                                <p className="text-sm text-slate-400 mt-1">Use Camera or Gallery</p>
                            </>
                        )}
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                            disabled={uploading} 
                        />
                    </label>
                )}

                {/* --- RESULT PREVIEW CARD --- */}
                {aiResult && !submissionStatus && (
                    <div className="w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-in slide-in-from-bottom-4">
                        {/* Header */}
                        <div className="bg-slate-900 p-6 text-white">
                            <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="text-yellow-400" />
                                <span className="text-xs font-bold uppercase tracking-wider text-yellow-400">AI Detection</span>
                            </div>
                            <h3 className="text-3xl font-bold">{aiResult.type}</h3>
                            <p className="text-slate-400 text-sm mt-1">Confidence: {aiResult.confidence}</p>
                        </div>

                        {/* Body */}
                        <div className="p-6">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Damage Assessment</p>
                                <p className="text-lg font-medium text-slate-800">{aiResult.damage}</p>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={submitPublicReport}
                                    className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-red-200 hover:bg-red-700 flex items-center justify-center gap-2 transition-transform active:scale-95"
                                >
                                    <Send size={20} /> Send Emergency Alert
                                </button>
                                <button 
                                    onClick={() => setAiResult(null)}
                                    className="w-full py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- Footer info --- */}
                {!aiResult && !submissionStatus && (
                    <div className="mt-8 flex items-start gap-3 p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
                        <Info className="shrink-0 mt-0.5" size={18} />
                        <p>
                            Your report will be geo-tagged and sent to the QuickDART Command Center. 
                            False reporting is punishable by law.
                        </p>
                    </div>
                )}

            </main>
        </div>
    );
};

export default GuestDashboard;