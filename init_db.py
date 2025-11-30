import sys
import os

sys.path.append(os.getcwd())
from backend.models.database import Base, engine, SessionLocal
from backend.models.user import User
from backend.models.report import Report    
from backend.models.resources import Asset, Team, Message

def init_db():
    print("Connecting to database...")

    try:
        print("Resetting tables...")
        Base.metadata.drop_all(bind=engine) # Deletes existing tables
        Base.metadata.create_all(bind=engine) # Creates empty tables
        print("Tables reset successfully.")
    except Exception as e:
        print(f"Error resetting tables: {e}")
        return

    session = SessionLocal()

    try:
        print("Creating Admin Account...")
        
        # --- 1. CREATE ADMIN USER (So you can log in) ---
        # ⚠️ IMPORTANT: Replace the email below with your REAL Supabase Admin Email
        admin = User(
            agency_id="sysadmin@quickdart.com", # <--- PUT YOUR ACTUAL ADMIN EMAIL HERE
            password_hash="supabase_managed", # Password doesn't matter here, Supabase handles it
            role="Commander", 
            team_id=None
        )
        session.add(admin)

        session.commit()
        print("\n" + "="*60)
        print("✅ DATABASE RESET SUCCESSFUL!")
        print(f"👤 Admin Account Linked: {admin.agency_id}")
        print("🚀 System is clean. Use the Dashboard to add Teams & Assets.")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    init_db()