import React, { useState, useEffect } from 'react';
import { Map as MapIcon, FileUp, LogOut, Activity, Users, FileText, Settings, RefreshCw } from 'lucide-react'; // Icons matching your package.json
import IncidentMap from './IncidentMap';

const Dashboard = ({ userRole, onLogout }) => {
    const [uploadedFile, setUploadedFile] = useState(null);

    const [reports, setReports] = useState([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);

    const fetchReports = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports');
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setIsLoadingReports(false);
        }
    };

    useEffect(() => {
        fetchReports();
        // Optional: Poll every 5 seconds for "Real-Time" updates
        const interval = setInterval(fetchReports, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadedFile(file);
            console.log("File selected:", file.name);
        }
    };

    console.log("DEBUG CHECK:", IncidentMap);
    return (
        <div className="flex flex-col h-screen w-full bg-gray-100">
            {/* --- Header --- */}
            <header className="bg-blue-900 text-white p-4 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Activity className="h-6 w-6 text-red-500" />
                    DRR Command Center
                </h1>
                
                <div className="flex items-center gap-4 text-sm">
                    {/* Hidden File Input */}
                    <input 
                        type="file" 
                        id="image-upload" 
                        accept="image/*" 
                        onChange={handleFileChange}
                        className="hidden" 
                    />

                    {/* Upload Button */}
                    <label htmlFor="image-upload" className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded cursor-pointer transition-colors">
                        <FileUp size={16} />
                        Upload Image
                    </label>

                    {/* User Info */}
                    <div className="hidden md:block text-right">
                        <div className="font-semibold">{userRole}</div>
                        <div className="text-xs opacity-75">Agent: Testing</div>
                    </div>

                    {/* Logout */}
                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-3 py-2 rounded text-white transition-colors"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* --- Sidebar --- */}
                <nav className="w-64 bg-white shadow-lg hidden md:flex flex-col p-4 gap-2">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick Actions</div>
                    <NavButton active icon={<Activity size={18} />} label="Incidents" />
                    <NavButton icon={<Users size={18} />} label="Assets & Teams" />
                    <NavButton icon={<FileText size={18} />} label="Damage Reports" />
                    <div className="flex-grow"></div>
                    <NavButton icon={<Settings size={18} />} label="Settings" />
                </nav>

                {/* --- Main Content --- */}
                <main className="flex-1 p-6 overflow-y-auto">
                    {/* File Upload Alert */}
                    {uploadedFile && (
                        <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-sm" role="alert">
                            <p className="font-bold flex items-center gap-2">
                                ✅ File Selected: {uploadedFile.name}
                            </p>
                            <p className="text-sm">Type: {uploadedFile.type} | Size: {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Map Panel */}
                        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <MapIcon className="text-blue-600" /> Live Incident Map
                            </h2>
                            <div className="flex-1 rounded-lg overflow-hidden border border-gray-300 relative z-0">
                               <IncidentMap reports={reports} />
                            </div>
                        </div>

                        {/* Incident Log Panel */}
                       <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-semibold text-gray-800">Incident Log</h2>
                                <button onClick={fetchReports} className="text-gray-500 hover:text-blue-600" title="Refresh">
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                {isLoadingReports ? (
                                    <div className="text-center text-gray-400 py-4">Loading reports...</div>
                                ) : reports.length === 0 ? (
                                    <div className="text-center text-gray-400 py-4">No active incidents.</div>
                                ) : (
                                    reports.map((report) => (
                                        <div key={report.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-gray-800 text-sm">{report.title}</span>
                                                <StatusBadge status={report.status} />
                                            </div>
                                            <p className="text-xs text-gray-600 mb-2">{report.description}</p>
                                            <div className="flex justify-between items-center text-xs text-gray-400">
                                                <span>📍 {report.location}</span>
                                                <span>{report.timestamp}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

// Helper component for sidebar buttons
const NavButton = ({ icon, label, active }) => (
    <button className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
        {icon}
        {label}
    </button>
);

const StatusBadge = ({ status }) => {
    let colors = "bg-gray-100 text-gray-600";
    if (status === 'Critical') colors = "bg-red-100 text-red-700";
    if (status === 'Active') colors = "bg-blue-100 text-blue-700";
    if (status === 'Cleared') colors = "bg-green-100 text-green-700";

    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${colors}`}>
            {status}
        </span>
    );
};

export default Dashboard;