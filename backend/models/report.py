from sqlalchemy import Column, Integer, String, DateTime, Text , Float
from datetime import datetime
from .database import Base

class Report(Base):
    __tablename__ = 'reports'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="Active")  # Active, Critical, Cleared
    timestamp = Column(DateTime, default=datetime.utcnow)
    location = Column(String, nullable=True) # e.g., "Sector 7"
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    def to_dict(self):
        """Helper to convert object to JSON-ready dictionary"""
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "location": self.location,
            "lat": self.latitude, 
            "lng": self.longitude
        }