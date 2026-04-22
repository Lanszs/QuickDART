import React, { useState, useEffect, useRef } from 'react';
import { API_BASE } from './lib/config';
import { Camera, MapPin, CheckCircle, User, LogOut, Activity,
    FileText, Clock, AlertCircle, ChevronRight, ChevronDown, XCircle, ImageIcon, Eye, EyeOff,
    MessageSquare, Send, Zap, Coffee, Truck, Radio, Package, Heart, Shield,
    AlertTriangle, Calendar, CheckSquare, Plus, Trash2, Wrench, History, Archive, Square, Users, Loader2, Plane, Video } from 'lucide-react';
import VideoAnalysisPlayer from './components/VideoAnalysisPlayer';
import DroneUpload from './DroneUpload';
import DroneLive from './DroneLive';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

// Initialize Socket
const socket = io(API_BASE);

const ResponderDashboard = ({ onLogout }) => {
    const [activeTab, setActiveTab] = useState('tasks'); 
    const [incidentTab, setIncidentTab] = useState('active');
    const [loading, setLoading] = useState(true);

    // --- USER IDENTITY STATE ---
    const [currentTeamId, setCurrentTeamId] = useState(() => {
        const stored = localStorage.getItem('user_team_id');
        return stored ? parseInt(stored) : null;
    });

    const myTeamRef = useRef(null);
    
    // Data State
    const [reports, setReports] = useState([]); 
    const [myTeam, setMyTeam] = useState(null); 
    const [time, setTime] = useState(new Date());

    // --- MODAL & SELECTION STATE ---
    const [selectedTask, setSelectedTask] = useState(null);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState([]); 
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showCompleteMissionModal, setShowCompleteMissionModal] = useState(false);
    const [deployedPersonnel, setDeployedPersonnel] = useState(0);

    const [showAddAssetModal, setShowAddAssetModal] = useState(false);
    const [newAsset, setNewAsset] = useState({ name: '', type: 'Vehicle' });
    const [inventorySelection, setInventorySelection] = useState([]);
    const [statusDropdownId, setStatusDropdownId] = useState(null);
    const [activeDeployments, setActiveDeployments] = useState([]);

    // --- HISTORY MODAL STATE ---
    const [selectedHistory, setSelectedHistory] = useState(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    // --- CHAT STATE ---
    const [chatMessage, setChatMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const chatEndRef = useRef(null);


    useEffect(() => {
        myTeamRef.current = myTeam;
    }, [myTeam]);


    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- FETCH DATA ---
    const fetchData = async () => {
        try {
            // 1. Fetch Geofenced Reports
            const repResponse = await fetch(`${API_BASE}/api/v1/reports?team_id=${currentTeamId}`);
            if (repResponse.ok) setReports(await repResponse.json());

            // 2. Fetch Team Info
            const resResponse = await fetch(`${API_BASE}/api/v1/resources`);
            if (resResponse.ok) {
                const data = await resResponse.json();
                const team = data.teams.find(t => t.id === parseInt(currentTeamId));
                setMyTeam(team);
            }

            // 3. Fetch Active Deployments
            const depResponse = await fetch(`${API_BASE}/api/v1/teams/${currentTeamId}/deployments?status=Active`);
            if (depResponse.ok) setActiveDeployments(await depResponse.json());
        } catch (error) {
            console.error("Failed to fetch data:", error);
        }
    };

   // --- MAIN DATA FETCHING & SOCKET SETUP ---
    useEffect(() => {
        if (!currentTeamId) return;

        const fetchInitialData = async () => {
            try {
                console.log("🔄 [INIT] Fetching Initial Data...");
                // 1. Reports
                const repRes = await fetch(`${API_BASE}/api/v1/reports?team_id=${currentTeamId}`);
                if (repRes.ok) {
                    const allReports = await repRes.json();
                    // Initial Filter: No Pending
                    console.log("📥 [INIT] Raw Reports Fetched:", allReports.length);
                    setReports(allReports.filter(r => r.status !== 'Pending'));
                }

                // 2. Team Info
                const resRes = await fetch(`${API_BASE}/api/v1/resources`);
                if (resRes.ok) {
                    const data = await resRes.json();
                    const team = data.teams.find(t => t.id === parseInt(currentTeamId)); 
                    console.log("👮 [INIT] My Team Data Loaded:", team);
                    setMyTeam(team);
                }

                // 3. Active Deployments
                const depRes = await fetch(`${API_BASE}/api/v1/teams/${currentTeamId}/deployments?status=Active`);
                if (depRes.ok) {
                    setActiveDeployments(await depRes.json());
                }

                // 4. Chat History
                const chatRes = await fetch(`${API_BASE}/api/v1/chat/history/team_${currentTeamId}`);
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
                fetch(`${API_BASE}/api/v1/resources`)
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
            console.log("⚡ [SOCKET] New Report Arrived:", newReport);
            if (newReport.status !== 'Pending') {
                setReports(prev => [newReport, ...prev]);
                
                // FIX: Use the REF here so we don't need 'myTeam' in dependency array
                if (isWithinRadius(newReport, myTeamRef.current)) {
                    toast.info(`New Alert: ${newReport.title}`);
                }
                else {
                    console.log("🔕 [SOCKET] Report ignored (Too far or invalid coords)");
                }
            }
        });

        // 4. Report Updates (Status Change)
        socket.on('report_updated', (updatedReport) => {
            setReports(prev => {
                const exists = prev.find(r => r.id === updatedReport.id);
                if (exists) {
                    if (updatedReport.status === 'Pending') return prev.filter(r => r.id !== updatedReport.id);
                    return prev.map(r => r.id === updatedReport.id ? updatedReport : r);
                } else if (updatedReport.status !== 'Pending') {
                    return [updatedReport, ...prev];
                }
                return prev;
            });
        });

        // 5. Report Claimed (another team claimed a report)
        socket.on('report_claimed', (data) => {
            console.log("🔒 [SOCKET] Report claimed:", data);
            setReports(prev => prev.map(r =>
                r.id === data.report_id
                    ? { ...r, claimed_by_team_id: data.claimed_by_team_id }
                    : r
            ));
            if (data.claimed_by_team_id !== parseInt(currentTeamId)) {
                toast.info(`Report claimed by ${data.team_name}`);
            }
        });

        // 6. Deployment Completed — refresh deployments and team data
        socket.on('deployment_completed', () => {
            fetch(`${API_BASE}/api/v1/teams/${currentTeamId}/deployments?status=Active`)
                .then(res => res.json())
                .then(deps => setActiveDeployments(deps));
            fetch(`${API_BASE}/api/v1/resources`)
                .then(res => res.json())
                .then(data => {
                    const team = data.teams.find(t => t.id === parseInt(currentTeamId));
                    setMyTeam(team);
                });
        });

        return () => {
            socket.off('connect', joinChatRoom);
            socket.off('resource_updated');
            socket.off('receive_message');
            socket.off('new_report');
            socket.off('report_updated');
            socket.off('report_claimed');
            socket.off('deployment_completed');
        };
    }, [currentTeamId]);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, activeTab]);

    const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371; // Earth radius in km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // 2. Logic Check (Is it close enough?)
   const isWithinRadius = (report, teamOverride = null) => {
        const team = teamOverride || myTeamRef.current; 
        
        // 🔍 DEBUG LOG 3: DATA VALIDATION
        if (!team) {
            console.warn(`⚠️ [RADIUS] Team data missing for report ${report.id}`);
            return false;
        }
        if (!team.base_latitude || !team.base_longitude) {
            console.error(`❌ [RADIUS] Team ${team.name} has NO BASE COORDINATES!`);
            return false;
        }
        if (!report.latitude || !report.longitude) {
            console.warn(`⚠️ [RADIUS] Report ${report.id} ("${report.title}") has NO COORDINATES!`);
            return false; // Safely hide or return true if you want to see everything
        }
        
        const dist = haversineDistance(
            parseFloat(team.base_latitude), 
            parseFloat(team.base_longitude), 
            parseFloat(report.latitude), 
            parseFloat(report.longitude)
        );
        
        const radius = parseFloat(team.coverage_radius_km);
        const isInside = dist <= radius;

        // 🔍 DEBUG LOG 4: CALCULATION RESULT
        // (Comment this out later if it spams too much)
        console.log(`📏 [CALC] Report #${report.id} (${report.title})`);
        console.log(`   📍 Team Base: ${team.base_latitude}, ${team.base_longitude}`);
        console.log(`   🔥 Incident: ${report.latitude}, ${report.longitude}`);
        console.log(`   📐 Distance: ${dist.toFixed(2)} km | Limit: ${radius} km`);
        console.log(`   ✅ Result: ${isInside ? "INSIDE" : "OUTSIDE"}`);

        return isInside;
    };

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
        setDeployedPersonnel(myTeam?.available_personnel || myTeam?.personnel_count || 0);
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

    // --- 1. RESPOND TO MISSION (via Deployment endpoint) ---
    const handleRespondNow = async () => {
        if (!myTeam || !selectedTask) return;

        const personnelCount = parseInt(deployedPersonnel) || 0;
        if (personnelCount <= 0) {
            toast.error("Please assign at least 1 personnel.");
            return;
        }
        if (personnelCount > (myTeam.available_personnel ?? myTeam.personnel_count)) {
            toast.error("Not enough available personnel.");
            return;
        }

        setShowConfirmModal(true);
        setShowTaskModal(false);

        try {
            const res = await fetch(`${API_BASE}/api/v1/teams/${myTeam.id}/deployments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_id: selectedTask.id,
                    personnel_count: personnelCount,
                    task: selectedTask.title,
                    asset_ids: selectedAssets
                })
            });

            if (res.status === 409) {
                const err = await res.json();
                toast.error(err.error || "This report was just claimed by another team.");
                setShowConfirmModal(false);
                return;
            }
            if (res.status === 400) {
                const err = await res.json();
                toast.error(err.error || "Insufficient personnel available.");
                setShowConfirmModal(false);
                return;
            }
            if (!res.ok) {
                toast.error("Deployment failed.");
                setShowConfirmModal(false);
                return;
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
            toast.error("Network error during deployment.");
        }
    };

    // --- 2. COMPLETE MISSION ---
    const handleCompleteMission = () => {
        if (!myTeam || !selectedTask) return;
        setShowCompleteMissionModal(true);
    };

    const confirmCompleteMission = async () => {
        setShowCompleteMissionModal(false);

        // Find the active deployment for this report
        const deployment = activeDeployments.find(d => d.report_id === selectedTask.id);
        if (!deployment) {
            toast.error("No active deployment found for this report.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/v1/deployments/${deployment.id}/complete`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!res.ok) {
                const err = await res.json();
                toast.error(err.error || "Failed to complete mission.");
                return;
            }

            // Notify Admin via Chat
            const payload = {
                sender: myTeam.name,
                target_room: `team_${currentTeamId}`,
                message: `MISSION COMPLETE: "${selectedTask.title}" has been cleared. ${deployment.personnel_count} personnel returning to base.`,
                timestamp: new Date().toISOString()
            };
            socket.emit('send_message', payload);

            toast.success("Mission Completed. Personnel & Assets Returned. HQ Notified.");
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

    // --- ASSET STATUS UPDATE ---
    const handleAssetStatusChange = async (assetId, newStatus) => {
        try {
            await fetch(`${API_BASE}/api/v1/assets/${assetId}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            fetchData();
        } catch (error) {
            console.error("Failed to update asset status:", error);
        }
        setStatusDropdownId(null);
    };

    // --- NEW: ASSET CRUD (RESPONDER SIDE) ---
    const handleAddAsset = async () => {
        if (!newAsset.name) return;
        
        try {
            const response = await fetch(`${API_BASE}/api/v1/assets`, {
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
                fetch(`${API_BASE}/api/v1/assets/${id}`, { method: 'DELETE' })
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
    const myTasks = reports.filter(r => 
        (r.status === 'Active' || r.status === 'Critical') && 
        isWithinRadius(r, myTeam)
    );

    

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
        return activeDeployments.some(d => d.report_id === task.id);
    };

    const isClaimedByOther = (task) => {
        return task.claimed_by_team_id && task.claimed_by_team_id !== parseInt(currentTeamId);
    };

    const isAssignedToMe = (task) => {
        return task.claimed_by_team_id && task.claimed_by_team_id === parseInt(currentTeamId) && !isRespondingToThis(task);
    };

    const availablePersonnel = myTeam?.available_personnel ?? myTeam?.personnel_count ?? 0;
    const totalPersonnel = myTeam?.personnel_count ?? 0;
    const isFullyDeployed = availablePersonnel <= 0 && activeDeployments.length > 0;
    const hasActiveDeployments = activeDeployments.length > 0;

    const updateMyStatus = async (newStatus) => {
        if (!myTeam) return;
        try {
            await fetch(`${API_BASE}/api/v1/teams/${myTeam.id}/deploy`, {
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
                        <span className="text-xs text-gray-400 uppercase font-bold">Personnel</span>
                        <span className={`font-bold text-sm ${isFullyDeployed ? 'text-red-400' : 'text-green-400'}`}>
                            {availablePersonnel}/{totalPersonnel} Available
                        </span>
                    </div>
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
                    <NavButton active={activeTab === 'drone'} onClick={() => setActiveTab('drone')} icon={<Plane size={18} />} label="Drone Upload" />
                    <NavButton active={activeTab === 'drone-live'} onClick={() => setActiveTab('drone-live')} icon={<Video size={18} />} label="Live Drone" />
                    <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={18} />} label="Command Chat" />
                    <NavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Truck size={18} />} label="Inventory" />
                    <NavButton active={activeTab === 'incidents'} onClick={() => setActiveTab('incidents')} icon={<FileText size={18} />} label="Incident Log" />
                    
                    <div className="flex-grow"></div>
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 mb-4">
                        <p className="text-xs font-bold text-gray-500 mb-2 uppercase">Update Availability</p>
                        <div className="flex gap-2">
                            <button onClick={() => updateMyStatus('Idle')} disabled={hasActiveDeployments} className={`flex-1 py-2 text-xs font-bold rounded flex flex-col items-center justify-center gap-1 transition-all ${myTeam?.status === 'Idle' || hasActiveDeployments ? 'bg-green-100 text-green-700 border border-green-300 shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'}`}><Zap size={14} /> Active</button>
                            <button onClick={() => updateMyStatus('Resting')} disabled={hasActiveDeployments} className={`flex-1 py-2 text-xs font-bold rounded flex flex-col items-center justify-center gap-1 transition-all ${myTeam?.status === 'Resting' ? 'bg-yellow-100 text-yellow-700 border border-yellow-300 shadow-sm' : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-100'}`}><Coffee size={14} /> Resting</button>
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
                    {activeTab === 'tasks' && (() => {
                        const respondingTasks = myTasks.filter(t => isRespondingToThis(t));
                        const assignedToMe = myTasks.filter(t => isAssignedToMe(t));
                        const availableTasks = myTasks.filter(t => !isRespondingToThis(t) && !isClaimedByOther(t) && !isAssignedToMe(t));
                        const claimedByOthers = myTasks.filter(t => isClaimedByOther(t));

                        const renderTaskCards = (tasks, options = {}) => {
                            const { forceDisabled = false, showClaimedBadge = false, showAssignedBadge = false } = options;
                            return damageOrder.map(level => {
                                const tasksInLevel = tasks.filter(t => t.damage_level === level);
                                if (tasksInLevel.length === 0) return null;
                                return (
                                    <div key={level}>
                                        <div className={`flex items-center gap-2 mb-2 border-b pb-1 ${
                                            level === 'Destroyed' ? 'border-red-300 text-red-600' :
                                            level === 'Major' ? 'border-orange-300 text-orange-600' :
                                            level === 'Minor' ? 'border-yellow-300 text-yellow-600' :
                                            'border-gray-200 text-gray-500'
                                        }`}>
                                            <AlertTriangle size={16} />
                                            <span className="text-sm font-bold uppercase tracking-wide">{level}</span>
                                            <span className="bg-white border px-1.5 rounded text-[10px] font-mono ml-auto text-gray-400">{tasksInLevel.length}</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 mb-4">
                                            {tasksInLevel.map(task => {
                                                const responding = isRespondingToThis(task);
                                                const disabled = forceDisabled || (isFullyDeployed && !responding);
                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => !disabled && openTaskModal(task)}
                                                        className={`p-5 rounded-xl shadow-sm border transition-all relative overflow-hidden
                                                            ${responding ? 'border-green-500 ring-2 ring-green-500 bg-green-50 cursor-pointer' :
                                                              disabled ? 'border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed' :
                                                              'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md cursor-pointer group'}
                                                        `}
                                                    >
                                                        <div className="flex justify-between items-start relative z-10">
                                                            <div className="flex items-start gap-4">
                                                                <div className={`p-3 rounded-lg ${task.status === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                    <AlertCircle size={24} />
                                                                </div>
                                                                <div>
                                                                    <h3 className={`font-bold text-lg transition-colors ${disabled ? 'text-gray-400' : 'text-gray-800 group-hover:text-blue-600'}`}>
                                                                        {task.title}
                                                                    </h3>
                                                                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                                                                        <span className="flex items-center gap-1"><MapPin size={14}/> {task.location}</span>
                                                                        <span className="flex items-center gap-1"><Clock size={14}/> {new Date(task.timestamp).toLocaleTimeString()}</span>
                                                                    </p>
                                                                    {responding && (
                                                                        <div className="mt-2 flex items-center gap-2 text-green-700 font-bold text-xs bg-green-100 px-2 py-1 rounded w-fit animate-pulse">
                                                                            <Activity size={12} /> CURRENTLY RESPONDING
                                                                        </div>
                                                                    )}
                                                                    {showClaimedBadge && (
                                                                        <div className="mt-2 flex items-center gap-2 text-gray-500 font-bold text-xs bg-gray-200 px-2 py-1 rounded w-fit">
                                                                            <Shield size={12} /> CLAIMED BY ANOTHER TEAM
                                                                        </div>
                                                                    )}
                                                                    {showAssignedBadge && (
                                                                        <div className="mt-2 flex items-center gap-2 text-amber-700 font-bold text-xs bg-amber-100 px-2 py-1 rounded w-fit">
                                                                            <Zap size={12} fill="currentColor" /> ASSIGNED BY ADMIN — PRIORITY
                                                                        </div>
                                                                    )}
                                                                    {isFullyDeployed && !responding && !forceDisabled && (
                                                                        <div className="mt-2 flex items-center gap-2 text-orange-600 font-bold text-xs bg-orange-100 px-2 py-1 rounded w-fit">
                                                                            <Users size={12} /> ALL PERSONNEL DEPLOYED
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <ChevronRight className={disabled ? 'text-gray-300' : 'text-gray-300 group-hover:text-blue-500'} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            });
                        };

                        return (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">Responder Tasks</h2>
                                <div className="flex gap-2">
                                    {respondingTasks.length > 0 && <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">{respondingTasks.length} Responding</span>}
                                    {assignedToMe.length > 0 && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">{assignedToMe.length} Assigned</span>}
                                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">{availableTasks.length} Available</span>
                                    {claimedByOthers.length > 0 && <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">{claimedByOthers.length} Claimed</span>}
                                </div>
                            </div>

                            {myTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-gray-300 text-gray-400">
                                    <CheckCircle size={48} className="mb-4 text-green-500 opacity-50" />
                                    <p className="text-lg font-semibold text-gray-500">No Active Tasks</p>
                                    <p className="text-sm">Area is clear or waiting for admin validation.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Section 1: Currently Responding */}
                                    {respondingTasks.length > 0 && (
                                        <div className="animate-in slide-in-from-left duration-300">
                                            <div className="flex items-center gap-2 mb-4 text-green-700">
                                                <Activity size={22} />
                                                <h3 className="text-xl font-bold">Currently Responding</h3>
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{respondingTasks.length}</span>
                                            </div>
                                            {renderTaskCards(respondingTasks)}
                                        </div>
                                    )}

                                    {/* Section 2: Assigned to You — Priority */}
                                    {assignedToMe.length > 0 && (
                                        <div className="animate-in slide-in-from-left duration-300">
                                            <div className="flex items-center gap-2 mb-4 text-amber-700">
                                                <Zap size={22} fill="currentColor" />
                                                <h3 className="text-xl font-bold">Assigned to You — Priority</h3>
                                                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{assignedToMe.length}</span>
                                            </div>
                                            <div className="border-l-4 border-amber-400 pl-4">
                                                <p className="text-sm text-amber-600 mb-3 font-medium">Admin has assigned these reports to your team. Respond to these first.</p>
                                                {renderTaskCards(assignedToMe, { showAssignedBadge: true })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 3: Available for Response */}
                                    {availableTasks.length > 0 && (
                                        <div className="animate-in slide-in-from-left duration-300">
                                            <div className="flex items-center gap-2 mb-4 text-blue-700">
                                                <AlertCircle size={22} />
                                                <h3 className="text-xl font-bold">Available for Response</h3>
                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{availableTasks.length}</span>
                                            </div>
                                            {renderTaskCards(availableTasks)}
                                        </div>
                                    )}

                                    {/* Section 4: Claimed by Other Teams (collapsible) */}
                                    {claimedByOthers.length > 0 && (
                                        <ClaimedSection tasks={claimedByOthers} renderTaskCards={renderTaskCards} />
                                    )}
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {/* --- DRONE UPLOAD TAB --- */}
                    {activeTab === 'drone' && (
                        <DroneUpload
                            myTeam={myTeam}
                            currentTeamId={currentTeamId}
                            onReportSaved={fetchData}
                        />
                    )}

                    {/* --- LIVE DRONE TAB --- */}
                    {activeTab === 'drone-live' && (
                        <DroneLive
                            myTeam={myTeam}
                            currentTeamId={currentTeamId}
                            onReportSaved={fetchData}
                        />
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
                                        const isDropdownOpen = statusDropdownId === asset.id;
                                        const statusColors = {
                                            'Available': 'bg-green-100 text-green-700',
                                            'Deployed': 'bg-red-100 text-red-700',
                                            'Maintenance': 'bg-orange-100 text-orange-700',
                                        };
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
                                                <div className="relative">
                                                    {asset.status === 'Deployed' ? (
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${statusColors['Deployed']}`}>Deployed</span>
                                                    ) : (
                                                        <>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setStatusDropdownId(isDropdownOpen ? null : asset.id); }}
                                                                className={`px-2 py-1 rounded text-xs font-bold ${statusColors[asset.status] || 'bg-gray-100 text-gray-700'}`}
                                                            >
                                                                {asset.status === 'Maintenance' ? 'Under Maintenance' : asset.status}
                                                            </button>
                                                            {isDropdownOpen && (
                                                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden min-w-[160px]">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleAssetStatusChange(asset.id, 'Available'); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-green-50 flex items-center gap-2"
                                                                    >
                                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span> Available
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleAssetStatusChange(asset.id, 'Maintenance'); }}
                                                                        className="w-full text-left px-3 py-2 text-xs font-medium hover:bg-orange-50 flex items-center gap-2"
                                                                    >
                                                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span> Under Maintenance
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
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
                            <div className="mb-6 w-full h-48 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
    {selectedTask.image_url ? (
        /\.(mp4|avi|mov|mkv|webm|flv)/i.test(selectedTask.image_url) ? (
            selectedTask.analysis_metadata?.per_frame_predictions ? (
                <VideoAnalysisPlayer
                    videoUrl={selectedTask.image_url}
                    frameAnalyses={selectedTask.analysis_metadata.per_frame_predictions}
                    videoDuration={selectedTask.analysis_metadata.video_duration || 0}
                    totalFrames={selectedTask.analysis_metadata.total_analyzed_frames || selectedTask.analysis_metadata.per_frame_predictions.length}
                />
            ) : (
                <video src={selectedTask.image_url} controls className="w-full h-full object-cover">
                    Your browser does not support video playback.
                </video>
            )
        ) : (
            <img src={selectedTask.image_url} alt="Incident" className="w-full h-full object-cover" />
        )
    ) : <ImageIcon size={48} className="text-gray-400 opacity-50" />}
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

                            {!isRespondingToThis(selectedTask) && !isClaimedByOther(selectedTask) && (
                                <>
                                    {/* --- PERSONNEL COUNT INPUT --- */}
                                    <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <Users size={16} className="text-gray-500"/> Personnel Deploying
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                className="w-24 p-2 border border-gray-300 rounded-lg text-center text-lg font-bold text-blue-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={deployedPersonnel}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    setDeployedPersonnel(Math.max(1, Math.min(val, availablePersonnel || 1)));
                                                }}
                                                min="1"
                                                max={availablePersonnel || 1}
                                            />
                                            <span className="text-sm text-gray-500">out of <strong className="text-gray-700">{availablePersonnel}</strong> available ({totalPersonnel} total)</span>
                                        </div>
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
                            ) : isClaimedByOther(selectedTask) ? (
                                <span className="px-6 py-2 bg-gray-300 text-gray-500 font-bold rounded-lg flex items-center gap-2"><Shield size={18} /> Claimed by Another Team</span>
                            ) : isFullyDeployed ? (
                                <span className="px-6 py-2 bg-orange-100 text-orange-600 font-bold rounded-lg flex items-center gap-2"><Users size={18} /> All Personnel Deployed</span>
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
                            <div className="mb-6 w-full h-48 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
    {selectedHistory.image_url ? (
        /\.(mp4|avi|mov|mkv|webm|flv)/i.test(selectedHistory.image_url) ? (
            selectedHistory.analysis_metadata?.per_frame_predictions ? (
                <VideoAnalysisPlayer
                    videoUrl={selectedHistory.image_url}
                    frameAnalyses={selectedHistory.analysis_metadata.per_frame_predictions}
                    videoDuration={selectedHistory.analysis_metadata.video_duration || 0}
                    totalFrames={selectedHistory.analysis_metadata.total_analyzed_frames || selectedHistory.analysis_metadata.per_frame_predictions.length}
                />
            ) : (
                <video src={selectedHistory.image_url} controls className="w-full h-full object-cover">
                    Your browser does not support video playback.
                </video>
            )
        ) : (
            <img src={selectedHistory.image_url} alt="Incident" className="w-full h-full object-cover" />
        )
    ) : <ImageIcon size={48} className="text-gray-400 opacity-50" />}
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

            {/* --- DEPLOYMENT CONFIRMATION MODAL --- */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-sm w-full transform scale-110">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce"><Activity size={40} className="text-green-600" /></div>
                        <h2 className="text-2xl font-bold text-gray-900">Responding Now!</h2>
                        <p className="text-gray-500 mt-2">HQ has been notified. Status set to Deployed.</p>
                    </div>
                </div>
            )}

            {/* --- COMPLETE MISSION CONFIRMATION MODAL --- */}
            {showCompleteMissionModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-sm w-full">
                        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckSquare size={40} className="text-amber-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Complete Mission?</h2>
                        <p className="text-gray-500 mt-2">This will clear the incident, return assets to base, and notify HQ.</p>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCompleteMissionModal(false)}
                                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmCompleteMission}
                                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-colors"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ClaimedSection = ({ tasks, renderTaskCards }) => {
    const [expanded, setExpanded] = React.useState(false);
    return (
        <div className="animate-in slide-in-from-left duration-300">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 mb-4 text-gray-500 hover:text-gray-700 transition-colors w-full"
            >
                {expanded ? <ChevronDown size={22} /> : <ChevronRight size={22} />}
                <h3 className="text-xl font-bold">Claimed by Other Teams</h3>
                <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs font-bold ml-2">{tasks.length}</span>
                <span className="text-xs text-gray-400 ml-auto">{expanded ? 'Hide' : 'Show'}</span>
            </button>
            {expanded && renderTaskCards(tasks, { forceDisabled: true, showClaimedBadge: true })}
        </div>
    );
};

const NavButton = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full text-left ${active ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
        {icon} {label}
    </button>
);

export default ResponderDashboard;