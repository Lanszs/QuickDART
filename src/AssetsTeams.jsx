import React, { useEffect, useState } from 'react';
import { Truck, Users, Wrench, CheckCircle, Clock, Activity } from 'lucide-react';

const AssetsTeams = () => {
    const [data, setData] = useState({ assets: [], teams: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/v1/resources');
                if (response.ok) {
                    setData(await response.json());
                }
            } catch (error) {
                console.error("Error fetching resources:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div className="p-6 text-gray-500">Loading resources...</div>;

    return (
        <div className="p-6 h-full overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Operational Resources</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* --- Teams Section --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Users className="text-blue-600" /> Active Teams
                    </h3>
                    <div className="space-y-3">
                        {data.teams.map((team) => (
                            <div key={team.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <div className="font-bold text-gray-800">{team.name}</div>
                                    <div className="text-xs text-gray-500">{team.specialization} • {team.personnel_count} Personnel</div>
                                </div>
                                <StatusBadge status={team.status} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* --- Assets Section --- */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Truck className="text-orange-600" /> Equipment & Assets
                    </h3>
                    <div className="space-y-3">
                        {data.assets.map((asset) => (
                            <div key={asset.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <div className="font-bold text-gray-800">{asset.name}</div>
                                    <div className="text-xs text-gray-500">{asset.type} • {asset.location}</div>
                                </div>
                                <StatusBadge status={asset.status} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    let color = "bg-gray-100 text-gray-600";
    let icon = <Clock size={12} />;

    if (status === 'Available' || status === 'Idle') {
        color = "bg-green-100 text-green-700";
        icon = <CheckCircle size={12} />;
    } else if (status === 'Deployed') {
        color = "bg-blue-100 text-blue-700";
        icon = <Activity size={12} />; // Note: Activity import needed if used here, or replace with simple text
    } else if (status === 'Maintenance') {
        color = "bg-red-100 text-red-700";
        icon = <Wrench size={12} />;
    }

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${color}`}>
            {icon} {status}
        </span>
    );
};

export default AssetsTeams;