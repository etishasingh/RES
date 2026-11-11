# PayPilot AI – Clean Process Shutdown Script (PowerShell)
# Stops processes on port 8000 (Backend) and port 3000 (Frontend) cleanly.

$ErrorActionPreference = "SilentlyContinue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (Test-Path (Join-Path $ScriptDir "PAYPAL_Handoffs")) {
    $ScriptDir = Join-Path $ScriptDir "PAYPAL_Handoffs"
}

Write-Host "Stopping PayPilot AI background services..." -ForegroundColor Yellow

# Read PID files if they exist
$PidFiles = @(Join-Path $ScriptDir ".backend.pid", Join-Path $ScriptDir ".frontend.pid")
foreach ($File in $PidFiles) {
    if (Test-Path $File) {
        $ProcId = Get-Content $File -ErrorAction SilentlyContinue
        if ($ProcId) {
            Stop-Process -Id ([int]$ProcId) -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $File -Force -ErrorAction SilentlyContinue
    }
}

# Ensure ports 8000 and 3000 are freed
$Ports = @(8000, 3000)
foreach ($Port in $Ports) {
    $Conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($Conns) {
        $Pids = $Conns | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($ProcessId in $Pids) {
            Write-Host "Freeing port $Port (stopping PID $ProcessId)..." -ForegroundColor Yellow
            Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

Start-Sleep -Seconds 1
Write-Host "PayPilot AI services stopped cleanly." -ForegroundColor Green
