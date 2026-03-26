import json
from sqlalchemy import Column, Integer, String, DateTime, Text, Float
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

    damage_level = Column(String, default="Pending")
    image_url = Column(String, nullable=True)

    disaster_type = Column(String, nullable=True)       # Earthquake, Fire, Flood
    confidence = Column(Float, nullable=True)            # 0-100 numeric confidence
    analysis_metadata = Column(Text, nullable=True)      # Full JSON from analysis

    def to_dict(self):
        """Helper to convert object to JSON-ready dictionary"""
        metadata = None
        if self.analysis_metadata:
            try:
                metadata = json.loads(self.analysis_metadata)
            except (json.JSONDecodeError, TypeError):
                metadata = None

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "timestamp": self.timestamp.isoformat() + "Z",
            "location": self.location,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "damage_level": self.damage_level,
            "image_url": self.image_url,
            "disaster_type": self.disaster_type,
            "confidence": self.confidence,
            "analysis_metadata": metadata
        }