# PayPilot AI

Full-stack freelance milestone collaboration platform with ProofFlow ML evaluation, **PayPal Sandbox** milestone payments, **PayPilot Impact**, and **PayPilot Spotlight**.

## Prerequisites

- **Node.js** 18+ & npm
- **Python** 3.11+
- A free **PayPal Developer** account ([developer.paypal.com](https://developer.paypal.com)) for Sandbox checkout

---

## Setup Instructions

### 1. Backend Setup (Port `8000`)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # Windows: copy .env.example .env
```

### 2. Add Your Own PayPal Sandbox Credentials (`backend/.env`)

Open `backend/.env` and fill in:
- `SESSION_SECRET`: random hex string (`python -c "import secrets; print(secrets.token_hex(48))"`)
- `DEMO_PASSWORD`: password for seeded demo accounts
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET`:
  1. Go to [developer.paypal.com](https://developer.paypal.com) → **Dashboard → Apps & Credentials**.
  2. Switch to the **Sandbox** tab and click **Create App**.
  3. Select **Merchant** and pick a **US Sandbox Business** account *(recommended for `USD` payments)*.
  4. Paste your generated **Client ID** and **Secret** into `backend/.env` (keep `PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com`).

### 3. Seed & Start Backend

```bash
# Inside backend/ with venv activated
python seed.py
uvicorn main:app --reload --port 8000
```

### 4. Frontend Setup (Port `3000`)

In a second terminal from the project root:

```bash
npm install
npm run dev
```

Open **http://localhost:3000/** (Vite proxies `/api/*` to `http://localhost:8000`).

---

## Testing PayPal Sandbox Checkout

1. Sign in as `client@demo.paypilot` (password = `DEMO_PASSWORD` in `backend/.env`).
2. Open any project with an **Accepted** milestone and click the **PayPal** checkout button.
3. In the PayPal Sandbox popup, log in with a **US Sandbox Personal** buyer account from [developer.paypal.com](https://developer.paypal.com) (**Testing Tools → Sandbox Accounts**). Do **not** use a real PayPal account.
4. Once approved, the milestone updates to **Paid via Sandbox**, appears in **Payments** (`/client/payments`), and allocates a platform fee share to **PayPilot Impact** (`/client/impact`).

## Verification

```bash
npm run build
backend/.venv/bin/python -m unittest discover -s backend -p "test_*.py" -v
```

