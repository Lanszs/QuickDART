import cv2
import sys
import os
import uuid 
import math
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
from models.resources import Asset, Team

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

# --- SUPABASE CONFIGURATION (SCALABILITY UPGRADE) ---
# Replace these with your actual Supabase URL and SERVICE ROLE KEY (not the anon key!)
SUPABASE_URL = "https://udmnaaqvdlckyhexuyqv.supabase.co" 
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbW5hYXF2ZGxja3loZXh1eXF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDE2OTQwOSwiZXhwIjoyMDc5NzQ1NDA5fQ.cx3ob8w0HliIzmq1roV_zaYdOw-BbTz3VPmC6mfwy5Q"
# Initialize Supabase Client
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"⚠️ Warning: Supabase not configured. User creation will be local only. {e}")
    supabase = None

# Set up Static Folder for Images
app = Flask(__name__, static_folder='static') 
CORS(app, resources={r"/*": {"origins": "*"}}) # Allow all origins to fix image loading issues

socketio = SocketIO(app, cors_allowed_origins="*")

TYPE_CLASS_NAMES = ['Earthquake', 'Fire', 'Flood']
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
TYPE_MODEL_PATH = os.path.join(BASE_DIR, 'ml_engine', 'disaster_type_model.pth')
DAMAGE_MODEL_PATH = os.path.join(BASE_DIR, 'ml_engine', 'damage_assessment_model.pth')

# --- AUTO-MIGRATION: Add missing columns to reports table ---
def run_migrations():
    """Adds new columns if they don't exist. Non-destructive."""
    from sqlalchemy import text, inspect
    try:
        inspector = inspect(engine)
        existing_columns = [col['name'] for col in inspector.get_columns('reports')]
        print(f"--- DB columns in 'reports': {existing_columns}")

        migrations = {
            'disaster_type': "ALTER TABLE reports ADD COLUMN disaster_type VARCHAR",
            'confidence': "ALTER TABLE reports ADD COLUMN confidence FLOAT",
            'analysis_metadata': "ALTER TABLE reports ADD COLUMN analysis_metadata TEXT",
        }

        with engine.connect() as conn:
            for col_name, sql in migrations.items():
                if col_name not in existing_columns:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"   + Added column: {col_name}")
                else:
                    print(f"   = Column exists: {col_name}")

        print("--- DB migration check complete ---")
    except Exception as e:
        print(f"--- DB migration error (non-fatal): {e}")

run_migrations()

print("--- Loading AI Models ---")
type_model = load_model(TYPE_MODEL_PATH, len(TYPE_CLASS_NAMES))
damage_model = load_model(DAMAGE_MODEL_PATH, len(DAMAGE_CLASS_NAMES))

# Initialize Grad-CAM for both models
type_gradcam = GradCAM(type_model, "layer4") if type_model else None
damage_gradcam = GradCAM(damage_model, "layer4") if damage_model else None
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

        if new_status not in ['Deployed', 'Idle', 'Resting']:
            print(f"❌ Invalid status: {new_status}")
            return jsonify({"error": "Invalid status"}), 400
        
        old_status = team.status
        team.status = new_status
        
        # --- NEW LOGIC: Update the Task ---
        if new_status == 'Deployed':
            team.current_task = new_task  # Save the orders
            team.current_report_id = new_report_id
        else:
            team.current_task = None      # Clear orders if recalled/resting
            team.current_report_id = None
        # ----------------------------------
        
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


def predict_from_frames(frames, sid=None):
    """
    Given a list of PIL Images (frames), runs both models on each frame.
    Returns a dict with majority-voted results, full distributions, and per-frame predictions.
    Optionally emits progress via Socket.IO if sid is provided.
    """
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

            # Damage Level
            damage_outputs = damage_model(tensor)
            damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
            damage_conf, damage_pred = torch.max(damage_probs, 1)
            damage_votes.append(damage_pred.item())
            damage_confidences.append(damage_conf.item() * 100)

        # Compute Grad-CAM bounding boxes for this frame
        gradcam_data = {}
        if type_gradcam and damage_gradcam:
            try:
                gradcam_data = compute_gradcam_for_frame(
                    type_model, damage_model, tensor,
                    type_gradcam, damage_gradcam
                )
                print(f"  [Grad-CAM] Frame {i}: type_bbox={gradcam_data.get('type_bbox')}, damage_bbox={gradcam_data.get('damage_bbox')}", flush=True)
            except Exception as e:
                import traceback
                print(f"  [Grad-CAM] ERROR on frame {i}: {e}", flush=True)
                traceback.print_exc()
        else:
            print(f"  [Grad-CAM] SKIPPED frame {i}: type_gradcam={type_gradcam is not None}, damage_gradcam={damage_gradcam is not None}", flush=True)

        per_frame_predictions.append({
            "frame_index": i,
            "type": TYPE_CLASS_NAMES[type_pred.item()],
            "type_conf": round(type_conf.item() * 100, 2),
            "damage": DAMAGE_CLASS_NAMES[damage_pred.item()],
            "damage_conf": round(damage_conf.item() * 100, 2),
            "type_bbox": gradcam_data.get("type_bbox"),
            "damage_bbox": gradcam_data.get("damage_bbox"),
            "damage_bboxes": gradcam_data.get("damage_bboxes", []),
            "type_heatmap": gradcam_data.get("type_heatmap"),
            "damage_heatmap": gradcam_data.get("damage_heatmap"),
        })

    # Majority vote for final classification
    final_type_idx = max(set(type_votes), key=type_votes.count)
    final_damage_idx = max(set(damage_votes), key=damage_votes.count)

    # Average confidence only for frames that voted for the winning class
    winning_type_confs = [c for c, v in zip(type_confidences, type_votes) if v == final_type_idx]
    avg_type_confidence = sum(winning_type_confs) / len(winning_type_confs)

    winning_damage_confs = [c for c, v in zip(damage_confidences, damage_votes) if v == final_damage_idx]
    avg_damage_confidence = sum(winning_damage_confs) / len(winning_damage_confs)

    # Compute vote distributions (percentage of frames voting for each class)
    total = len(type_votes)
    type_distribution = {}
    for idx, name in enumerate(TYPE_CLASS_NAMES):
        count = type_votes.count(idx)
        type_distribution[name] = round((count / total) * 100, 1)

    damage_distribution = {}
    for idx, name in enumerate(DAMAGE_CLASS_NAMES):
        count = damage_votes.count(idx)
        damage_distribution[name] = round((count / total) * 100, 1)

    return {
        "primary_type": TYPE_CLASS_NAMES[final_type_idx],
        "primary_damage": DAMAGE_CLASS_NAMES[final_damage_idx],
        "type_confidence": round(avg_type_confidence, 2),
        "damage_confidence": round(avg_damage_confidence, 2),
        "type_distribution": type_distribution,
        "damage_distribution": damage_distribution,
        "per_frame_predictions": per_frame_predictions
    }


def extract_frames(video_path, num_frames=10):
    """
    Extracts up to `num_frames` evenly spaced frames from a video.
    Returns a list of PIL Images.
    """
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if total_frames == 0:
        cap.release()
        return []

    # Pick evenly spaced frame indices
    indices = [int(i * total_frames / num_frames) for i in range(num_frames)]
    frames = []

    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if ret:
            # OpenCV uses BGR, PIL uses RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(frame_rgb))

    cap.release()
    return frames

# --- AI ANALYSIS ROUTE (UPDATED TO SAVE IMAGE) ---
@app.route('/api/v1/analyze', methods=['POST'])
def analyze_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # 1. Save the uploaded file to disk
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        upload_folder = os.path.join(app.root_path, 'static', 'uploads')
        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)
        filepath = os.path.join(upload_folder, filename)
        file.save(filepath)
        print(f"DEBUG: filename={filename}, ext={os.path.splitext(filename)[1].lower()}, is_video={os.path.splitext(filename)[1].lower() in {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'}}")

        # 2. Detect if it's a video or an image
        video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'}
        file_ext = os.path.splitext(filename)[1].lower()
        is_video = file_ext in video_extensions

        if not (type_model and damage_model):
            return jsonify({"error": "Models not loaded"}), 500

        image_url = f"http://127.0.0.1:5000/static/uploads/{filename}"

        if is_video:
            # --- VIDEO PATH ---
            socketio.emit('analysis_progress', {
                'stage': 'extracting',
                'message': 'Extracting frames from video...'
            })

            frames = extract_frames(filepath, num_frames=10)
            if not frames:
                return jsonify({"error": "Could not extract frames from video"}), 400

            # Get video metadata for timeline sync
            cap = cv2.VideoCapture(filepath)
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            video_duration = total_frame_count / fps if fps > 0 else 0
            cap.release()

            result = predict_from_frames(frames, sid=True)

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
                "total_analyzed_frames": len(frames)
            })

        else:
            # --- IMAGE PATH ---
            with open(filepath, 'rb') as f:
                image_bytes = f.read()

            image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
            tensor = transform(image).unsqueeze(0)

            with torch.no_grad():
                type_outputs = type_model(tensor)
                type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
                type_conf, type_pred = torch.max(type_probs, 1)

                damage_outputs = damage_model(tensor)
                damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
                damage_conf, damage_pred = torch.max(damage_probs, 1)

            detected_type = TYPE_CLASS_NAMES[type_pred.item()]
            detected_damage = DAMAGE_CLASS_NAMES[damage_pred.item()]

            # Build distributions from softmax probabilities
            type_distribution = {}
            for idx, name in enumerate(TYPE_CLASS_NAMES):
                type_distribution[name] = round(type_probs[0][idx].item() * 100, 1)

            damage_distribution = {}
            for idx, name in enumerate(DAMAGE_CLASS_NAMES):
                damage_distribution[name] = round(damage_probs[0][idx].item() * 100, 1)

            # Compute Grad-CAM for the image
            gradcam_data = {}
            if type_gradcam and damage_gradcam:
                try:
                    gradcam_data = compute_gradcam_for_frame(
                        type_model, damage_model, tensor,
                        type_gradcam, damage_gradcam
                    )
                except Exception as e:
                    print(f"Grad-CAM error on image: {e}", flush=True)

            return jsonify({
                "type": detected_type,
                "confidence": round(type_conf.item() * 100, 2),
                "damage": detected_damage,
                "damage_confidence": round(damage_conf.item() * 100, 2),
                "image_url": image_url,
                "source": "image",
                "type_distribution": type_distribution,
                "damage_distribution": damage_distribution,
                "per_frame_predictions": [{
                    "frame_index": 0,
                    "type": detected_type,
                    "type_conf": round(type_conf.item() * 100, 2),
                    "damage": detected_damage,
                    "damage_conf": round(damage_conf.item() * 100, 2),
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
    """
    from flask import request as flask_request
    sid = flask_request.sid

    # Throttle: skip if last analysis was < 500ms ago
    now = _time.time()
    if sid in _last_live_analysis and (now - _last_live_analysis[sid]) < 0.5:
        return
    _last_live_analysis[sid] = now

    if not (type_model and damage_model):
        emit('live_frame_result', {'error': 'Models not loaded'})
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

            damage_outputs = damage_model(tensor)
            damage_probs = torch.nn.functional.softmax(damage_outputs, dim=1)
            damage_conf, damage_pred = torch.max(damage_probs, 1)

        # Compute Grad-CAM bounding boxes
        gradcam_data = {}
        if type_gradcam and damage_gradcam:
            try:
                gradcam_data = compute_gradcam_for_frame(
                    type_model, damage_model, tensor,
                    type_gradcam, damage_gradcam
                )
            except Exception as e:
                print(f"[Live Grad-CAM] Error: {e}", flush=True)

        emit('live_frame_result', {
            'type': TYPE_CLASS_NAMES[type_pred.item()],
            'type_conf': round(type_conf.item() * 100, 2),
            'damage': DAMAGE_CLASS_NAMES[damage_pred.item()],
            'damage_conf': round(damage_conf.item() * 100, 2),
            'type_bbox': gradcam_data.get('type_bbox'),
            'damage_bbox': gradcam_data.get('damage_bbox'),
            'damage_bboxes': gradcam_data.get('damage_bboxes', []),
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
        
        # 1. DELETE Linked Assets (Instead of unlinking)
        from models.resources import Asset
        assets = session.query(Asset).filter(Asset.team_id == team_id).all()
        print(f"   > Found {len(assets)} linked assets. Deleting...")
        for asset in assets:
            session.delete(asset) # <--- This now deletes the asset row entirely
            
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
    print("INFO:root:Starting Flask API server on port 5000...")
    # Running it on 0.0.0.0 for accessibility
    socketio.run(app, debug=True, use_reloader=False, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)