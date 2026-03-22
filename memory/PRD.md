# KronaFlow - PRD & Implementation Log

## Problem Statement
Build a modern, professional financial management application called "KronaFlow" with:
- Dark theme (#0A0A0A background, #4FC3C3 cyan accent)
- Swedish/Nordic-focused personal and business finance management
- Full-stack: React + FastAPI + MongoDB

## User Choices
- Authentication: Both JWT email/password AND Google OAuth (Emergent)
- Language: Fully bilingual (Swedish SV + English EN) with switcher
- AI: Claude Sonnet for financial insights
- Charts: Recharts (no specific preference)
- Scope: Dashboard, Transactions, Budgets, Assets, Debts (core 5 pages)

## Architecture
- **Frontend**: React 18, Tailwind CSS, shadcn/ui, Recharts, Framer Motion, Sonner toasts
- **Backend**: FastAPI, Motor (MongoDB async), bcrypt, Emergent Auth OAuth
- **Database**: MongoDB (local), collections: users, user_sessions, transactions, budgets, assets, debts
- **AI**: Claude Sonnet via emergentintegrations (Emergent LLM Key)

## What's Been Implemented

### 2025-02-20 (Initial Build)
- Full authentication system: JWT email/password + Emergent Google OAuth
- Layout with 280px fixed sidebar, 64px header, responsive (mobile/tablet/desktop)
- Bilingual SV/EN language switcher (header + settings)
- Dark theme design system throughout

### Pages Built:
1. **Login/Register** - Split layout, Google OAuth + email/password form
2. **Dashboard** - 4 KPI cards, AreaChart (income/expenses), Budget overview bars, Recent transactions, Quick actions, AI Insights modal
3. **Transactions** - Full CRUD, filter by type/category/search, table view + statistics view (bar + pie charts)
4. **Budgets** - Month selector, budget cards with color-coded progress bars, CRUD modal
5. **Assets** - Type tabs (stock/crypto/real_estate/vehicle/collectible), asset cards with gain/loss, CRUD
6. **Debts** - Summary stats, debt cards with payoff progress, payment modal, debt calculator with payoff chart
7. **Settings** - Profile, Preferences (language/currency), Import CSV, Security sections

### API Endpoints:
- POST /api/auth/register, login, logout
- GET /api/auth/me, session (OAuth exchange)
- GET /api/dashboard/stats
- CRUD /api/transactions, /api/transactions/bulk (CSV import), /api/transactions/stats
- CRUD /api/budgets
- CRUD /api/assets
- CRUD /api/debts, POST /api/debts/{id}/payment
- POST /api/ai/insights (Claude)
- PUT /api/profile

### 2025-02-20 (Feature Updates)
- **Logo replacement**: KronaFlow brand image replaces text/circle logo in sidebar + login page
- **CSV Import**: Settings > Import tab allows bulk importing transactions from CSV files
  - Supports format: Date, Month, Done?, Category, Details, Person, Amount
  - Drag & drop or click to upload
  - Preview table showing all rows before import
  - POST /api/transactions/bulk backend endpoint

## Tech Stack Dependencies
- Frontend: react-router-dom v7, recharts v3, lucide-react, sonner, framer-motion, @phosphor-icons/react
- Backend: fastapi, motor, bcrypt, emergentintegrations (Claude + Emergent Auth)

## Prioritized Backlog

### P0 (Critical - Next Sprint)
- Invoices page (create, send, mark paid)
- Inventory management page
- Corporate accounts / Chart of Accounts

### P1 (Important)
- Reports page (P&L, balance sheet, cash flow, PDF export)
- Transaction filtering by date range
- Budget alerts / notifications when close to limit
- Mobile-optimized layout improvements

### P2 (Nice to Have)
- Recurring transactions
- Multi-currency live exchange rates
- Data export (Excel, PDF)
- Dark/light theme toggle
- Transaction tags/labels
