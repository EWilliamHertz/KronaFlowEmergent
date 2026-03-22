"""KronaFlow Backend API Tests"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_kronaflow_123"

@pytest.fixture
def auth_headers():
    return {"Authorization": f"Bearer {SESSION_TOKEN}"}

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {SESSION_TOKEN}"})
    return s

# --- AUTH ---
class TestAuth:
    def test_register_new_user(self):
        import time
        email = f"TEST_reg_{int(time.time())}@kronaflow.se"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123", "name": "Reg Test"})
        assert r.status_code == 200
        data = r.json()
        assert "user" in data
        assert data["user"]["email"] == email
        assert "session_token" in data

    def test_login_valid(self):
        # Register then login
        import time
        email = f"TEST_login_{int(time.time())}@kronaflow.se"
        requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "TestPass123", "name": "Login Test"})
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "TestPass123"})
        assert r.status_code == 200
        data = r.json()
        assert "user" in data
        assert data["user"]["email"] == email

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "nope@nope.com", "password": "wrong"})
        assert r.status_code == 401

    def test_get_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "user_id" in data
        assert "email" in data

# --- DASHBOARD ---
class TestDashboard:
    def test_dashboard_stats(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "total_balance" in data
        assert "monthly_income" in data
        assert "monthly_expenses" in data
        assert "net_worth" in data
        assert "trend" in data
        assert len(data["trend"]) == 6

# --- TRANSACTIONS ---
class TestTransactions:
    created_id = None

    def test_create_expense_transaction(self, client):
        r = client.post(f"{BASE_URL}/api/transactions", json={
            "type": "expense", "amount": 150.0, "category": "food",
            "description": "TEST_Lunch", "date": "2025-02-01", "currency": "SEK"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["type"] == "expense"
        assert data["amount"] == 150.0
        TestTransactions.created_id = data["id"]

    def test_create_income_transaction(self, client):
        r = client.post(f"{BASE_URL}/api/transactions", json={
            "type": "income", "amount": 5000.0, "category": "salary",
            "description": "TEST_Salary", "date": "2025-02-01", "currency": "SEK"
        })
        assert r.status_code == 200
        assert r.json()["type"] == "income"

    def test_get_transactions(self, client):
        r = client.get(f"{BASE_URL}/api/transactions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        descriptions = [t["description"] for t in data]
        assert any("TEST_" in d for d in descriptions)

    def test_update_transaction(self, client):
        if not TestTransactions.created_id:
            pytest.skip("No transaction to update")
        r = client.put(f"{BASE_URL}/api/transactions/{TestTransactions.created_id}", json={
            "type": "expense", "amount": 200.0, "category": "food",
            "description": "TEST_Lunch_Updated", "date": "2025-02-01", "currency": "SEK"
        })
        assert r.status_code == 200
        assert r.json()["amount"] == 200.0
        assert r.json()["description"] == "TEST_Lunch_Updated"

    def test_delete_transaction(self, client):
        if not TestTransactions.created_id:
            pytest.skip("No transaction to delete")
        r = client.delete(f"{BASE_URL}/api/transactions/{TestTransactions.created_id}")
        assert r.status_code == 200

# --- BUDGETS ---
class TestBudgets:
    created_id = None

    def test_create_budget(self, client):
        import time
        r = client.post(f"{BASE_URL}/api/budgets", json={
            "category": f"TEST_food_{int(time.time())}", "allocated_amount": 3000.0,
            "month": 2, "year": 2025, "currency": "SEK"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["allocated_amount"] == 3000.0
        TestBudgets.created_id = data["id"]

    def test_get_budgets(self, client):
        r = client.get(f"{BASE_URL}/api/budgets?month=2&year=2025")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete_budget(self, client):
        if not TestBudgets.created_id:
            pytest.skip("No budget to delete")
        r = client.delete(f"{BASE_URL}/api/budgets/{TestBudgets.created_id}")
        assert r.status_code == 200

# --- ASSETS ---
class TestAssets:
    created_id = None

    def test_create_asset(self, client):
        r = client.post(f"{BASE_URL}/api/assets", json={
            "type": "stock", "name": "TEST_Apple Stock",
            "current_value": 10000.0, "purchase_value": 8000.0,
            "quantity": 10.0, "currency": "SEK"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Apple Stock"
        TestAssets.created_id = data["id"]

    def test_get_assets(self, client):
        r = client.get(f"{BASE_URL}/api/assets")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_delete_asset(self, client):
        if not TestAssets.created_id:
            pytest.skip("No asset to delete")
        r = client.delete(f"{BASE_URL}/api/assets/{TestAssets.created_id}")
        assert r.status_code == 200

# --- DEBTS ---
class TestDebts:
    created_id = None

    def test_create_debt(self, client):
        r = client.post(f"{BASE_URL}/api/debts", json={
            "name": "TEST_Car Loan", "type": "loan",
            "total_amount": 50000.0, "remaining_amount": 40000.0,
            "interest_rate": 5.5, "monthly_payment": 1500.0, "currency": "SEK"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Car Loan"
        TestDebts.created_id = data["id"]

    def test_get_debts(self, client):
        r = client.get(f"{BASE_URL}/api/debts")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_make_payment(self, client):
        if not TestDebts.created_id:
            pytest.skip("No debt to pay")
        r = client.post(f"{BASE_URL}/api/debts/{TestDebts.created_id}/payment", json={
            "amount": 1500.0, "date": "2025-02-01", "note": "Monthly payment"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["remaining_amount"] == 38500.0

    def test_delete_debt(self, client):
        if not TestDebts.created_id:
            pytest.skip("No debt to delete")
        r = client.delete(f"{BASE_URL}/api/debts/{TestDebts.created_id}")
        assert r.status_code == 200

# --- PROFILE ---
class TestProfile:
    def test_update_profile(self, client):
        r = client.put(f"{BASE_URL}/api/profile", json={"name": "Updated Test User"})
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "Updated Test User"

    def test_logout(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/auth/logout", headers=auth_headers)
        assert r.status_code == 200
