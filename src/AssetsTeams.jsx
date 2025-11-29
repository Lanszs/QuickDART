import React, { useEffect, useState } from 'react';
import { Truck, Users, Wrench, CheckCircle, Clock, Activity, RefreshCw, Radio, Droplet, Flame, Mountain, Heart, Package, Phone, Shield, Dog, Send, Navigation, XCircle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

const AssetsTeams = () => {
    const [data, setData] = useState({ assets: [], teams: [] });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    
    // --- MODAL STATES ---
    const [showNotifyModal, setShowNotifyModal] = useState(false);
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showAddTeamModal, setShowAddTeamModal] = useState(false);
    const [showAddAssetModal, setShowAddAssetModal] = useState(false);

    // --- FORM DATA STATES ---
    const [selectedItem, setSelectedItem] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [deployStatus, setDeployStatus] = useState('');
    const [deployLocation, setDeployLocation] = useState('');
    const [deployTask, setDeployTask] = useState('');

    const [newTeam, setNewTeam] = useState({ name: '', specialization: 'General', personnel_count: 5 });
    const [newAsset, setNewAsset] = useState({ name: '', type: 'Vehicle', location: 'Base' });

    const fetchData = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/resources');
            if (response.ok) {
                const result = await response.json();
                setData(result);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Error fetching resources:", error);
            toast.error("Failed to load resources");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);

        const socket = io('http://127.0.0.1:5000');
        
        socket.on('resource_updated', (update) => {
            fetchData(); 
            // Only toast if it's a status change, not a create/delete (to avoid spam)
            if (update.action === 'status_changed') {
                toast.info(`${update.type === 'team' ? 'Team' : 'Asset'} updated!`);
            }
        });

        socket.on('team_notification', (notification) => {
            toast.success(`📢 ${notification.team_name}: ${notification.message}`);
        });

        socket.on('asset_notification', (notification) => {
            toast.info(`🔔 ${notification.asset_name}: ${notification.message}`);
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    // --- CRUD OPERATIONS ---

    const handleAddTeam = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTeam)
            });
            if (response.ok) {
                toast.success("Team added successfully!");
                setShowAddTeamModal(false);
                setNewTeam({ name: '', specialization: 'General', personnel_count: 5 });
                fetchData();
            } else {
                toast.error("Failed to add team");
            }
        } catch (error) {
            toast.error("Error adding team");
        }
    };

    const handleDeleteTeam = async (id) => {
        if (!window.confirm("Are you sure you want to delete this team?")) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/teams/${id}`, { method: 'DELETE' });
            if (response.ok) {
                toast.success("Team deleted");
                fetchData();
            }
        } catch (error) {
            toast.error("Error deleting team");
        }
    };

    const handleAddAsset = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAsset)
            });
            if (response.ok) {
                toast.success("Asset added successfully!");
                setShowAddAssetModal(false);
                setNewAsset({ name: '', type: 'Vehicle', location: 'Base' });
                fetchData();
            } else {
                toast.error("Failed to add asset");
            }
        } catch (error) {
            toast.error("Error adding asset");
        }
    };

    const handleDeleteAsset = async (id) => {
        if (!window.confirm("Are you sure you want to delete this asset?")) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/assets/${id}`, { method: 'DELETE' });
            if (response.ok) {
                toast.success("Asset deleted");
                fetchData();
            }
        } catch (error) {
            toast.error("Error deleting asset");
        }
    };

    // --- EXISTING DEPLOY LOGIC ---
    const handleDeployTeam = async (teamId, newStatus, task) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/teams/${teamId}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, task: task })
            });
            if (response.ok) {
                toast.success(`Team status updated to ${newStatus}`);
                setShowDeployModal(false);
                fetchData();
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        }
    };

    const handleDeployAsset = async (assetId, newStatus, location) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/assets/${assetId}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, location })
            });
            if (response.ok) {
                toast.success(`Asset status updated to ${newStatus}`);
                setShowDeployModal(false);
                fetchData();
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        }
    };

    const handleSendNotification = async () => {
        if (!notifyMessage.trim()) return;
        const endpoint = selectedItem.type === 'team' 
            ? `/api/v1/teams/${selectedItem.id}/notify`
            : `/api/v1/assets/${selectedItem.id}/notify`;

        try {
            await fetch(`http://127.0.0.1:5000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: notifyMessage })
            });
            toast.success('Notification sent!');
            setShowNotifyModal(false);
            setNotifyMessage('');
        } catch (error) {
            toast.error("Failed to send notification");
        }
    };

    // --- Helpers ---
    const openNotifyModal = (item, type) => {
        setSelectedItem({ ...item, type });
        setShowNotifyModal(true);
        setNotifyMessage('');
    };

    const openDeployModal = (item, type) => {
        setSelectedItem({ ...item, type });
        setDeployStatus(item.status);
        setDeployLocation(item.location || '');
        setDeployTask('');
        setShowDeployModal(true);
    };

    const groupAssetsByType = () => {
        const grouped = {};
        data.assets.forEach(asset => {
            if (!grouped[asset.type]) grouped[asset.type] = [];
            grouped[asset.type].push(asset);
        });
        return grouped;
    };

    const groupedAssets = groupAssetsByType();

    const getTeamIcon = (specialization) => {
        if (specialization.includes('Flood')) return <Droplet className="text-blue-600" size={20} />;
        if (specialization.includes('Fire')) return <Flame className="text-red-600" size={20} />;
        if (specialization.includes('Earthquake')) return <Mountain className="text-orange-600" size={20} />;
        if (specialization.includes('Medical')) return <Heart className="text-pink-600" size={20} />;
        return <Users className="text-gray-600" size={20} />;
    };

    const getAssetIcon = (type) => {
        if (type === 'Drone') return <Radio className="text-purple-600" size={20} />;
        if (type === 'Vehicle') return <Truck className="text-blue-600" size={20} />;
        if (type === 'Medical Kit') return <Heart className="text-red-600" size={20} />;
        return <Package className="text-gray-600" size={20} />;
    };

    if (loading) return <div className="p-6 text-center">Loading resources...</div>;

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            {/* Header & Add Buttons */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Operational Resources</h2>
                    <p className="text-sm text-gray-500 mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddTeamModal(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                        <Plus size={16} /> Add Team
                    </button>
                    <button onClick={() => setShowAddAssetModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm transition-colors">
                        <Plus size={16} /> Add Asset
                    </button>
                    <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {/* Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <SummaryCard title="Active Teams" value={data.teams.filter(t => t.status === 'Deployed').length} total={data.teams.length} icon={<Users className="text-blue-600" size={24} />} color="bg-blue-100" />
                <SummaryCard title="Available Assets" value={data.assets.filter(a => a.status === 'Available').length} total={data.assets.length} icon={<CheckCircle className="text-green-600" size={24} />} color="bg-green-100" />
                <SummaryCard title="Deployed Assets" value={data.assets.filter(a => a.status === 'Deployed').length} total={data.assets.length} icon={<Activity className="text-orange-600" size={24} />} color="bg-orange-100" />
                <SummaryCard title="Under Maintenance" value={data.assets.filter(a => a.status === 'Maintenance').length} total={data.assets.length} icon={<Wrench className="text-red-600" size={24} />} color="bg-red-100" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* TEAMS LIST */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Users className="text-blue-600" /> Specialized Response Teams
                    </h3>
                    <div className="space-y-3">
                        {data.teams.map((team) => (
                            <div key={team.id} className="group relative hover:shadow-md transition-shadow">
                                <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100">
                                    <button 
                                        onClick={() => handleDeleteTeam(team.id)}
                                        className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-200">{getTeamIcon(team.specialization)}</div>
                                            <div>
                                                <div className="font-bold text-gray-800 flex items-center gap-2">
                                                    {team.name}
                                                    {team.status === 'Deployed' && <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>}
                                                </div>
                                                <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                    <span className="font-medium text-blue-600">{team.specialization}</span>
                                                    <span>•</span>
                                                    <span>{team.personnel_count} Personnel</span>
                                                </div>
                                            </div>
                                        </div>
                                        <StatusBadge status={team.status} />
                                    </div>
                                    
                                    {team.status === 'Deployed' && team.current_task && (
                                        <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800 font-medium">
                                            <span className="font-bold">Mission:</span> {team.current_task}
                                        </div>
                                    )}

                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openDeployModal(team, 'team')} className="flex-1 py-1.5 px-3 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 flex items-center justify-center gap-1"><Navigation size={12} /> Deploy/Recall</button>
                                        <button onClick={() => openNotifyModal(team, 'team')} className="flex-1 py-1.5 px-3 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 flex items-center justify-center gap-1"><Send size={12} /> Notify</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ASSETS LIST */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Truck className="text-orange-600" /> Equipment & Assets Fleet
                    </h3>
                    <div className="space-y-4">
                        {Object.keys(groupedAssets).map((type) => (
                            <div key={type} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                <div className="flex items-center gap-2 mb-2">
                                    {getAssetIcon(type)}
                                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{type} <span className="ml-2 text-xs font-normal text-gray-400">({groupedAssets[type].length})</span></h4>
                                </div>
                                <div className="space-y-2 ml-7">
                                    {groupedAssets[type].map((asset) => (
                                        <div key={asset.id} className="group relative hover:bg-gray-50 transition-colors rounded-lg p-2">
                                            <button 
                                                onClick={() => handleDeleteAsset(asset.id)}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">{asset.name}</div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>{asset.location}</div>
                                                </div>
                                                <StatusBadge status={asset.status} compact />
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openDeployModal(asset, 'asset')} className="flex-1 py-1 px-2 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 flex items-center justify-center gap-1"><Navigation size={10} /> Deploy</button>
                                                <button onClick={() => openNotifyModal(asset, 'asset')} className="flex-1 py-1 px-2 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 flex items-center justify-center gap-1"><Send size={10} /> Notify</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* --- ADD TEAM MODAL --- */}
            {showAddTeamModal && (
                <Modal onClose={() => setShowAddTeamModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Add New Team</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Team Name</label>
                            <input type="text" className="w-full p-2 border rounded" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} placeholder="e.g. Bravo Squad" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Specialization</label>
                            <select className="w-full p-2 border rounded" value={newTeam.specialization} onChange={e => setNewTeam({...newTeam, specialization: e.target.value})}>
                                <option value="Flood Responder">Flood Responder</option>
                                <option value="Fire Responder">Fire Responder</option>
                                <option value="Earthquake Responder">Earthquake Responder</option>
                                <option value="Medical">Medical</option>
                                <option value="Support">Support</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Personnel Count</label>
                            <input type="number" className="w-full p-2 border rounded" value={newTeam.personnel_count} onChange={e => setNewTeam({...newTeam, personnel_count: e.target.value})} />
                        </div>
                        <button onClick={handleAddTeam} className="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700">Add Team</button>
                    </div>
                </Modal>
            )}

            {/* --- ADD ASSET MODAL --- */}
            {showAddAssetModal && (
                <Modal onClose={() => setShowAddAssetModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Add New Asset</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Asset Name</label>
                            <input type="text" className="w-full p-2 border rounded" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="e.g. Rescue Truck 05" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                            <select className="w-full p-2 border rounded" value={newAsset.type} onChange={e => setNewAsset({...newAsset, type: e.target.value})}>
                                <option value="Vehicle">Vehicle</option>
                                <option value="Drone">Drone</option>
                                <option value="Medical Kit">Medical Kit</option>
                                <option value="Communication">Communication</option>
                                <option value="Rescue Equipment">Rescue Equipment</option>
                                <option value="K-9 Unit">K-9 Unit</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Current Location</label>
                            <input type="text" className="w-full p-2 border rounded" value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} />
                        </div>
                        <button onClick={handleAddAsset} className="w-full py-2 bg-orange-600 text-white font-bold rounded hover:bg-orange-700">Add Asset</button>
                    </div>
                </Modal>
            )}

            {/* Existing Modals (Notify / Deploy) */}
            {showNotifyModal && (
                <Modal onClose={() => setShowNotifyModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Send Notification</h3>
                    <p className="text-gray-600 mb-4">Notify: <span className="font-bold">{selectedItem?.name}</span></p>
                    <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Enter message..." className="w-full p-3 border rounded mb-4" rows="4" />
                    <button onClick={handleSendNotification} className="w-full py-2 bg-green-600 text-white font-bold rounded hover:bg-green-700">Send</button>
                </Modal>
            )}

            {showDeployModal && (
                <Modal onClose={() => setShowDeployModal(false)}>
                    <h3 className="text-xl font-bold mb-4">{selectedItem?.type === 'team' ? 'Deploy/Recall Team' : 'Deploy/Recall Asset'}</h3>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                    <select value={deployStatus} onChange={(e) => setDeployStatus(e.target.value)} className="w-full p-3 border rounded mb-4">
                        {selectedItem?.type === 'team' ? (
                            <><option value="Deployed">Deployed</option><option value="Idle">Idle</option><option value="Resting">Resting</option></>
                        ) : (
                            <><option value="Available">Available</option><option value="Deployed">Deployed</option><option value="Maintenance">Maintenance</option></>
                        )}
                    </select>
                    {selectedItem?.type === 'team' && deployStatus === 'Deployed' && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Mission Orders</label>
                            <textarea value={deployTask} onChange={(e) => setDeployTask(e.target.value)} className="w-full p-3 border rounded" rows="3" />
                        </div>
                    )}
                    {selectedItem?.type === 'asset' && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
                            <input type="text" value={deployLocation} onChange={(e) => setDeployLocation(e.target.value)} className="w-full p-3 border rounded" />
                        </div>
                    )}
                    <button onClick={() => selectedItem.type === 'team' ? handleDeployTeam(selectedItem.id, deployStatus, deployTask) : handleDeployAsset(selectedItem.id, deployStatus, deployLocation)} className="w-full py-2 bg-blue-600 text-white font-bold rounded">Confirm</button>
                </Modal>
            )}
        </div>
    );
};

const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in duration-200 relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
            {children}
        </div>
    </div>
);

const SummaryCard = ({ title, value, total, icon, color }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
            <div><p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p><p className="text-2xl font-extrabold text-gray-800 mt-1">{value} <span className="text-sm text-gray-400 font-normal ml-1">/ {total}</span></p></div>
            <div className={`p-3 rounded-lg ${color}`}>{icon}</div>
        </div>
    </div>
);

const StatusBadge = ({ status, compact = false }) => {
    let color = "bg-gray-100 text-gray-600 border-gray-200";
    let icon = <Clock size={compact ? 10 : 12} />;
    if (status === 'Available' || status === 'Idle') { color = "bg-green-100 text-green-700 border-green-200"; icon = <CheckCircle size={compact ? 10 : 12} />; }
    else if (status === 'Deployed') { color = "bg-blue-100 text-blue-700 border-blue-200"; icon = <Activity size={compact ? 10 : 12} />; }
    else if (status === 'Maintenance' || status === 'Resting') { color = "bg-orange-100 text-orange-700 border-orange-200"; icon = <Wrench size={compact ? 10 : 12} />; }
    return <span className={`px-2 py-1 rounded-full ${compact ? 'text-[10px]' : 'text-xs'} font-bold flex items-center gap-1 border ${color}`}>{icon} {status}</span>;
};

export default AssetsTeams;