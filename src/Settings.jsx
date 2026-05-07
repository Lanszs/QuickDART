import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Map, FileText, Bell, User, Save, RotateCcw, Monitor } from 'lucide-react';
import { toast } from 'react-toastify';
import { API_URL } from './config';

const DEFAULTS = {
    mapCenterLat: '14.7546',
    mapCenterLng: '120.9466',
    mapZoom: '13',
    showCoverageRadius: 'true',
    autoRefreshInterval: '30',
    toastEnabled: 'true',
    toastDuration: '5',
    defaultReportStatus: 'Pending',
    autoClearDays: '30',
};

const Settings = () => {
    const [settings, setSettings] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const loaded = {};
        Object.keys(DEFAULTS).forEach(key => {
            loaded[key] = localStorage.getItem(`quickdart_${key}`) || DEFAULTS[key];
        });
        setSettings(loaded);
    }, []);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const saveAll = () => {
        Object.entries(settings).forEach(([key, value]) => {
            localStorage.setItem(`quickdart_${key}`, value);
        });
        setHasChanges(false);
        toast.success("Settings saved");
    };

    const resetDefaults = () => {
        setSettings({ ...DEFAULTS });
        Object.keys(DEFAULTS).forEach(key => {
            localStorage.removeItem(`quickdart_${key}`);
        });
        setHasChanges(false);
        toast.info("Settings reset to defaults");
    };

    return (
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <SettingsIcon className="text-blue-600" /> Settings
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={resetDefaults} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            <RotateCcw size={14} /> Reset Defaults
                        </button>
                        <button onClick={saveAll} disabled={!hasChanges} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${hasChanges ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                            <Save size={14} /> Save Changes
                        </button>
                    </div>
                </div>

                {/* System */}
                <SettingsSection title="System" icon={<Monitor size={18} />}>
                    <SettingsRow label="Server URL" description="Backend API endpoint (read-only)">
                        <input type="text" value={API_URL} disabled className="w-64 p-2 border border-gray-200 rounded-lg text-sm bg-gray-100 text-gray-500" />
                    </SettingsRow>
                    <SettingsRow label="Auto-Refresh Interval" description="How often resource data refreshes (seconds)">
                        <div className="flex items-center gap-3">
                            <input type="range" min="10" max="120" step="10" value={settings.autoRefreshInterval || 30} onChange={(e) => updateSetting('autoRefreshInterval', e.target.value)} className="w-40" />
                            <span className="text-sm font-mono text-gray-700 w-12">{settings.autoRefreshInterval || 30}s</span>
                        </div>
                    </SettingsRow>
                </SettingsSection>

                {/* Notifications */}
                <SettingsSection title="Notifications" icon={<Bell size={18} />}>
                    <SettingsRow label="Toast Notifications" description="Show popup alerts for events">
                        <ToggleSwitch checked={settings.toastEnabled === 'true'} onChange={(v) => updateSetting('toastEnabled', v ? 'true' : 'false')} />
                    </SettingsRow>
                    <SettingsRow label="Auto-Dismiss Duration" description="Seconds before toasts disappear">
                        <div className="flex items-center gap-3">
                            <input type="range" min="3" max="15" step="1" value={settings.toastDuration || 5} onChange={(e) => updateSetting('toastDuration', e.target.value)} className="w-40" />
                            <span className="text-sm font-mono text-gray-700 w-12">{settings.toastDuration || 5}s</span>
                        </div>
                    </SettingsRow>
                </SettingsSection>

                {/* Map */}
                <SettingsSection title="Map Configuration" icon={<Map size={18} />}>
                    <SettingsRow label="Default Map Center" description="Latitude and longitude for the initial map view">
                        <div className="flex gap-2">
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">Latitude</label>
                                <input type="number" step="0.0001" value={settings.mapCenterLat || ''} onChange={(e) => updateSetting('mapCenterLat', e.target.value)} className="w-32 p-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-0.5">Longitude</label>
                                <input type="number" step="0.0001" value={settings.mapCenterLng || ''} onChange={(e) => updateSetting('mapCenterLng', e.target.value)} className="w-32 p-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                        </div>
                    </SettingsRow>
                    <SettingsRow label="Default Zoom Level" description="Map zoom level on load (10 = wide, 18 = close)">
                        <div className="flex items-center gap-3">
                            <input type="range" min="10" max="18" step="1" value={settings.mapZoom || 13} onChange={(e) => updateSetting('mapZoom', e.target.value)} className="w-40" />
                            <span className="text-sm font-mono text-gray-700 w-12">{settings.mapZoom || 13}</span>
                        </div>
                    </SettingsRow>
                    <SettingsRow label="Show Team Coverage Radius" description="Display coverage circles on the incident map">
                        <ToggleSwitch checked={settings.showCoverageRadius === 'true'} onChange={(v) => updateSetting('showCoverageRadius', v ? 'true' : 'false')} />
                    </SettingsRow>
                </SettingsSection>

                {/* Reports */}
                <SettingsSection title="Report Defaults" icon={<FileText size={18} />}>
                    <SettingsRow label="Default Report Status" description="Initial status for newly created reports">
                        <select value={settings.defaultReportStatus || 'Pending'} onChange={(e) => updateSetting('defaultReportStatus', e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm bg-white">
                            <option value="Pending">Pending</option>
                            <option value="Active">Active</option>
                        </select>
                    </SettingsRow>
                    <SettingsRow label="Auto-Hide Cleared Reports" description="Hide cleared reports older than this many days">
                        <div className="flex items-center gap-3">
                            <input type="number" min="1" max="365" value={settings.autoClearDays || 30} onChange={(e) => updateSetting('autoClearDays', e.target.value)} className="w-20 p-2 border border-gray-300 rounded-lg text-sm" />
                            <span className="text-sm text-gray-500">days</span>
                        </div>
                    </SettingsRow>
                </SettingsSection>

                {/* Account */}
                <SettingsSection title="Account" icon={<User size={18} />}>
                    <SettingsRow label="Session Started" description="When this browser session began">
                        <span className="text-sm text-gray-600 font-mono">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
                    </SettingsRow>
                    <SettingsRow label="Role" description="Your access level">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">Commander (Admin)</span>
                    </SettingsRow>
                </SettingsSection>
            </div>
        </div>
    );
};

const SettingsSection = ({ title, icon, children }) => (
    <div className="mb-6">
        <div className="flex items-center gap-2 mb-3 text-gray-700">
            <span className="text-blue-600">{icon}</span>
            <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {children}
        </div>
    </div>
);

const SettingsRow = ({ label, description, children }) => (
    <div className="flex items-center justify-between p-4">
        <div>
            <p className="text-sm font-medium text-gray-800">{label}</p>
            {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
        <div>{children}</div>
    </div>
);

const ToggleSwitch = ({ checked, onChange }) => (
    <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
);

export default Settings;
