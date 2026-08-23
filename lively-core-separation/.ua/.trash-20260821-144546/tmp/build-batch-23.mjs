import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 23);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-23.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 23');
if (!extraction.scriptCompleted) throw new Error('批次 23 的官方结构提取未完成');

const summaries = {
  'src/Lively/Lively.Utility.Watchdog/Properties/AssemblyInfo.cs': '保存 Lively 看门狗程序的程序集标题、版本、COM 可见性和产品元数据。',
  'src/Lively/Lively.sln': '聚合 Lively 桌面核心、WinUI 前端、共享库、gRPC、屏幕保护和辅助工具等 .NET 项目的 Visual Studio 解决方案。',
  'src/Lively/Lively/App.xaml': '声明 Lively WPF 核心进程的应用入口与全局资源，是 App 代码隐藏层的 XAML 配套文件。',
  'src/Lively/Lively/App.xaml.cs': '引导 Lively 核心进程，建立依赖注入和 gRPC 服务、执行首次运行初始化、管理主题与单实例，并集中记录未处理异常。',
  'src/Lively/Lively/AppInitializer.cs': '准备 Lively 的运行目录和默认壁纸资源，清理临时数据，并在首次运行或版本升级时执行安装与迁移。',
  'src/Lively/Lively/AssemblyInfo.cs': '声明 Lively 核心程序集的主题资源查找和其他程序集级元数据。',
  'src/Lively/Lively/Assets/Plugins/Mpv/LivelyProperties.json': '定义 MPV 壁纸插件可配置属性的默认值、控件类型和可选项，供属性面板生成交互设置。',
  'src/Lively/Lively/Assets/Plugins/Mpv/LivelyProperties.loc.json': '为 MPV 壁纸属性定义提供本地化显示文本和选项标签。',
  'src/Lively/Lively/Commandline/CommandHandler.cs': '解析并执行 Lively 自动化命令，覆盖应用控制、设置与关闭壁纸、播放定位、属性定制、屏保和截图等流程。',
  'src/Lively/Lively/Commandline/ICommandHandler.cs': '定义核心进程处理命令行参数的公共契约。',
  'src/Lively/Lively/Converters/BoolToVisibilityConverter.cs': '在布尔值与 WPF Visibility 之间转换，支持直接或反向的界面可见性绑定。',
  'src/Lively/Lively/Converters/TaskbarProgressConverter.cs': '把任务进度值转换为 Windows 任务栏进度状态，并提供不支持的反向转换保护。',
  'src/Lively/Lively/Core/Display/DisplayManager.cs': '发现并维护 Windows 显示器拓扑，计算主屏与虚拟桌面边界，并响应显示配置变化。',
  'src/Lively/Lively/Core/Display/IDisplayManager.cs': '定义显示器列表、主屏、虚拟边界和显示器查找能力的核心契约。',
  'src/Lively/Lively/Core/IDesktopCore.cs': '定义动态壁纸桌面核心的控制接口，包括设置、恢复、重启、关闭和消息转发。',
  'src/Lively/Lively/Core/IWallpaper.cs': '定义所有壁纸后端统一的生命周期、播放控制、音量、定位、截图和消息接口。',
  'src/Lively/Lively/Core/Suspend/IPlayback.cs': '定义壁纸播放监控的启停、延迟控制和播放策略，并携带针对显示器的控制事件数据。',
  'src/Lively/Lively/Core/Suspend/Playback.cs': '监控前台窗口、可见窗口、游戏模式、会话和锁屏状态，依据用户策略暂停或恢复各显示器上的壁纸。',
  'src/Lively/Lively/Core/Suspend/PlaybackDeferrer.cs': '补充 Playback 的临时延迟机制，在作用域内停止监控计时器并保持壁纸播放，释放后恢复原状态。',
  'src/Lively/Lively/Core/Wallpapers/DwmThumbnailPlayer.cs': '使用 DWM 缩略图将现有窗口内容呈现为壁纸，并实现统一壁纸生命周期与截图接口。',
  'src/Lively/Lively/Core/Wallpapers/ExtPrograms.cs': '托管任意外部程序型壁纸，管理子进程的启动、挂起、恢复、终止和退出监控。',
  'src/Lively/Lively/Core/Wallpapers/PictureWinAPI.cs': '通过 Windows 桌面壁纸 API 设置图片壁纸，支持多屏布局、恢复原壁纸和统一控制接口。',
  'src/Lively/Lively/Core/Wallpapers/VideoLibVlcPlayer.cs': '启动并控制 LibVLC 辅助进程播放视频壁纸，处理内容就绪信号、IPC 命令、截图和进程退出。',
  'src/Lively/Lively/Core/Wallpapers/VideoMpvPlayer.cs': '启动并控制 MPV 视频壁纸进程，构造播放器参数和 IPC 命令，并处理属性、缩放、色彩空间、流媒体质量与截图。',
  'src/Lively/Lively/Core/Wallpapers/VideoVlcPlayer.cs': '启动并控制 VLC 辅助进程播放视频或 GIF 壁纸，提供播放、音量、定位、截图和退出管理。',
};

const classDescriptions = {
  App: 'Lively 核心应用对象，集中负责进程引导、依赖注入、gRPC 主机、主题、更新通知、单实例和异常处理。',
  AppInitializer: '执行应用目录、默认资源和版本迁移的幂等初始化流程。',
  CommandHandler: '把解析后的自动化选项映射为桌面核心、显示器、屏保、托盘和壁纸库操作。',
  ICommandHandler: '约束核心命令处理器接收并解析原始参数的能力。',
  BooleanToVisibilityConverter: '为 WPF 数据绑定提供布尔值与 Visibility 的双向转换器。',
  TaskbarProgressConverter: '为任务栏状态绑定提供数值到 TaskbarItemProgressState 的转换。',
  DisplayManager: '维护显示器模型集合、主屏和虚拟屏幕边界，并封装 Win32 显示器枚举与查找。',
  IDisplayManager: '定义桌面核心查询和监听显示器拓扑所需的接口。',
  IDesktopCore: '定义动态壁纸桌面层的生命周期和控制契约。',
  IWallpaper: '定义不同壁纸播放器后端必须实现的统一控制契约。',
  IPlayback: '定义播放策略监控器的启停和临时延迟契约。',
  WallpaperControlEventArgs: '封装播放控制动作、目标显示器和音量，作为壁纸播放事件载荷。',
  Playback: '实现基于系统、窗口和用户策略的壁纸自动暂停、恢复及音量调度。',
  DwmThumbnailPlayer: '以 DWM 缩略图窗口实现 IWallpaper，适配现有窗口内容的壁纸呈现。',
  ExtPrograms: '以外部子进程实现 IWallpaper，并维护挂起计数、进程等待和超时状态。',
  PictureWinApi: '以 Windows 图片壁纸 API 实现 IWallpaper，并管理多屏布局与原壁纸恢复。',
  VideoLibVlcPlayer: '以 LibVLC 辅助进程实现 IWallpaper，并通过标准输出和命令通道协调播放。',
  VideoMpvPlayer: '以 MPV 进程和 IPC 实现 IWallpaper，支持高级渲染、属性和流媒体参数。',
  VideoVlcPlayer: '以 VLC 辅助进程实现 IWallpaper，覆盖视频和 GIF 的常用播放控制。',
};

function fileId(file) { return `${file.fileCategory === 'config' ? 'config' : 'file'}:${file.path}`; }
function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function domain(filePath) {
  if (filePath.includes('/Commandline/')) return '命令处理';
  if (filePath.includes('/Display/')) return '显示器管理';
  if (filePath.includes('/Suspend/')) return '播放策略';
  if (filePath.includes('/Wallpapers/')) return '壁纸后端';
  if (filePath.includes('/Converters/')) return '数据绑定';
  if (filePath.includes('/Assets/Plugins/Mpv/')) return 'mpv';
  if (filePath.endsWith('App.xaml.cs') || filePath.endsWith('AppInitializer.cs')) return '应用启动';
  return '核心运行时';
}
function fileTags(file) {
  if (file.path.endsWith('.sln')) return ['visual-studio', '解决方案', '构建系统'];
  if (file.path.endsWith('.json')) return ['json', 'mpv', file.path.includes('.loc.') ? '本地化' : '插件配置'];
  if (file.path.endsWith('.xaml')) return ['xaml', 'wpf', '应用入口'];
  if (file.path.includes('/Wallpapers/')) return ['csharp', 'i-wallpaper', '壁纸后端'];
  if (file.path.includes('/Suspend/')) return ['csharp', '播放策略', '系统监控'];
  if (file.path.includes('/Display/')) return ['csharp', '显示器管理', 'win32'];
  if (file.path.includes('/Commandline/')) return ['csharp', '命令处理', '自动化'];
  if (file.path.includes('/Converters/')) return ['csharp', 'value-converter', '数据绑定'];
  if (file.path.endsWith('App.xaml.cs') || file.path.endsWith('AppInitializer.cs')) return ['csharp', '应用启动', '依赖注入'];
  if (path.basename(file.path).includes('AssemblyInfo')) return ['csharp', '程序集元数据', '配置'];
  return ['csharp', '核心接口', '动态壁纸'];
}
function languageNotes(file) {
  if (file.path.endsWith('.sln')) return 'Visual Studio solution 文件统一组织多个 .NET 项目与构建配置。';
  if (file.path.endsWith('.xaml')) return 'WPF Application XAML 与 C# 代码隐藏类共同构成进程入口。';
  if (file.path.endsWith('.json')) return 'JSON 属性描述由运行时读取，用于动态生成 MPV 壁纸的设置控件。';
  if (file.path.includes('/Wallpapers/')) return '各后端以 C# 类实现统一 IWallpaper 接口，并封装进程或 Win32 互操作细节。';
  if (file.path.includes('/Display/')) return '结合可观察模型与 Win32 显示器 API 维护动态屏幕拓扑。';
  if (file.path.endsWith('App.xaml.cs')) return '使用 Microsoft.Extensions.DependencyInjection 和 ASP.NET Core gRPC 组装桌面核心服务。';
  return undefined;
}
function classSummary(name, filePath) {
  if (name === 'Playback' && filePath.endsWith('PlaybackDeferrer.cs')) return '作为 Playback 的 partial 类扩展，承载作用域式播放延迟器的外部容器。';
  return classDescriptions[name] ?? `封装 ${name} 在${domain(filePath)}中的主要职责和状态。`;
}
function classTags(name, filePath) {
  if (name.startsWith('I')) return ['interface', domain(filePath), '核心契约'];
  if (name.endsWith('EventArgs')) return ['class', '事件数据', '播放控制'];
  if (filePath.includes('/Wallpapers/')) return ['class', 'i-wallpaper', '壁纸后端'];
  if (name === 'App') return ['class', '应用入口', '依赖注入', 'grpc'];
  if (name === 'Playback') return ['class', '播放策略', filePath.endsWith('Deferrer.cs') ? 'partial-class' : '系统监控'];
  return ['class', domain(filePath), '核心组件'];
}

const exactMethods = {
  ConfigureServices: '注册桌面核心、显示器、壁纸工厂、播放监控、设置和其他运行服务，构建依赖注入容器。',
  ConfigureGrpcServer: '创建并启动本地 gRPC 主机，向 WinUI 和辅助工具暴露核心服务。',
  ChangeTheme: '切换应用主题资源并同步当前主题状态。',
  AppUpdateChecked: '响应更新检查结果，并更新托盘通知或升级提示状态。',
  SetupUnhandledExceptionLogging: '订阅进程、任务和 UI 线程的未处理异常事件。',
  LogUnhandledException: '统一记录来自指定来源的未处理异常。',
  AcquireMutex: '取得单实例互斥体，阻止重复核心进程并识别独占屏保模式。',
  ReleaseMutex: '释放并清理单实例互斥体。',
  QuitApp: '有序停止 gRPC、释放互斥体并退出核心应用。',
  CleanTempFiles: '删除上次运行遗留的临时文件和可安全清理的数据。',
  CreateRequiredDirectories: '创建应用启动所需的配置、缓存和壁纸目录。',
  SetupWallpaperDirectories: '根据用户设置建立并校验壁纸库目录结构。',
  HandleFirstRunOrUpdate: '识别首次运行或版本升级，并触发默认资源安装和迁移。',
  InstallWallpaperBundles: '把随应用提供的壁纸包安装到用户壁纸库。',
  SetupWallpaperDefaults: '初始化默认壁纸和首次启动所需的用户设置。',
  MigrateFromOlderVersions: '迁移旧版本目录、配置和壁纸数据到当前结构。',
  CreateWallpaperDir: '在给定基目录中创建并返回壁纸存储目录。',
  ParseArgs: '解析原始自动化参数，并把每类选项分派到对应处理流程。',
  SeekWallpaper: '将目标壁纸的播放位置调整为指定绝对或相对进度。',
  Clamp: '把数值限制在给定最小值和最大值之间。',
  GetWallpapers: '按当前命令条件枚举可操作的壁纸实例或库项目。',
  GetRandomWallpaper: '从符合条件的壁纸集合中随机选择一个项目。',
  RestoreOriginalPropertyFile: '恢复壁纸属性文件的原始副本，撤销命令行定制产生的临时更改。',
  RefreshDisplayMonitorList: '重新枚举 Windows 显示器并更新可观察显示器集合和派生边界。',
  GetHMonitors: '调用 Win32 枚举当前系统中的 HMONITOR 句柄。',
  GetVirtualScreenBounds: '计算所有显示器联合形成的虚拟桌面矩形。',
  ScreenExists: '判断给定显示器模型是否仍存在于当前拓扑。',
  IsMultiScreen: '判断当前系统是否连接了多个显示器。',
  DeferPlayback: '创建作用域式播放延迟对象，临时停止自动暂停检查。',
  PauseWallpapers: '暂停所有受播放策略控制的壁纸。',
  PlayWallpapers: '恢复所有受播放策略控制的壁纸。',
  IsPauseDueToSystemState: '判断锁屏、远程会话、电源或其他系统状态是否要求暂停壁纸。',
  IsPauseRuleApp: '根据前台进程和用户应用规则判断是否需要暂停。',
  RestoreWallpaper: '恢复先前保存的桌面图片或壁纸运行状态。',
  UpdateScaler: '更新 MPV 的壁纸缩放策略并发送相应播放器命令。',
  GetMpvCommand: '根据当前 MPV 状态构造待发送的 IPC 命令对象。',
  GetMpvCommandStrb: '把 MPV 命令序列化为可写入 IPC 通道的字符串。',
  GetConfigDir: '解析 MPV 使用的配置目录。',
  GetMpvTargetColorSpace: '把应用色彩空间选项映射为 MPV 目标色彩空间参数。',
  GetMpvException: '根据 MPV 退出码构造可诊断的播放异常。',
  GetYtDlMpvArg: '根据流媒体质量建议生成 MPV 与下载器的播放参数。',
};

function constructorSummary(ownerClass, filePath) {
  return `初始化 ${ownerClass}，建立${domain(filePath)}所需的依赖、进程状态和事件订阅。`;
}
function functionSummary(name, filePath, ownerClass) {
  if (name === ownerClass) return constructorSummary(ownerClass, filePath);
  if (exactMethods[name]) return exactMethods[name];
  if (name === 'Run' && filePath.endsWith('AppInitializer.cs')) return '依次执行临时文件清理、目录创建、首次运行处理和旧版本迁移。';
  if (name.startsWith('Run') && name.endsWith('Options')) return `处理 ${name.slice(3, -7)} 类命令选项，并调用相应核心服务完成自动化操作。`;
  if (name === 'Convert') return '把绑定源值转换为界面目标类型，并处理参数化的转换规则。';
  if (name === 'ConvertBack') return '处理或拒绝从界面目标值向绑定源类型的反向转换。';
  if (name === 'ShowAsync') return '异步启动并呈现壁纸内容，等待窗口或播放器进入可用状态。';
  if (name === 'Pause') return '暂停当前壁纸后端的播放或外部进程执行。';
  if (name === 'Play') return '恢复当前壁纸后端的播放或外部进程执行。';
  if (name === 'Close') return '请求壁纸后端正常关闭并完成必要的进程清理。';
  if (name === 'Terminate') return '强制终止壁纸后端进程并更新退出状态。';
  if (name === 'ScreenCapture') return '截取当前壁纸画面并保存到指定文件。';
  if (name === 'SendMessage') return '把属性或控制消息发送到壁纸后端。';
  if (name === 'SetVolume') return '设置壁纸后端的播放音量。';
  if (name === 'SetMute') return '切换壁纸后端的静音状态。';
  if (name === 'SetPlaybackPos') return '按指定定位方式调整壁纸播放位置。';
  if (name === 'Dispose') return '释放事件订阅、原生句柄、计时器或子进程等运行资源。';
  if (name === 'WaitForContentReadyAsync') return '在超时限制内异步等待壁纸内容发出就绪信号。';
  if (name.includes('_Exited')) return `响应 ${name} 进程退出事件，完成状态更新和资源回收。`;
  if (name.includes('_OutputDataReceived')) return `解析 ${name} 收到的辅助进程输出，并处理就绪、日志或控制消息。`;
  if (name.includes('_')) return `响应 ${name} 事件，并据此更新${domain(filePath)}状态。`;
  if (name.startsWith('Get')) return `获取 ${name.slice(3)} 对应的${domain(filePath)}数据。`;
  if (name.startsWith('Set')) return `设置 ${name.slice(3)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Create')) return `创建 ${name.slice(6)} 对应的${domain(filePath)}对象或数据。`;
  if (name.startsWith('Update')) return `更新 ${name.slice(6)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Refresh')) return `重新读取并刷新 ${name.slice(7)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Restore')) return `恢复 ${name.slice(7)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Restart')) return `重新启动 ${name.slice(7)} 对应的${domain(filePath)}对象。`;
  if (name.startsWith('Evaluate')) return `评估 ${name.slice(8)} 对壁纸播放策略的影响。`;
  if (name.startsWith('Should') || name.startsWith('Is')) return `判断 ${name} 所描述的${domain(filePath)}条件是否成立。`;
  if (name.startsWith('Try')) return `尝试执行 ${name.slice(3)} 对应的${domain(filePath)}操作并安全处理失败。`;
  if (name.startsWith('Handle')) return `处理 ${name.slice(6)} 对应的${domain(filePath)}结果或错误。`;
  return `执行 ${name} 对应的${domain(filePath)}逻辑。`;
}
function functionTags(name, filePath, ownerClass, isExported) {
  const tags = ['function', domain(filePath)];
  if (name === ownerClass) tags.push('初始化');
  else if (name.includes('_')) tags.push('event-handler');
  else if (name === 'Dispose') tags.push('资源释放');
  else if (name.startsWith('Get') || name.startsWith('Is')) tags.push('查询');
  else if (name.startsWith('Set') || ['Play', 'Pause', 'Close', 'Terminate'].includes(name)) tags.push('状态控制');
  else tags.push('业务逻辑');
  if (isExported) tags.push('public-api');
  return tags.slice(0, 5);
}

const resultsByPath = new Map(extraction.results.map((item) => [item.path, item]));
const nodes = [];
const edges = [];
const nodeIds = new Set();
const edgeKeys = new Set();
function addNode(node) {
  if (nodeIds.has(node.id)) throw new Error(`重复节点 ID: ${node.id}`);
  nodeIds.add(node.id); nodes.push(node);
}
function addEdge(edge) {
  if (edge.source === edge.target) throw new Error(`自引用边: ${edge.source}`);
  const key = `${edge.source}|${edge.target}|${edge.type}`;
  if (edgeKeys.has(key)) return;
  edgeKeys.add(key); edges.push(edge);
}

for (const file of batch.files) {
  const result = resultsByPath.get(file.path);
  const node = { id: fileId(file), type: file.fileCategory === 'config' ? 'config' : 'file', name: path.basename(file.path), filePath: file.path, summary: summaries[file.path] ?? `实现 ${path.basename(file.path)} 对应的${domain(file.path)}功能。`, tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines) };
  const notes = languageNotes(file); if (notes) node.languageNotes = notes;
  addNode(node);
}

for (const file of batch.files) {
  const result = resultsByPath.get(file.path); if (!result) continue;
  const source = fileId(file);
  const exported = new Set((result.exports ?? []).map((item) => item.name).filter(Boolean));
  const classNames = (result.classes ?? []).map((item) => item.name).filter(Boolean);
  for (const cls of result.classes ?? []) {
    if (!cls.name || !Number.isInteger(cls.startLine) || !Number.isInteger(cls.endLine)) continue;
    const length = cls.endLine - cls.startLine + 1;
    if ((cls.methods?.length ?? 0) < 2 && length < 20 && !exported.has(cls.name)) continue;
    const id = `class:${file.path}:${cls.name}`;
    addNode({ id, type: 'class', name: cls.name, filePath: file.path, lineRange: [cls.startLine, cls.endLine], summary: classSummary(cls.name, file.path), tags: classTags(cls.name, file.path), complexity: complexity(length) });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exported.has(cls.name)) addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
  }
  const best = new Map();
  for (const fn of result.functions ?? []) {
    if (!fn.name || !Number.isInteger(fn.startLine) || !Number.isInteger(fn.endLine)) continue;
    const old = best.get(fn.name);
    if (!old || fn.endLine - fn.startLine > old.endLine - old.startLine) best.set(fn.name, fn);
  }
  for (const [name, fn] of best) {
    const length = fn.endLine - fn.startLine + 1;
    if (length < 10 && !exported.has(name)) continue;
    const ownerClass = classNames.find((item) => item === name) ?? classNames[0] ?? '';
    const id = `function:${file.path}:${name}`;
    addNode({ id, type: 'function', name, filePath: file.path, lineRange: [fn.startLine, fn.endLine], summary: functionSummary(name, file.path, ownerClass), tags: functionTags(name, file.path, ownerClass, exported.has(name)), complexity: complexity(length) });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exported.has(name)) addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
  }
}

const f = (p) => `file:${p}`;
const c = (p, n) => `class:${p}:${n}`;
const fn = (p, n) => `function:${p}:${n}`;
const appXaml = 'src/Lively/Lively/App.xaml';
const appCode = 'src/Lively/Lively/App.xaml.cs';
const initializer = 'src/Lively/Lively/AppInitializer.cs';
addEdge({ source: 'config:src/Lively/Lively.sln', target: f(appCode), type: 'configures', direction: 'forward', weight: 0.6 });
addEdge({ source: f(appCode), target: f(appXaml), type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: f(appCode), target: f(initializer), type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: fn(appCode, 'App'), target: fn(initializer, 'Run'), type: 'calls', direction: 'forward', weight: 0.8 });

const commandHandler = 'src/Lively/Lively/Commandline/CommandHandler.cs';
const iCommandHandler = 'src/Lively/Lively/Commandline/ICommandHandler.cs';
addEdge({ source: c(commandHandler, 'CommandHandler'), target: c(iCommandHandler, 'ICommandHandler'), type: 'implements', direction: 'forward', weight: 0.9 });
const displayManager = 'src/Lively/Lively/Core/Display/DisplayManager.cs';
const iDisplayManager = 'src/Lively/Lively/Core/Display/IDisplayManager.cs';
addEdge({ source: c(displayManager, 'DisplayManager'), target: c(iDisplayManager, 'IDisplayManager'), type: 'implements', direction: 'forward', weight: 0.9 });
const playback = 'src/Lively/Lively/Core/Suspend/Playback.cs';
const iPlayback = 'src/Lively/Lively/Core/Suspend/IPlayback.cs';
const playbackDeferrer = 'src/Lively/Lively/Core/Suspend/PlaybackDeferrer.cs';
addEdge({ source: c(playback, 'Playback'), target: c(iPlayback, 'IPlayback'), type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: f(playback), target: f(playbackDeferrer), type: 'depends_on', direction: 'forward', weight: 0.6 });
const iWallpaper = 'src/Lively/Lively/Core/IWallpaper.cs';
for (const [wallpaperPath, className] of [
  ['src/Lively/Lively/Core/Wallpapers/DwmThumbnailPlayer.cs', 'DwmThumbnailPlayer'],
  ['src/Lively/Lively/Core/Wallpapers/ExtPrograms.cs', 'ExtPrograms'],
]) addEdge({ source: c(wallpaperPath, className), target: c(iWallpaper, 'IWallpaper'), type: 'implements', direction: 'forward', weight: 0.9 });

for (const file of batch.files.filter((item) => item.fileCategory === 'code')) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: f(target), type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5, configures: 0.6 };
const fileNodes = nodes.filter((node) => ['file', 'config', 'document', 'service', 'pipeline', 'schema', 'resource'].includes(node.type));
if (fileNodes.length !== batch.files.length) throw new Error(`文件级节点数异常: ${fileNodes.length}/${batch.files.length}`);
for (const file of batch.files) if (!fileNodes.some((node) => node.filePath === file.path)) throw new Error(`缺少文件节点: ${file.path}`);
for (const node of nodes) {
  if (!node.id || !allowedTypes.has(node.type) || !node.name || !node.summary || !Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5 || !allowedComplexity.has(node.complexity)) throw new Error(`节点字段无效: ${node.id}`);
  if (['function', 'class'].includes(node.type) && (!Array.isArray(node.lineRange) || node.lineRange.length !== 2)) throw new Error(`lineRange 无效: ${node.id}`);
}
for (const edge of edges) {
  if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new Error(`悬空边: ${edge.source} -> ${edge.target}`);
  if (edge.direction !== 'forward' || weights[edge.type] !== edge.weight) throw new Error(`边字段无效: ${JSON.stringify(edge)}`);
}
const expectedImports = batch.files.filter((file) => file.fileCategory === 'code').reduce((sum, file) => sum + (batch.batchImportData[file.path] ?? []).length, 0);
const actualImports = edges.filter((edge) => edge.type === 'imports').length;
if (expectedImports !== actualImports) throw new Error(`imports 边不匹配: ${expectedImports}/${actualImports}`);

const partCount = Math.ceil(Math.max(nodes.length / 60, edges.length / 120));
if (partCount !== 4) throw new Error(`分片数异常: 预期 4，实际 ${partCount}（nodes=${nodes.length}, edges=${edges.length}）`);
const sortedFiles = [...batch.files].sort((a, b) => a.path.localeCompare(b.path));
const groupSize = Math.ceil(sortedFiles.length / partCount);
const nodeById = new Map(nodes.map((node) => [node.id, node]));
const totals = { nodes: 0, edges: 0 };
const parts = [];
for (let index = 0; index < partCount; index += 1) {
  const fileGroup = sortedFiles.slice(index * groupSize, (index + 1) * groupSize);
  const paths = new Set(fileGroup.map((file) => file.path));
  const partNodes = nodes.filter((node) => paths.has(node.filePath));
  const partNodeIds = new Set(partNodes.map((node) => node.id));
  const partEdges = edges.filter((edge) => partNodeIds.has(edge.source));
  for (const edge of partEdges) {
    if (!partNodeIds.has(edge.source)) throw new Error(`分片 ${index + 1} 的边源不在分片内: ${edge.source}`);
    if (!nodeById.has(edge.target)) throw new Error(`分片 ${index + 1} 的边目标未知: ${edge.target}`);
  }
  const outputPath = path.join(uaDir, 'intermediate', `batch-23-part-${index + 1}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)}\n`, 'utf8');
  totals.nodes += partNodes.length; totals.edges += partEdges.length;
  parts.push({ outputPath, files: fileGroup.length, nodes: partNodes.length, edges: partEdges.length });
}
if (totals.nodes !== nodes.length || totals.edges !== edges.length) throw new Error(`分片汇总不匹配: ${totals.nodes}/${nodes.length} nodes, ${totals.edges}/${edges.length} edges`);
console.log(JSON.stringify({ parts, totals, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
