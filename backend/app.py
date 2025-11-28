from flask import Flask, jsonify , request
from flask_cors import CORS # 1. Import CORS
from flask_socketio import SocketIO, emit
# Import the authentication logic we created in the User model
from models.user import authenticate_user
from models.database import SessionLocal 
from models.report import Report
from models.resources import Asset, Team # <--- NEW IMPORT
import os
import io
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from datetime import datetime
import requests

app = Flask(__name__)

# --- CRITICAL CHANGE: Explicitly define the origin ---
# This forces the backend to recognize and accept requests ONLY from the
# React development server running at port 3000.
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

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

# --- NEW ROUTES ---
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
        # 3. Success! Return the role and a token
        return jsonify({
            "status": "authenticated",
            "token": "mock_jwt_token_123", # In the future, we can make this a real JWT
            "role": role,
            "user_id": user_id
        }), 200
    else:
        # 4. Failure
        return jsonify({"message": "Invalid credentials. Please check your Agency ID and Password.", "status": "failed"}), 401
    



@app.route('/api/v1/analyze', methods=['POST'])
def analyze_image():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not type_model or not damage_model:
        return jsonify({"error": "Models not loaded on server"}), 500

    try:
        # 1. Process Image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        tensor = transform(image).unsqueeze(0) 
        
        # 2. Predict Disaster TYPE
        with torch.no_grad():
            type_outputs = type_model(tensor)
            _, type_preds = torch.max(type_outputs, 1)
            type_probs = torch.nn.functional.softmax(type_outputs, dim=1)
            type_conf = type_probs[0][type_preds].item() * 100
            
        detected_type = TYPE_CLASS_NAMES[type_preds.item()]

        # 3. Predict Damage LEVEL
        with torch.no_grad():
            damage_outputs = damage_model(tensor)
            _, damage_preds = torch.max(damage_outputs, 1)
            # We don't need confidence for this one as much, just the label
            
        detected_damage = DAMAGE_CLASS_NAMES[damage_preds.item()]
        
        return jsonify({
            "type": detected_type,
            "confidence": f"{type_conf:.2f}%",
            "damage": detected_damage # Now returns real data!
        })

    except Exception as e:
        print(f"Prediction Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/v1/reports', methods=['GET', 'POST'])
def handle_reports():
    session = SessionLocal()
    
    if request.method == 'GET':
        try:
            reports = session.query(Report).order_by(Report.id.desc()).all()
            return jsonify([r.to_dict() for r in reports]), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            session.close()
            
    elif request.method == 'POST':
        from datetime import datetime
        try:
            data = request.get_json()
            
            print(f"--- DEBUG: BACKEND RECEIVED DATA ---") # <--- PRINT 1
            print(f"Full Data Packet: {data}")             # <--- PRINT 2
            print(f"Looking for 'damage_level': {data.get('damage_level')}")

            # 1. Extract Coords
            lat = data.get('latitude')
            lng = data.get('longitude')
            
            # 2. Determine Location Name (Backend Side)
            # If frontend sent a generic name, we try to find the real address
            location_name = data.get('location', 'Unknown')
            if lat and lng:
                # Convert Coords -> Address Name automatically
                location_name = get_address_from_coords(lat, lng)

            print(f"DEBUG: Incoming Data -> {data}") 
            print(f"DEBUG: Extracted Damage -> {data.get('damage_level')}")

            # 3. Save Report
            new_report = Report(
                title=data.get('title'),
                description=data.get('description'),
                status=data.get('status', 'Active'),
                location=location_name, # <--- Saves the Real Address Name!
                latitude=lat,
                longitude=lng,
                timestamp=datetime.utcnow(),
                damage_level=data.get('damage_level', 'Pending')
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

@app.route('/api/v1/reports/<int:report_id>', methods=['PUT'])
def update_report(report_id):
    session = SessionLocal()
    try:
        report = session.query(Report).filter(Report.id == report_id).first()
        if not report:
            return jsonify({"error": "Report not found"}), 404
        
        data = request.get_json()
        
        # Update fields if provided
        if 'status' in data:
            report.status = data['status']
        if 'damage_level' in data:
            report.damage_level = data['damage_level']
            
        session.commit()
        return jsonify(report.to_dict()), 200
        
    except Exception as e:
        session.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

if __name__ == '__main__':
    print("INFO:root:Starting Flask API server on port 5000...")
    # Running it on 0.0.0.0 for accessibility
    socketio.run(app, debug=True, use_reloader=False, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)