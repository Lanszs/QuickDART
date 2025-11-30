# user.py
# Defines the User class used for mock authentication

# --- FIX: Changed '..' to '.' for sibling module import ---
# We use '.' because database.py is in the same 'models' directory as user.py.
from .database import Base 
# -----------------------------------------------------------

from sqlalchemy import Column, Integer, String, ForeignKey
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

    # Relationship to other tables (if needed later, e.g., Incidents, Reports)
    # reports = relationship("DamageReport", back_populates="reporter")

    def to_dict(self):
        return {
            "id": self.id,
            "agency_id": self.agency_id,
            "role": self.role,
            "team_id": self.team_id
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