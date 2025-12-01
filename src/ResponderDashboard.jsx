import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle, User, LogOut, Activity, 
    FileText, Clock, AlertCircle, ChevronRight, XCircle, ImageIcon, 
    MessageSquare, Send, Zap, Coffee, Truck, Radio, Package, Heart, Shield, 
    AlertTriangle, Calendar, CheckSquare, Plus, Trash2, Wrench, History, Archive, Square, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

// Initialize Socket
const socket = io('http://127.0.0.1:5000');

const ResponderDashboard = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('tasks'); 
    const [incidentTab, setIncidentTab] = useState('active');

    // --- USER IDENTITY STATE ---
    const [currentTeamId, setCurrentTeamId] = useState(() => {
        const stored = localStorage.getItem('user_team_id');
        return stored ? parseInt(stored) : null;
    });
    
    // Data State
    const [reports, setReports] = useState([]); 
    const [myTeam, setMyTeam] = useState(null); 
    const [time, setTime] = useState(new Date());

    // --- MODAL & SELECTION STATE ---
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState([]); 
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [deployedPersonnel, setDeployedPersonnel] = useState(0);

    const [showAddAssetModal, setShowAddAssetModal] = useState(false);
    const [newAsset, setNewAsset] = useState({ name: '', type: 'Vehicle' });
    const [inventorySelection, setInventorySelection] = useState([]);

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

   // --- MAIN DATA FETCHING & SOCKET SETUP ---
    useEffect(() => {
        if (!currentTeamId) return;

        const fetchInitialData = async () => {
            try {
                // 1. Reports
                const repRes = await fetch(`http://127.0.0.1:5000/api/v1/reports?team_id=${currentTeamId}`);
                if (repRes.ok) {
                    const allReports = await repRes.json();
                    // Initial Filter: No Pending
                    setReports(allReports.filter(r => r.status !== 'Pending'));
                }

                // 2. Team Info
                const resRes = await fetch('http://127.0.0.1:5000/api/v1/resources');
                if (resRes.ok) {
                    const data = await resRes.json();
                    const team = data.teams.find(t => t.id === parseInt(currentTeamId)); 
                    setMyTeam(team);
                }

                // 3. Chat History
                const chatRes = await fetch(`http://127.0.0.1:5000/api/v1/chat/history/team_${currentTeamId}`);
                if (chatRes.ok) {
                    setMessages(await chatRes.json());
                }

            } catch (error) {
                console.error("Data Load Error:", error);
            }
        };

        fetchInitialData();

        // --- SOCKET LISTENERS ---
        const joinChatRoom = () => {
            socket.emit('join_room', { room: `team_${currentTeamId}` });
        };
        if (socket.connected) joinChatRoom();
        socket.on('connect', joinChatRoom);

        // 1. Resource Updates (Team Status / Assets)
        socket.on('resource_updated', (update) => {
            if (update.type === 'team' || update.type === 'asset') {
                // Refresh team info to get new status/assets
                fetch(`http://127.0.0.1:5000/api/v1/resources`)
                    .then(res => res.json())
                    .then(data => {
                        const team = data.teams.find(t => t.id === parseInt(currentTeamId)); 
                        setMyTeam(team);
                    });
            }
        });

        // 2. Chat Messages
        socket.on('receive_message', (data) => {
            if (data.target_room === `team_${currentTeamId}`) {
                setMessages(prev => [...prev, data]);
            }
        });

        // 3. New Reports (ONLY if not Pending)
        socket.on('new_report', (newReport) => {
            if (newReport.status !== 'Pending') {
                setReports(prev => [newReport, ...prev]);
                toast.info(`New Alert: ${newReport.title}`);
            }
        });

        // 4. Report Updates (Status Change)
        socket.on('report_updated', (updatedReport) => {
            setReports(prev => {
                const exists = prev.find(r => r.id === updatedReport.id);
                if (exists) {
                    // If it becomes Pending (unlikely), remove it. Else update it.
                    if (updatedReport.status === 'Pending') return prev.filter(r => r.id !== updatedReport.id);
                    return prev.map(r => r.id === updatedReport.id ? updatedReport : r);
                } else if (updatedReport.status !== 'Pending') {
                    // It wasn't in our list (was Pending), now it is Active -> Add it
                    return [updatedReport, ...prev];
                }
                return prev;
            });
        });

        return () => {
            socket.off('connect', joinChatRoom);
            socket.off('resource_updated');
            socket.off('receive_message');
            socket.off('new_report');
            socket.off('report_updated');
        };
    }, [currentTeamId]);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, activeTab]);

    // --- CHAT SENDING ---
    const handleSendMessage = () => {
        if (!chatMessage.trim() || !myTeam) return;

        const payload = {
            sender: myTeam.name, 
            target_room: `team_${currentTeamId}`, // Send to my own room
            message: chatMessage,
            timestamp: new Date().toISOString()
        };

        socket.emit('send_message', payload);
        // We DO NOT setMessages here manually. We wait for the server to echo it back.
        setChatMessage("");
    };


    // --- HANDLERS ---
    
    const openTaskModal = (task) => {
        setSelectedTask(task);
        setSelectedAssets([]); 
        setDeployedPersonnel(myTeam?.personnel_count || 0);
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
                    task: selectedTask.title,
                    report_id: selectedTask.id
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
        if(!window.confirm("Mark mission as COMPLETE? This will clear the incident, return assets to base, and notify HQ.")) return;

        try {
            // 1. Set Team back to Idle
            await fetch(`http://127.0.0.1:5000/api/v1/teams/${myTeam.id}/deploy`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Idle', task: "", report_id: null })
            });

            // 2. Set Report Status to 'Cleared'
            await fetch(`http://127.0.0.1:5000/api/v1/reports/${selectedTask.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Cleared' })
            });

            // 3. Reset Deployed Assets to 'Available'
            if (myTeam.assets) {
                const assetsToReset = myTeam.assets.filter(a => a.status === 'Deployed');
                await Promise.all(assetsToReset.map(asset => 
                    fetch(`http://127.0.0.1:5000/api/v1/assets/${asset.id}/deploy`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'Available', location: 'Base' })
                    })
                ));
            }

            // 4. Notify Admin via Chat
            const payload = {
                sender: myTeam.name, 
                target_room: `team_${currentTeamId}`, 
                message: `✅ MISSION COMPLETE: "${selectedTask.title}" has been cleared. All assets returning to base.`,
                timestamp: new Date().toISOString()
            };
            socket.emit('send_message', payload);

            toast.success("Mission Completed. Assets Returned. HQ Notified.");
            setShowTaskModal(false);
            fetchData(); 
        } catch (error) { 
            console.error("Error completing mission:", error); 
            toast.error("Failed to complete mission sequence.");
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
            case 'Active': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Cleared': return 'text-green-600 bg-green-50 border-green-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const damageOrder = ['Destroyed', 'Major', 'Minor', 'No Damage'];

    const toggleInventoryItem = (assetId) => {
        setInventorySelection(prev => 
            prev.includes(assetId) 
                ? prev.filter(id => id !== assetId) 
                : [...prev, assetId]
        );
    };

    // Select All / Deselect All
    const toggleSelectAll = () => {
        if (!myTeam?.assets) return;
        if (inventorySelection.length === myTeam.assets.length) {
            setInventorySelection([]); // Deselect all
        } else {
            setInventorySelection(myTeam.assets.map(a => a.id)); // Select all
        }
    };

    // --- NEW: ASSET CRUD (RESPONDER SIDE) ---
    const handleAddAsset = async () => {
        if (!newAsset.name) return;
        
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newAsset.name, 
                    type: newAsset.type, 
                    location: 'Base', // Default location for new gear
                    team_id: currentTeamId // <--- CRITICAL: Link to MY team
                })
            });

            if (response.ok) {
                toast.success("Asset added to Unit Inventory!");
                setShowAddAssetModal(false);
                setNewAsset({ name: '', type: 'Vehicle' });
                fetchData();
            }
        } catch (error) {
            toast.error("Failed to add asset");
        }
    };

    const handleBulkDeleteAssets = async () => {
        if (inventorySelection.length === 0) return;
        if (!window.confirm(`Are you sure you want to remove ${inventorySelection.length} assets?`)) return;

        try {
            // Loop through selected IDs and delete them one by one
            // (Ideally backend should support bulk delete, but this works for now)
            const deletePromises = inventorySelection.map(id => 
                fetch(`http://127.0.0.1:5000/api/v1/assets/${id}`, { method: 'DELETE' })
            );

            await Promise.all(deletePromises);
            
            toast.success(`${inventorySelection.length} Assets Removed`);
            setInventorySelection([]); // Clear selection
            fetchData();
        } catch (error) {
            console.error("Bulk delete error:", error);
            toast.error("Failed to delete some assets");
        }
    };

    // --- UPDATED FILTER: Only show Active/Critical tasks (Hide Pending & Cleared) ---
    const myTasks = reports.filter(r => r.status === 'Active' || r.status === 'Critical');
    const clearedReports = reports.filter(r => r.status === 'Cleared');

    const getGroupedClearedReports = () => {
        const groups = {};
        clearedReports.forEach(report => {
            const date = new Date(report.timestamp).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            if (!groups[date]) groups[date] = [];
            groups[date].push(report);
        });
        return groups;
    };
    const groupedCleared = getGroupedClearedReports();
    const sortedDates = Object.keys(groupedCleared).sort((a, b) => new Date(b) - new Date(a)); // Newest dates first

    const isRespondingToThis = (task) => {
        return myTeam?.status === 'Deployed' && myTeam?.current_report_id === task.id;
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
                    {myTeam ? myTeam.name : "Field Response Unit"}
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
                    <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Truck size={18} />} label="Inventory" />
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
                        <div><p className="text-sm font-bold text-gray-700">{myTeam ? `${myTeam.department}` : "Loading..."}</p><p className="text-xs text-gray-500">{myTeam?.name}</p></div>
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
                                <div className="space-y-6">
                                    {damageOrder.map(level => {
                                        const tasksInLevel = myTasks.filter(t => t.damage_level === level);
                                        if (tasksInLevel.length === 0) return null;

                                        return (
                                            <div key={level} className="animate-in slide-in-from-left duration-300">
                                                {/* Header */}
                                                <div className={`flex items-center gap-2 mb-3 border-b-2 pb-1 ${
                                                    level === 'Destroyed' ? 'border-red-500 text-red-700' :
                                                    level === 'Major' ? 'border-orange-500 text-orange-700' :
                                                    level === 'Minor' ? 'border-yellow-500 text-yellow-700' :
                                                    'border-gray-300 text-gray-600'
                                                }`}>
                                                    <AlertTriangle size={20} />
                                                    <h3 className="text-lg font-bold uppercase tracking-wide">{level} Priority</h3>
                                                    <span className="bg-white border px-2 rounded text-xs font-mono ml-auto text-gray-500">{tasksInLevel.length}</span>
                                                </div>

                                                {/* Grid */}
                                                <div className="grid grid-cols-1 gap-3">
                                                    {tasksInLevel.map(task => (
                                                        <div 
                                                            key={task.id}
                                                            onClick={() => openTaskModal(task)}
                                                            className={`bg-white p-5 rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md group relative overflow-hidden
                                                                ${isRespondingToThis(task) ? 'border-green-500 ring-2 ring-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-400'}
                                                            `}
                                                        >
                                                            <div className="flex justify-between items-start relative z-10">
                                                                <div className="flex items-start gap-4">
                                                                    <div className={`p-3 rounded-lg ${task.status === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                        <AlertCircle size={24} />
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                                                                            {task.title}
                                                                        </h3>
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
                                                                
                                                                <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- INVENTORY TAB (UPDATED) --- */}
                    {activeTab === 'inventory' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-bold text-gray-800">Unit Inventory</h2>
                                    {inventorySelection.length > 0 && (
                                        <button 
                                            onClick={handleBulkDeleteAssets} 
                                            className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-bold border border-red-200 flex items-center gap-1 animate-in fade-in"
                                        >
                                            <Trash2 size={12}/> Remove {inventorySelection.length} Selected
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={toggleSelectAll} 
                                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-xs font-bold"
                                    >
                                        {inventorySelection.length === myTeam?.assets.length ? <CheckSquare size={16}/> : <Square size={16}/>} 
                                        {inventorySelection.length === myTeam?.assets.length ? "Deselect All" : "Select All"}
                                    </button>
                                    <button onClick={() => setShowAddAssetModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm">
                                        <Plus size={16} /> Add Asset
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {myTeam?.assets && myTeam.assets.length > 0 ? (
                                    myTeam.assets.map(asset => {
                                        const isSelected = inventorySelection.includes(asset.id);
                                        return (
                                            <div 
                                                key={asset.id} 
                                                onClick={() => toggleInventoryItem(asset.id)}
                                                className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                                                    isSelected 
                                                    ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                                    : 'bg-white border-gray-200 hover:border-blue-300'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {/* Selection Checkbox Indicator */}
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                                                        {isSelected && <CheckSquare size={14} className="text-white" />}
                                                    </div>
                                                    
                                                    <div className="p-2 bg-gray-100 rounded-lg">{getAssetIcon(asset.type)}</div>
                                                    <div>
                                                        <p className="font-bold text-gray-800">{asset.name}</p>
                                                        <p className="text-xs text-gray-500">{asset.type}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${asset.status === 'Deployed' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{asset.status}</span>
                                            </div>
                                        );
                                    })
                                ) : <p className="text-gray-400 col-span-2 text-center">No assets assigned.</p>}
                            </div>
                        </div>
                    )}

                   {activeTab === 'chat' && (
                        <div className="max-w-4xl mx-auto h-[calc(100vh-140px)] flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                    <MessageSquare className="text-blue-600" /> Command Center Link
                                </h2>
                            </div>
                            
                            <div className="flex-1 p-6 overflow-y-auto bg-gray-50/50 space-y-4">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`flex ${msg.sender === 'Admin' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${msg.sender === 'Admin' ? 'bg-white text-gray-800 border border-gray-200 rounded-bl-none' : 'bg-blue-600 text-white rounded-br-none'}`}>
                                            
                                            {/* Message Text */}
                                            <p className="text-sm">{msg.message}</p>
                                            
                                            {/* Time Display (Correctly formatted) */}
                                            <p className={`text-[10px] mt-1 text-right ${msg.sender === 'Admin' ? 'text-gray-400' : 'text-blue-200'}`}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>

                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

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
                                    <button 
                                        onClick={handleSendMessage} 
                                        className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- TAB: INCIDENT LOG (UPDATED WITH SUB-TABS) --- */}
                    {activeTab === 'incidents' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Operational History</h2>
                                
                                {/* SUB-TAB SWITCHER */}
                                <div className="flex bg-gray-200 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setIncidentTab('active')}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${incidentTab === 'active' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Active ({myTasks.length})
                                    </button>
                                    <button 
                                        onClick={() => setIncidentTab('history')}
                                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${incidentTab === 'history' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        Cleared ({clearedReports.length})
                                    </button>
                                </div>
                            </div>

                            {/* ACTIVE REPORTS LIST */}
                            {incidentTab === 'active' && (
                                <div className="space-y-4 animate-in slide-in-from-left duration-300">
                                    {myTasks.length === 0 ? (
                                        <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-dashed">No active operations.</div>
                                    ) : (
                                        myTasks.map(report => (
                                            <div key={report.id} onClick={() => openHistoryModal(report)} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group flex justify-between items-center">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{report.title}</h3>
                                                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1"><MapPin size={12} /> {report.location}</span>
                                                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(report.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                </div>
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(report.status)}`}>{report.status}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* CLEARED HISTORY LIST (Grouped by Date) */}
                            {incidentTab === 'history' && (
                                <div className="animate-in slide-in-from-right duration-300">
                                    {sortedDates.length === 0 ? (
                                        <div className="text-center text-gray-400 py-8 bg-white rounded-xl border border-dashed">No cleared incidents yet.</div>
                                    ) : (
                                        sortedDates.map(date => (
                                            <div key={date} className="mb-6">
                                                <div className="flex items-center gap-2 mb-3 text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
                                                    <Calendar size={12}/> {date}
                                                </div>
                                                <div className="grid gap-3">
                                                    {groupedCleared[date].map(report => (
                                                        <div key={report.id} onClick={() => openHistoryModal(report)} className="bg-gray-50 p-4 rounded-xl border border-gray-200 cursor-pointer hover:bg-white hover:shadow-md hover:border-green-300 transition-all group flex justify-between items-center opacity-80 hover:opacity-100">
                                                            <div>
                                                                <h3 className="font-bold text-gray-700 group-hover:text-green-700 transition-colors">{report.title}</h3>
                                                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                                                    <span className="flex items-center gap-1"><MapPin size={12} /> {report.location}</span>
                                                                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(report.timestamp).toLocaleTimeString()}</span>
                                                                </div>
                                                            </div>
                                                            <div className="px-2 py-0.5 rounded text-[10px] font-bold border bg-green-100 text-green-700 border-green-200">CLEARED</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

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
                                <>
                                    {/* --- NEW: PERSONNEL COUNT INPUT --- */}
                                    <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <Users size={16} className="text-gray-500"/> Personnel Deploying
                                        </label>
                                        <input 
                                            type="number" 
                                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg"
                                            value={deployedPersonnel}
                                            onChange={(e) => setDeployedPersonnel(e.target.value)}
                                            placeholder="Enter count..."
                                            min="1"
                                            max={myTeam?.personnel_count || 99}
                                        />
                                        <p className="text-xs text-gray-400 mt-1 text-right">Total Available: {myTeam?.personnel_count || 0}</p>
                                    </div>

                                    <div className="mb-6">
                                        <p className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2"><Truck size={16} className="text-gray-500"/> Select Assets for Response</p>
                                        <div className="grid grid-cols-2 gap-2">{myTeam?.assets && myTeam.assets.filter(a => a.status === 'Available').length > 0 ? (myTeam.assets.filter(a => a.status === 'Available').map(asset => (<div key={asset.id} onClick={() => toggleAssetSelection(asset.id)} className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${selectedAssets.includes(asset.id) ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}><div className="flex items-center gap-2"><div className="text-gray-500">{getAssetIcon(asset.type)}</div><span className="text-sm font-medium text-gray-700">{asset.name}</span></div>{selectedAssets.includes(asset.id) && <CheckCircle size={16} className="text-blue-600" />}</div>))) : <p className="text-sm text-gray-400 italic col-span-2">No available assets at this time.</p>}</div>
                                    </div>
                                </>
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

            {/* --- ADD ASSET MODAL (NEW) --- */}
            {showAddAssetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full relative">
                        <button onClick={() => setShowAddAssetModal(false)} className="absolute top-4 right-4 text-gray-400"><XCircle size={24} /></button>
                        <h3 className="text-xl font-bold mb-4">Add New Asset</h3>
                        <div className="space-y-3">
                            <input type="text" className="w-full p-2 border rounded" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="Asset Name" />
                            <select className="w-full p-2 border rounded" value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value})}>
                                <option value="Vehicle">Vehicle</option><option value="Drone">Drone</option><option value="Medical Kit">Medical Kit</option>
                            </select>
                            <button onClick={handleAddAsset} className="w-full py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700">Save Asset</button>
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