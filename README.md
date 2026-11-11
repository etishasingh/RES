# PayPilot AI

Full-stack freelance milestone collaboration platform combining **ProofFlow ML** deliverable evaluation & recommendations, **PayPal Sandbox** milestone checkout, **PayPilot Impact** social fund allocation, and **PayPilot Spotlight** project/proposal boosting.

---

## Key Features

- **Role-Based Workspaces (Client & Freelancer):** Cookie-authenticated JWT sessions with separate Client and Freelancer dashboards, project creation, invitations, project requests, milestone submissions, and 50/50 AI + client review scoring.
- **ProofFlow ML Engine:** Automated deliverable relevancy evaluation (`/api/evaluate`) and personalized freelancer opportunity/course recommendations (`/api/recommend`).
- **PayPal Sandbox Milestone Checkout:** Server-side PayPal Orders v2 creation & capture (`/api/payments/*`) with `@paypal/react-paypal-js` buttons on accepted milestones and a live client transaction ledger (`/client/payments`).
- **PayPilot Impact:** Transparent platform revenue allocation (`30%` of platform fees, `20%` of Spotlight purchases) into verified social impact initiatives, user contribution tracking, reputation badges, and admin disbursement controls (`/client/impact`, `/freelancer/impact`).
- **PayPilot Spotlight:** Temporary paid visual prominence packages (`Quick`, `Featured`, `Priority`) for projects/proposals with UTC expiration tracking and strict isolation from ML ranking scores.

---

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, `@paypal/react-paypal-js`
- **Backend:** FastAPI, SQLAlchemy (SQLite), Pydantic v2, PyJWT, Passlib/bcrypt, `httpx`, scikit-learn

---

## Project Structure

```text
.
├── src/                  # React + TypeScript frontend
│   ├── components/       # Client, Freelancer, Impact, Spotlight, and shared UI
│   ├── services/         # API clients (auth, projects, payments, impact, spotlight)
│   └── types/            # TypeScript interfaces
├── backend/              # FastAPI + SQLite backend
│   ├── main.py           # FastAPI entry point & router registration
│   ├── db.py             # SQLAlchemy models, migrations & default seeding
│   ├── paypal_service.py # PayPal Sandbox Orders v2 REST client
│   ├── routes_*.py       # Auth, profile, projects, ML, payments, impact, spotlight
│   ├── ml/               # ProofFlow recommender & relevancy models
│   ├── .env.example      # Environment variable template (copy to backend/.env)
│   └── requirements.txt  # Python dependencies
├── package.json
└── vite.config.ts        # Dev server (:3000) with /api proxy to :8000
```

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- A free **PayPal Developer** account at [developer.paypal.com](https://developer.paypal.com)

---

## Setup Instructions

### 1. Clone & Configure Backend (Port `8000`)

```bash
git clone https://github.com/rehan2608/RELS.git
cd RELS/backend

python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env             # Windows: copy .env.example .env
```

### 2. Add Your Own PayPal Sandbox Credentials (`backend/.env`)

Open `backend/.env` and fill in your values:

1. **`SESSION_SECRET`**: Generate a random secret string:
   ```bash
   python -c "import secrets; print(secrets.token_hex(48))"
   ```
2. **`DEMO_PASSWORD`**: Any password you want for the seeded demo accounts.
3. **`PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`**:
   - Go to [developer.paypal.com](https://developer.paypal.com) and sign in.
   - Open **Dashboard → Apps & Credentials**, switch to the **Sandbox** tab, and click **Create App**.
   - Select **Merchant** as the app type and choose a **US Sandbox Business** account *(recommended because PayPilot projects default to `USD`, and India `IN` sandbox accounts can block `USD` test payments)*.
   - Copy the generated **Client ID** and **Secret** into `backend/.env` and keep:
     ```env
     PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
     ```

> **Security note:** Never commit `backend/.env` to GitHub (it is listed in `.gitignore`).

### 3. Seed Demo Accounts & Start Backend

```bash
# Inside backend/ with virtual environment activated
python seed.py
uvicorn main:app --reload --port 8000
```

On startup, the backend initializes SQLite (`backend/paypilot.db`), applies schema migrations, and seeds default **PayPilot Spotlight** packages and **PayPilot Impact** initiatives.

### 4. Start Frontend (Port `3000`)

In a second terminal from the repository root:

```bash
npm install
npm run dev
```

Open **http://localhost:3000/** (Vite proxies `/api/*` requests to `http://localhost:8000`).

---

## Demo Accounts & Testing

| Role | Email | Password |
|---|---|---|
| Freelancer | `elena@demo.paypilot` | `DEMO_PASSWORD` from `backend/.env` |
| Client | `client@demo.paypilot` | `DEMO_PASSWORD` from `backend/.env` |

### Testing PayPal Sandbox Checkout
1. Sign in as `client@demo.paypilot`.
2. Open a project with an **Accepted** milestone and click the **PayPal** button.
3. In the PayPal popup, sign in using a **US Sandbox Personal** buyer account from [developer.paypal.com](https://developer.paypal.com) (**Testing Tools → Sandbox Accounts**) with sufficient USD test balance. Do **not** use a real PayPal account.
4. Once captured, the milestone transitions to **Paid via Sandbox**, appears in **Payments** (`/client/payments`), and records an Impact Fund allocation under **Impact** (`/client/impact`).

---

## Verification

```bash
# Frontend TypeScript check & production build
npm run build

# Backend unit tests
backend/.venv/bin/python -m unittest discover -s backend -p "test_*.py" -v
```
