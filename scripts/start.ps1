# Dext daily start: exact-path Core validation + configurator dev mode.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$identity = Get-Content -Raw -Encoding UTF8 (Join-Path $root "dext-runtime-identity.json") | ConvertFrom-Json
$coreExe = Join-Path $root "lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\Lively.exe"
$dextData = Join-Path $env:LOCALAPPDATA $identity.localAppDataDirectory
$dextLogs = Join-Path $dextData "logs"
$grpcPipeName = "$($identity.grpcPipePrefix)$($identity.runtimeIdentity)$env:USERNAME"

function Get-NormalizedPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    return [IO.Path]::GetFullPath($Path).TrimEnd('\').ToLowerInvariant()
}

function Get-LivelyProcesses {
    return @(Get-CimInstance Win32_Process -Filter "Name='Lively.exe'" -ErrorAction SilentlyContinue)
}

function Test-DextMutex {
    try {
        $handle = [Threading.Mutex]::OpenExisting($identity.runtimeIdentity)
        $handle.Dispose()
        return $true
    } catch [Threading.WaitHandleCannotBeOpenedException] {
        return $false
    }
}

function Test-DextPipe {
    return [bool](Get-ChildItem -LiteralPath '\\.\pipe\' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq $grpcPipeName } |
        Select-Object -First 1)
}

if (-not (Test-Path -LiteralPath $coreExe)) {
    throw "Dext Core is not built at $coreExe. Run scripts\build.ps1 first."
}

$targetCorePath = Get-NormalizedPath $coreExe
$lively = Join-Path $root "lively-core-separation\src\Lively"
$coreOut = Split-Path -Parent $coreExe
$playerSrc = Join-Path $lively "Lively.Player.WebView2\bin\Release\Lively.Player.WebView2.exe"
$playerDst = Join-Path $coreOut "plugins\webview2\Lively.Player.WebView2.exe"
$needDeploy = (Test-Path -LiteralPath $playerSrc) -and
    (-not (Test-Path -LiteralPath $playerDst) -or ((Get-Item $playerSrc).LastWriteTime -gt (Get-Item $playerDst).LastWriteTime))
if ($needDeploy) {
    Write-Host "Deploying Dext WebView2 Player..."
    New-Item -ItemType Directory -Force (Split-Path -Parent $playerDst) | Out-Null
    Copy-Item "$(Split-Path -Parent $playerSrc)\*" (Split-Path -Parent $playerDst) -Recurse -Force
}

$allCoreProcesses = Get-LivelyProcesses
$targetProcesses = @($allCoreProcesses | Where-Object { (Get-NormalizedPath $_.ExecutablePath) -eq $targetCorePath })
$otherProcesses = @($allCoreProcesses | Where-Object { (Get-NormalizedPath $_.ExecutablePath) -ne $targetCorePath })
foreach ($process in $otherProcesses) {
    Write-Host "Ignoring non-target Lively.exe PID $($process.ProcessId): $($process.ExecutablePath)" -ForegroundColor DarkYellow
}

if ($targetProcesses.Count -eq 0) {
    if ((Test-DextMutex) -or (Test-DextPipe)) {
        throw "Dext runtime identity already exists, but its Core path is not the current worktree: mutex=$($identity.runtimeIdentity), pipe=$grpcPipeName"
    }
    Write-Host "Starting Dext Core from $coreExe ..."
    $started = Start-Process -FilePath $coreExe -WorkingDirectory $coreOut -WindowStyle Hidden -PassThru
    $targetPid = $started.Id
} else {
    $targetPid = $targetProcesses[0].ProcessId
    Write-Host "Dext Core already running from the current worktree (PID $targetPid)."
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $target = Get-CimInstance Win32_Process -Filter "ProcessId=$targetPid" -ErrorAction SilentlyContinue
    $pathMatches = $target -and ((Get-NormalizedPath $target.ExecutablePath) -eq $targetCorePath)
    if ($pathMatches -and (Test-DextMutex) -and (Test-DextPipe) -and (Test-Path -LiteralPath $dextLogs)) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    throw "Dext Core failed identity validation: PID=$targetPid path=$coreExe mutex=$($identity.runtimeIdentity) pipe=$grpcPipeName logs=$dextLogs"
}

Write-Host "Dext Core verified: PID $targetPid"
Write-Host "  Core: $coreExe"
Write-Host "  Pipe: $grpcPipeName"
Write-Host "  Data: $dextData"
Write-Host "  Logs: $dextLogs"
Write-Host "Starting Dext Configurator (npm run tauri dev)..."
Push-Location (Join-Path $root "tauri-ui")
try {
    npm run tauri dev
} finally {
    Pop-Location
}
