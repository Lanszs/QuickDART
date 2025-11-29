import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle, User, LogOut, Activity, FileText, Clock, AlertCircle, ChevronDown, Coffee, Zap, RotateCcw, MessageSquare, Send } from 'lucide-react';
import { io } from 'socket.io-client';

// Initialize Socket
const socket = io('http://127.0.0.1:5000');

const ResponderDashboard = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('tasks'); 
    const [uploading, setUploading] = useState(false);
    const [aiResult, setAiResult] = useState(null);

    // --- USER IDENTITY STATE ---
    // Defaults to Team ID 1 (Flood Response Unit) since we don't have login yet
    const [currentTeamId, setCurrentTeamId] = useState(1); 
    
    // Data State
    const [reports, setReports] = useState([]);
    const [myTeam, setMyTeam] = useState(null); 
    const [time, setTime] = useState(new Date());

    // --- CHAT STATE ---
    const [chatMessage, setChatMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const chatEndRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- FETCH DATA ---
    const fetchData = async () => {
        try {
            const repResponse = await fetch('http://127.0.0.1:5000/api/v1/reports');
            if (repResponse.ok) setReports(await repResponse.json());

            const resResponse = await fetch('http://127.0.0.1:5000/api/v1/resources');
            if (resResponse.ok) {
                const data = await resResponse.json();
                
                // Find MY currently selected team
                const team = data.teams.find(t => t.id === parseInt(currentTeamId)); 
                setMyTeam(team);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

    useEffect(() => {
        fetchData(); 
        const interval = setInterval(fetchData, 5000);

        // --- SOCKET SETUP (FIXED) ---
        
        // Function to join the room (we need this for reconnects too)
        const joinChatRoom = () => {
            console.log(`🔌 Joining Chat Room: team_${currentTeamId}`);
            socket.emit('join_room', { room: `team_${currentTeamId}` });
        };

        // 1. Join immediately if connected
        if (socket.connected) joinChatRoom();

        // 2. Join again if we reconnect (fixes the "missing messages" bug)
        socket.on('connect', joinChatRoom);

        // 3. Listen for Resource Updates
        socket.on('resource_updated', (update) => {
            if (update.type === 'team' && update.data.id === parseInt(currentTeamId)) {
                setMyTeam(update.data); 
            }
        });

        // 4. Listen for Chat Messages
        socket.on('receive_message', (data) => {
            console.log("📩 Message Received:", data);
            // Only show messages meant for ME (team_X)
            if (data.target_room === `team_${currentTeamId}`) {
                setMessages(prev => [...prev, data]);
            }
        });

        return () => {
            clearInterval(interval);
            socket.off('connect', joinChatRoom);
            socket.off('resource_updated');
            socket.off('receive_message');
        };
    }, [currentTeamId]); 

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, activeTab]);

    // --- CHAT FUNCTION ---
    const handleSendMessage = () => {
        if (!chatMessage.trim() || !myTeam) return;

        const payload = {
            sender: myTeam.name, // e.g., "Flood Response Unit"
            target_room: `team_${currentTeamId}`, 
            message: chatMessage,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };

        socket.emit('send_message', payload);
        setChatMessage("");
    };

    // --- UPDATE STATUS FUNCTION ---
    const updateMyStatus = async (newStatus) => {
        if (!myTeam) return;
        try {
            await fetch(`http://127.0.0.1:5000/api/v1/teams/${myTeam.id}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, task: "" })
            });
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    // --- AI SCANNER LOGIC ---
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
            if (response.ok) setAiResult(await response.json());
            else {
                const err = await response.json();
                alert(`AI Error: ${err.error || 'Server failed to process image'}`);
            }
        } catch (error) {
            alert("Network Error: Could not connect to AI server.");
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
                    {/* Status Indicator (Dropdown Removed) */}
                    <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-lg">
                        <span className="text-xs text-gray-400 uppercase font-bold">Status</span>
                        <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${myTeam?.status === 'Deployed' ? 'bg-red-500 animate-pulse' : myTeam?.status === 'Resting' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                            <span className="font-bold text-sm">{myTeam?.status || 'Connecting...'}</span>
                        </div>
                    </div>

                    <button onClick={onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors ml-4 border-l border-gray-700 pl-6">
                        <LogOut size={18} />
                        <span className="text-sm font-bold">Logout</span>
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- Sidebar --- */}
                <nav className="w-64 bg-white shadow-lg flex flex-col p-4 gap-2 border-r border-gray-200">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Field Operations</div>
                    
                    <NavButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<CheckCircle size={18} />} label="My Tasks" />
                    <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={18} />} label="Command Chat" />
                    <NavButton active={activeTab === 'incidents'} onClick={() => setActiveTab('incidents')} icon={<FileText size={18} />} label="Incident Log" />
                    <NavButton active={activeTab === 'scanner'} onClick={() => setActiveTab('scanner')} icon={<Camera size={18} />} label="AI Scanner" />
                    
                    <div className="flex-grow"></div>

                    {/* Status Toggle */}
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4">
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Update Availability</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => updateMyStatus('Idle')}
                                disabled={myTeam?.status === 'Deployed'}
                                className={`flex-1 py-2 text-xs font-bold rounded flex flex-col items-center justify-center gap-1 transition-all ${myTeam?.status === 'Idle' || myTeam?.status === 'Deployed' ? 'bg-green-100 text-green-700 border border-green-300 shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'}`}
                            >
                                <Zap size={14} /> Active
                            </button>
                            <button 
                                onClick={() => updateMyStatus('Resting')}
                                disabled={myTeam?.status === 'Deployed'}
                                className={`flex-1 py-2 text-xs font-bold rounded flex flex-col items-center justify-center gap-1 transition-all ${myTeam?.status === 'Resting' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'}`}
                            >
                                <Coffee size={14} /> Resting
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="bg-blue-100 p-2 rounded-full"><User size={16} className="text-blue-700" /></div>
                        <div>
                            <p className="text-sm font-bold text-gray-700">{myTeam ? `Agent ${myTeam.specialization.split(' ')[0]}` : "Loading..."}</p>
                            <p className="text-xs text-gray-500">{myTeam?.name}</p>
                        </div>
                    </div>
                </nav>

                {/* --- Main Content --- */}
                <main className="flex-1 p-8 overflow-y-auto">
                    
                    {/* TAB: TASKS */}
                    {activeTab === 'tasks' && (
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">Orders for: <span className="text-blue-600">{myTeam?.name}</span></h2>
                            {myTeam?.status === 'Deployed' ? (
                                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl shadow-sm mb-6 animate-in slide-in-from-left duration-300">
                                    <div className="flex items-start gap-4">
                                        <div className="bg-red-100 p-3 rounded-full"><AlertCircle size={32} className="text-red-600" /></div>
                                        <div>
                                            <h3 className="text-xl font-bold text-red-800 mb-1">MISSION ACTIVE</h3>
                                            <p className="text-red-700 font-medium text-lg">{myTeam.current_task || "Proceed to designated area."}</p>
                                            <div className="mt-4 flex gap-3 text-sm text-red-600 font-bold opacity-75"><span className="flex items-center gap-1"><Clock size={16}/> Status: ACTION REQUIRED</span></div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                    <CheckCircle size={48} className="mb-4 text-green-500 opacity-50" />
                                    <p className="text-lg font-semibold text-gray-500">Unit is {myTeam?.status}</p>
                                    <p className="text-sm">Stand by for orders.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: COMMAND CHAT */}
                    {activeTab === 'chat' && (
                        <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="text-blue-600" /> Command Center Link</h2>
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Online</span>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50 space-y-4">
                                {messages.length > 0 ? (
                                    messages.map((msg, index) => (
                                        <div key={index} className={`flex ${msg.sender === 'Admin' ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${msg.sender === 'Admin' ? 'bg-white text-gray-800 border border-gray-200 rounded-bl-none' : 'bg-blue-600 text-white rounded-br-none'}`}>
                                                {msg.sender === 'Admin' && <p className="text-[10px] font-bold text-blue-600 mb-1">HQ (Admin)</p>}
                                                <p className="text-sm">{msg.message}</p>
                                                <p className={`text-[10px] mt-1 text-right ${msg.sender === 'Admin' ? 'text-gray-400' : 'text-blue-200'}`}>{msg.timestamp}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                                        <MessageSquare size={48} className="mb-2" />
                                        <p>No messages yet</p>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 bg-white border-t border-gray-200">
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={chatMessage}
                                        onChange={(e) => setChatMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                        placeholder="Type update to HQ..."
                                        className="flex-1 p-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                                    />
                                    <button onClick={handleSendMessage} className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: INCIDENTS */}
                    {activeTab === 'incidents' && (
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">Live Incident Feed</h2>
                            <div className="space-y-4">
                                {reports.map((report) => (
                                    <div key={report.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                        <h3 className="font-bold text-gray-800">{report.title}</h3>
                                        <p className="text-gray-600 text-sm">{report.description}</p>
                                        <div className="mt-2 text-xs text-gray-400 flex gap-4">
                                            <span><MapPin size={12} className="inline mr-1"/> {report.location}</span>
                                            <StatusBadge status={report.status} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB: SCANNER */}
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

                </main>
            </div>
        </div>
    );
};

const NavButton = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left ${active ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
        {icon} {label}
    </button>
);

const StatusBadge = ({ status }) => {
    let colors = "bg-gray-100 text-gray-600";
    if (status === 'Critical') colors = "bg-red-100 text-red-700";
    if (status === 'Active') colors = "bg-blue-100 text-blue-700";
    if (status === 'Cleared') colors = "bg-green-100 text-green-700";
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors}`}>{status}</span>;
};

export default ResponderDashboard;