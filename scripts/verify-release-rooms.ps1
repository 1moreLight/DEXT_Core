param([string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$root = Join-Path $RepositoryRoot 'dev_docs/fixtures/room-v3/release-api1'
$catalog = Get-Content -LiteralPath (Join-Path $root 'catalog.json') -Raw | ConvertFrom-Json
function Verify-File([string]$path, $record) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Frozen resource missing: $path" }
    if ((Get-Item -LiteralPath $path).Length -ne $record.size -or
        (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $record.sha256) {
        throw "Frozen resource changed: $path"
    }
}
if ($catalog.formatVersion -ne 1) { throw 'Unsupported frozen catalog format' }
# The frozen contract is retained alongside all subsequent supported versions.
$contract = Join-Path $RepositoryRoot 'room-v3-compatibility.json'
if ((Get-FileHash -LiteralPath $contract -Algorithm SHA256).Hash.ToLowerInvariant() -ne $catalog.contractSha256) {
    throw 'API1 compatibility baseline changed; preserve it and add a separate version instead'
}
foreach ($sample in $catalog.samples) {
    $dir = Join-Path $root $sample.directory
    $manifest = Get-Content -LiteralPath (Join-Path $dir 'room.json') -Raw | ConvertFrom-Json
    if ($manifest.id -ne $sample.roomId -or $manifest.version -ne 3 -or $manifest.apiVersion -ne 1) {
        throw "Frozen Room identity/version changed: $($sample.name)"
    }
    $declared = @('room.json') + @($manifest.resources)
    $recorded = @($sample.files | ForEach-Object { $_.path })
    if (Compare-Object $declared $recorded) { throw "Catalog/resources differ: $($sample.name)" }
    foreach ($file in $sample.files) { Verify-File (Join-Path $dir $file.path) $file }
    $actual = @(Get-ChildItem -LiteralPath $dir -Recurse -File | ForEach-Object {
        $_.FullName.Substring($dir.Length + 1).Replace('\', '/')
    })
    if (Compare-Object $recorded $actual) { throw "Unexpected/missing authored files: $($sample.name)" }
    Verify-File (Join-Path $root $sample.archive.path) $sample.archive
    Write-Output "Frozen bytes OK: $($sample.name)"
}
Write-Output 'This checks frozen bytes only. Actual import/open/Desk/actions/bindings/restart/share gates remain required.'