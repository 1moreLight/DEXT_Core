# Read-only report for the active Dext runtime identity and executable paths.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$identity = Get-Content -Raw -Encoding UTF8 (Join-Path $root "dext-runtime-identity.json") | ConvertFrom-Json
$coreExe = Join-Path $root "lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\Lively.exe"
$coreOut = Split-Path -Parent $coreExe
$dextData = Join-Path $env:LOCALAPPDATA $identity.localAppDataDirectory
$dextLogs = Join-Path $dextData "logs"
$grpcPipeName = "$($identity.grpcPipePrefix)$($identity.runtimeIdentity)$env:USERNAME"

function Get-NormalizedPath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    return [IO.Path]::GetFullPath($Path).TrimEnd('\').ToLowerInvariant()
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

function Show-ProcessGroup([string]$Label, [string[]]$Names, [string]$ExpectedRoot) {
    $expected = Get-NormalizedPath $ExpectedRoot
    $items = @(foreach ($name in $Names) {
        Get-CimInstance Win32_Process -Filter "Name='$name'" -ErrorAction SilentlyContinue
    })
    if ($items.Count -eq 0) {
        Write-Host "[MISSING] $Label"
        return $false
    }
    $foundExpected = $false
    foreach ($item in $items) {
        $actual = Get-NormalizedPath $item.ExecutablePath
        $belongs = $actual -and ($actual -eq $expected -or $actual.StartsWith($expected + '\'))
        $tag = if ($belongs) { "OK" } else { "OTHER" }
        Write-Host "[$tag] $Label PID $($item.ProcessId): $($item.ExecutablePath)"
        if ($item.CommandLine) { Write-Host "      $($item.CommandLine)" }
        if ($belongs) { $foundExpected = $true }
    }
    return $foundExpected
}

Write-Host "Dext runtime identity report"
Write-Host "  Product: $($identity.productName)"
Write-Host "  Runtime: $($identity.runtimeIdentity)"
Write-Host "  Pipe:    $grpcPipeName"
Write-Host "  Data:    $dextData"
Write-Host "  Logs:    $dextLogs"

$coreBinaryOk = $false
if (Test-Path -LiteralPath $coreExe) {
    $coreVersion = (Get-Item -LiteralPath $coreExe).VersionInfo
    $coreBinaryOk = [string]::Equals($coreVersion.ProductName, $identity.productName, [StringComparison]::OrdinalIgnoreCase) -and
        (-not [string]::IsNullOrWhiteSpace($coreVersion.FileDescription)) -and
        $coreVersion.FileDescription.StartsWith($identity.productName, [StringComparison]::OrdinalIgnoreCase)
    Write-Host "[$(if ($coreBinaryOk) { 'OK' } else { 'OTHER' })] Core binary ProductName='$($coreVersion.ProductName)', FileDescription='$($coreVersion.FileDescription)'"
} else {
    Write-Host "[MISSING] Core binary $coreExe"
}

$coreOk = (Show-ProcessGroup "Core" @("Lively.exe") $coreExe) -and $coreBinaryOk
$watchdogOk = Show-ProcessGroup "Watchdog" @("Lively.Watchdog.exe", "Lively.Utility.Watchdog.exe") $coreOut
$playerOk = Show-ProcessGroup "Player" @("Lively.Player.WebView2.exe") $coreOut
$configuratorExe = Join-Path $root "tauri-ui\src-tauri\target\debug\dext-configurator.exe"
$configuratorOk = Show-ProcessGroup "Configurator" @("dext-configurator.exe") $configuratorExe

$mutexOk = Test-DextMutex
$pipeOk = Test-DextPipe
$dataOk = Test-Path -LiteralPath $dextData
$logsOk = Test-Path -LiteralPath $dextLogs
Write-Host "[$(if ($mutexOk) { 'OK' } else { 'MISSING' })] Mutex $($identity.runtimeIdentity)"
Write-Host "[$(if ($pipeOk) { 'OK' } else { 'MISSING' })] Pipe $grpcPipeName"
Write-Host "[$(if ($dataOk) { 'OK' } else { 'MISSING' })] Data $dextData"
Write-Host "[$(if ($logsOk) { 'OK' } else { 'MISSING' })] Logs $dextLogs"

if ($logsOk) {
    $latestLog = Get-ChildItem -LiteralPath $dextLogs -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestLog) {
        Write-Host "[INFO] Latest log: $($latestLog.FullName)"
        Get-Content -LiteralPath $latestLog.FullName -TotalCount 1
    }
}

if (-not ($coreOk -and $watchdogOk -and $playerOk -and $configuratorOk -and $mutexOk -and $pipeOk -and $dataOk -and $logsOk)) {
    exit 1
}
