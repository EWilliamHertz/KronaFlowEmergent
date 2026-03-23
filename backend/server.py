from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import requests as http_requests
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- PYDANTIC MODELS ---

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class LoginRequest(BaseModel):
    email: str
    password: str

class TransactionCreate(BaseModel):
    type: str
    amount: float
    category: str
    description: str
    date: str
    party: Optional[str] = None
    currency: str = "SEK"
    recurring: bool = False
    recurrence: Optional[str] = None  # weekly, biweekly, monthly, yearly

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

class TransactionBulkCreate(BaseModel):
    transactions: List[TransactionCreate]

class AIInsightRequest(BaseModel):
    context: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    organization: Optional[str] = None
    language: Optional[str] = None
    currency: Optional[str] = None

# Invoice models
class InvoiceItem(BaseModel):
    description: str
    quantity: float = 1
    unit_price: float
    vat_pct: float = 25.0

class InvoiceCreate(BaseModel):
    client_name: str
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    items: List[InvoiceItem]
    issue_date: str
    due_date: str
    currency: str = "SEK"
    notes: Optional[str] = None

class InvoiceStatusUpdate(BaseModel):
    status: str

# Inventory models
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


# --- AUTH HELPERS ---

async def get_current_user(request: Request) -> dict:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def create_session(user_id: str, response: Response) -> str:
    session_token = f"kf_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/"
    )
    return session_token


# --- AUTH ROUTES ---

@api_router.post("/auth/register")
async def register(data: RegisterRequest, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "picture": None,
        "hashed_password": hashed_pw,
        "organization": None,
        "language": "en",
        "currency": "SEK",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    session_token = await create_session(user_id, response)
    user_doc.pop("hashed_password", None)
    user_doc.pop("_id", None)
    return {"user": user_doc, "session_token": session_token}


@api_router.post("/auth/login")
async def login(data: LoginRequest, response: Response):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    hashed_pw = user.get("hashed_password")
    if not hashed_pw:
        raise HTTPException(status_code=401, detail="Please login with Google")
    if not bcrypt.checkpw(data.password.encode(), hashed_pw.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    session_token = await create_session(user["user_id"], response)
    user.pop("hashed_password", None)
    return {"user": user, "session_token": session_token}


@api_router.get("/auth/session")
async def exchange_session(session_id: str, response: Response):
    res = http_requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id}
    )
    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = res.json()
    email = data["email"]
    name = data["name"]
    picture = data.get("picture")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "hashed_password": None,
            "organization": None,
            "language": "en",
            "currency": "SEK",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"picture": picture, "name": name}}
        )
        user = await db.users.find_one({"email": email}, {"_id": 0})

    session_token = await create_session(user["user_id"], response)
    user.pop("hashed_password", None)
    user.pop("_id", None)
    return {"user": user, "session_token": session_token}


@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    user.pop("hashed_password", None)
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}


# --- DASHBOARD ---

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year

    all_txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    monthly_txns = [t for t in all_txns if t.get("month") == current_month and t.get("year") == current_year]
    monthly_income = sum(t["amount"] for t in monthly_txns if t["type"] == "income")
    monthly_expenses = sum(t["amount"] for t in monthly_txns if t["type"] == "expense")

    assets = await db.assets.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    total_asset_value = sum(a["current_value"] for a in assets)
    debts = await db.debts.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    total_debt = sum(d["remaining_amount"] for d in debts)
    net_worth = total_asset_value - total_debt

    total_income_all = sum(t["amount"] for t in all_txns if t["type"] == "income")
    total_expense_all = sum(t["amount"] for t in all_txns if t["type"] == "expense")
    total_balance = total_income_all - total_expense_all

    trend = []
    for i in range(5, -1, -1):
        m = current_month - i
        y = current_year
        while m <= 0:
            m += 12
            y -= 1
        month_txns = [t for t in all_txns if t.get("month") == m and t.get("year") == y]
        inc = sum(t["amount"] for t in month_txns if t["type"] == "income")
        exp = sum(t["amount"] for t in month_txns if t["type"] == "expense")
        month_name = datetime(y, m, 1).strftime("%b")
        trend.append({"month": month_name, "income": inc, "expenses": exp})

    recent_txns = sorted(all_txns, key=lambda x: x.get("date", ""), reverse=True)[:5]
    budgets = await db.budgets.find(
        {"user_id": user_id, "month": current_month, "year": current_year}, {"_id": 0}
    ).to_list(None)
    budget_overview = []
    for budget in budgets:
        spent = sum(t["amount"] for t in monthly_txns if t["type"] == "expense" and t["category"] == budget["category"])
        budget_overview.append({
            "category": budget["category"],
            "allocated": budget["allocated_amount"],
            "spent": spent,
            "percentage": round((spent / budget["allocated_amount"] * 100) if budget["allocated_amount"] > 0 else 0, 1)
        })

    return {
        "total_balance": total_balance,
        "monthly_income": monthly_income,
        "monthly_expenses": monthly_expenses,
        "net_worth": net_worth,
        "trend": trend,
        "recent_transactions": recent_txns,
        "budget_overview": budget_overview,
        "assets_total": total_asset_value,
        "debts_total": total_debt
    }


# --- TRANSACTIONS ---

@api_router.get("/transactions")
async def get_transactions(
    type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    query = {"user_id": user["user_id"]}
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    txns = await db.transactions.find(query, {"_id": 0}).to_list(None)
    if search:
        sl = search.lower()
        txns = [t for t in txns if sl in t.get("description", "").lower() or sl in (t.get("party") or "").lower()]
    txns.sort(key=lambda x: x.get("date", ""), reverse=True)
    return txns


@api_router.post("/transactions")
async def create_transaction(data: TransactionCreate, user: dict = Depends(get_current_user)):
    txn_id = f"txn_{uuid.uuid4().hex[:12]}"
    try:
        date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except Exception:
        date_obj = datetime.now(timezone.utc)
    txn = {
        "id": txn_id,
        "user_id": user["user_id"],
        "type": data.type,
        "amount": data.amount,
        "currency": data.currency,
        "category": data.category,
        "description": data.description,
        "date": data.date[:10],
        "party": data.party,
        "month": date_obj.month,
        "year": date_obj.year,
        "recurring": data.recurring,
        "recurrence": data.recurrence,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(txn)
    txn.pop("_id", None)
    return txn


@api_router.put("/transactions/{txn_id}")
async def update_transaction(txn_id: str, data: TransactionCreate, user: dict = Depends(get_current_user)):
    try:
        date_obj = datetime.strptime(data.date[:10], "%Y-%m-%d")
    except Exception:
        date_obj = datetime.now(timezone.utc)
    update_data = {
        "type": data.type,
        "amount": data.amount,
        "currency": data.currency,
        "category": data.category,
        "description": data.description,
        "date": data.date[:10],
        "party": data.party,
        "month": date_obj.month,
        "year": date_obj.year,
    }
    result = await db.transactions.update_one(
        {"id": txn_id, "user_id": user["user_id"]}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    txn = await db.transactions.find_one({"id": txn_id}, {"_id": 0})
    return txn


@api_router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str, user: dict = Depends(get_current_user)):
    result = await db.transactions.delete_one({"id": txn_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"message": "Deleted"}


@api_router.post("/transactions/delete-bulk")
async def bulk_delete_transactions(data: dict, user: dict = Depends(get_current_user)):
    ids = data.get("ids", [])
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")
    result = await db.transactions.delete_many({"id": {"$in": ids}, "user_id": user["user_id"]})
    return {"deleted": result.deleted_count}


@api_router.post("/transactions/bulk")
async def bulk_import_transactions(data: TransactionBulkCreate, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    created_count = 0
    for txn_data in data.transactions:
        try:
            date_obj = datetime.strptime(txn_data.date[:10], "%Y-%m-%d")
        except Exception:
            date_obj = datetime.now(timezone.utc)
        txn = {
            "id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": txn_data.type,
            "amount": abs(txn_data.amount),
            "currency": txn_data.currency,
            "category": txn_data.category,
            "description": txn_data.description,
            "date": txn_data.date[:10],
            "party": txn_data.party,
            "month": date_obj.month,
            "year": date_obj.year,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(txn)
        created_count += 1
    return {"imported": created_count}


@api_router.get("/transactions/stats")
async def get_transaction_stats(
    month: Optional[int] = None,
    year: Optional[int] = None,
    user: dict = Depends(get_current_user)
):
    all_txns = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(None)
    # Only filter by period when both month AND year are explicitly provided
    # Otherwise show ALL-TIME stats so totals match the full transaction list
    if month is not None and year is not None:
        period_txns = [t for t in all_txns if t.get("month") == month and t.get("year") == year]
    elif year is not None:
        period_txns = [t for t in all_txns if t.get("year") == year]
    else:
        period_txns = all_txns  # All time — matches full transaction list
    total_income = sum(t["amount"] for t in period_txns if t["type"] == "income")
    total_expenses = sum(t["amount"] for t in period_txns if t["type"] == "expense")
    category_stats = {}
    for t in period_txns:
        cat = t["category"]
        if cat not in category_stats:
            category_stats[cat] = {"income": 0, "expense": 0}
        category_stats[cat][t["type"]] += t["amount"]
    by_category = [{"category": k, **v} for k, v in category_stats.items()]
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income - total_expenses,
        "by_category": by_category,
        "transaction_count": len(period_txns)
    }


# --- BUDGETS ---

@api_router.get("/budgets")
async def get_budgets(month: Optional[int] = None, year: Optional[int] = None, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    m = month or now.month
    y = year or now.year
    budgets = await db.budgets.find({"user_id": user["user_id"], "month": m, "year": y}, {"_id": 0}).to_list(None)
    txns = await db.transactions.find(
        {"user_id": user["user_id"], "month": m, "year": y, "type": "expense"}, {"_id": 0}
    ).to_list(None)
    for budget in budgets:
        spent = sum(t["amount"] for t in txns if t["category"] == budget["category"])
        budget["spent"] = spent
        budget["percentage"] = round((spent / budget["allocated_amount"] * 100) if budget["allocated_amount"] > 0 else 0, 1)
    return budgets


@api_router.post("/budgets")
async def create_budget(data: BudgetCreate, user: dict = Depends(get_current_user)):
    existing = await db.budgets.find_one(
        {"user_id": user["user_id"], "category": data.category, "month": data.month, "year": data.year},
        {"_id": 0}
    )
    if existing:
        raise HTTPException(status_code=400, detail="Budget already exists for this category and period")
    budget = {
        "id": f"bud_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "category": data.category,
        "allocated_amount": data.allocated_amount,
        "currency": data.currency,
        "month": data.month,
        "year": data.year,
        "spent": 0,
        "percentage": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.budgets.insert_one(budget)
    budget.pop("_id", None)
    return budget


@api_router.put("/budgets/{budget_id}")
async def update_budget(budget_id: str, data: BudgetCreate, user: dict = Depends(get_current_user)):
    result = await db.budgets.update_one(
        {"id": budget_id, "user_id": user["user_id"]},
        {"$set": {"allocated_amount": data.allocated_amount, "category": data.category}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    budget = await db.budgets.find_one({"id": budget_id}, {"_id": 0})
    return budget


@api_router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, user: dict = Depends(get_current_user)):
    result = await db.budgets.delete_one({"id": budget_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {"message": "Deleted"}


# --- ASSETS ---

@api_router.get("/assets")
async def get_assets(type: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if type:
        query["type"] = type
    assets = await db.assets.find(query, {"_id": 0}).to_list(None)
    for asset in assets:
        pv = asset.get("purchase_value") or 0
        cv = asset.get("current_value") or 0
        if pv > 0:
            asset["gain_loss"] = cv - pv
            asset["gain_loss_pct"] = round(((cv - pv) / pv) * 100, 2)
        else:
            asset["gain_loss"] = 0
            asset["gain_loss_pct"] = 0
    return assets


@api_router.post("/assets")
async def create_asset(data: AssetCreate, user: dict = Depends(get_current_user)):
    asset = {
        "id": f"ast_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "type": data.type,
        "name": data.name,
        "current_value": data.current_value,
        "purchase_value": data.purchase_value,
        "quantity": data.quantity,
        "currency": data.currency,
        "description": data.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assets.insert_one(asset)
    asset.pop("_id", None)
    return asset


@api_router.put("/assets/{asset_id}")
async def update_asset(asset_id: str, data: AssetCreate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.assets.update_one(
        {"id": asset_id, "user_id": user["user_id"]}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset = await db.assets.find_one({"id": asset_id}, {"_id": 0})
    return asset


@api_router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, user: dict = Depends(get_current_user)):
    result = await db.assets.delete_one({"id": asset_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"message": "Deleted"}


# --- DEBTS ---

@api_router.get("/debts")
async def get_debts(user: dict = Depends(get_current_user)):
    return await db.debts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(None)


@api_router.post("/debts")
async def create_debt(data: DebtCreate, user: dict = Depends(get_current_user)):
    debt = {
        "id": f"dbt_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "type": data.type,
        "total_amount": data.total_amount,
        "remaining_amount": data.remaining_amount,
        "interest_rate": data.interest_rate,
        "monthly_payment": data.monthly_payment,
        "currency": data.currency,
        "payments": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.debts.insert_one(debt)
    debt.pop("_id", None)
    return debt


@api_router.put("/debts/{debt_id}")
async def update_debt(debt_id: str, data: DebtCreate, user: dict = Depends(get_current_user)):
    update_data = {
        "name": data.name, "type": data.type,
        "total_amount": data.total_amount, "remaining_amount": data.remaining_amount,
        "interest_rate": data.interest_rate, "monthly_payment": data.monthly_payment,
        "currency": data.currency,
    }
    result = await db.debts.update_one(
        {"id": debt_id, "user_id": user["user_id"]}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    return await db.debts.find_one({"id": debt_id}, {"_id": 0})


@api_router.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, user: dict = Depends(get_current_user)):
    result = await db.debts.delete_one({"id": debt_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    return {"message": "Deleted"}


@api_router.post("/debts/{debt_id}/payment")
async def make_payment(debt_id: str, data: PaymentCreate, user: dict = Depends(get_current_user)):
    debt = await db.debts.find_one({"id": debt_id, "user_id": user["user_id"]}, {"_id": 0})
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    payment = {"amount": data.amount, "date": data.date, "note": data.note, "id": f"pay_{uuid.uuid4().hex[:12]}"}
    new_remaining = max(0, debt["remaining_amount"] - data.amount)
    await db.debts.update_one(
        {"id": debt_id},
        {"$push": {"payments": payment}, "$set": {"remaining_amount": new_remaining}}
    )
    return await db.debts.find_one({"id": debt_id}, {"_id": 0})


# --- AI INSIGHTS ---

@api_router.post("/ai/insights")
async def get_ai_insights(data: AIInsightRequest, user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    now = datetime.now(timezone.utc)
    txns = await db.transactions.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    budgets = await db.budgets.find({"user_id": user_id, "month": now.month, "year": now.year}, {"_id": 0}).to_list(None)
    assets = await db.assets.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    debts = await db.debts.find({"user_id": user_id}, {"_id": 0}).to_list(None)
    monthly_txns = [t for t in txns if t.get("month") == now.month and t.get("year") == now.year]
    monthly_income = sum(t["amount"] for t in monthly_txns if t["type"] == "income")
    monthly_expenses = sum(t["amount"] for t in monthly_txns if t["type"] == "expense")
    total_assets = sum(a["current_value"] for a in assets)
    total_debts = sum(d["remaining_amount"] for d in debts)

    financial_summary = f"""
Financial Summary for {user.get('name', 'User')} ({now.strftime('%B %Y')}):
- Monthly Income: {monthly_income:,.0f} SEK
- Monthly Expenses: {monthly_expenses:,.0f} SEK
- Net This Month: {monthly_income - monthly_expenses:,.0f} SEK
- Total Assets Value: {total_assets:,.0f} SEK
- Total Outstanding Debts: {total_debts:,.0f} SEK
- Net Worth: {total_assets - total_debts:,.0f} SEK
- Transactions this month: {len(monthly_txns)}
- Active budgets: {len(budgets)}
- Assets tracked: {len(assets)}
- Debts tracked: {len(debts)}"""

    if data.context:
        financial_summary += f"\n\nUser Question: {data.context}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ai_{user_id}_{uuid.uuid4().hex[:8]}",
        system_message="You are KronaFlow's AI financial advisor. Analyze the user's financial data and provide concise, actionable insights. Be specific with numbers. Keep response under 250 words. Use bullet points."
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    response = await chat.send_message(UserMessage(text=financial_summary))
    return {"insights": response}


# --- PROFILE ---

@api_router.put("/profile")
async def update_profile(data: UpdateProfileRequest, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update_data})
    updated_user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    updated_user.pop("hashed_password", None)
    return updated_user


# --- INVOICES ---

@api_router.get("/invoices")
async def get_invoices(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if status:
        query["status"] = status
    invoices = await db.invoices.find(query, {"_id": 0}).to_list(None)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for inv in invoices:
        if inv.get("status") == "sent" and inv.get("due_date", "9999") < today:
            inv["status"] = "overdue"
    invoices.sort(key=lambda x: x.get("issue_date", ""), reverse=True)
    return invoices


@api_router.post("/invoices")
async def create_invoice(data: InvoiceCreate, user: dict = Depends(get_current_user)):
    subtotal = sum(item.quantity * item.unit_price for item in data.items)
    vat_total = sum(item.quantity * item.unit_price * item.vat_pct / 100 for item in data.items)
    total = subtotal + vat_total
    inv_num = f"INV-{datetime.now(timezone.utc).strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"
    invoice = {
        "id": f"inv_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "invoice_number": inv_num,
        "client_name": data.client_name,
        "client_email": data.client_email,
        "client_address": data.client_address,
        "items": [item.model_dump() for item in data.items],
        "issue_date": data.issue_date,
        "due_date": data.due_date,
        "currency": data.currency,
        "notes": data.notes,
        "subtotal": round(subtotal, 2),
        "vat_total": round(vat_total, 2),
        "total": round(total, 2),
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.invoices.insert_one(invoice)
    invoice.pop("_id", None)
    return invoice


@api_router.put("/invoices/{invoice_id}/status")
async def update_invoice_status(invoice_id: str, data: InvoiceStatusUpdate, user: dict = Depends(get_current_user)):
    allowed = ["draft", "sent", "paid", "overdue"]
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.invoices.update_one(
        {"id": invoice_id, "user_id": user["user_id"]},
        {"$set": {"status": data.status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await db.invoices.find_one({"id": invoice_id}, {"_id": 0})


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(get_current_user)):
    result = await db.invoices.delete_one({"id": invoice_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"message": "Deleted"}


# --- INVENTORY ---

@api_router.get("/inventory")
async def get_inventory(user: dict = Depends(get_current_user)):
    items = await db.inventory.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(None)
    for item in items:
        item["total_value"] = round(item.get("quantity", 0) * item.get("buy_price", 0), 2)
        item["low_stock"] = item.get("quantity", 0) <= item.get("low_stock_threshold", 5)
    return items


@api_router.post("/inventory")
async def create_inventory_item(data: InventoryItemCreate, user: dict = Depends(get_current_user)):
    item = {
        "id": f"inv_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "name": data.name,
        "sku": data.sku,
        "quantity": data.quantity,
        "buy_price": data.buy_price,
        "b2b_price": data.b2b_price,
        "b2c_price": data.b2c_price,
        "vat_pct": data.vat_pct,
        "description": data.description,
        "low_stock_threshold": data.low_stock_threshold,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inventory.insert_one(item)
    item.pop("_id", None)
    return item


@api_router.put("/inventory/{item_id}")
async def update_inventory_item(item_id: str, data: InventoryItemCreate, user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.inventory.update_one(
        {"id": item_id, "user_id": user["user_id"]}, {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return await db.inventory.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/inventory/{item_id}")
async def delete_inventory_item(item_id: str, user: dict = Depends(get_current_user)):
    result = await db.inventory.delete_one({"id": item_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted"}


# --- REPORTS ---

@api_router.get("/reports/summary")
async def get_report_summary(
    period: str = "all",  # all, this_month, last_month, this_year
    user: dict = Depends(get_current_user)
):
    now = datetime.now(timezone.utc)
    all_txns = await db.transactions.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(None)

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

    # Category breakdown
    cat_data = {}
    for t in txns:
        cat = t["category"]
        if cat not in cat_data:
            cat_data[cat] = {"income": 0, "expense": 0, "count": 0}
        cat_data[cat][t["type"]] += t["amount"]
        cat_data[cat]["count"] += 1
    by_category = sorted([{"category": k, **v} for k, v in cat_data.items()], key=lambda x: x["expense"], reverse=True)

    # Monthly trend (last 12 months)
    trend = []
    for i in range(11, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        mt = [t for t in all_txns if t.get("month") == m and t.get("year") == y]
        trend.append({
            "month": datetime(y, m, 1).strftime("%b %y"),
            "income": round(sum(t["amount"] for t in mt if t["type"] == "income"), 2),
            "expenses": round(sum(t["amount"] for t in mt if t["type"] == "expense"), 2)
        })

    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net": total_income - total_expenses,
        "transaction_count": len(txns),
        "by_category": by_category,
        "trend": trend,
        "period": period
    }


# --- APP SETUP ---

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
