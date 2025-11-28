import React, { useState, useEffect } from 'react';
import IncidentMap from './IncidentMap';
import AssetsTeams from './AssetsTeams';
import { Map as MapIcon, FileUp, LogOut, Activity, Users, FileText, Settings, RefreshCw, AlertTriangle } from 'lucide-react';

const Dashboard = ({ userRole, onLogout }) => {
    // State for Active Tab (Default to 'incidents')
    const [activeTab, setActiveTab] = useState('incidents');
    
    const [uploadedFile, setUploadedFile] = useState(null);
    
    // State for Reports
    const [reports, setReports] = useState([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);

    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const saveReport = async () => {
        if (!analysisResult) return;

        const newReport = {
            title: `Detected: ${analysisResult.type}`,
            description: `AI Analysis Confidence: ${analysisResult.confidence}. Damage Assessment: ${analysisResult.damage}`,
            status: 'Active',
            location: 'Sector 4 (Detected)', // Placeholder location
            latitude: 14.7546, // Using Marilao center for demo
            longitude: 120.9466
        };

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReport)
            });

            if (response.ok) {
                alert("Report Saved to Database!");
                setAnalysisResult(null); // Clear the result
                setUploadedFile(null);   // Clear the file input
                fetchReports();          // Refresh the list immediately
            } else {
                alert("Failed to save report.");
            }
        } catch (error) {
            console.error("Error saving report:", error);
        }
    };

    // Fetch Logic
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
        // Optional: Poll every 5 seconds
        const interval = setInterval(fetchReports, 5000);
        return () => clearInterval(interval);
    }, []);

  const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            setAnalysisResult(null); // Reset previous result
            setIsAnalyzing(true);

            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch('http://127.0.0.1:5000/api/v1/analyze', {
                    method: 'POST',
                    body: formData,
                });

                if (response.ok) {
                    const result = await response.json();
                    setAnalysisResult(result);
                } else {
                    console.error("Analysis failed");
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            } finally {
                setIsAnalyzing(false);
            }
        }
    };

    return (
        <div className="flex flex-col h-screen w-full bg-gray-100">
            {/* --- Header --- */}
            <header className="bg-blue-900 text-white p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-6 w-6 text-red-500" />
                    DRR Command Center
                </h1>
                
                <div className="flex items-center gap-4 text-sm">
                    <input 
                        type="file" 
                        id="image-upload" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="hidden" 
                    />
                    <label htmlFor="image-upload" className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded cursor-pointer transition-colors">
                        <FileUp size={16} />
                        {isAnalyzing ? "Analyzing..." : "Upload Image"}
                    </label>

                    <div className="hidden md:block text-right">
                        <div className="font-semibold">{userRole || "Agent"}</div>
                        <div className="text-xs opacity-75">Status: Active</div>
                    </div>

                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- Sidebar --- */}
                <nav className="w-64 bg-white shadow-lg hidden md:flex flex-col p-4 gap-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</div>
                    
                    <NavButton 
                        active={activeTab === 'incidents'} 
                        onClick={() => setActiveTab('incidents')}
                        icon={<Activity size={18} />} 
                        label="Incidents" 
                    />
                    <NavButton 
                        active={activeTab === 'assets'} 
                        onClick={() => setActiveTab('assets')}
                        icon={<Users size={18} />} 
                        label="Assets & Teams" 
                    />
                    <NavButton icon={<FileText size={18} />} label="Damage Reports" />
                    
                    <div className="flex-grow"></div>
                    <NavButton icon={<Settings size={18} />} label="Settings" />
                </nav>

                {/* --- Main Content --- */}
                <main className="flex-1 p-0 overflow-y-auto">
                    
                    {/* VIEW 1: INCIDENTS DASHBOARD */}
                    {activeTab === 'incidents' && (
                        <div className="p-6">
                            {/* --- AI ANALYSIS & ACTION BOX --- */}
                            {uploadedFile && (
                                <div className="mb-6 bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col gap-3">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-blue-50 rounded-lg">
                                            <FileUp className="text-blue-600" size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800">File Uploaded: {uploadedFile.name}</h3>
                                            
                                            {isAnalyzing && (
                                                <p className="text-sm text-gray-500 animate-pulse mt-1">🤖 AI is analyzing the scene...</p>
                                            )}

                                            {analysisResult && (
                                                <div className="mt-3">
                                                    <div className="flex items-center gap-4 mb-2">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                                            <AlertTriangle size={14} />
                                                            Detected: {analysisResult.type}
                                                        </span>
                                                        <span className="text-xs text-gray-500">Confidence: {analysisResult.confidence}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600">
                                                        <strong>Assessment:</strong> {analysisResult.damage}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    {analysisResult && (
                                        <div className="flex gap-3 mt-2 pl-[60px]">
                                            <button 
                                                onClick={saveReport}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"
                                            >
                                                <FileText size={16} />
                                                Confirm & Save to Log
                                            </button>
                                            <button 
                                                onClick={() => { setUploadedFile(null); setAnalysisResult(null); }}
                                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                                            >
                                                Discard
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                                {/* Map Panel */}
                                <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                        <MapIcon className="text-blue-600" /> Live Incident Map
                                    </h2>
                                    <div className="flex-1 rounded-lg overflow-hidden border border-gray-300 relative z-0">
                                        <IncidentMap reports={reports} />
                                    </div>
                                </div>

                                {/* Incident Log Panel */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-semibold text-gray-800">Incident Log</h2>
                                        <button onClick={fetchReports} className="text-gray-500 hover:text-blue-600" title="Refresh">
                                            <RefreshCw size={16} />
                                        </button>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                        {isLoadingReports ? (
                                            <div className="text-center text-gray-400 py-4">Loading reports...</div>
                                        ) : reports.length === 0 ? (
                                            <div className="text-center text-gray-400 py-4">No active incidents.</div>
                                        ) : (
                                            reports.map((report) => (
                                                <div key={report.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-bold text-gray-800 text-sm">{report.title}</span>
                                                        <StatusBadge status={report.status} />
                                                    </div>
                                                    <p className="text-xs text-gray-600 mb-2">{report.description}</p>
                                                    <div className="flex justify-between items-center text-xs text-gray-400">
                                                        <span>📍 {report.location}</span>
                                                        <span>{report.timestamp}</span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: ASSETS & TEAMS */}
                    {activeTab === 'assets' && (
                        <AssetsTeams />
                    )}

                </main>
            </div>
        </div>
    );
};

// --- Helpers ---

const NavButton = ({ icon, label, active, onClick }) => (
    <button 
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
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

export default Dashboard;