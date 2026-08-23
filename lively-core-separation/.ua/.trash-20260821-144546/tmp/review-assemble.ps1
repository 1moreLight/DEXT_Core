$ErrorActionPreference = 'Stop'

$root = 'D:\midDOW\lively-core-separation\lively-core-separation'
$intermediate = Join-Path $root '.ua\intermediate'
$assembledPath = Join-Path $intermediate 'assembled-graph.json'
$scanPath = Join-Path $intermediate 'scan-result.json'
$reviewPath = Join-Path $intermediate 'assemble-review.json'

$fragmentFiles = @(
  Get-ChildItem -LiteralPath $intermediate -File |
    Where-Object { $_.Name -match '^batch-(\d+)(?:-part-(\d+))?\.json$' } |
    Sort-Object Name
)
$logicalBatches = @(
  $fragmentFiles |
    ForEach-Object {
      if ($_.Name -match '^batch-(\d+)') { [int]$Matches[1] }
    } |
    Sort-Object -Unique
)

$inputNodes = [System.Collections.Generic.List[object]]::new()
$inputEdges = [System.Collections.Generic.List[object]]::new()
$badFragmentJson = [System.Collections.Generic.List[string]]::new()
foreach ($fragmentFile in $fragmentFiles) {
  try {
    $fragment = Get-Content -Raw -LiteralPath $fragmentFile.FullName | ConvertFrom-Json -Depth 100
    foreach ($node in @($fragment.nodes)) { $inputNodes.Add($node) }
    foreach ($edge in @($fragment.edges)) { $inputEdges.Add($edge) }
  } catch {
    $badFragmentJson.Add($fragmentFile.Name)
  }
}

$assembled = Get-Content -Raw -LiteralPath $assembledPath | ConvertFrom-Json -Depth 100
$scan = Get-Content -Raw -LiteralPath $scanPath | ConvertFrom-Json -Depth 100
$separator = [char]31

$nodeIds = [System.Collections.Generic.HashSet[string]]::new()
$duplicateNodes = 0
foreach ($node in @($assembled.nodes)) {
  if (-not $nodeIds.Add($node.id)) { $duplicateNodes++ }
}

$edgeKeys = [System.Collections.Generic.HashSet[string]]::new()
$duplicateEdges = 0
$danglingEdges = 0
$selfEdges = 0
foreach ($edge in @($assembled.edges)) {
  $key = "$($edge.source)$separator$($edge.target)$separator$($edge.type)"
  if (-not $edgeKeys.Add($key)) { $duplicateEdges++ }
  if (-not $nodeIds.Contains($edge.source) -or -not $nodeIds.Contains($edge.target)) { $danglingEdges++ }
  if ($edge.source -eq $edge.target) { $selfEdges++ }
}

$inputNodeIds = [System.Collections.Generic.HashSet[string]]::new()
$inputDuplicateNodes = 0
foreach ($node in $inputNodes) {
  if (-not $inputNodeIds.Add($node.id)) { $inputDuplicateNodes++ }
}
$inputEdgeKeys = [System.Collections.Generic.HashSet[string]]::new()
$inputDuplicateEdges = 0
foreach ($edge in $inputEdges) {
  $key = "$($edge.source)$separator$($edge.target)$separator$($edge.type)"
  if (-not $inputEdgeKeys.Add($key)) { $inputDuplicateEdges++ }
}
$nodesMissingAfterAssembly = 0
foreach ($id in $inputNodeIds) {
  if (-not $nodeIds.Contains($id)) { $nodesMissingAfterAssembly++ }
}
$nodesExtraAfterAssembly = 0
foreach ($id in $nodeIds) {
  if (-not $inputNodeIds.Contains($id)) { $nodesExtraAfterAssembly++ }
}
$edgesMissingAfterAssembly = 0
foreach ($key in $inputEdgeKeys) {
  if (-not $edgeKeys.Contains($key)) { $edgesMissingAfterAssembly++ }
}
$edgesExtraAfterAssembly = 0
foreach ($key in $edgeKeys) {
  if (-not $inputEdgeKeys.Contains($key)) { $edgesExtraAfterAssembly++ }
}

$allowedNodeTypes = @('file','function','class','config','document','service','table','endpoint','pipeline','schema','resource')
$prefixByType = @{
  file='file:'; function='function:'; class='class:'; config='config:'; document='document:';
  service='service:'; table='table:'; endpoint='endpoint:'; pipeline='pipeline:'; schema='schema:'; resource='resource:'
}
$unknownNodeTypes = 0
$unknownComplexity = 0
$missingRequiredFields = 0
$invalidTags = 0
$invalidLineRanges = 0
$invalidIdPrefixes = 0
$nonChineseSummaries = 0
foreach ($node in @($assembled.nodes)) {
  foreach ($field in @('id','type','name','summary','tags','complexity')) {
    if ($null -eq $node.$field -or ($node.$field -is [string] -and [string]::IsNullOrWhiteSpace($node.$field))) {
      $missingRequiredFields++
    }
  }
  if ($node.type -notin $allowedNodeTypes) { $unknownNodeTypes++ }
  if ($node.complexity -notin @('simple','moderate','complex')) { $unknownComplexity++ }
  if (@($node.tags).Count -lt 3 -or @($node.tags).Count -gt 5) { $invalidTags++ }
  if ($node.type -in @('function','class') -and @($node.lineRange).Count -ne 2) { $invalidLineRanges++ }
  if ($prefixByType.ContainsKey($node.type) -and -not $node.id.StartsWith($prefixByType[$node.type])) { $invalidIdPrefixes++ }
  if ($node.summary -notmatch '[\p{IsCJKUnifiedIdeographs}]') { $nonChineseSummaries++ }
}

$allowedEdgeTypes = @('contains','imports','calls','inherits','implements','exports','depends_on','tested_by','configures','documents','deploys','migrates','triggers','defines_schema','serves','provisions','routes','related')
$weightByType = @{
  contains=1.0; imports=0.7; calls=0.8; inherits=0.9; implements=0.9; exports=0.8;
  depends_on=0.6; tested_by=0.5; configures=0.6; documents=0.5; deploys=0.7;
  migrates=0.7; triggers=0.6; defines_schema=0.8; serves=0.7; provisions=0.7; routes=0.6; related=0.5
}
$unknownEdgeTypes = 0
$badDirections = 0
$badWeights = 0
foreach ($edge in @($assembled.edges)) {
  if ($edge.type -notin $allowedEdgeTypes) { $unknownEdgeTypes++ }
  if ($edge.direction -ne 'forward') { $badDirections++ }
  if ($weightByType.ContainsKey($edge.type) -and [double]$edge.weight -ne [double]$weightByType[$edge.type]) { $badWeights++ }
}

$importMapSourceEntries = @($scan.importMap.PSObject.Properties).Count
$importMapRelationships = 0
$missingImportEdges = 0
foreach ($property in $scan.importMap.PSObject.Properties) {
  foreach ($target in @($property.Value)) {
    $importMapRelationships++
    $key = "file:$($property.Name)$separator" + "file:$target$separator" + 'imports'
    if (-not $edgeKeys.Contains($key)) { $missingImportEdges++ }
  }
}
$assembledImportEdges = @($assembled.edges | Where-Object { $_.type -eq 'imports' }).Count

$scanPaths = [System.Collections.Generic.HashSet[string]]::new()
foreach ($file in @($scan.files)) { [void]$scanPaths.Add($file.path) }
$graphPaths = [System.Collections.Generic.HashSet[string]]::new()
foreach ($node in @($assembled.nodes)) {
  if ($node.filePath) { [void]$graphPaths.Add($node.filePath) }
}
$missingScannedFiles = 0
foreach ($path in $scanPaths) {
  if (-not $graphPaths.Contains($path)) { $missingScannedFiles++ }
}
$extraGraphPaths = 0
foreach ($path in $graphPaths) {
  if (-not $scanPaths.Contains($path)) { $extraGraphPaths++ }
}

$stats = [pscustomobject][ordered]@{
  fragmentFiles=$fragmentFiles.Count
  logicalBatches=$logicalBatches.Count
  badFragmentJson=$badFragmentJson.Count
  inputNodes=$inputNodes.Count
  inputEdges=$inputEdges.Count
  inputDuplicateNodes=$inputDuplicateNodes
  inputDuplicateEdges=$inputDuplicateEdges
  assembledNodes=@($assembled.nodes).Count
  assembledEdges=@($assembled.edges).Count
  duplicateNodes=$duplicateNodes
  duplicateEdges=$duplicateEdges
  danglingEdges=$danglingEdges
  selfEdges=$selfEdges
  nodesMissingAfterAssembly=$nodesMissingAfterAssembly
  nodesExtraAfterAssembly=$nodesExtraAfterAssembly
  edgesMissingAfterAssembly=$edgesMissingAfterAssembly
  edgesExtraAfterAssembly=$edgesExtraAfterAssembly
  unknownNodeTypes=$unknownNodeTypes
  unknownComplexity=$unknownComplexity
  missingRequiredFields=$missingRequiredFields
  invalidTags=$invalidTags
  invalidLineRanges=$invalidLineRanges
  invalidIdPrefixes=$invalidIdPrefixes
  nonChineseSummaries=$nonChineseSummaries
  unknownEdgeTypes=$unknownEdgeTypes
  badDirections=$badDirections
  badWeights=$badWeights
  scanFiles=@($scan.files).Count
  graphUniqueFilePaths=$graphPaths.Count
  missingScannedFiles=$missingScannedFiles
  extraGraphPaths=$extraGraphPaths
  importMapSourceEntries=$importMapSourceEntries
  importMapRelationships=$importMapRelationships
  assembledImportEdges=$assembledImportEdges
  missingImportEdges=$missingImportEdges
}

$problems = @(
  $stats.badFragmentJson,$stats.inputDuplicateNodes,$stats.inputDuplicateEdges,$stats.duplicateNodes,$stats.duplicateEdges,
  $stats.danglingEdges,$stats.selfEdges,$stats.nodesMissingAfterAssembly,$stats.nodesExtraAfterAssembly,
  $stats.edgesMissingAfterAssembly,$stats.edgesExtraAfterAssembly,$stats.unknownNodeTypes,$stats.unknownComplexity,
  $stats.missingRequiredFields,$stats.invalidTags,$stats.invalidLineRanges,$stats.invalidIdPrefixes,
  $stats.nonChineseSummaries,$stats.unknownEdgeTypes,$stats.badDirections,$stats.badWeights,
  $stats.missingScannedFiles,$stats.extraGraphPaths,$stats.missingImportEdges
) | Where-Object { $_ -ne 0 }

if ($fragmentFiles.Count -ne 58 -or $logicalBatches.Count -ne 29 -or $inputNodes.Count -ne 2456 -or $inputEdges.Count -ne 3293 -or @($assembled.nodes).Count -ne 2456 -or @($assembled.edges).Count -ne 3293) {
  throw "合并计数与报告不一致：$($stats | ConvertTo-Json -Compress)"
}
if ($problems.Count -ne 0) {
  throw "组装图仍有需要判断或修复的问题：$($stats | ConvertTo-Json -Compress)"
}

$review = [pscustomobject][ordered]@{
  fixedSectionOk=$true
  nodesRecovered=0
  edgesRestored=0
  crossBatchEdgesAdded=0
  typesRemapped=0
  complexityRemapped=0
  notes=@(
    '合并报告未列出机械修复或无法修复项；58 个片段归属于 29 个逻辑批次，输入与输出均为 2456 个节点、3293 条边，计数与集合完全一致。',
    '组装图不存在重复节点、重复边、悬空边、自引用边、未知类型或复杂度、错误权重、无效方向及缺失必填字段。',
    'scan-result.json 的权威 importMap 包含 660 个文件入口，但所有目标数组均为空，因此可核验的内部 import 关系为 0，缺失 import 边为 0，新增跨批 import 边为 0。',
    '全部 660 个扫描文件都能在图节点的 filePath 中找到，且不存在扫描范围外的文件路径。',
    '无需修改 assembled-graph.json。剩余关注点是权威 importMap 未解析出任何内部导入关系，因此本阶段无法补充基于 import 的跨文件连接。'
  )
}
$review | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $reviewPath -Encoding utf8
$stats | ConvertTo-Json -Depth 10
