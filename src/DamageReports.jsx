import React, { useState, useEffect, useCallback } from 'react';
import { FileText, AlertTriangle, MapPin, Calendar, Clock, XCircle, ImageIcon, Activity, CheckCircle, AlertCircle, Loader2, ChevronLeft, ChevronRight, Users, Save, Send } from 'lucide-react';
import { toast } from 'react-toastify';
import VideoAnalysisPlayer from './components/VideoAnalysisPlayer';

const DAMAGE_OPTIONS = ['Destroyed', 'Major', 'Minor', 'No Damage'];
const DISASTER_TYPE_OPTIONS = ['Earthquake', 'Fire', 'Flood', 'No Disaster'];

const DamageReports = ({ initialHighlightId }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    const [activeHighlightId, setActiveHighlightId] = useState(initialHighlightId);

    // Modal State
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Editable overrides
    const [editDamage, setEditDamage] = useState('');
    const [editDisasterType, setEditDisasterType] = useState('');
    const [editNotes, setEditNotes] = useState('');

    // Teams for assignment
    const [teams, setTeams] = useState([]);
    const [assignTeamId, setAssignTeamId] = useState('');
    const [assignPersonnel, setAssignPersonnel] = useState(1);

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
                        openModal(target);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTeams = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/resources');
            if (response.ok) {
                const data = await response.json();
                setTeams(data.teams || []);
            }
        } catch (error) {
            console.error("Error fetching teams:", error);
        }
    };

    useEffect(() => {
        setActiveHighlightId(initialHighlightId);
        fetchReports();
        fetchTeams();
    }, [initialHighlightId]);

    // Handle Status Change
    const updateReportStatus = async (newStatus) => {
        if (!selectedReport) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/reports/${selectedReport.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (response.ok) {
                const updated = await response.json();
                toast.success(`Status updated to ${newStatus}`);
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

    // Save editable fields (damage, type, notes)
    const saveReportOverrides = async () => {
        if (!selectedReport) return;
        const payload = {};
        if (editDamage && editDamage !== selectedReport.damage_level) payload.damage_level = editDamage;
        if (editDisasterType && editDisasterType !== selectedReport.disaster_type) payload.disaster_type = editDisasterType;
        if (editNotes !== (selectedReport.notes || '')) payload.notes = editNotes;

        if (Object.keys(payload).length === 0) {
            toast.info("No changes to save");
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/reports/${selectedReport.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const updated = await response.json();
                toast.success("Report updated");
                setSelectedReport(updated);
                setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
            } else {
                toast.error("Failed to save changes");
            }
        } catch (error) {
            toast.error("Network error");
        }
    };

    // Admin assign report to team
    const handleAssignTeam = async () => {
        if (!assignTeamId || !selectedReport) return;
        const team = teams.find(t => t.id === parseInt(assignTeamId));
        if (!team) return;

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/teams/${assignTeamId}/deployments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    report_id: selectedReport.id,
                    personnel_count: assignPersonnel,
                    task: `Assigned by Admin: ${selectedReport.title}`
                })
            });
            if (response.ok) {
                toast.success(`Assigned to ${team.name}`);
                setAssignTeamId('');
                setAssignPersonnel(1);
                fetchReports();
                fetchTeams();
                // Refresh selected report
                const rr = await fetch(`http://127.0.0.1:5000/api/v1/reports`);
                if (rr.ok) {
                    const allReports = await rr.json();
                    const fresh = allReports.find(r => r.id === selectedReport.id);
                    if (fresh) setSelectedReport(fresh);
                    setReports(allReports);
                }
            } else {
                const err = await response.json();
                toast.error(err.error || "Failed to assign team");
            }
        } catch (error) {
            toast.error("Network error");
        }
    };

    // Get flat sorted list for prev/next navigation
    const getSortedReportList = useCallback(() => {
        const result = [];
        statusOrder.forEach(status => {
            const items = reports.filter(r => r.status === status);
            items.sort((a, b) => (damageWeight[b.damage_level] || 0) - (damageWeight[a.damage_level] || 0));
            result.push(...items);
        });
        return result;
    }, [reports]);

    const navigateReport = (direction) => {
        if (!selectedReport) return;
        const sorted = getSortedReportList();
        const currentIdx = sorted.findIndex(r => r.id === selectedReport.id);
        if (currentIdx === -1) return;
        const newIdx = currentIdx + direction;
        if (newIdx >= 0 && newIdx < sorted.length) {
            openModal(sorted[newIdx]);
        }
    };

    // Keyboard nav for prev/next
    useEffect(() => {
        if (!showModal) return;
        const handler = (e) => {
            if (e.key === 'ArrowLeft') navigateReport(-1);
            if (e.key === 'ArrowRight') navigateReport(1);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [showModal, selectedReport, reports]);

    const openModal = (report) => {
        setSelectedReport(report);
        setShowModal(true);
        setActiveHighlightId(report.id);
        setEditDamage(report.damage_level || '');
        setEditDisasterType(report.disaster_type || '');
        setEditNotes(report.notes || '');
        setAssignTeamId('');
        setAssignPersonnel(1);
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
            {showModal && selectedReport && (() => {
                const sorted = getSortedReportList();
                const currentIdx = sorted.findIndex(r => r.id === selectedReport.id);
                const hasPrev = currentIdx > 0;
                const hasNext = currentIdx < sorted.length - 1;
                const claimedTeam = selectedReport.claimed_by_team_id ? teams.find(t => t.id === selectedReport.claimed_by_team_id) : null;

                return (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Header with prev/next */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
                            <div className="flex items-center gap-3">
                                <button onClick={() => navigateReport(-1)} disabled={!hasPrev} className={`p-1.5 rounded-lg border transition-colors ${hasPrev ? 'hover:bg-gray-200 text-gray-600 border-gray-300' : 'text-gray-300 border-gray-200 cursor-not-allowed'}`} title="Previous report (Left arrow)">
                                    <ChevronLeft size={18} />
                                </button>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">{selectedReport.title}</h3>
                                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-1"><MapPin size={14} /> {selectedReport.location}</p>
                                    {claimedTeam && (
                                        <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full mt-1 inline-flex items-center gap-1">
                                            <Users size={10} /> {claimedTeam.name}
                                        </span>
                                    )}
                                </div>
                                <button onClick={() => navigateReport(1)} disabled={!hasNext} className={`p-1.5 rounded-lg border transition-colors ${hasNext ? 'hover:bg-gray-200 text-gray-600 border-gray-300' : 'text-gray-300 border-gray-200 cursor-not-allowed'}`} title="Next report (Right arrow)">
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{currentIdx + 1}/{sorted.length}</span>
                                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-200 transition-colors">
                                    <XCircle size={28} />
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto">
                            {/* 1. Image or Video with AI Overlay */}
<div className="mb-6">
    <div className="w-full h-64 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden relative">
        {selectedReport.image_url ? (
            /\.(mp4|avi|mov|mkv|webm|flv)/i.test(selectedReport.image_url) ? (
                selectedReport.analysis_metadata?.per_frame_predictions ? (
                    <VideoAnalysisPlayer
                        videoUrl={selectedReport.image_url}
                        frameAnalyses={selectedReport.analysis_metadata.per_frame_predictions}
                        videoDuration={selectedReport.analysis_metadata.video_duration || 0}
                        totalFrames={selectedReport.analysis_metadata.total_analyzed_frames || selectedReport.analysis_metadata.per_frame_predictions.length}
                    />
                ) : (
                    <video src={selectedReport.image_url} controls className="w-full h-full object-cover">
                        Your browser does not support video playback.
                    </video>
                )
            ) : (
                <img src={selectedReport.image_url} alt="Incident" className="w-full h-full object-cover" />
            )
        ) : (
            <div className="text-center text-gray-400 flex flex-col items-center">
                <ImageIcon size={48} className="mb-2 opacity-50" />
                <span className="text-sm">No image provided</span>
            </div>
        )}
        <div className="absolute top-4 right-4 px-3 py-1 bg-black/70 backdrop-blur-md rounded-lg text-white text-xs font-bold border border-white/20 shadow-lg z-30">
            AI: {selectedReport.damage_level}
        </div>
    </div>
</div>

                            {/* 2. Status Dropdown */}
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

                            {/* 3. Editable Info Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Disaster Type</label>
                                    <select
                                        value={editDisasterType}
                                        onChange={(e) => setEditDisasterType(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 bg-white cursor-pointer"
                                    >
                                        {DISASTER_TYPE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    {selectedReport.confidence && (
                                        <span className="text-xs text-gray-500 mt-1 block">AI Confidence: {typeof selectedReport.confidence === 'number' ? `${selectedReport.confidence.toFixed(1)}%` : selectedReport.confidence} <span className="text-[10px] text-gray-400">(AI)</span></span>
                                    )}
                                    {selectedReport.analysis_metadata?.type_distribution && (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-200">
                                                {Object.entries(selectedReport.analysis_metadata.type_distribution).map(([name, pct]) => {
                                                    const colors = { Earthquake: 'bg-amber-500', Fire: 'bg-red-500', Flood: 'bg-blue-500', 'No Disaster': 'bg-green-500' };
                                                    return pct > 0 ? <div key={name} className={`${colors[name] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} title={`${name}: ${pct}%`} /> : null;
                                                })}
                                            </div>
                                            <div className="flex gap-2 flex-wrap text-[10px] text-gray-500">
                                                {Object.entries(selectedReport.analysis_metadata.type_distribution).map(([name, pct]) => (
                                                    pct > 0 ? <span key={name}>{name}: {pct}%</span> : null
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Assessed Damage</label>
                                    <select
                                        value={editDamage}
                                        onChange={(e) => setEditDamage(e.target.value)}
                                        className={`w-full p-2 border border-gray-300 rounded-lg text-sm font-bold bg-white cursor-pointer ${getDamageColor(editDamage).split(' ')[0]}`}
                                    >
                                        {DAMAGE_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    {selectedReport.analysis_metadata?.damage_distribution && (
                                        <div className="mt-2 space-y-1">
                                            <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-gray-200">
                                                {Object.entries(selectedReport.analysis_metadata.damage_distribution).map(([name, pct]) => {
                                                    const colors = { Destroyed: 'bg-red-700', Major: 'bg-orange-500', Minor: 'bg-yellow-500', 'No Damage': 'bg-green-500' };
                                                    return pct > 0 ? <div key={name} className={`${colors[name] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} title={`${name}: ${pct}%`} /> : null;
                                                })}
                                            </div>
                                            <div className="flex gap-2 flex-wrap text-[10px] text-gray-500">
                                                {Object.entries(selectedReport.analysis_metadata.damage_distribution).map(([name, pct]) => (
                                                    pct > 0 ? <span key={name}>{name}: {pct}%</span> : null
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Save overrides button */}
                            <div className="flex justify-end mt-3">
                                <button onClick={saveReportOverrides} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">
                                    <Save size={14} /> Save Changes
                                </button>
                            </div>

                            {/* Admin Assign to Team */}
                            <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                                <label className="block text-xs font-bold text-yellow-800 uppercase tracking-wider mb-2 flex items-center gap-1"><Users size={12} /> Assign to Team</label>
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <select
                                            value={assignTeamId}
                                            onChange={(e) => {
                                                setAssignTeamId(e.target.value);
                                                const t = teams.find(t => t.id === parseInt(e.target.value));
                                                if (t) setAssignPersonnel(Math.min(3, t.available_personnel ?? t.personnel_count));
                                            }}
                                            className="w-full p-2 border border-yellow-300 rounded-lg text-sm bg-white"
                                        >
                                            <option value="">Select team...</option>
                                            {teams.map(t => {
                                                const avail = t.available_personnel ?? t.personnel_count;
                                                return (
                                                    <option key={t.id} value={t.id} disabled={avail === 0}>
                                                        {t.name} ({t.department}) — {avail} available
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                    <div className="w-20">
                                        <label className="block text-[10px] text-yellow-700 mb-0.5">Pax</label>
                                        <input type="number" min={1} max={assignTeamId ? (teams.find(t => t.id === parseInt(assignTeamId))?.available_personnel || 1) : 1} value={assignPersonnel} onChange={(e) => setAssignPersonnel(parseInt(e.target.value) || 1)} className="w-full p-2 border border-yellow-300 rounded-lg text-sm" />
                                    </div>
                                    <button onClick={handleAssignTeam} disabled={!assignTeamId} className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${assignTeamId ? 'bg-yellow-600 text-white hover:bg-yellow-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                        <Send size={12} /> Assign
                                    </button>
                                </div>
                            </div>

                            {/* Time */}
                            <div className="grid grid-cols-1 gap-6 mt-4">
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time of Report</label>
                                    <div className="flex items-center gap-4">
                                        <span className="text-gray-800 font-bold flex items-center gap-2"><Clock size={16} className="text-blue-500"/>{new Date(selectedReport.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-gray-500 text-sm flex items-center gap-2"><Calendar size={16} />{new Date(selectedReport.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Description */}
                            <div className="mt-6">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">AI Analysis / Description</label>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 text-sm leading-relaxed">{selectedReport.description}</div>
                            </div>

                            {/* 5. Operator Notes */}
                            <div className="mt-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Operator Notes</label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Add notes about this incident..."
                                    rows={3}
                                    className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 text-sm leading-relaxed focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                                />
                                <div className="flex justify-end mt-2">
                                    <button onClick={saveReportOverrides} className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors">
                                        <Save size={14} /> Save Notes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default DamageReports;