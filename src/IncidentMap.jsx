import React , { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Fix for Leaflet default marker icons in React ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;
// -----------------------------------------------------

const MapFix = () => {
    const map = useMap();
    useEffect(() => {
        // Wait 100ms for the DOM to settle, then force resize calculation
        setTimeout(() => {
            map.invalidateSize(); 
        }, 100);
    }, [map]);
    return null;
};

const MARILAO_BOUNDS = [
    [14.7200, 120.9000], // South-West corner
    [14.8200, 121.0500]  // North-East corner
];

// Coordinates for Marilao, Bulacan
const MARILAO_CENTER = [14.7546, 120.9466];

// Mock Incident Data
const incidents = [
    { id: 1, lat: 14.7546, lng: 120.9466, type: "Flood", status: "Critical" },
    { id: 2, lat: 14.7600, lng: 120.9500, type: "Fire", status: "Active" },
    { id: 3, lat: 14.7480, lng: 120.9400, type: "Road Block", status: "Cleared" },
];

// 1. Define the component function
const IncidentMap = ({ reports = [] }) => {
    return (
        <MapContainer 
            center={MARILAO_CENTER} 
            zoom={14} 
            minZoom={13} // Prevent zooming out too far (seeing the whole world)
            maxZoom={18} // Prevent zooming in too close
            maxBounds={MARILAO_BOUNDS} // Lock view to Marilao
            maxBoundsViscosity={1.0} // How "sticky" the bounds are (1.0 = hard stop)
            scrollWheelZoom={true} 
            style={{ height: "700px", width: "100%", borderRadius: "0.5rem", zIndex: 0 }} // Explicit style helps prevent size issues
        >

            <MapFix />

            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 2. Map over the REAL reports passed from the database */}
            {reports.map((report) => (
                // Only render if the report has valid coordinates
                (report.lat && report.lng) && (
                    <Marker key={report.id} position={[report.lat, report.lng]}>
                        <Popup>
                            <div className="text-sm">
                                <strong className="block text-gray-800">{report.title}</strong>
                                <span className={`font-semibold ${report.status === 'Critical' ? 'text-red-600' : 'text-blue-600'}`}>
                                    Status: {report.status}
                                </span>
                                <p className="text-xs text-gray-600 mt-1">{report.description}</p>
                            </div>
                        </Popup>
                    </Marker>
                )
            ))}
        </MapContainer>
    );
};

// 2. CRITICAL: Export it as default
export default IncidentMap;