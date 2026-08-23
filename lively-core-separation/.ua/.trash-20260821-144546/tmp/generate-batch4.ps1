$ErrorActionPreference = 'Stop'

$root = 'D:\midDOW\lively-core-separation\lively-core-separation'
$ua = Join-Path $root '.ua'
$batchData = Get-Content -Raw -LiteralPath (Join-Path $ua 'intermediate\batches.json') | ConvertFrom-Json -Depth 100
$batch = $batchData.batches | Where-Object { $_.batchIndex -eq 4 }
$extract = Get-Content -Raw -LiteralPath (Join-Path $ua 'tmp\ua-file-extract-results-4.json') | ConvertFrom-Json -Depth 100
$resultByPath = @{}
foreach ($result in $extract.results) { $resultByPath[$result.path] = $result }

$summaries = @{
  'WorkerWException.cs' = '定义 WorkerW 桌面宿主窗口获取或创建失败时使用的领域异常，并保留标准 .NET 异常构造方式。'
  'EnumExtensions.cs' = '提供枚举扩展方法，用于读取枚举成员上声明的自定义 attribute 值。'
  'IpcMessageExtensions.cs' = '提供 IPC 消息写入扩展，将错误、日志和控制台消息序列化后发送到壁纸子进程的文本通道。'
  'ProcessExtensions.cs' = '提供进程窗口发现扩展，通过轮询进程状态、顶层窗口与子窗口来等待并定位普通应用或游戏窗口句柄。'
  'TaskExtensions.cs' = '提供 Task 等待与取消辅助方法，用于同步展开任务结果、组合取消令牌并判断等待是否正常完成。'
  'WallpaperExtensions.cs' = '提供壁纸类型分类扩展，统一判断在线、网页、视频、应用、媒体、本地网页、目录项目及设备输入能力。'
  'ApplicationsFactory.cs' = '根据进程、可执行文件路径或窗口句柄创建 ApplicationModel，并补全应用名称、图标和进程元数据。'
  'ApplicationsRulesFactory.cs' = '创建应用暂停规则与音乐排除规则模型，为规则配置提供一致的默认对象。'
  'IApplicationsFactory.cs' = '声明从进程、路径或窗口句柄创建 ApplicationModel 的工厂契约。'
  'IApplicationsRulesFactory.cs' = '声明应用暂停规则和音乐排除规则模型的工厂契约。'
  'IWallpaperLibraryFactory.cs' = '声明壁纸媒体库条目读取、创建、打包与路径转换的工厂契约。'
  'WallpaperLibraryFactory.cs' = '实现壁纸媒体库工厂，读取 LivelyInfo 元数据、从目录生成 LibraryModel，并创建普通或媒体壁纸包及相对路径副本。'
  'FileTypes.cs' = '集中维护支持的媒体、网页、可执行文件和壁纸包扩展名，并提供文件类型与包格式识别。'
  'AppLifeCycleUtil.cs' = '提供 Lively 生命周期探测工具，通过 mutex、进程、named pipe 和文件版本判断应用是否运行及其版本。'
  'ZipCreate.cs' = '提供 ZIP 打包工具，将目录或文件集合压缩为壁纸归档，并支持过滤、进度与取消。'
  'ZipExtract.cs' = '提供 ZIP 解包工具，安全提取单个归档或壁纸资源包，并在解压时报告进度。'
  'BuildInfoUtil.cs' = '提供构建类型探测，通过编译配置判断当前程序集是否为 Debug build。'
  'DpiUtil.cs' = '封装 Windows DPI 查询，获取显示器或窗口缩放比例并读取当前线程的 DPI awareness。'
  'EncryptUtil.cs' = '封装 Windows DPAPI 数据保护，支持字符串与字节数据加解密，并将受保护内容持久化到文件。'
  'FileDialogNative.cs' = '封装 Windows 原生文件选择与保存对话框，支持单选、多选、扩展名过滤和窗口 owner。'
  'FileUtil.cs' = '提供文件系统通用操作，包括安全文件名、冲突命名、SHA-256、目录清理与复制、异步文件复制、大小统计和格式化。'
  'GithubUtil.cs' = '封装 GitHub Release 查询与版本处理，选择发布资源 URL、解析版本号并比较程序集版本。'
  'PowerUtil.cs' = '封装 Windows 电源状态查询，读取电池节能模式、交流供电状态和原生 SYSTEM_POWER_STATUS。'
  'SystemInfo.cs' = '通过 WMI 与系统 API 汇总 GPU、CPU、Windows 版本、N/KN edition 和已安装内存等硬件系统信息。'
  'PipeClient.cs' = '提供轻量 named pipe 客户端，将单条消息连接并发送到指定 Lively IPC pipe。'
}

$domainTags = @{
  'WorkerWException.cs' = 'workerw'
  'EnumExtensions.cs' = 'enum'
  'IpcMessageExtensions.cs' = 'ipc'
  'ProcessExtensions.cs' = 'process-management'
  'TaskExtensions.cs' = 'async'
  'WallpaperExtensions.cs' = 'wallpaper-type'
  'ApplicationsFactory.cs' = 'application-model'
  'ApplicationsRulesFactory.cs' = 'app-rules'
  'IApplicationsFactory.cs' = 'application-model'
  'IApplicationsRulesFactory.cs' = 'app-rules'
  'IWallpaperLibraryFactory.cs' = 'wallpaper-library'
  'WallpaperLibraryFactory.cs' = 'wallpaper-library'
  'FileTypes.cs' = 'file-type'
  'AppLifeCycleUtil.cs' = 'app-lifecycle'
  'ZipCreate.cs' = 'archive'
  'ZipExtract.cs' = 'archive'
  'BuildInfoUtil.cs' = 'build-info'
  'DpiUtil.cs' = 'dpi'
  'EncryptUtil.cs' = 'encryption'
  'FileDialogNative.cs' = 'file-dialog'
  'FileUtil.cs' = 'file-system'
  'GithubUtil.cs' = 'github'
  'PowerUtil.cs' = 'power-management'
  'SystemInfo.cs' = 'hardware-info'
  'PipeClient.cs' = 'named-pipe'
}

$actions = @{
  'WorkerWException' = '构造 WorkerWException，并支持默认消息、自定义消息和 inner exception 三种初始化方式'
  'GetAttrValue' = '读取枚举成员上的指定 attribute，并返回由调用方选择的 attribute 值'
  'SendError' = '将异常或错误文本封装为 IPC error message 并写入输出通道'
  'SendLog' = '将日志级别与文本封装为 IPC log message 并写入输出通道'
  'SendConsole' = '将控制台消息类型与文本封装为 IPC console message 并写入输出通道'
  'WaitForProcesWindow' = '等待目标进程创建可用主窗口，并在超时或退出时结束轮询'
  'WaitForProcessOrGameWindow' = '等待普通进程窗口或游戏子窗口出现，并返回最终窗口句柄'
  'GetProcessWindow' = '从进程主窗口及其候选窗口中选择可用窗口句柄'
  'FindWindowByProcessId' = '枚举顶层窗口并按进程 ID 查找匹配的窗口句柄'
  'Await' = '同步等待 Task 完成并展开其结果或异常'
  'TaskWaitCancel' = '使用取消令牌等待 Task，并在取消时提前结束等待'
  'IsTaskWaitCompleted' = '判断带取消等待的 Task 是否正常完成而非被取消'
  'IsOnlineWallpaper' = '判断壁纸类别是否依赖在线内容或流媒体'
  'IsWebWallpaper' = '判断壁纸类别是否由网页渲染器承载'
  'IsVideoWallpaper' = '判断壁纸类别是否属于本地视频或视频流'
  'IsApplicationWallpaper' = '判断壁纸类别是否由应用、游戏或模拟器进程承载'
  'IsMediaWallpaper' = '判断壁纸类别是否属于视频、GIF、图片或媒体流'
  'IsLocalWebWallpaper' = '判断壁纸类别是否为本地网页项目'
  'IsDirectoryProject' = '判断壁纸类别是否使用目录形式的项目资源'
  'IsDeviceInputAllowed' = '判断壁纸类别是否允许转发鼠标或键盘设备输入'
  'CreateApp' = '从进程、路径或窗口句柄创建规范化的 ApplicationModel'
  'CreateAppPauseRule' = '为指定应用创建默认暂停规则模型'
  'CreateAppMusicExclusionRule' = '为指定应用创建音乐播放排除规则模型'
  'GetMetadata' = '从壁纸目录读取并反序列化 LivelyInfo 元数据'
  'CreateFromDirectory' = '从现有壁纸目录与元数据创建 LibraryModel'
  'TryPathCombine' = '尝试将根目录与相对资源路径安全合并为有效路径'
  'CreateFromMetadata' = '根据元数据和资源路径创建新的壁纸媒体库条目'
  'CreateWallpaperPackage' = '将壁纸项目目录压缩为可分发的 Lively 壁纸包'
  'CreateMediaWallpaperPackageAsync' = '异步复制媒体资源并生成可分发的媒体壁纸包'
  'ConvertAbsoluteToRelativePathAsync' = '将元数据中的绝对资源路径复制并转换为包内相对路径'
  'GetFileType' = '根据文件扩展名识别对应的 WallpaperType'
  'IsWallpaperPackage' = '判断给定文件是否为支持的 Lively 壁纸包'
  'IsWallpaperPackageExtension' = '判断扩展名是否属于壁纸包格式'
  'IsAppMutexRunning' = '通过单实例 mutex 判断 Lively 应用是否正在运行'
  'IsAppProcessRunning' = '通过进程列表判断 Lively 应用是否正在运行'
  'IsNamedPipeExists' = '检查指定 named pipe 是否已由 Lively 进程创建'
  'GetRunningLivelyAppVer' = '定位正在运行的 Lively 进程并读取其文件版本'
  'CreateZip' = '将目录或文件列表压缩到 ZIP 输出，并处理进度、过滤和取消'
  'ZipExtractFile' = '将 ZIP 文件安全解压到目标目录'
  'ExtractAssetBundle' = '解压壁纸资源包并报告逐项进度'
  'IsDebugBuild' = '判断当前程序集是否使用 Debug 编译配置'
  'TryGetDisplayScale' = '尝试读取指定显示器的 DPI 缩放比例'
  'TryGetWindowScale' = '尝试读取指定窗口的 DPI 缩放比例'
  'GetThreadDpiAwareness' = '读取当前线程的 Windows DPI awareness 级别'
  'Protect' = '使用 Windows DPAPI 加密字符串或字节数据'
  'Unprotect' = '使用 Windows DPAPI 解密字符串或字节数据'
  'Store' = '加密内容并将受保护字节写入指定文件'
  'Load' = '从文件读取受保护字节并解密为原始内容'
  'PickSingleFile' = '显示原生文件选择器并返回单个所选文件路径'
  'PickMultipleFiles' = '显示原生文件选择器并返回多个所选文件路径'
  'PickSaveFile' = '显示原生保存对话框并返回目标文件路径'
  'ShowOpenFileDialog' = '配置并调用底层 Windows open-file dialog'
  'OpenFolder' = '在 Windows Explorer 中打开并选中指定文件或目录'
  'GetSafeFilename' = '移除文件名中的非法字符以生成安全名称'
  'NextAvailableFilename' = '根据现有文件生成下一个不冲突的文件名'
  'GetNextFilename' = '按数字后缀规则计算下一个候选文件名'
  'GetChecksumSHA256' = '计算文件内容的 SHA-256 checksum'
  'EmptyDirectory' = '递归删除目录中的文件和子目录但保留根目录'
  'GetFiles' = '按搜索模式与递归选项枚举目录文件'
  'IsFileGreater' = '比较文件大小是否超过给定字节阈值'
  'CopyFileAsync' = '以异步流复制文件并报告进度与取消状态'
  'TryDeleteDirectoryAsync' = '重试异步删除目录以处理暂时占用情况'
  'DirectoryCopy' = '递归复制目录结构与文件内容'
  'GetDirectorySize' = '统计目录内全部文件的总字节数'
  'SizeSuffix' = '将字节数格式化为带单位的可读大小字符串'
  'GetLatestRelease' = '通过 Octokit 查询 GitHub 仓库的最新发布信息'
  'GetAssetUrl' = '按资源名称从 Release 中选择下载 URL'
  'GetVersion' = '从 Release tag 解析规范化版本号'
  'CompareAssemblyVersion' = '比较远端版本与当前程序集版本以判断是否需要更新'
  'Contains' = '判断 Release 是否包含名称匹配的资源文件'
  'GetSystemPowerStatus' = '调用 Windows API 读取并转换 SYSTEM_POWER_STATUS'
  'GetBatterySaverStatus' = '判断系统是否处于电池节能模式'
  'GetACPowerStatus' = '判断设备当前是否接入交流电源'
  'GetGpuInfo' = '查询并格式化 GPU 名称、显存和驱动信息'
  'GetGpu' = '通过 WMI 读取 GPU 控制器属性'
  'GetCpuInfo' = '查询并格式化 CPU 名称、核心和时钟信息'
  'GetCpu' = '通过 WMI 读取 CPU 属性'
  'GetOSInfo' = '读取并格式化 Windows 版本与架构信息'
  'CheckWindowsNorKN' = '检测当前 Windows 是否属于缺少媒体组件的 N 或 KN edition'
  'GetTotalInstalledMemory' = '读取系统已安装物理内存总量'
  'SendMessage' = '连接指定 named pipe，发送一条文本消息后关闭连接'
}

function Get-Complexity([int]$lines) {
  if ($lines -gt 200) { return 'complex' }
  if ($lines -ge 50) { return 'moderate' }
  return 'simple'
}

function Get-ActionTag([string]$name) {
  if ($name -match '^(Is|Try|Check|Contains)') { return 'validation' }
  if ($name -match '^(Get|Find)') { return 'query' }
  if ($name -match '^Create') { return 'factory' }
  if ($name -match '^Send') { return 'ipc' }
  if ($name -match '^(Wait|Await|Task)') { return 'async' }
  if ($name -match '^(Protect|Unprotect)') { return 'encryption' }
  if ($name -match '^(Store|Load)') { return 'storage' }
  if ($name -match '^(Open|Pick|Show)') { return 'user-interaction' }
  return 'utility'
}

$nodes = [System.Collections.Generic.List[object]]::new()
$edges = [System.Collections.Generic.List[object]]::new()

foreach ($file in $batch.files) {
  $result = $resultByPath[$file.path]
  if ($null -eq $result) { throw "缺少结构结果：$($file.path)" }
  $name = [IO.Path]::GetFileName($file.path)
  $summary = $summaries[$name]
  $domainTag = $domainTags[$name]
  if (-not $summary -or -not $domainTag) { throw "缺少语义映射：$name" }

  if ($file.path -match '/Exceptions/') {
    $fileTags = @('exception', 'error-handling', $domainTag)
  } elseif ($file.path -match '/Extensions/') {
    $fileTags = @('extension-method', 'utility', $domainTag)
  } elseif ($name -match '^I.*Factory\.cs$') {
    $fileTags = @('factory', 'interface', 'type-definition', $domainTag)
  } elseif ($file.path -match '/Factories/') {
    $fileTags = @('factory', 'data-model', $domainTag)
  } else {
    $fileTags = @('utility', 'windows', $domainTag)
  }

  $fileNode = [ordered]@{
    id = "file:$($file.path)"
    type = 'file'
    name = $name
    filePath = $file.path
    summary = $summary
    tags = $fileTags
    complexity = Get-Complexity ([int]$result.nonEmptyLines)
  }
  if ($name -eq 'EncryptUtil.cs') {
    $fileNode['languageNotes'] = '使用 ProtectedData/DPAPI 将加密范围绑定到当前 Windows 用户，避免自行管理对称密钥。'
  } elseif ($name -eq 'DpiUtil.cs') {
    $fileNode['languageNotes'] = '通过 shcore 与 user32 的 DPI API 兼容按显示器和按窗口的缩放查询。'
  } elseif ($name -eq 'WallpaperLibraryFactory.cs') {
    $fileNode['languageNotes'] = '混合同步元数据解析与异步文件复制，以构建可移植的壁纸归档。'
  }
  $nodes.Add([pscustomobject]$fileNode)

  $exports = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($export in @($result.exports | Where-Object { $null -ne $_ -and $_.name })) {
    [void]$exports.Add($export.name)
  }

  foreach ($class in @($result.classes | Where-Object { $null -ne $_ -and $_.name })) {
    $isSignificant = @($class.methods).Count -ge 2 -or ($class.endLine - $class.startLine + 1) -ge 20 -or $exports.Contains($class.name)
    if (-not $isSignificant) { continue }
    if ($class.name -match '^I.*Factory$') {
      $classSummary = "声明 ``$($class.name)`` 工厂接口，约束$($summary.TrimEnd('。'))所需的公开操作。"
      $classTags = @('interface', 'factory', $domainTag)
    } elseif ($file.path -match '/Exceptions/') {
      $classSummary = '表示无法获取 WorkerW 桌面宿主窗口的领域异常，并继承标准异常消息链。'
      $classTags = @('exception', 'error-handling', $domainTag)
    } else {
      $classSummary = "作为本文件的核心类型，$summary"
      $classTags = @('class', $(if ($file.path -match '/Factories/') { 'factory' } else { 'utility' }), $domainTag)
    }
    $classId = "class:$($file.path):$($class.name)"
    $nodes.Add([pscustomobject][ordered]@{
      id = $classId
      type = 'class'
      name = $class.name
      filePath = $file.path
      lineRange = @([int]$class.startLine, [int]$class.endLine)
      summary = $classSummary
      tags = $classTags
      complexity = Get-Complexity ([int]($class.endLine - $class.startLine + 1))
    })
    $edges.Add([pscustomobject][ordered]@{ source = "file:$($file.path)"; target = $classId; type = 'contains'; direction = 'forward'; weight = 1.0 })
    if ($exports.Contains($class.name)) {
      $edges.Add([pscustomobject][ordered]@{ source = "file:$($file.path)"; target = $classId; type = 'exports'; direction = 'forward'; weight = 0.8 })
    }
  }

  $functionGroups = @{}
  foreach ($function in @($result.functions | Where-Object { $null -ne $_ -and $_.name })) {
    $isSignificant = ($function.endLine - $function.startLine + 1) -ge 10 -or $exports.Contains($function.name)
    if (-not $isSignificant) { continue }
    if (-not $functionGroups.ContainsKey($function.name)) { $functionGroups[$function.name] = [System.Collections.Generic.List[object]]::new() }
    $functionGroups[$function.name].Add($function)
  }
  foreach ($functionName in @($functionGroups.Keys | Sort-Object)) {
    $items = @($functionGroups[$functionName] | Sort-Object startLine)
    $first = $items[0]
    $functionSummary = $actions[$functionName]
    if (-not $functionSummary) { throw "缺少函数语义映射：$name::$functionName" }
    $functionSummary += '。'
    if ($items.Count -gt 1) { $functionSummary += " 此节点代表结构结果中的 $($items.Count) 个同名 overload。" }
    $functionId = "function:$($file.path):$functionName"
    $nodes.Add([pscustomobject][ordered]@{
      id = $functionId
      type = 'function'
      name = $functionName
      filePath = $file.path
      lineRange = @([int]$first.startLine, [int]$first.endLine)
      summary = $functionSummary
      tags = @('method', (Get-ActionTag $functionName), $domainTag)
      complexity = Get-Complexity ([int]($first.endLine - $first.startLine + 1))
    })
    $edges.Add([pscustomobject][ordered]@{ source = "file:$($file.path)"; target = $functionId; type = 'contains'; direction = 'forward'; weight = 1.0 })
    if ($exports.Contains($functionName)) {
      $edges.Add([pscustomobject][ordered]@{ source = "file:$($file.path)"; target = $functionId; type = 'exports'; direction = 'forward'; weight = 0.8 })
    }
  }
}

if ($nodes.Count -ne 131 -or $edges.Count -ne 207) {
  throw "总数异常：nodes=$($nodes.Count), edges=$($edges.Count)"
}
$parts = [math]::Ceiling([math]::Max($nodes.Count / 60.0, $edges.Count / 120.0))
if ($parts -ne 3) { throw "分片数异常：$parts" }
$sortedFiles = @($batch.files.path | Sort-Object)
$chunkSize = [math]::Ceiling($sortedFiles.Count / $parts)
foreach ($partIndex in 1..$parts) {
  $group = @($sortedFiles | Select-Object -Skip (($partIndex - 1) * $chunkSize) -First $chunkSize)
  $partNodes = @($nodes | Where-Object { $_.filePath -in $group })
  $localIds = [System.Collections.Generic.HashSet[string]]::new()
  foreach ($node in $partNodes) { [void]$localIds.Add($node.id) }
  $partEdges = @($edges | Where-Object { $localIds.Contains($_.source) })
  $fragment = [pscustomobject][ordered]@{ nodes = $partNodes; edges = $partEdges }
  $outputPath = Join-Path $ua "intermediate\batch-4-part-$partIndex.json"
  $fragment | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $outputPath -Encoding utf8
  Write-Output "part=$partIndex files=$($group.Count) nodes=$($partNodes.Count) edges=$($partEdges.Count)"
}
Write-Output "total nodes=$($nodes.Count) edges=$($edges.Count) parts=$parts skipped=$(@($extract.filesSkipped).Count)"
