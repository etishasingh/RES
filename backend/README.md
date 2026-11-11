# PayPilot AI – Backend

FastAPI + SQLite service for PayPilot AI, powering authentication, profiles, project/milestone workflows, ProofFlow ML evaluation/recommendations, PayPal Sandbox milestone checkout, PayPilot Impact, and PayPilot Spotlight.

## Requirements

- Python 3.11+

## Setup & Run

```bash
cd backend

# 1. Create virtual environment
python3 -m venv .venv

# 2. Activate it
#   Windows:
.venv\Scripts\activate
#   macOS/Linux:
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Configure environment
#   Copy .env.example to .env and fill in your own values:
cp .env.example .env      # macOS/Linux (use `copy .env.example .env` on Windows)
```

### Getting Your Own PayPal Sandbox Keys

1. Go to [developer.paypal.com](https://developer.paypal.com) and sign in.
2. Open **Dashboard → Apps & Credentials**, switch to the **Sandbox** tab, and click **Create App**.
3. Choose **Merchant** as the App Type and select a **US Sandbox Business** account *(recommended since PayPilot projects default to `USD` — India `IN` sandbox accounts may block `USD` test transactions)*.
4. Copy your **Client ID** and **Secret Key** into `backend/.env`:
   - `PAYPAL_CLIENT_ID=<your-sandbox-client-id>`
   - `PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>`
   - `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`
5. Also set `SESSION_SECRET` (e.g. `python -c "import secrets; print(secrets.token_hex(48))"`) and `DEMO_PASSWORD` in `backend/.env`.
6. When testing milestone checkout in the browser, sign into the PayPal popup using a **US Sandbox Personal** buyer account from **Dashboard → Testing Tools → Sandbox Accounts** (never use a real PayPal account).

### Seed & Start Server

```bash
# 5. Seed demo accounts (optional, idempotent)
python seed.py

# 6. Start server
uvicorn main:app --reload --port 8000
```

## Frontend (Vite + React)

```bash
# In project root
npm install
npm run dev
```

Vite proxies `/api/*` → `http://localhost:8000`. Run both servers simultaneously.

## Demo Accounts

| Role       | Email                     | Password          |
|------------|---------------------------|-------------------|
| Freelancer | elena@demo.paypilot       | See `DEMO_PASSWORD` |
| Client     | client@demo.paypilot      | See `DEMO_PASSWORD` |

> **Never commit `backend/.env`.** It is gitignored so your secrets stay private.

## API Endpoints

| Method | Path | Auth Required | Description |
|--------|------|---------------|-------------|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| GET | `/api/auth/me` | Yes (cookie / Bearer) | Get current user |
| POST | `/api/auth/logout` | No | Clear session cookie |
| GET / PATCH | `/api/profile/me` | Yes | Get / update profile |
| GET | `/api/freelancers` | Yes | List freelancers |
| GET / POST / PATCH | `/api/projects/*` | Yes | Projects, milestones, requests, submissions, reviews |
| POST | `/api/recommend`, `/api/evaluate` | Yes | ProofFlow ML recommender & deliverable evaluator |
| GET / POST | `/api/payments/*` | Yes | PayPal Sandbox config, order creation, capture, ledger |
| GET / POST / PUT | `/api/impact/*` | Public / Yes | PayPilot Impact overview, initiatives, contributions, badges |
| GET / POST / PUT | `/api/spotlight/*` | Public / Yes | PayPilot Spotlight packages, purchases, active status |
| GET | `/api/health` | No | Health check |

## Backend Tests

```bash
backend/.venv/bin/python -m unittest discover -s backend -p "test_*.py" -v
```
