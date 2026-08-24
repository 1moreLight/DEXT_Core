# Dext full build: core + players. Run once (or after pulling changes). UI runs via scripts\start.ps1.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$lively = Join-Path $root "lively-core-separation\src\Lively"
$coreOut = Join-Path $lively "Lively\bin\x64\Debug\net9.0-windows10.0.18362.0"
$msbuild = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe

Write-Host "== 1/4 WebView2 player (Release) =="
& $msbuild (Join-Path $lively "Lively.Player.WebView2\Lively.Player.WebView2.csproj") /p:Configuration=Release /restore /v:q /nologo | Select-String " error "

Write-Host "== 2/4 Watchdog (Release) =="
& $msbuild (Join-Path $lively "Lively.Utility.Watchdog\Lively.Utility.Watchdog.csproj") /p:Configuration=Release /restore /v:q /nologo | Select-String " error "

Write-Host "== 3/4 Lively core =="
dotnet build (Join-Path $lively "Lively\Lively.csproj") -c Debug -p:Platform=x64 --nologo -v q | Select-String " error "

Write-Host "== 4/4 Deploy plugins =="
$wv2Dest = Join-Path $coreOut "plugins\webview2"
New-Item -ItemType Directory -Force $wv2Dest | Out-Null
Copy-Item (Join-Path $lively "Lively.Player.WebView2\bin\Release\*") $wv2Dest -Recurse -Force
$wdDest = Join-Path $coreOut "Plugins\Watchdog"
New-Item -ItemType Directory -Force $wdDest | Out-Null
Copy-Item (Join-Path $lively "Lively.Utility.Watchdog\bin\Release\Lively.Utility.Watchdog.exe") (Join-Path $wdDest "Lively.Watchdog.exe") -Force

Write-Host "`nDone. Run scripts\start.ps1 to launch Dext." -ForegroundColor Green
