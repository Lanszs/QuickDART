from sqlalchemy import Column, Integer, String
from ..models.database import Base # Relative import from database.py

# --- 1. SQLAlchemy User Model Definition ---

class User(Base):
    """
    SQLAlchemy Model for Agents accessing the Disaster Response Platform.
    Note: Passwords should be hashed using libraries like Werkzeug or bcrypt
    in a production environment. This implementation uses plain text for mock data.
    """
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    agencyId = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False) # e.g., 'Commander', 'FieldAgent', 'Analyst'

    def __repr__(self):
        return f"<User(agencyId='{self.agencyId}', role='{self.role}')>"

# --- 2. Mock User Database for Initial Testing ---

# In a real application, you would query the database here.
# For now, we use a simple list of dictionaries to mock the database records.
MOCK_USERS = [
    {
        'agencyId': 'Cmdr-001',
        'password': 'password123', # Insecure, for testing only
        'role': 'Commander',
    },
    {
        'agencyId': 'Agent-47',
        'password': 'fieldpass',
        'role': 'FieldAgent',
    },
    {
        'agencyId': 'Analyst-A',
        'password': 'secure',
        'role': 'Analyst',
    }
]

def get_user_by_agency_id(agency_id: str):
    """
    Mocks a database lookup by iterating through the MOCK_USERS list.
    """
    for user in MOCK_USERS:
        if user['agencyId'] == agency_id:
            return user
    return None