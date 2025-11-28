import React, { useState, useEffect } from 'react';
import { FileText, Save, Edit3, XCircle, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Activity } from 'lucide-react';

const DamageReports = ({ initialHighlightId }) => {
    const [reports, setReports] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ status: '', damage_level: '' });

    // Fetch Reports
    const fetchReports = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports');
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (error) {
            console.error("Error fetching reports:", error);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    // --- 2. NEW: Handle Auto-Scroll & Auto-Edit ---
    useEffect(() => {
        if (initialHighlightId && reports.length > 0) {
            // Find the element by ID
            const element = document.getElementById(`report-row-${initialHighlightId}`);
            if (element) {
                // Scroll to it
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Find the report data to populate the edit form
                const reportToEdit = reports.find(r => r.id === initialHighlightId);
                if (reportToEdit) {
                    setEditingId(initialHighlightId);
                    setEditForm({ 
                        status: reportToEdit.status, 
                        damage_level: reportToEdit.damage_level || 'Pending' 
                    });
                }
            }
        }
    }, [initialHighlightId, reports]); // Run when reports load or ID changes

    // Start Editing
    const handleEditClick = (report) => {
        setEditingId(report.id);
        setEditForm({ status: report.status, damage_level: report.damage_level || 'Pending' });
    };

    // Save Changes
    const handleSave = async (id) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/v1/reports/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });

            if (response.ok) {
                setEditingId(null);
                fetchReports(); 
            } else {
                alert("Failed to update report");
            }
        } catch (error) {
            console.error("Error updating:", error);
        }
    };

    // --- NEW: Grouping Logic ---
    const getGroupedReports = () => {
        const groups = {};
        
        reports.forEach(report => {
            const status = report.status || 'Unknown';
            const damage = report.damage_level || 'Pending';

            if (!groups[status]) groups[status] = {};
            if (!groups[status][damage]) groups[status][damage] = [];
            
            groups[status][damage].push(report);
        });

        return groups;
    };

    const groupedReports = getGroupedReports();

    // Helper to order statuses logically
    const statusOrder = ['Critical', 'Active', 'Verified', 'Cleared']; 
    const damageOrder = ['Destroyed', 'Major', 'Minor', 'No Damage', 'Pending'];

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-2">
                <FileText className="text-blue-600" /> Damage Assessment & Validation
            </h2>

            {Object.keys(groupedReports).length === 0 && (
                <p className="text-gray-500 text-center py-10">No reports found.</p>
            )}

            {/* Render Groups by Status */}
            {statusOrder.map(status => {
                const damageGroups = groupedReports[status];
                if (!damageGroups) return null;

                return (
                    <div key={status} className="mb-10">
                        {/* Status Header */}
                        <div className={`flex items-center gap-2 pb-2 mb-4 border-b-2 ${
                            status === 'Critical' ? 'border-red-500 text-red-700' :
                            status === 'Active' ? 'border-blue-500 text-blue-700' :
                            status === 'Verified' ? 'border-green-500 text-green-700' :
                            'border-gray-300 text-gray-600'
                        }`}>
                            {status === 'Critical' ? <AlertCircle size={24} /> :
                             status === 'Active' ? <Activity size={24} /> :
                             status === 'Verified' ? <CheckCircle size={24} /> :
                             <FileText size={24} />}
                            <h3 className="text-xl font-bold uppercase tracking-wide">{status} Incidents</h3>
                        </div>

                        {/* Render Sub-groups by Damage Level */}
                        <div className="grid grid-cols-1 gap-4">
                            {damageOrder.map(damage => {
                                const items = damageGroups[damage];
                                if (!items) return null;

                                return (
                                    <div key={damage} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                                            <span className="text-xs font-bold uppercase text-gray-500 flex items-center gap-2">
                                                <ChevronDown size={14} />
                                                Damage Level: <span className={`text-sm ${
                                                    damage === 'Destroyed' ? 'text-red-600 font-extrabold' : 
                                                    damage === 'Major' ? 'text-orange-600 font-bold' : 
                                                    'text-gray-700'
                                                }`}>{damage}</span>
                                            </span>
                                            <span className="bg-white border px-2 py-0.5 rounded text-xs font-mono text-gray-400">
                                                {items.length} Reports
                                            </span>
                                        </div>

                                        <table className="w-full text-left">
                                            <tbody className="divide-y divide-gray-50">
                                                {items.map((report) => (
                                                    <tr 
                                                        key={report.id} 
                                                        id={`report-row-${report.id}`} // 3. ADD ID FOR SCROLLING
                                                        className={`transition-colors group ${
                                                            editingId === report.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <td className="p-4 w-16 text-gray-400 font-mono text-xs">#{report.id}</td>
                                                        <td className="p-4">
                                                            <div className="font-semibold text-gray-800">{report.title}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{report.location}</div>
                                                        </td>

                                                        <td className="p-4 w-40">
                                                            {editingId === report.id ? (
                                                                <select 
                                                                    value={editForm.damage_level}
                                                                    onChange={(e) => setEditForm({...editForm, damage_level: e.target.value})}
                                                                    className="w-full p-2 border rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                    {damageOrder.map(d => <option key={d} value={d}>{d}</option>)}
                                                                </select>
                                                            ) : (
                                                                <span className="text-sm text-gray-600">{report.damage_level}</span>
                                                            )}
                                                        </td>

                                                        <td className="p-4 w-40">
                                                            {editingId === report.id ? (
                                                                <select 
                                                                    value={editForm.status}
                                                                    onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                                                                    className="w-full p-2 border rounded text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                                >
                                                                    <option value="Active">Active</option>
                                                                    <option value="Critical">Critical</option>
                                                                    <option value="Verified">Verified</option>
                                                                    <option value="Cleared">Cleared</option>
                                                                </select>
                                                            ) : (
                                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                    report.status === 'Verified' ? 'bg-green-100 text-green-700' :
                                                                    report.status === 'Critical' ? 'bg-red-100 text-red-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                    {report.status}
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="p-4 w-32 text-right">
                                                            {editingId === report.id ? (
                                                                <div className="flex justify-end gap-2">
                                                                    <button onClick={() => handleSave(report.id)} className="p-2 bg-green-600 text-white rounded hover:bg-green-700 shadow-sm">
                                                                        <Save size={16} />
                                                                    </button>
                                                                    <button onClick={() => setEditingId(null)} className="p-2 bg-white border border-gray-300 text-gray-600 rounded hover:bg-gray-50 shadow-sm">
                                                                        <XCircle size={16} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button 
                                                                    onClick={() => handleEditClick(report)} 
                                                                    className="px-3 py-1.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 hover:border-blue-300 text-sm font-medium transition-all flex items-center gap-1.5 ml-auto opacity-0 group-hover:opacity-100"
                                                                >
                                                                    <Edit3 size={14} /> Update
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default DamageReports;