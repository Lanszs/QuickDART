import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, TrendingUp, AlertTriangle, PieChart as PieIcon } from 'lucide-react';

const Statistics = ({ reports }) => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch Assets Data specifically for stats
    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/v1/resources');
                if (response.ok) {
                    const data = await response.json();
                    setAssets(data.assets);
                }
            } catch (error) {
                console.error("Error fetching assets for stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAssets();
    }, []);

    // --- DATA PROCESSING HELPERS ---

    // 1. Incident Type Distribution
    const getTypeData = () => {
        const counts = {};
        reports.forEach(r => {
            const type = r.title.split(':')[1]?.trim() || r.title; // Extract "Fire" from "Public Report: Fire"
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
    };

    // 2. Damage Severity Levels
    const getDamageData = () => {
        const counts = { Minor: 0, Major: 0, Destroyed: 0, Pending: 0 };
        reports.forEach(r => {
            const level = r.damage_level || 'Pending';
            if (counts[level] !== undefined) counts[level]++;
            else counts['Pending']++;
        });
        return Object.keys(counts).map(key => ({ name: key, count: counts[key] }));
    };

    // 3. Asset Utilization (Available vs Deployed)
    const getAssetData = () => {
        const deployed = assets.filter(a => a.status === 'Deployed').length;
        const available = assets.filter(a => a.status === 'Available').length;
        const maintenance = assets.filter(a => a.status === 'Maintenance').length;
        
        return [
            { name: 'Deployed', value: deployed },
            { name: 'Available', value: available },
            { name: 'Maintenance', value: maintenance }
        ];
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF0000'];

    if (loading) return <div className="p-10 text-center text-gray-500">Loading Analytics...</div>;

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Operational Analytics
            </h2>

            {/* --- TOP CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    title="Total Incidents" 
                    value={reports.length} 
                    icon={<Activity size={24} className="text-white" />} 
                    color="bg-blue-500" 
                />
                <StatCard 
                    title="Active Deployments" 
                    value={assets.filter(a => a.status === 'Deployed').length} 
                    icon={<AlertTriangle size={24} className="text-white" />} 
                    color="bg-orange-500" 
                />
                <StatCard 
                    title="Critical Damage Reports" 
                    value={reports.filter(r => r.damage_level === 'Destroyed' || r.damage_level === 'Major').length} 
                    icon={<PieIcon size={24} className="text-white" />} 
                    color="bg-red-500" 
                />
            </div>

            {/* --- CHARTS ROW 1 --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                
                {/* Chart: Damage Severity */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Damage Severity Assessment</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getDamageData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis allowDecimals={false} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#8884d8" name="Number of Reports" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart: Asset Utilization */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-700 mb-4">Asset Fleet Status</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={getAssetData()}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label
                                >
                                    {getAssetData().map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* --- CHARTS ROW 2 --- */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-700 mb-4">Incident Types Overview</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getTypeData()} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis dataKey="name" type="category" width={100} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#82ca9d" name="Count" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
        <div>
            <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-extrabold text-gray-800 mt-1">{value}</p>
        </div>
        <div className={`p-4 rounded-full shadow-lg ${color}`}>
            {icon}
        </div>
    </div>
);

export default Statistics;