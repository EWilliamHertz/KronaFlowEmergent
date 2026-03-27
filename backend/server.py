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
from sqlalchemy import Column, String, Float, Integer, Boolean, ForeignKey, JSON, Uuid
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.future import select
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

# --- SAFE DICT HELPER ---
# This safely removes the SQLAlchemy internal state so FastAPI can convert it to JSON!
def to_dict(obj):
    if not obj:
        return None
    return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}

# ==========================================
# 1. SQLALCHEMY DATABASE & MODELS
# ==========================================

engine = create_async_engine(DATABASE_URL, echo=False)
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

class Budget(Base):
    __tablename__ = "budgets"
    id = Column(String, primary_key=True, default=lambda: f"bud_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    category = Column(String, nullable=False)
    allocated_amount = Column(Float, nullable=False)
    currency = Column(String, default="SEK")
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

class Asset(Base):
    __tablename__ = "assets"
    id = Column(String, primary_key=True, default=lambda: f"ast_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    type = Column(String, nullable=False)
    name = Column(String, nullable=False)
    current_value = Column(Float, nullable=False)
    purchase_value = Column(Float, nullable=True)
    quantity = Column(Float, nullable=True)
    currency = Column(String, default="SEK")
    description = Column(String, nullable=True)

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

class InventoryItem(Base):
    __tablename__ = "inventory"
    id = Column(String, primary_key=True, default=lambda: f"inv_{uuid.uuid4().hex[:12]}")
    user_id = Column(Uuid, ForeignKey("user.id"), nullable=False)
    name = Column(String, nullable=False)
    sku = Column(String, nullable=True)
    quantity = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    b2b_price = Column(Float, nullable=True)
    b2c_price = Column(Float, nullable=True)
    vat_pct = Column(Float, default=25.0)
    description = Column(String, nullable=True)
    low_stock_threshold = Column(Float, default=5.0)

# DB Dependency
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
    return JWTStrategy(secret=JWT_SECRET, lifetime_seconds=7 * 24 * 3600) # 7 days

auth_backend = AuthenticationBackend(
    name="jwt", transport=bearer_transport, get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])
current_active_user = fastapi_users.current_user(active=True)

# Auth Pydantic Schemas
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

class TransactionBulkCreate(BaseModel):
    transactions: List[TransactionCreate]

class BudgetCreate(BaseModel):
    category: str
    allocated_amount: float
    month: int
    year: int
    currency: str = "SEK"

class AssetCreate(BaseModel):
    type: str
    name: str
    current_value: float
    purchase_value: Optional[float] = None
    quantity: Optional[float] = None
    currency: str = "SEK"
    description: Optional[str] = None

class DebtCreate(BaseModel):
    name: str
    type: str
    total_amount: float
    remaining_amount: float
    interest_rate: float
    monthly_payment: float
    currency: str = "SEK"

class PaymentCreate(BaseModel):
    amount: float
    date: str
    note: Optional[str] = None

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

class InventoryItemCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    quantity: float
    buy_price: float
    b2b_price: Optional[float] = None
    b2c_price: Optional[float] = None
    vat_pct: float = 25.0
    description: Optional[str] = None
    low_stock_threshold: float = 5

class AIInsightRequest(BaseModel):
    context: Optional[str] = None

# ==========================================
# 4. APP SETUP & ROUTES
# ==========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-create tables in NeonDB on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

# Standard Auth Routes auto-generated by FastAPI-Users
app.include_router(fastapi_users.get_auth_router(auth_backend), prefix="/api/auth/jwt", tags=["auth"])
app.include_router(fastapi_users.get_register_router(UserRead, UserCreate), prefix="/api/auth", tags=["auth"])
app.include_router(fastapi_users.get_users_router(UserRead, UserUpdate), prefix="/api/users", tags=["users"])


# --- TRANSACTIONS ---

@api_router.get("/transactions")
async def get_transactions(
    type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session)
):
    query = select(Transaction).where(Transaction.user_id == user.id)
    if type: query = query.where(Transaction.type == type)
    if category: query = query.where(Transaction.category == category)
    
    result = await session.execute(query)
    txns = [to_dict(t) for t in result.scalars().all()]
    
    if search:
        sl = search.lower()
        txns = [t for t in txns if sl in (t.get("description") or "").lower() or sl in (t.get("party") or "").lower()]
        
    return sorted(txns, key=lambda x: x.get("date", ""), reverse=True)


@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    try: date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except: date_obj = datetime.now(timezone.utc)
    
    new_txn = Transaction(
        user_id=user.id, type=data.type, amount=data.amount, currency=data.currency,
        category=data.category, description=data.description, date=data.date[:10],
        party=data.party, month=date_obj.month, year=date_obj.year,
        recurring=data.recurring, recurrence=data.recurrence
    )
    session.add(new_txn)
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

# --- BUDGETS ---

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
    if existing.scalars().first(): raise HTTPException(status_code=400, detail="Budget already exists for this category and period")
    
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

# --- ASSETS ---

@api_router.get("/assets")
async def get_assets(type: Optional[str] = None, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    query = select(Asset).where(Asset.user_id == user.id)
    if type: query = query.where(Asset.type == type)
    
    result = await session.execute(query)
    assets = [to_dict(a) for a in result.scalars().all()]
    
    for asset in assets:
        pv = asset.get("purchase_value") or 0
        cv = asset.get("current_value") or 0
        if pv > 0:
            asset["gain_loss"] = cv - pv
            asset["gain_loss_pct"] = round(((cv - pv) / pv) * 100, 2)
        else:
            asset["gain_loss"] = 0; asset["gain_loss_pct"] = 0
    return assets

@api_router.post("/assets")
async def create_asset(data: AssetCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_asset = Asset(user_id=user.id, **data.model_dump())
    session.add(new_asset)
    await session.commit()
    await session.refresh(new_asset)
    return to_dict(new_asset)

@api_router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, data: AssetCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id))
    asset = result.scalars().first()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    
    for key, value in data.model_dump().items():
        if value is not None: setattr(asset, key, value)
    await session.commit()
    await session.refresh(asset)
    return to_dict(asset)

@api_router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Asset).where(Asset.id == asset_id, Asset.user_id == user.id))
    asset = result.scalars().first()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    await session.delete(asset)
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

@api_router.post("/debts/{debt_id}/payment")
async def make_payment(debt_id: str, data: PaymentCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Debt).where(Debt.id == debt_id, Debt.user_id == user.id))
    debt = result.scalars().first()
    if not debt: raise HTTPException(status_code=404, detail="Debt not found")
    
    payment = {"amount": data.amount, "date": data.date, "note": data.note, "id": f"pay_{uuid.uuid4().hex[:12]}"}
    debt.remaining_amount = max(0, debt.remaining_amount - data.amount)
    
    # SQLAlchemy JSON mutations require reassignment
    current_payments = list(debt.payments)
    current_payments.append(payment)
    debt.payments = current_payments
    
    await session.commit()
    await session.refresh(debt)
    return to_dict(debt)

# --- DASHBOARD & AI INSIGHTS ---

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    current_month, current_year = now.month, now.year

    txns_res = await session.execute(select(Transaction).where(Transaction.user_id == user.id))
    all_txns = [to_dict(t) for t in txns_res.scalars().all()]
    
    assets_res = await session.execute(select(Asset).where(Asset.user_id == user.id))
    total_asset_value = sum(a.current_value for a in assets_res.scalars().all())
    
    debts_res = await session.execute(select(Debt).where(Debt.user_id == user.id))
    total_debt = sum(d.remaining_amount for d in debts_res.scalars().all())

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
        "net_worth": total_asset_value - total_debt, "recent_transactions": recent_txns,
        "assets_total": total_asset_value, "debts_total": total_debt,
        "trend": trend, "budget_overview": budget_overview
    }

@api_router.post("/ai/insights")
async def get_ai_insights(data: AIInsightRequest, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    
    txns_res = await session.execute(select(Transaction).where(Transaction.user_id == user.id, Transaction.month == now.month))
    monthly_txns = [to_dict(t) for t in txns_res.scalars().all()]
    
    monthly_income = sum(t["amount"] for t in monthly_txns if t["type"] == "income")
    monthly_expenses = sum(t["amount"] for t in monthly_txns if t["type"] == "expense")

    financial_summary = f"""
    Financial Summary for {user.name or 'User'} ({now.strftime('%B %Y')}):
    - Monthly Income: {monthly_income:,.0f} SEK
    - Monthly Expenses: {monthly_expenses:,.0f} SEK
    - Net This Month: {monthly_income - monthly_expenses:,.0f} SEK
    """
    if data.context: financial_summary += f"\n\nUser Question: {data.context}"

    client = AsyncOpenAI(api_key=EMERGENT_LLM_KEY)
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are KronaFlow's AI financial advisor. Analyze data, be specific. Keep under 250 words."},
            {"role": "user", "content": financial_summary}
        ]
    )
    return {"insights": response.choices[0].message.content}

# --- PROFILE ---

@api_router.put("/profile")
async def update_profile(data: UpdateProfileRequest, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    # Need to refetch user from session to update it properly via SQLAlchemy
    result = await session.execute(select(User).where(User.id == user.id))
    db_user = result.scalars().first()
    
    for key, value in data.model_dump().items():
        if value is not None:
            setattr(db_user, key, value)
            
    await session.commit()
    await session.refresh(db_user)
    return {
        "id": str(db_user.id), "email": db_user.email, "name": db_user.name, 
        "organization": db_user.organization, "language": db_user.language, "currency": db_user.currency
    }

# --- INVOICES ---

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
        user_id=user.id,
        invoice_number=inv_num,
        client_name=data.client_name,
        client_email=data.client_email,
        client_address=data.client_address,
        items=[item.model_dump() for item in data.items],
        issue_date=data.issue_date,
        due_date=data.due_date,
        currency=data.currency,
        notes=data.notes,
        subtotal=round(subtotal, 2),
        vat_total=round(vat_total, 2),
        total=round(subtotal + vat_total, 2),
        status="draft"
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

# --- INVENTORY ---

@api_router.get("/inventory")
async def get_inventory(user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(InventoryItem).where(InventoryItem.user_id == user.id))
    items = [to_dict(item) for item in result.scalars().all()]
    
    for item in items:
        item["total_value"] = round(item.get("quantity", 0) * item.get("buy_price", 0), 2)
        item["low_stock"] = item.get("quantity", 0) <= item.get("low_stock_threshold", 5)
    return items

@api_router.post("/inventory")
async def create_inventory_item(data: InventoryItemCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    new_item = InventoryItem(user_id=user.id, **data.model_dump())
    session.add(new_item)
    await session.commit()
    await session.refresh(new_item)
    return to_dict(new_item)

@api_router.put("/inventory/{item_id}")
async def update_inventory_item(item_id: str, data: InventoryItemCreate, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(InventoryItem).where(InventoryItem.id == item_id, InventoryItem.user_id == user.id))
    item = result.scalars().first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in data.model_dump().items():
        if value is not None: setattr(item, key, value)
        
    await session.commit()
    await session.refresh(item)
    return to_dict(item)

@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(InventoryItem).where(InventoryItem.id == item_id, InventoryItem.user_id == user.id))
    item = result.scalars().first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")
    
    await session.delete(item)
    await session.commit()
    return {"message": "Deleted"}

# --- REPORTS ---

@api_router.get("/reports/summary")
async def get_report_summary(period: str = "all", user: User = Depends(current_active_user), session: AsyncSession = Depends(get_async_session)):
    now = datetime.now(timezone.utc)
    
    result = await session.execute(select(Transaction).where(Transaction.user_id == user.id))
    all_txns = [to_dict(t) for t in result.scalars().all()]

    if period == "this_month":
        txns = [t for t in all_txns if t.get("month") == now.month and t.get("year") == now.year]
    elif period == "last_month":
        lm = now.month - 1 or 12
        ly = now.year if now.month > 1 else now.year - 1
        txns = [t for t in all_txns if t.get("month") == lm and t.get("year") == ly]
    elif period == "this_year":
        txns = [t for t in all_txns if t.get("year") == now.year]
    else:
        txns = all_txns

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
        trend.append({
            "month": datetime(y, m, 1).strftime("%b %y"),
            "income": round(sum(t["amount"] for t in mt if t["type"] == "income"), 2),
            "expenses": round(sum(t["amount"] for t in mt if t["type"] == "expense"), 2)
        })

    return {
        "total_income": total_income, "total_expenses": total_expenses,
        "net": total_income - total_expenses, "transaction_count": len(txns),
        "by_category": by_category, "trend": trend, "period": period
    }

# Ensure the router is registered
app.include_router(api_router)