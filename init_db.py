import sys
import os

# Ensure the current directory is in the Python path
sys.path.append(os.getcwd())
# init_db.py
from backend.models.database import Base, engine, SessionLocal
from backend.models.user import User
from backend.models.report import Report    
from backend.models.resources import Asset, Team # <--- NEW IMPORT 

def init_db():
    print("Connecting to database...")

    try:
        print("Resetting tables...")
        Base.metadata.drop_all(bind=engine) # Deletes existing tables
        Base.metadata.create_all(bind=engine) # Creates new ones with lat/lng
        print("Tables reset successfully.")
    except Exception as e:
        print(f"Error resetting tables: {e}")
        return

    session = SessionLocal()



# Check if users exist to avoid duplicates
# Note: We wrap this in a try/except block in case the table doesn't exist yet (though create_all should handle it)
    try:
        print("Seeding users...")
        users = [
            User(agency_id="Cmdr-001", password_hash="password123", role="Commander"),
            User(agency_id="Agent-47", password_hash="fieldpass", role="FieldAgent"),
            User(agency_id="Analyst-A", password_hash="secure", role="DataAnalyst"),
        ]
        session.add_all(users)

        # 3. Seed Reports (With Marilao Coordinates)
        print("Seeding reports...")
        reports = [
            Report(
                title="Flooding in Brgy. Poblacion", 
                description="Water level rising.", 
                status="Critical", 
                location="Sector A", 
                latitude=14.7546, 
                longitude=120.9466,
                damage_level="Major" # <--- ADDED
            ),
            Report(
                title="Fire Incident", 
                description="Residential fire.", 
                status="Active", 
                location="Sector C", 
                latitude=14.7600, 
                longitude=120.9500,
                damage_level="Destroyed" # <--- ADDED
            ),
            Report(
                title="Road Blockage", 
                description="Fallen tree.", 
                status="Cleared", 
                location="Sector B", 
                latitude=14.7480, 
                longitude=120.9400,
                damage_level="Minor" # <--- ADDED
            ),
        ]
        session.add_all(reports)

        
        teams = [
            Team(name="Alpha Squad", specialization="Search & Rescue", status="Deployed", personnel_count=5),
            Team(name="Medic Team Bravo", specialization="Medical", status="Idle", personnel_count=3),
            Team(name="Logistics Crew", specialization="Support", status="Resting", personnel_count=10),
        ]
        session.add_all(teams)
        # ---------------------
        
        session.commit()
        print("Database populated successfully!")
    except Exception as e:
        print(f"Error seeding data: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    init_db()