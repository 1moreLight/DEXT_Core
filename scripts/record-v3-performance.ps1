# Read-only sampling of this product's processes. Does not launch apps or change the desktop.
param(
    [Parameter(Mandatory)][string]$ProductDirectory,
    [Parameter(Mandatory)][string]$Scenario,
    [ValidateRange(1,30)][int]$Seconds = 5,
    [Parameter(Mandatory)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$product = (Resolve-Path -LiteralPath $ProductDirectory).Path.TrimEnd('\') + '\'
if (-not (Test-Path -LiteralPath (Join-Path $product 'Lively.exe') -PathType Leaf)) { throw 'Choose the built Dext product directory.' }
$output = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $output) { throw 'Performance evidence already exists; choose a new name.' }
$clock = [Diagnostics.Stopwatch]::StartNew()
$started = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$previous = @{}
$frames = @()
$seen = [Collections.Generic.HashSet[int]]::new()
$names = @('Lively','Lively.Player.WebView2','Lively.Watchdog','dext-configurator')
for ($sampleIndex = 0; $sampleIndex -le $Seconds; $sampleIndex++) {
    $rows = @()
    foreach ($process in (Get-Process -Name $names -ErrorAction SilentlyContinue)) {
        try {
            if (-not $process.Path.StartsWith($product,[StringComparison]::OrdinalIgnoreCase)) { continue }
            $process.Refresh()
            $currentTime = $clock.Elapsed.TotalSeconds
            $cpuSeconds = $process.TotalProcessorTime.TotalSeconds
            $cpuPercent = $null
            if ($previous.ContainsKey($process.Id)) {
                $old = $previous[$process.Id]
                $elapsed = $currentTime - $old.time
                if ($elapsed -gt 0 -and $cpuSeconds -ge $old.cpu) {
                    $cpuPercent = 100.0 * ($cpuSeconds - $old.cpu) / $elapsed / [Environment]::ProcessorCount
                }
            }
            $previous[$process.Id] = @{time=$currentTime;cpu=$cpuSeconds}
            [void]$seen.Add($process.Id)
            $rows += @{processId=$process.Id;name=$process.ProcessName;workingSetBytes=$process.WorkingSet64;privateBytes=$process.PrivateMemorySize64;cpuMachinePercent=$cpuPercent}
        } catch { continue } # a process may exit between enumeration and sampling
    }
    $gpu = @()
    $gpuAvailable = $true
    $gpuError = $null
    try {
        foreach ($engine in (Get-CimInstance -ClassName Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop)) {
            if ($engine.Name -match '^pid_(\d+)_' -and $seen.Contains([int]$Matches[1])) {
                $gpu += @{processId=[int]$Matches[1];engine=$engine.Name;utilizationPercent=$engine.UtilizationPercentage}
            }
        }
    } catch { $gpuAvailable=$false;$gpuError=$_.Exception.Message }
    $frames += @{elapsedMs=$clock.ElapsedMilliseconds;processes=$rows;gpuCounterAvailable=$gpuAvailable;gpuError=$gpuError;gpuEngines=$gpu}
    if ($sampleIndex -lt $Seconds) { Start-Sleep -Milliseconds 1000 }
}
$ended = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$events = @()
$logs = Join-Path $env:LOCALAPPDATA 'Dext/logs'
if (Test-Path -LiteralPath $logs) {
    $latest = Get-ChildItem -LiteralPath $logs -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if ($latest) {
        foreach ($line in (Get-Content -LiteralPath $latest.FullName -Tail 1000 -ErrorAction SilentlyContinue)) {
            $at = $line.IndexOf('DEXT_PERF ')
            if ($at -lt 0) { continue }
            try {
                $event = $line.Substring($at+10) | ConvertFrom-Json
                if ($event.unixMs -ge $started -and $event.unixMs -le $ended -and $seen.Contains([int]$event.processId)) { $events += $event }
            } catch { continue }
        }
    }
}
$cpu = Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors
$os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,TotalVisibleMemorySize
$record = @{
    formatVersion=1;scenario=$Scenario;startedUnixMs=$started;endedUnixMs=$ended
    machine=@{cpu=$cpu;os=$os;logicalProcessors=[Environment]::ProcessorCount}
    coreFileVersion=(Get-Item -LiteralPath (Join-Path $product 'Lively.exe')).VersionInfo.FileVersion
    frames=$frames;kernelEvents=$events
    notes=@('CPU is a percentage of total logical processor capacity; first observations are null, not zero.',
        'GPU engines are recorded individually, not added into a made-up total.',
        'Kernel arrival timing is not displayed-frame latency. Export configurator diagnostics for spawn/install/apply/maintenance times.',
        'A missing event or unavailable counter remains missing evidence; this report does not assign a pass threshold.')
}
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output)) | Out-Null
$file = [IO.File]::Open($output,[IO.FileMode]::CreateNew)
try {
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($record|ConvertTo-Json -Depth 12))
    $file.Write($bytes,0,$bytes.Length)
    $file.Flush($true)
} finally { $file.Dispose() }
Write-Output "Actual performance evidence saved: $output"