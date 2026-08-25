# Dext 前端实时预览（无需 Lively / 后端）
$root = Split-Path -Parent $PSScriptRoot
Write-Host "Starting renderer live preview at http://localhost:5174 ..."
Write-Host "Edit wallpapers/dext-room/{index.html,style.css,main.js} - browser reloads instantly."
Write-Host "(Launch is stubbed in preview: double-click shows a toast instead of starting apps.)"
Push-Location (Join-Path $root "tauri-ui")
npx vite ../wallpapers/dext-room --open --port 5174
Pop-Location
