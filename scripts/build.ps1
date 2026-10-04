# Dext full build: core + players. Run once (or after pulling changes). UI runs via scripts\start.ps1.
param([switch]$Rebuild, [switch]$V3Release, [string]$PublishDirectory)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$lively = Join-Path $root "lively-core-separation\src\Lively"
$configuration = if ($V3Release) { "Release" } else { "Debug" }
$coreOut = Join-Path $lively "Lively\bin\x64\$configuration\net9.0-windows10.0.18362.0"
if ($PublishDirectory) {
    if (-not $V3Release) { throw "PublishDirectory requires V3Release." }
    $coreOut = [IO.Path]::GetFullPath($PublishDirectory)
}
$msbuild = & "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.Component.MSBuild -find MSBuild\**\Bin\MSBuild.exe
$msbuildTargetArgs = @()
$dotnetTargetArgs = @()
if ($Rebuild) {
    $msbuildTargetArgs += "/t:Rebuild"
    $dotnetTargetArgs += "-t:Rebuild"
}

if ($Rebuild) {
    Write-Host "Forced rebuild enabled (stale/non-Dext output detected)." -ForegroundColor Yellow
}

Write-Host "== 1/4 Dext WebView2 Player (Release) =="
$buildOutput = & $msbuild (Join-Path $lively "Lively.Player.WebView2\Lively.Player.WebView2.csproj") @msbuildTargetArgs /p:Configuration=Release /restore /v:q /nologo 2>&1
$buildExitCode = $LASTEXITCODE
$buildOutput | Select-String " error "
if ($buildExitCode -ne 0) { $buildOutput | Write-Output; throw "Dext WebView2 Player build failed with exit code $buildExitCode." }

Write-Host "== 2/4 Dext Watchdog (Release) =="
$buildOutput = & $msbuild (Join-Path $lively "Lively.Utility.Watchdog\Lively.Utility.Watchdog.csproj") @msbuildTargetArgs /p:Configuration=Release /restore /v:q /nologo 2>&1
$buildExitCode = $LASTEXITCODE
$buildOutput | Select-String " error "
if ($buildExitCode -ne 0) { $buildOutput | Write-Output; throw "Dext Watchdog build failed with exit code $buildExitCode." }

Write-Host "== 3/4 Dext Core =="
$coreBuildArgs = @("-c", $configuration, "-p:Platform=x64", "--nologo", "-v", "q") + $dotnetTargetArgs
if ($V3Release) { $coreBuildArgs += "-p:DextV3Release=true" }
if ($PublishDirectory) {
    $buildOutput = & dotnet publish (Join-Path $lively "Lively\Lively.csproj") @coreBuildArgs -r win-x64 --self-contained true -o $coreOut 2>&1
} else {
    $buildOutput = & dotnet build (Join-Path $lively "Lively\Lively.csproj") @coreBuildArgs 2>&1
}
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
