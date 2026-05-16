# user.py
# Defines the User class used for mock authentication

# --- FIX: Changed '..' to '.' for sibling module import ---
# We use '.' because database.py is in the same 'models' directory as user.py.
from .database import Base
# -----------------------------------------------------------

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship


# This class will inherit from the Base defined in database.py
class User(Base):
    """
    SQLAlchemy model for a user/agent.
    """
    __tablename__ = 'users'

    # Database Columns
    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(String, unique=True, index=True)
    password_hash = Column(String)  # We will store the hashed password here
    role = Column(String)
    team_id = Column(Integer, ForeignKey('teams.id'), nullable=True)

    # --- ID verification (civilian reporters) ---
    # Storage paths inside the private bucket, not public URLs — re-signed on demand.
    id_document_path = Column(String, nullable=True)
    selfie_path = Column(String, nullable=True)
    # unverified | pending | approved | rejected
    id_verification_status = Column(String, default='unverified', nullable=False)
    id_rejection_reason = Column(String, nullable=True)
    id_submitted_at = Column(DateTime, nullable=True)
    id_reviewed_at = Column(DateTime, nullable=True)
    id_reviewed_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    full_name = Column(String, nullable=True)

    # Relationship to other tables (if needed later, e.g., Incidents, Reports)
    # reports = relationship("DamageReport", back_populates="reporter")

    def to_dict(self):
        return {
            "id": self.id,
            "agency_id": self.agency_id,
            "role": self.role,
            "team_id": self.team_id,
            "full_name": self.full_name,
            "id_verification_status": self.id_verification_status,
            "id_rejection_reason": self.id_rejection_reason,
            "id_submitted_at": self.id_submitted_at.isoformat() if self.id_submitted_at else None,
            "id_reviewed_at": self.id_reviewed_at.isoformat() if self.id_reviewed_at else None,
        }

# --- NEW FUNCTION ADDED TO FIX IMPORTERROR IN app.py ---
def authenticate_user(agency_id, password):
    from .database import SessionLocal
    session = SessionLocal()
    try:
        # Query the actual database table
        user = session.query(User).filter(User.agency_id == agency_id).first()

        # Check if user exists and password matches
        if user and user.password_hash == password:
            return user.role
        return None
    finally:
        session.close()
