import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle, User, LogOut, Activity, FileText, Clock, AlertCircle, ChevronRight, XCircle, ImageIcon, MessageSquare, Send, Zap, Coffee, Truck, Radio, Package, Heart, Shield, AlertTriangle, Calendar, CheckSquare } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

// Initialize Socket
const socket = io('http://127.0.0.1:5000');

const ResponderDashboard = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('tasks'); 

    // --- USER IDENTITY STATE ---
    const [currentTeamId, setCurrentTeamId] = useState(1); 
    
    // Data State
    const [reports, setReports] = useState([]); 
    const [myTeam, setMyTeam] = useState(null); 
    const [time, setTime] = useState(new Date());

    // --- MODAL & SELECTION STATE ---
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState([]); 
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // --- HISTORY MODAL STATE ---
    const [selectedHistory, setSelectedHistory] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

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
            // 1. Fetch Geofenced Reports
            const repResponse = await fetch(`http://127.0.0.1:5000/api/v1/reports?team_id=${currentTeamId}`);
            if (repResponse.ok) setReports(await repResponse.json());

            // 2. Fetch Team Info
            const resResponse = await fetch('http://127.0.0.1:5000/api/v1/resources');
            if (resResponse.ok) {
                const data = await resResponse.json();
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

        const joinChatRoom = () => {
            socket.emit('join_room', { room: `team_${currentTeamId}` });
        };

        if (socket.connected) joinChatRoom();
        socket.on('connect', joinChatRoom);

        socket.on('resource_updated', (update) => {
            if (update.type === 'team' && update.data.id === parseInt(currentTeamId)) {
                setMyTeam(update.data); 
            }
        });

        socket.on('receive_message', (data) => {
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


    // --- HANDLERS ---
    
    const openTaskModal = (task) => {
        setSelectedTask(task);
        setSelectedAssets([]); 
        setShowTaskModal(true);
    };

    const openHistoryModal = (report) => {
        setSelectedHistory(report);
        setShowHistoryModal(true);
    };

    const toggleAssetSelection = (assetId) => {
        setSelectedAssets(prev => 
            prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
        );
    };

    // --- 1. RESPOND TO MISSION ---
    const handleRespondNow = async () => {
        if (!myTeam || !selectedTask) return;
        setShowConfirmModal(true);
        setShowTaskModal(false); 
        
        try {
            // Update Team Status
            await fetch(`http://127.0.0.1:5000/api/v1/teams/${myTeam.id}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: 'Deployed', 
                    task: selectedTask.title 
                })
            });

            // Update Assets
            for (const assetId of selectedAssets) {
                await fetch(`http://127.0.0.1:5000/api/v1/assets/${assetId}/deploy`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'Deployed', location: selectedTask.location })
                });
            }

            setTimeout(() => {
                setShowConfirmModal(false);
                setShowTaskModal(true); 
                toast.success("Unit Deployed Successfully");
                fetchData();
            }, 1500);

        } catch (error) {
            console.error("Deployment error:", error);
            setShowConfirmModal(false);
        }
    };

    // --- 2. COMPLETE MISSION (UPDATED) ---
    const handleCompleteMission = async () => {
        if (!myTeam || !selectedTask) return;
        if(!window.confirm("Mark mission as COMPLETE? This will clear the incident and set unit to Idle.")) return;

        try {
            // 1. Set Team back to Idle
            await fetch(`http://127.0.0.1:5000/api/v1/teams/${myTeam.id}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Idle', task: "" })
            });

            // 2. Set Report Status to 'Cleared' (Removes it from My Tasks)
            await fetch(`http://127.0.0.1:5000/api/v1/reports/${selectedTask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Cleared' })
            });

            toast.success("Mission Completed. Incident Cleared.");
            setShowTaskModal(false);
            fetchData(); // Refresh lists
        } catch (error) {
            console.error("Error completing mission:", error);
        }
    };

    // --- HELPERS ---
    const getAssetIcon = (type) => {
        if (type === 'Drone') return <Radio size={16} />;
        if (type === 'Vehicle') return <Truck size={16} />;
        if (type === 'Medical Kit') return <Heart size={16} />;
        return <Package size={16} />;
    };

    const getDamageColor = (level) => {
        switch (level) {
            case 'Destroyed': return 'bg-red-100 text-red-700 border-red-200';
            case 'Major': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'Minor': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-gray-100 text-gray-600 border-gray-200';
        }
    };
    
    const getStatusColor = (status) => {
        switch (status) {
            case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
            case 'Active': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Cleared': return 'text-green-600 bg-green-50 border-green-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    // --- UPDATED FILTER: Only show Active/Critical tasks (Hide Pending & Cleared) ---
    const myTasks = reports.filter(r => r.status === 'Active' || r.status === 'Critical');

    const isRespondingToThis = (task) => {
        return myTeam?.status === 'Deployed' && myTeam?.current_task === task.title;
    };

    const handleSendMessage = () => {
        if (!chatMessage.trim() || !myTeam) return;
        const payload = {
            sender: myTeam.name, 
            target_room: `team_${currentTeamId}`, 
            message: chatMessage,
            timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        socket.emit('send_message', payload);
        setChatMessage("");
    };

    const updateMyStatus = async (newStatus) => {
        if (!myTeam) return;
        try {
            await fetch(`http://127.0.0.1:5000/api/v1/teams/${myTeam.id}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, task: "" })
            });
        } catch (error) { console.error(error); }
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
                    
                    <div className="flex-grow"></div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4">
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Update Availability</p>
                        <div className="flex gap-2">
                            <button onClick={() => updateMyStatus('Idle')} disabled={myTeam?.status === 'Deployed'} className={`flex-1 py-2 text-xs font-bold rounded flex flex-col items-center justify-center gap-1 transition-all ${myTeam?.status === 'Idle' || myTeam?.status === 'Deployed' ? 'bg-green-100 text-green-700 border border-green-300 shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'}`}><Zap size={14} /> Active</button>
                            <button onClick={() => updateMyStatus('Resting')} disabled={myTeam?.status === 'Deployed'} className={`flex-1 py-2 text-xs font-bold rounded flex flex-col items-center justify-center gap-1 transition-all ${myTeam?.status === 'Resting' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'}`}><Coffee size={14} /> Resting</button>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="bg-blue-100 p-2 rounded-full"><User size={16} className="text-blue-700" /></div>
                        <div><p className="text-sm font-bold text-gray-700">{myTeam ? `${myTeam.department} Agent` : "Loading..."}</p><p className="text-xs text-gray-500">{myTeam?.name}</p></div>
                    </div>
                </nav>

                {/* --- Main Content --- */}
                <main className="flex-1 p-8 overflow-y-auto">
                    
                    {/* --- TAB: MY TASKS --- */}
                    {activeTab === 'tasks' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Responder Tasks</h2>
                                <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                                    {myTasks.length} Active
                                </span>
                            </div>
                            
                            {myTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                    <CheckCircle size={48} className="mb-4 text-green-500 opacity-50" />
                                    <p className="text-lg font-semibold text-gray-500">No Active Tasks</p>
                                    <p className="text-sm">Area is clear or waiting for admin validation.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {myTasks.map(task => (
                                        <div 
                                            key={task.id}
                                            onClick={() => openTaskModal(task)}
                                            className={`bg-white p-5 rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md group
                                                ${isRespondingToThis(task) ? 'border-green-500 ring-2 ring-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'}
                                            `}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-start gap-4">
                                                    <div className={`p-3 rounded-lg ${task.status === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        <AlertCircle size={24} />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{task.title}</h3>
                                                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                                                            <span className="flex items-center gap-1"><MapPin size={14}/> {task.location}</span>
                                                            <span className="flex items-center gap-1"><Clock size={14}/> {new Date(task.timestamp).toLocaleTimeString()}</span>
                                                        </p>
                                                        {isRespondingToThis(task) && (
                                                            <div className="mt-2 flex items-center gap-2 text-green-700 font-bold text-xs bg-green-100 px-2 py-1 rounded w-fit animate-pulse">
                                                                <Activity size={12} /> CURRENTLY RESPONDING
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="flex flex-col items-end gap-2">
                                                    <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getDamageColor(task.damage_level)}`}>
                                                        {task.damage_level}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- TAB: CHAT --- */}
                    {activeTab === 'chat' && (
                        <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center"><h2 className="font-bold text-gray-800 flex items-center gap-2"><MessageSquare className="text-blue-600" /> Command Center Link</h2></div>
                            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50 space-y-4">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`flex ${msg.sender === 'Admin' ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${msg.sender === 'Admin' ? 'bg-white text-gray-800 border border-gray-200 rounded-bl-none' : 'bg-blue-600 text-white rounded-br-none'}`}><p className="text-sm">{msg.message}</p></div></div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                            <div className="p-4 bg-white border-t border-gray-200"><div className="flex gap-2"><input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Type update to HQ..." className="flex-1 p-3 border border-gray-300 rounded-lg" /><button onClick={handleSendMessage} className="p-3 bg-blue-600 text-white rounded-lg"><Send size={20} /></button></div></div>
                        </div>
                    )}

                    {/* --- TAB: INCIDENT LOG (RESTORED CLICKABLE CARDS) --- */}
                    {activeTab === 'incidents' && (
                        <div className="max-w-4xl mx-auto">
                            <h2 className="text-2xl font-bold text-gray-800 mb-6">Operational History</h2>
                            <div className="space-y-4">
                                {reports.map(report => (
                                    <div 
                                        key={report.id} 
                                        onClick={() => openHistoryModal(report)}
                                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{report.title}</h3>
                                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1"><MapPin size={12} /> {report.location}</span>
                                                    <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(report.timestamp).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(report.status)}`}>
                                                {report.status}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </main>
            </div>

            {/* --- TASK DETAIL MODAL --- */}
            {showTaskModal && selectedTask && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in zoom-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className={`p-6 border-b border-gray-100 flex justify-between items-start ${isRespondingToThis(selectedTask) ? 'bg-green-50' : 'bg-white'}`}>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedTask.title}</h3>
                                {isRespondingToThis(selectedTask) && (
                                    <div className="mt-2 flex items-center gap-2 text-green-700 font-bold bg-green-100 px-3 py-1 rounded-full w-fit">
                                        <Activity size={16} className="animate-bounce"/> UNIT CURRENTLY RESPONDING
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowTaskModal(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-200"><XCircle size={28} /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="mb-6 w-full h-48 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden">
                                {selectedTask.image_url ? <img src={selectedTask.image_url} alt="Incident" className="w-full h-full object-cover" /> : <ImageIcon size={48} className="text-gray-400 opacity-50" />}
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Damage Assessment</p>
                                    <div className={`inline-block px-2 py-0.5 rounded text-sm font-bold border ${getDamageColor(selectedTask.damage_level)}`}>{selectedTask.damage_level || "Pending"}</div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-xs font-bold text-gray-400 uppercase mb-1">Time</p>
                                    <p className="font-bold text-gray-800">{new Date(selectedTask.timestamp).toLocaleTimeString()}</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                                <p className="text-sm font-bold text-blue-900 mb-1">Incident Description</p>
                                <p className="text-blue-800 text-sm leading-relaxed">{selectedTask.description}</p>
                            </div>

                            {!isRespondingToThis(selectedTask) && (
                                <div className="mb-6">
                                    <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><Truck size={16} className="text-gray-500"/> Select Assets for Response</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {myTeam?.assets && myTeam.assets.filter(a => a.status === 'Available').length > 0 ? (
                                            myTeam.assets.filter(a => a.status === 'Available').map(asset => (
                                                <div key={asset.id} onClick={() => toggleAssetSelection(asset.id)} className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${selectedAssets.includes(asset.id) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                                                    <div className="flex items-center gap-2"><div className="text-gray-500">{getAssetIcon(asset.type)}</div><span className="text-sm font-medium text-gray-700">{asset.name}</span></div>
                                                    {selectedAssets.includes(asset.id) && <CheckCircle size={16} className="text-blue-600" />}
                                                </div>
                                            ))
                                        ) : <p className="text-sm text-gray-400 italic col-span-2">No available assets at this time.</p>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-lg transition-colors">Close</button>
                            {isRespondingToThis(selectedTask) ? (
                                <button onClick={handleCompleteMission} className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg shadow-md flex items-center gap-2"><CheckSquare size={18} /> Complete Mission</button>
                            ) : (
                                <button onClick={handleRespondNow} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2"><Zap size={18} fill="currentColor" /> Respond Now</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- HISTORY MODAL (NEW) --- */}
            {showHistoryModal && selectedHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in zoom-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                            <div><h3 className="text-xl font-bold text-gray-900">{selectedHistory.title}</h3><p className="text-sm text-gray-500 flex items-center gap-2 mt-1"><MapPin size={14} /> {selectedHistory.location}</p></div>
                            <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-200"><XCircle size={28} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="mb-6 w-full h-48 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden">
                                {selectedHistory.image_url ? <img src={selectedHistory.image_url} alt="Incident" className="w-full h-full object-cover" /> : <ImageIcon size={48} className="text-gray-400 opacity-50" />}
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><p className="text-xs font-bold text-gray-400 uppercase mb-1">Damage Assessment</p><div className={`inline-block px-2 py-0.5 rounded text-sm font-bold border ${getDamageColor(selectedHistory.damage_level)}`}>{selectedHistory.damage_level || "Pending"}</div></div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200"><p className="text-xs font-bold text-gray-400 uppercase mb-1">Status</p><div className={`inline-block px-2 py-0.5 rounded text-sm font-bold border ${getStatusColor(selectedHistory.status)}`}>{selectedHistory.status}</div></div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6"><p className="text-sm font-bold text-gray-600 mb-1">Incident Description</p><p className="text-gray-800 text-sm leading-relaxed">{selectedHistory.description}</p></div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end"><button onClick={() => setShowHistoryModal(false)} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-lg">Close</button></div>
                    </div>
                </div>
            )}

            {/* --- CONFIRMATION MODAL --- */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-sm w-full transform scale-110">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Activity size={40} className="text-green-600" /></div>
                        <h2 className="text-2xl font-bold text-gray-900">Responding Now!</h2>
                        <p className="text-gray-500 mt-2">HQ has been notified. Status set to Deployed.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const NavButton = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left ${active ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
        {icon} {label}
    </button>
);

export default ResponderDashboard;