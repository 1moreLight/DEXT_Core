# Explicit manual P2b acceptance entry. Does not start Core or change its Room.
param(
    [ValidateSet('overlay','autohide','reserve')][string]$Mode = 'overlay',
    [ValidateRange(48,240)][int]$Height = 128,
    [ValidateRange(30,900)][int]$Seconds = 180
)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskPlayerRoot = Join-Path $taskRoot 'lively-core-separation\src\Lively\Lively\bin\x64\Debug\net9.0-windows10.0.18362.0\plugins\webview2'
$taskPlayer = Join-Path $taskPlayerRoot 'Lively.Player.WebView2.exe'
if (!(Test-Path -LiteralPath $taskPlayer) -or !(Test-Path -LiteralPath (Join-Path $taskPlayerRoot 'DockProbe\index.html'))) {
    throw 'Dock prototype is not built in this worktree. Run scripts/build.ps1, then scripts/start.ps1 before manual acceptance.'
}
$taskOutput = Join-Path ([IO.Path]::GetTempPath()) ('Dext-p2b-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskOutput | Out-Null
$taskArguments = @(
    '--dext-dock-probe',
    '--dock-probe-mode', $Mode,
    '--dock-probe-height', $Height.ToString(),
    '--dock-probe-seconds', $Seconds.ToString(),
    '--dock-probe-output', ('"{0}"' -f $taskOutput)
)
$taskProcess = Start-Process -FilePath $taskPlayer -ArgumentList $taskArguments -WorkingDirectory $taskPlayerRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskOutput 'stdout.log') -RedirectStandardError (Join-Path $taskOutput 'stderr.log')
if ($taskProcess.WaitForExit(500)) {
    $taskError = Get-Content -LiteralPath (Join-Path $taskOutput 'stderr.log') -Raw -ErrorAction SilentlyContinue
    throw "Dock prototype exited with code $($taskProcess.ExitCode). $taskError See $taskOutput"
}
[pscustomobject]@{
    Role = 'Dext P2b Dock prototype'
    PID = $taskProcess.Id
    Mode = $Mode
    HeightDIP = $Height
    AutoExitSeconds = $Seconds
    Player = $taskPlayer
    Events = Join-Path $taskOutput 'events.jsonl'
    Output = $taskOutput
}
Write-Host 'Manual prototype started. Close in the Dock or wait for automatic exit. Windows taskbar stays unchanged.'
