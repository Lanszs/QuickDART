import React, { useEffect, useState } from 'react';
import { Truck, Users, Wrench, CheckCircle, Clock, Activity, RefreshCw, Radio, Droplet, Flame, Mountain, Heart, Package, Phone, Shield, Dog, Send, Navigation, XCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { io } from 'socket.io-client';

const AssetsTeams = () => {
    const [data, setData] = useState({ assets: [], teams: [] });
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [showNotifyModal, setShowNotifyModal] = useState(false);
    const [showDeployModal, setShowDeployModal] = useState(false);
    
    // --- Selection State ---
    const [selectedItem, setSelectedItem] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [deployStatus, setDeployStatus] = useState('');
    const [deployLocation, setDeployLocation] = useState('');
    const [deployTask, setDeployTask] = useState(''); // <--- NEW STATE FOR TASK MESSAGE

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

        // WebSocket for real-time updates
        const socket = io('http://127.0.0.1:5000');
        
        socket.on('resource_updated', (update) => {
            console.log('Resource updated:', update);
            fetchData(); // Refresh data
            toast.info(`${update.type === 'team' ? 'Team' : 'Asset'} status updated!`);
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

    // --- UPDATED DEPLOY TEAM FUNCTION ---
    const handleDeployTeam = async (teamId, newStatus, task) => {
        console.log('🔧 Deploy Team:', { teamId, newStatus, task });
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/teams/${teamId}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    status: newStatus,
                    task: task // <--- Sending the task to the backend
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Team status updated to ${newStatus}`);
                fetchData();
                setShowDeployModal(false);
            } else {
                toast.error(`Failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ Deploy Team Error:', error);
            toast.error(`Error: ${error.message}`);
        }
    };

    // Deploy Asset (Unchanged)
    const handleDeployAsset = async (assetId, newStatus, location) => {
        console.log('🔧 Deploy Asset:', { assetId, newStatus, location });
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/assets/${assetId}/deploy`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, location })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`Asset status updated to ${newStatus}`);
                fetchData();
                setShowDeployModal(false);
            } else {
                toast.error(`Failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ Deploy Asset Error:', error);
            toast.error(`Error: ${error.message}`);
        }
    };

    // Send Notification
    const handleSendNotification = async () => {
        if (!notifyMessage.trim()) {
            toast.warning('Please enter a message');
            return;
        }

        const endpoint = selectedItem.type === 'team' 
            ? `/api/v1/teams/${selectedItem.id}/notify`
            : `/api/v1/assets/${selectedItem.id}/notify`;

        try {
            const response = await fetch(`http://127.0.0.1:5000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: notifyMessage })
            });

            if (response.ok) {
                toast.success('Notification sent successfully!');
                setShowNotifyModal(false);
                setNotifyMessage('');
            } else {
                const data = await response.json();
                toast.error(`Failed: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ Notify Error:', error);
            toast.error(`Error: ${error.message}`);
        }
    };

    const openNotifyModal = (item, type) => {
        setSelectedItem({ ...item, type });
        setShowNotifyModal(true);
        setNotifyMessage('');
    };

    const openDeployModal = (item, type) => {
        setSelectedItem({ ...item, type });
        setDeployStatus(item.status);
        setDeployLocation(item.location || '');
        setDeployTask(''); // <--- Reset the task field
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
        if (type === 'Communication') return <Phone className="text-green-600" size={20} />;
        if (type === 'Rescue Equipment') return <Shield className="text-orange-600" size={20} />;
        if (type === 'K-9 Unit') return <Dog className="text-amber-600" size={20} />;
        return <Package className="text-gray-600" size={20} />;
    };

    if (loading) {
        return (
            <div className="p-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-gray-500 mt-4">Loading operational resources...</p>
            </div>
        );
    }

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Operational Resources</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                <button 
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <SummaryCard 
                    title="Active Teams"
                    value={data.teams.filter(t => t.status === 'Deployed').length}
                    total={data.teams.length}
                    icon={<Users className="text-blue-600" size={24} />}
                    color="bg-blue-100"
                />
                <SummaryCard 
                    title="Available Assets"
                    value={data.assets.filter(a => a.status === 'Available').length}
                    total={data.assets.length}
                    icon={<CheckCircle className="text-green-600" size={24} />}
                    color="bg-green-100"
                />
                <SummaryCard 
                    title="Deployed Assets"
                    value={data.assets.filter(a => a.status === 'Deployed').length}
                    total={data.assets.length}
                    icon={<Activity className="text-orange-600" size={24} />}
                    color="bg-orange-100"
                />
                <SummaryCard 
                    title="Under Maintenance"
                    value={data.assets.filter(a => a.status === 'Maintenance').length}
                    total={data.assets.length}
                    icon={<Wrench className="text-red-600" size={24} />}
                    color="bg-red-100"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Users className="text-blue-600" /> Specialized Response Teams
                    </h3>
                    <div className="space-y-3">
                        {data.teams.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">No teams available</p>
                        ) : (
                            data.teams.map((team) => (
                                <div key={team.id} className="group hover:shadow-md transition-shadow">
                                    <div className="p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border border-gray-100">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-200">
                                                    {getTeamIcon(team.specialization)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                                        {team.name}
                                                        {team.status === 'Deployed' && (
                                                            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                                                        <span className="font-medium text-blue-600">{team.specialization}</span>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Users size={12} />
                                                            {team.personnel_count} Personnel
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <StatusBadge status={team.status} />
                                        </div>
                                        
                                        {/* Display Task if Deployed */}
                                        {team.status === 'Deployed' && team.current_task && (
                                            <div className="mb-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800 font-medium">
                                                <span className="font-bold">Active Mission:</span> {team.current_task}
                                            </div>
                                        )}

                                        {/* Action Buttons */}
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => openDeployModal(team, 'team')}
                                                className="flex-1 py-1.5 px-3 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Navigation size={12} /> Deploy/Recall
                                            </button>
                                            <button 
                                                onClick={() => openNotifyModal(team, 'team')}
                                                className="flex-1 py-1.5 px-3 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                            >
                                                <Send size={12} /> Notify
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Truck className="text-orange-600" /> Equipment & Assets Fleet
                    </h3>
                    <div className="space-y-4">
                        {Object.keys(groupedAssets).length === 0 ? (
                            <p className="text-gray-400 text-center py-4">No assets available</p>
                        ) : (
                            Object.keys(groupedAssets).map((type) => (
                                <div key={type} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        {getAssetIcon(type)}
                                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                                            {type}
                                            <span className="ml-2 text-xs font-normal text-gray-400">
                                                ({groupedAssets[type].length})
                                            </span>
                                        </h4>
                                    </div>
                                    <div className="space-y-2 ml-7">
                                        {groupedAssets[type].map((asset) => (
                                            <div key={asset.id} className="group hover:bg-gray-50 transition-colors rounded-lg p-2">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <div className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                                            {asset.name}
                                                            {asset.status === 'Deployed' && (
                                                                <span className="h-1.5 w-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                            <span className="inline-block w-1 h-1 bg-gray-400 rounded-full"></span>
                                                            {asset.location}
                                                        </div>
                                                    </div>
                                                    <StatusBadge status={asset.status} compact />
                                                </div>
                                                
                                                {/* Action Buttons */}
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => openDeployModal(asset, 'asset')}
                                                        className="flex-1 py-1 px-2 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Navigation size={10} /> Deploy
                                                    </button>
                                                    <button 
                                                        onClick={() => openNotifyModal(asset, 'asset')}
                                                        className="flex-1 py-1 px-2 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Send size={10} /> Notify
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Radio className="text-purple-600" size={24} />
                    Aerial Surveillance Fleet
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.assets.filter(a => a.type === 'Drone').map((drone) => (
                        <div key={drone.id} className="bg-white p-4 rounded-lg shadow-sm border border-purple-100 group">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-gray-800">{drone.name}</span>
                                <StatusBadge status={drone.status} compact />
                            </div>
                            <p className="text-xs text-gray-500 mb-3">{drone.location}</p>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => openDeployModal(drone, 'asset')}
                                    className="flex-1 py-1.5 bg-purple-600 text-white text-xs font-bold rounded hover:bg-purple-700 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Navigation size={12} /> Deploy
                                </button>
                                <button 
                                    onClick={() => openNotifyModal(drone, 'asset')}
                                    className="flex-1 py-1.5 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                                >
                                    <Send size={12} /> Alert
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notify Modal */}
            {showNotifyModal && (
                <Modal onClose={() => setShowNotifyModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Send Notification</h3>
                    <p className="text-gray-600 mb-4">
                        Notify: <span className="font-bold">{selectedItem?.name}</span>
                    </p>
                    <textarea
                        value={notifyMessage}
                        onChange={(e) => setNotifyMessage(e.target.value)}
                        placeholder="Enter your message..."
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                        rows="4"
                    />
                    <div className="flex gap-3">
                        <button 
                            onClick={handleSendNotification}
                            className="flex-1 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700"
                        >
                            Send Message
                        </button>
                        <button 
                            onClick={() => setShowNotifyModal(false)}
                            className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}

            {/* Deploy Modal */}
            {showDeployModal && (
                <Modal onClose={() => setShowDeployModal(false)}>
                    <h3 className="text-xl font-bold mb-4">
                        {selectedItem?.type === 'team' ? 'Deploy/Recall Team' : 'Deploy/Recall Asset'}
                    </h3>
                    <p className="text-gray-600 mb-4">
                        Managing: <span className="font-bold">{selectedItem?.name}</span>
                    </p>
                    
                    <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                    <select 
                        value={deployStatus}
                        onChange={(e) => setDeployStatus(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                    >
                        {selectedItem?.type === 'team' ? (
                            <>
                                <option value="Deployed">Deployed</option>
                                <option value="Idle">Idle</option>
                                <option value="Resting">Resting</option>
                            </>
                        ) : (
                            <>
                                <option value="Available">Available</option>
                                <option value="Deployed">Deployed</option>
                                <option value="Maintenance">Maintenance</option>
                            </>
                        )}
                    </select>

                    {/* --- NEW: Task Input (Only for Teams when Deployed) --- */}
                    {selectedItem?.type === 'team' && deployStatus === 'Deployed' && (
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Mission Orders / Task</label>
                            <textarea
                                value={deployTask}
                                onChange={(e) => setDeployTask(e.target.value)}
                                placeholder="Enter specific instructions (e.g., 'Proceed to Sector A for evacuation')..."
                                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                rows="3"
                            />
                        </div>
                    )}

                    {selectedItem?.type === 'asset' && (
                        <>
                            <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
                            <input 
                                type="text"
                                value={deployLocation}
                                onChange={(e) => setDeployLocation(e.target.value)}
                                placeholder="Enter deployment location..."
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                            />
                        </>
                    )}

                    <div className="flex gap-3">
                        <button 
                            onClick={() => {
                                if (selectedItem?.type === 'team') {
                                    handleDeployTeam(selectedItem.id, deployStatus, deployTask);
                                } else {
                                    handleDeployAsset(selectedItem.id, deployStatus, deployLocation);
                                }
                            }}
                            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                        >
                            Confirm
                        </button>
                        <button 
                            onClick={() => setShowDeployModal(false)}
                            className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const Modal = ({ children, onClose }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
            <button 
                onClick={onClose}
                className="float-right text-gray-400 hover:text-gray-600"
            >
                <XCircle size={24} />
            </button>
            {children}
        </div>
    </div>
);

const SummaryCard = ({ title, value, total, icon, color }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
                <p className="text-2xl font-extrabold text-gray-800 mt-1">
                    {value}
                    <span className="text-sm text-gray-400 font-normal ml-1">/ {total}</span>
                </p>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                {icon}
            </div>
        </div>
    </div>
);

const StatusBadge = ({ status, compact = false }) => {
    let color = "bg-gray-100 text-gray-600 border-gray-200";
    let icon = <Clock size={compact ? 10 : 12} />;

    if (status === 'Available' || status === 'Idle') {
        color = "bg-green-100 text-green-700 border-green-200";
        icon = <CheckCircle size={compact ? 10 : 12} />;
    } else if (status === 'Deployed') {
        color = "bg-blue-100 text-blue-700 border-blue-200";
        icon = <Activity size={compact ? 10 : 12} />;
    } else if (status === 'Maintenance' || status === 'Resting') {
        color = "bg-orange-100 text-orange-700 border-orange-200";
        icon = <Wrench size={compact ? 10 : 12} />;
    }

    return (
        <span className={`px-2 py-1 rounded-full ${compact ? 'text-[10px]' : 'text-xs'} font-bold flex items-center gap-1 border ${color}`}>
            {icon} {status}
        </span>
    );
};

export default AssetsTeams;