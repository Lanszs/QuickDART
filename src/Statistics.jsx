import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
    Activity, TrendingUp, AlertTriangle,
    CheckCircle, Users, Zap, BarChart3, ShieldAlert, Layers
} from 'lucide-react';

// ── Color system: consistent semantic colors used across all visualizations ──

const STATUS_COLORS = {
    Pending: '#F97316', Active: '#3B82F6', Critical: '#EF4444', Cleared: '#22C55E'
};

const DAMAGE_COLORS = {
    Destroyed: '#EF4444', Major: '#F97316', Minor: '#EAB308', 'No Damage': '#22C55E', Pending: '#9CA3AF'
};

const TYPE_COLORS = {
    Earthquake: '#8B5CF6', Fire: '#EF4444', Flood: '#3B82F6', 'No Disaster': '#22C55E'
};

const FALLBACK_COLORS = ['#6366F1', '#EC4899', '#06B6D4', '#6B7280'];

// ── Custom tooltip for consistent formatting across charts ──

const ChartTooltip = ({ active, payload, label, valueLabel = 'Count' }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 text-sm">
            {label && <p className="font-semibold text-gray-700 mb-1.5 border-b border-gray-100 pb-1.5">{label}</p>}
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="text-gray-600">{entry.name || valueLabel}:</span>
                    <span className="font-bold text-gray-800 ml-auto">{entry.value}</span>
                </div>
            ))}
        </div>
    );
};

const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, value, payload: data } = payload[0];
    return (
        <div className="bg-white border border-gray-200 shadow-lg rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: data.fill || data.color }} />
                <span className="font-semibold text-gray-700">{name}</span>
            </div>
            <p className="text-gray-800 font-bold mt-1">{value} report{value !== 1 ? 's' : ''}</p>
        </div>
    );
};

// ── Empty state shown when a chart has no data ──

const EmptyChart = ({ message = 'No data available' }) => (
    <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <Layers size={32} className="mb-2 opacity-40" />
        <p className="text-sm font-medium">{message}</p>
    </div>
);

// ── Main component ──

const Statistics = ({ reports, teams }) => {

    // ── Data processing ──

    const extractType = (report) => {
        if (report.disaster_type) return report.disaster_type;
        const match = report.title?.split(':')[1]?.trim();
        return match || 'Unknown';
    };

    // KPI values
    const activeIncidents = reports.filter(r => r.status === 'Active' || r.status === 'Critical').length;
    const criticalCount = reports.filter(r => r.status === 'Critical').length;
    const clearedIncidents = reports.filter(r => r.status === 'Cleared').length;
    const totalPersonnel = (teams || []).reduce((acc, t) => acc + (t.personnel_count || 0), 0);
    const availablePersonnel = (teams || []).reduce((acc, t) => acc + (t.available_personnel ?? t.personnel_count ?? 0), 0);
    const deployedPersonnel = totalPersonnel - availablePersonnel;
    const highConfReports = reports.filter(r => r.confidence && r.confidence > 70).length;
    const aiDetectionRate = reports.length > 0 ? Math.round((highConfReports / reports.length) * 100) : 0;
    const severeReports = reports.filter(r => r.damage_level === 'Destroyed' || r.damage_level === 'Major').length;

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
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count, fill: DAMAGE_COLORS[name] }))
            .filter(d => d.count > 0);
    };

    // 3. Disaster Type Breakdown
    const getTypeData = () => {
        const counts = {};
        reports.forEach(r => {
            const type = extractType(r);
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value, fill: TYPE_COLORS[name] || FALLBACK_COLORS[Object.keys(counts).indexOf(name) % 4] }))
            .sort((a, b) => b.value - a.value);
    };

    // 4. Team Personnel Chart
    const getTeamPersonnelData = () => {
        return (teams || []).map(t => ({
            name: t.name.length > 14 ? t.name.substring(0, 14) + '...' : t.name,
            fullName: t.name,
            Available: t.available_personnel ?? t.personnel_count ?? 0,
            Deployed: (t.personnel_count || 0) - (t.available_personnel ?? t.personnel_count ?? 0)
        }));
    };

    // 5. Department Incident Coverage
    const getDeptCoverage = () => {
        const haversine = (lat1, lon1, lat2, lon2) => {
            const toRad = x => (x * Math.PI) / 180;
            const R = 6371;
            const dLat = toRad(lat2 - lat1);
            const dLon = toRad(lon2 - lon1);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
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

        return Object.entries(deptCounts)
            .map(([name, ids]) => ({ name, incidents: ids.size }))
            .sort((a, b) => b.incidents - a.incidents);
    };

    // 6. Team Readiness
    const getTeamReadiness = () => {
        return (teams || []).map(t => ({
            id: t.id,
            name: t.name,
            department: t.department || '—',
            status: t.status || 'Available',
            personnel: t.personnel_count || 0,
            available: t.available_personnel ?? t.personnel_count ?? 0,
            activeDeployments: t.active_deployments?.length || 0,
        })).sort((a, b) => b.activeDeployments - a.activeDeployments || b.personnel - a.personnel);
    };

    const timelineData = getIncidentsOverTime();
    const damageData = getDamageData();
    const typeData = getTypeData();
    const personnelData = getTeamPersonnelData();
    const coverageData = getDeptCoverage();
    const readinessData = getTeamReadiness();

    const noReports = reports.length === 0;
    const noTeams = !teams || teams.length === 0;

    // ── Render ──

    return (
        <div className="p-6 lg:p-8 h-full overflow-y-auto bg-gray-50" role="main" aria-label="Operational Analytics Dashboard">

            {/* ── Page header ── */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2.5">
                    <TrendingUp className="text-blue-600" size={24} />
                    Operational Analytics
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                    Real-time overview of incidents, damage assessments, and team readiness.
                </p>
            </div>

            {/* ════════════════════════════════════════════════════
                SECTION 1: SITUATION OVERVIEW
                KPIs + timeline — answer "what is happening right now?"
            ════════════════════════════════════════════════════ */}

            <SectionHeader title="Situation Overview" />

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" role="list" aria-label="Key performance indicators">
                <StatCard
                    title="Total Incidents"
                    value={reports.length}
                    icon={<BarChart3 size={20} />}
                    color="bg-blue-500"
                    subtitle={`${activeIncidents} active`}
                />
                <StatCard
                    title="Critical"
                    value={criticalCount}
                    icon={<ShieldAlert size={20} />}
                    color="bg-red-500"
                    subtitle={criticalCount > 0 ? 'Needs attention' : 'None'}
                    highlight={criticalCount > 0}
                />
                <StatCard
                    title="Severe Damage"
                    value={severeReports}
                    icon={<AlertTriangle size={20} />}
                    color="bg-orange-500"
                    subtitle="Major + Destroyed"
                />
                <StatCard
                    title="Cleared"
                    value={clearedIncidents}
                    icon={<CheckCircle size={20} />}
                    color="bg-green-500"
                    subtitle={reports.length > 0 ? `${Math.round((clearedIncidents / reports.length) * 100)}% resolved` : '—'}
                />
            </div>

            {/* ── Incident Timeline (full width — primary temporal context) ── */}
            <ChartCard title="Incident Timeline" subtitle="Daily incident volume by status" className="mb-8">
                <div className="h-72">
                    {timelineData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={35} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                                <Area type="monotone" dataKey="Critical" stackId="1" stroke={STATUS_COLORS.Critical} fill={STATUS_COLORS.Critical} fillOpacity={0.5} />
                                <Area type="monotone" dataKey="Active" stackId="1" stroke={STATUS_COLORS.Active} fill={STATUS_COLORS.Active} fillOpacity={0.5} />
                                <Area type="monotone" dataKey="Pending" stackId="1" stroke={STATUS_COLORS.Pending} fill={STATUS_COLORS.Pending} fillOpacity={0.5} />
                                <Area type="monotone" dataKey="Cleared" stackId="1" stroke={STATUS_COLORS.Cleared} fill={STATUS_COLORS.Cleared} fillOpacity={0.5} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <EmptyChart message="No incident data to chart yet" />
                    )}
                </div>
            </ChartCard>

            {/* ════════════════════════════════════════════════════
                SECTION 2: DAMAGE & CLASSIFICATION
                Answer "what kind of damage and disasters are we dealing with?"
            ════════════════════════════════════════════════════ */}

            <SectionHeader title="Damage & Classification" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* ── Damage Severity ── */}
                <ChartCard title="Damage Severity" subtitle="Distribution of assessed damage levels">
                    <div className="h-72">
                        {damageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={damageData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={35} />
                                    <Tooltip content={<ChartTooltip valueLabel="Reports" />} />
                                    <Bar dataKey="count" name="Reports" radius={[6, 6, 0, 0]}>
                                        {damageData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyChart message="No damage assessments recorded" />
                        )}
                    </div>
                </ChartCard>

                {/* ── Disaster Types with legend ── */}
                <ChartCard title="Disaster Types" subtitle="Classification breakdown">
                    <div className="h-72 flex items-center">
                        {typeData.length > 0 ? (
                            <div className="w-full flex items-center gap-4">
                                <div className="flex-1">
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={typeData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={85}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {typeData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<PieTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex flex-col gap-2.5 min-w-[130px]" role="list" aria-label="Disaster type legend">
                                    {typeData.map((entry) => (
                                        <div key={entry.name} className="flex items-center gap-2.5" role="listitem">
                                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill }} />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-700 leading-tight">{entry.name}</span>
                                                <span className="text-xs text-gray-400">{entry.value} report{entry.value !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <EmptyChart message="No disaster classifications yet" />
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* ════════════════════════════════════════════════════
                SECTION 3: RESOURCE STATUS
                Answer "what resources do we have and where?"
            ════════════════════════════════════════════════════ */}

            <SectionHeader title="Resource Status" />

            {/* ── Resource KPI row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6" role="list" aria-label="Resource metrics">
                <StatCard
                    title="Personnel Deployed"
                    value={`${deployedPersonnel} / ${totalPersonnel}`}
                    icon={<Users size={20} />}
                    color="bg-purple-500"
                    subtitle={totalPersonnel > 0 ? `${Math.round((deployedPersonnel / totalPersonnel) * 100)}% utilization` : '—'}
                />
                <StatCard
                    title="Teams"
                    value={(teams || []).length}
                    icon={<Activity size={20} />}
                    color="bg-indigo-500"
                    subtitle={`${(teams || []).filter(t => t.status === 'Deployed').length} deployed`}
                />
                <StatCard
                    title="AI Detection Rate"
                    value={`${aiDetectionRate}%`}
                    icon={<Zap size={20} />}
                    color="bg-cyan-500"
                    subtitle={`${highConfReports} of ${reports.length} above 70%`}
                />
            </div>

            {/* ── Team Personnel + Department Coverage ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <ChartCard title="Team Personnel Status" subtitle="Available vs deployed per team">
                    <div className="h-72">
                        {personnelData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={personnelData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={35} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                                    <Bar dataKey="Available" stackId="a" fill="#22C55E" />
                                    <Bar dataKey="Deployed" stackId="a" fill="#EF4444" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyChart message="No teams registered" />
                        )}
                    </div>
                </ChartCard>

                <ChartCard title="Department Coverage" subtitle="Incidents within each department's coverage radius">
                    <div className="h-72">
                        {coverageData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={coverageData} barCategoryGap="20%">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#6B7280' }} axisLine={false} tickLine={false} width={35} />
                                    <Tooltip content={<ChartTooltip valueLabel="Incidents in Range" />} />
                                    <Bar dataKey="incidents" name="Incidents in Range" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyChart message="No department coverage data" />
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* ── Team Readiness Table ── */}
            <ChartCard title="Team Readiness" subtitle="Current status and capacity of all response teams" className="mb-6">
                <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm" role="table" aria-label="Team readiness overview">
                        <thead>
                            <tr className="border-b-2 border-gray-200">
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider" scope="col">#</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider" scope="col">Team</th>
                                <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell" scope="col">Department</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider" scope="col">Status</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider" scope="col">Personnel</th>
                                <th className="text-center py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider" scope="col">Active Missions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {readinessData.map((team, idx) => (
                                <tr key={team.id} className="border-b border-gray-100 hover:bg-blue-50/40 transition-colors">
                                    <td className="py-3.5 px-4 text-gray-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="py-3.5 px-4 font-semibold text-gray-800">{team.name}</td>
                                    <td className="py-3.5 px-4 text-gray-500 hidden sm:table-cell">{team.department}</td>
                                    <td className="py-3.5 px-4 text-center">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            team.status === 'Deployed' ? 'bg-blue-100 text-blue-700' :
                                            team.status === 'Resting' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>{team.status}</span>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        <div className="inline-flex items-center gap-1.5">
                                            <span className="font-mono text-sm">
                                                <span className={team.available < team.personnel ? 'text-orange-600 font-bold' : 'text-green-600 font-semibold'}>{team.available}</span>
                                                <span className="text-gray-400"> / {team.personnel}</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                        {team.activeDeployments > 0 ? (
                                            <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-xs font-semibold">
                                                <Activity size={12} /> {team.activeDeployments}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 text-xs">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {readinessData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-gray-400">
                                        <Users size={28} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">No teams registered yet</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ChartCard>
        </div>
    );
};

// ── Reusable components ──

const SectionHeader = ({ title }) => (
    <div className="flex items-center gap-3 mb-4 mt-2">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{title}</h3>
        <div className="flex-1 border-t border-gray-200" />
    </div>
);

const StatCard = ({ title, value, icon, color, subtitle, highlight = false }) => (
    <div
        className={`bg-white p-4 rounded-xl border transition-shadow hover:shadow-md ${highlight ? 'border-red-200 shadow-sm shadow-red-100' : 'border-gray-200 shadow-sm'}`}
        role="listitem"
        aria-label={`${title}: ${value}`}
    >
        <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg text-white flex-shrink-0 ${color}`} aria-hidden="true">{icon}</div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-tight">{title}</p>
                <p className="text-2xl font-extrabold text-gray-800 leading-tight mt-0.5">{value}</p>
                {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
            </div>
        </div>
    </div>
);

const ChartCard = ({ title, subtitle, children, className = '' }) => (
    <div className={`bg-white p-5 lg:p-6 rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <div className="mb-4">
            <h3 className="text-base font-bold text-gray-700">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {children}
    </div>
);

export default Statistics;
