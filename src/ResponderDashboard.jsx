import React, { useState, useEffect } from 'react';
import { Camera, MapPin, AlertTriangle, CheckCircle, User, LogOut, Activity, FileText, RefreshCw, RotateCcw, Clock } from 'lucide-react';

const ResponderDashboard = ({ userRole, onLogout }) => {
    const [status, setStatus] = useState('Active');
    const [uploading, setUploading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [activeTab, setActiveTab] = useState('incidents'); // Default to viewing incidents

    // Data State
    const [reports, setReports] = useState([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);

    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // --- FETCH REPORTS (Read-Only View) ---
    const fetchReports = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports');
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setIsLoadingReports(false);
        }
    };

    useEffect(() => {
        fetchReports();
        const interval = setInterval(fetchReports, 5000);
        return () => clearInterval(interval);
    }, []);

    // --- AI SCANNER LOGIC (Analysis Only - No Saving) ---
    const handleImageUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        setAiResult(null);

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
            }
        } catch (error) {
            console.error("AI Error", error);
            alert("Failed to analyze image.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-gray-100">
            {/* --- Header --- */}
            <header className="bg-gray-900 text-white p-4 shadow-md flex justify-between items-center">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-6 w-6 text-red-500" />
                    Field Response Unit
                </h1>
                
                <div className="flex items-center gap-6">
                    {/* Status Indicator */}
                    <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg">
                        <span className="text-xs text-gray-400 uppercase font-bold">Status</span>
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${status === 'Active' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                            <span className="font-bold text-sm">{status}</span>
                        </div>

                        <div className="hidden md:flex items-center gap-3 bg-gray-800 px-4 py-1.5 rounded-lg border border-gray-700">
                        <Clock size={18} className="text-blue-400" />
                        <div className="flex flex-col leading-tight text-right">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-sm font-bold font-mono text-white">
                                {time.toLocaleTimeString()}
                            </span>
                        </div>
                        </div>
                    </div>

                    <button onClick={onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Logout</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- Sidebar --- */}
                <nav className="w-64 bg-white shadow-lg flex flex-col p-4 gap-2 border-r border-gray-200">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Field Operations</div>
                    
                    <NavButton 
                        active={activeTab === 'incidents'} 
                        onClick={() => setActiveTab('incidents')}
                        icon={<FileText size={18} />} 
                        label="Live Incident Log" 
                    />
                    <NavButton 
                        active={activeTab === 'scanner'} 
                        onClick={() => setActiveTab('scanner')}
                        icon={<Camera size={18} />} 
                        label="AI Tool / Scanner" 
                    />
                    <NavButton 
                        active={activeTab === 'tasks'} 
                        onClick={() => setActiveTab('tasks')}
                        icon={<CheckCircle size={18} />} 
                        label="My Tasks" 
                    />
                    
                    <div className="flex-grow"></div>
                    
                    {/* Status Toggle */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4">
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Update Availability</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setStatus('Active')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded border ${status === 'Active' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-500 border-gray-200'}`}
                            >
                                Active
                            </button>
                            <button 
                                onClick={() => setStatus('Resting')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded border ${status === 'Resting' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-white text-gray-500 border-gray-200'}`}
                            >
                                Resting
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="bg-blue-100 p-2 rounded-full">
                            <User size={16} className="text-blue-700" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-700">Agent 47</p>
                            <p className="text-xs text-gray-500">Field Responder</p>
                        </div>
                    </div>
                </nav>

                {/* --- Main Content --- */}
                <main className="flex-1 p-8 overflow-y-auto">
                    
                    {/* TAB 1: INCIDENTS LIST (Read Only) */}
                    {activeTab === 'incidents' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Live Incident Feed</h2>
                                <button onClick={fetchReports} className="p-2 text-gray-500 hover:text-blue-600 bg-white rounded-full shadow-sm border">
                                    <RefreshCw size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {isLoadingReports ? (
                                    <div className="text-center text-gray-400 py-12">Refreshing feed...</div>
                                ) : reports.length === 0 ? (
                                    <div className="text-center text-gray-400 py-12 bg-white rounded-xl border border-dashed">No active incidents reported.</div>
                                ) : (
                                    reports.map((report) => (
                                        <div key={report.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-bold text-gray-800 text-lg">{report.title}</h3>
                                                    <StatusBadge status={report.status} />
                                                </div>
                                                <p className="text-gray-600 mb-2">{report.description}</p>
                                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                                    <span className="flex items-center gap-1"><MapPin size={14}/> {report.location}</span>
                                                    <span>{report.timestamp}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: AI SCANNER (No Submit) */}
                    {activeTab === 'scanner' && (
                        <div className="max-w-4xl mx-auto h-full flex flex-col">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">AI Assessment Tool</h2>
                            
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col items-center justify-center">
                                {!aiResult ? (
                                    <label className="flex flex-col items-center justify-center w-full max-w-lg h-80 border-2 border-dashed border-gray-300 rounded-2xl hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer group">
                                        {uploading ? (
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                                        ) : (
                                            <div className="bg-blue-100 p-6 rounded-full mb-4 group-hover:scale-110 transition-transform">
                                                <Camera className="w-12 h-12 text-blue-600" />
                                            </div>
                                        )}
                                        <p className="text-lg font-bold text-gray-700">
                                            {uploading ? "Analyzing..." : "Upload for Analysis"}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">Use this tool to verify structural damage</p>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                    </label>
                                ) : (
                                    <div className="w-full max-w-lg animate-in fade-in zoom-in duration-300">
                                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                                            <div className="flex items-center justify-between mb-6 border-b pb-4">
                                                <h3 className="font-bold text-gray-800 text-lg">Assessment Result</h3>
                                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-bold">AI Generated</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Type</p>
                                                    <p className="text-xl font-bold text-gray-800">{aiResult.type}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-bold text-gray-400 uppercase">Confidence</p>
                                                    <p className="text-xl font-bold text-blue-600">{aiResult.confidence}</p>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white p-4 rounded-xl border border-gray-200 mb-6">
                                                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Damage Assessment</p>
                                                <p className="text-lg font-medium text-gray-800">{aiResult.damage}</p>
                                            </div>

                                            <button 
                                                onClick={() => setAiResult(null)} 
                                                className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <RotateCcw size={18} />
                                                Scan Another Image
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: TASKS */}
                    {activeTab === 'tasks' && (
                        <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
                            <CheckCircle size={64} className="mb-4 opacity-20" />
                            <p className="text-xl font-semibold">No active tasks.</p>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
};

// Reuse helpers from Dashboard or duplicate here
const NavButton = ({ icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left ${active ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
    >
        {icon}
        {label}
    </button>
);

const StatusBadge = ({ status }) => {
    let colors = "bg-gray-100 text-gray-600";
    if (status === 'Critical') colors = "bg-red-100 text-red-700";
    if (status === 'Active') colors = "bg-blue-100 text-blue-700";
    if (status === 'Cleared') colors = "bg-green-100 text-green-700";

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors}`}>
            {status}
        </span>
    );
};

export default ResponderDashboard;