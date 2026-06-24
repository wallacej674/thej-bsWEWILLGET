$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$BackendPort = 8000

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Command
}

function Test-PortAvailable {
    param([int]$Port)

    $Probe = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )
    try {
        $Probe.Start()
        return
    }
    catch {
        $Listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    }
    finally {
        $Probe.Stop()
    }

    Start-Sleep -Milliseconds 500
    $RetryProbe = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )
    try {
        $RetryProbe.Start()
        return
    }
    catch {
    }
    finally {
        $RetryProbe.Stop()
    }

    Write-Host ""
    Write-Host "Port $Port is already in use." -ForegroundColor Red
    Write-Host "That usually means an old backend server is still running." -ForegroundColor Yellow
    Write-Host ""
    $Listeners | ForEach-Object {
        $Process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        $ProcessName = if ($Process) { $Process.ProcessName } else { "unknown" }
        Write-Host "PID $($_.OwningProcess) ($ProcessName) is listening on port $Port."
    }
    Write-Host ""
    Write-Host "Run .\stop-dev.ps1, then run .\dev-backend.ps1 again." -ForegroundColor Yellow
    throw "Port $Port is already in use."
}

try {
    Invoke-Step "Starting PostgreSQL" {
        Set-Location $Root
        docker compose up -d db
    }

    Invoke-Step "Checking backend port" {
        Test-PortAvailable -Port $BackendPort
    }

    Invoke-Step "Preparing backend" {
        Set-Location $BackendDir
        uv sync --locked
        uv run alembic upgrade head
    }

    Invoke-Step "Starting backend" {
        Set-Location $BackendDir
        uv run uvicorn app.main:app --reload --port $BackendPort
    }
}
finally {
    Set-Location $Root
}
