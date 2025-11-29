from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class Asset(Base):
    __tablename__ = 'assets'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # e.g., "Rescue Boat Alpha"
    type = Column(String, nullable=False) # e.g., "Vehicle", "Drone", "Medical Kit"
    status = Column(String, default="Available") # Available, Deployed, Maintenance
    location = Column(String, nullable=True) # e.g., "Base Camp"

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "status": self.status,
            "location": self.location
        }

class Team(Base):
    __tablename__ = 'teams'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False) # e.g., "Alpha Squad"
    specialization = Column(String, nullable=False) # e.g., "Medical", "Search & Rescue"
    status = Column(String, default="Idle") # Idle, Deployed, Resting
    personnel_count = Column(Integer, default=0)
    current_task = Column(String, nullable=True) # <--- NEW FIELD

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "specialization": self.specialization,
            "status": self.status,
            "personnel_count": self.personnel_count,
            "current_task": self.current_task # <--- Include in API response
        }