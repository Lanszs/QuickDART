from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Asset(Base):
    __tablename__ = 'assets'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    status = Column(String, default="Available") # Available, Deployed, Maintenance
    location = Column(String, nullable=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=True)
    deployment_id = Column(Integer, ForeignKey('deployments.id'), nullable=True)

    team = relationship("Team", back_populates="assets")
    deployment = relationship("Deployment", back_populates="assets")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "status": self.status,
            "location": self.location,
            "team_id": self.team_id,
            "deployment_id": self.deployment_id
        }

class Team(Base):
    __tablename__ = 'teams'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    status = Column(String, default="Idle") # Idle, Deployed, Resting
    personnel_count = Column(Integer, default=0)
    available_personnel = Column(Integer, nullable=True)  # Denormalized, updated transactionally
    current_task = Column(String, nullable=True)  # Legacy — kept for backward compat
    current_report_id = Column(Integer, nullable=True)  # Legacy

    base_latitude = Column(Float, nullable=True)
    base_longitude = Column(Float, nullable=True)
    coverage_radius_km = Column(Float, default=5.0)

    assets = relationship("Asset", back_populates="team")
    deployments = relationship("Deployment", back_populates="team")

    def to_dict(self):
        active_deps = [d for d in self.deployments if d.status == 'Active'] if self.deployments else []
        return {
            "id": self.id,
            "name": self.name,
            "department": self.department,
            "status": self.status,
            "personnel_count": self.personnel_count,
            "available_personnel": self.available_personnel if self.available_personnel is not None else self.personnel_count,
            "current_task": self.current_task,
            "current_report_id": self.current_report_id,
            "base_latitude": self.base_latitude,
            "base_longitude": self.base_longitude,
            "coverage_radius_km": self.coverage_radius_km,
            "assets": [a.to_dict() for a in self.assets],
            "active_deployments": [d.to_dict() for d in active_deps]
        }

class Deployment(Base):
    __tablename__ = 'deployments'

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=False)
    report_id = Column(Integer, ForeignKey('reports.id'), nullable=False)
    personnel_count = Column(Integer, nullable=False)
    task = Column(String, nullable=True)
    status = Column(String, default='Active')  # Active / Completed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    team = relationship("Team", back_populates="deployments")
    report = relationship("Report", back_populates="deployments")
    assets = relationship("Asset", back_populates="deployment")

    def to_dict(self):
        return {
            "id": self.id,
            "team_id": self.team_id,
            "report_id": self.report_id,
            "personnel_count": self.personnel_count,
            "task": self.task,
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z" if self.created_at else None,
            "completed_at": self.completed_at.isoformat() + "Z" if self.completed_at else None,
            "asset_ids": [a.id for a in self.assets] if self.assets else []
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