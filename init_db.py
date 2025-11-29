import sys
import os

# Ensure the current directory is in the Python path
sys.path.append(os.getcwd())
# init_db.py
from backend.models.database import Base, engine, SessionLocal
from backend.models.user import User
from backend.models.report import Report    
from backend.models.resources import Asset, Team

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

    try:
        print("Seeding users...")
        users = [
            User(agency_id="Cmdr-001", password_hash="password123", role="Commander"),
            User(agency_id="Agent-47", password_hash="fieldpass", role="FieldAgent"),
            User(agency_id="Analyst-A", password_hash="secure", role="DataAnalyst"),
        ]
        session.add_all(users)

        print("Seeding reports...")
        reports = [
            Report(
                title="Flooding in Brgy. Poblacion", 
                description="Water level rising.", 
                status="Critical", 
                location="Sector A", 
                latitude=14.7546, 
                longitude=120.9466,
                damage_level="Major"
            ),
            Report(
                title="Fire Incident", 
                description="Residential fire.", 
                status="Active", 
                location="Sector C", 
                latitude=14.7600, 
                longitude=120.9500,
                damage_level="Destroyed"
            ),
            Report(
                title="Road Blockage", 
                description="Fallen tree.", 
                status="Cleared", 
                location="Sector B", 
                latitude=14.7480, 
                longitude=120.9400,
                damage_level="Minor"
            ),
        ]
        session.add_all(reports)

        # --- ENHANCED TEAMS ---
        print("Seeding specialized response teams...")
        teams = [
            Team(
                name="Flood Response Unit", 
                specialization="Flood Responder", 
                status="Deployed", 
                personnel_count=8
            ),
            Team(
                name="Fire Suppression Squad", 
                specialization="Fire Responder", 
                status="Idle", 
                personnel_count=6
            ),
            Team(
                name="Earthquake Rescue Team", 
                specialization="Earthquake Responder", 
                status="Idle", 
                personnel_count=10
            ),
            Team(
                name="Medical Response Team", 
                specialization="Medical", 
                status="Deployed", 
                personnel_count=5
            ),
            Team(
                name="Logistics & Support Crew", 
                specialization="Support", 
                status="Resting", 
                personnel_count=12
            ),
        ]
        session.add_all(teams)

        # --- ENHANCED ASSETS (Including Drones) ---
        print("Seeding equipment and assets...")
        assets = [
            # Drones for aerial surveillance
            Asset(
                name="Drone Marilao-01",
                type="Drone",
                status="Available",
                location="Marilao Base"
            ),
            Asset(
                name="Drone McArthur-01",
                type="Drone",
                status="Deployed",
                location="McArthur Highway"
            ),
            Asset(
                name="Drone Meycauayan-01",
                type="Drone",
                status="Available",
                location="Meycauayan Station"
            ),
            
            # Ground Vehicles
            Asset(
                name="Rescue Boat Alpha",
                type="Vehicle",
                status="Deployed",
                location="Flooded Area - Sector A"
            ),
            Asset(
                name="Fire Truck Unit-02",
                type="Vehicle",
                status="Available",
                location="Fire Station Central"
            ),
            Asset(
                name="Ambulance Beta",
                type="Vehicle",
                status="Deployed",
                location="Sector C - Fire Incident"
            ),
            Asset(
                name="Heavy Rescue Vehicle",
                type="Vehicle",
                status="Maintenance",
                location="Repair Bay"
            ),
            
            # Medical Equipment
            Asset(
                name="Field Medical Kit A",
                type="Medical Kit",
                status="Available",
                location="Medical Tent"
            ),
            Asset(
                name="Portable Defibrillator",
                type="Medical Kit",
                status="Deployed",
                location="With Medic Team"
            ),
            
            # Communication Equipment
            Asset(
                name="Satellite Phone Unit-1",
                type="Communication",
                status="Available",
                location="Command Center"
            ),
            Asset(
                name="Mobile Radio Base",
                type="Communication",
                status="Deployed",
                location="Field Operations"
            ),
            
            # Rescue Equipment
            Asset(
                name="Hydraulic Rescue Tools",
                type="Rescue Equipment",
                status="Available",
                location="Equipment Storage"
            ),
            Asset(
                name="Search & Rescue Dogs",
                type="K-9 Unit",
                status="Idle",
                location="K-9 Facility"
            ),
        ]
        session.add_all(assets)
        
        session.commit()
        print("\n" + "="*60)
        print("✅ DATABASE POPULATED SUCCESSFULLY!")
        print("="*60)
        print(f"📊 Summary:")
        print(f"   • {len(users)} Users created")
        print(f"   • {len(reports)} Initial reports")
        print(f"   • {len(teams)} Specialized Teams:")
        for team in teams:
            print(f"      - {team.name} ({team.specialization})")
        print(f"   • {len(assets)} Assets registered:")
        print(f"      - 3 Drones (Marilao, McArthur, Meycauayan)")
        print(f"      - 4 Vehicles")
        print(f"      - 2 Medical Kits")
        print(f"      - 2 Communication Equipment")
        print(f"      - 1 Rescue Equipment")
        print(f"      - 1 K-9 Unit")
        print("="*60)
        print("🚀 Ready to start the application!")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    init_db()