import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, MapPin, Calendar, Clock, XCircle, ImageIcon, Activity, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

const DamageReports = ({ initialHighlightId }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeHighlightId, setActiveHighlightId] = useState(initialHighlightId);

    // Modal State
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // --- SORTING CONFIGURATION ---
    const statusOrder = ['Pending', 'Active', 'Cleared'];

    const damageWeight = {
        'Destroyed': 4,
        'Major': 3,
        'Minor': 2,
        'No Damage': 1
    };

    // Fetch Reports
    const fetchReports = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports');
            if (response.ok) {
                const data = await response.json();
                setReports(data);
                if (initialHighlightId) {
                    const target = data.find(r => r.id === initialHighlightId);
                    if (target) {
                        openModal(target);// Ensure local state matches prop
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    // Update whenever the prop changes (e.g. redirected from Dashboard again)
    useEffect(() => {
        setActiveHighlightId(initialHighlightId);
        fetchReports();
    }, [initialHighlightId]);

    // Handle Status Change
    const updateReportStatus = async (newStatus) => {
        if (!selectedReport) return;

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/reports/${selectedReport.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }) // Only updating status
            });

            if (response.ok) {
                const updated = await response.json();
                toast.success(`Status updated to ${newStatus}`);
                
                // Update local state immediately
                setSelectedReport(updated); 
                setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error("Update error:", error);
            toast.error("Network error");
        }
    };

    const openModal = (report) => {
        setSelectedReport(report);
        setShowModal(true);
        setActiveHighlightId(report.id);
    };

    const closeModal = () => {
        setSelectedReport(null);
        setShowModal(false);
    };

    // Helper for Damage Color
    const getDamageColor = (level) => {
        switch (level) {
            case 'Destroyed': return 'text-red-600 bg-red-100 border-red-200';
            case 'Major': return 'text-orange-600 bg-orange-100 border-orange-200';
            case 'Minor': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
            case 'No Damage': return 'text-green-600 bg-green-100 border-green-200';
            default: return 'text-gray-600 bg-gray-100 border-gray-200';
        }
    };

    // Helper for Status Badge in List
   /* const getStatusBadge = (status) => {
        let color = "bg-gray-100 text-gray-600";
        if (status === 'Critical') color = "bg-red-100 text-red-700";
        if (status === 'Active') color = "bg-blue-100 text-blue-700";
        if (status === 'Cleared') color = "bg-green-100 text-green-700";
        if (status === 'Verified') color = "bg-teal-100 text-teal-700";
        return <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${color}`}>{status}</span>;
    }; */

    if (loading) return <div className="p-10 text-center text-gray-500">Loading damage assessments...</div>;

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
                <FileText className="text-blue-600" /> Damage Assessment Logs
            </h2>

            {reports.length === 0 && (
                <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed">
                    No damage reports available.
                </div>
            )}

           {/* --- RENDER GROUPS BY STATUS --- */}
            {statusOrder.map(status => {
                // 1. Filter reports for this status
                const items = reports.filter(r => r.status === status);
                
                // 2. Sort them by Damage Severity (Descending)
                const sortedItems = items.sort((a, b) => {
                    const weightA = damageWeight[a.damage_level] || 0;
                    const weightB = damageWeight[b.damage_level] || 0;
                    return weightB - weightA; 
                });

                if (sortedItems.length === 0) return null;

                return (
                    <div key={status} className="mb-8 animate-in slide-in-from-bottom-2 duration-300">
                        {/* Group Header */}
                        <div className={`flex items-center gap-2 pb-2 mb-4 border-b-2 ${
                            status === 'Pending' ? 'border-orange-400 text-orange-700' :
                            status === 'Active' ? 'border-blue-500 text-blue-700' :
                            'border-green-500 text-green-700'
                        }`}>
                            {status === 'Pending' ? <AlertCircle size={24} /> :
                             status === 'Active' ? <Activity size={24} /> :
                             <CheckCircle size={24} />}
                            <h3 className="text-xl font-bold uppercase tracking-wide">{status} Incidents</h3>
                            <span className="ml-auto text-xs font-mono bg-white border px-2 py-1 rounded text-gray-500">
                                {sortedItems.length} Reports
                            </span>
                        </div>

                        {/* Report Cards Grid */}
                        <div className="grid grid-cols-1 gap-3">
                            {sortedItems.map((report) => (
                                <div 
                                    key={report.id} 
                                    id={`report-row-${report.id}`}
                                    onClick={() => openModal(report)}
                                    className={`bg-white p-5 rounded-xl shadow-sm border transition-all cursor-pointer hover:shadow-md hover:border-blue-300 group relative overflow-hidden
                                        ${activeHighlightId === report.id ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}
                                    `}
                                >
                                    {/* Subtle Damage Indicator Bar on Left */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getDamageColor(report.damage_level).split(' ')[1].replace('bg-', 'bg-')}`}></div>

                                    <div className="flex justify-between items-start pl-2">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                                                {report.title}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                                                <span className="flex items-center gap-1"><MapPin size={14}/> {report.location}</span>
                                                <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(report.timestamp).toLocaleDateString()}</span>
                                            </p>
                                        </div>

                                        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getDamageColor(report.damage_level)}`}>
                                            {report.damage_level || "Pending"}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* DETAILED MODAL */}
            {showModal && selectedReport && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedReport.title}</h3>
                                <p className="text-sm text-gray-500 flex items-center gap-2 mt-1"><MapPin size={14} /> {selectedReport.location}</p>
                            </div>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-200 transition-colors">
                                <XCircle size={28} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto">
                            {/* 1. Image */}
                            <div className="mb-6">
                                <div className="w-full h-64 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
                                    {selectedReport.image_url ? (
                                        <img src={selectedReport.image_url} 
                                        alt="Incident"
                                        className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="text-center text-gray-400 flex flex-col items-center">
                                            <ImageIcon size={48} className="mb-2 opacity-50" />
                                            <span className="text-sm">No image provided</span>
                                        </div>
                                    )}
                                    {/* Overlay Damage Level on Image */}
                                    <div className="absolute top-4 right-4 px-3 py-1 bg-black/70 backdrop-blur-md rounded-lg text-white text-xs font-bold border border-white/20 shadow-lg">
                                        AI: {selectedReport.damage_level}
                                    </div>
                                </div>
                            </div>

                            {/* 2. Status Dropdown (The Feature You Requested) */}
                            <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                                <label className="text-sm font-bold text-blue-900">Current Incident Status:</label>
                                <select 
                                    value={selectedReport.status}
                                    onChange={(e) => updateReportStatus(e.target.value)}
                                    className="bg-white border border-blue-300 text-blue-800 text-sm font-bold rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 cursor-pointer hover:bg-blue-50 transition-colors"
                                >
                                    <option value="Pending">Pending</option>
                                    <option value="Active">Active</option>
                                    <option value="Cleared">Cleared</option>
                                </select>
                            </div>

                            {/* 3. Info Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Assessed Damage</label>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className={getDamageColor(selectedReport.damage_level).split(' ')[0]} size={20} />
                                        <span className={`text-lg font-bold ${getDamageColor(selectedReport.damage_level).split(' ')[0]}`}>{selectedReport.damage_level || "Pending"}</span>
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time of Report</label>
                                    <div className="flex flex-col">
                                        <span className="text-gray-800 font-bold flex items-center gap-2"><Clock size={16} className="text-blue-500"/>{new Date(selectedReport.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-gray-500 text-sm flex items-center gap-2 mt-1"><Calendar size={16} />{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Description */}
                            <div className="mt-6">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Analysis / Description</label>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 text-sm leading-relaxed">{selectedReport.description}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DamageReports;