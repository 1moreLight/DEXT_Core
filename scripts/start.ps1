# Dext daily start: core (wallpaper auto-restores) + configurator dev mode.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$coreExe = Join-Path $root "lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\Lively.exe"

if (-not (Test-Path $coreExe)) { throw "core not built. Run scripts\build.ps1 first." }

# idempotent plugin deploy (avoids stale player after rebuilds)
$lively = Join-Path $root "lively-core-separation\src\Lively"
$coreOut = Split-Path -Parent $coreExe
$playerSrc = Join-Path $lively "Lively.Player.WebView2\bin\Release\Lively.Player.WebView2.exe"
$playerDst = Join-Path $coreOut "plugins\webview2\Lively.Player.WebView2.exe"
$needDeploy = (Test-Path $playerSrc) -and (-not (Test-Path $playerDst) -or ((Get-Item $playerSrc).LastWriteTime -gt (Get-Item $playerDst).LastWriteTime))
if ($needDeploy) {
    Write-Host "Deploying webview2 player..."
    New-Item -ItemType Directory -Force (Split-Path -Parent $playerDst) | Out-Null
    Copy-Item "$(Split-Path -Parent $playerSrc)\*" (Split-Path -Parent $playerDst) -Recurse -Force
}

if (-not (Get-Process Lively -ErrorAction SilentlyContinue)) {
    Write-Host "Starting core..."
    Start-Process $coreExe
    Start-Sleep 5
} else {
    Write-Host "Core already running."
}

Write-Host "Starting configurator (npm run tauri dev)..."
Push-Location (Join-Path $root "tauri-ui")
npm run tauri dev
Pop-Location
