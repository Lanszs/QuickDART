import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video, Play, Square, RefreshCw, AlertCircle, Camera, Save, Loader2 } from 'lucide-react';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { toast } from 'react-toastify';
import { generateAIDescription } from './lib/generateAIDescription';
import { API_URL } from './config';

const socket = io(API_URL);

function LocationMarker({ position, setPosition }) {
    useMapEvents({
        click(e) { setPosition([e.latlng.lat, e.latlng.lng]); },
    });
    return position ? <Marker position={position} /> : null;
}

const DroneLive = ({ myTeam, currentTeamId, onReportSaved }) => {
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [stream, setStream] = useState(null);
    const [streaming, setStreaming] = useState(false);
    const [liveResult, setLiveResult] = useState(null);
    const [error, setError] = useState(null);
    const [saving, setSaving] = useState(false);
    const [position, setPosition] = useState(null);
    const [locationName, setLocationName] = useState('');

    const videoRef = useRef(null);
    const overlayRef = useRef(null);
    const intervalRef = useRef(null);

    const teamBase = (myTeam?.base_latitude && myTeam?.base_longitude)
        ? [parseFloat(myTeam.base_latitude), parseFloat(myTeam.base_longitude)]
        : [14.5995, 120.9842];

    useEffect(() => {
        if (!position) setPosition(teamBase);
    }, [myTeam]); // eslint-disable-line

    const refreshDevices = useCallback(async () => {
        try {
            // Trigger permission so labels populate
            const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
            tmp.getTracks().forEach(t => t.stop());
            const list = await navigator.mediaDevices.enumerateDevices();
            const cams = list.filter(d => d.kind === 'videoinput');
            setDevices(cams);
            if (cams.length && !selectedDeviceId) setSelectedDeviceId(cams[0].deviceId);
        } catch (e) {
            setError('Camera permission denied or unavailable.');
        }
    }, [selectedDeviceId]);

    useEffect(() => { refreshDevices(); }, []); // eslint-disable-line

    const startStream = async () => {
        setError(null);
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
                audio: false,
            });
            setStream(s);
            if (videoRef.current) videoRef.current.srcObject = s;
            setStreaming(true);
        } catch (e) {
            setError(`Could not start camera: ${e.message}`);
        }
    };

    const stopStream = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            setStream(null);
        }
        setStreaming(false);
        setLiveResult(null);
    }, [stream]);

    useEffect(() => () => stopStream(), []); // eslint-disable-line

    // Send frames every 500ms
    useEffect(() => {
        if (!streaming) return;
        const t = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                const v = videoRef.current;
                if (!v || v.readyState < 2) return;
                const canvas = document.createElement('canvas');
                canvas.width = v.videoWidth;
                canvas.height = v.videoHeight;
                canvas.getContext('2d').drawImage(v, 0, 0);
                const data = canvas.toDataURL('image/jpeg', 0.5);
                socket.emit('analyze_live_frame', { frame: data, view: 'aerial' });
            }, 500);
        }, 400);
        return () => {
            clearTimeout(t);
            if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        };
    }, [streaming]);

    const drawOverlay = useCallback((result) => {
        const canvas = overlayRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!result) return;

        const drawBox = (bbox, label, color) => {
            if (!bbox) return;
            const sx = bbox.x * canvas.width;
            const sy = bbox.y * canvas.height;
            const sw = bbox.w * canvas.width;
            const sh = bbox.h * canvas.height;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(sx, sy, sw, sh);
            ctx.font = 'bold 14px sans-serif';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(sx, sy - 22, tw + 10, 22);
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#fff';
            ctx.fillText(label, sx + 5, sy - 6);
        };

        const isNo = result.type === 'No Disaster';
        drawBox(result.type_bbox, `${result.type} ${result.type_confidence?.toFixed(0) || ''}%`,
            isNo ? '#22c55e' : '#ef4444');
        if (!isNo && result.damage_bbox) {
            drawBox(result.damage_bbox, `${result.damage} ${result.damage_confidence?.toFixed(0) || ''}%`, '#3b82f6');
        }
    }, []);

    useEffect(() => {
        const handler = (data) => { setLiveResult(data); drawOverlay(data); };
        socket.on('live_frame_result', handler);
        return () => socket.off('live_frame_result', handler);
    }, [drawOverlay]);

    const captureSnapshotReport = async () => {
        if (!liveResult || !videoRef.current) return;
        if (!position) { toast.error('Please drop a pin on the map first.'); return; }
        setSaving(true);
        try {
            const v = videoRef.current;
            const canvas = document.createElement('canvas');
            canvas.width = v.videoWidth;
            canvas.height = v.videoHeight;
            canvas.getContext('2d').drawImage(v, 0, 0);
            const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
            const fd = new FormData();
            fd.append('file', blob, `drone-live-${Date.now()}.jpg`);
            fd.append('view', 'aerial');
            const ar = await fetch(`${API_URL}/api/v1/analyze`, { method: 'POST', body: fd });
            if (!ar.ok) throw new Error('Analyze failed');
            const analysis = await ar.json();

            const body = {
                title: `Drone Live — ${analysis.type}`,
                description: generateAIDescription(analysis),
                status: 'Active',
                location: locationName || 'Drone live capture',
                latitude: position[0],
                longitude: position[1],
                damage_level: analysis.damage,
                image_url: analysis.image_url,
                disaster_type: analysis.type,
                confidence: analysis.confidence,
                claimed_by_team_id: currentTeamId,
                analysis_metadata: analysis,
            };
            const rr = await fetch(`${API_URL}/api/v1/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!rr.ok) throw new Error('Save failed');
            toast.success('Snapshot report saved.');
            onReportSaved && onReportSaved();
        } catch (e) {
            toast.error(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Video className="text-purple-600" /> Live Drone Analysis
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Stream the GT50 drone feed into QuickDART for real-time disaster classification.
                    </p>
                </div>
            </div>

            <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                    <Camera size={16} className="text-gray-600" />
                    <label className="text-sm font-semibold text-gray-700">Video Source</label>
                    <button onClick={refreshDevices} className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>
                <select
                    value={selectedDeviceId}
                    onChange={e => setSelectedDeviceId(e.target.value)}
                    disabled={streaming}
                    className="w-full border rounded px-3 py-2 text-sm"
                >
                    {devices.length === 0 && <option>No cameras detected</option>}
                    {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
                        </option>
                    ))}
                </select>
                {error && (
                    <div className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
                <div className="flex gap-2">
                    {!streaming ? (
                        <button onClick={startStream} disabled={!selectedDeviceId}
                            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                            <Play size={16} /> Start Live Analysis
                        </button>
                    ) : (
                        <button onClick={stopStream}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2">
                            <Square size={16} /> Stop
                        </button>
                    )}
                </div>
            </div>

            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: 360 }}>
                <video ref={videoRef} autoPlay playsInline muted
                    className="w-full h-auto max-h-[60vh] object-contain" />
                <canvas ref={overlayRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
                {liveResult && (
                    <div className={`absolute top-4 left-4 px-3 py-2 rounded-lg text-white text-xs font-bold shadow-lg ${liveResult.type === 'No Disaster' ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
                        <div>{liveResult.type} ({liveResult.type_confidence?.toFixed(0)}%)</div>
                        {liveResult.type !== 'No Disaster' && liveResult.damage && (
                            <div className="text-white/80 mt-0.5">{liveResult.damage} ({liveResult.damage_confidence?.toFixed(0)}%)</div>
                        )}
                    </div>
                )}
                {!streaming && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                        Stream inactive. Select a video source and click Start.
                    </div>
                )}
            </div>

            {streaming && (
                <div className="bg-white border rounded-lg p-4 space-y-3">
                    <div className="font-semibold text-gray-800 flex items-center gap-2">
                        <Save size={16} /> Capture Snapshot as Report
                    </div>
                    <p className="text-xs text-gray-600">
                        Pin the incident location, then capture the current frame as a formal report.
                    </p>
                    <input
                        type="text"
                        value={locationName}
                        onChange={e => setLocationName(e.target.value)}
                        placeholder="Location name (e.g., Barangay San Isidro)"
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                    <div className="h-56 rounded overflow-hidden border">
                        <MapContainer center={position || teamBase} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <LocationMarker position={position} setPosition={setPosition} />
                        </MapContainer>
                    </div>
                    <button
                        onClick={captureSnapshotReport}
                        disabled={saving || !liveResult}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Capture & Save Report'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DroneLive;
