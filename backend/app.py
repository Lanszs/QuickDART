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

from flask import Flask, jsonify , request, send_from_directory
from flask_cors import CORS 
from flask_socketio import SocketIO, emit

# --- NOW these imports will work because the path is fixed ---
from models.user import authenticate_user
from models.database import SessionLocal 
from models.report import Report
from models.resources import Asset, Team 

import io
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from datetime import datetime
import requests

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

print("--- Loading AI Models ---")
type_model = load_model(TYPE_MODEL_PATH, len(TYPE_CLASS_NAMES))
damage_model = load_model(DAMAGE_MODEL_PATH, len(DAMAGE_CLASS_NAMES))

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
        else:
            team.current_task = None      # Clear orders if recalled/resting
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


# --- AI ANALYSIS ROUTE (UPDATED TO SAVE IMAGE) ---
@app.route('/api/v1/analyze', methods=['POST'])
def analyze_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # 1. SAVE THE IMAGE TO DISK
        filename = f"{uuid.uuid4().hex}_{file.filename}"
        upload_folder = os.path.join(app.root_path, 'static', 'uploads')

        if not os.path.exists(upload_folder):
            os.makedirs(upload_folder)

        filepath = os.path.join(upload_folder, filename)
        
        # Reset file pointer before saving, then reset again for AI
        file.save(filepath) 
        
        # 2. Process for AI
        with open(filepath, 'rb') as f:
            image_bytes = f.read()
            
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        tensor = transform(image).unsqueeze(0) 
        
        # 3. Predict 
        if type_model and damage_model:
            with torch.no_grad():
                type_outputs = type_model(tensor)
                _, type_preds = torch.max(type_outputs, 1)
                type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
                type_conf = type_probs[0][type_preds].item() * 100
            detected_type = TYPE_CLASS_NAMES[type_preds.item()]

            with torch.no_grad():
                damage_outputs = damage_model(tensor)
                _, damage_preds = torch.max(damage_outputs, 1)
            detected_damage = DAMAGE_CLASS_NAMES[damage_preds.item()]
        else:
            detected_type = "Unknown"
            detected_damage = "Unknown"
            type_conf = 0.0

        # 4. RETURN URL WITH RESULT
        # IMPORTANT: Use your actual IP or localhost if running locally
        image_url = f"http://127.0.0.1:5000/static/uploads/{filename}"
        
        return jsonify({
            "type": detected_type,
            "confidence": f"{type_conf:.2f}%",
            "damage": detected_damage,
            "image_url": image_url # <--- Sends the link to the saved image
        })

    except Exception as e:
        print(f"Prediction Error: {e}")
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

            # 3. Save Report with Image URL
            new_report = Report(
                title=data.get('title'),
                description=data.get('description'),
                status=data.get('status', 'Active'),
                location=location_name,
                latitude=lat,
                longitude=lng,
                timestamp=datetime.utcnow(),
                damage_level=data.get('damage_level', 'Pending'),
                image_url=data.get('image_url') # <--- Saving the URL!
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
    data = {
        'sender': 'Admin' or 'Flood Unit',
        'target_room': 'team_1' or 'admin_room',
        'message': 'Go to Sector C'
    }
    """
    print(f"💬 Message: {data}")
    target = data.get('target_room')
    
    # Broadcast the message to the specific room
    emit('receive_message', data, room=target)
    
    # If Admin sent it, also bounce it back to Admin so it shows on their screen
    # (In a real app, you'd save to DB here)
    if data.get('target_room') != 'admin_room':
        emit('receive_message', data, room='admin_room')

# --- CRUD: ADD & REMOVE RESOURCES ---

@app.route('/api/v1/teams', methods=['POST'])
def create_team():
    """Create a new Team"""
    session = SessionLocal()
    try:
        data = request.get_json()
        new_team = Team(
            name=data['name'],
            department=data['department'],
            personnel_count=int(data['personnel_count']),
            status='Idle' # Default status
        )
        session.add(new_team)
        session.commit()
        
        # Broadcast update
        socketio.emit('resource_updated', {'type': 'team', 'action': 'created'})
        return jsonify({"message": "Team created successfully"}), 201
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

@app.route('/api/v1/teams/<int:team_id>', methods=['DELETE'])
def delete_team(team_id):
    """Delete a Team"""
    session = SessionLocal()
    try:
        team = session.query(Team).filter(Team.id == team_id).first()
        if not team:
            return jsonify({"error": "Team not found"}), 404
        
        session.delete(team)
        session.commit()
        
        socketio.emit('resource_updated', {'type': 'team', 'action': 'deleted'})
        return jsonify({"message": "Team deleted"}), 200
    except Exception as e:
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
            status='Available' # Default status
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