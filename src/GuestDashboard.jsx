import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, MapPin, AlertTriangle, Send, FileText, XCircle, CheckCircle, ArrowLeft, Activity, Clock, Loader2, Search, AlertCircle, Video, X, Circle, StopCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { generateAIDescription } from './lib/generateAIDescription';
import { API_URL } from './config';

const socket = io(API_URL);

const GuestDashboard = ({ onBack }) => {
    const [step, setStep] = useState(1); 
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [locating, setLocating] = useState(false);
    const [time, setTime] = useState(new Date());
    
    // Data State
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    
    // --- GEOCODING STATE ---
    const [isSearching, setIsSearching] = useState(false);
    const [locationSuggestions, setLocationSuggestions] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(''); 
    
    // --- VALIDATION STATE ---
    const [locationError, setLocationError] = useState(false);

    // --- CAMERA STATE ---
    const [showCamera, setShowCamera] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const cameraVideoRef = useRef(null);
    const captureCanvasRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);

    // --- LIVE ANALYSIS STATE ---
    const [liveResult, setLiveResult] = useState(null);
    const overlayCanvasRef = useRef(null);
    const liveIntervalRef = useRef(null);
    const resultCanvasRef = useRef(null);
    const resultImageRef = useRef(null);

    const isCameraSupported = !!(navigator.mediaDevices?.getUserMedia);

    // --- ANALYSIS PROGRESS STATE ---
    const [analysisProgress, setAnalysisProgress] = useState(null);

    useEffect(() => {
        socket.on('analysis_progress', (data) => {
            setAnalysisProgress(data);
        });
        return () => socket.off('analysis_progress');
    }, []);

    // Form State
    const [formData, setFormData] = useState({
        location: '', 
        description: '',
        latitude: null,
        longitude: null
    });

    // Clock Timer
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // --- AUTOMATIC LOCATION TRIGGER ---
    useEffect(() => {
        if (step === 2) {
            triggerAutoLocation();
        }
    }, [step]);

    const triggerAutoLocation = () => {
        if (!navigator.geolocation) return;

        setLocating(true);
        setFormData(prev => ({ ...prev, location: "📍 Requesting permission..." }));
        setLocationError(false); // Clear error if we are auto-detecting

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                setFormData(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng
                }));

                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    const data = await response.json();
                    
                    if (data && data.display_name) {
                        const address = data.display_name.split(',').slice(0, 4).join(',');
                        setFormData(prev => ({ ...prev, location: address }));
                        setSelectedAddress(address);
                    } else {
                        setFormData(prev => ({ ...prev, location: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
                    }
                } catch (error) {
                    setFormData(prev => ({ ...prev, location: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
                } finally {
                    setLocating(false);
                }
            },
            (error) => {
                console.error("Location denied or error:", error);
                setFormData(prev => ({ ...prev, location: "" })); 
                setLocating(false);
            }
        );
    };

    // --- SMART SEARCH LOGIC ---
    useEffect(() => {
        if (!formData.location || formData.location === selectedAddress || formData.location.includes("GPS") || formData.location.includes("Requesting")) {
            setLocationSuggestions([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const query = `${formData.location}, Philippines`;
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const results = await response.json();
                setLocationSuggestions(results);
            } catch (error) {
                console.error("Geocoding error:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [formData.location, selectedAddress]);

    const handleSelectLocation = (location) => {
        const shortName = location.display_name.split(',')[0]; 
        
        setFormData(prev => ({
            ...prev,
            location: shortName,
            latitude: parseFloat(location.lat),
            longitude: parseFloat(location.lon)
        }));
        
        setSelectedAddress(shortName);
        setLocationSuggestions([]);   
        setLocationError(false); // Clear error on select
    };

    const handleLocationInput = (e) => {
        setFormData({ ...formData, location: e.target.value });
        setSelectedAddress(''); 
        if (e.target.value.trim() !== '') {
            setLocationError(false); // Clear error if user starts typing
        }
    };

    // --- CAMERA FUNCTIONS ---
    const openCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false
            });
            setCameraStream(stream);
            setShowCamera(true);
            // Attach stream to video element after render
            setTimeout(() => {
                if (cameraVideoRef.current) {
                    cameraVideoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            console.error('Camera access error:', err);
            if (err.name === 'NotAllowedError') {
                alert('Camera permission denied. Please allow camera access and try again.');
            } else if (err.name === 'NotFoundError') {
                alert('No camera found on this device.');
            } else {
                alert('Could not access camera: ' + err.message);
            }
        }
    };

    const closeCamera = useCallback(() => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        // Stop live analysis streaming
        if (liveIntervalRef.current) {
            clearInterval(liveIntervalRef.current);
            liveIntervalRef.current = null;
        }
        setLiveResult(null);
        setShowCamera(false);
        setIsRecording(false);
        setRecordingTime(0);
        recordedChunksRef.current = [];
    }, [cameraStream]);

    const analyzeFile = async (file) => {
        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setSelectedFile(file);
        setUploading(true);
        setAnalysisProgress(null);

        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/api/v1/analyze`, {
                method: 'POST',
                body: uploadData,
            });

            if (response.ok) {
                const result = await response.json();
                setAnalysisResult(result);
                setStep(2);
            } else {
                const err = await response.json();
                alert(`Analysis Failed: ${err.error || 'Server Error'}`);
                setStep(1);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Network Error: Could not connect to server.");
        } finally {
            setUploading(false);
            setAnalysisProgress(null);
        }
    };

    const capturePhoto = () => {
        const video = cameraVideoRef.current;
        const canvas = captureCanvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], `camera_capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            closeCamera();
            analyzeFile(file);
        }, 'image/jpeg', 0.9);
    };

    const startRecording = () => {
        if (!cameraStream) return;

        recordedChunksRef.current = [];
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : MediaRecorder.isTypeSupported('video/webm')
                ? 'video/webm'
                : '';

        const recorder = new MediaRecorder(cameraStream, mimeType ? { mimeType } : {});

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                recordedChunksRef.current.push(e.data);
            }
        };

        recorder.onstop = () => {
            const chunks = recordedChunksRef.current;
            if (chunks.length === 0) return;

            const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            const file = new File([blob], `camera_recording_${Date.now()}.${ext}`, { type: blob.type });
            closeCamera();
            analyzeFile(file);
        };

        mediaRecorderRef.current = recorder;
        recorder.start(1000); // Collect data every second
        setIsRecording(true);
        setRecordingTime(0);

        // Timer for recording duration display
        recordingTimerRef.current = setInterval(() => {
            setRecordingTime(prev => {
                if (prev >= 29) {
                    // Auto-stop at 30 seconds
                    stopRecording();
                    return 30;
                }
                return prev + 1;
            });
        }, 1000);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }
        setIsRecording(false);
    };

    // --- LIVE ANALYSIS: stream frames to backend ---
    const startLiveStreaming = useCallback(() => {
        if (liveIntervalRef.current) return;
        liveIntervalRef.current = setInterval(() => {
            const video = cameraVideoRef.current;
            if (!video || video.readyState < 2) return;

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            const base64Data = canvas.toDataURL('image/jpeg', 0.5);
            socket.emit('analyze_live_frame', { frame: base64Data });
        }, 500);
    }, []);

    const stopLiveStreaming = useCallback(() => {
        if (liveIntervalRef.current) {
            clearInterval(liveIntervalRef.current);
            liveIntervalRef.current = null;
        }
        setLiveResult(null);
    }, []);

    // Draw bounding boxes on overlay canvas
    const drawLiveOverlay = useCallback((result) => {
        const canvas = overlayCanvasRef.current;
        const video = cameraVideoRef.current;
        if (!canvas || !video) return;

        // Match canvas to video display size
        const rect = video.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!result) return;

        const drawBox = (bbox, label, color) => {
            if (!bbox || typeof bbox !== 'object') return;
            const sx = bbox.x * canvas.width;
            const sy = bbox.y * canvas.height;
            const sw = bbox.w * canvas.width;
            const sh = bbox.h * canvas.height;

            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(sx, sy, sw, sh);

            // Label background
            ctx.font = 'bold 14px sans-serif';
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(sx, sy - 22, textWidth + 10, 22);
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#fff';
            ctx.fillText(label, sx + 5, sy - 6);
        };

        const isNoDisaster = result.type === 'No Disaster';
        const typeColor = isNoDisaster ? '#22c55e' : '#ef4444';
        const typeLabel = `${result.type} ${result.type_confidence?.toFixed(0) || ''}%`;

        drawBox(result.type_bbox, typeLabel, typeColor);

        if (!isNoDisaster && result.damage_bbox) {
            const damageLabel = `${result.damage} ${result.damage_confidence?.toFixed(0) || ''}%`;
            drawBox(result.damage_bbox, damageLabel, '#3b82f6');
        }
    }, []);

    // Socket listener for live frame results
    useEffect(() => {
        const handleLiveResult = (data) => {
            setLiveResult(data);
            drawLiveOverlay(data);
        };
        socket.on('live_frame_result', handleLiveResult);
        return () => socket.off('live_frame_result', handleLiveResult);
    }, [drawLiveOverlay]);

    // Draw bboxes on the after-capture result preview
    const drawResultBboxes = useCallback(() => {
        const canvas = resultCanvasRef.current;
        const img = resultImageRef.current;
        if (!canvas || !img || !analysisResult) return;

        canvas.width = img.clientWidth;
        canvas.height = img.clientHeight;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const drawBox = (bbox, label, color) => {
            if (!bbox || typeof bbox !== 'object') return;
            const sx = bbox.x * canvas.width;
            const sy = bbox.y * canvas.height;
            const sw = bbox.w * canvas.width;
            const sh = bbox.h * canvas.height;

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(sx, sy, sw, sh);

            ctx.font = 'bold 11px sans-serif';
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.8;
            ctx.fillRect(sx, sy - 18, textWidth + 8, 18);
            ctx.globalAlpha = 1.0;
            ctx.fillStyle = '#fff';
            ctx.fillText(label, sx + 4, sy - 5);
        };

        const isNoDisaster = analysisResult.type === 'No Disaster';
        const typeColor = isNoDisaster ? '#22c55e' : '#ef4444';
        const typeConf = typeof analysisResult.confidence === 'number' ? analysisResult.confidence.toFixed(0) : '';
        drawBox(analysisResult.type_bbox, `${analysisResult.type} ${typeConf}%`, typeColor);

        if (!isNoDisaster && analysisResult.damage_bbox) {
            const dmgConf = typeof analysisResult.damage_confidence === 'number' ? analysisResult.damage_confidence.toFixed(0) : '';
            drawBox(analysisResult.damage_bbox, `${analysisResult.damage} ${dmgConf}%`, '#3b82f6');
        }
    }, [analysisResult]);

    // Re-draw result bboxes when analysis result changes or image loads
    useEffect(() => {
        if (step === 2 && analysisResult) {
            // Small delay to let image render
            const timer = setTimeout(drawResultBboxes, 200);
            return () => clearTimeout(timer);
        }
    }, [step, analysisResult, drawResultBboxes]);

    // Start/stop live streaming when camera opens/closes
    useEffect(() => {
        if (showCamera && cameraStream) {
            // Small delay to let video element attach
            const timer = setTimeout(() => startLiveStreaming(), 300);
            return () => clearTimeout(timer);
        } else {
            stopLiveStreaming();
        }
    }, [showCamera, cameraStream, startLiveStreaming, stopLiveStreaming]);

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            stopLiveStreaming();
        };
    }, [cameraStream, stopLiveStreaming]);

    // --- 1. HANDLE IMAGE UPLOAD & ANALYZE ---
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        analyzeFile(file);
    };

    // --- 3. SUBMIT REPORT (WITH VALIDATION) ---
    const handleSubmit = async () => {
        if (!analysisResult) return;

        // --- VALIDATION CHECK ---
        if (!formData.location.trim() || formData.location.includes("Requesting")) {
            setLocationError(true);
            return; // STOP HERE if location is invalid
        }
        // ------------------------

        setSubmitting(true);

        const newReport = {
            title: `Public Report: ${analysisResult.type}`,
            description: formData.description || generateAIDescription(analysisResult),
            status: 'Pending',
            location: formData.location, // Must be valid now
            latitude: formData.latitude || 14.7546,
            longitude: formData.longitude || 120.9466,
            damage_level: analysisResult.damage,
            image_url: analysisResult.image_url,
            disaster_type: analysisResult.type,
            confidence: typeof analysisResult.confidence === 'number' ? analysisResult.confidence : parseFloat(analysisResult.confidence),
            analysis_metadata: JSON.stringify(analysisResult)
        };

        console.group("🚀 [GUEST] Submitting Report");
        console.log("📍 Location Name:", newReport.location);
        console.log("🌎 Coordinates:", newReport.latitude, ",", newReport.longitude);
        console.log("📦 Full Payload:", newReport);
        console.groupEnd();

        try {
            const response = await fetch(`${API_URL}/api/v1/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newReport)
            });

            if (response.ok) {
                setStep(3); 
            } else {
                alert("Failed to submit report. Please try again.");
            }
        } catch (error) {
            console.error("Submission error:", error);
            alert("Network error. Please check your connection.");
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setStep(1);
        setSelectedFile(null);
        setPreviewUrl(null);
        setAnalysisResult(null);
        setFormData({ location: '', description: '', latitude: null, longitude: null });
        setLocationSuggestions([]);
        setSelectedAddress('');
        setLocationError(false);
    };

    const getDamageText = (text) => {
        if (!text) return "Unknown";
        if (text.toLowerCase().includes('damage')) {
            return `${text} Detected`; 
        }
        return `${text} Damage Detected`;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            
            <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-50">
                <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold transition-colors bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg">
                    <ArrowLeft size={20} />
                    <span className="hidden sm:inline">Exit</span>
                </button>
                <div className="flex items-center gap-2">
                    <Activity className="text-blue-600" size={24} />
                    <span className="font-extrabold text-lg tracking-tight text-gray-800 hidden xs:inline">
                        QuickDART <span className="text-blue-600">Public</span>
                    </span>
                </div>
                <div className="flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-lg border border-slate-200">
                    <Clock size={18} className="text-blue-600" />
                    <div className="flex flex-col leading-tight text-right">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{time.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span className="text-sm font-bold font-mono text-slate-900">{time.toLocaleTimeString()}</span>
                    </div>
                </div>
            </header>

            <main className="flex-grow flex flex-col items-center p-6">
                <div className="w-full max-w-md space-y-6">

                    {step === 1 && (
                        <div className="text-center mt-4">
                            <h1 className="text-2xl font-bold text-gray-900">Report an Incident</h1>
                            <p className="text-gray-500 text-sm mt-1">Help emergency responders by uploading a photo or video.</p>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                        
                        {/* --- STEP 1: UPLOAD --- */}
                        {step === 1 && (
                            <div className="p-8 space-y-4">
                                {/* File upload dropzone */}
                                <div className="border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/50 hover:bg-blue-50 transition-colors h-52 flex flex-col items-center justify-center relative group cursor-pointer">
                                    <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*,video/*" onChange={handleFileSelect} disabled={uploading} />
                                    {uploading ? (
                                        <div className="text-center">
                                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                                            <p className="text-blue-600 font-bold">
                                                {analysisProgress?.message || 'Analyzing...'}
                                            </p>
                                            {analysisProgress?.total && (
                                                <div className="mt-2 w-48 mx-auto">
                                                    <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${(analysisProgress.current / analysisProgress.total) * 100}%` }} />
                                                    </div>
                                                    <p className="text-xs text-blue-400 mt-1">{analysisProgress.current}/{analysisProgress.total} frames</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center"><div className="bg-white p-4 rounded-full shadow-sm mb-3 inline-block group-hover:scale-110 transition-transform"><Camera className="h-8 w-8 text-blue-600" /></div><p className="font-bold text-gray-700">Tap to Upload Photo or Video</p>
<p className="text-xs text-gray-400 mt-1">Supports images and video files</p></div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                    <span className="text-xs text-gray-400 font-bold uppercase">or</span>
                                    <div className="flex-1 h-px bg-gray-200"></div>
                                </div>

                                {/* Camera button */}
                                {isCameraSupported && (
                                    <button
                                        onClick={openCamera}
                                        disabled={uploading}
                                        className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg disabled:opacity-50"
                                    >
                                        <Video size={22} />
                                        Open Camera
                                    </button>
                                )}
                            </div>
                        )}

                        {/* --- CAMERA MODAL --- */}
                        {showCamera && (
                            <div className="fixed inset-0 bg-black z-[100] flex flex-col">
                                {/* Camera preview */}
                                {/* Camera preview with overlay */}
                                <div className="relative flex-1 w-full">
                                    <video
                                        ref={cameraVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />
                                    <canvas
                                        ref={overlayCanvasRef}
                                        className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
                                    />
                                </div>
                                <canvas ref={captureCanvasRef} className="hidden" />

                                {/* Live detection indicator */}
                                {liveResult && !isRecording && (
                                    <div className={`absolute top-6 left-6 px-3 py-2 rounded-lg z-10 text-white text-xs font-bold shadow-lg ${liveResult.type === 'No Disaster' ? 'bg-green-600/90' : 'bg-red-600/90'}`}>
                                        <div>{liveResult.type} ({liveResult.type_confidence?.toFixed(0)}%)</div>
                                        {liveResult.type !== 'No Disaster' && liveResult.damage && (
                                            <div className="text-white/80 mt-0.5">{liveResult.damage} ({liveResult.damage_confidence?.toFixed(0)}%)</div>
                                        )}
                                    </div>
                                )}

                                {/* Recording indicator */}
                                {isRecording && (
                                    <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2 animate-pulse z-10">
                                        <Circle size={10} className="fill-white" />
                                        <span className="font-bold font-mono text-sm">REC {recordingTime}s / 30s</span>
                                    </div>
                                )}

                                {/* Close button */}
                                <button
                                    onClick={closeCamera}
                                    className="absolute top-6 right-6 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full z-10 transition-colors"
                                >
                                    <X size={24} />
                                </button>

                                {/* Camera controls */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8 flex items-center justify-center gap-8">
                                    {/* Capture Photo */}
                                    <button
                                        onClick={capturePhoto}
                                        disabled={isRecording}
                                        className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:scale-105 active:scale-95 transition-transform disabled:opacity-30 flex items-center justify-center shadow-lg"
                                        title="Capture Photo"
                                    >
                                        <Camera size={24} className="text-gray-800" />
                                    </button>

                                    {/* Record / Stop Video */}
                                    {isRecording ? (
                                        <button
                                            onClick={stopRecording}
                                            className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full border-4 border-red-300 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg"
                                            title="Stop Recording"
                                        >
                                            <StopCircle size={28} className="text-white" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={startRecording}
                                            className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full border-4 border-red-200 hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg"
                                            title="Record Video"
                                        >
                                            <Circle size={28} className="text-white fill-white" />
                                        </button>
                                    )}
                                </div>

                                {/* Helper text */}
                                <div className="absolute bottom-2 left-0 right-0 text-center">
                                    <p className="text-white/60 text-[10px]">
                                        {isRecording ? 'Tap red button to stop recording' : 'Photo (left) or Video (right) - max 30 seconds'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* --- STEP 2: DETAILS --- */}
                        {step === 2 && analysisResult && (
                            <div className="p-0">
                                <div className="relative h-48 bg-gray-900">
                                    {analysisResult?.source === 'video' ? (
        <video src={previewUrl} className="w-full h-full object-cover opacity-80" muted autoPlay loop />
    ) : (
        <>
            <img ref={resultImageRef} src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-80" onLoad={drawResultBboxes} />
            <canvas ref={resultCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
        </>
    )}
                                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                                        <div className="flex items-center gap-2"><span className={`${analysisResult.type === 'No Disaster' ? 'bg-green-500' : 'bg-red-500'} px-2 py-0.5 rounded text-xs font-bold uppercase`}>{analysisResult.type}</span><span className="text-xs opacity-90">Confidence: {typeof analysisResult.confidence === 'number' ? `${analysisResult.confidence.toFixed(1)}%` : analysisResult.confidence}</span></div>
                                        <p className="font-bold text-lg">{getDamageText(analysisResult.damage)}</p>
                                        {/* Distribution breakdown */}
                                        {analysisResult.type_distribution && (
                                            <div className="mt-2 space-y-1">
                                                <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-black/30">
                                                    {Object.entries(analysisResult.type_distribution).map(([name, pct]) => {
                                                        const colors = { Earthquake: 'bg-amber-500', Fire: 'bg-red-500', Flood: 'bg-blue-500', 'No Disaster': 'bg-green-500' };
                                                        return pct > 0 ? <div key={name} className={`${colors[name] || 'bg-gray-400'}`} style={{ width: `${pct}%` }} title={`${name}: ${pct}%`} /> : null;
                                                    })}
                                                </div>
                                                <div className="flex gap-3 text-xs opacity-90">
                                                    {Object.entries(analysisResult.type_distribution).map(([name, pct]) => (
                                                        pct > 0 ? <span key={name}>{name}: {pct}%</span> : null
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={resetForm} className="absolute top-4 right-4 bg-black/50 p-1 rounded-full text-white hover:bg-red-600 transition-colors"><XCircle size={20} /></button>
                                </div>

                                <div className="p-6 space-y-4">
                                    {/* --- SMART LOCATION INPUT --- */}
                                    <div className="relative">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                            Location <span className="text-red-500">*</span>
                                        </label>
                                        
                                        <div className={`flex items-center gap-2 border rounded-lg p-3 bg-gray-50 focus-within:bg-white focus-within:ring-2 transition-all ${locationError ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200 focus-within:ring-blue-100'}`}>
                                            {isSearching || locating ? <Loader2 className="animate-spin text-blue-500" size={18} /> : <Search className="text-gray-400" size={18} />}
                                            
                                            <input 
                                                type="text" 
                                                placeholder={locating ? "Requesting GPS..." : "Type address or landmark..."}
                                                className="bg-transparent outline-none w-full text-sm font-medium"
                                                value={formData.location}
                                                onChange={handleLocationInput}
                                            />
                                        </div>
                                        
                                        {/* Error Message */}
                                        {locationError && (
                                            <p className="text-xs text-red-500 mt-1 flex items-center gap-1 font-medium animate-in slide-in-from-top-1">
                                                <AlertCircle size={12} /> This is a required field
                                            </p>
                                        )}

                                        {/* DROPDOWN SUGGESTIONS */}
                                        {locationSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto mt-1">
                                                {locationSuggestions.map((loc, index) => (
                                                    <div key={index} onClick={() => handleSelectLocation(loc)} className="p-2.5 text-xs hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center gap-2">
                                                        <MapPin size={12} className="text-gray-400"/> {loc.display_name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description (Optional)</label>
                                        <div className="flex items-start gap-2 border rounded-lg p-3 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-blue-100 transition-all border-gray-200">
                                            <FileText className="text-gray-400 mt-0.5" size={18} />
                                            <textarea placeholder="Describe the situation..." className="bg-transparent outline-none w-full text-sm font-medium resize-none" rows="2" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                                        </div>
                                    </div>

                                    <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-2 shadow-lg shadow-blue-200">
                                        {submitting ? <span>Sending...</span> : <><Send size={18} /> Submit Report</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="p-10 text-center flex flex-col items-center justify-center">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce"><CheckCircle className="h-10 w-10 text-green-600" /></div>
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">Report Submitted!</h2>
                                <p className="text-gray-500 mb-8">Thank you. Responders have been notified.</p>
                                <button onClick={resetForm} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors">Report Another Incident</button>
                            </div>
                        )}

                    </div>

                    {/* --- FALSE REPORTING DISCLAIMER --- */}
                    {step === 1 && (
                        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-800 leading-relaxed">
                                    <span className="font-bold">Disclaimer:</span> Submitting false, misleading, or fabricated disaster reports is a serious offense.
                                    Fraudulent reports divert critical emergency resources and may endanger lives.
                                    Violations may be subject to criminal prosecution under applicable laws.
                                    By proceeding, you certify that all information provided is truthful and accurate to the best of your knowledge.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 text-xs text-center text-gray-400">QuickDART System &copy; 2025</div>
                </div>
            </main>
        </div>
    );
};

export default GuestDashboard;