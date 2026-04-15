import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
    Upload, Loader2, CheckCircle, XCircle, MapPin, Plane, AlertTriangle,
    Image as ImageIcon, Video, Trash2, Save, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'react-toastify';
import { generateAIDescription } from './lib/generateAIDescription';

// Default marker icon fix for Leaflet in Webpack
const droneMarkerIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const STATUSES = {
    queued: { label: 'Queued', color: 'bg-gray-100 text-gray-600', icon: Loader2 },
    uploading: { label: 'Uploading', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
    analyzing: { label: 'Analyzing', color: 'bg-indigo-100 text-indigo-700', icon: Loader2 },
    ready: { label: 'Ready to Save', color: 'bg-amber-100 text-amber-700', icon: Eye },
    saving: { label: 'Saving', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
    saved: { label: 'Saved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: XCircle },
};

// Click-to-place helper for the location picker map
const LocationPicker = ({ onPick, pinnedPosition }) => {
    useMapEvents({
        click(e) {
            onPick([e.latlng.lat, e.latlng.lng]);
        },
    });
    return pinnedPosition ? <Marker position={pinnedPosition} icon={droneMarkerIcon} /> : null;
};

const DroneUpload = ({ myTeam, currentTeamId, onReportSaved }) => {
    const [items, setItems] = useState([]); // { id, file, status, progress, result, error, location: {lat,lng,label}, expanded }
    const inputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);

    const teamBase = myTeam?.base_latitude && myTeam?.base_longitude
        ? [myTeam.base_latitude, myTeam.base_longitude]
        : [14.7546, 120.9466]; // Fallback to Intramuros-area default

    // Kick off any newly-added queued items automatically
    const itemsKey = items.map(i => i.id + i.status).join('|');
    useEffect(() => {
        const nextQueued = items.find(i => i.status === 'queued');
        if (nextQueued) {
            analyzeItem(nextQueued.id);
        }
    }, [itemsKey]); // eslint-disable-line

    const onFilesChosen = (fileList) => {
        const newItems = Array.from(fileList).map(file => ({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            file,
            status: 'queued',
            progress: 0,
            result: null,
            error: null,
            location: { lat: teamBase[0], lng: teamBase[1], label: myTeam?.department ? `${myTeam.department} Base Area` : 'Team Base Area' },
            expanded: true,
        }));
        setItems(prev => [...prev, ...newItems]);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files?.length) onFilesChosen(e.dataTransfer.files);
    };

    const analyzeItem = async (id) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'uploading' } : i));
        const item = items.find(i => i.id === id);
        if (!item) return;

        try {
            const formData = new FormData();
            formData.append('file', item.file);

            setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'analyzing' } : i));

            const response = await fetch('http://127.0.0.1:5000/api/v1/analyze', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Analysis failed (HTTP ${response.status})`);
            }

            const result = await response.json();
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'ready', result } : i));
        } catch (error) {
            console.error('Drone analyze error:', error);
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: error.message || 'Unknown error' } : i));
            toast.error(`Failed to analyze ${item.file.name}`);
        }
    };

    const saveItem = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item || !item.result) return;
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'saving' } : i));

        const payload = {
            title: `Drone Report: ${item.result.type}`,
            description: generateAIDescription(item.result),
            status: 'Active',
            location: item.location.label || 'Drone Survey Location',
            latitude: item.location.lat,
            longitude: item.location.lng,
            damage_level: item.result.damage,
            image_url: item.result.image_url ?? null,
            disaster_type: item.result.type,
            confidence: typeof item.result.confidence === 'number' ? item.result.confidence : parseFloat(item.result.confidence),
            analysis_metadata: JSON.stringify(item.result),
            claimed_by_team_id: currentTeamId ? parseInt(currentTeamId) : null,
        };

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!response.ok) throw new Error(`Save failed (HTTP ${response.status})`);
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'saved' } : i));
            toast.success(`Report saved: ${item.result.type}`);
            onReportSaved?.();
        } catch (error) {
            console.error('Save report error:', error);
            setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'error', error: error.message } : i));
            toast.error(`Failed to save report for ${item.file.name}`);
        }
    };

    const saveAllReady = async () => {
        const ready = items.filter(i => i.status === 'ready');
        for (const i of ready) {
            // Sequential to avoid hammering the backend
            // eslint-disable-next-line no-await-in-loop
            await saveItem(i.id);
        }
    };

    const removeItem = (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const retryItem = (id) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'queued', error: null } : i));
    };

    const updateLocation = (id, lat, lng) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, location: { ...i.location, lat, lng } } : i));
    };

    const updateLocationLabel = (id, label) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, location: { ...i.location, label } } : i));
    };

    const toggleExpand = (id) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, expanded: !i.expanded } : i));
    };

    const readyCount = items.filter(i => i.status === 'ready').length;
    const savedCount = items.filter(i => i.status === 'saved').length;

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Plane className="text-blue-600" /> Drone Upload
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Bulk upload aerial footage from your drone. Each file is analyzed and turned into a report.</p>
                </div>
                {readyCount > 0 && (
                    <button
                        onClick={saveAllReady}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-sm flex items-center gap-2"
                    >
                        <Save size={16} /> Save All Ready ({readyCount})
                    </button>
                )}
            </div>

            {/* ── Drop zone ── */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
                }`}
            >
                <Upload size={36} className="mx-auto text-gray-400 mb-3" />
                <p className="text-base font-semibold text-gray-700">Drop drone footage here or click to select</p>
                <p className="text-sm text-gray-400 mt-1">Supports images (jpg, png) and videos (mp4, mov, webm). Multiple files allowed.</p>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && onFilesChosen(e.target.files)}
                />
            </div>

            {/* ── GPS notice ── */}
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold">GPS not embedded:</span> GT50 footage does not include location metadata. For each analyzed file, pin the incident location on the map below before saving.
                </div>
            </div>

            {/* ── Items queue ── */}
            {items.length > 0 && (
                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Queue ({items.length})</h3>
                        {savedCount > 0 && (
                            <span className="text-xs text-green-700 font-semibold bg-green-50 px-2 py-1 rounded-full">
                                {savedCount} saved
                            </span>
                        )}
                    </div>

                    {items.map(item => {
                        const StatusIcon = STATUSES[item.status]?.icon || Loader2;
                        const statusCfg = STATUSES[item.status] || STATUSES.queued;
                        const isVideo = item.file.type.startsWith('video/');
                        const working = ['uploading', 'analyzing', 'saving'].includes(item.status);

                        return (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Header row */}
                                <div className="flex items-center gap-3 p-4">
                                    <div className="p-2 bg-gray-100 rounded-lg text-gray-500 flex-shrink-0">
                                        {isVideo ? <Video size={20} /> : <ImageIcon size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-gray-800 truncate">{item.file.name}</p>
                                        <p className="text-xs text-gray-400">{(item.file.size / 1024 / 1024).toFixed(1)} MB</p>
                                    </div>

                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`}>
                                        <StatusIcon size={12} className={working ? 'animate-spin' : ''} />
                                        {statusCfg.label}
                                    </span>

                                    {item.result && (
                                        <button onClick={() => toggleExpand(item.id)} className="p-2 text-gray-400 hover:text-gray-700" title={item.expanded ? 'Collapse' : 'Expand'}>
                                            {item.expanded ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    )}
                                    {item.status === 'error' && (
                                        <button onClick={() => retryItem(item.id)} className="p-2 text-gray-400 hover:text-blue-600" title="Retry">
                                            <RefreshCw size={16} />
                                        </button>
                                    )}
                                    <button onClick={() => removeItem(item.id)} disabled={working} className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-40" title="Remove">
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* Error line */}
                                {item.status === 'error' && item.error && (
                                    <div className="px-4 pb-4 text-sm text-red-600 border-t border-red-100 bg-red-50 pt-3">
                                        {item.error}
                                    </div>
                                )}

                                {/* Ready / saved expanded section */}
                                {item.result && item.expanded && (
                                    <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                                        {/* AI Classification */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <ResultTile label="Disaster Type" value={item.result.type} tone="blue" />
                                            <ResultTile label="Damage Level" value={item.result.damage} tone="orange" />
                                            <ResultTile label="AI Confidence" value={`${Math.round(item.result.confidence || 0)}%`} tone="purple" />
                                        </div>

                                        {/* AI Description */}
                                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">AI Description</p>
                                            <p className="text-sm text-gray-700 leading-relaxed">{generateAIDescription(item.result)}</p>
                                        </div>

                                        {/* Location Picker */}
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                                <MapPin size={12} /> Incident Location
                                            </p>
                                            <input
                                                type="text"
                                                value={item.location.label}
                                                onChange={(e) => updateLocationLabel(item.id, e.target.value)}
                                                placeholder="Location name (e.g. Barangay 45, Main Street)"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                            />
                                            <div className="h-56 rounded-lg overflow-hidden border border-gray-200">
                                                <MapContainer
                                                    center={[item.location.lat, item.location.lng]}
                                                    zoom={15}
                                                    scrollWheelZoom={true}
                                                    style={{ height: '100%', width: '100%' }}
                                                >
                                                    <TileLayer
                                                        attribution='&copy; OpenStreetMap'
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                    />
                                                    <LocationPicker
                                                        onPick={([lat, lng]) => updateLocation(item.id, lat, lng)}
                                                        pinnedPosition={[item.location.lat, item.location.lng]}
                                                    />
                                                </MapContainer>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1.5">Click on the map to move the pin. Current: {item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}</p>
                                        </div>

                                        {/* Save */}
                                        {item.status === 'ready' && (
                                            <button
                                                onClick={() => saveItem(item.id)}
                                                className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <Save size={16} /> Save as Report
                                            </button>
                                        )}
                                        {item.status === 'saved' && (
                                            <div className="w-full py-2.5 bg-green-50 text-green-700 font-bold rounded-lg flex items-center justify-center gap-2 border border-green-200">
                                                <CheckCircle size={16} /> Report Saved
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const ResultTile = ({ label, value, tone }) => {
    const tones = {
        blue: 'bg-blue-50 border-blue-200 text-blue-800',
        orange: 'bg-orange-50 border-orange-200 text-orange-800',
        purple: 'bg-purple-50 border-purple-200 text-purple-800',
    };
    return (
        <div className={`p-3 rounded-lg border ${tones[tone] || tones.blue}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
            <p className="text-lg font-extrabold mt-0.5">{value || '—'}</p>
        </div>
    );
};

export default DroneUpload;
