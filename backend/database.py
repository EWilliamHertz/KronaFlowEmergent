import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey

# Database Configuration
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./kronaflow.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# Dependency to get DB session
async def get_async_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session

# --- Models ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    currency = Column(String, default="SEK")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    type = Column(String)  # 'income' or 'expense'
    amount = Column(Float)
    currency = Column(String, default="SEK")
    category = Column(String)
    description = Column(String)
    date = Column(String)
    month = Column(Integer)
    year = Column(Integer)
    party = Column(String, nullable=True)
    recurring = Column(Boolean, default=False)
    recurrence = Column(String, nullable=True)

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    category = Column(String)
    allocated_amount = Column(Float)
    currency = Column(String, default="SEK")
    month = Column(Integer)
    year = Column(Integer)

class Debt(Base):
    __tablename__ = "debts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    type = Column(String)
    name = Column(String)
    total_amount = Column(Float)
    remaining_amount = Column(Float)
    interest_rate = Column(Float)
    monthly_payment = Column(Float, default=0.0)
    currency = Column(String, default="SEK")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    type = Column(String)
    name = Column(String)
    current_value = Column(Float)
    purchase_value = Column(Float, nullable=True)
    quantity = Column(Float, nullable=True)
    currency = Column(String, default="SEK")
    description = Column(String, nullable=True)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    invoice_number = Column(String)
    client_name = Column(String)
    issue_date = Column(String)
    due_date = Column(String)
    status = Column(String) # draft, sent, paid, overdue, cancelled
    currency = Column(String, default="SEK")
    notes = Column(String, nullable=True)
    items = Column(String) # Stored as JSON string
    total = Column(Float)

class InventoryItem(Base):
    __tablename__ = "inventory"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    name = Column(String)
    sku = Column(String, nullable=True)
    quantity = Column(Float)
    buy_price = Column(Float)
    category = Column(String, nullable=True)
    description = Column(String, nullable=True)

# --- NEW: SAVINGS MODELS ---
class SavingsGoal(Base):
    __tablename__ = "savings_goals_v2" # <--- CHANGED THIS
    id = Column(String, primary_key=True, default=lambda: f"svg_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False) # UUID matches your User table!
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    target_date = Column(String, nullable=True)
    icon = Column(String, default="🎯")

class SavingsContribution(Base):
    __tablename__ = "savings_contribs_v2" # <--- CHANGED THIS
    id = Column(String, primary_key=True, default=lambda: f"svc_{uuid.uuid4().hex[:12]}")
    goal_id = Column(String, ForeignKey("savings_goals_v2.id"), nullable=False) # Point to v2!
    amount = Column(Float, nullable=False)
    contributor_name = Column(String, default="Me")
    date = Column(String, nullable=False)
    goal = relationship("SavingsGoal", back_populates="contributions")