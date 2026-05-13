import cv2
import sys
import os
import uuid
import math
import mimetypes
import tempfile
# --- 🔧 FIX: FORCE PYTHON TO FIND THE 'MODELS' FOLDER ---
# This tells Python: "The current folder (backend) is part of the path!"
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
# -------------------------------------------------------

sys.stdout.reconfigure(encoding='utf-8')  # Fix encoding
sys.stdout.flush()  # Force immediate output

from supabase import create_client, Client # <--- NEW IMPORT
from flask import Flask, jsonify , request, send_from_directory
from flask_cors import CORS 
from flask_socketio import SocketIO, emit

# --- NOW these imports will work because the path is fixed ---
from models.user import authenticate_user, User
from models.database import SessionLocal, engine
from models.report import Report
from models.resources import Asset, Team, Deployment

import io
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from datetime import datetime
import requests

# Add ml_engine to path for Grad-CAM import
ML_ENGINE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'ml_engine')
sys.path.append(ML_ENGINE_DIR)
from gradcam import GradCAM, compute_gradcam_for_frame

# --- SUPABASE CONFIGURATION ---
# Loaded from backend/.env locally; set as service env vars in production (Render).
# database.py already calls load_dotenv on import, so os.environ is populated by now.
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")  # SERVICE ROLE key, not anon

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ Warning: SUPABASE_URL/SUPABASE_KEY not set. User creation will be local only.")
    supabase = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"⚠️ Warning: Supabase client init failed. User creation will be local only. {e}")
        supabase = None

# Storage bucket for uploaded reports (images / videos)
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "quickdart-uploads")

def ensure_storage_bucket():
    """Create the public uploads bucket if it doesn't already exist. Idempotent."""
    if not supabase:
        return
    try:
        buckets = supabase.storage.list_buckets()
        names = []
        for b in buckets:
            n = getattr(b, "name", None) or (b.get("name") if isinstance(b, dict) else None)
            if n: names.append(n)
        if SUPABASE_STORAGE_BUCKET in names:
            print(f"--- Storage bucket OK: {SUPABASE_STORAGE_BUCKET}")
        else:
            supabase.storage.create_bucket(SUPABASE_STORAGE_BUCKET, options={"public": True})
            print(f"--- Created Storage bucket: {SUPABASE_STORAGE_BUCKET} (public)")
    except Exception as e:
        print(f"--- WARNING: could not verify/create Storage bucket '{SUPABASE_STORAGE_BUCKET}': {e}")

ensure_storage_bucket()


def upload_to_storage(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Upload bytes to Supabase Storage and return the public URL."""
    if not supabase:
        raise RuntimeError("Supabase Storage not configured")
    storage_path = f"uploads/{filename}"
    supabase.storage.from_(SUPABASE_STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return supabase.storage.from_(SUPABASE_STORAGE_BUCKET).get_public_url(storage_path)


# Set up Static Folder for Images
app = Flask(__name__, static_folder='static')

# CORS: allow comma-separated origins via FRONTEND_ORIGIN env var. Default '*' for dev.
# In production set this to your Vercel URL, e.g. "https://quickdart.vercel.app".
_frontend_origin_raw = os.environ.get("FRONTEND_ORIGIN", "*")
_cors_origins = [o.strip() for o in _frontend_origin_raw.split(",") if o.strip()] if _frontend_origin_raw != "*" else "*"
CORS(app, resources={r"/*": {"origins": _cors_origins}})
socketio = SocketIO(app, cors_allowed_origins=_cors_origins)

TYPE_CLASS_NAMES = ['Earthquake', 'Fire', 'Flood', 'No Disaster']
DAMAGE_CLASS_NAMES = ['Destroyed', 'Major', 'Minor', 'No Damage']


def load_model(path, num_classes):
    print(f"Loading model from {path}...")
    try:
        # Re-create the exact architecture used in training
        model = models.resnet50(weights=None) 
        num_ftrs = model.fc.in_features
        model.fc = nn.Linear(num_ftrs, num_classes)
        
        # Load weights
        model.load_state_dict(torch.load(path, map_location=torch.device('cpu')))
        model.eval()
        print("Model loaded successfully!")
        return model
    except Exception as e:
        print(f"ERROR: Could not load model. {e}")
        return None

# Robust path finding (Works whether you run from root or backend folder)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ML_DIR = os.path.join(BASE_DIR, 'ml_engine')

MODEL_PATHS = {
    'ground': {
        'type': os.path.join(ML_DIR, 'disaster_type_model.pth'),
        'Earthquake': os.path.join(ML_DIR, 'damage_earthquake_model.pth'),
        'Fire': os.path.join(ML_DIR, 'damage_fire_model.pth'),
        'Flood': os.path.join(ML_DIR, 'damage_flood_model.pth'),
    },
    'aerial': {
        'type': os.path.join(ML_DIR, 'disaster_type_aerial_model.pth'),
        'Earthquake': os.path.join(ML_DIR, 'damage_earthquake_aerial_model.pth'),
        'Fire': os.path.join(ML_DIR, 'damage_fire_aerial_model.pth'),
        'Flood': os.path.join(ML_DIR, 'damage_flood_aerial_model.pth'),
    },
}

# --- AUTO-MIGRATION: Add missing columns to reports table ---
def run_migrations():
    """Adds new columns/tables if they don't exist. Non-destructive."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(engine)

        # --- Reports table migrations ---
        report_cols = [col['name'] for col in inspector.get_columns('reports')]
        print(f"--- DB columns in 'reports': {report_cols}")

        report_migrations = {
            'disaster_type': "ALTER TABLE reports ADD COLUMN disaster_type VARCHAR",
            'confidence': "ALTER TABLE reports ADD COLUMN confidence FLOAT",
            'analysis_metadata': "ALTER TABLE reports ADD COLUMN analysis_metadata TEXT",
            'claimed_by_team_id': "ALTER TABLE reports ADD COLUMN claimed_by_team_id INTEGER REFERENCES teams(id)",
            'notes': "ALTER TABLE reports ADD COLUMN notes TEXT",
        }

        with engine.connect() as conn:
            for col_name, sql in report_migrations.items():
                if col_name not in report_cols:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"   + Added column to reports: {col_name}")

            # --- Teams table migrations ---
            team_cols = [col['name'] for col in inspector.get_columns('teams')]
            if 'available_personnel' not in team_cols:
                conn.execute(text("ALTER TABLE teams ADD COLUMN available_personnel INTEGER"))
                conn.commit()
                conn.execute(text("UPDATE teams SET available_personnel = personnel_count WHERE available_personnel IS NULL"))
                conn.commit()
                print(f"   + Added column to teams: available_personnel (backfilled)")

            # --- Assets table migrations ---
            asset_cols = [col['name'] for col in inspector.get_columns('assets')]
            if 'deployment_id' not in asset_cols:
                conn.execute(text("ALTER TABLE assets ADD COLUMN deployment_id INTEGER"))
                conn.commit()
                print(f"   + Added column to assets: deployment_id")

            # --- Deployments table ---
            existing_tables = inspector.get_table_names()
            if 'deployments' not in existing_tables:
                conn.execute(text("""
                    CREATE TABLE deployments (
                        id SERIAL PRIMARY KEY,
                        team_id INTEGER NOT NULL REFERENCES teams(id),
                        report_id INTEGER NOT NULL REFERENCES reports(id),
                        personnel_count INTEGER NOT NULL,
                        task VARCHAR,
                        status VARCHAR DEFAULT 'Active',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        completed_at TIMESTAMP
                    )
                """))
                conn.commit()
                print(f"   + Created table: deployments")

                # Backfill: create Deployment rows for any currently deployed teams
                conn.execute(text("""
                    INSERT INTO deployments (team_id, report_id, personnel_count, task, status, created_at)
                    SELECT id, current_report_id, personnel_count, current_task, 'Active', CURRENT_TIMESTAMP
                    FROM teams
                    WHERE status = 'Deployed' AND current_report_id IS NOT NULL
                """))
                # Mark those reports as claimed
                conn.execute(text("""
                    UPDATE reports SET claimed_by_team_id = t.id
                    FROM teams t
                    WHERE reports.id = t.current_report_id AND t.status = 'Deployed'
                """))
                # Set available_personnel = 0 for deployed teams (they had full deployment)
                conn.execute(text("""
                    UPDATE teams SET available_personnel = 0
                    WHERE status = 'Deployed' AND current_report_id IS NOT NULL
                """))
                conn.commit()
                print(f"   + Backfilled deployments for currently deployed teams")

        print("--- DB migration check complete ---")
    except Exception as e:
        print(f"--- DB migration error (non-fatal): {e}")

run_migrations()

print("--- Loading AI Models ---")

# Loaded model bundles, keyed by view: { 'ground': {...}, 'aerial': {...} }
# Each inner dict has keys: 'type' + each TYPE_CLASS_NAMES disaster name
type_models = {}
damage_models = {}
type_gradcams = {}
damage_gradcams = {}

for view, paths in MODEL_PATHS.items():
    print(f"--- View: {view} ---")

    type_loaded = load_model(paths['type'], len(TYPE_CLASS_NAMES))
    if type_loaded is None and view != 'ground' and type_models.get('ground') is not None:
        print(f"  -> falling back to ground type model for view='{view}'")
        type_loaded = type_models['ground']
    type_models[view] = type_loaded

    damage_models[view] = {}
    for disaster in ('Earthquake', 'Fire', 'Flood'):
        m = load_model(paths[disaster], len(DAMAGE_CLASS_NAMES))
        if m is None and view != 'ground':
            ground_m = damage_models.get('ground', {}).get(disaster)
            if ground_m is not None:
                print(f"  -> falling back to ground {disaster} damage model for view='{view}'")
                m = ground_m
        damage_models[view][disaster] = m

    type_gradcams[view] = GradCAM(type_models[view], "layer4") if type_models[view] else None
    damage_gradcams[view] = {
        disaster: (GradCAM(model, "layer4") if model else None)
        for disaster, model in damage_models[view].items()
    }

# Backwards-compat aliases — some legacy refs may still use these (default to ground view)
type_model = type_models.get('ground')
type_gradcam = type_gradcams.get('ground')


def get_models_for_view(view: str = 'ground'):
    """
    Returns (type_model, damage_models_dict, type_gradcam, damage_gradcams_dict)
    for the requested view. Falls back to 'ground' if the view's models are missing
    so a missing aerial bundle degrades gracefully instead of crashing.
    """
    if view not in type_models or type_models.get(view) is None:
        view = 'ground'
    return (
        type_models[view],
        damage_models[view],
        type_gradcams[view],
        damage_gradcams[view],
    )

print("--- Grad-CAM initialized ---")

# Image Preprocessing
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

# --- NEW: Serve Images Route ---
@app.route('/static/uploads/<path:filename>')
def serve_image(filename):
    return send_from_directory(os.path.join(app.root_path, 'static/uploads'), filename)

# --- RESOURCES ROUTES ---
@app.route('/api/v1/resources', methods=['GET'])
def get_resources():
    session = SessionLocal()
    try:
        assets = session.query(Asset).all()
        teams = session.query(Team).all()
        return jsonify({
            "assets": [a.to_dict() for a in assets],
            "teams": [t.to_dict() for t in teams]
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# Your existing status route
@app.route('/api/v1/status', methods=['GET'])
def get_api_status():
    """Endpoint to check if the API is running."""
    return jsonify({"status": "OK", "service": "QuickDART Backend"}), 200

# Placeholder login route
@app.route('/api/v1/login', methods=['POST'])
def login_user():
    """
    Real database login.
    """
    # 1. Get data from the React Frontend
    data = request.get_json()
    user_id = data.get('user_id')
    password = data.get('password')

    if not user_id or not password:
        return jsonify({"message": "Missing credentials", "status": "failed"}), 400

# 2. Check Supabase Database
    # This calls the function in models/user.py that queries your new DB
    role = authenticate_user(user_id, password)

    if role:
        # Get Team ID
        session = SessionLocal()
        from models.user import User
        user_obj = session.query(User).filter(User.agency_id == user_id).first()
        team_id = user_obj.team_id if user_obj else None
        session.close()

        # 3. Success! Return the role and a token
        return jsonify({
            "status": "authenticated",
            "token": "mock_jwt_token_123", # In the future, we can make this a real JWT
            "role": role,
            "user_id": user_id,
            "team_id": team_id
        }), 200
    else:
        # 4. Failure
        return jsonify({"message": "Invalid credentials. Please check your Agency ID and Password.", "status": "failed"}), 401
    

# --- TEAM MANAGEMENT ROUTES ---
@app.route('/api/v1/teams/<int:team_id>/deploy', methods=['PUT'])
def deploy_team(team_id):
    """Deploy or recall a team with a specific task"""
    print(f"\n{'='*50}")
    print(f"🔧 DEPLOY TEAM REQUEST - ID: {team_id}")
    
    session = SessionLocal()
    try:
        team = session.query(Team).filter(Team.id == team_id).first()
        if not team:
            print(f"❌ Team #{team_id} not found")
            return jsonify({"error": "Team not found"}), 404
        
        print(f"✅ Found team: {team.name}")
        
        data = request.get_json()
        print(f"📦 Received data: {data}")
        
        new_status = data.get('status')
        new_task = data.get('task', '') # <--- NEW: Extract the task message
        new_report_id = data.get('report_id')
        
        print(f"📝 New status: {new_status}")
        print(f"📋 Task Orders: {new_task}")

        if new_status not in ['Idle', 'Resting']:
            print(f"❌ Invalid status: {new_status} (use POST /deployments for deploying)")
            return jsonify({"error": "Invalid status. Use deployment endpoint to deploy."}), 400

        # Check no active deployments before going Idle/Resting
        active_deps = session.query(Deployment).filter(
            Deployment.team_id == team_id, Deployment.status == 'Active'
        ).count()
        if active_deps > 0 and new_status == 'Idle':
            return jsonify({"error": "Cannot go Idle while active deployments exist. Complete missions first."}), 400

        old_status = team.status
        team.status = new_status
        team.current_task = None
        team.current_report_id = None
        
        session.commit()
        session.refresh(team)
        
        print(f"✅ Status updated: {old_status} → {team.status}")
        
        # Broadcast update via WebSocket
        socketio.emit('resource_updated', {
            'type': 'team',
            'action': 'status_changed',
            'data': team.to_dict()
        })
        
        print(f"✅ Update successful")
        print(f"{'='*50}\n")
        
        return jsonify(team.to_dict()), 200
        
    except Exception as e:
        session.rollback()
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*50}\n")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# --- DEPLOYMENT MANAGEMENT ROUTES ---
@app.route('/api/v1/teams/<int:team_id>/deployments', methods=['GET', 'POST'])
def team_deployments(team_id):
    """GET: list deployments. POST: claim report + deploy personnel."""
    session = SessionLocal()
    try:
        if request.method == 'GET':
            status_filter = request.args.get('status')
            query = session.query(Deployment).filter(Deployment.team_id == team_id)
            if status_filter:
                query = query.filter(Deployment.status == status_filter)
            deps = query.order_by(Deployment.created_at.desc()).all()
            return jsonify([d.to_dict() for d in deps]), 200

        # --- POST: Claim + Deploy (atomic) ---
        data = request.get_json()
        report_id = data.get('report_id')
        personnel_count = data.get('personnel_count', 0)
        task = data.get('task', '')
        asset_ids = data.get('asset_ids', [])

        print(f"\n{'='*50}")
        print(f" DEPLOYMENT REQUEST - Team {team_id} -> Report {report_id}")
        print(f" Personnel: {personnel_count}, Assets: {asset_ids}")

        if not report_id or personnel_count <= 0:
            return jsonify({"error": "report_id and personnel_count > 0 required"}), 400

        # Atomic claim + deploy with row-level locking
        report = session.query(Report).filter(Report.id == report_id).with_for_update().first()
        if not report:
            return jsonify({"error": "Report not found"}), 404

        if report.claimed_by_team_id is not None and report.claimed_by_team_id != team_id:
            return jsonify({"error": "Report already claimed by another team"}), 409

        team = session.query(Team).filter(Team.id == team_id).with_for_update().first()
        if not team:
            return jsonify({"error": "Team not found"}), 404

        avail = team.available_personnel if team.available_personnel is not None else team.personnel_count
        if avail < personnel_count:
            return jsonify({"error": f"Insufficient personnel. Available: {avail}, Requested: {personnel_count}"}), 400

        # Claim the report
        report.claimed_by_team_id = team_id

        # Create deployment
        from datetime import datetime
        dep = Deployment(
            team_id=team_id,
            report_id=report_id,
            personnel_count=personnel_count,
            task=task,
            status='Active',
            created_at=datetime.utcnow()
        )
        session.add(dep)
        session.flush()  # Get dep.id

        # Update team
        team.available_personnel = avail - personnel_count
        team.status = 'Deployed'
        team.current_task = task  # Legacy compat
        team.current_report_id = report_id

        # Deploy selected assets
        if asset_ids:
            assets = session.query(Asset).filter(Asset.id.in_(asset_ids), Asset.team_id == team_id).all()
            for asset in assets:
                asset.status = 'Deployed'
                asset.deployment_id = dep.id
                asset.location = report.location or 'Field'

        session.commit()
        session.refresh(dep)
        session.refresh(team)
        session.refresh(report)

        print(f" Deployment #{dep.id} created. Available personnel: {team.available_personnel}")
        print(f"{'='*50}\n")

        # Broadcast
        socketio.emit('report_claimed', {
            'report_id': report_id,
            'claimed_by_team_id': team_id,
            'team_name': team.name
        })
        socketio.emit('resource_updated', {
            'type': 'team', 'action': 'deployed', 'data': team.to_dict()
        })
        socketio.emit('report_updated', report.to_dict())

        return jsonify({
            "deployment": dep.to_dict(),
            "team": team.to_dict(),
            "report": report.to_dict()
        }), 201

    except Exception as e:
        session.rollback()
        print(f" DEPLOYMENT ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/api/v1/deployments/<int:deployment_id>/complete', methods=['PUT'])
def complete_deployment(deployment_id):
    """Complete a specific deployment — returns personnel + assets."""
    session = SessionLocal()
    try:
        dep = session.query(Deployment).filter(Deployment.id == deployment_id).with_for_update().first()
        if not dep:
            return jsonify({"error": "Deployment not found"}), 404
        if dep.status != 'Active':
            return jsonify({"error": "Deployment already completed"}), 400

        from datetime import datetime
        dep.status = 'Completed'
        dep.completed_at = datetime.utcnow()

        # Return personnel
        team = session.query(Team).filter(Team.id == dep.team_id).with_for_update().first()
        avail = team.available_personnel if team.available_personnel is not None else 0
        team.available_personnel = avail + dep.personnel_count

        # Clear report
        report = session.query(Report).filter(Report.id == dep.report_id).first()
        if report:
            report.status = 'Cleared'

        # Release assets from this deployment
        deployed_assets = session.query(Asset).filter(Asset.deployment_id == deployment_id).all()
        for asset in deployed_assets:
            asset.status = 'Available'
            asset.deployment_id = None
            asset.location = 'Base'

        # Check if team has any remaining active deployments
        remaining = session.query(Deployment).filter(
            Deployment.team_id == dep.team_id,
            Deployment.status == 'Active',
            Deployment.id != deployment_id
        ).count()

        if remaining == 0:
            team.status = 'Idle'
            team.current_task = None
            team.current_report_id = None

        session.commit()
        session.refresh(team)

        print(f" Deployment #{deployment_id} completed. Team {team.name}: {team.available_personnel}/{team.personnel_count} available")

        # Broadcast updates
        if report:
            socketio.emit('report_updated', report.to_dict())
        socketio.emit('resource_updated', {
            'type': 'team', 'action': 'deployment_completed', 'data': team.to_dict()
        })
        socketio.emit('deployment_completed', {
            'deployment_id': deployment_id,
            'team_id': dep.team_id,
            'report_id': dep.report_id
        })

        return jsonify({
            "deployment": dep.to_dict(),
            "team": team.to_dict()
        }), 200

    except Exception as e:
        session.rollback()
        print(f" COMPLETE DEPLOYMENT ERROR: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/api/v1/teams/<int:team_id>/notify', methods=['POST'])
def notify_team(team_id):
    """Send notification to a team"""
    print(f"\n{'='*50}")
    print(f"📢 NOTIFY TEAM REQUEST - ID: {team_id}")
    
    session = SessionLocal()
    try:
        team = session.query(Team).filter(Team.id == team_id).first()
        if not team:
            print(f"❌ Team #{team_id} not found")
            return jsonify({"error": "Team not found"}), 404
        
        print(f"✅ Found team: {team.name}")
        
        data = request.get_json()
        message = data.get('message', '')
        
        print(f"📝 Message: {message}")
        
        # Broadcast notification via WebSocket
        socketio.emit('team_notification', {
            'team_id': team_id,
            'team_name': team.name,
            'message': message,
            'timestamp': datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        })
        
        print(f"✅ Notification sent successfully")
        print(f"{'='*50}\n")
        
        return jsonify({
            "status": "success",
            "message": f"Notification sent to {team.name}"
        }), 200
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*50}\n")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


# --- ASSET MANAGEMENT ROUTES ---
@app.route('/api/v1/assets/<int:asset_id>/deploy', methods=['PUT'])
def deploy_asset(asset_id):
    """Deploy or recall an asset"""
    print(f"\n{'='*50}")
    print(f"🔧 DEPLOY ASSET REQUEST - ID: {asset_id}")
    
    session = SessionLocal()
    try:
        asset = session.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            print(f"❌ Asset #{asset_id} not found")
            return jsonify({"error": "Asset not found"}), 404
        
        print(f"✅ Found asset: {asset.name}")
        
        data = request.get_json()
        print(f"📦 Received data: {data}")
        
        new_status = data.get('status')
        new_location = data.get('location')
        
        print(f"📝 New status: {new_status}")
        print(f"📍 New location: {new_location}")
        
        if new_status not in ['Available', 'Deployed', 'Maintenance']:
            print(f"❌ Invalid status: {new_status}")
            return jsonify({"error": "Invalid status"}), 400
        
        old_status = asset.status
        old_location = asset.location
        
        asset.status = new_status
        if new_location:
            asset.location = new_location
        
        session.commit()
        session.refresh(asset)
        
        print(f"✅ Status updated: {old_status} → {asset.status}")
        print(f"✅ Location updated: {old_location} → {asset.location}")
        
        # Broadcast update via WebSocket
        socketio.emit('resource_updated', {
            'type': 'asset',
            'action': 'status_changed',
            'data': asset.to_dict()
        })
        
        print(f"✅ Update successful")
        print(f"{'='*50}\n")
        
        return jsonify(asset.to_dict()), 200
        
    except Exception as e:
        session.rollback()
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*50}\n")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


@app.route('/api/v1/assets/<int:asset_id>/notify', methods=['POST'])
def notify_asset(asset_id):
    """Send notification for an asset"""
    print(f"\n{'='*50}")
    print(f"📢 NOTIFY ASSET REQUEST - ID: {asset_id}")
    
    session = SessionLocal()
    try:
        asset = session.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            print(f"❌ Asset #{asset_id} not found")
            return jsonify({"error": "Asset not found"}), 404
        
        print(f"✅ Found asset: {asset.name}")
        
        data = request.get_json()
        message = data.get('message', '')
        
        print(f"📝 Message: {message}")
        
        # Broadcast notification via WebSocket
        socketio.emit('asset_notification', {
            'asset_id': asset_id,
            'asset_name': asset.name,
            'message': message,
            'timestamp': datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        })
        
        print(f"✅ Notification sent successfully")
        print(f"{'='*50}\n")
        
        return jsonify({
            "status": "success",
            "message": f"Notification sent for {asset.name}"
        }), 200
        
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        print(f"{'='*50}\n")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()


def predict_from_frames(frames, sid=None, view='ground'):
    """
    Given a list of PIL Images (frames), runs both models on each frame.
    `view` selects the model bundle: 'ground' (default) or 'aerial'.
    Returns a dict with majority-voted results, full distributions, and per-frame predictions.
    Optionally emits progress via Socket.IO if sid is provided.
    """
    type_model, damage_models, type_gradcam, damage_gradcams = get_models_for_view(view)

    type_votes = []
    damage_votes = []
    type_confidences = []
    damage_confidences = []
    per_frame_predictions = []
    total = len(frames)

    for i, frame in enumerate(frames):
        # Emit progress update
        if sid:
            try:
                socketio.emit('analysis_progress', {
                    'stage': 'analyzing',
                    'current': i + 1,
                    'total': total,
                    'message': f'Analyzing frame {i + 1}/{total}...'
                })
            except Exception:
                pass

        tensor = transform(frame).unsqueeze(0)

        with torch.no_grad():
            # Disaster Type
            type_outputs = type_model(tensor)
            type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
            type_conf, type_pred = torch.max(type_probs, 1)
            type_votes.append(type_pred.item())
            type_confidences.append(type_conf.item() * 100)

            # Damage Level — skip if "No Disaster"
            detected_type = TYPE_CLASS_NAMES[type_pred.item()]
            is_no_disaster = detected_type == 'No Disaster'
            if is_no_disaster:
                damage_votes.append(-1)
                damage_confidences.append(0.0)
            else:
                frame_damage_model = damage_models.get(detected_type)
                if frame_damage_model:
                    damage_outputs = frame_damage_model(tensor)
                    damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
                    damage_conf, damage_pred = torch.max(damage_probs, 1)
                    damage_votes.append(damage_pred.item())
                    damage_confidences.append(damage_conf.item() * 100)
                else:
                    damage_votes.append(-1)
                    damage_confidences.append(0.0)

        # Compute Grad-CAM bounding boxes for this frame
        gradcam_data = {}
        if is_no_disaster:
            # Only compute type Grad-CAM, skip damage
            if type_gradcam:
                try:
                    type_heatmap, _ = type_gradcam.compute_heatmap(tensor)
                    from gradcam import heatmap_to_bbox
                    import numpy as np
                    gradcam_data = {
                        "type_bbox": heatmap_to_bbox(type_heatmap),
                        "damage_bbox": None,
                        "damage_bboxes": [],
                        "type_heatmap": np.round(type_heatmap, 3).tolist(),
                        "damage_heatmap": None
                    }
                except Exception as e:
                    print(f"  [Grad-CAM] ERROR on frame {i}: {e}", flush=True)
        elif type_gradcam:
            frame_damage_gradcam = damage_gradcams.get(detected_type)
            if frame_damage_gradcam:
                try:
                    frame_damage_model = damage_models.get(detected_type)
                    gradcam_data = compute_gradcam_for_frame(
                        type_model, frame_damage_model, tensor,
                        type_gradcam, frame_damage_gradcam
                    )
                    print(f"  [Grad-CAM] Frame {i}: type_bbox={gradcam_data.get('type_bbox')}, damage_bbox={gradcam_data.get('damage_bbox')}", flush=True)
                except Exception as e:
                    import traceback
                    print(f"  [Grad-CAM] ERROR on frame {i}: {e}", flush=True)
                    traceback.print_exc()
            else:
                print(f"  [Grad-CAM] SKIPPED frame {i}: no damage gradcam for type={detected_type}", flush=True)
        else:
            print(f"  [Grad-CAM] SKIPPED frame {i}: type_gradcam={type_gradcam is not None}", flush=True)

        per_frame_predictions.append({
            "frame_index": i,
            "type": TYPE_CLASS_NAMES[type_pred.item()],
            "type_conf": round(type_conf.item() * 100, 2),
            "damage": "No Damage" if (is_no_disaster or damage_votes[-1] == -1) else DAMAGE_CLASS_NAMES[damage_pred.item()],
            "damage_conf": 0.0 if (is_no_disaster or damage_votes[-1] == -1) else round(damage_conf.item() * 100, 2),
            "type_bbox": gradcam_data.get("type_bbox"),
            "damage_bbox": gradcam_data.get("damage_bbox"),
            "damage_bboxes": gradcam_data.get("damage_bboxes", []),
            "type_heatmap": gradcam_data.get("type_heatmap"),
            "damage_heatmap": gradcam_data.get("damage_heatmap"),
        })

    # ── Confidence & consensus thresholds ──
    CONFIDENCE_THRESHOLD = 50.0       # Below this, treat as "No Disaster"
    SUPERMAJORITY_RATIO = 0.6         # ≥60% of frames must agree on a disaster type
    AVG_CONFIDENCE_FLOOR = 45.0       # Average confidence across ALL frames must exceed this

    # Majority vote for initial classification
    final_type_idx = max(set(type_votes), key=type_votes.count)
    winning_vote_count = type_votes.count(final_type_idx)

    # Average confidence only for frames that voted for the winning class
    winning_type_confs = [c for c, v in zip(type_confidences, type_votes) if v == final_type_idx]
    avg_type_confidence = sum(winning_type_confs) / len(winning_type_confs)

    # Average confidence across ALL frames (not just winners)
    avg_all_confidence = sum(type_confidences) / len(type_confidences)

    # ── Stricter video consensus checks ──
    # Override to "No Disaster" if the prediction is unreliable:
    #   1. Winning confidence is too low
    #   2. Winning class doesn't have supermajority of frames
    #   3. Average confidence across all frames is too low (model is guessing)
    no_disaster_idx = TYPE_CLASS_NAMES.index('No Disaster')
    is_disaster_prediction = TYPE_CLASS_NAMES[final_type_idx] != 'No Disaster'

    overridden_to_no_disaster = False
    if is_disaster_prediction:
        vote_ratio = winning_vote_count / total
        if avg_type_confidence < CONFIDENCE_THRESHOLD:
            print(f"[CONSENSUS] Override to No Disaster: winning confidence {avg_type_confidence:.1f}% < {CONFIDENCE_THRESHOLD}% threshold", flush=True)
            overridden_to_no_disaster = True
        elif vote_ratio < SUPERMAJORITY_RATIO:
            print(f"[CONSENSUS] Override to No Disaster: only {winning_vote_count}/{total} frames ({vote_ratio*100:.0f}%) agree, need {SUPERMAJORITY_RATIO*100:.0f}%", flush=True)
            overridden_to_no_disaster = True
        elif avg_all_confidence < AVG_CONFIDENCE_FLOOR:
            print(f"[CONSENSUS] Override to No Disaster: avg confidence across all frames {avg_all_confidence:.1f}% < {AVG_CONFIDENCE_FLOOR}% floor", flush=True)
            overridden_to_no_disaster = True

    if overridden_to_no_disaster:
        final_type_idx = no_disaster_idx
        avg_type_confidence = 100.0 - avg_all_confidence  # Invert: low disaster confidence = high no-disaster confidence

    is_final_no_disaster = TYPE_CLASS_NAMES[final_type_idx] == 'No Disaster'

    if is_final_no_disaster:
        final_damage_idx = -1
        avg_damage_confidence = 0.0
    else:
        valid_damage_votes = [v for v in damage_votes if v != -1]
        if valid_damage_votes:
            final_damage_idx = max(set(valid_damage_votes), key=valid_damage_votes.count)
            winning_damage_confs = [c for c, v in zip(damage_confidences, damage_votes) if v == final_damage_idx]
            avg_damage_confidence = sum(winning_damage_confs) / len(winning_damage_confs)
        else:
            final_damage_idx = -1
            avg_damage_confidence = 0.0

    # Compute vote distributions (percentage of frames voting for each class)
    total = len(type_votes)
    type_distribution = {}
    for idx, name in enumerate(TYPE_CLASS_NAMES):
        count = type_votes.count(idx)
        type_distribution[name] = round((count / total) * 100, 1)

    damage_distribution = {}
    if is_final_no_disaster:
        damage_distribution = {"No Damage": 100.0}
    else:
        for idx, name in enumerate(DAMAGE_CLASS_NAMES):
            count = damage_votes.count(idx)
            damage_distribution[name] = round((count / total) * 100, 1)

    return {
        "primary_type": TYPE_CLASS_NAMES[final_type_idx],
        "primary_damage": "No Damage" if is_final_no_disaster else DAMAGE_CLASS_NAMES[final_damage_idx],
        "type_confidence": round(avg_type_confidence, 2),
        "damage_confidence": round(avg_damage_confidence, 2),
        "type_distribution": type_distribution,
        "damage_distribution": damage_distribution,
        "per_frame_predictions": per_frame_predictions,
        "consensus_override": overridden_to_no_disaster
    }


def extract_frames(video_path, num_frames=10):
    """
    Extracts up to `num_frames` evenly spaced frames from a video.
    Returns a list of PIL Images.

    Works on non-seekable streams (e.g. fragmented WebM from MediaRecorder) by
    reading sequentially when the container has no frame index — seeking with
    CAP_PROP_POS_FRAMES on a fragmented WebM can segfault the FFmpeg demuxer.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    def _to_pil(bgr):
        return Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    if total_frames > 0:
        target_indices = set(int(i * total_frames / num_frames) for i in range(num_frames))
        frames, i = [], 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if i in target_indices:
                frames.append(_to_pil(frame))
                if len(frames) >= num_frames:
                    break
            i += 1
        cap.release()
        return frames

    # Fragmented / non-seekable stream: scan once, then evenly subsample.
    all_frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        all_frames.append(frame)
    cap.release()

    if not all_frames:
        return []

    step = max(1, len(all_frames) // num_frames)
    return [_to_pil(f) for f in all_frames[::step][:num_frames]]

# --- AI ANALYSIS ROUTE (UPDATED TO SAVE IMAGE) ---
@app.route('/api/v1/analyze', methods=['POST'])
def analyze_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # 1. Read uploaded bytes into memory and detect type
        original_name = file.filename
        file_ext = os.path.splitext(original_name)[1].lower()
        filename = f"{uuid.uuid4().hex}{file_ext}"
        file_bytes = file.read()

        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'}
        is_video = file_ext in video_extensions
        content_type = (
            file.mimetype
            or mimetypes.guess_type(original_name)[0]
            or ('video/mp4' if is_video else 'application/octet-stream')
        )
        print(f"DEBUG: filename={filename}, ext={file_ext}, is_video={is_video}, content_type={content_type}, size={len(file_bytes)}")

        # 2. Pick model bundle based on requested view (ground = phone, aerial = drone)
        view = (request.form.get('view') or 'ground').lower()
        type_model, damage_models, type_gradcam, damage_gradcams = get_models_for_view(view)

        if not type_model:
            return jsonify({"error": "Type model not loaded"}), 500
        if not any(damage_models.values()):
            return jsonify({"error": "No damage models loaded"}), 500

        # 3. Push the original media to Supabase Storage and use its public URL.
        #    The local 'static/uploads/' directory is no longer used in production.
        try:
            image_url = upload_to_storage(file_bytes, filename, content_type)
        except Exception as e:
            print(f"Storage upload failed: {e}")
            return jsonify({"error": f"Storage upload failed: {e}"}), 500

        if is_video:
            # --- VIDEO PATH ---
            # cv2 needs a real file path, so stage the bytes in a temp file just for extraction.
            tmp = tempfile.NamedTemporaryFile(suffix=file_ext, delete=False)
            try:
                tmp.write(file_bytes)
                tmp.close()
                tmp_path = tmp.name

                socketio.emit('analysis_progress', {
                    'stage': 'extracting',
                    'message': 'Extracting frames from video...'
                })

                try:
                    frames = extract_frames(tmp_path, num_frames=10)
                except Exception as e:
                    print(f"Frame extraction failed: {e}", flush=True)
                    return jsonify({"error": f"Could not decode video: {e}"}), 400

                if not frames:
                    return jsonify({"error": "Could not extract frames from video"}), 400

                # Get video metadata for timeline sync
                cap = cv2.VideoCapture(tmp_path)
                fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                total_frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                if total_frame_count <= 0:
                    # Fragmented WebM: FRAME_COUNT is unreliable. Approximate from analyzed sample.
                    total_frame_count = len(frames)
                video_duration = total_frame_count / fps if fps > 0 else 0
                cap.release()
            finally:
                try: os.unlink(tmp.name)
                except OSError: pass

            result = predict_from_frames(frames, sid=True, view=view)

            socketio.emit('analysis_progress', {
                'stage': 'complete',
                'message': 'Analysis complete!'
            })

            return jsonify({
                "type": result["primary_type"],
                "confidence": result["type_confidence"],
                "damage": result["primary_damage"],
                "damage_confidence": result["damage_confidence"],
                "image_url": image_url,
                "source": "video",
                "type_distribution": result["type_distribution"],
                "damage_distribution": result["damage_distribution"],
                "per_frame_predictions": result["per_frame_predictions"],
                "video_duration": round(video_duration, 2),
                "fps": round(fps, 2),
                "total_analyzed_frames": len(frames),
                "consensus_override": result.get("consensus_override", False)
            })

        else:
            # --- IMAGE PATH ---
            # We already have the bytes in memory from the request; no disk roundtrip needed.
            image = Image.open(io.BytesIO(file_bytes)).convert('RGB')
            tensor = transform(image).unsqueeze(0)

            with torch.no_grad():
                type_outputs = type_model(tensor)
                type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
                type_conf, type_pred = torch.max(type_probs, 1)

            detected_type = TYPE_CLASS_NAMES[type_pred.item()]
            type_conf_pct = round(type_conf.item() * 100, 2)

            # ── Confidence threshold gate for images ──
            # If the model's best guess is a disaster but confidence is below 50%,
            # the model is likely guessing — override to "No Disaster"
            IMAGE_CONFIDENCE_THRESHOLD = 50.0
            consensus_override = False
            if detected_type != 'No Disaster' and type_conf_pct < IMAGE_CONFIDENCE_THRESHOLD:
                print(f"[THRESHOLD] Override to No Disaster: image confidence {type_conf_pct:.1f}% < {IMAGE_CONFIDENCE_THRESHOLD}% threshold", flush=True)
                detected_type = 'No Disaster'
                consensus_override = True

            is_no_disaster = detected_type == 'No Disaster'

            if is_no_disaster:
                detected_damage = "No Damage"
                damage_conf_val = 0.0
                damage_distribution = {"No Damage": 100.0}
            else:
                frame_damage_model = damage_models.get(detected_type)
                if frame_damage_model:
                    with torch.no_grad():
                        damage_outputs = frame_damage_model(tensor)
                        damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
                        damage_conf, damage_pred = torch.max(damage_probs, 1)
                    detected_damage = DAMAGE_CLASS_NAMES[damage_pred.item()]
                    damage_conf_val = round(damage_conf.item() * 100, 2)
                    damage_distribution = {}
                    for idx, name in enumerate(DAMAGE_CLASS_NAMES):
                        damage_distribution[name] = round(damage_probs[0][idx].item() * 100, 1)
                else:
                    detected_damage = "No Damage"
                    damage_conf_val = 0.0
                    damage_distribution = {"No Damage": 100.0}

            # Build type distributions from softmax probabilities
            type_distribution = {}
            for idx, name in enumerate(TYPE_CLASS_NAMES):
                type_distribution[name] = round(type_probs[0][idx].item() * 100, 1)

            # Compute Grad-CAM for the image
            gradcam_data = {}
            if is_no_disaster:
                if type_gradcam:
                    try:
                        type_heatmap, _ = type_gradcam.compute_heatmap(tensor)
                        from gradcam import heatmap_to_bbox
                        import numpy as np
                        gradcam_data = {
                            "type_bbox": heatmap_to_bbox(type_heatmap),
                            "damage_bbox": None,
                            "damage_bboxes": [],
                            "type_heatmap": np.round(type_heatmap, 3).tolist(),
                            "damage_heatmap": None
                        }
                    except Exception as e:
                        print(f"Grad-CAM error on image: {e}", flush=True)
            elif type_gradcam:
                frame_damage_gradcam = damage_gradcams.get(detected_type)
                if frame_damage_gradcam:
                    try:
                        gradcam_data = compute_gradcam_for_frame(
                            type_model, frame_damage_model, tensor,
                            type_gradcam, frame_damage_gradcam
                        )
                    except Exception as e:
                        print(f"Grad-CAM error on image: {e}", flush=True)

            return jsonify({
                "type": detected_type,
                "confidence": type_conf_pct if not consensus_override else round(100.0 - type_conf_pct, 2),
                "damage": detected_damage,
                "damage_confidence": damage_conf_val,
                "image_url": image_url,
                "source": "image",
                "type_distribution": type_distribution,
                "damage_distribution": damage_distribution,
                "consensus_override": consensus_override,
                "per_frame_predictions": [{
                    "frame_index": 0,
                    "type": detected_type,
                    "type_conf": type_conf_pct if not consensus_override else round(100.0 - type_conf_pct, 2),
                    "damage": detected_damage,
                    "damage_conf": damage_conf_val,
                    "type_bbox": gradcam_data.get("type_bbox"),
                    "damage_bbox": gradcam_data.get("damage_bbox"),
                    "damage_bboxes": gradcam_data.get("damage_bboxes", []),
                    "type_heatmap": gradcam_data.get("type_heatmap"),
                    "damage_heatmap": gradcam_data.get("damage_heatmap"),
                }]
            })

    except Exception as e:
        print(f"Prediction Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# --- REPORTS ROUTES (UPDATED TO SAVE IMAGE URL) ---
@app.route('/api/v1/reports', methods=['GET', 'POST'])
def handle_reports():
    session = SessionLocal()
    
    if request.method == 'GET':
        try:
            # Check if filtering by team_id is requested
            team_id = request.args.get('team_id')

            reports = session.query(Report).order_by(Report.id.desc()).all()

            if team_id:
                # 1. Get the Team's Base Location
                team = session.query(Team).filter(Team.id == team_id).first()

                if team and team.base_latitude and team.base_longitude:
                    filtered_reports = []
                    for r in reports:
                        # Only check if report has valid coords
                        if r.latitude and r.longitude:
                            dist = haversine_distance(
                                team.base_latitude, team.base_longitude,
                                r.latitude, r.longitude
                            )
                            # 2. Check if within Radius
                            if dist <= team.coverage_radius_km:
                                filtered_reports.append(r)

                    return jsonify([r.to_dict() for r in filtered_reports]), 200

            # If no team_id or no location set, return ALL reports (for Admin)
            return jsonify([r.to_dict() for r in reports]), 200
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            session.close()
            
    elif request.method == 'POST':
        from datetime import datetime
        try:
            data = request.get_json()
            
            # 1. Extract Coords
            lat = data.get('latitude')
            lng = data.get('longitude')
            
            # 2. Determine Location Name (Backend Side)
            location_name = data.get('location', 'Unknown')
            if lat and lng:
                location_name = get_address_from_coords(lat, lng)

            # 3. Save Report with Image URL and AI analysis data
            new_report = Report(
                title=data.get('title'),
                description=data.get('description'),
                status=data.get('status', 'Active'),
                location=location_name,
                latitude=lat,
                longitude=lng,
                timestamp=datetime.utcnow(),
                damage_level=data.get('damage_level', 'Pending'),
                image_url=data.get('image_url'),
                disaster_type=data.get('disaster_type'),
                confidence=data.get('confidence'),
                analysis_metadata=data.get('analysis_metadata')
            )
            session.add(new_report)
            session.commit()
            session.refresh(new_report)

            socketio.emit('new_report', new_report.to_dict())

            return jsonify(new_report.to_dict()), 201
        except Exception as e:
            session.rollback()
            return jsonify({"error": str(e)}), 500
        finally:
            session.close()

def get_address_from_coords(lat, lng):
    """
    Converts Lat/Lng to a readable address using OpenStreetMap (Nominatim).
    """
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}"
        # User-Agent is required by OSM policy
        headers = {'User-Agent': 'QuickDART/1.0 (education_project)'}
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.ok:
            data = response.json()
            # Get the full display name, or fallback to city/town
            return data.get('display_name', f"Unknown Location ({lat}, {lng})")
    except Exception as e:
        print(f"Geocoding Error: {e}")
    
    return f"GPS: {lat}, {lng}"

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance (km) between two GPS points"""
    # Convert to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [float(lat1), float(lon1), float(lat2), float(lon2)])
    
    dlat = lat2 - lat1 
    dlon = lon2 - lon1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    return c * 6371 # Radius of earth in km

@app.route('/api/v1/reports/<int:report_id>', methods=['PUT'])
def update_report(report_id):
      
    print(f"\n{'='*50}", flush=True)
    print(f" UPDATE REQUEST for Report ID: {report_id}", flush=True)

    session = SessionLocal()
    try:
        report = session.query(Report).filter(Report.id == report_id).first()
        if not report:
            print(f" Report #{report_id} not found in database", flush=True)
            return jsonify({"error": "Report not found"}), 404
        
        print(f"✅ Found report: {report.title}", flush=True)
        
        data = request.get_json()
        print(f"📦 Received data: {data}", flush=True)

        if not data:
            print("No data received in request body", flush=True)
            return jsonify({"error": "No data provided"}), 400
        
        # 3. Store old values for logging
        old_status = report.status
        old_damage = report.damage_level
        
        # Update fields if provided
        if 'status' in data:
            report.status = data['status']
            print(f"   Status: {old_status} → {report.status}", flush=True)

        if 'damage_level' in data:
            report.damage_level = data['damage_level']
            print(f"   Damage: {old_damage} → {report.damage_level}", flush=True)

        if 'disaster_type' in data:
            old_type = report.disaster_type
            report.disaster_type = data['disaster_type']
            print(f"   Type: {old_type} → {report.disaster_type}", flush=True)

        if 'notes' in data:
            report.notes = data['notes']
            print(f"   Notes updated", flush=True)

        if 'claimed_by_team_id' in data:
            old_claimed = report.claimed_by_team_id
            report.claimed_by_team_id = data['claimed_by_team_id']
            print(f"   Claimed by team: {old_claimed} → {report.claimed_by_team_id}", flush=True)

        session.commit()
        session.refresh(report)
        print(" Database updated successfully", flush=True)

        updated_data = report.to_dict()

        print(f" Sending response: {updated_data}", flush=True)
        print(f" Broadcasting update via Socket.IO...", flush=True)

        socketio.emit('report_updated', updated_data)

        print(f" Broadcast complete", flush=True)
        print(f"{'='*50}\n", flush=True)

        return jsonify(updated_data), 200
        
    except Exception as e:
        session.rollback()

        print(f" ERROR during update: {str(e)}", flush=True)
        print(f" Error type: {type(e).__name__}", flush=True)
        import traceback
        traceback.print_exc()
        print(f"{'='*50}\n", flush=True)

        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

# --- LIVE CAMERA ANALYSIS ---

import time as _time
import base64

_last_live_analysis = {}  # Per-client throttle: {sid: timestamp}

@socketio.on('analyze_live_frame')
def handle_live_frame(data):
    """
    Receives a base64-encoded JPEG frame from the browser.
    Runs both models + Grad-CAM and emits bounding box results back.
    `data['view']` selects the model bundle: 'aerial' (default for live drone) or 'ground'.
    """
    from flask import request as flask_request
    sid = flask_request.sid

    # Throttle: skip if last analysis was < 500ms ago
    now = _time.time()
    if sid in _last_live_analysis and (now - _last_live_analysis[sid]) < 0.5:
        return
    _last_live_analysis[sid] = now

    # Live feed defaults to aerial (drone perspective) but client can override
    view = (data.get('view') or 'aerial').lower()
    type_model, damage_models, type_gradcam, damage_gradcams = get_models_for_view(view)

    if not type_model:
        emit('live_frame_result', {'error': 'Type model not loaded'})
        return

    try:
        frame_data = data.get('frame', '')
        # Strip data URL prefix if present
        if ',' in frame_data:
            frame_data = frame_data.split(',', 1)[1]

        image_bytes = base64.b64decode(frame_data)
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        tensor = transform(image).unsqueeze(0)

        with torch.no_grad():
            type_outputs = type_model(tensor)
            type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
            type_conf, type_pred = torch.max(type_probs, 1)

        detected_type = TYPE_CLASS_NAMES[type_pred.item()]
        is_no_disaster = detected_type == 'No Disaster'

        if is_no_disaster:
            detected_damage = "No Damage"
            damage_conf_val = 0.0
        else:
            frame_damage_model = damage_models.get(detected_type)
            if frame_damage_model:
                with torch.no_grad():
                    damage_outputs = frame_damage_model(tensor)
                    damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
                    damage_conf, damage_pred = torch.max(damage_probs, 1)
                detected_damage = DAMAGE_CLASS_NAMES[damage_pred.item()]
                damage_conf_val = round(damage_conf.item() * 100, 2)
            else:
                detected_damage = "No Damage"
                damage_conf_val = 0.0

        # Compute Grad-CAM bounding boxes
        gradcam_data = {}
        if is_no_disaster:
            if type_gradcam:
                try:
                    type_heatmap, _ = type_gradcam.compute_heatmap(tensor)
                    from gradcam import heatmap_to_bbox
                    import numpy as np
                    gradcam_data = {
                        "type_bbox": heatmap_to_bbox(type_heatmap),
                        "damage_bbox": None,
                        "damage_bboxes": [],
                        "type_heatmap": np.round(type_heatmap, 3).tolist(),
                        "damage_heatmap": None
                    }
                except Exception as e:
                    print(f"[Live Grad-CAM] Error: {e}", flush=True)
        elif type_gradcam:
            frame_damage_gradcam = damage_gradcams.get(detected_type)
            if frame_damage_gradcam:
                try:
                    frame_damage_model = damage_models.get(detected_type)
                    gradcam_data = compute_gradcam_for_frame(
                        type_model, frame_damage_model, tensor,
                        type_gradcam, frame_damage_gradcam
                    )
                except Exception as e:
                    print(f"[Live Grad-CAM] Error: {e}", flush=True)

        emit('live_frame_result', {
            'type': detected_type,
            'type_confidence': round(type_conf.item() * 100, 2),
            'damage': detected_damage,
            'damage_confidence': damage_conf_val,
            'type_bbox': gradcam_data.get('type_bbox'),
            'damage_bbox': gradcam_data.get('damage_bbox'),
            'damage_bboxes': gradcam_data.get('damage_bboxes', []),
            'frame_width': image.width,
            'frame_height': image.height,
            'timestamp': data.get('timestamp')
        })

    except Exception as e:
        print(f"[Live Analysis] Error: {e}", flush=True)
        emit('live_frame_result', {'error': str(e)})

@socketio.on('disconnect')
def handle_disconnect():
    from flask import request as flask_request
    _last_live_analysis.pop(flask_request.sid, None)

# --- CHAT / COMMUNICATION EVENTS ---

@socketio.on('join_room')
def handle_join(data):
    # Teams join a room based on their ID (e.g., "team_1")
    # Admin joins "admin_room"
    room = data.get('room')
    from flask_socketio import join_room
    join_room(room)
    print(f"📡 Client joined room: {room}")

@socketio.on('send_message')
def handle_message(data):
    """
    Saves message to DB, then relays it to Teams and Admin.
    """
    print(f"💬 Message: {data}")
    target = data.get('target_room')
    
    # --- 1. SAVE TO DATABASE (This was missing!) ---
    session = SessionLocal()
    try:
        # Import Message model inside to avoid circular errors
        from models.resources import Message 
        
        new_msg = Message(
            sender=data.get('sender'),
            target_room=target,
            content=data.get('message')
        )
        session.add(new_msg)
        session.commit()
        
        # Update timestamp to match the server time format
        data['timestamp'] = new_msg.timestamp.isoformat() + "Z"
        
        print("✅ Message saved to DB")
    except Exception as e:
        print(f"❌ Error saving message: {e}")
        session.rollback()
    finally:
        session.close()
    # -----------------------------------------------

    # 2. Send to the specific target room (Responder listens here)
    emit('receive_message', data, room=target)
    
    # 3. If the sender is the Admin, bounce it back to the Admin Room 
    if data.get('sender') == 'Admin':
        emit('receive_message', data, room='admin_room')
    
    # 4. If the sender is a Team, forward it to the Admin Room
    else:
        emit('receive_message', data, room='admin_room')

@app.route('/api/v1/chat/history/<string:room_name>', methods=['GET'])
def get_chat_history(room_name):
    session = SessionLocal()
    try:
        # Import Message model inside to avoid circular errors
        from models.resources import Message
        
        # Fetch messages for this room, sorted by time
        messages = session.query(Message).filter(Message.target_room == room_name).order_by(Message.timestamp.asc()).all()
        
        return jsonify([m.to_dict() for m in messages]), 200
    except Exception as e:
        print(f"History Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

# --- CRUD: ADD & REMOVE RESOURCES ---

@app.route('/api/v1/teams', methods=['POST'])
def create_team():
    """Create a new Team"""
    print("\n--- 🚀 STARTING CREATE TEAM PROCESS ---") 

    session = SessionLocal()
    try:
        data = request.get_json()
        print(f"📦 Received Data: {data}") 

        # 1. Check if user already exists locally to prevent duplicates
        if data.get('email'):
            existing_user = session.query(User).filter(User.agency_id == data['email']).first()
            if existing_user:
                return jsonify({"error": "Email already exists"}), 400

        print("🛠️ Attempting to create local Team record...") 

        # --- FIX: ADDED LOCATION DATA HERE ---
        new_team = Team(
            name=data['name'],
            department=data['department'],
            personnel_count=int(data['personnel_count']),
            status='Idle',
            # 👇 THESE WERE MISSING 👇
            base_latitude=data.get('base_latitude'),   
            base_longitude=data.get('base_longitude'), 
            coverage_radius_km=float(data.get('coverage_radius_km', 3.0))
            # 👆 ------------------- 👆
        )

        session.add(new_team)
        session.commit()
        session.refresh(new_team)

        print(f"✅ Local Team Created! ID: {new_team.id}, Name: {new_team.name}") 

        email = data.get('email')
        password = data.get('password')

        if email and password:
            print(f"🔑 Credentials found for: {email}. Attempting Supabase creation...") 
            
            # 2. Create User in Supabase
            if supabase:
                try:
                    print("☁️ Connecting to Supabase...") 
                    user_data = {
                        "email": email,
                        "password": password,
                        "email_confirm": True
                    }
                    response = supabase.auth.admin.create_user(user_data)
                    print(f"✅ Supabase User Created Successfully! ID: {response.user.id}") 
                except Exception as sb_error:
                    print(f"❌ Supabase Error (User might exist, continuing): {sb_error}")

            # 3. Create User in Local DB (Linked to the new Team)
            print("🛠️ Creating local User record...") 
            new_user = User(
                agency_id=email, 
                password_hash="managed_by_supabase", 
                role="Responder",  # Changed from FieldAgent to match your other code
                team_id=new_team.id 
            )
            session.add(new_user)
            session.commit()
            print("✅ Local User Linked Successfully!") 
        
        socketio.emit('resource_updated', {'type': 'team', 'action': 'created'})
        print("--- 🏁 PROCESS COMPLETE ---\n")

        return jsonify(new_team.to_dict()), 201

    except Exception as e:
        session.rollback()
        print(f"\n❌ FATAL ERROR in create_team: {str(e)}") 
        import traceback
        traceback.print_exc() 
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/api/v1/teams/<int:team_id>', methods=['DELETE'])
def delete_team(team_id):
    """Delete a Team AND all its Assets and Users (Cascade Delete)"""

    print(f"\n🗑️ REQUEST: Delete Team ID {team_id}")

    session = SessionLocal()
    try:
        team = session.query(Team).filter(Team.id == team_id).first()
        if not team:
            print("❌ Team not found in DB")
            return jsonify({"error": "Team not found"}), 404
        
        # 0a. UNCLAIM reports that reference this team
        claimed_reports = session.query(Report).filter(Report.claimed_by_team_id == team_id).all()
        print(f"   > Found {len(claimed_reports)} claimed reports. Unclaiming...")
        for r in claimed_reports:
            r.claimed_by_team_id = None

        # 0b. DELETE Linked Deployments
        from models.resources import Asset, Deployment
        deployments = session.query(Deployment).filter(Deployment.team_id == team_id).all()
        print(f"   > Found {len(deployments)} linked deployments. Deleting...")
        for dep in deployments:
            session.delete(dep)

        # 1. DELETE Linked Assets
        assets = session.query(Asset).filter(Asset.team_id == team_id).all()
        print(f"   > Found {len(assets)} linked assets. Deleting...")
        for asset in assets:
            session.delete(asset)
            
        # 2. DELETE Linked Users
        from models.user import User
        users = session.query(User).filter(User.team_id == team_id).all()
        print(f"   > Found {len(users)} linked users. Deleting...")

        for user in users:
            # --- SUPABASE DELETION LOGIC ---
            if supabase:
                try:
                    print(f"     > Attempting to remove {user.agency_id} from Supabase...")

                    # Get the list (Note: this returns a UserList object)
                    response = supabase.auth.admin.list_users()

                    # SAFELY EXTRACT THE USER LIST
                    # Newer SDKs store the list inside '.users'
                    sb_users = response.users if hasattr(response, 'users') else response
                    
                    target_uid = None
                    for sb_user in sb_users:
                        if sb_user.email.lower() == user.agency_id.lower():
                            target_uid = sb_user.id
                            break
                    if target_uid:
                        supabase.auth.admin.delete_user(target_uid)
                        print(f"     ✅ Supabase Account Deleted: {user.agency_id}")
                    else:
                        print(f"     ⚠️ User {user.agency_id} not found in Supabase (might be already deleted).")
                        
                except Exception as sb_error:
                    print(f"     ❌ Supabase Error (Continuing anyway): {sb_error}")
            # -------------------------------
        # Delete from Local DB
            session.delete(user)
            
        # 4. FLUSH (Force DB to process user deletions first)
        session.flush() 

        # 5. DELETE the Team
        print(f"   > Deleting Team '{team.name}'...")
        session.delete(team)
        
        # 6. COMMIT
        session.commit()
        print("✅ DELETE SUCCESSFUL")
        
        socketio.emit('resource_updated', {'type': 'team', 'action': 'deleted'})
        return jsonify({"message": "Team and Accounts deleted successfully"}), 200
        
    except Exception as e:
        session.rollback()
        print(f"❌ DELETE FAILED: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/api/v1/assets', methods=['POST'])
def create_asset():
    """Create a new Asset"""
    session = SessionLocal()
    try:
        data = request.get_json()
        new_asset = Asset(
            name=data['name'],
            type=data['type'], # e.g., "Vehicle", "Drone"
            location=data['location'],
            status='Available', # Default status
            team_id=data.get('team_id')
        )
        session.add(new_asset)
        session.commit()
        
        socketio.emit('resource_updated', {'type': 'asset', 'action': 'created'})
        return jsonify({"message": "Asset created successfully"}), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/api/v1/assets/<int:asset_id>', methods=['DELETE'])
def delete_asset(asset_id):
    """Delete an Asset"""
    session = SessionLocal()
    try:
        asset = session.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return jsonify({"error": "Asset not found"}), 404
        
        session.delete(asset)
        session.commit()
        
        socketio.emit('resource_updated', {'type': 'asset', 'action': 'deleted'})
        return jsonify({"message": "Asset deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()
        

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    print(f"INFO:root:Starting Flask API server on port {port} (debug={debug})...")
    socketio.run(app, debug=debug, use_reloader=False, host='0.0.0.0', port=port, allow_unsafe_werkzeug=True)