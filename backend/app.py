from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import jwt
import datetime
from datetime import timezone, timedelta
# --- SQLAlchemy Imports for DB Initialization ---
from sqlalchemy.orm import Session # Required for type hinting
from backend.models.database import engine, Base # Import engine and Base for table creation
# ------------------------------------------------

# FIX: Change the import from the models folder to a relative path
# This ensures it works when running 'python app.py' directly.
from .models.user import get_user_by_agency_id

# Initialize Flask Application
app = Flask(__name__)

# IMPORTANT: Enable CORS for development so the React frontend 
# (which runs on a different port/origin) can talk to this API.
CORS(app) 

# --- Basic Configuration ---
# JWT Secret key is essential for signing tokens
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'a_very_insecure_development_secret_key_change_me') 

# Define JWT expiration time (e.g., 24 hours)
JWT_EXPIRATION_DELTA = timedelta(hours=24) 

# NOTE: The get_db function is in backend/models/database.py and is currently
# commented out in the example usage in that file, so we don't need it here yet.

@app.route('/api/v1/status', methods=['GET'])
def api_status():
    """
    Test endpoint to confirm the backend API is running and reachable.
    """
    return jsonify({
        'status': 'Online',
        'message': 'QuickDART API is operational.',
        'version': 'v1.0.0'
    }), 200

@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    """
    Handles login requests, verifies credentials, and issues a JWT token.
    The React frontend expects a successful response with a 'token' and 'role'.
    """
    data = request.get_json()
    agencyId = data.get('agencyId')
    password = data.get('password')

    if not agencyId or not password:
        return jsonify({'message': 'Missing agencyId or password'}), 400

    # 1. Mock User Lookup (Replace with database query later)
    user = get_user_by_agency_id(agencyId)

    if not user:
        return jsonify({'message': 'Invalid credentials or User ID not found.'}), 401

    # 2. Mock Password Verification (Replace with hash comparison later)
    if user['password'] != password:
        return jsonify({'message': 'Invalid password.'}), 401

    # 3. Generate JWT Token
    try:
        # Define the payload (information stored in the token)
        payload = {
            'exp': datetime.datetime.now(timezone.utc) + JWT_EXPIRATION_DELTA,
            'iat': datetime.datetime.now(timezone.utc),
            'sub': user['agencyId'],  # Subject: the user ID
            'role': user['role']      # User role for authorization checks
        }
        
        # Encode the token using the application's secret key
        token = jwt.encode(
            payload,
            app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        
        # 4. Successful Response
        return jsonify({
            'message': 'Login successful.',
            'token': token,
            'role': user['role']
        }), 200

    except Exception as e:
        print(f"Error generating token: {e}")
        return jsonify({'message': 'Could not create session token.'}), 500


if __name__ == '__main__':
    # --- Database Initialization on Startup ---
    # This creates the tables defined in your models (e.g., User)
    # in the database specified by the engine.
    print("Ensuring database tables exist...")
    Base.metadata.create_all(bind=engine)
    print("Database tables checked/created.")
    
    # Running on port 5000 is standard for Flask/APIs
    print("Starting Flask server on http://127.0.0.1:5000")
    # For a real application, consider using a production server like Gunicorn
    app.run(debug=True, port=5000)