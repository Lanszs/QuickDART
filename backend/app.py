from flask import Flask, jsonify
from flask_cors import CORS # 1. Import CORS

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
    # In a real app, you would check credentials here
    return jsonify({"message": "Login successful", "token": "mock_jwt_token_123"}), 200


if __name__ == '__main__':
    print("INFO:root:Starting Flask API server on port 5000...")
    # Running it on 0.0.0.0 for accessibility
    app.run(debug=True, host='0.0.0.0', port=5000)