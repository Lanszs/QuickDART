# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Running the Application
- **Full stack (frontend + backend):** `npm run dev` (from repo root) — uses `concurrently` to start React frontend and Flask backend
- **Backend only:** `cd backend && python app.py` — runs on `http://0.0.0.0:5000`

### Installation
- Backend: `pip install -r requirements.txt` (from `backend/` or root)
- Frontend: `npm install` (from root)

### Database
- `python init_db.py` — resets the database, wipes Supabase users (except admin), creates fresh schema

### ML Testing
- `python ml_engine/test_model.py` — runs inference test using both ML models on a sample image

## Architecture

QuickDART is a disaster rapid response and damage assessment platform. It has three layers:

### Frontend (React)
- Located in `src/`, communicates with the backend via REST and Socket.IO WebSocket
- Uses Leaflet for interactive geospatial maps, Recharts for data visualization

### Backend (Flask — `backend/app.py`)
- Single-file Flask application (~980 lines) with all routes and Socket.IO event handlers
- PostgreSQL database via SQLAlchemy ORM; models in `backend/models/`
- Supabase used for hosted Postgres and authentication (service key hardcoded in `database.py`)
- File uploads (images/videos) saved to `backend/static/uploads/`

**Key models:**
- `User` — linked to a team, has role
- `Report` — disaster report with location (lat/lng), damage level, AI predictions, image URL
- `Team` — response team with base location and coverage radius
- `Asset` — equipment/vehicle linked to a team
- `Message` — real-time chat message per room

### ML Engine (`ml_engine/`)
- Two trained ResNet50 models (PyTorch):
  - `disaster_type_model.pth` — classifies disaster type: Earthquake / Fire / Flood
  - `damage_assessment_model.pth` — classifies damage level: Destroyed / Major / Minor / No Damage
- For images: single inference pass
- For videos: extracts 10 evenly-spaced frames, runs inference on each, uses majority voting

### Real-time Communication
- Flask-SocketIO handles `join_room`, `send_message` events
- Clients subscribe to team-specific or admin rooms for live updates (reports, deployments, chat)

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/v1/login` | Authenticate via Supabase |
| `POST` | `/api/v1/analyze` | Upload image/video → returns disaster type + damage level |
| `GET/POST` | `/api/v1/reports` | List or create damage reports |
| `PUT` | `/api/v1/reports/<id>` | Update report status/damage |
| `GET` | `/api/v1/resources` | Fetch all teams and assets |
| `POST` | `/api/v1/teams` | Create team |
| `PUT` | `/api/v1/teams/<id>/deploy` | Deploy team with task orders |
| `GET` | `/api/v1/chat/history/<room>` | Get message history for a room |

## Configuration Notes

- Supabase credentials and database URL are hardcoded in `backend/models/database.py` and `init_db.py` — not loaded from `.env`
- CORS is open to all origins (`"*"`) — intentional for dev
- Login returns a mock JWT (`"mock_jwt_token_123"`) — real auth is not yet implemented
