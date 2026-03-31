import React , { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
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

const TeamIcon = L.divIcon({
    className: 'team-marker',
    html: `<div style="background:#3B82F6;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
});
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

 /* const MAP_BOUNDS = [
    [14.6000, 120.8500], // South-West corner (Manila Bay / Navotas area)
    [14.8000, 121.0500]  // North-East corner (Quezon City / Meycauayan border)
]; */

/* const DAMPALIT_BOUNDS = [
    [14.6800, 120.9200], // South-West corner (Near Navotas boundary)
    [14.7150, 120.9600]  // North-East corner (Near Obando/Valenzuela boundary)
]; */

// Coordinates for Intramuros, Manila
const INTRAMUROS_BOUNDS = [
    [14.5829, 120.9673], // South-West corner (Near Rizal Park / Manila Hotel)
    [14.5960, 120.9811]  // North-East corner (Near Pasig River / Jones Bridge)
];

const INTRAMUROS_CENTER = [14.5895, 120.9742]; // Approximate center near Manila Cathedral

/* const MARILAO_BOUNDS = [
    [14.7200, 120.9000], // South-West corner
    [14.8200, 121.0500]  // North-East corner
]; */

// Coordinates for Marilao, Bulacan
// const MARILAO_CENTER = [14.7546, 120.9466];

// --- UPDATED CENTER: DAMPALIT, MALABON ---
const MAP_CENTER = [14.6944, 120.9324];

// Mock Incident Data
const incidents = [
    { id: 1, lat: 14.7546, lng: 120.9466, type: "Flood", status: "Critical" },
    { id: 2, lat: 14.7600, lng: 120.9500, type: "Fire", status: "Active" },
    { id: 3, lat: 14.7480, lng: 120.9400, type: "Road Block", status: "Cleared" },
];

// 1. Define the component function
const IncidentMap = ({ reports = [], teams = [] }) => {
    return (
        <MapContainer 
            center={INTRAMUROS_CENTER} 
            zoom={14} 
            minZoom={13} // Prevent zooming out too far (seeing the whole world)
            maxZoom={18} // Prevent zooming in too close
            maxBounds={INTRAMUROS_BOUNDS} // Lock view to Marilao
            maxBoundsViscosity={1.0} // How "sticky" the bounds are (1.0 = hard stop)
            scrollWheelZoom={true} 
            style={{ height: "100%", width: "100%", borderRadius: "0.5rem", zIndex: 0 }} // Explicit style helps prevent size issues
        >

            <MapFix />

            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {reports
                .filter(report => report.status !== 'Cleared')
                .map((report) => {
                    const lat = report.latitude || report.lat;
                    const lng = report.longitude || report.lng;

                    if (lat && lng) {
                        return (
                            <Marker key={report.id} position={[lat, lng]}>
                                <Popup>
                                    <div className="text-sm">
                                        <strong className="block text-gray-800">{report.title}</strong>
                                        <span className={`font-semibold ${report.status === 'Critical' ? 'text-red-600' : 'text-blue-600'}`}>
                                            Status: {report.status}
                                        </span>
                                        <p className="text-xs text-gray-600 mt-1">{report.description}</p>
                                        <p className="text-[10px] text-gray-400 mt-1">{report.location}</p>
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    }
                    return null;
                })
            }

            {(teams || []).map((team) => {
                const lat = team.base_latitude;
                const lng = team.base_longitude;
                if (!lat || !lng) return null;

                const available = (team.available_personnel != null) ? team.available_personnel : team.personnel;
                const total = team.personnel || 0;

                return (
                    <React.Fragment key={`team-${team.id}`}>
                        <Circle
                            center={[lat, lng]}
                            radius={(team.coverage_radius_km || 5) * 1000}
                            pathOptions={{
                                color: '#3B82F6',
                                fillColor: '#3B82F6',
                                fillOpacity: 0.06,
                                weight: 1.5,
                                dashArray: '6 4',
                            }}
                        />
                        <Marker position={[lat, lng]} icon={TeamIcon}>
                            <Popup>
                                <div className="text-sm min-w-[160px]">
                                    <strong className="block text-blue-700 text-base">{team.name}</strong>
                                    <p className="text-xs text-gray-500 mt-0.5">{team.department || 'No Department'}</p>
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <span className={`inline-block w-2 h-2 rounded-full ${team.status === 'Available' ? 'bg-green-500' : team.status === 'Deployed' ? 'bg-yellow-500' : 'bg-gray-400'}`}></span>
                                        <span className="text-xs font-medium">{team.status || 'Unknown'}</span>
                                    </div>
                                    <p className="text-xs mt-1.5 text-gray-700">
                                        <span className="font-semibold">{available}/{total}</span> personnel available
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Coverage: {team.coverage_radius_km || 5} km
                                    </p>
                                </div>
                            </Popup>
                        </Marker>
                    </React.Fragment>
                );
            })}
        </MapContainer>
    );
};

export default IncidentMap;