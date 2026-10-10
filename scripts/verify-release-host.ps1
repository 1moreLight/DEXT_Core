param([string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$assets = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'v3-release-assets.json') -Raw | ConvertFrom-Json
$hostPath = Join-Path $RepositoryRoot $assets.hostDirectory
foreach ($asset in $assets.hostAssets) {
    if (-not (Test-Path -LiteralPath (Join-Path $hostPath $asset) -PathType Leaf)) { throw "Host asset missing: $asset" }
}
$html = Get-Content -LiteralPath (Join-Path $hostPath 'index.html') -Raw
foreach ($match in [regex]::Matches($html, '(?:src|href)\s*=\s*["'']([^"'']+)["'']')) {
    $reference = $match.Groups[1].Value
    if ($reference -notin $assets.hostAssets) { throw "Host reference missing from release assets: $reference" }
}
Write-Output 'Official host HTML references are included in release assets.'
