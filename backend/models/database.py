import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# --- 1. Database Configuration ---

DEFAULT_DB_URL = "postgresql://postgres.udmnaaqvdlckyhexuyqv:OgagbaU@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"


DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_DB_URL)

# Fix for some postgres URL prefixes
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# --- 2. Engine ---
engine = create_engine(DATABASE_URL, echo=False)

# --- 3. Session ---
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()