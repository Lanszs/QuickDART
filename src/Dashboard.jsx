import React, { useState, useEffect, useCallback, useRef } from 'react';
import IncidentMap from './IncidentMap';
import AssetsTeams from './AssetsTeams';
import { Map as MapIcon, FileUp, LogOut, Activity, Users, FileText, Settings, RefreshCw, AlertTriangle, Clock, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import DamageReports from './DamageReports';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Statistics from './Statistics'; // <--- NEW IMPORT


const Dashboard = ({ userRole, onLogout }) => {
    // State for Active Tab (Default to 'incidents')
    const [activeTab, setActiveTab] = useState('incidents');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [expandedReportId, setExpandedReportId] = useState(null);
    const [reports, setReports] = useState([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [time, setTime] = useState(new Date());
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [reportToValidate, setReportToValidate] = useState(null);
    const socketRef = useRef(null);

    const saveReport = async () => {
        if (!analysisResult) return;

        const newReport = {
            title: `Detected: ${analysisResult.type}`,
            description: `AI Analysis Confidence: ${analysisResult.confidence}. Damage Assessment: ${analysisResult.damage}`,
            status: 'Active',
            location: 'Sector 4 (Detected)', // Placeholder location
            latitude: 14.7546, // Using Marilao center for demo
            longitude: 120.9466,
            damage_level: analysisResult.damage
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
        // Initial Load
        fetchReports();

        // Connect to Backend Socket
        const socket = io('http://127.0.0.1:5000');
        socketRef.current = socket;

        socket.on('connect', () => {
            console.log("✅ Connected to WebSocket Server");
        });

        // Listen for the 'new_report' event from app.py
        socket.on('new_report', (newReport) => {
            console.log("⚡ LIVE UPDATE RECEIVED:", newReport);
            
            // Add the new report to the TOP of the list instantly
            setReports((prevReports) => {
                // Check if report already exists to avoid duplicates
                if (prevReports.some(r => r.id === newReport.id)) {
                    return prevReports;
                }
                return [newReport, ...prevReports];
            });
            
            // Optional: Play a sound or show a toast notification here
            toast.error(
                <div>
                    <strong>New Incident Reported!</strong>
                    <div className="text-xs mt-1">{newReport.title}</div>
                    <div className="text-xs text-gray-200">{newReport.location}</div>
                </div>, 
                {
                    position: "top-right",
                    autoClose: 7000, // Stay for 7 seconds
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    theme: "colored",
                }
            );
        });

        socket.on('report_updated', (updatedReport) => {
        console.log("📝 REPORT UPDATED:", updatedReport);
        
        setReports((prevReports) => 
            prevReports.map(report => 
                report.id === updatedReport.id ? updatedReport : report
            )
        );
        
        toast.info(
            <div>
                <strong>Report Updated</strong>
                <div className="text-xs mt-1">{updatedReport.title}</div>
                <div className="text-xs text-gray-200">Status: {updatedReport.status} | Damage: {updatedReport.damage_level}</div>
            </div>,
            {
                position: "top-right",
                autoClose: 5000,
                theme: "light",
            }
        );
        });

        // Clock Timer
        const clockInterval = setInterval(() => {
            setTime(new Date());
        }, 1000);

        // Cleanup: Disconnect socket when leaving the dashboard
        return () => {
            socket.disconnect();
            clearInterval(clockInterval);
        };
    }, []);

    // Add this useEffect to watch for tab changes
    useEffect(() => {
    if (activeTab === 'incidents') {
        fetchReports(); // Refresh when switching to incidents tab
    }
    }, [activeTab]) 
    

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

    const toggleReport = (id) => {
        if (expandedReportId === id) {
            setExpandedReportId(null); // Collapse if already open
        } else {
            setExpandedReportId(id);   // Expand the new one
        }
    };

    const handleValidateClick = (reportId) => {
        setReportToValidate(reportId);  // 1. Remember the ID
        setActiveTab('damage_reports'); // 2. Switch the Tab
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

                    <div className="hidden md:flex items-center gap-3 bg-blue-800/50 px-4 py-1.5 rounded-lg border border-blue-700/50 mx-2">
                        <Clock size={18} className="text-blue-300" />
                        <div className="flex flex-col leading-tight text-right">
                            <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                                {time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-sm font-bold font-mono text-white">
                                {time.toLocaleTimeString()}
                            </span>
                        </div>
                    </div>

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
                    <NavButton 
                        active={activeTab === 'damage_reports'} 
                        onClick={() => setActiveTab('damage_reports')}
                        icon={<FileText size={18} />} 
                        label="Damage Reports" 
                    />
                    <NavButton 
                        active={activeTab === 'statistics'} 
                        onClick={() => setActiveTab('statistics')}
                        icon={<BarChart2 size={18} />} 
                        label="Analytics" 
                    />
                    
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
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-semibold text-gray-800">Incident Log</h2>
                                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold border border-gray-200">
                                                {reports.length}
                                            </span>
                                        </div>
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
                                                <div 
                                                    key={report.id} 
                                                    onClick={() => toggleReport(report.id)} // Click Handler
                                                    className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                                                        expandedReportId === report.id 
                                                        ? "bg-blue-50 border-blue-200 shadow-md" 
                                                        : "bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm"
                                                    }`}
                                                >
                                                    {/* Summary Header (Always Visible) */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-800 text-sm">{report.title}</span>
                                                            <span className="text-xs text-gray-400">{report.timestamp}</span>
                                                        </div>
                                                        <StatusBadge status={report.status} />
                                                    </div>

                                                    {/* Collapsed View: One-liner */}
                                                    {expandedReportId !== report.id && (
                                                        <div className="flex justify-between items-end mt-2">
                                                            <p className="text-xs text-gray-600 line-clamp-1 w-3/4">{report.description}</p>
                                                            <ChevronDown size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                                                        </div>
                                                    )}

                                                    {/* Expanded View: Full Details */}
                                                    {expandedReportId === report.id && (
                                                        <div className="mt-3 pt-3 border-t border-blue-100/50 text-sm text-gray-700 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                            
                                                            <div>
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Situation Report</span>
                                                                <p className="text-sm mt-1 leading-relaxed">{report.description}</p>
                                                            </div>
                                                            
                                                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exact Location</span>
                                                                <p className="text-sm font-medium text-gray-800 mt-0.5">{report.location}</p>
                                                                
                                                                <div className="flex items-center gap-2 mt-2 text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                                                                    <MapIcon size={12} />
                                                                    {report.lat?.toFixed(5)}, {report.lng?.toFixed(5)}
                                                                </div>
                                                            </div>

                                                            <div className="flex justify-center pt-1">
                                                                <ChevronUp size={16} className="text-blue-400" />
                                                            </div>

                                                            <div className="flex justify-end pt-2">
                                                                 <button 
                                                                    onClick={(e) => {
                                                                            e.stopPropagation(); // Prevent toggling the card
                                                                            handleValidateClick(report.id); // Redirect to Validation Page
                                                                            }}
                                                                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                                                                 >
                                                             <FileText size={14} />
                                                                    Validate Report
                                                                 </button>
                                                            </div>
                                                        </div>
                                                    )}
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

                    {/* VIEW 3: DAMAGE REPORTS & VALIDATION */}
                    {activeTab === 'damage_reports' && (
                        <DamageReports initialHighlightId={reportToValidate} />
                    )}

                    {/* VIEW 4: STATISTICS */}
                    {activeTab === 'statistics' && (
                        <Statistics reports={reports} />
                    )}

                </main>

                <ToastContainer />

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