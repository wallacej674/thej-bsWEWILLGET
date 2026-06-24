param(
    [switch]$Install
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Command
}

function Receive-ServerOutput {
    param(
        [System.Management.Automation.Job]$Job,
        [string]$Prefix
    )

    Receive-Job -Job $Job -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "[$Prefix] $_"
    }

    $Job.ChildJobs | ForEach-Object {
        $_.Error.ReadAll() | ForEach-Object {
            Write-Host "[$Prefix] $_"
        }
    }
}

Invoke-Step "Starting PostgreSQL" {
    Set-Location $Root
    docker compose up -d db
}

Invoke-Step "Preparing backend" {
    Set-Location $BackendDir
    if ($Install) {
        uv sync --locked
    }
    uv run alembic upgrade head
}

Invoke-Step "Preparing frontend" {
    Set-Location $FrontendDir
    if ($Install) {
        npm ci
    }
}

Write-Host ""
Write-Host "==> Starting development servers" -ForegroundColor Cyan

$BackendJob = Start-Job -Name "ApplyTogetherBackend" -ArgumentList $BackendDir -ScriptBlock {
    param($Path)
    Set-Location $Path
    uv run uvicorn app.main:app --reload 2>&1
}

$FrontendJob = Start-Job -Name "ApplyTogetherFrontend" -ArgumentList $FrontendDir -ScriptBlock {
    param($Path)
    Set-Location $Path
    npm.cmd run dev 2>&1
}

Write-Host ""
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "API docs: http://127.0.0.1:8000/docs"
Write-Host "Frontend: http://localhost:5173"
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor Yellow

try {
    while ($true) {
        Receive-ServerOutput -Job $BackendJob -Prefix "backend"
        Receive-ServerOutput -Job $FrontendJob -Prefix "frontend"

        $Stopped = @($BackendJob, $FrontendJob) | Where-Object {
            $_.State -in @("Failed", "Stopped", "Completed")
        }

        if ($Stopped.Count -gt 0) {
            $Stopped | ForEach-Object {
                Receive-ServerOutput -Job $_ -Prefix $_.Name
                Write-Host "$($_.Name) exited with state $($_.State)." -ForegroundColor Red
            }
            throw "A development server stopped unexpectedly."
        }

        Start-Sleep -Seconds 2
    }
}
finally {
    Write-Host ""
    Write-Host "Stopping development servers..." -ForegroundColor Yellow
    @($BackendJob, $FrontendJob) | Stop-Job -ErrorAction SilentlyContinue
    @($BackendJob, $FrontendJob) | Remove-Job -Force -ErrorAction SilentlyContinue
    Set-Location $Root
}
