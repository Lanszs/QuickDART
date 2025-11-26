from flask import Flask, jsonify , request
from flask_cors import CORS # 1. Import CORS
# Import the authentication logic we created in the User model
from models.user import authenticate_user
from models.database import SessionLocal 
from models.report import Report

app = Flask(__name__)

# --- CRITICAL CHANGE: Explicitly define the origin ---
# This forces the backend to recognize and accept requests ONLY from the
# React development server running at port 3000.
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

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
    

@app.route('/api/v1/reports', methods=['GET'])
def get_reports():
    session = SessionLocal()
    try:
        # Query all reports, sorted by newest first (descending ID)
        reports = session.query(Report).order_by(Report.id.desc()).all()
        return jsonify([r.to_dict() for r in reports]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        session.close()

if __name__ == '__main__':
    print("INFO:root:Starting Flask API server on port 5000...")
    # Running it on 0.0.0.0 for accessibility
    app.run(debug=True, host='0.0.0.0', port=5000)