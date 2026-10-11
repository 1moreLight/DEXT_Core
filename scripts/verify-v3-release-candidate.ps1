# Read-only provenance check. This does not prove runtime acceptance.
param(
    [Parameter(Mandatory=$true)][string]$CandidateDirectory,
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot)
)
$ErrorActionPreference = 'Stop'
$candidate = (Resolve-Path -LiteralPath $CandidateDirectory).Path
$prefix = $candidate.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
$inventory = Get-Content -LiteralPath (Join-Path $candidate 'release-inventory.json') -Raw | ConvertFrom-Json
if ($inventory.formatVersion -ne 1 -or $inventory.profile -ne 'v3-release' -or @($inventory.files).Count -eq 0) {
    throw 'Missing or unsupported v3 release inventory.'
}
$listed = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($file in $inventory.files) {
    $path = [IO.Path]::GetFullPath((Join-Path $candidate $file.path))
    if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or -not $listed.Add($path)) {
        throw "Invalid or duplicate inventory path: $($file.path)"
    }
    $actual = Get-Item -LiteralPath $path
    if ($actual.PSIsContainer -or $actual.Length -ne $file.size -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256) {
        throw "Inventory mismatch: $($file.path)"
    }
}
foreach ($file in Get-ChildItem -LiteralPath $candidate -Recurse -File) {
    if ($file.FullName -ne (Join-Path $candidate 'release-inventory.json') -and -not $listed.Contains($file.FullName)) {
        throw "Unlisted candidate file: $($file.FullName)"
    }
}
$assets = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'v3-release-assets.json') -Raw | ConvertFrom-Json
foreach ($asset in $assets.hostAssets) {
    $relative = "$($assets.hostDirectory)/$asset"
    $source = Join-Path $RepositoryRoot $relative
    $published = Join-Path $candidate $relative
    if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $published).Hash) {
        throw "Host differs from source: $asset"
    }
}
& (Join-Path $PSScriptRoot 'verify-release-host.ps1') -RepositoryRoot $candidate
$markers = 'DEXT_FUSION_PROBE|__fusionNavigation|49c12d19-9221-4ed5-ae13-4fdabc0bfa01|Storage grant acceptance fixture'
$matches = Get-ChildItem -LiteralPath (Join-Path $candidate 'wallpapers') -Recurse -File |
    Where-Object Extension -In '.html','.js','.json','.css' |
    Select-String -Pattern $markers -List
if ($matches) { throw "Test diagnostics found: $($matches.Path -join ', ')" }
Write-Output "PASS v3 candidate: $($inventory.files.Count) inventory files; $($assets.hostAssets.Count) host assets match source; no known probe markers."
Write-Output 'Runtime behavior and manual acceptance remain separate requirements.'
