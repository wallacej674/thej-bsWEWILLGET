$ErrorActionPreference = "Stop"

$Ports = @(8000, 5173)
$StillBusy = @()

function Test-PortAvailable {
    param([int]$Port)

    $Listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        $Port
    )
    try {
        $Listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        $Listener.Stop()
    }
}

Write-Host ""
Write-Host "Stopping ApplyTogether dev servers..." -ForegroundColor Cyan

foreach ($Port in $Ports) {
    if (Test-PortAvailable -Port $Port) {
        Write-Host "Port $Port is clear."
        continue
    }

    $Listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)

    if (-not $Listeners) {
        Write-Host "Port $Port is busy, but Windows did not report an owning listener." -ForegroundColor Yellow
        continue
    }

    foreach ($Listener in ($Listeners | Sort-Object -Property OwningProcess -Unique)) {
        $Process = Get-Process -Id $Listener.OwningProcess -ErrorAction SilentlyContinue
        if (-not $Process) {
            Write-Host "PID $($Listener.OwningProcess) on port $Port already exited."
            continue
        }

        Write-Host "Stopping PID $($Listener.OwningProcess) ($($Process.ProcessName)) on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $Listener.OwningProcess -Force -ErrorAction Stop
    }

    Start-Sleep -Milliseconds 500
    if (Test-PortAvailable -Port $Port) {
        Write-Host "Port $Port is clear."
    }
    else {
        Write-Host "Port $Port is still busy. Wait a moment and rerun .\stop-dev.ps1." -ForegroundColor Yellow
        $StillBusy += $Port
    }
}

Write-Host ""
if ($StillBusy.Count -gt 0) {
    Write-Host "Some dev ports are still busy: $($StillBusy -join ', ')." -ForegroundColor Red
    Write-Host "If the listed PIDs already exited, run the stronger cleanup command from the chat or restart Windows." -ForegroundColor Yellow
    exit 1
}

Write-Host "Dev server ports are clear." -ForegroundColor Green
