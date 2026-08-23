$ErrorActionPreference = 'Stop'

$root = 'D:\midDOW\lively-core-separation\lively-core-separation'
$ua = Join-Path $root '.ua'
$batchData = Get-Content -Raw -LiteralPath (Join-Path $ua 'intermediate\batches.json') | ConvertFrom-Json -Depth 100
$batch = $batchData.batches | Where-Object { $_.batchIndex -eq 5 }
$extract = Get-Content -Raw -LiteralPath (Join-Path $ua 'tmp\ua-file-extract-results-5.json') | ConvertFrom-Json -Depth 100
$resultByPath = @{}
foreach ($result in $extract.results) { $resultByPath[$result.path] = $result }

$summaries = @{
  'InputUtil.cs' = '封装 Windows 鼠标与键盘输入转发，生成按键事件、移动光标，并将跨显示器坐标转换为目标壁纸的本地坐标。'
  'LinkUtil.cs' = '提供 URL 打开、规范化与解析工具，清理不安全输入并提取末级路径和稳定主机名。'
  'LivelyInfoUtil.cs' = '根据本地化文件与当前语言生成 LivelyInfoModel 的本地化副本，用于展示壁纸标题、描述和作者信息。'
  'LivelyPropertyUtil.cs' = '加载 LivelyProperties.json 控件配置，将 JSON 项转换为强类型控件模型并应用语言资源本地化。'
  'LogUtil.cs' = '汇总对象属性、硬件信息和 Win32 错误，并将应用日志与诊断文件打包为故障报告。'
  'ObservableObject.cs' = '实现 MVVM 可观察对象基类，提供 PropertyChanged 通知、属性赋值辅助和调试期属性名验证。'
  'PackageUtil.cs' = '封装 Windows packaged app 路径处理，读取 package family name，并校验、解析和规范化受包权限约束的文件路径。'
  'DwmThumbnailWrapper.cs' = '封装 Desktop Window Manager thumbnail 注册、显示、更新和释放流程，用于把源窗口预览嵌入目标窗口。'
  'NativeMethods.cs' = '集中声明 Lively 使用的 Windows native API、结构体、枚举与回调，覆盖窗口管理、显示器、输入、进程、电源、DWM、Shell 和 GDI 互操作。'
  'ScreensaverUtil.cs' = '读取 Windows 当前屏幕保护程序配置，并判断是否选择了 Lively screensaver。'
  'DesktopUtil.cs' = '定位 Progman、WorkerW 与 SHELLDLL_DefView 桌面窗口，并查询或切换桌面图标可见性。'
  'ThumbnailUtil.cs' = '通过 Windows Shell 与 GDI 获取文件缩略图，并将 HBITMAP 转换为保留透明通道的托管 Bitmap。'
  'JsonStorage.cs' = '提供泛型 JSON 文件存储，实现模型数据的加载和原子式写入。'
  'JsonUtil.cs' = '封装 Newtonsoft.Json 的读写与序列化设置，支持 JObject、JToken 和类型化对象。'
  'ThemeUtil.cs' = '读取 Windows 注册表中的系统主题设置，判断应用当前应使用浅色或深色主题。'
  'VolumeMixerUtil.cs' = '通过 Windows Core Audio COM 接口读取或设置指定进程音频会话的音量与静音状态。'
  'WebContentUtil.cs' = '识别在线视频流与网页内容，解析 YouTube 和 Shadertoy 标识，并推断 URL 对应的 WebContentType。'
  'WindowUtil.cs' = '集中实现 Windows 窗口枚举、遮挡判定、类型过滤、父子关系、任务栏隐藏、无边框样式、透明度及窗口 style 操作。'
  'IpcMessageConverter.cs' = '实现 Newtonsoft.Json converter，根据消息类型判别并反序列化 Lively IPC 消息，同时控制写入行为。'
  'LivelyControlModelConverter.cs' = '实现 Newtonsoft.Json converter，根据控件 type 字段将 LivelyProperties 条目反序列化为具体 ControlModel 子类型。'
  'Languages.cs' = '集中维护 Lively 支持的语言代码、显示名称和区域映射，供设置界面与资源选择使用。'
  'Lively.Common.csproj' = '定义 Lively.Common 的 netstandard2.0 类库构建，引用命令行解析、HTTP、JSON、GitHub、压缩、系统管理、DPAPI 与 UAC 相关依赖，并依赖 Lively.Models。'
  'IAppUpdaterService.cs' = '声明应用更新服务契约，暴露检查状态、最新版本元数据、启动与停止更新检查及完成事件。'
  'IAudioVisualizerService.cs' = '声明音频可视化服务契约，提供采样事件以及指定设备的启动和停止操作。'
  'ICacheService.cs' = '声明缓存服务契约，用于获取、添加和移除按键索引的数据项。'
}

$domains = @{
  'InputUtil.cs'='input-forwarding'; 'LinkUtil.cs'='url'; 'LivelyInfoUtil.cs'='localization'; 'LivelyPropertyUtil.cs'='wallpaper-controls';
  'LogUtil.cs'='diagnostics'; 'ObservableObject.cs'='mvvm'; 'PackageUtil.cs'='packaged-app'; 'DwmThumbnailWrapper.cs'='dwm';
  'NativeMethods.cs'='windows-api'; 'ScreensaverUtil.cs'='screensaver'; 'DesktopUtil.cs'='desktop-shell'; 'ThumbnailUtil.cs'='thumbnail';
  'JsonStorage.cs'='json-storage'; 'JsonUtil.cs'='serialization'; 'ThemeUtil.cs'='theme'; 'VolumeMixerUtil.cs'='audio-session';
  'WebContentUtil.cs'='web-content'; 'WindowUtil.cs'='window-management'; 'IpcMessageConverter.cs'='ipc';
  'LivelyControlModelConverter.cs'='wallpaper-controls'; 'Languages.cs'='localization'; 'Lively.Common.csproj'='build-system';
  'IAppUpdaterService.cs'='app-update'; 'IAudioVisualizerService.cs'='audio-visualization'; 'ICacheService.cs'='cache'
}

function Get-Complexity([int]$lines) {
  if ($lines -gt 200) { return 'complex' }
  if ($lines -ge 50) { return 'moderate' }
  return 'simple'
}

function Get-FileId($file) {
  if ($file.fileCategory -eq 'config') { return "config:$($file.path)" }
  return "file:$($file.path)"
}

function Get-ActionTag([string]$name) {
  if ($name -match '^(Is|Can|Has|Verify|Validate|Try)') { return 'validation' }
  if ($name -match '^(Get|Read|Find)') { return 'query' }
  if ($name -match '^(Set|Update|Move|Remove|Borderless)') { return 'window-operation' }
  if ($name -match '^(Load|Store|Write|Serialize)') { return 'serialization' }
  if ($name -match '^(Open|Show)') { return 'user-interaction' }
  if ($name -match '^(Forward|Mouse|ToMouse)') { return 'input-forwarding' }
  if ($name -match '^Dispose$') { return 'lifecycle' }
  return 'utility'
}

function Get-FunctionSummary([string]$path, [string]$name, [string]$context) {
  if ($path -like '*NativeMethods.cs') {
    return "声明 Windows native API ``$name`` 的 P/Invoke binding，供 Lively 的窗口、显示器、输入、进程、Shell 或 GDI 集成功能调用。"
  }
  switch -Regex ($name) {
    '^Mouse(Left|Right)Button(Down|Up)$' { return "合成 ``$name`` 对应的 Windows 鼠标按键事件。" }
    '^MouseMove$' { return '合成鼠标移动输入并将坐标发送到目标窗口。' }
    '^ForwardMessageMouse$' { return '转换并转发 Windows 鼠标消息到壁纸窗口。' }
    '^ForwardMessageKeyboard$' { return '转换并转发 Windows 键盘消息到壁纸窗口。' }
    '^ToMouse(Display|Span)Local$' { return "将全局鼠标坐标转换为 ``$name`` 对应的壁纸本地坐标。" }
    '^CanConvert$' { return "判断当前 JSON token 是否可由$context处理。" }
    '^ReadJson$' { return "从 JSON reader 读取数据并构造$context对应的强类型对象。" }
    '^WriteJson$' { return "按$context的序列化约束写出 JSON 数据。" }
    '^Dispose$' { return "释放$context持有的 native handle、COM 对象或其他资源。" }
    '^Open' { return "打开 ``$name`` 对应的外部资源或 Windows 界面，完成$context的用户交互。" }
    '^Show' { return "显示或注册 ``$name`` 对应的窗口预览，完成$context的呈现操作。" }
    '^TryShow$' { return "尝试显示 DWM thumbnail，并以返回值表示注册或更新是否成功。" }
    '^Sanitize' { return "规范化 URL 并移除不安全或无效部分，供$context继续使用。" }
    '^TrySanitize' { return "尝试规范化 URL，并在无法构造安全地址时返回失败。" }
    '^Localize' { return "使用语言资源本地化$context中的标题、说明或选项文本。" }
    '^Load' { return "从磁盘或 JSON 数据加载$context所需的模型。" }
    '^Store' { return "将$context的数据序列化并写入持久化存储。" }
    '^Write' { return "将$context转换为 JSON 并写入目标文件或 writer。" }
    '^Serialize$' { return "使用统一设置将$context对象序列化为 JSON 文本。" }
    '^Get' { return "获取或计算 ``$name`` 对应的结果，为$context提供所需数据。" }
    '^Is' { return "判断 ``$name`` 所描述的条件是否成立，用于$context的分支决策。" }
    '^Can' { return "判断$context是否支持当前输入类型。" }
    '^Has' { return "检查窗口是否具有 ``$name`` 对应的 Win32 style。" }
    '^Try' { return "尝试执行 ``$name`` 对应操作，并以返回值报告$context处理结果。" }
    '^Set' { return "设置 ``$name`` 对应的状态，完成$context的修改操作。" }
    '^Update$' { return "更新 DWM thumbnail 的目标区域、可见性和显示属性。" }
    '^Remove' { return "移除 ``$name`` 对应的窗口状态或关联。" }
    '^Borderless' { return "移除窗口边框与标题栏 style，生成适合壁纸承载的无边框窗口。" }
    '^Create' { return "创建 ``$name`` 对应的图像、句柄或模型，供$context使用。" }
    '^Crop' { return "裁剪 ``$name`` 对应的图像区域，供$context生成预览。" }
    '^PropertyList$' { return '枚举对象公开属性并生成可写入日志的名称和值列表。' }
    '^ExtractLogFiles$' { return '收集日志与诊断信息并打包为可提交的故障报告归档。' }
    '^VerifyPropertyName$' { return '在调试环境验证属性名是否存在，防止 MVVM 通知使用错误名称。' }
    '^ValidateAndResolvePath$' { return '校验 packaged app 路径并解析为允许访问的最终路径。' }
    '^Forward' { return "转发 ``$name`` 对应的输入消息，完成$context的数据传递。" }
    '^ToMouse' { return "将鼠标坐标转换为$context使用的局部坐标系。" }
    default { return "执行 ``$name`` 处理，完成$context中的对应核心逻辑。" }
  }
}

$nodes = [System.Collections.Generic.List[object]]::new()
$edges = [System.Collections.Generic.List[object]]::new()

foreach ($file in $batch.files) {
  $name = [IO.Path]::GetFileName($file.path)
  $summary = $summaries[$name]
  $domain = $domains[$name]
  if (-not $summary -or -not $domain) { throw "缺少文件语义映射：$name" }
  $result = $resultByPath[$file.path]
  $lineCount = if ($null -ne $result) { [int]$result.nonEmptyLines } else { [int]$file.sizeLines }
  $nodeType = if ($file.fileCategory -eq 'config') { 'config' } else { 'file' }
  if ($file.path -match '/Services/I') {
    $fileTags = @('service-contract', 'type-definition', $domain)
  } elseif ($file.path -match '/JsonConverters/') {
    $fileTags = @('serialization', 'json-converter', $domain)
  } elseif ($name -eq 'Lively.Common.csproj') {
    $fileTags = @('configuration', 'dotnet', 'build-system', 'common-library')
  } elseif ($name -eq 'NativeMethods.cs') {
    $fileTags = @('pinvoke', 'windows-native', 'interop', 'windows-api')
  } else {
    $fileTags = @('utility', 'windows', $domain)
  }
  $fileNode = [ordered]@{
    id = Get-FileId $file
    type = $nodeType
    name = $name
    filePath = $file.path
    summary = $summary
    tags = $fileTags
    complexity = Get-Complexity $lineCount
  }
  if ($name -eq 'NativeMethods.cs') {
    $fileNode['languageNotes'] = '以 DllImport、Win32 enum/struct 和 delegate 集中构建 C# 到 user32、dwmapi、gdi32、shell32 与 kernel32 的互操作边界。'
  } elseif ($name -eq 'VolumeMixerUtil.cs') {
    $fileNode['languageNotes'] = '直接声明 Core Audio COM interface，并显式释放 COM 对象以避免音频会话引用泄漏。'
  } elseif ($name -match 'Converter.cs$') {
    $fileNode['languageNotes'] = '继承 Newtonsoft.Json.JsonConverter，并根据 discriminator 选择具体消息或控件模型。'
  } elseif ($name -eq 'Lively.Common.csproj') {
    $fileNode['languageNotes'] = 'SDK-style netstandard2.0 项目，为桌面核心、UI 与客户端共享 Windows 和序列化基础能力。'
  }
  $nodes.Add([pscustomobject]$fileNode)
  if ($null -eq $result -or $file.fileCategory -ne 'code') { continue }

  $exportSet = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($export in @($result.exports | Where-Object { $null -ne $_ -and $_.name })) { [void]$exportSet.Add($export.name) }

  foreach ($class in @($result.classes | Where-Object { $null -ne $_ -and $_.name })) {
    $isSignificant = @($class.methods).Count -ge 2 -or ($class.endLine - $class.startLine + 1) -ge 20 -or $exportSet.Contains($class.name)
    if (-not $isSignificant) { continue }
    if ($class.name -match '^I[A-Z]') {
      $classSummary = if ($file.path -match '/Services/') { "声明 ``$($class.name)`` 服务接口，约束$($summary.TrimEnd('。'))所需的公开成员。" } else { "声明 ``$($class.name)`` COM interface，映射$($summary.TrimEnd('。'))使用的 native 音频方法。" }
      $classTags = @('interface', 'type-definition', $domain)
    } elseif ($name -eq 'NativeMethods.cs') {
      $classSummary = '作为 Windows 互操作边界，集中组织 Lively 调用的 P/Invoke 方法、native 常量、结构体与回调签名。'
      $classTags = @('pinvoke', 'interop', 'windows-api')
    } else {
      $classSummary = "作为本文件的核心类型，$summary"
      $classTags = @('class', 'utility', $domain)
    }
    $classId = "class:$($file.path):$($class.name)"
    $nodes.Add([pscustomobject][ordered]@{
      id=$classId; type='class'; name=$class.name; filePath=$file.path;
      lineRange=@([int]$class.startLine,[int]$class.endLine); summary=$classSummary; tags=$classTags;
      complexity=Get-Complexity ([int]($class.endLine-$class.startLine+1))
    })
    $edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$classId;type='contains';direction='forward';weight=1.0})
    if ($exportSet.Contains($class.name)) { $edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$classId;type='exports';direction='forward';weight=0.8}) }
  }

  $groups = @{}
  foreach ($function in @($result.functions | Where-Object { $null -ne $_ -and $_.name })) {
    $isSignificant = ($function.endLine-$function.startLine+1) -ge 10 -or $exportSet.Contains($function.name)
    if (-not $isSignificant) { continue }
    if (-not $groups.ContainsKey($function.name)) { $groups[$function.name] = [System.Collections.Generic.List[object]]::new() }
    $groups[$function.name].Add($function)
  }
  $context = $summary.TrimEnd('。')
  foreach ($functionName in @($groups.Keys | Sort-Object)) {
    $items = @($groups[$functionName] | Sort-Object startLine)
    $first = $items[0]
    if ($functionName -eq [IO.Path]::GetFileNameWithoutExtension($file.path)) {
      $functionSummary = "初始化 ``$functionName``，建立$context所需的依赖和 native 资源。"
    } else {
      $functionSummary = Get-FunctionSummary $file.path $functionName $context
    }
    if ($items.Count -gt 1) { $functionSummary += " 此节点代表结构结果中的 $($items.Count) 个同名 overload。" }
    $functionId = "function:$($file.path):$functionName"
    $functionTags = if ($name -eq 'NativeMethods.cs') { @('pinvoke','windows-api','native-method') } else { @('method',(Get-ActionTag $functionName),$domain) }
    $nodes.Add([pscustomobject][ordered]@{
      id=$functionId; type='function'; name=$functionName; filePath=$file.path;
      lineRange=@([int]$first.startLine,[int]$first.endLine); summary=$functionSummary; tags=$functionTags;
      complexity=Get-Complexity ([int]($first.endLine-$first.startLine+1))
    })
    $edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$functionId;type='contains';direction='forward';weight=1.0})
    if ($exportSet.Contains($functionName)) { $edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$functionId;type='exports';direction='forward';weight=0.8}) }
  }
}

$projectPath = 'src/Lively/Lively.Common/Lively.Common.csproj'
foreach ($target in @(
  'src/Lively/Lively.Common/Languages.cs',
  'src/Lively/Lively.Common/Services/IAppUpdaterService.cs',
  'src/Lively/Lively.Common/Services/IAudioVisualizerService.cs',
  'src/Lively/Lively.Common/Services/ICacheService.cs'
)) {
  $edges.Add([pscustomobject][ordered]@{source="config:$projectPath";target="file:$target";type='configures';direction='forward';weight=0.6})
}

if ($nodes.Count -ne 241 -or $edges.Count -ne 428) { throw "总数异常：nodes=$($nodes.Count), edges=$($edges.Count)" }
$parts = [math]::Ceiling([math]::Max($nodes.Count/60.0,$edges.Count/120.0))
if ($parts -ne 5) { throw "分片数异常：$parts" }
$sortedFiles = @($batch.files.path | Sort-Object)
$chunkSize = [math]::Ceiling($sortedFiles.Count/$parts)
foreach ($partIndex in 1..$parts) {
  $group = @($sortedFiles | Select-Object -Skip (($partIndex-1)*$chunkSize) -First $chunkSize)
  $partNodes = @($nodes | Where-Object { $_.filePath -in $group })
  $localIds = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($node in $partNodes) { [void]$localIds.Add($node.id) }
  $partEdges = @($edges | Where-Object { $localIds.Contains($_.source) })
  [pscustomobject][ordered]@{nodes=$partNodes;edges=$partEdges} | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $ua "intermediate\batch-5-part-$partIndex.json") -Encoding utf8
  Write-Output "part=$partIndex files=$($group.Count) nodes=$($partNodes.Count) edges=$($partEdges.Count)"
}
Write-Output "total nodes=$($nodes.Count) edges=$($edges.Count) parts=$parts skipped=$(@($extract.filesSkipped).Count)"
