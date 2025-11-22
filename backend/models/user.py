# user.py
# Defines the User class used for mock authentication

# --- FIX: Changed '..' to '.' for sibling module import ---
# We use '.' because database.py is in the same 'models' directory as user.py.
from .database import Base 
# -----------------------------------------------------------

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship


# This class will inherit from the Base defined in database.py
class User(Base):
    """
    SQLAlchemy model for a user/agent.
    """
    __tablename__ = 'users'

    # Database Columns
    id = Column(Integer, primary_key=True, index=True)
    agency_id = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)  # We will store the hashed password here
    role = Column(String, default="FieldAgent", nullable=False)

    # Relationship to other tables (if needed later, e.g., Incidents, Reports)
    # reports = relationship("DamageReport", back_populates="reporter")

    def __init__(self, agency_id, password_hash, role):
        self.agency_id = agency_id
        self.password_hash = password_hash  # Hashed or plain (for this mock)
        self.role = role

    @staticmethod
    def find_by_agency_id(agency_id):
        """
        Mock database lookup. Maps agency IDs to user data.
        """
        # NOTE: Passwords are plain text for simplicity in this mock, but should be hashed in production!
        MOCK_USERS = {
            "Cmdr-001": {"password": "password123", "role": "Commander"},
            "Agent-47": {"password": "fieldpass", "role": "FieldAgent"},
            "Analyst-A": {"password": "secure", "role": "DataAnalyst"},
        }
        
        user_data = MOCK_USERS.get(agency_id)
        
        if user_data:
            # When creating the mock User object, we use the class defined here, 
            # though it acts as a plain object until fully integrated with the ORM.
            return User(
                agency_id=agency_id,
                # In a real app, this would be the actual hash from the DB
                password_hash=user_data["password"], 
                role=user_data["role"]
            )
        return None

    def check_password(self, password):
        """
        Mock password check. In production, this would use a library like bcrypt.
        """
        return self.password_hash == password

    def __repr__(self):
        return f"<User(agency_id='{self.agency_id}', role='{self.role}')>"

# --- NEW FUNCTION ADDED TO FIX IMPORTERROR IN app.py ---
def authenticate_user(agency_id, password):
    """
    Authenticates a user against the mock database.
    
    Returns the user's role (string) on success, or None on failure.
    """
    user = User.find_by_agency_id(agency_id)
    
    if user and user.check_password(password):
        # Authentication successful
        return user.role
    
    # Authentication failed
    return None