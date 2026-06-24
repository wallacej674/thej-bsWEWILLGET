$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "ApplyTogether now uses two VS Code terminals for live logs:" -ForegroundColor Cyan
Write-Host ""
Write-Host "Terminal 1:"
Write-Host "  .\dev-backend.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 2:"
Write-Host "  .\dev-frontend.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "This keeps backend and frontend logs visible in VS Code without opening extra windows."
Write-Host ""
