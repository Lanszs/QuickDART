import React, { useState, useEffect, useRef } from 'react';
import IncidentMap from './IncidentMap';
import AssetsTeams from './AssetsTeams';
import { 
    Map as MapIcon, 
    FileUp, 
    LogOut, 
    Activity, 
    Users, 
    FileText, 
    Settings, 
    RefreshCw, 
    AlertTriangle, 
    Clock, 
    ChevronDown, 
    ChevronUp, 
    BarChart2,
    MessageSquare, 
    Send,
    User,
    CheckCircle,
    AlertCircle,
    XCircle
} from 'lucide-react';
import DamageReports from './DamageReports';
import { io } from 'socket.io-client';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Statistics from './Statistics';

// Initialize Socket outside component
const socket = io('http://127.0.0.1:5000');

const Dashboard = ({ userRole, onLogout }) => {
    // State for Active Tab
    const [activeTab, setActiveTab] = useState('incidents');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [expandedReportId, setExpandedReportId] = useState(null);
    const [reports, setReports] = useState([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [time, setTime] = useState(new Date());
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [reportToValidate, setReportToValidate] = useState(null);
    
    // --- CHAT STATE ---
    const [teams, setTeams] = useState([]);
    const [selectedChatTeam, setSelectedChatTeam] = useState(null);
    const [chatMessage, setChatMessage] = useState("");
    const [messages, setMessages] = useState({}); 
    const chatEndRef = useRef(null);

    // --- FIX: RESET STATE ON MANUAL NAVIGATION ---
    const handleNavigation = (tabName) => {
        setActiveTab(tabName);
        setReportToValidate(null);
    };

    // --- 1. FILTER: HIDE 'CLEARED' ---
    const visibleReports = reports.filter(r => r.status !== 'Cleared');

    // --- 2. SORTING CONFIGURATION ---
    const DAMAGE_ORDER = { 'Destroyed': 4, 'Major': 3, 'Minor': 2, 'No Damage': 1, 'Unknown': 0 };

    // Sort Helper
    const sortReportsByDamage = (reportList) => {
    return [...reportList].sort((a, b) => {
        const damageA = DAMAGE_ORDER[a.damage_level] || 0;
        const damageB = DAMAGE_ORDER[b.damage_level] || 0;
        return damageB - damageA;
    });
    };

    const DamageBadge = ({ level }) => {
    let colors = "bg-gray-100 text-gray-500";
    let icon = null;

    if (level === 'Destroyed') { colors = "bg-red-700 text-white"; icon = <XCircle size={12} />; }
    else if (level === 'Major') { colors = "bg-orange-600 text-white"; icon = <AlertCircle size={12} />; }
    else if (level === 'Minor') { colors = "bg-yellow-200 text-yellow-800"; icon = <AlertTriangle size={12} />; }
    else if (level === 'Pending') { colors = "bg-gray-500 text-white"; icon = <AlertCircle size={12} />; }
    
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 ${colors}`}>
            {icon} {level}
        </span>
    );
    };

    const IncidentCard = ({ report, expandedId, onToggle, onValidate }) => {
    const isExpanded = expandedId === report.id;
    const isPending = report.status === 'Pending';
    
    return (
        <div 
            onClick={() => onToggle(report.id)} 
            className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                isExpanded 
                ? "bg-blue-50 border-blue-200 shadow-md" 
                : isPending ? "bg-orange-50 border-orange-200/50 hover:border-orange-300" : "bg-white border-gray-100 hover:border-blue-200 hover:shadow-sm"
            }`}
        >
            <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                    <span className="font-bold text-gray-800 text-sm">{report.title}</span>
                    <span className="text-xs text-gray-400">{report.timestamp}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={report.status} />
                    <DamageBadge level={report.damage_level} />
                </div>
            </div>

            {!isExpanded && (
                <div className="flex justify-between items-end mt-2">
                    <p className="text-xs text-gray-600 line-clamp-1 w-3/4">{report.description}</p>
                    <ChevronDown size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                </div>
            )}

            {isExpanded && (
                <div className="mt-3 pt-3 border-t border-blue-100/50 text-sm text-gray-700 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Situation Report</span><p className="text-sm mt-1 leading-relaxed">{report.description}</p></div>
                    
                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Exact Location</span>
                        <p className="text-sm font-medium text-gray-800 mt-0.5">{report.location}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit"><MapIcon size={12} /> {report.latitude?.toFixed(5)}, {report.longitude?.toFixed(5)}</div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onValidate(report.id); }} 
                            className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                        >
                            <FileText size={14} /> Triage & Validate
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
    };

    // --- FILTERED REPORTS FOR INCIDENT LOG ---
    // This creates a list that EXCLUDES "Cleared" items
    const activeIncidentLog = reports.filter(r => r.status !== 'Cleared');

    const saveReport = async () => {
        if (!analysisResult) return;

        const newReport = {
            title: `Detected: ${analysisResult.type}`,
            description: `AI Analysis Confidence: ${analysisResult.confidence}. Damage Assessment: ${analysisResult.damage}`,
            status: 'Active',
            location: 'Sector 4 (Detected)',
            latitude: 14.7546,
            longitude: 120.9466,
            damage_level: analysisResult.damage,
            image_url: analysisResult.image_url
        };

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReport)
            });

            if (response.ok) {
                toast.success("Report Saved to Database!");
                setAnalysisResult(null);
                setUploadedFile(null);
                fetchReports();
            } else {
                toast.error("Failed to save report.");
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

    // Fetch Teams for Chat List
    const fetchTeams = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/resources');
            if (response.ok) {
                const data = await response.json();
                setTeams(data.teams);
            }
        } catch (error) {
            console.error("Error loading teams:", error);
        }
    };

    // --- 1. SOCKET & DATA EFFECT ---
    useEffect(() => {
        fetchReports();
        fetchTeams(); 

        // Join Admin Room
        socket.emit('join_room', { room: 'admin_room' });

        socket.on('connect', () => {
            console.log("✅ Connected to WebSocket Server");
        });

        // Listen for new reports
        socket.on('new_report', (newReport) => {
            setReports((prevReports) => {
                if (prevReports.some(r => r.id === newReport.id)) return prevReports;
                return [newReport, ...prevReports];
            });
            toast.error(
                <div>
                    <strong>New Incident Reported!</strong>
                    <div className="text-xs mt-1">{newReport.title}</div>
                </div>, 
                { autoClose: 7000, theme: "colored" }
            );
        });

        // Listen for report updates
        socket.on('report_updated', (updatedReport) => {
            setReports((prevReports) => 
                prevReports.map(report => 
                    report.id === updatedReport.id ? updatedReport : report
                )
            );
        });

        // --- FIX: LISTEN FOR TEAM CHANGES TO UPDATE CHAT LIST ---
        socket.on('resource_updated', (update) => {
            if (update.type === 'team') {
                console.log("🔄 Teams updated, refreshing chat list...");
                fetchTeams();
            }
        });

        // --- LISTEN FOR CHAT MESSAGES ---
        socket.on('receive_message', (data) => {
            // Admin needs to figure out WHICH team conversation this belongs to
            let teamKey = null;
            
            // If Admin sent it, the target was "team_X"
            // If Team sent it, the target was also "team_X" (echoed by backend)
            const parts = data.target_room.split('_');
            if (parts.length > 1) teamKey = parseInt(parts[1]);

            if (teamKey) {
                setMessages(prev => ({
                    ...prev,
                    [teamKey]: [...(prev[teamKey] || []), data]
                }));
            }
        });

        const clockInterval = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => {
            socket.off('receive_message');
            socket.off('new_report');
            socket.off('report_updated');
            socket.off('resource_updated');
            clearInterval(clockInterval);
        };
    }, []);


    // --- 2. CLOCK EFFECT (Separated for performance) ---
    useEffect(() => {
        const clockInterval = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(clockInterval);
    }, []);

    useEffect(() => {
        if (selectedChatTeam) {
            const teamId = selectedChatTeam.id;
            console.log(`🔄 Fetching history for team_${teamId}...`);

            fetch(`http://127.0.0.1:5000/api/v1/chat/history/team_${teamId}`)
                .then(res => res.json())
                .then(history => {
                    console.log(`📜 Loaded ${history.length} messages for Team ${teamId}`);
                    setMessages(prev => ({
                        ...prev,
                        [teamId]: history // Set the history
                    }));
                })
                .catch(err => console.error("History Fetch Error:", err));
        }
    }, [selectedChatTeam]); 

    // AUTO-SCROLL CHAT
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, selectedChatTeam])

   
    const handleSendMessage = () => {
        if (!chatMessage.trim() || !selectedChatTeam) return;

        const payload = {
            sender: 'Admin',
            target_room: `team_${selectedChatTeam.id}`, 
            message: chatMessage,
            timestamp: new Date().toISOString()
        };

        socket.emit('send_message', payload);
        
        // We rely on the server echo to update local state
        setChatMessage("");
    };
    // -------------------------------------------------

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            setAnalysisResult(null);
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
            setExpandedReportId(null);
        } else {
            setExpandedReportId(id);
        }
    };

    const handleValidateClick = (reportId) => {
        setReportToValidate(reportId);
        setActiveTab('damage_reports');
    };

    const getGroupedReports = () => {
        const activeReports = reports.filter(r => r.status !== 'Cleared');
        const groups = { pending: [], active: [] };
        activeReports.forEach(report => {
            if (report.status === 'Pending') groups.pending.push(report);
            else groups.active.push(report);
        });
        return {
            pending: sortReportsByDamage(groups.pending),
            active: sortReportsByDamage(groups.active)
        };
    };

    const groupedReports = getGroupedReports();
    const totalVisibleReports = groupedReports.pending.length + groupedReports.active.length;

    return (
        <div className="flex flex-col h-screen w-full bg-gray-100">
            {/* --- Header --- */}
            <header className="bg-blue-900 text-white p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-6 w-6 text-red-500" />
                    DRR Admin Center
                </h1>
                
                <div className="flex items-center gap-4 text-sm">
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

                    <button onClick={onLogout} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors">
                        <LogOut size={16} /> Logout
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- Sidebar --- */}
                <nav className="w-64 bg-white shadow-lg hidden md:flex flex-col p-4 gap-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</div>
                    
                    <NavButton active={activeTab === 'incidents'} onClick={() => handleNavigation('incidents')} icon={<Activity size={18} />} label="Incidents" />
                    <NavButton active={activeTab === 'assets'} onClick={() => handleNavigation('assets')} icon={<Users size={18} />} label="Assets & Teams" />
                    <NavButton active={activeTab === 'dispatch'} onClick={() => handleNavigation('dispatch')} icon={<MessageSquare size={18} />} label="Dispatch / Chat" />
                    <NavButton active={activeTab === 'damage_reports'} onClick={() => handleNavigation('damage_reports')} icon={<FileText size={18} />} label="Damage Reports" />
                    <NavButton active={activeTab === 'statistics'} onClick={() => handleNavigation('statistics')} icon={<BarChart2 size={18} />} label="Analytics" />
                    
                    <div className="flex-grow"></div>
                    <NavButton icon={<Settings size={18} />} label="Settings" />
                </nav>

                {/* --- Main Content --- */}
                <main className="flex-1 p-0 overflow-y-auto">
                    
                    {/* VIEW 1: INCIDENTS (FILTERED) */}
                    {activeTab === 'incidents' && (
                        <div className="p-6">
                            {uploadedFile && (
                                <div className="mb-6 bg-white border border-gray-200 p-4 rounded-xl shadow-sm flex flex-col gap-3">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-blue-50 rounded-lg"><FileUp className="text-blue-600" size={24} /></div>
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-800">File Uploaded: {uploadedFile.name}</h3>
                                            {isAnalyzing && <p className="text-sm text-gray-500 animate-pulse mt-1">🤖 AI is analyzing the scene...</p>}
                                            {analysisResult && (
                                                <div className="mt-3">
                                                    <div className="flex items-center gap-4 mb-2">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800"><AlertTriangle size={14} /> Detected: {analysisResult.type}</span>
                                                        <span className="text-xs text-gray-500">Confidence: {analysisResult.confidence}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-600"><strong>Assessment:</strong> {analysisResult.damage}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {analysisResult && (
                                        <div className="flex gap-3 mt-2 pl-[60px]">
                                            <button onClick={saveReport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center gap-2"><FileText size={16} /> Confirm & Save to Log</button>
                                            <button onClick={() => { setUploadedFile(null); setAnalysisResult(null); }} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold transition-colors">Discard</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                                <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><MapIcon className="text-blue-600" /> Live Incident Map</h2>
                                    <div className="flex-1 rounded-lg overflow-hidden border border-gray-300 relative z-0"><IncidentMap reports={reports} /></div>
                                </div>

                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-gray-800">Incident Log</h2><span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs font-bold border border-gray-200">{totalVisibleReports}</span></div>
                                        <button onClick={fetchReports} className="text-gray-500 hover:text-blue-600" title="Refresh"><RefreshCw size={16} /></button>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                        {isLoadingReports ? <div className="text-center text-gray-400 py-4">Loading...</div> : totalVisibleReports === 0 ? <div className="text-center text-gray-400 py-4">No active incidents.</div> : (
                                            <>
                                                {groupedReports.pending.length > 0 && (
                                                    <div className="mb-4 animate-in slide-in-from-left duration-300">
                                                        <div className="flex items-center gap-2 mb-2 text-orange-700 font-bold text-xs uppercase tracking-wider border-b border-orange-100 pb-1"><AlertCircle size={14} /> Pending Validation</div>
                                                        <div className="space-y-3">
                                                            {groupedReports.pending.map(report => (
                                                                <IncidentCard key={report.id} report={report} expandedId={expandedReportId} onToggle={toggleReport} onValidate={handleValidateClick} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {groupedReports.active.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-xs uppercase tracking-wider border-b border-blue-100 pb-1"><Activity size={14} /> Active Incidents</div>
                                                        <div className="space-y-3">
                                                            {groupedReports.active.map(report => (
                                                                <IncidentCard key={report.id} report={report} expandedId={expandedReportId} onToggle={toggleReport} onValidate={handleValidateClick} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: ASSETS */}
                    {activeTab === 'assets' && <AssetsTeams />}

                    {/* VIEW 3: DISPATCH */}
                    {activeTab === 'dispatch' && (
                        <div className="flex h-full p-6 gap-6">
                            <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl"><h3 className="font-bold text-gray-700 flex items-center gap-2"><Users size={18} /> Active Units</h3></div>
                                <div className="overflow-y-auto flex-1">
                                    {teams.map(team => (
                                        <div key={team.id} onClick={() => setSelectedChatTeam(team)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selectedChatTeam?.id === team.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}>
                                            <div className="flex justify-between items-start"><span className="font-bold text-gray-800">{team.name}</span><span className={`h-2 w-2 rounded-full ${team.status === 'Deployed' ? 'bg-red-500' : 'bg-green-500'}`}></span></div>
                                            <p className="text-xs text-gray-500 mt-1 truncate">{team.department}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                                {selectedChatTeam ? (
                                    <>
                                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50"><div><h3 className="font-bold text-gray-800">{selectedChatTeam.name}</h3><p className="text-xs text-gray-500 flex items-center gap-1"><span className={`inline-block w-2 h-2 rounded-full ${selectedChatTeam.status === 'Deployed' ? 'bg-red-500' : 'bg-green-500'}`}></span>{selectedChatTeam.status}</p></div></div>
                                        <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50 space-y-4">
                                           {messages[selectedChatTeam.id]?.length > 0 ? (
                                                messages[selectedChatTeam.id].map((msg, index) => (
                                                    <div key={index} className={`flex ${msg.sender === 'Admin' ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${msg.sender === 'Admin' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                                                            {msg.sender !== 'Admin' && <p className="text-[10px] font-bold text-gray-500 mb-1">{msg.sender}</p>}
                                                            <p className="text-sm">{msg.message}</p>
                                                            <p className={`text-[10px] mt-1 text-right ${msg.sender === 'Admin' ? 'text-blue-200' : 'text-gray-400'}`}>
                                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50"><MessageSquare size={48} className="mb-2" /><p>Start communication with this unit</p></div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>
                                        <div className="p-4 bg-white border-t border-gray-200"><div className="flex gap-2"><input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={`Message ${selectedChatTeam.name}...`} className="flex-1 p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" /><button onClick={handleSendMessage} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"><Send size={20} /></button></div></div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400"><div className="bg-gray-100 p-6 rounded-full mb-4"><MessageSquare size={48} className="text-gray-300" /></div><p className="text-lg font-medium">Select a Response Unit</p><p className="text-sm">Choose a team to start communicating.</p></div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VIEW 4: DAMAGE REPORTS */}
                    {activeTab === 'damage_reports' && <DamageReports initialHighlightId={reportToValidate} />}

                    {/* VIEW 5: STATISTICS */}
                    {activeTab === 'statistics' && <Statistics reports={reports} />}

                </main>
                <ToastContainer />
            </div>
        </div>
    );
};

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
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors}`}>{status}</span>;
};

export default Dashboard;