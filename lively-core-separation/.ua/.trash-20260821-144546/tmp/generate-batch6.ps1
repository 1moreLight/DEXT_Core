$ErrorActionPreference = 'Stop'
$root = 'D:\midDOW\lively-core-separation\lively-core-separation'
$ua = Join-Path $root '.ua'
$batchData = Get-Content -Raw -LiteralPath (Join-Path $ua 'intermediate\batches.json') | ConvertFrom-Json -Depth 100
$batch = $batchData.batches | Where-Object { $_.batchIndex -eq 6 }
$extract = Get-Content -Raw -LiteralPath (Join-Path $ua 'tmp\ua-file-extract-results-6.json') | ConvertFrom-Json -Depth 100
$resultByPath = @{}
foreach ($result in $extract.results) { $resultByPath[$result.path] = $result }

$summaries = @{
  'IDialogNavigator.cs'='声明对话框页面导航契约，用于在对话内容之间切换并返回导航结果。'
  'IDialogService.cs'='声明 UI 对话服务契约，统一展示确认、错误、壁纸导入、设置和内容选择等异步对话框。'
  'IDispatcherService.cs'='声明 UI dispatcher 契约，用于检查线程访问权限并把同步或异步工作调度到界面线程。'
  'IDownloadService.cs'='声明文件下载契约，支持 URL、目标路径、进度报告和取消令牌。'
  'IFileService.cs'='声明文件选择、保存、打开位置和路径操作契约，为 UI 隔离 Windows 文件系统交互。'
  'IHardwareUsageService.cs'='声明硬件使用率服务契约，通过事件发布 CPU、GPU、内存与网络采样并控制监控生命周期。'
  'IMainNavigator.cs'='声明主界面导航契约，用于在 Lively 的顶级内容页面之间切换。'
  'IMediaFormatConverter.cs'='声明媒体格式转换契约，支持视频、GIF 和图片转换的进度、取消与输出路径。'
  'INavigator.cs'='声明通用页面导航契约，维护当前内容、导航历史和导航完成事件。'
  'INowPlayingService.cs'='声明当前媒体播放服务契约，通过事件与状态模型暴露曲目、艺术家和封面变化。'
  'IResourceService.cs'='声明本地化资源读取契约，按资源键获取字符串并提供当前文化信息。'
  'IRunnerService.cs'='声明外部进程启动契约，支持普通、管理员权限及参数化运行方式。'
  'IScreensaverService.cs'='声明屏幕保护程序服务契约，覆盖启动、停止、预览、配置、状态和 Windows screensaver 注册。'
  'ISystray.cs'='声明系统托盘服务契约，用于显示、更新和释放 Lively notification icon。'
  'ITransparentTbService.cs'='声明透明任务栏服务契约，按主题启动或停止任务栏样式集成并公开运行状态。'
  'IUserSettingsService.cs'='声明用户设置服务契约，加载、保存并重置应用设置与应用规则数据。'
  'IWindowService.cs'='声明窗口服务契约，用于显示、激活和关闭应用窗口。'
  'WindowClassExclusions.cs'='集中维护应从壁纸遮挡与前台窗口检测中排除的 Windows class name 集合。'
  'ApiException.cs'='定义 Gallery API 调用异常，保留 HTTP status、响应正文、headers 与内部异常，并提供可读诊断文本。'
  'GalleryClient.cs'='实现 Lively Gallery HTTP 客户端，覆盖 OAuth 登录、token 管理、账户、壁纸搜索订阅、上传下载、详情查询和后端健康检查。'
  'HttpRequestMessageExtensions.cs'='提供 HttpRequestMessage 扩展，用于附加 JSON body 并克隆可重复发送的请求消息。'
  'ITokenStore.cs'='声明 Gallery access token 存储契约，提供读取、写入和清除操作。'
  'JsonTokenStore.cs'='使用本地 JSON 文件实现 Gallery token 存储，支持读取、更新和清空认证凭据。'
  'Lively.Gallery.Client.csproj'='定义 Gallery 客户端 net8.0 类库，启用 implicit usings 与 nullable，并引用 OperationResult、Watson、Lively.Common 和 Lively.Models。'
  'SearchQuery.cs'='定义 Gallery 搜索查询模型，封装关键词、标签、排序、页码和分页大小。'
}

$domains = @{
  'IDialogNavigator.cs'='navigation';'IDialogService.cs'='dialog';'IDispatcherService.cs'='dispatcher';'IDownloadService.cs'='download';
  'IFileService.cs'='file-system';'IHardwareUsageService.cs'='hardware-monitoring';'IMainNavigator.cs'='navigation';
  'IMediaFormatConverter.cs'='media-conversion';'INavigator.cs'='navigation';'INowPlayingService.cs'='now-playing';
  'IResourceService.cs'='localization';'IRunnerService.cs'='process-runner';'IScreensaverService.cs'='screensaver';
  'ISystray.cs'='system-tray';'ITransparentTbService.cs'='taskbar';'IUserSettingsService.cs'='user-settings';
  'IWindowService.cs'='window-management';'WindowClassExclusions.cs'='window-filtering';'ApiException.cs'='api-error';
  'GalleryClient.cs'='gallery';'HttpRequestMessageExtensions.cs'='http';'ITokenStore.cs'='authentication';
  'JsonTokenStore.cs'='authentication';'Lively.Gallery.Client.csproj'='gallery-client';'SearchQuery.cs'='search'
}

$actions = @{
  'ApiException'='构造 ApiException，并保留 HTTP 状态、响应正文、headers 与异常链'
  'ToString'='生成包含 HTTP status、response 和 headers 的 Gallery API 诊断文本'
  'GalleryClient'='初始化 GalleryClient 的 HttpClient、token store 与基础 endpoint 配置'
  'InitializeAsync'='从 token store 恢复认证状态并初始化 Gallery 客户端'
  'GetMeAsync'='获取当前已认证用户的 Gallery profile'
  'DeleteAccountAsync'='向 Gallery 后端请求删除当前用户账户'
  'RequestCodeAsync'='请求 OAuth 设备登录或授权所需的一次性 code'
  'AuthenticateGoogleAsync'='使用 Google 授权结果向 Gallery 后端换取认证 token'
  'AuthenticateGithubAsync'='使用 GitHub 授权结果向 Gallery 后端换取认证 token'
  'LogoutAsync'='撤销本地认证状态并清除已保存 token'
  'DownloadWallpaperAsync'='下载 Gallery 壁纸包并通过进度与取消令牌报告传输状态'
  'UploadWallpaperAsync'='以 multipart 请求上传壁纸包及其元数据'
  'GetWallpaperInfoAsync'='查询指定 Gallery 壁纸的详情与统计信息'
  'SearchWallpapers'='按 SearchQuery 条件检索分页壁纸列表'
  'GetWallpaperSubscriptions'='获取当前用户订阅的壁纸列表'
  'SubscribeToWallpaperAsync'='订阅指定 Gallery 壁纸并同步服务端状态'
  'UnsubscribeFromWallpaperAsync'='取消指定 Gallery 壁纸订阅'
  'GetBackendHealthAsync'='查询 Gallery 后端健康状态与版本信息'
  'SendAsync'='为 HTTP 请求附加认证与公共 headers，并统一发送和解析响应'
  'InternalSendAsync'='执行底层 HTTP 请求、错误映射、JSON 反序列化和认证失效处理'
  'DownloadFile'='将 HTTP 响应流写入目标文件并报告下载进度'
  'WithJsonContent'='将对象序列化为 JSON 并设置为 HTTP request body'
  'Clone'='深度克隆 HttpRequestMessage 的 method、URI、headers、options 与 content'
  'Clear'='清除本地保存的 Gallery token 数据'
  'Get'='从 JSON token 文件读取当前认证凭据'
  'Set'='将 Gallery token 序列化并保存到本地 JSON 文件'
  'SearchQuery'='初始化 Gallery 搜索查询及其默认分页和排序条件'
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
  if ($name -match '^(Get|Search)') { return 'query' }
  if ($name -match '^(Authenticate|Logout|RequestCode)') { return 'authentication' }
  if ($name -match '^(Download|Upload)') { return 'file-transfer' }
  if ($name -match '^(Subscribe|Unsubscribe)') { return 'subscription' }
  if ($name -match '^(Send|InternalSend)') { return 'http' }
  if ($name -match '^(Clear|Set)') { return 'storage' }
  return 'method'
}

$nodes=[System.Collections.Generic.List[object]]::new()
$edges=[System.Collections.Generic.List[object]]::new()
foreach($file in $batch.files){
  $name=[IO.Path]::GetFileName($file.path);$summary=$summaries[$name];$domain=$domains[$name]
  if(-not$summary-or-not$domain){throw "缺少语义映射：$name"}
  $result=$resultByPath[$file.path];$lines=if($null-ne$result){[int]$result.nonEmptyLines}else{[int]$file.sizeLines}
  $nodeType=if($file.fileCategory-eq'config'){'config'}else{'file'}
  if($name-like'I*.cs'){$tags=@('service-contract','type-definition',$domain)}elseif($name-eq'Lively.Gallery.Client.csproj'){$tags=@('configuration','dotnet','build-system','gallery-client')}elseif($name-eq'GalleryClient.cs'){$tags=@('api-client','http','gallery','authentication')}elseif($name-like'*Extensions.cs'){$tags=@('extension-method','http',$domain)}elseif($name-eq'ApiException.cs'){$tags=@('exception','api-client',$domain)}else{$tags=@('data-model','gallery',$domain)}
  $h=[ordered]@{id=Get-FileId $file;type=$nodeType;name=$name;filePath=$file.path;summary=$summary;tags=$tags;complexity=Get-Complexity $lines}
  if($name-eq'GalleryClient.cs'){$h['languageNotes']='以 HttpClient 和 async/await 实现 REST 调用，并将认证 token、OperationResult 与流式文件传输封装在统一客户端中。'}elseif($name-eq'Lively.Gallery.Client.csproj'){$h['languageNotes']='使用 SDK-style net8.0 项目并启用 nullable reference type。'}
  $nodes.Add([pscustomobject]$h)
  if($null-eq$result-or$file.fileCategory-ne'code'){continue}
  $exportSet=[System.Collections.Generic.HashSet[string]]::new();foreach($e in @($result.exports|Where-Object{$null-ne$_-and$_.name})){[void]$exportSet.Add($e.name)}
  foreach($class in @($result.classes|Where-Object{$null-ne$_-and$_.name})){
    if(@($class.methods).Count-lt2-and($class.endLine-$class.startLine+1)-lt20-and-not$exportSet.Contains($class.name)){continue}
    if($class.name-match'^I[A-Z]'){$classSummary="声明 ``$($class.name)`` 接口，约束$($summary.TrimEnd('。'))所需的公开成员。";$classTags=@('interface','type-definition',$domain)}else{$classSummary="作为本文件的核心类型，$summary";$classTags=@('class',$(if($name-eq'GalleryClient.cs'){'api-client'}else{'data-model'}),$domain)}
    $classId="class:$($file.path):$($class.name)";$nodes.Add([pscustomobject][ordered]@{id=$classId;type='class';name=$class.name;filePath=$file.path;lineRange=@([int]$class.startLine,[int]$class.endLine);summary=$classSummary;tags=$classTags;complexity=Get-Complexity ([int]($class.endLine-$class.startLine+1))})
    $edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$classId;type='contains';direction='forward';weight=1.0});if($exportSet.Contains($class.name)){$edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$classId;type='exports';direction='forward';weight=0.8})}
  }
  $groups=@{};foreach($fn in @($result.functions|Where-Object{$null-ne$_-and$_.name})){if(($fn.endLine-$fn.startLine+1)-lt10-and-not$exportSet.Contains($fn.name)){continue};if(-not$groups.ContainsKey($fn.name)){$groups[$fn.name]=[System.Collections.Generic.List[object]]::new()};$groups[$fn.name].Add($fn)}
  foreach($fnName in @($groups.Keys|Sort-Object)){$items=@($groups[$fnName]|Sort-Object startLine);$first=$items[0];$fnSummary=$actions[$fnName];if(-not$fnSummary){throw "缺少函数语义：$name::$fnName"};$fnSummary+='。';if($items.Count-gt1){$fnSummary+=" 此节点代表结构结果中的 $($items.Count) 个同名 overload。"};$fnId="function:$($file.path):$fnName";$nodes.Add([pscustomobject][ordered]@{id=$fnId;type='function';name=$fnName;filePath=$file.path;lineRange=@([int]$first.startLine,[int]$first.endLine);summary=$fnSummary;tags=@('method',(Get-ActionTag $fnName),$domain);complexity=Get-Complexity ([int]($first.endLine-$first.startLine+1))});$edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$fnId;type='contains';direction='forward';weight=1.0});if($exportSet.Contains($fnName)){$edges.Add([pscustomobject][ordered]@{source=Get-FileId $file;target=$fnId;type='exports';direction='forward';weight=0.8})}}
}
$project='src/Lively/Lively.Gallery.Client/Lively.Gallery.Client.csproj';foreach($target in @('src/Lively/Lively.Gallery.Client/ApiException.cs','src/Lively/Lively.Gallery.Client/GalleryClient.cs','src/Lively/Lively.Gallery.Client/HttpRequestMessageExtensions.cs','src/Lively/Lively.Gallery.Client/Interfaces/ITokenStore.cs','src/Lively/Lively.Gallery.Client/JsonTokenStore.cs','src/Lively/Lively.Gallery.Client/SearchQuery.cs')){$edges.Add([pscustomobject][ordered]@{source="config:$project";target="file:$target";type='configures';direction='forward';weight=0.6})}
if($nodes.Count-ne76-or$edges.Count-ne105){throw "总数异常 nodes=$($nodes.Count) edges=$($edges.Count)"}
$parts=[math]::Ceiling([math]::Max($nodes.Count/60.0,$edges.Count/120.0));if($parts-ne2){throw "分片数异常 $parts"};$sorted=@($batch.files.path|Sort-Object);$chunk=[math]::Ceiling($sorted.Count/$parts)
foreach($k in 1..$parts){$group=@($sorted|Select-Object -Skip (($k-1)*$chunk) -First $chunk);$pn=@($nodes|Where-Object{$_.filePath-in$group});$ids=[System.Collections.Generic.HashSet[string]]::new();foreach($n in $pn){[void]$ids.Add($n.id)};$pe=@($edges|Where-Object{$ids.Contains($_.source)});[pscustomobject][ordered]@{nodes=$pn;edges=$pe}|ConvertTo-Json -Depth 30|Set-Content -LiteralPath (Join-Path $ua "intermediate\batch-6-part-$k.json") -Encoding utf8;Write-Output "part=$k files=$($group.Count) nodes=$($pn.Count) edges=$($pe.Count)"}
Write-Output "total nodes=$($nodes.Count) edges=$($edges.Count) parts=$parts skipped=$(@($extract.filesSkipped).Count)"
