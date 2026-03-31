import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
    Activity, TrendingUp, AlertTriangle, PieChart as PieIcon,
    CheckCircle, Clock, Users, Shield, Zap, BarChart3
} from 'lucide-react';

const COLORS = {
    blue: '#3B82F6', red: '#EF4444', orange: '#F97316', yellow: '#EAB308',
    green: '#22C55E', purple: '#8B5CF6', cyan: '#06B6D4', pink: '#EC4899',
    gray: '#6B7280', indigo: '#6366F1'
};

const DAMAGE_COLORS = {
    Destroyed: '#EF4444', Major: '#F97316', Minor: '#EAB308', 'No Damage': '#22C55E', Pending: '#6B7280', Unknown: '#9CA3AF'
};

const STATUS_COLORS = {
    Pending: '#F97316', Active: '#3B82F6', Critical: '#EF4444', Cleared: '#22C55E'
};

const TYPE_COLORS = {
    Earthquake: '#8B5CF6', Fire: '#EF4444', Flood: '#3B82F6', 'No Disaster': '#22C55E'
};

const Statistics = ({ reports, teams }) => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);

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

    // ========== DATA PROCESSING ==========

    const extractType = (report) => {
        if (report.disaster_type) return report.disaster_type;
        const match = report.title?.split(':')[1]?.trim();
        return match || 'Unknown';
    };

    // Stat card values
    const activeIncidents = reports.filter(r => r.status === 'Active' || r.status === 'Critical').length;
    const clearedIncidents = reports.filter(r => r.status === 'Cleared').length;
    const totalPersonnel = (teams || []).reduce((acc, t) => acc + (t.personnel_count || 0), 0);
    const availablePersonnel = (teams || []).reduce((acc, t) => acc + (t.available_personnel ?? t.personnel_count ?? 0), 0);
    const deployedPersonnel = totalPersonnel - availablePersonnel;
    const highConfReports = reports.filter(r => r.confidence && r.confidence > 70).length;
    const aiDetectionRate = reports.length > 0 ? Math.round((highConfReports / reports.length) * 100) : 0;

    // 1. Incidents Over Time (grouped by day)
    const getIncidentsOverTime = () => {
        const byDate = {};
        reports.forEach(r => {
            if (!r.timestamp) return;
            const date = new Date(r.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (!byDate[date]) byDate[date] = { date, Active: 0, Cleared: 0, Pending: 0, Critical: 0 };
            const status = r.status || 'Pending';
            if (byDate[date][status] !== undefined) byDate[date][status]++;
        });
        return Object.values(byDate).sort((a, b) => new Date(a.date) - new Date(b.date));
    };

    // 2. Damage Severity
    const getDamageData = () => {
        const counts = { 'No Damage': 0, Minor: 0, Major: 0, Destroyed: 0, Pending: 0 };
        reports.forEach(r => {
            const level = r.damage_level || 'Pending';
            if (counts[level] !== undefined) counts[level]++;
            else counts['Pending']++;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count, fill: DAMAGE_COLORS[name] || COLORS.gray }));
    };

    // 3. Disaster Type Breakdown
    const getTypeData = () => {
        const counts = {};
        reports.forEach(r => {
            const type = extractType(r);
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    };

    // 4. Status Distribution
    const getStatusData = () => {
        const counts = { Pending: 0, Active: 0, Critical: 0, Cleared: 0 };
        reports.forEach(r => {
            const status = r.status || 'Pending';
            if (counts[status] !== undefined) counts[status]++;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    };

    // 5. AI Confidence by Disaster Type
    const getConfidenceByType = () => {
        const groups = {};
        reports.forEach(r => {
            if (!r.confidence) return;
            const type = extractType(r);
            if (!groups[type]) groups[type] = { sum: 0, count: 0 };
            groups[type].sum += r.confidence;
            groups[type].count++;
        });
        return Object.entries(groups).map(([name, { sum, count }]) => ({
            name, confidence: Math.round(sum / count)
        })).sort((a, b) => b.confidence - a.confidence);
    };

    // 6. Asset Fleet Status
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

    // 7. Team Personnel Chart
    const getTeamPersonnelData = () => {
        return (teams || []).map(t => ({
            name: t.name.length > 12 ? t.name.substring(0, 12) + '...' : t.name,
            Available: t.available_personnel ?? t.personnel_count ?? 0,
            Deployed: (t.personnel_count || 0) - (t.available_personnel ?? t.personnel_count ?? 0)
        }));
    };

    // 8. Department Incident Coverage
    const getDeptCoverage = () => {
        const haversine = (lat1, lon1, lat2, lon2) => {
            const toRad = x => (x * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const deptCounts = {};
        (teams || []).forEach(team => {
            if (!team.base_latitude || !team.base_longitude) return;
            const dept = team.department || 'Unknown';
            if (!deptCounts[dept]) deptCounts[dept] = new Set();
            reports.forEach(r => {
                if (!r.latitude || !r.longitude) return;
                const dist = haversine(team.base_latitude, team.base_longitude, r.latitude, r.longitude);
                if (dist <= (team.coverage_radius_km || 5)) {
                    deptCounts[dept].add(r.id);
                }
            });
        });

        return Object.entries(deptCounts).map(([name, ids]) => ({ name, incidents: ids.size }))
            .sort((a, b) => b.incidents - a.incidents);
    };

    // 9. Peak Incident Hours
    const getPeakHours = () => {
        const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, '0')}:00`, count: 0 }));
        reports.forEach(r => {
            if (!r.timestamp) return;
            const h = new Date(r.timestamp).getHours();
            hours[h].count++;
        });
        return hours;
    };

    // 10. Team Leaderboard
    const getTeamLeaderboard = () => {
        return (teams || []).map(t => ({
            id: t.id,
            name: t.name,
            department: t.department,
            status: t.status,
            personnel: t.personnel_count || 0,
            available: t.available_personnel ?? t.personnel_count ?? 0,
            activeDeployments: t.active_deployments?.length || 0,
        })).sort((a, b) => b.activeDeployments - a.activeDeployments);
    };

    // ========== CUSTOM TOOLTIP ==========
    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-sm">
                <p className="font-bold text-gray-700 mb-1">{label}</p>
                {payload.map((entry, i) => (
                    <p key={i} style={{ color: entry.color || entry.fill }}>
                        {entry.name}: <strong>{entry.value}</strong>
                    </p>
                ))}
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-gray-500">Loading Analytics...</div>;

    const typeData = getTypeData();
    const statusData = getStatusData();
    const assetData = getAssetData();

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <TrendingUp className="text-blue-600" /> Operational Analytics
            </h2>

            {/* ===== STAT CARDS ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <StatCard title="Total Incidents" value={reports.length} icon={<BarChart3 size={20} />} color="bg-blue-500" />
                <StatCard title="Active" value={activeIncidents} icon={<Activity size={20} />} color="bg-orange-500" />
                <StatCard title="Cleared" value={clearedIncidents} icon={<CheckCircle size={20} />} color="bg-green-500" />
                <StatCard title="Personnel Deployed" value={`${deployedPersonnel}/${totalPersonnel}`} icon={<Users size={20} />} color="bg-purple-500" />
                <StatCard title="Critical Reports" value={reports.filter(r => r.damage_level === 'Destroyed' || r.damage_level === 'Major').length} icon={<AlertTriangle size={20} />} color="bg-red-500" />
                <StatCard title="AI Confidence" value={`${aiDetectionRate}%`} icon={<Zap size={20} />} color="bg-cyan-500" />
            </div>

            {/* ===== ROW 1: Incidents Over Time (full width) ===== */}
            <ChartCard title="Incident Timeline" subtitle="Daily incident volume by status" className="mb-8">
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getIncidentsOverTime()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Area type="monotone" dataKey="Critical" stackId="1" stroke={STATUS_COLORS.Critical} fill={STATUS_COLORS.Critical} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="Active" stackId="1" stroke={STATUS_COLORS.Active} fill={STATUS_COLORS.Active} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="Pending" stackId="1" stroke={STATUS_COLORS.Pending} fill={STATUS_COLORS.Pending} fillOpacity={0.6} />
                            <Area type="monotone" dataKey="Cleared" stackId="1" stroke={STATUS_COLORS.Cleared} fill={STATUS_COLORS.Cleared} fillOpacity={0.6} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </ChartCard>

            {/* ===== ROW 2: Damage & Type ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <ChartCard title="Damage Severity" subtitle="Distribution across all reports">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getDamageData()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Reports" radius={[6, 6, 0, 0]}>
                                    {getDamageData().map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <ChartCard title="Disaster Types" subtitle="Breakdown by classification">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={typeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {typeData.map((entry, i) => (
                                        <Cell key={i} fill={TYPE_COLORS[entry.name] || Object.values(COLORS)[i % Object.values(COLORS).length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* ===== ROW 3: Response Performance ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <ChartCard title="Incidents by Status" subtitle="Current pipeline distribution">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, value }) => value > 0 ? `${name} (${value})` : ''}>
                                    {statusData.map((entry, i) => (
                                        <Cell key={i} fill={STATUS_COLORS[entry.name] || COLORS.gray} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <ChartCard title="AI Confidence by Type" subtitle="Average model confidence per disaster type">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getConfidenceByType()} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="confidence" name="Avg Confidence" fill={COLORS.indigo} radius={[0, 6, 6, 0]}>
                                    {getConfidenceByType().map((entry, i) => (
                                        <Cell key={i} fill={TYPE_COLORS[entry.name] || COLORS.indigo} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* ===== ROW 4: Resource Utilization ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <ChartCard title="Asset Fleet Status" subtitle="Current equipment deployment">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={assetData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={5} dataKey="value" label={({ name, value }) => value > 0 ? `${name} (${value})` : ''}>
                                    <Cell fill={COLORS.red} />
                                    <Cell fill={COLORS.green} />
                                    <Cell fill={COLORS.orange} />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <ChartCard title="Team Personnel Status" subtitle="Available vs deployed per team">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getTeamPersonnelData()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="Available" stackId="a" fill={COLORS.green} radius={[0, 0, 0, 0]} />
                                <Bar dataKey="Deployed" stackId="a" fill={COLORS.red} radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* ===== ROW 5: Department & Peak Hours ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <ChartCard title="Department Coverage" subtitle="Incidents within each department's radius">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getDeptCoverage()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="incidents" name="Incidents in Range" fill={COLORS.purple} radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>

                <ChartCard title="Peak Incident Hours" subtitle="When incidents occur (24h distribution)">
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getPeakHours()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Incidents" fill={COLORS.cyan} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </ChartCard>
            </div>

            {/* ===== ROW 6: Team Leaderboard ===== */}
            <ChartCard title="Team Performance Overview" subtitle="All response teams ranked by active deployments">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Rank</th>
                                <th className="text-left py-3 px-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Team</th>
                                <th className="text-left py-3 px-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Department</th>
                                <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Status</th>
                                <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Personnel</th>
                                <th className="text-center py-3 px-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Active Missions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getTeamLeaderboard().map((team, idx) => (
                                <tr key={team.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                            idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                            idx === 1 ? 'bg-gray-100 text-gray-600' :
                                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                                            'bg-white text-gray-400 border border-gray-200'
                                        }`}>{idx + 1}</span>
                                    </td>
                                    <td className="py-3 px-4 font-bold text-gray-800">{team.name}</td>
                                    <td className="py-3 px-4 text-gray-500">{team.department}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                            team.status === 'Deployed' ? 'bg-red-100 text-red-700' :
                                            team.status === 'Resting' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>{team.status}</span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="font-mono text-sm">
                                            <span className={team.available < team.personnel ? 'text-orange-600 font-bold' : 'text-green-600'}>{team.available}</span>
                                            <span className="text-gray-400">/{team.personnel}</span>
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {team.activeDeployments > 0 ? (
                                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{team.activeDeployments} active</span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">None</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {getTeamLeaderboard().length === 0 && (
                                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No teams found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ChartCard>
        </div>
    );
};

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3">
        <div className={`p-2.5 rounded-lg shadow-sm text-white ${color}`}>{icon}</div>
        <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</p>
            <p className="text-xl font-extrabold text-gray-800">{value}</p>
        </div>
    </div>
);

const ChartCard = ({ title, subtitle, children, className = '' }) => (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-700">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {children}
    </div>
);

export default Statistics;
