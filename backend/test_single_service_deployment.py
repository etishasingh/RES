"""
PayPilot AI – Single-Service Full-Stack Deployment Verification Test
Tests that FastAPI serves the React frontend, static assets, React Router SPA routes,
API health, docs, and authentication while strictly preserving 404 isolation for API routes.
"""
import os
import sys

# Ensure backend directory is in path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ["SESSION_SECRET"] = "test-session-secret-for-single-service-verification"
os.environ["DEMO_PASSWORD"] = "Password123!"

from starlette.testclient import TestClient
from main import app, FRONTEND_DIST_DIR

client = TestClient(app)


def test_dist_directory_detected():
    print(f"\n[1] Verifying FRONTEND_DIST_DIR detection...")
    print(f"    FRONTEND_DIST_DIR = {FRONTEND_DIST_DIR}")
    assert os.path.isdir(FRONTEND_DIST_DIR), f"Dist directory not found at {FRONTEND_DIST_DIR}"
    index_html = os.path.join(FRONTEND_DIST_DIR, "index.html")
    assert os.path.isfile(index_html), f"index.html not found at {index_html}"
    print("    [PASS] Frontend dist directory and index.html exist and were located.")


def test_root_serves_index_html():
    print("\n[2] Testing GET / serves index.html...")
    resp = client.get("/")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert "text/html" in resp.headers.get("content-type", "")
    assert "<div id=\"root\"></div>" in resp.text or "<html" in resp.text
    print("    [PASS] Root endpoint / serves React frontend index.html with 200 OK.")


def test_api_health_endpoint():
    print("\n[3] Testing GET /api/health...")
    resp = client.get("/api/health")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    assert resp.json() == {"status": "ok"}
    print("    [PASS] /api/health returned {'status': 'ok'} with 200 OK.")


def test_docs_endpoint():
    print("\n[4] Testing GET /docs and /openapi.json...")
    resp_docs = client.get("/docs")
    assert resp_docs.status_code == 200, f"Expected 200, got {resp_docs.status_code}"
    assert "text/html" in resp_docs.headers.get("content-type", "")

    resp_openapi = client.get("/openapi.json")
    assert resp_openapi.status_code == 200, f"Expected 200, got {resp_openapi.status_code}"
    assert "openapi" in resp_openapi.json()
    print("    [PASS] /docs and /openapi.json are accessible and unhindered by frontend routing.")


def test_spa_client_routes():
    print("\n[5] Testing React Router SPA client routes (page refresh fallback)...")
    spa_routes = [
        "/login",
        "/register",
        "/client/dashboard",
        "/freelancer/dashboard",
        "/freelancer/journey",
        "/freelancer/learning",
        "/freelancer/projects",
        "/freelancer/workspace",
        "/projects/test-project-123",
        "/freelancer/invitation/test-invite-456",
    ]
    for route in spa_routes:
        resp = client.get(route)
        assert resp.status_code == 200, f"Route {route} failed with status {resp.status_code}"
        assert "text/html" in resp.headers.get("content-type", "")
        assert "<div id=\"root\"></div>" in resp.text or "<html" in resp.text
        print(f"    [PASS] Route {route} -> 200 OK (index.html served)")


def test_api_404_isolation():
    print("\n[6] Testing API 404 isolation (frontend must NOT intercept API 404s)...")
    resp_get = client.get("/api/nonexistent-endpoint-xyz")
    assert resp_get.status_code == 404, f"Expected 404, got {resp_get.status_code}"
    assert "application/json" in resp_get.headers.get("content-type", "")
    assert resp_get.json().get("detail") == "API endpoint not found"

    resp_post = client.post("/api/another-missing-route", json={"key": "val"})
    assert resp_post.status_code == 404, f"Expected 404, got {resp_post.status_code}"
    assert "application/json" in resp_post.headers.get("content-type", "")
    assert resp_post.json().get("detail") == "API endpoint not found"
    print("    [PASS] Missing API endpoints return clean JSON 404 Not Found for GET and POST (not index.html).")


def test_static_assets_serving():
    print("\n[7] Testing static assets in /assets/...")
    assets_dir = os.path.join(FRONTEND_DIST_DIR, "assets")
    if os.path.isdir(assets_dir):
        files = os.listdir(assets_dir)
        print(f"    Found assets: {files}")
        for f in files:
            resp = client.get(f"/assets/{f}")
            assert resp.status_code == 200, f"Failed to fetch asset /assets/{f}: {resp.status_code}"
            assert len(resp.content) > 0
            print(f"    [PASS] /assets/{f} fetched successfully ({len(resp.content)} bytes).")

    # Verify missing asset returns 404 (not HTML)
    resp_missing = client.get("/assets/missing-asset-xyz.js")
    assert resp_missing.status_code == 404, f"Expected 404 for missing asset, got {resp_missing.status_code}"
    print("    [PASS] Missing asset in /assets/ returns 404 Not Found.")


def test_authentication_and_session():
    print("\n[8] Testing authentication flow on single-service server...")
    import uuid
    unique_email = f"user_{uuid.uuid4().hex[:8]}@test.paypilot"
    password = "TestPassword123!"

    # 1. Test Registration
    reg_resp = client.post("/api/auth/register", json={
        "name": "Single Service Test User",
        "email": unique_email,
        "password": password,
        "role": "client",
        "organization": "Render Single Service Inc."
    })
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.status_code} - {reg_resp.text}"
    reg_data = reg_resp.json()
    assert "token" in reg_data, "Token missing in register response"
    assert reg_data["user"]["email"] == unique_email
    print(f"    [PASS] /api/auth/register succeeded. Token generated.")

    # 2. Test Login
    login_resp = client.post("/api/auth/login", json={
        "email": unique_email,
        "password": password
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.status_code} - {login_resp.text}"
    login_data = login_resp.json()
    assert "token" in login_data, "Token missing in login response"
    token = login_data["token"]
    assert login_data["user"]["email"] == unique_email
    print(f"    [PASS] /api/auth/login succeeded with valid credentials. Received JWT token.")

    # 3. Test /api/auth/me with Bearer token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200, f"/api/auth/me failed: {me_resp.status_code} - {me_resp.text}"
    assert me_resp.json()["user"]["email"] == unique_email
    print(f"    [PASS] /api/auth/me succeeded using Bearer token authentication.")

    # 4. Test /api/auth/logout
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200
    print("    [PASS] /api/auth/logout succeeded.")


if __name__ == "__main__":
    test_dist_directory_detected()
    test_root_serves_index_html()
    test_api_health_endpoint()
    test_docs_endpoint()
    test_spa_client_routes()
    test_api_404_isolation()
    test_static_assets_serving()
    test_authentication_and_session()
    print("\n============================================================")
    print("ALL SINGLE-SERVICE FULL-STACK VERIFICATION TESTS PASSED!")
    print("============================================================\n")
