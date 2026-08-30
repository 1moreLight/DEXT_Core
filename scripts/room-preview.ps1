# Dext 前端实时预览（无需 Lively / 后端）
# 用法: scripts/room-preview.ps1 [-Room test-dock-hud]
# root = 仓库根，这样 /rooms/<Room>/ 能被渲染器 fetch 到（vite root 限定在
# wallpapers/dext-room 时，rooms 路径会走 SPA fallback 返回 HTML，room.json 加载失败）
param([string]$Room)

$root = Split-Path -Parent $PSScriptRoot
$path = "/wallpapers/dext-room/"
if ($Room) { $path = "$path`?room=../../rooms/$Room/" }
Write-Host "Starting Dext renderer live preview at http://localhost:5174$path ..."
Write-Host "Edit wallpapers/dext-room/{index.html,style.css,main.js} - browser reloads instantly."
Write-Host "(Launch is stubbed in preview: double-click shows a toast instead of starting apps.)"
Push-Location $root
npx vite . --open $path --port 5174
Pop-Location
