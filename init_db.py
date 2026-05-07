import sys
import os

sys.path.append(os.getcwd())
# Importing database first triggers load_dotenv() so env vars are populated.
from backend.models.database import Base, engine, SessionLocal
from backend.models.user import User
from backend.models.report import Report
from backend.models.resources import Asset, Team, Message
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

ADMIN_EMAIL = "sysadmin@quickdart.com"

def wipe_supabase_users():
    """Deletes all users EXCEPT the Admin"""
    print("\n🔥 CLEANING UP SUPABASE CLOUD...")
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️  Skipping Supabase wipe (SUPABASE_URL/SUPABASE_KEY not set)")
        return

    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Get users (fetches first 50)
        response = supabase.auth.admin.list_users()
        users = response.users if hasattr(response, 'users') else response
        
        if not users:
            print("   Supabase is already empty.")
            return

        print(f"   Scanning {len(users)} users...")

        for user in users:
            # --- THE SAFETY CHECK ---
            if user.email == ADMIN_EMAIL:
                print(f"   🛡️  PROTECTED: {user.email} (Skipping delete)")
                continue
            # ------------------------

            try:
                supabase.auth.admin.delete_user(user.id)
                print(f"   ❌ Deleted: {user.email}")
            except Exception as e:
                print(f"   ⚠️ Failed to delete {user.email}: {e}")
                
        print("✅ SUPABASE CLEANUP COMPLETE.\n")

    except Exception as e:
        print(f"❌ Supabase Connection Error: {e}")

def init_db():
    print("Connecting to database...")

    wipe_supabase_users()

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
           agency_id=ADMIN_EMAIL, 
            password_hash="supabase_managed", 
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