param([string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$assets = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'v3-release-assets.json') -Raw | ConvertFrom-Json
$hostPath = Join-Path $RepositoryRoot $assets.hostDirectory
foreach ($asset in $assets.hostAssets) {
    if (-not (Test-Path -LiteralPath (Join-Path $hostPath $asset) -PathType Leaf)) { throw "Host asset missing: $asset" }
}
$serverSource = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'lively-core-separation/src/Lively/Lively.Common/Helpers/DextNativeResourceServer.cs') -Raw
$officialBlock = [regex]::Match($serverSource, '(?s)OfficialFiles\s*=.*?\{(.*?)\};').Groups[1].Value
$officialFiles = @([regex]::Matches($officialBlock, '"([^"\r\n]+)"') | ForEach-Object { $_.Groups[1].Value })
if (-not $officialFiles.Count) { throw 'Cannot read official resource server manifest.' }
$html = Get-Content -LiteralPath (Join-Path $hostPath 'index.html') -Raw
foreach ($match in [regex]::Matches($html, '(?:src|href)\s*=\s*["'']([^"'']+)["'']')) {
    $reference = $match.Groups[1].Value
    if ($reference -notin $officialFiles) { throw "Host reference cannot be served by Player: $reference" }
    if ($reference -notin $assets.hostAssets) { throw "Host reference missing from release assets: $reference" }
}
Write-Output 'Official host HTML references are included in release assets.'
