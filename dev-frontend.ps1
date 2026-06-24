$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $Root "frontend"
$env:VITE_API_BASE_URL = "http://localhost:8000"

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Command
}

Invoke-Step "Preparing frontend" {
    Set-Location $FrontendDir
    npm ci
}

Invoke-Step "Starting frontend" {
    Set-Location $FrontendDir
    npm.cmd run dev
}
