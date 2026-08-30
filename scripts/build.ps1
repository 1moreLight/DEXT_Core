# Dext full build: core + players. Run once (or after pulling changes). UI runs via scripts\start.ps1.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$lively = Join-Path $root "lively-core-separation\src\Lively"
$coreOut = Join-Path $lively "Lively\bin\x64\Debug\net9.0-windows10.0.18362.0"
$msbuild = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe

Write-Host "== 1/4 Dext WebView2 Player (Release) =="
$buildOutput = & $msbuild (Join-Path $lively "Lively.Player.WebView2\Lively.Player.WebView2.csproj") /p:Configuration=Release /restore /v:q /nologo 2>&1
$buildExitCode = $LASTEXITCODE
$buildOutput | Select-String " error "
if ($buildExitCode -ne 0) { $buildOutput | Write-Output; throw "Dext WebView2 Player build failed with exit code $buildExitCode." }

Write-Host "== 2/4 Dext Watchdog (Release) =="
$buildOutput = & $msbuild (Join-Path $lively "Lively.Utility.Watchdog\Lively.Utility.Watchdog.csproj") /p:Configuration=Release /restore /v:q /nologo 2>&1
$buildExitCode = $LASTEXITCODE
$buildOutput | Select-String " error "
if ($buildExitCode -ne 0) { $buildOutput | Write-Output; throw "Dext Watchdog build failed with exit code $buildExitCode." }

Write-Host "== 3/4 Dext Core =="
$buildOutput = dotnet build (Join-Path $lively "Lively\Lively.csproj") -c Debug -p:Platform=x64 --nologo -v q 2>&1
$buildExitCode = $LASTEXITCODE
$buildOutput | Select-String " error "
if ($buildExitCode -ne 0) { $buildOutput | Write-Output; throw "Dext Core build failed with exit code $buildExitCode." }

Write-Host "== 4/4 Deploy plugins =="
$wv2Dest = Join-Path $coreOut "plugins\webview2"
New-Item -ItemType Directory -Force $wv2Dest | Out-Null
Copy-Item (Join-Path $lively "Lively.Player.WebView2\bin\Release\*") $wv2Dest -Recurse -Force
$wdDest = Join-Path $coreOut "Plugins\Watchdog"
New-Item -ItemType Directory -Force $wdDest | Out-Null
Copy-Item (Join-Path $lively "Lively.Utility.Watchdog\bin\Release\Lively.Utility.Watchdog.exe") (Join-Path $wdDest "Lively.Watchdog.exe") -Force

Write-Host "`nDone. Run scripts\start.ps1 to launch Dext." -ForegroundColor Green
