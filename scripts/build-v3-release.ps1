# Creates a fresh portable v3 candidate; never launches apps or deletes an old package.
param([string]$OutputDirectory, [string]$CargoTargetDirectory)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $root ("artifacts/v3-release-" + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Choose a new empty release path; existing packages are preserved.' }
$assets = Get-Content -LiteralPath (Join-Path $root 'v3-release-assets.json') -Raw | ConvertFrom-Json
foreach ($asset in $assets.hostAssets) {
    if (-not (Test-Path -LiteralPath (Join-Path $root "$($assets.hostDirectory)/$asset") -PathType Leaf)) { throw "Native asset missing: $asset" }
}
& (Join-Path $PSScriptRoot 'verify-release-rooms.ps1') -RepositoryRoot $root
[IO.Directory]::CreateDirectory($output) | Out-Null
# Core is self-contained .NET 9; Player/Watchdog are Release. No legacy plugin or Bundle content is published.
& (Join-Path $PSScriptRoot 'build.ps1') -V3Release -PublishDirectory $output
$oldTarget = $env:CARGO_TARGET_DIR
if (-not $CargoTargetDirectory) {
    if ($oldTarget) { $CargoTargetDirectory = $oldTarget }
    else {
        $common = & git -C $root rev-parse --path-format=absolute --git-common-dir
        if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve shared Rust cache root.' }
        $CargoTargetDirectory = Join-Path (Split-Path -Parent $common) '.build/tauri-target'
    }
}
$releaseTarget = [IO.Path]::GetFullPath($CargoTargetDirectory)
try {
    $env:CARGO_TARGET_DIR = $releaseTarget
    Push-Location (Join-Path $root 'tauri-ui')
    try {
        & npm run tauri -- build --no-bundle --features v3-release
        if ($LASTEXITCODE -ne 0) { throw 'v3 configurator Release build failed.' }
    } finally { Pop-Location }
    Copy-Item -LiteralPath (Join-Path $releaseTarget 'release/dext-configurator.exe') -Destination $output
} finally { $env:CARGO_TARGET_DIR = $oldTarget }
$hostPath = Join-Path $output $assets.hostDirectory
[IO.Directory]::CreateDirectory($hostPath) | Out-Null
foreach ($asset in $assets.hostAssets) { Copy-Item -LiteralPath (Join-Path $root "$($assets.hostDirectory)/$asset") -Destination $hostPath }
foreach ($relative in @('lively-core-separation/LICENSE','lively-core-separation/README.md','tauri-ui/README.md','dext-runtime-identity.json','room-v3-compatibility.json','v3-release-assets.json')) {
    $destination = Join-Path $output $relative
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
    Copy-Item -LiteralPath (Join-Path $root $relative) -Destination $destination
}
$forbidden = @('wallpapers/dext-room','Plugins/mpv','Plugins/vlc','Plugins/cef','Plugins/wmf','Bundle','Assets/Plugins/Mpv')
foreach ($relative in $forbidden) { if (Test-Path -LiteralPath (Join-Path $output $relative)) { throw "Unexpected legacy release asset: $relative" } }
$identity = (Get-Item -LiteralPath (Join-Path $output 'Lively.exe')).VersionInfo
if ($identity.ProductName -ne 'Dext' -or -not $identity.FileDescription.StartsWith('Dext v3')) { throw 'Core is not the v3 release profile.' }
foreach ($required in @('dext-configurator.exe','plugins/webview2/Lively.Player.WebView2.exe','Plugins/Watchdog/Lively.Watchdog.exe')) {
    if (-not (Test-Path -LiteralPath (Join-Path $output $required) -PathType Leaf)) { throw "Product executable missing: $required" }
}
[IO.Directory]::CreateDirectory((Join-Path $output "scripts")) | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "start.ps1") -Destination (Join-Path $output "scripts/start.ps1")
Copy-Item -LiteralPath (Join-Path $PSScriptRoot "start-v3-release.cmd") -Destination (Join-Path $output "start-dext.cmd")
$inventory = @(Get-ChildItem -LiteralPath $output -Recurse -File | ForEach-Object {
    @{path=$_.FullName.Substring($output.Length+1).Replace('\','/');size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}
})
$record = @{formatVersion=1;profile='v3-release';status='candidate-awaiting-runtime-acceptance';files=$inventory}
[IO.File]::WriteAllText((Join-Path $output 'release-inventory.json'),($record|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
Write-Output "v3 Release candidate saved: $output"
Write-Output 'No application was launched. Required real runtime/compatibility/performance acceptance remains pending.'