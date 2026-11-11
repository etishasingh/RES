# PayPilot AI – Local Full-Stack Launch Script (PowerShell)
# Starts FastAPI backend (port 8000) and Vite frontend (port 3000).

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (Test-Path (Join-Path $ScriptDir "PAYPAL_Handoffs")) {
    $ScriptDir = Join-Path $ScriptDir "PAYPAL_Handoffs"
}
Set-Location $ScriptDir

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "       PAYPILOT AI - FULL-STACK LOCAL DEPLOYMENT           " -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan

# 1. Verify Prerequisites
Write-Host "`n[1/5] Verifying prerequisites..." -ForegroundColor Yellow
$Python = Get-Command python -ErrorAction SilentlyContinue
if (-not $Python) {
    Write-Error "Python executable not found in PATH."
    exit 1
}
Write-Host "  [OK] Python: $($Python.Source)"

$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
    Write-Error "Node.js executable not found in PATH."
    exit 1
}
Write-Host "  [OK] Node.js: $(node -v)"

# 2. Terminate any previous instances on ports 8000 and 3000
Write-Host "`n[2/5] Checking port availability..." -ForegroundColor Yellow
$Ports = @(8000, 3000)
foreach ($Port in $Ports) {
    $Conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Conns) {
        $Pids = $Conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($ProcessId in $Pids) {
            Write-Host "  Terminating existing process on port $Port (PID: $ProcessId)..." -ForegroundColor Yellow
            Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}
Start-Sleep -Seconds 1

# 3. Start Backend
Write-Host "`n[3/5] Starting FastAPI backend on port 8000..." -ForegroundColor Yellow
$BackendDir = Join-Path $ScriptDir "backend"
$BackendLog = Join-Path $BackendDir "backend.log"
$BackendProcess = Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000" `
    -WorkingDirectory $BackendDir `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError (Join-Path $BackendDir "backend_err.log")

$BackendPidFile = Join-Path $ScriptDir ".backend.pid"
$BackendProcess.Id | Out-File -FilePath $BackendPidFile -Encoding ascii
Write-Host "  [OK] Backend started with PID $($BackendProcess.Id)"

# 4. Start Frontend
Write-Host "`n[4/5] Starting React + Vite frontend on port 3000..." -ForegroundColor Yellow
$FrontendLog = Join-Path $ScriptDir "frontend.log"
$FrontendProcess = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c npx vite --host 0.0.0.0 --port 3000" `
    -WorkingDirectory $ScriptDir `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $FrontendLog `
    -RedirectStandardError (Join-Path $ScriptDir "frontend_err.log")

$FrontendPidFile = Join-Path $ScriptDir ".frontend.pid"
$FrontendProcess.Id | Out-File -FilePath $FrontendPidFile -Encoding ascii
Write-Host "  [OK] Frontend started with PID $($FrontendProcess.Id)"

# 5. Health Check Wait Loop
Write-Host "`n[5/5] Waiting for services to become healthy..." -ForegroundColor Yellow
$BackendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $Resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($Resp.StatusCode -eq 200) {
            $BackendReady = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 800
    }
}

if (-not $BackendReady) {
    Write-Error "FastAPI backend failed to respond at http://127.0.0.1:8000/api/health within 25 seconds."
    exit 1
}
Write-Host "  [OK] Backend healthy at http://127.0.0.1:8000/api/health" -ForegroundColor Green

$FrontendReady = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $Resp = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($Resp.StatusCode -eq 200) {
            $FrontendReady = $true
            break
        }
    } catch {
        Start-Sleep -Milliseconds 800
    }
}

if (-not $FrontendReady) {
    Write-Error "Vite frontend failed to respond at http://127.0.0.1:3000 within 25 seconds."
    exit 1
}
Write-Host "  [OK] Frontend healthy at http://localhost:3000" -ForegroundColor Green

Write-Host "`n===========================================================" -ForegroundColor Green
Write-Host "               PAYPILOT AI IS RUNNING                      " -ForegroundColor Green
Write-Host "               http://localhost:3000                       " -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "===========================================================" -ForegroundColor Green
Write-Host "`nDefault Test Accounts:" -ForegroundColor Cyan
Write-Host "  Client Account     : client@demo.paypilot  / Password123!"
Write-Host "  Freelancer Account : elena@demo.paypilot   / Password123!"
Write-Host "`nTo stop the application, run: .\\stop_paypilot.ps1`n"
