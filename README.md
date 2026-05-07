# QUICK**DART**

**Disaster Rapid Response & Damage Assessment System**

QuickDART is a full-stack web platform that uses deep learning to classify disaster types and assess structural damage from images and video. It provides real-time situational awareness for emergency response teams through interactive maps, live drone feeds, and automated incident reporting.

Built as a capstone project by **Embile, Samaniego & Ang** (Group 3).

---

## Features

### AI-Powered Analysis
- **Disaster Type Classification** — detects Earthquake, Fire, and Flood events using a trained ResNet50 model
- **Damage Level Assessment** — classifies structural damage as Destroyed, Major, Minor, or No Damage using a second ResNet50 model
- **Video Analysis** — extracts frames from uploaded videos, runs per-frame inference, and uses majority voting with confidence thresholds to produce a consensus result
- **Live Frame Analysis** — streams webcam or virtual camera frames to the backend via Socket.IO for real-time classification with bounding box overlays and Grad-CAM heatmaps
- **AI-Generated Descriptions** — converts raw ML output into meaningful situational reports describing severity, hazard context, and confidence qualifiers

### Admin Dashboard (Commander)
- **Interactive Incident Map** — Leaflet-based geospatial view of all reports with color-coded damage markers
- **Report Management** — view, update, assign, and resolve damage reports
- **Team & Asset Management** — create response teams, assign coverage areas, manage equipment inventory
- **Personnel Deployment** — dispatch teams to incidents with task orders and track active deployments
- **Analytics & Statistics** — charts for disaster distribution, damage breakdown, team readiness, and response trends (Recharts)
- **Real-Time Chat** — Socket.IO-powered command chat rooms per team

### Responder Dashboard (Field Teams)
- **Priority Task Queue** — admin-assigned reports surface at the top with visual priority badges
- **Mission Tracking** — accept deployments, update status, and mark missions complete
- **Drone Upload (Post-Flight)** — multi-file drag-and-drop upload with per-file analysis pipeline, Leaflet location picker, and batch report saving
- **Live Drone Analysis** — stream a drone's camera feed (via OBS Virtual Camera) for real-time disaster classification with bounding boxes
- **Inventory Management** — track team equipment and asset status
- **Incident Log** — browse geofenced reports within the team's coverage radius

### Guest / Public User
- **Quick Report** — upload a photo or video of an incident for AI analysis without logging in
- **Camera Capture** — use the device camera to take a photo or record video directly in the browser
- **Live Camera Analysis** — real-time disaster classification using the device's webcam
- **Geolocation** — auto-detect location or search by address with geocoding

### Drone Integration
Designed for consumer drones like the LSRC GT50 (WiFi FPV):
- **Post-flight bulk upload** — after landing, upload all captured media for batch analysis and report generation
- **Live in-flight streaming (Phone Relay)** — mirror the drone's companion app (LS drone-wifi) to the PC via USB (scrcpy/QuickTime), route through OBS Virtual Camera, and feed into QuickDART's live analysis pipeline

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS, Leaflet / react-leaflet, Recharts, Socket.IO Client, Lucide Icons |
| Backend | Python Flask, Flask-SocketIO, SQLAlchemy ORM |
| Database | PostgreSQL (hosted on Supabase) |
| Auth | Supabase Auth |
| ML Models | PyTorch, torchvision (ResNet50), Grad-CAM |
| Real-Time | Socket.IO (WebSocket) |

---

## Project Structure

```
QuickDART/
├── src/                        # React frontend
│   ├── App.jsx                 # Entry point, routing, auth flow
│   ├── Dashboard.jsx           # Admin/Commander dashboard
│   ├── ResponderDashboard.jsx  # Field team dashboard
│   ├── GuestDashboard.jsx      # Public user incident reporting
│   ├── DroneUpload.jsx         # Post-flight bulk upload component
│   ├── DroneLive.jsx           # Live drone feed analysis component
│   ├── Statistics.jsx          # Analytics charts and metrics
│   ├── IncidentMap.jsx         # Leaflet map with report markers
│   ├── DamageReports.jsx       # Report list and management
│   ├── AssetsTeams.jsx         # Team and asset management
│   ├── Settings.jsx            # User settings panel
│   ├── lib/
│   │   └── generateAIDescription.js  # Shared AI description generator
│   └── components/
│       └── VideoAnalysisPlayer.jsx   # Video playback with per-frame overlays
│
├── backend/
│   ├── app.py                  # Flask server — all routes and Socket.IO handlers
│   ├── models/
│   │   ├── database.py         # SQLAlchemy engine and Supabase config
│   │   ├── user.py             # User model and authentication
│   │   ├── report.py           # Report model (incidents)
│   │   └── resources.py        # Team, Asset, Deployment models
│   └── static/uploads/         # Uploaded images and videos
│
├── ml_engine/
│   ├── disaster_type_model.pth       # Trained ResNet50 — disaster classification
│   ├── damage_assessment_model.pth   # Trained ResNet50 — damage assessment
│   ├── gradcam.py              # Grad-CAM visualization
│   ├── train_classifier.py     # Training script — disaster type
│   ├── train_damage.py         # Training script — damage level
│   └── test_model.py           # Inference test script
│
├── init_db.py                  # Database reset and schema creation
├── package.json                # Frontend dependencies and scripts
└── requirements.txt            # Python dependencies
```

---

## Getting Started

### Prerequisites
- **Node.js** (v16+) and npm
- **Python** (3.9+)
- **PostgreSQL** database (or a Supabase project)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Lanszs/QuickDART.git
   cd QuickDART/QuickDART
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate        # Windows
   # source venv/bin/activate   # macOS/Linux
   pip install -r requirements.txt
   cd ..
   ```

4. **Initialize the database**
   ```bash
   python init_db.py
   ```

5. **Run the full stack**
   ```bash
   npm run dev
   ```
   This starts both the React dev server and the Flask backend concurrently.

   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:5000`

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/login` | Authenticate via Supabase |
| `POST` | `/api/v1/analyze` | Upload image/video for AI analysis |
| `GET` | `/api/v1/reports` | List reports (supports `?team_id=` for geofencing) |
| `POST` | `/api/v1/reports` | Create a new incident report |
| `PUT` | `/api/v1/reports/:id` | Update report status or details |
| `GET` | `/api/v1/resources` | Fetch all teams and assets |
| `POST` | `/api/v1/teams` | Create a new response team |
| `DELETE` | `/api/v1/teams/:id` | Delete a team |
| `PUT` | `/api/v1/teams/:id/deploy` | Deploy a team with task orders |
| `GET/POST` | `/api/v1/teams/:id/deployments` | List or create deployments |
| `PUT` | `/api/v1/deployments/:id/complete` | Mark a deployment as complete |
| `POST` | `/api/v1/assets` | Add an asset to a team |
| `DELETE` | `/api/v1/assets/:id` | Remove an asset |
| `GET` | `/api/v1/chat/history/:room` | Get chat message history |

### Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join_room` | Client → Server | Join a chat/notification room |
| `send_message` | Client → Server | Send a chat message |
| `analyze_live_frame` | Client → Server | Send a base64 JPEG frame for live analysis |
| `live_frame_result` | Server → Client | Returns classification, bboxes, and Grad-CAM overlay |

---

## ML Models

Both models use **ResNet50** (pretrained on ImageNet, fine-tuned on disaster datasets):

| Model | Classes | File |
|-------|---------|------|
| Disaster Type | Earthquake, Fire, Flood, No Disaster | `disaster_type_model.pth` |
| Damage Level | Destroyed, Major, Minor, No Damage | `damage_assessment_model.pth` |

**Image inference:** Single forward pass through both models.

**Video inference:** Extracts 10 evenly-spaced frames, runs per-frame classification, applies majority voting with a supermajority threshold (60%) and confidence floor (45%) to prevent false positives.

**Live inference:** Frames sent every 500ms via Socket.IO. Returns bounding box coordinates and Grad-CAM heatmap overlay for visual explanation.

To test the models:
```bash
cd ml_engine
python test_model.py
```

---

## Drone Setup (GT50 / FLOW-UFO)

### Post-Flight Upload
1. Log in as a Responder → navigate to **Drone Upload** tab.
2. Drag and drop captured photos/videos.
3. Each file is analyzed automatically. Pin the location on the map and save as a report.

### Live In-Flight Streaming (Phone Relay)
1. Connect phone to drone WiFi (`FLOW-UFO-XXXX` or `GT50-XXXX`).
2. Open the **LS drone-wifi** app to view the live feed.
3. Mirror the phone to the PC via **USB** using [scrcpy](https://github.com/Genymobile/scrcpy) (Android) or QuickTime (iPhone).
4. In **OBS Studio**, add the mirror window as a Window Capture source → click **Start Virtual Camera**.
5. In the Responder Dashboard → **Live Drone** tab, select **OBS Virtual Camera** → click **Start Live Analysis**.
6. Bounding boxes and damage labels overlay in real time. Click **Capture & Save Report** to log an incident.

---

## Authors

- **Embile, Samaniego & Ang** — Group 3
- Capstone Project, 2025

---

## License

This project is for academic purposes. All rights reserved.


