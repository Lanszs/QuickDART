import React, { useState, useEffect } from 'react';
import { Camera, MapPin, AlertTriangle, Send, FileText, XCircle, CheckCircle, Loader2 } from 'lucide-react';

const GuestDashboard = () => {
    const [step, setStep] = useState(1); // 1=Upload, 2=Details, 3=Success
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [locating, setLocating] = useState(false);
    
    // Data State
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    
    // Form State
    const [formData, setFormData] = useState({
        location: '', 
        description: '',
        latitude: null,
        longitude: null
    });

    // --- AUTOMATIC LOCATION TRIGGER ---
    useEffect(() => {
        if (step === 2) {
            triggerLocation();
        }
    }, [step]);

    const triggerLocation = () => {
        if (!navigator.geolocation) {
            console.error("Geolocation not supported");
            return;
        }

        setLocating(true);
        // We leave the field blank initially as you requested
        // setFormData(prev => ({ ...prev, location: "Asking permission..." })); 

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                console.log("📍 GPS Granted:", position);
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // 1. Save Raw GPS immediately
                setFormData(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng
                }));

                // 2. Convert to Address (OpenStreetMap)
                try {
                    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    const data = await response.json();
                    
                    if (data && data.display_name) {
                        // Clean up the address (keep it short - first 4 parts)
                        const address = data.display_name.split(',').slice(0, 4).join(',');
                        setFormData(prev => ({ ...prev, location: address }));
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
                console.warn("Location permission denied or error:", error);
                setLocating(false);
                // We do NOT alert here to avoid annoying the user if they blocked it on purpose
            },
            {
                enableHighAccuracy: true, // Forces a "serious" location request
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    // --- 1. HANDLE IMAGE UPLOAD & ANALYZE ---
    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const objectUrl = URL.createObjectURL(file);
        setPreviewUrl(objectUrl);
        setSelectedFile(file);
        setUploading(true);

        const uploadData = new FormData();
        uploadData.append('file', file);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/analyze', {
                method: 'POST',
                body: uploadData,
            });

            if (response.ok) {
                const result = await response.json();
                setAnalysisResult(result);
                setStep(2); // <--- Triggers useEffect -> triggerLocation()
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
        }
    };

    // --- 3. SUBMIT REPORT ---
    const handleSubmit = async () => {
        if (!analysisResult) return;
        setSubmitting(true);

        const newReport = {
            title: `Public Report: ${analysisResult.type}`,
            description: formData.description || `AI Detected ${analysisResult.damage} damage.`,
            status: 'Pending',
            location: formData.location || 'Unknown Location',
            latitude: formData.latitude || 14.7546, 
            longitude: formData.longitude || 120.9466,
            damage_level: analysisResult.damage,
            image_url: analysisResult.image_url 
        };

        try {
            const response = await fetch('http://127.0.0.1:5000/api/v1/reports', {
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
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
            
            <div className="w-full max-w-md mb-8 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-xl shadow-lg mb-4">
                    <AlertTriangle className="text-white h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Public Incident Reporting</h1>
                <p className="text-gray-500 text-sm mt-1">Report disasters for immediate assistance</p>
            </div>

            <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
                
                {/* --- STEP 1: UPLOAD --- */}
                {step === 1 && (
                    <div className="p-8">
                        <div className="border-2 border-dashed border-blue-200 rounded-2xl bg-blue-50/50 hover:bg-blue-50 transition-colors h-64 flex flex-col items-center justify-center relative group cursor-pointer">
                            <input 
                                type="file" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/*"
                                onChange={handleFileSelect}
                                disabled={uploading}
                            />
                            {uploading ? (
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                                    <p className="text-blue-600 font-bold">Analyzing...</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className="bg-white p-4 rounded-full shadow-sm mb-3 inline-block group-hover:scale-110 transition-transform">
                                        <Camera className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <p className="font-bold text-gray-700">Tap to Take Photo</p>
                                    <p className="text-xs text-gray-400 mt-1">or upload from gallery</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- STEP 2: DETAILS --- */}
                {step === 2 && analysisResult && (
                    <div className="p-0">
                        {/* Image Preview */}
                        <div className="relative h-48 bg-gray-900">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-80" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
                                <div className="flex items-center gap-2">
                                    <span className="bg-red-500 px-2 py-0.5 rounded text-xs font-bold uppercase">{analysisResult.type}</span>
                                    <span className="text-xs opacity-90">Confidence: {analysisResult.confidence}</span>
                                </div>
                                <p className="font-bold text-lg">{analysisResult.damage} Damage Detected</p>
                            </div>
                            <button onClick={resetForm} className="absolute top-4 right-4 bg-black/50 p-1 rounded-full text-white hover:bg-red-600 transition-colors">
                                <XCircle size={20} />
                            </button>
                        </div>

                        {/* Form Fields */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 flex items-center gap-2 border rounded-lg p-3 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-blue-100 transition-all">
                                        {/* MAKE ICON CLICKABLE TO FORCE RETRY */}
                                        <button onClick={triggerLocation} title="Retrigger Location">
                                            {locating ? (
                                                <Loader2 className="animate-spin text-blue-500" size={18} />
                                            ) : (
                                                <MapPin className="text-gray-400 hover:text-blue-500 cursor-pointer" size={18} />
                                            )}
                                        </button>
                                        
                                        <input 
                                            type="text" 
                                            placeholder={locating ? "Asking permission..." : "Location name..."}
                                            className="bg-transparent outline-none w-full text-sm font-medium"
                                            value={formData.location}
                                            onChange={(e) => setFormData({...formData, location: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description (Optional)</label>
                                <div className="flex items-start gap-2 border rounded-lg p-3 bg-gray-50 focus-within:bg-white focus-within:ring-2 ring-blue-100 transition-all">
                                    <FileText className="text-gray-400 mt-0.5" size={18} />
                                    <textarea 
                                        placeholder="Describe the situation..." 
                                        className="bg-transparent outline-none w-full text-sm font-medium resize-none"
                                        rows="2"
                                        value={formData.description}
                                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-2 shadow-lg shadow-blue-200"
                            >
                                {submitting ? (
                                    <span>Sending...</span>
                                ) : (
                                    <>
                                        <Send size={18} /> Submit Report
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* --- STEP 3: SUCCESS --- */}
                {step === 3 && (
                    <div className="p-10 text-center flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Report Submitted!</h2>
                        <p className="text-gray-500 mb-8">Thank you. Responders have been notified.</p>
                        
                        <button 
                            onClick={resetForm}
                            className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                        >
                            Report Another Incident
                        </button>
                    </div>
                )}

            </div>
            
            <div className="mt-8 text-xs text-gray-400">
                QuickDART System &copy; 2025
            </div>
        </div>
    );
};

export default GuestDashboard;