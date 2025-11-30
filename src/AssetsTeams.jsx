import React, { useEffect, useState } from 'react';
import { Truck, Users, Wrench, CheckCircle, Clock, Activity, RefreshCw, Radio, 
    Droplet, Flame, Mountain, Heart, Package, Phone, Shield, Dog, Send, Navigation, XCircle, Plus, Trash2, 
    ChevronRight, Box } from 'lucide-react';
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

    // --- DEPARTMENT MODAL STATE ---
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [showDeptModal, setShowDeptModal] = useState(false);

    // --- FORM DATA STATES ---
    const [selectedItem, setSelectedItem] = useState(null);
    const [notifyMessage, setNotifyMessage] = useState('');
    const [deployStatus, setDeployStatus] = useState('');
    const [deployLocation, setDeployLocation] = useState('');
    const [deployTask, setDeployTask] = useState('');

    const [newTeam, setNewTeam] = useState({ name: '', department: 'BFP', personnel_count: 5 });
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

       /* socket.on('team_notification', (notification) => {
            toast.success(`📢 ${notification.team_name}: ${notification.message}`);
        });

        socket.on('asset_notification', (notification) => {
            toast.info(`🔔 ${notification.asset_name}: ${notification.message}`);
        }); */

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    const getDepartments = () => {
        const depts = {};
        
        if (!data.teams) return [];

        data.teams.forEach(team => {
            // Default to "Unassigned" if department field is missing (backward compatibility)
            const deptName = team.department || "Unassigned";
            
            if (!depts[deptName]) {
                depts[deptName] = {
                    name: deptName,
                    teams: [],
                    totalPersonnel: 0,
                    totalAssets: 0
                };
            }
            depts[deptName].teams.push(team);
            depts[deptName].totalPersonnel += team.personnel_count;
            // Assets are now nested inside teams from the backend
            depts[deptName].totalAssets += (team.assets ? team.assets.length : 0);
        });

        return Object.values(depts);
    };

    const departments = getDepartments();

    const getDeptIcon = (name) => {
        if (name === 'BFP') return <div className="p-3 bg-red-100 rounded-lg text-red-600"><Flame size={24} /></div>;
        if (name === 'PNP') return <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><Shield size={24} /></div>;
        if (name === 'EMS') return <div className="p-3 bg-green-100 rounded-lg text-green-600"><Heart size={24} /></div>;
        if (name === 'Barangay') return <div className="p-3 bg-orange-100 rounded-lg text-orange-600"><Users size={24} /></div>;
        return <div className="p-3 bg-gray-100 rounded-lg text-gray-600"><Box size={24} /></div>;
    };
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
                fetchData();
            } 
            
        }   catch (error) {
                toast.error("Error adding team");
        }
    };

   const handleDeleteTeam = async (id) => {
        if (!window.confirm("Delete this team?")) return;
        await fetch(`http://127.0.0.1:5000/api/v1/teams/${id}`, { method: 'DELETE' });
        fetchData();
    };

    const handleAddAsset = async () => { 
         try {
             const response = await fetch('http://127.0.0.1:5000/api/v1/assets', {
                 method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newAsset)
             });
             if (response.ok) { toast.success("Asset added!"); setShowAddAssetModal(false); fetchData(); }
        } catch (e) { toast.error("Error adding asset"); }
    };

    const handleDeleteAsset = async (id) => {
        if (!window.confirm("Delete this asset?")) return;
        await fetch(`http://127.0.0.1:5000/api/v1/assets/${id}`, { method: 'DELETE' });
        fetchData();
    };

    // --- EXISTING DEPLOY LOGIC ---
   const handleDeployTeam = async (teamId, newStatus, task) => {
        await fetch(`http://127.0.0.1:5000/api/v1/teams/${teamId}/deploy`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, task: task })
        });
        toast.success("Team updated");
        setShowDeployModal(false);
        fetchData();
    };

    const handleDeployAsset = async (assetId, newStatus, location) => {
        await fetch(`http://127.0.0.1:5000/api/v1/assets/${assetId}/deploy`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus, location })
        });
        toast.success("Asset updated");
        setShowDeployModal(false);
        fetchData();
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

    /* const getTeamIcon = (specialization) => {
        if (specialization.includes('Flood')) return <Droplet className="text-blue-600" size={20} />;
        if (specialization.includes('Fire')) return <Flame className="text-red-600" size={20} />;
        if (specialization.includes('Earthquake')) return <Mountain className="text-orange-600" size={20} />;
        if (specialization.includes('Medical')) return <Heart className="text-pink-600" size={20} />;
        return <Users className="text-gray-600" size={20} />;
    }; */

    const getAssetIcon = (type) => {
        if (type === 'Drone') return <Radio className="text-purple-600" size={20} />;
        if (type === 'Vehicle') return <Truck className="text-blue-600" size={20} />;
        if (type === 'Medical Kit') return <Heart className="text-red-600" size={20} />;
        return <Package className="text-gray-600" size={20} />;
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading resources...</div>;

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            {/* Header & Add Buttons */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Operational Resources</h2>
                    <p className="text-sm text-gray-500 mt-1">Departmental Breakdown</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddTeamModal(true)} 
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm">
                                <Plus size={16} /> Add Team</button>
                    <button onClick={() => setShowAddAssetModal(true)} 
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-sm">
                                <Plus size={16} /> Add Asset</button>
                    <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-600 border border-gray-300 rounded-lg"><RefreshCw size={16} /></button>
                </div>
            </div>

            {/* Summaries */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <SummaryCard title="Active Teams" value={data.teams.filter(t => t.status === 'Deployed').length} total={data.teams.length} icon={<Users className="text-blue-600" size={24} />} color="bg-blue-100" />
                <SummaryCard title="Total Personnel" value={data.teams.reduce((acc, t) => acc + t.personnel_count, 0)} total={data.teams.reduce((acc, t) => acc + t.personnel_count, 0)} icon={<CheckCircle className="text-green-600" size={24} />} color="bg-green-100" />
                <SummaryCard title="Deployed Assets" value={data.assets.filter(a => a.status === 'Deployed').length} total={data.assets.length} icon={<Activity className="text-orange-600" size={24} />} color="bg-orange-100" />
                <SummaryCard title="Under Maintenance" value={data.assets.filter(a => a.status === 'Maintenance').length} total={data.assets.length} icon={<Wrench className="text-red-600" size={24} />} color="bg-red-100" />
            </div>

            {/* --- DEPARTMENT GRID --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {departments.map((dept) => (
                    <div 
                        key={dept.name}
                        onClick={() => { setSelectedDepartment(dept); setShowDeptModal(true); }}
                        className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                {getDeptIcon(dept.name)}
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800 group-hover:text-blue-700 transition-colors">{dept.name}</h3>
                                    <p className="text-sm text-gray-500">{dept.teams.length} Sub-units Active</p>
                                </div>
                            </div>
                            <ChevronRight className="text-gray-300 group-hover:text-blue-500" />
                        </div>
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase">Personnel</p>
                                <p className="text-lg font-bold text-gray-800">{dept.totalPersonnel}</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase">Total Assets</p>
                                <p className="text-lg font-bold text-gray-800">{dept.totalAssets}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* --- DEPARTMENT DETAILS MODAL --- */}
            {showDeptModal && selectedDepartment && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in zoom-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[85vh] flex flex-col overflow-hidden">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                {getDeptIcon(selectedDepartment.name)}
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">{selectedDepartment.name} Command</h2>
                                    <p className="text-sm text-gray-500">Resource Allocation & Deployment</p>
                                </div>
                            </div>
                            <button onClick={() => setShowDeptModal(false)} className="text-gray-400 hover:text-gray-600 bg-white p-2 rounded-full hover:bg-gray-200"><XCircle size={24} /></button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {selectedDepartment.teams.map(team => (
                                    <div key={team.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        {/* Team Header */}
                                        <div className="p-4 border-b border-gray-100 flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1.5 h-10 rounded-full ${team.status === 'Deployed' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                                <div>
                                                    <div className="font-bold text-gray-800 flex items-center gap-2">
                                                        {team.name}
                                                        {team.status === 'Deployed' && <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>}
                                                    </div>
                                                    <p className="text-xs text-gray-500"> {team.personnel_count} Pax</p>
                                                </div>
                                            </div>
                                            <StatusBadge status={team.status} />
                                        </div>

                                        {/* Actions & Task */}
                                        <div className="p-4">
                                            {team.status === 'Deployed' && (
                                                <div className="mb-4 px-3 py-2 bg-red-50 border border-red-100 rounded text-xs text-red-800 font-medium flex items-start gap-2">
                                                    <Activity size={14} className="mt-0.5" />
                                                    <span><strong className="block">Current Mission:</strong> {team.current_task}</span>
                                                </div>
                                            )}

                                            {/* Assets Attached to Team */}
                                            <div className="mb-4">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Assigned Assets</p>
                                                {team.assets && team.assets.length > 0 ? (
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {team.assets.map(asset => (
                                                            <div key={asset.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded border border-gray-100 group">
                                                                <span className="font-medium text-gray-700">{asset.name} ({asset.type})</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-1.5 py-0.5 rounded ${asset.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{asset.status}</span>
                                                                    <button onClick={() => handleDeleteAsset(asset.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-xs text-gray-400 italic">No assets assigned.</p>}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-2 pt-2 border-t border-gray-50">
                                                <button onClick={() => openDeployModal(team, 'team')} className="flex-1 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded hover:bg-blue-100">Manage Status</button>
                                                <button onClick={() => handleDeleteTeam(team.id)} className="px-2 text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- OTHER MODALS (Add Team, Add Asset, Deploy, Notify) --- */}
            {/* These remain largely the same logic, just hidden for brevity in this response but included in your file */}
            {/* --- ADD TEAM MODAL (Updated for Department) --- */}
            {showAddTeamModal && (
                <Modal onClose={() => setShowAddTeamModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Add New Team</h3>
                    <div className="space-y-3">
                        <input type="text" className="w-full p-2 border rounded" value={newTeam.name} onChange={e => setNewTeam({...newTeam, name: e.target.value})} placeholder="Team Name" />
                        <select className="w-full p-2 border rounded" value={newTeam.department} onChange={e => setNewTeam({...newTeam, department: e.target.value})}>
                            <option value="BFP">BFP (Fire)</option>
                            <option value="PNP">PNP (Police)</option>
                            <option value="EMS">EMS (Medical)</option>
                            <option value="Barangay">Barangay</option>
                        </select>
                        <input type="number" className="w-full p-2 border rounded" value={newTeam.personnel_count} onChange={e => setNewTeam({...newTeam, personnel_count: e.target.value})} placeholder="Personnel Count" />
                        <button onClick={handleAddTeam} className="w-full py-2 bg-indigo-600 text-white rounded">Save</button>
                    </div>
                </Modal>
            )}
            
            {/* Deploy Modal (Reused) */}
            {showDeployModal && (
                <Modal onClose={() => setShowDeployModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Manage {selectedItem?.name}</h3>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
                    <select value={deployStatus} onChange={(e) => setDeployStatus(e.target.value)} className="w-full p-3 border rounded mb-4">
                        <option value="Deployed">Deployed</option><option value="Idle">Idle</option><option value="Resting">Resting</option>
                    </select>
                    {deployStatus === 'Deployed' && (
                        <textarea value={deployTask} onChange={(e) => setDeployTask(e.target.value)} placeholder="Enter Mission Orders..." className="w-full p-3 border rounded mb-4" rows="3" />
                    )}
                    <button onClick={() => handleDeployTeam(selectedItem.id, deployStatus, deployTask)} className="w-full py-2 bg-blue-600 text-white font-bold rounded">Update Status</button>
                </Modal>
            )}

             {showNotifyModal && (
                <Modal onClose={() => setShowNotifyModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Notify {selectedItem?.name}</h3>
                    <textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Message..." className="w-full p-3 border rounded mb-4" rows="3" />
                    <button onClick={() => console.log("Send")} className="w-full py-2 bg-green-600 text-white font-bold rounded">Send</button>
                </Modal>
            )}

            {showAddAssetModal && (
                <Modal onClose={() => setShowAddAssetModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Add Asset</h3>
                    <div className="space-y-3">
                        <input type="text" className="w-full p-2 border rounded" value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} placeholder="Name" />
                        <input type="text" className="w-full p-2 border rounded" value={newAsset.location} onChange={e => setNewAsset({...newAsset, location: e.target.value})} placeholder="Location" />
                        <button onClick={handleAddAsset} className="w-full py-2 bg-orange-600 text-white rounded">Save</button>
                    </div>
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

const StatusBadge = ({ status }) => {
    let color = "bg-gray-100 text-gray-600";
    if (status === 'Deployed') color = "bg-red-100 text-red-700";
    else if (status === 'Idle') color = "bg-green-100 text-green-700";
    return <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${color}`}>{status}</span>;
};

export default AssetsTeams;