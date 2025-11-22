import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ----------------------------------------------------------------------
# 1. Configuration (Move this to config.py later)
# ----------------------------------------------------------------------

# Using PostgreSQL + PostGIS (as recommended)
# You MUST replace 'postgres:password@localhost:5432/quickdart_db' with your actual credentials.
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://user:password@localhost:5432/quickdart_db" 
    # NOTE: You will need to install psycopg2 for PostgreSQL connectivity
)

# ----------------------------------------------------------------------
# 2. Database Initialization
# ----------------------------------------------------------------------

# Create the SQLAlchemy engine
# pool_pre_ping checks the connection before use, preventing stale connections
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True
)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for declarative class definitions (your models)
Base = declarative_base()

# ----------------------------------------------------------------------
# 3. Utility Function
# ----------------------------------------------------------------------

def get_db():
    """
    Dependency to yield a new database session. 
    Use this function in your Flask routes to manage the connection life cycle.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Example usage of get_db in a future route:
# @app.route('/test', methods=['GET'])
# def test_db_connection():
#     try:
#         next(get_db())
#         return jsonify({'status': 'Database connection successful'}), 200
#     except Exception as e:
#         return jsonify({'status': 'Database connection failed', 'error': str(e)}), 500