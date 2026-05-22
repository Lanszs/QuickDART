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
SUPABASE_STORAGE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "quickdart-uploads")
SUPABASE_ID_BUCKET = os.environ.get("SUPABASE_ID_BUCKET", "quickdart-id-documents")

ADMIN_EMAIL = "sysadmin@quickdart.com"


def ensure_buckets():
    """Ensure both storage buckets exist with correct visibility."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️  Skipping bucket setup (SUPABASE_URL/SUPABASE_KEY not set)")
        return
    try:
        client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        existing = client.storage.list_buckets()
        names = []
        for b in existing:
            n = getattr(b, "name", None) or (b.get("name") if isinstance(b, dict) else None)
            if n: names.append(n)
        targets = [
            (SUPABASE_STORAGE_BUCKET, True),   # public — report media
            (SUPABASE_ID_BUCKET, False),       # private — ID documents + selfies
        ]
        for name, public in targets:
            if name in names:
                print(f"   📦 Bucket OK: {name} ({'public' if public else 'private'})")
            else:
                client.storage.create_bucket(name, options={"public": public})
                print(f"   ✅ Created bucket: {name} ({'public' if public else 'private'})")
    except Exception as e:
        print(f"   ⚠️  Bucket setup failed: {e}")

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
    ensure_buckets()

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
            password_hash="managed_by_supabase",
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