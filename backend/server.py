import os
import uuid
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, AsyncGenerator

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# --- SQLALCHEMY & FASTAPI-USERS IMPORTS ---
from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, JSON, Uuid, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.future import select
from sqlalchemy.pool import NullPool
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, schemas, models
from fastapi_users.authentication import AuthenticationBackend, BearerTransport, JWTStrategy
from fastapi_users.db import SQLAlchemyBaseUserTableUUID, SQLAlchemyUserDatabase

# --- OPENAI IMPORT ---
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DATABASE_URL = os.environ.get("DATABASE_URL")
JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-fallback")
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def to_dict(obj):
    if not obj:
        return None
    return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}

# ==========================================
# 1. SQLALCHEMY DATABASE & MODELS
# ==========================================

engine = create_async_engine(
    DATABASE_URL, 
    echo=False,
    pool_pre_ping=True,
    poolclass=NullPool
)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class User(SQLAlchemyBaseUserTableUUID, Base):
    name = Column(String, nullable=True)
    organization = Column(String, nullable=True)
    language = Column(String, default="en")
    currency = Column(String, default="SEK")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True, default=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    type = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    date = Column(String, nullable=False)
    party = Column(String, nullable=True)
    currency = Column(String, default="SEK")
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    recurring = Column(Boolean, default=False)
    recurrence = Column(String, nullable=True)
    linked_debt_id = Column(String, nullable=True)
    linked_investment_id = Column(String, nullable=True)

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(String, primary_key=True, default=lambda: f"bud_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    category = Column(String, nullable=False)
    allocated_amount = Column(Float, nullable=False)
    currency = Column(String, default="SEK")
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

class Category(Base):
    __tablename__ = "categories"
    id = Column(String, primary_key=True, default=lambda: f"cat_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)

class Investment(Base):
    __tablename__ = "investments"
    id = Column(String, primary_key=True, default=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    current_value = Column(Float, nullable=False)
    purchase_date = Column(String, nullable=False)
    currency = Column(String, default="SEK")
    description = Column(String, nullable=True)

class InvestmentHistory(Base):
    __tablename__ = "investment_history"
    id = Column(String, primary_key=True, default=lambda: f"ivh_{uuid.uuid4().hex[:12]}")
    investment_id = Column(String, ForeignKey("investments.id"), nullable=False)
    recorded_date = Column(String, nullable=False)
    recorded_value = Column(Float, nullable=False)

class Debt(Base):
    __tablename__ = "debts"
    id = Column(String, primary_key=True, default=lambda: f"dbt_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    remaining_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    monthly_payment = Column(Float, nullable=False)
    currency = Column(String, default="SEK")
    payments = Column(JSON, default=list)

# --- NEW: RECEIVABLES MODEL ---
class Receivable(Base):
    __tablename__ = "receivables"
    id = Column(String, primary_key=True, default=lambda: f"rcv_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    total_amount = Column(Float, nullable=False)
    remaining_amount = Column(Float, nullable=False)
    interest_rate = Column(Float, nullable=False)
    monthly_payment = Column(Float, nullable=False)
    currency = Column(String, default="SEK")
    payments = Column(JSON, default=list)

class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True, default=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    invoice_number = Column(String, nullable=False)
    client_name = Column(String, nullable=False)
    client_email = Column(String, nullable=True)
    client_address = Column(String, nullable=True)
    items = Column(JSON, default=list)
    issue_date = Column(String, nullable=False)
    due_date = Column(String, nullable=False)
    currency = Column(String, default="SEK")
    notes = Column(String, nullable=True)
    subtotal = Column(Float, nullable=False)
    vat_total = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String, default="draft")



class SavingsGoal(Base):
    __tablename__ = "savings_goals_v2" 
    id = Column(String, primary_key=True, default=lambda: f"svg_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    name = Column(String, nullable=False)
    target_amount = Column(Float, nullable=False)
    target_date = Column(String, nullable=True)
    icon = Column(String, default="🎯")

class SavingsContribution(Base):
    __tablename__ = "savings_contribs_v2"
    id = Column(String, primary_key=True, default=lambda: f"svc_{uuid.uuid4().hex[:12]}")
    goal_id = Column(String, ForeignKey("savings_goals_v2.id"), nullable=False)
    amount = Column(Float, nullable=False)
    contributor_name = Column(String, default="Me")
    date = Column(String, nullable=False)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)

# ==========================================
# 2. FASTAPI-USERS AUTH SETUP
# ==========================================

class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = JWT_SECRET
    verification_token_secret = JWT_SECRET

async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)

bearer_transport = BearerTransport(tokenUrl="api/auth/jwt/login")

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=JWT_SECRET, lifetime_seconds=7 * 24 * 3600)

auth_backend = AuthenticationBackend(
    name="jwt", transport=bearer_transport, get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])
current_active_user = fastapi_users.current_user(active=True)

class UserRead(schemas.BaseUser[uuid.UUID]):
    name: Optional[str] = None
    organization: Optional[str] = None
    language: str = "en"
    currency: str = "SEK"

class UserCreate(schemas.BaseUserCreate):
    name: str

class UserUpdate(schemas.BaseUserUpdate):
    name: Optional[str] = None
    organization: Optional[str] = None
    language: Optional[str] = None
    currency: Optional[str] = None

# ==========================================
# 3. PYDANTIC SCHEMAS (APP LOGIC)
# ==========================================

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category: str
    description: str
    date: str
    party: Optional[str] = None
    currency: str = "SEK"
    recurring: bool = False
    recurrence: Optional[str] = None

class CategoryCreate(BaseModel):
    name: str
    type: str

class TransactionBulkCreate(BaseModel):
    transactions: List[TransactionCreate]

class BudgetCreate(BaseModel):
    category: str
    allocated_amount: float
    month: int
    year: int
    currency: str = "SEK"

class InvestmentCreate(BaseModel):
    name: str
    category: str
    quantity: float
    buy_price: float
    purchase_date: str
    currency: str = "SEK"
    description: Optional[str] = None

class InvestmentValueUpdate(BaseModel):
    current_value: float
    date: str

class DebtCreate(BaseModel):
    name: str
    type: str
    total_amount: float
    remaining_amount: float
    interest_rate: float
    monthly_payment: float
    currency: str = "SEK"

# --- NEW: RECEIVABLE SCHEMA ---
class ReceivableCreate(BaseModel):
    name: str
    type: str
    total_amount: float
    remaining_amount: float
    interest_rate: float
    monthly_payment: float
    currency: str = "SEK"

class DebtTransactionCreate(BaseModel):
    amount: float
    action: str
    date: str
    note: Optional[str] = None
    currency: str = "SEK"

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    language: Optional[str] = None
    currency: Optional[str] = None

class InvoiceItemSchema(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    vat_pct: float = 25.0

class InvoiceCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    items: List[InvoiceItemSchema]
    issue_date: str
    due_date: str
    currency: str = "SEK"
    notes: Optional[str] = None

class InvoiceStatusUpdate(BaseModel):
    status: str



class AIInsightRequest(BaseModel):
    context: Optional[str] = None

class SavingsGoalCreate(BaseModel):
    name: str
    target_amount: float
    target_date: Optional[str] = None
    icon: str = "🎯"

class SavingsContributionCreate(BaseModel):
    amount: float
    contributor_name: str = "Me"
    date: str

# ==========================================
# 4. APP SETUP & ROUTES
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    yield

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@api_router.get("/init-db")
async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all, checkfirst=True)
        return {"message": "All database tables (including Receivables) checked and created perfectly!"}
    except Exception as e:
        return {"error": str(e)}

@api_router.get("/migrate-investments-schema")
async def migrate_investments_schema(session: AsyncSession = Depends(get_async_session)):
    """Add linked_investment_id column to transactions table if it doesn't exist"""
    try:
        # Check if column exists
        check_result = await session.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='linked_investment_id'")
        )
        if check_result.fetchone():
            return {"message": "linked_investment_id column already exists"}
        
        # Add the column
        await session.execute(
            text("ALTER TABLE transactions ADD COLUMN linked_investment_id VARCHAR(255) NULL")
        )
        await session.commit()
        return {"message": "Successfully added linked_investment_id column to transactions table"}
    except Exception as e:
        return {"error": str(e)}

@api_router.post("/migrate-investments-schema")
async def migrate_investments_schema_post(session: AsyncSession = Depends(get_async_session)):
    """POST version for iPad compatibility"""
    try:
        # Check if column exists
        check_result = await session.execute(
            text("SELECT column_name FROM information_schema.columns WHERE table_name='transactions' AND column_name='linked_investment_id'")
        )
        if check_result.fetchone():
            return {"message": "linked_investment_id column already exists"}
        
        # Add the column
        await session.execute(
            text("ALTER TABLE transactions ADD COLUMN linked_investment_id VARCHAR(255) NULL")
        )
        await session.commit()
        return {"message": "Successfully added linked_investment_id column to transactions table"}
    except Exception as e:
        return {"error": str(e)}

@api_router.get("/categories")
async def get_categories(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Category).where(Category.user_id == user.id))
    return [to_dict(c) for c in result.scalars().all()]

@api_router.post("/categories")
async def create_category(data: CategoryCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    existing = await session.execute(
        select(Category).where(Category.user_id == user.id, Category.name == data.name, Category.type == data.type)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Category already exists")
    new_cat = Category(user_id=user.id, name=data.name, type=data.type)
    session.add(new_cat)
    await session.commit()
    await session.refresh(new_cat)
    return to_dict(new_cat)

@api_router.get("/transactions")
async def get_transactions(
    type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    query = select(Transaction).where(Transaction.user_id == user.id)
    if type and type != 'all': query = query.where(Transaction.type == type)
    if category: query = query.where(Transaction.category == category)
    if start_date: query = query.where(Transaction.date >= start_date)
    if end_date: query = query.where(Transaction.date <= end_date)
    if min_amount is not None: query = query.where(Transaction.amount >= min_amount)
    if max_amount is not None: query = query.where(Transaction.amount <= max_amount)
    
    result = await session.execute(query)
    txns = [to_dict(t) for t in result.scalars().all()]
    if search:
        sl = search.lower()
        txns = [t for t in txns if sl in (t.get("description") or "").lower() or sl in (t.get("party") or "").lower()]
    return sorted(txns, key=lambda x: x.get("date", ""), reverse=True)
@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    from datetime import timedelta
    import calendar

    try: 
        date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except: 
        date_obj = datetime.now(timezone.utc)
        
    new_txn = Transaction(
        user_id=user.id, type=data.type, amount=data.amount, currency=data.currency,
        category=data.category, description=data.description, date=data.date[:10],
        party=data.party, month=date_obj.month, year=date_obj.year,
        recurring=data.recurring, recurrence=data.recurrence
    )
    session.add(new_txn)
    
    if data.recurring and data.recurrence:
        occurrences = {'weekly': 52, 'biweekly': 26, 'monthly': 11, 'yearly': 1}.get(data.recurrence, 0)
        for i in range(1, occurrences + 1):
            if data.recurrence == 'weekly':
                next_date = date_obj + timedelta(days=7 * i)
            elif data.recurrence == 'biweekly':
                next_date = date_obj + timedelta(days=14 * i)
            elif data.recurrence == 'monthly':
                m = date_obj.month - 1 + i
                y = date_obj.year + m // 12
                m = m % 12 + 1
                d = min(date_obj.day, calendar.monthrange(y, m)[1])
                next_date = date_obj.replace(year=y, month=m, day=d)
            elif data.recurrence == 'yearly':
                next_date = date_obj.replace(year=date_obj.year + i)
                
            future_txn = Transaction(
                user_id=user.id, type=data.type, amount=data.amount, currency=data.currency,
                category=data.category, description=data.description, date=next_date.strftime("%Y-%m-%d"),
                party=data.party, month=next_date.month, year=next_date.year,
                recurring=True, recurrence=data.recurrence
            )
            session.add(future_txn)

    await session.commit()
    await session.refresh(new_txn)
    return to_dict(new_txn)

@api_router.put("/transactions/{txn_id}")
async def update_transaction(txn_id: str, data: TransactionCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user.id))
    txn = result.scalars().first()
    if not txn: raise HTTPException(status_code=404, detail="Transaction not found")
    try: date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except: date_obj = datetime.now(timezone.utc)
    txn.type = data.type
    txn.amount = data.amount
    txn.currency = data.currency
    txn.category = data.category
    txn.description = data.description
    txn.date = data.date[:10]
    txn.party = data.party
    txn.month = date_obj.month
    txn.year = date_obj.year
    await session.commit()
    await session.refresh(txn)
    return to_dict(txn)

@api_router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Transaction).where(Transaction.id == txn_id, Transaction.user_id == user.id))
    txn = result.scalars().first()
    if not txn: raise HTTPException(status_code=404, detail="Transaction not found")
    await session.delete(txn)
    await session.commit()
    return {"message": "Deleted"}

@api_router.post("/transactions/delete-bulk")
async def bulk_delete_transactions(data: dict, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    ids = data.get("ids", [])
    if not ids: raise HTTPException(status_code=400, detail="No IDs provided")
    result = await session.execute(select(Transaction).where(Transaction.id.in_(ids), Transaction.user_id == user.id))
    txns = result.scalars().all()
    for txn in txns: session.delete(txn)
    await session.commit()
    return {"deleted": len(txns)}

@api_router.post("/transactions/bulk")
async def bulk_import_transactions(data: TransactionBulkCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    created_count = 0
    for txn_data in data.transactions:
        try: date_obj = datetime.strptime(txn_data.date[:10], "%Y-%m-%d")
        except: date_obj = datetime.now(timezone.utc)
        new_txn = Transaction(
            user_id=user.id, type=txn_data.type, amount=abs(txn_data.amount), currency=txn_data.currency,
            category=txn_data.category, description=txn_data.description, date=txn_data.date[:10],
            party=txn_data.party, month=date_obj.month, year=date_obj.year
        )
        session.add(new_txn)
        created_count += 1
    await session.commit()
    return {"imported": created_count}

@api_router.get("/transactions/stats")
async def get_transaction_stats(month: Optional[int] = None, year: Optional[int] = None, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Transaction).where(Transaction.user_id == user.id))
    all_txns = [to_dict(t) for t in result.scalars().all()]
    if month is not None and year is not None:
        period_txns = [t for t in all_txns if t.get("month") == month and t.get("year") == year]
    elif year is not None:
        period_txns = [t for t in all_txns if t.get("year") == year]
    else:
        period_txns = all_txns
    total_income = sum(t["amount"] for t in period_txns if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in period_txns if t["type"] == "expense")
    category_stats = {}
    for t in period_txns:
        cat = t["category"]
        if cat not in category_stats: category_stats[cat] = {"income": 0, "expense": 0}
        category_stats[cat][t["type"]] += t["amount"]
    by_category = [{"category": k, **v} for k, v in category_stats.items()]
    return {
        "total_income": total_income, "total_expenses": total_expenses,
        "net": total_income - total_expenses, "by_category": by_category,
        "transaction_count": len(period_txns)
    }

@api_router.get("/budgets")
async def get_budgets(month: Optional[int] = None, year: Optional[int] = None, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    m = month or now.month
    y = year or now.year
    budgets_res = await session.execute(select(Budget).where(Budget.user_id == user.id, Budget.month == m, Budget.year == y))
    txns_res = await session.execute(select(Transaction).where(Transaction.user_id == user.id, Transaction.month == m, Transaction.year == y, Transaction.type == "expense"))
    budgets = [to_dict(b) for b in budgets_res.scalars().all()]
    txns = [to_dict(t) for t in txns_res.scalars().all()]
    for budget in budgets:
        spent = sum(t["amount"] for t in txns if t["category"] == budget["category"])
        budget["spent"] = spent
        budget["percentage"] = round((spent / budget["allocated_amount"] * 100) if budget["allocated_amount"] > 0 else 0, 1)
    return budgets

@api_router.post("/budgets")
async def create_budget(data: BudgetCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    existing = await session.execute(select(Budget).where(Budget.user_id == user.id, Budget.category == data.category, Budget.month == data.month, Budget.year == data.year))
    if existing.scalars().first(): raise HTTPException(status_code=400, detail="Budget already exists")
    new_budget = Budget(user_id=user.id, **data.model_dump())
    session.add(new_budget)
    await session.commit()
    await session.refresh(new_budget)
    return to_dict(new_budget)

@api_router.put("/budgets/{budget_id}")
async def update_budget(budget_id: str, data: BudgetCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    budget = result.scalars().first()
    if not budget: raise HTTPException(status_code=404, detail="Budget not found")
    budget.allocated_amount = data.allocated_amount
    budget.category = data.category
    await session.commit()
    await session.refresh(budget)
    return to_dict(budget)

@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    budget = result.scalars().first()
    if not budget: raise HTTPException(status_code=404, detail="Budget not found")
    await session.delete(budget)
    await session.commit()
    return {"message": "Deleted"}

# --- INVESTMENTS ---
@api_router.get("/investments")
async def get_investments(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.user_id == user.id))
    investments = [to_dict(i) for i in result.scalars().all()]
    for investment in investments:
        buy_total = investment.get("quantity", 0) * investment.get("buy_price", 0)
        current_total = investment.get("current_value", 0)
        if buy_total > 0:
            investment["profit_loss"] = current_total - buy_total
            investment["profit_loss_pct"] = round(((current_total - buy_total) / buy_total) * 100, 2)
        else:
            investment["profit_loss"] = 0
            investment["profit_loss_pct"] = 0
    return investments

@api_router.get("/investments/{investment_id}")
async def get_investment_detail(investment_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.id == investment_id, Investment.user_id == user.id))
    investment = result.scalars().first()
    if not investment: raise HTTPException(status_code=404, detail="Investment not found")
    
    inv_dict = to_dict(investment)
    buy_total = investment.quantity * investment.buy_price
    inv_dict["profit_loss"] = investment.current_value - buy_total
    inv_dict["profit_loss_pct"] = round(((investment.current_value - buy_total) / buy_total) * 100, 2) if buy_total > 0 else 0
    
    # Get history
    history_result = await session.execute(select(InvestmentHistory).where(InvestmentHistory.investment_id == investment_id).order_by(InvestmentHistory.recorded_date))
    history = [to_dict(h) for h in history_result.scalars().all()]
    inv_dict["history"] = history
    
    return inv_dict

@api_router.post("/investments")
async def create_investment(data: InvestmentCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_investment = Investment(user_id=user.id, **data.model_dump())
    session.add(new_investment)
    await session.flush()
    
    # Create initial history entry
    initial_history = InvestmentHistory(
        investment_id=new_investment.id,
        recorded_date=data.purchase_date,
        recorded_value=data.quantity * data.buy_price
    )
    session.add(initial_history)
    
    # Create transaction for the purchase
    purchase_txn = Transaction(
        user_id=user.id,
        type="expense",
        amount=data.quantity * data.buy_price,
        category=f"Investment: {data.category}",
        description=f"Purchase of {data.name}",
        date=data.purchase_date,
        currency=data.currency,
        month=int(data.purchase_date.split("-")[1]),
        year=int(data.purchase_date.split("-")[0]),
        linked_investment_id=new_investment.id
    )
    session.add(purchase_txn)
    await session.commit()
    await session.refresh(new_investment)
    return to_dict(new_investment)

@api_router.post("/investments/{investment_id}/update-value")
async def update_investment_value(investment_id: str, data: InvestmentValueUpdate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.id == investment_id, Investment.user_id == user.id))
    investment = result.scalars().first()
    if not investment: raise HTTPException(status_code=404, detail="Investment not found")
    
    investment.current_value = data.current_value
    
    # Add history entry
    new_history = InvestmentHistory(
        investment_id=investment_id,
        recorded_date=data.date,
        recorded_value=data.current_value
    )
    session.add(new_history)
    await session.commit()
    await session.refresh(investment)
    return to_dict(investment)

@api_router.delete("/investments/{investment_id}")
async def delete_investment(investment_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.id == investment_id, Investment.user_id == user.id))
    investment = result.scalars().first()
    if not investment: raise HTTPException(status_code=404, detail="Investment not found")
    
    # Delete history
    await session.execute(text(f"DELETE FROM investment_history WHERE investment_id = '{investment_id}'"))
    # Delete linked transactions
    await session.execute(text(f"DELETE FROM transactions WHERE linked_investment_id = '{investment_id}'"))
    # Delete investment
    await session.delete(investment)
    await session.commit()
    return {"message": "Deleted"}
# --- INVESTMENTS ---
@api_router.get("/investments")
async def get_investments(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.user_id == user.id))
    investments = [to_dict(i) for i in result.scalars().all()]
    for investment in investments:
        buy_total = investment.get("quantity", 0) * investment.get("buy_price", 0)
        current_total = investment.get("current_value", 0)
        if buy_total > 0:
            investment["profit_loss"] = current_total - buy_total
            investment["profit_loss_pct"] = round(((current_total - buy_total) / buy_total) * 100, 2)
        else:
            investment["profit_loss"] = 0
            investment["profit_loss_pct"] = 0
    return investments

@api_router.get("/investments/{investment_id}")
async def get_investment_detail(investment_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.id == investment_id, Investment.user_id == user.id))
    investment = result.scalars().first()
    if not investment: raise HTTPException(status_code=404, detail="Investment not found")
    
    inv_dict = to_dict(investment)
    buy_total = investment.quantity * investment.buy_price
    inv_dict["profit_loss"] = investment.current_value - buy_total
    inv_dict["profit_loss_pct"] = round(((investment.current_value - buy_total) / buy_total) * 100, 2) if buy_total > 0 else 0
    
    # Get history for charts
    history_result = await session.execute(select(InvestmentHistory).where(InvestmentHistory.investment_id == investment_id).order_by(InvestmentHistory.recorded_date))
    history = [to_dict(h) for h in history_result.scalars().all()]
    inv_dict["history"] = history
    
    return inv_dict

@api_router.post("/investments")
async def create_investment(data: InvestmentCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_investment = Investment(user_id=user.id, **data.model_dump())
    session.add(new_investment)
    await session.flush()
    
    # Create initial history entry automatically
    initial_history = InvestmentHistory(
        investment_id=new_investment.id,
        recorded_date=data.purchase_date,
        recorded_value=data.quantity * data.buy_price 
    )
    session.add(initial_history)
    
    # Create transaction for the purchase automatically
    purchase_txn = Transaction(
        user_id=user.id,
        type="expense",
        amount=data.quantity * data.buy_price,
        category=f"Investment: {data.category}",
        description=f"Purchase of {data.name}",
        date=data.purchase_date,
        currency=data.currency,
        month=int(data.purchase_date.split("-")[1]),
        year=int(data.purchase_date.split("-")[0]),
        linked_investment_id=new_investment.id
    )
    session.add(purchase_txn)
    await session.commit()
    await session.refresh(new_investment)
    return to_dict(new_investment)

@api_router.post("/investments/{investment_id}/update-value")
async def update_investment_value(investment_id: str, data: InvestmentValueUpdate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.id == investment_id, Investment.user_id == user.id))
    investment = result.scalars().first()
    if not investment: raise HTTPException(status_code=404, detail="Investment not found")
    
    investment.current_value = data.current_value
    
    new_history = InvestmentHistory(
        investment_id=investment_id,
        recorded_date=data.date,
        recorded_value=data.current_value
    )
    session.add(new_history)
    await session.commit()
    await session.refresh(investment)
    return to_dict(investment)

@api_router.delete("/investments/{investment_id}")
async def delete_investment(investment_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Investment).where(Investment.id == investment_id, Investment.user_id == user.id))
    investment = result.scalars().first()
    if not investment: raise HTTPException(status_code=404, detail="Investment not found")
    
    await session.execute(text(f"DELETE FROM investment_history WHERE investment_id = '{investment_id}'"))
    await session.execute(text(f"DELETE FROM transactions WHERE linked_investment_id = '{investment_id}'"))
    await session.delete(investment)
    await session.commit()
    return {"message": "Deleted"}
# --- DEBTS ---
@api_router.get("/debts")
async def get_debts(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Debt).where(Debt.user_id == user.id))
    return [to_dict(d) for d in result.scalars().all()]

@api_router.post("/debts")
async def create_debt(data: DebtCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_debt = Debt(user_id=user.id, **data.model_dump())
    session.add(new_debt)
    await session.commit()
    await session.refresh(new_debt)
    return to_dict(new_debt)

@api_router.put("/debts/{debt_id}")
async def update_debt(debt_id: str, data: DebtCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id))
    debt = result.scalars().first()
    if not debt: raise HTTPException(status_code=404, detail="Debt not found")
    for key, value in data.model_dump().items():
        setattr(debt, key, value)
    await session.commit()
    await session.refresh(debt)
    return to_dict(debt)

@api_router.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id))
    debt = result.scalars().first()
    if not debt: raise HTTPException(status_code=404, detail="Debt not found")
    await session.delete(debt)
    await session.commit()
    return {"message": "Deleted"}

@api_router.get("/debts/{debt_id}")
async def get_single_debt(debt_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id))
    debt = result.scalars().first()
    if not debt: raise HTTPException(status_code=404, detail="Debt not found")
    txn_result = await session.execute(
        select(Transaction)
        .where(Transaction.linked_debt_id == debt_id, Transaction.user_id == user.id)
        .order_by(Transaction.date.desc())
    )
    linked_txns = [to_dict(t) for t in txn_result.scalars().all()]
    debt_dict = to_dict(debt)
    debt_dict["history"] = linked_txns
    return debt_dict

@api_router.post("/debts/{debt_id}/transaction")
async def record_debt_transaction(debt_id: str, data: DebtTransactionCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id))
    debt = result.scalars().first()
    if not debt: raise HTTPException(status_code=404, detail="Debt not found")
    try: date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except: date_obj = datetime.now(timezone.utc)
    if data.action == "payment":
        debt.remaining_amount = max(0, debt.remaining_amount - data.amount)
        txn_type = "expense"
        txn_category = "Debt Repayment"
        desc = data.note or f"Payment to {debt.name}"
    elif data.action == "increase":
        debt.remaining_amount += data.amount
        debt.total_amount += data.amount
        txn_type = "income"
        txn_category = "Loan Disbursement"
        desc = data.note or f"Additional funds from {debt.name}"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'payment' or 'increase'")
    new_txn = Transaction(
        user_id=user.id, type=txn_type, amount=data.amount, currency=data.currency,
        category=txn_category, description=desc, date=data.date[:10],
        party=debt.name, month=date_obj.month, year=date_obj.year, linked_debt_id=debt.id
    )
    session.add(new_txn)
    await session.commit()
    await session.refresh(debt)
    return to_dict(debt)

# --- NEW: RECEIVABLES ---
@api_router.get("/receivables")
async def get_receivables(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Receivable).where(Receivable.user_id == user.id))
    return [to_dict(d) for d in result.scalars().all()]

@api_router.post("/receivables")
async def create_receivable(data: ReceivableCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_rec = Receivable(user_id=user.id, **data.model_dump())
    session.add(new_rec)
    await session.commit()
    await session.refresh(new_rec)
    return to_dict(new_rec)

@api_router.put("/receivables/{id}")
async def update_receivable(id: str, data: ReceivableCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Receivable).where(Receivable.id == id, Receivable.user_id == user.id))
    rec = result.scalars().first()
    if not rec: raise HTTPException(status_code=404, detail="Receivable not found")
    for key, value in data.model_dump().items():
        setattr(rec, key, value)
    await session.commit()
    await session.refresh(rec)
    return to_dict(rec)

@api_router.delete("/receivables/{id}")
async def delete_receivable(id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Receivable).where(Receivable.id == id, Receivable.user_id == user.id))
    rec = result.scalars().first()
    if not rec: raise HTTPException(status_code=404, detail="Receivable not found")
    await session.delete(rec)
    await session.commit()
    return {"message": "Deleted"}

@api_router.get("/receivables/{id}")
async def get_single_receivable(id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Receivable).where(Receivable.id == id, Receivable.user_id == user.id))
    rec = result.scalars().first()
    if not rec: raise HTTPException(status_code=404, detail="Receivable not found")
    txn_result = await session.execute(
        select(Transaction)
        .where(Transaction.linked_debt_id == id, Transaction.user_id == user.id)
        .order_by(Transaction.date.desc())
    )
    linked_txns = [to_dict(t) for t in txn_result.scalars().all()]
    rec_dict = to_dict(rec)
    rec_dict["history"] = linked_txns
    return rec_dict

@api_router.post("/receivables/{id}/transaction")
async def record_receivable_transaction(id: str, data: DebtTransactionCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Receivable).where(Receivable.id == id, Receivable.user_id == user.id))
    rec = result.scalars().first()
    if not rec: raise HTTPException(status_code=404, detail="Receivable not found")
    try: date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except: date_obj = datetime.now(timezone.utc)
    
    if data.action == "payment":
        rec.remaining_amount = max(0, rec.remaining_amount - data.amount)
        txn_type = "income"
        txn_category = "Debt Collection"
        desc = data.note or f"Payment received from {rec.name}"
    elif data.action == "increase":
        rec.remaining_amount += data.amount
        rec.total_amount += data.amount
        txn_type = "expense"
        txn_category = "Loan Given"
        desc = data.note or f"Additional funds lent to {rec.name}"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'payment' or 'increase'")
        
    new_txn = Transaction(
        user_id=user.id, type=txn_type, amount=data.amount, currency=data.currency,
        category=txn_category, description=desc, date=data.date[:10],
        party=rec.name, month=date_obj.month, year=date_obj.year, linked_debt_id=rec.id
    )
    session.add(new_txn)
    await session.commit()
    await session.refresh(rec)
    return to_dict(rec)

# --- DASHBOARD & NET WORTH MATH ---
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    current_month, current_year = now.month, now.year
    txns_res = await session.execute(select(Transaction).where(Transaction.user_id == user.id))
    all_txns = [to_dict(t) for t in txns_res.scalars().all()]
    
    # Investments + Receivables - Debts = Net Worth
    investments_res = await session.execute(select(Investment).where(Investment.user_id == user.id))
    total_investments_value = sum(i.current_value for i in investments_res.scalars().all())
    
    debts_res = await session.execute(select(Debt).where(Debt.user_id == user.id))
    total_debt = sum(d.remaining_amount for d in debts_res.scalars().all())
    
    receivables_res = await session.execute(select(Receivable).where(Receivable.user_id == user.id))
    total_receivable = sum(r.remaining_amount for r in receivables_res.scalars().all())
    
    monthly_txns = [t for t in all_txns if t.get("month") == current_month and t.get("year") == current_year]
    monthly_income = sum(t["amount"] for t in monthly_txns if t["type"] == "income")
    monthly_expenses = sum(t["amount"] for t in monthly_txns if t["type"] == "expense")
    total_income_all = sum(t["amount"] for t in all_txns if t["type"] == "income")
    total_expense_all = sum(t["amount"] for t in all_txns if t["type"] == "expense")
    recent_txns = sorted(all_txns, key=lambda x: x.get("date", ""), reverse=True)[:5]
    
    trend = []
    for i in range(5, -1, -1):
        m = current_month - i; y = current_year
        while m <= 0: m += 12; y -= 1
        month_txns = [t for t in all_txns if t.get("month") == m and t.get("year") == y]
        inc = sum(t["amount"] for t in month_txns if t["type"] == "income")
        exp = sum(t["amount"] for t in month_txns if t["type"] == "expense")
        trend.append({"month": datetime(y, m, 1).strftime("%b"), "income": inc, "expenses": exp})
        
    # NEW: 6-Month Cashflow Forecast
    past_3_months = trend[-3:] if len(trend) >= 3 else trend
    avg_inc = sum(t["income"] for t in past_3_months) / len(past_3_months) if past_3_months else 0
    avg_exp = sum(t["expenses"] for t in past_3_months) / len(past_3_months) if past_3_months else 0
    
    forecast = []
    current_sim_balance = total_income_all - total_expense_all
    for i in range(1, 7):
        fm = current_month + i
        fy = current_year
        while fm > 12:
            fm -= 12
            fy += 1
        current_sim_balance += (avg_inc - avg_exp)
        forecast.append({
            "month": datetime(fy, fm, 1).strftime("%b %y"),
            "projected_balance": round(current_sim_balance, 2)
        })

    budgets_res = await session.execute(select(Budget).where(Budget.user_id == user.id, Budget.month == current_month, Budget.year == current_year))
    budget_overview = []
    for budget in budgets_res.scalars().all():
        spent = sum(t["amount"] for t in monthly_txns if t["type"] == "expense" and t["category"] == budget.category)
        budget_overview.append({
            "category": budget.category, "allocated": budget.allocated_amount, "spent": spent,
            "percentage": round((spent / budget.allocated_amount * 100) if budget.allocated_amount > 0 else 0, 1)
        })
        
    return {
        "total_balance": total_income_all - total_expense_all,
        "monthly_income": monthly_income, "monthly_expenses": monthly_expenses,
        "net_worth": (total_investments_value + total_receivable) - total_debt, 
        "recent_transactions": recent_txns,
        "investments_total": total_investments_value, "debts_total": total_debt,
        "trend": trend, "budget_overview": budget_overview,
        "forecast": forecast # Sent to the frontend
    }
@api_router.post("/ai/insights")
async def get_ai_insights(data: AIInsightRequest, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    txns_res = await session.execute(select(Transaction).where(Transaction.user_id == user.id, Transaction.month == now.month))
    monthly_txns = [to_dict(t) for t in txns_res.scalars().all()]
    monthly_income = sum(t["amount"] for t in monthly_txns if t["type"] == "income")
    monthly_expenses = sum(t["amount"] for t in monthly_txns if t["type"] == "expense")
    financial_summary = f"Summary for {user.name or 'User'} ({now.strftime('%B %Y')}): Income {monthly_income} SEK, Expense {monthly_expenses} SEK."
    if data.context: financial_summary += f"\nUser Question: {data.context}"
    client = AsyncOpenAI(api_key=EMERGENT_LLM_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Analyze data as an AI advisor. Keep under 250 words."},
            {"role": "user", "content": financial_summary}
        ]
    )
    return {"insights": response.choices[0].message.content}

@api_router.put("/profile")
async def update_profile(data: UpdateProfileRequest, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(User).where(User.id == user.id))
    db_user = result.scalars().first()
    for key, value in data.model_dump().items():
        if value is not None: setattr(db_user, key, value)
    await session.commit()
    await session.refresh(db_user)
    return {
        "id": str(db_user.id), "email": db_user.email, "name": db_user.name, 
        "organization": db_user.organization, "language": db_user.language, "currency": db_user.currency
    }

@api_router.get("/invoices")
async def get_invoices(status: Optional[str] = None, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    query = select(Invoice).where(Invoice.user_id == user.id)
    if status: query = query.where(Invoice.status == status)
    result = await session.execute(query)
    invoices = [to_dict(inv) for inv in result.scalars().all()]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for inv in invoices:
        if inv.get("status") == "sent" and inv.get("due_date", "9999") < today:
            inv["status"] = "overdue"
    return sorted(invoices, key=lambda x: x.get("issue_date", ""), reverse=True)

@api_router.post("/invoices")
async def create_invoice(data: InvoiceCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    subtotal = sum(item.quantity * item.unit_price for item in data.items)
    vat_total = sum(item.quantity * item.unit_price * item.vat_pct / 100 for item in data.items)
    inv_num = f"INV-{datetime.now(timezone.utc).strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"
    new_invoice = Invoice(
        user_id=user.id, invoice_number=inv_num, client_name=data.client_name,
        client_email=data.client_email, client_address=data.client_address,
        items=[item.model_dump() for item in data.items], issue_date=data.issue_date,
        due_date=data.due_date, currency=data.currency, notes=data.notes,
        subtotal=round(subtotal, 2), vat_total=round(vat_total, 2),
        total=round(subtotal + vat_total, 2), status="draft"
    )
    session.add(new_invoice)
    await session.commit()
    await session.refresh(new_invoice)
    return to_dict(new_invoice)

@api_router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, data: InvoiceStatusUpdate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    allowed = ["draft", "sent", "paid", "overdue"]
    if data.status not in allowed: raise HTTPException(status_code=400, detail="Invalid status")
    result = await session.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id))
    invoice = result.scalars().first()
    if not invoice: raise HTTPException(status_code=404, detail="Invoice not found")
    invoice.status = data.status
    await session.commit()
    await session.refresh(invoice)
    return to_dict(invoice)

@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.user_id == user.id))
    invoice = result.scalars().first()
    if not invoice: raise HTTPException(status_code=404, detail="Invoice not found")
    await session.delete(invoice)
    await session.commit()
    return {"message": "Deleted"}



@api_router.get("/check-db")
async def check_database_schema(session: AsyncSession = Depends(get_async_session)):
    try:
        tables_res = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
        tables = [row[0] for row in tables_res.fetchall()]
        cols_res = await session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'"))
        txn_columns = [row[0] for row in cols_res.fetchall()]
        return {"existing_tables": tables, "transactions_columns": txn_columns, "missing_linked_debt_id": "linked_debt_id" not in txn_columns}
    except Exception as e: return {"error": str(e)}

@api_router.get("/reports/summary")
async def get_report_summary(period: str = "all", user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    result = await session.execute(select(Transaction).where(Transaction.user_id == user.id))
    all_txns = [to_dict(t) for t in result.scalars().all()]
    if period == "this_month": txns = [t for t in all_txns if t.get("month") == now.month and t.get("year") == now.year]
    elif period == "last_month":
        lm = now.month - 1 or 12
        ly = now.year if now.month > 1 else now.year - 1
        txns = [t for t in all_txns if t.get("month") == lm and t.get("year") == ly]
    elif period == "this_year": txns = [t for t in all_txns if t.get("year") == now.year]
    else: txns = all_txns
    total_income = sum(t["amount"] for t in txns if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in txns if t["type"] == "expense")
    cat_data = {}
    for t in txns:
        cat = t["category"]
        if cat not in cat_data: cat_data[cat] = {"income": 0, "expense": 0, "count": 0}
        cat_data[cat][t["type"]] += t["amount"]
        cat_data[cat]["count"] += 1
    by_category = sorted([{"category": k, **v} for k, v in cat_data.items()], key=lambda x: x["expense"], reverse=True)
    trend = []
    for i in range(11, -1, -1):
        m = now.month - i; y = now.year
        while m <= 0: m += 12; y -= 1
        mt = [t for t in all_txns if t.get("month") == m and t.get("year") == y]
        trend.append({"month": datetime(y, m, 1).strftime("%b %y"), "income": round(sum(t["amount"] for t in mt if t["type"] == "income"), 2), "expenses": round(sum(t["amount"] for t in mt if t["type"] == "expense"), 2)})
    return {"total_income": total_income, "total_expenses": total_expenses, "net": total_income - total_expenses, "transaction_count": len(txns), "by_category": by_category, "trend": trend, "period": period}

@api_router.get("/savings")
async def get_savings(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(SavingsGoal).where(SavingsGoal.user_id == user.id))
    goals = result.scalars().all()
    data = []
    for g in goals:
        c_result = await session.execute(select(SavingsContribution).where(SavingsContribution.goal_id == g.id).order_by(SavingsContribution.date.desc()))
        contribs = c_result.scalars().all()
        total_saved = sum(c.amount for c in contribs)
        data.append({
            "id": g.id,
            "name": g.name,
            "target_amount": g.target_amount,
            "target_date": g.target_date,
            "icon": g.icon,
            "total_saved": total_saved,
            "contributions": [{"id": c.id, "amount": c.amount, "contributor_name": c.contributor_name, "date": c.date} for c in contribs]
        })
    return data

@api_router.post("/savings")
async def create_saving(data: SavingsGoalCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_goal = SavingsGoal(user_id=user.id, name=data.name, target_amount=data.target_amount, target_date=data.target_date, icon=data.icon)
    session.add(new_goal)
    await session.commit()
    return {"status": "success"}

@api_router.post("/savings/{goal_id}/contribute")
async def contribute_saving(goal_id: str, data: SavingsContributionCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_contrib = SavingsContribution(goal_id=goal_id, amount=data.amount, contributor_name=data.contributor_name, date=data.date)
    session.add(new_contrib)
    await session.commit()
    return {"status": "success"}

@api_router.delete("/savings/{goal_id}")
async def delete_saving(goal_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id))
    goal = result.scalars().first()
    if goal:
        c_result = await session.execute(select(SavingsContribution).where(SavingsContribution.goal_id == goal.id))
        contribs = c_result.scalars().all()
        for c in contribs:
            await session.delete(c)
        await session.delete(goal)
        await session.commit()
    return {"status": "deleted"}

app.include_router(api_router)
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/api/auth/jwt", tags=["auth"])
app.include_router(fastapi_users.get_register_router(UserRead, UserCreate), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/api/users", tags=["users"])