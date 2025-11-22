import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# --- 1. Database Configuration ---

# **CRITICAL FIX:** We explicitly specify the SQLite dialect using 'sqlite+pysqlite:///'
# This ensures SQLAlchemy does not incorrectly try to load the PostgreSQL driver (psycopg2) 
# which is now missing from the environment, resolving the ModuleNotFoundError.

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "sqlite+pysqlite:///quickdart_dev.db" 
)

# SQLite specific argument: required for concurrent access by Flask threads.
# We apply connect_args only if the URL indicates SQLite.
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

# --- 2. SQLAlchemy Engine ---
engine = create_engine(
    DATABASE_URL,
    echo=False, # Set to True for debugging SQL statements
    # Pass connection arguments required for SQLite
    connect_args=connect_args
)

# --- 3. Session and Base ---
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()