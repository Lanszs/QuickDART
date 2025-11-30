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
   
    try:
       
        Base.metadata.drop_all(bind=engine) # Deletes existing tables
        Base.metadata.create_all(bind=engine) # Creates new ones with lat/lng
        
    except Exception as e:
        print(f"Error resetting tables: {e}")
        return

    session = SessionLocal()

    try:
      
      # --- LOCATIONS (SPREAD OUT) ---
        # Center: Dampalit Proper
        LOC_CENTER_LAT = 14.6944
        LOC_CENTER_LNG = 120.9324

        # North: Obando Border (Approx 3km North)
        LOC_NORTH_LAT = 14.7200
        LOC_NORTH_LNG = 120.9350

        # South: Highway Intersection (Approx 3km South)
        LOC_SOUTH_LAT = 14.6600
        LOC_SOUTH_LNG = 120.9300

        bfp_1 = Team(
            name="Station 1 (Alpha)", department="BFP", status="Idle", personnel_count=12,
            base_latitude=LOC_CENTER_LAT, base_longitude=LOC_CENTER_LNG, 
            coverage_radius_km=1.0 # Only sees things within 1km
        )
        
        
        
        pnp_1 = Team(
            name="SWAT Unit", department="PNP", status="Idle", personnel_count=10,
            base_latitude=LOC_NORTH_LAT, base_longitude=LOC_NORTH_LNG, 
            coverage_radius_km=1.0 
        )

        ems_1 = Team(
            name="Medic Team Alpha", department="EMS", status="Idle", personnel_count=4,
            base_latitude=LOC_SOUTH_LAT, base_longitude=LOC_SOUTH_LNG, 
            coverage_radius_km=1.0
        )

        # 4. BARANGAY (Stationed Center but huge range)
        lgu_1 = Team(
            name="Rescue Squad", department="Barangay", status="Idle", personnel_count=15,
            base_latitude=LOC_CENTER_LAT, base_longitude=LOC_CENTER_LNG, 
            coverage_radius_km=10.0 # Sees EVERYTHING (Super Admin Team)
        )

        session.add_all([bfp_1, pnp_1,  ems_1,  lgu_1])
        session.commit() # Commit to get IDs
        
        reports = [
            # ZONE 1 REPORT (Only BFP & Barangay should see this)
            Report(title="Flood at Dampalit Center", description="Knee deep flood.", status="Active", location="Dampalit Proper", 
                   latitude=LOC_CENTER_LAT, longitude=LOC_CENTER_LNG, damage_level="Major"),
            
            # ZONE 2 REPORT (Only PNP & Barangay should see this)
            Report(title="Fire at North Border", description="Grass fire near boundary.", status="Active", location="Obando Boundary", 
                   latitude=LOC_NORTH_LAT, longitude=LOC_NORTH_LNG, damage_level="Destroyed"),
            
            # ZONE 3 REPORT (Only EMS & Barangay should see this)
            Report(title="Accident at South Highway", description="Motorcycle crash.", status="Active", location="Highway Intersection", 
                   latitude=LOC_SOUTH_LAT, longitude=LOC_SOUTH_LNG, damage_level="Minor"),
        ]
        session.add_all(reports)

        print("Seeding Assets...")
        assets = [
            # BFP Assets
            Asset(name="Fire Truck 01", type="Vehicle", status="Available", team_id=bfp_1.id),
            Asset(name="Fire Truck 02", type="Vehicle", status="Maintenance", team_id=bfp_1.id),
            
            # PNP Assets
            Asset(name="Patrol Car 101", type="Vehicle", status="Deployed", team_id=pnp_1.id),
            Asset(name="Surveillance Drone", type="Drone", status="Available", team_id=pnp_1.id),

            # EMS Assets
            Asset(name="Ambulance A", type="Vehicle", status="Available", team_id=ems_1.id),
            Asset(name="Ambulance B", type="Vehicle", status="Available", team_id=ems_1.id),
            
            # Barangay Assets
            Asset(name="Rescue Boat", type="Vehicle", status="Available", team_id=lgu_1.id),
            Asset(name="Megaphone System", type="Communication", status="Available", team_id=lgu_1.id),
        ]
        session.add_all(assets)

        session.commit()
        print("✅ DATABASE POPULATED SUCCESSFULLY!")
        
    except Exception as e:
        print(f"❌ Error seeding data: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    init_db()