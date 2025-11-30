from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Asset(Base):
    __tablename__ = 'assets'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # e.g., "Rescue Boat Alpha"
    type = Column(String, nullable=False) # e.g., "Vehicle", "Drone", "Medical Kit"
    status = Column(String, default="Available") # Available, Deployed, Maintenance
    location = Column(String, nullable=True) # e.g., "Base Camp"
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=True)
    team = relationship("Team", back_populates="assets")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "status": self.status,
            "location": self.location,
            "team_id": self.team_id
        }

class Team(Base):
    __tablename__ = 'teams'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # e.g., "Alpha Squad"
    department = Column(String, nullable=False)
    status = Column(String, default="Idle") # Idle, Deployed, Resting
    personnel_count = Column(Integer, default=0)
    current_task = Column(String, nullable=True) # <--- NEW FIELD

    # --- NEW: LOCATION & AREA OF RESPONSIBILITY ---
    base_latitude = Column(Float, nullable=True)  # Where the team is stationed
    base_longitude = Column(Float, nullable=True) 
    coverage_radius_km = Column(Float, default=5.0) # How far they respond (e.g., 5km)
    # ----------------------------------------------

    assets = relationship("Asset", back_populates="team")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "department": self.department, # <--- New
            "status": self.status,
            "personnel_count": self.personnel_count,
            "current_task": self.current_task, # <--- Include in API response
            "base_latitude": self.base_latitude,    # Return lat
            "base_longitude": self.base_longitude,  # Return lng
            "coverage_radius_km": self.coverage_radius_km,
            "assets": [a.to_dict() for a in self.assets] # <--- Include assets in team data
        }
    
class Message(Base):
        __tablename__ = 'messages'

        id = Column(Integer, primary_key=True, index=True)
        sender = Column(String, nullable=False)      # e.g. "Admin" or "Flood Response Unit"
        target_room = Column(String, nullable=False) # e.g. "team_1"
        content = Column(String, nullable=False)
        timestamp = Column(DateTime, default=datetime.utcnow)

        def to_dict(self):
            return {
                "id": self.id,
                "sender": self.sender,
                "target_room": self.target_room,
                "message": self.content, # Frontend expects 'message', not 'content'
                "timestamp": self.timestamp.isoformat() + "Z"
            }