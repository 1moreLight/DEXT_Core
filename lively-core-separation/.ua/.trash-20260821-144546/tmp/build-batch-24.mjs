import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 24);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-24.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 24');
if (!extraction.scriptCompleted) throw new Error('批次 24 的官方结构提取未完成');

const summaries = {
  'src/Lively/Lively/Core/Wallpapers/VideoWmfProcess.cs': '启动并控制 Windows Media Foundation 辅助进程播放视频壁纸，通过标准输出和命令通道协调就绪、播放、音量与截图。',
  'src/Lively/Lively/Core/Wallpapers/WebCefSharpProcess.cs': '托管 CefSharp 网页壁纸辅助进程，处理浏览器参数、内容就绪信号、消息转发、音频控制和截图。',
  'src/Lively/Lively/Core/Wallpapers/WebWebView2.cs': '托管 WebView2 网页壁纸辅助进程，管理用户数据目录、缩放、主题、调试端口、IPC 消息和内容就绪状态。',
  'src/Lively/Lively/Core/Watchdog/IWatchdogService.cs': '定义看门狗服务的启动状态以及添加、移除和清空受监控进程的契约。',
  'src/Lively/Lively/Core/Watchdog/WatchdogProcess.cs': '启动 Lively 看门狗辅助进程，并通过标准输入发送进程登记、移除和清空命令。',
  'src/Lively/Lively/Core/WinDesktopCore.cs': '实现动态壁纸桌面核心：建立 WorkerW 桌面层，创建与布局壁纸，处理显示器和 Explorer 变化，并向壁纸转发输入和播放控制。',
  'src/Lively/Lively/Extensions/LocalizedStringExtension.cs': '提供 WPF MarkupExtension，从本地化资源服务按键解析界面字符串。',
  'src/Lively/Lively/Extensions/ScreensaverIdleTimeExtensions.cs': '把屏幕保护空闲时间枚举转换为毫秒，供计时器和设置逻辑使用。',
  'src/Lively/Lively/Extensions/WindowExtensions.cs': '提供 WPF 窗口居中、原生移动缩放、框架挂接和像素尺寸计算等扩展方法。',
  'src/Lively/Lively/Factories/ILivelyPropertyFactory.cs': '定义为壁纸和显示器创建 Lively 属性副本目录的工厂契约。',
  'src/Lively/Lively/Factories/IWallpaperPluginFactory.cs': '定义根据壁纸模型、显示器和布局创建具体壁纸后端或 DWM 缩略图后端的工厂契约。',
  'src/Lively/Lively/Factories/IWebView2UserDataFactory.cs': '定义按壁纸布局和显示器分配 WebView2 持久或临时用户数据目录的工厂契约。',
  'src/Lively/Lively/Factories/LivelyPropertyFactory.cs': '为壁纸实例复制和准备可编辑属性文件，并按显示器及布局选择隔离目录。',
  'src/Lively/Lively/Factories/WallpaperPluginFactory.cs': '依据壁纸类型和用户播放器设置实例化图片、视频、网页、外部程序或 DWM 缩略图后端。',
  'src/Lively/Lively/Factories/WebView2UserDataFactory.cs': '生成 WebView2 用户数据目录，隔离不同显示器与布局的浏览器状态并清理临时目录。',
  'src/Lively/Lively/Helpers/CaptureScreen.cs': '封装屏幕区域、窗口和动画 GIF 捕获，并提供位图到 MagickImage 的转换与 GIF 缩放。',
  'src/Lively/Lively/Helpers/WindowsStartup.cs': '根据打包状态在注册表启动项或 Windows StartupTask 之间选择，启用或禁用 Lively 随系统启动。',
  'src/Lively/Lively/Lively.csproj': '定义 Lively WPF 核心项目的目标框架、依赖、资源、发布属性和项目引用。',
  'src/Lively/Lively/Nlog.config': '配置 Lively 核心的 NLog 目标、日志格式、文件路径、滚动和最低日志级别。',
  'src/Lively/Lively/Properties/Icons.Designer.cs': '由资源工具生成的强类型图标访问器，向代码暴露应用图标和菜单图像资源。',
  'src/Lively/Lively/Properties/Icons.resx': '保存 Lively 核心使用的应用、窗口、关闭、主页和网页错误等图标资源。',
  'src/Lively/Lively/Properties/Resources.af-ZA.resx': '提供 Lively 核心界面的南非荷兰语本地化字符串资源。',
  'src/Lively/Lively/Properties/Resources.ar-AE.resx': '提供 Lively 核心界面的阿联酋阿拉伯语本地化字符串资源。',
  'src/Lively/Lively/Properties/Resources.az-Latn.resx': '提供 Lively 核心界面的拉丁字母阿塞拜疆语本地化字符串资源。',
  'src/Lively/Lively/Properties/Resources.Designer.cs': '由资源工具生成的强类型本地化访问器，为数百个界面文本键提供 ResourceManager 属性。',
};

const classDescriptions = {
  VideoWmfProcess: '以 Windows Media Foundation 辅助进程实现统一壁纸控制，并维护进程等待、就绪和退出状态。',
  WebCefSharpProcess: '以 CefSharp 辅助进程实现网页壁纸后端，并协调浏览器启动参数和 IPC 生命周期。',
  WebWebView2: '以 WebView2 辅助进程实现网页壁纸后端，支持独立用户数据、缩放和音频可视化配置。',
  IWatchdogService: '约束核心进程启动看门狗和维护受监控 PID 集合的能力。',
  WatchdogProcess: '封装看门狗子进程及其标准输入协议，为外部壁纸进程提供异常退出清理保障。',
  WinDesktopCore: '协调 Windows WorkerW 桌面层、壁纸实例集合、多屏布局、输入转发、资源恢复和 Explorer 重启。',
  LocalizedStringExtension: '在 XAML 中以资源键解析本地化文本的 WPF 标记扩展。',
  ScreensaverIdleTimeExtensions: '提供屏幕保护空闲时间枚举的单位转换扩展。',
  WindowExtensions: '汇集 WPF 窗口和 FrameworkElement 的 Win32 定位及像素几何扩展。',
  ILivelyPropertyFactory: '定义壁纸属性工作目录的创建接口。',
  IWallpaperPluginFactory: '定义具体 IWallpaper 后端的创建接口。',
  IWebView2UserDataFactory: '定义 WebView2 用户数据目录分配接口。',
  LivelyPropertyFactory: '实现壁纸属性文件复制和实例目录隔离。',
  WallpaperPluginFactory: '根据壁纸类别、显示器、布局和用户偏好选择并构造具体播放器。',
  WebView2UserDataFactory: '实现持久及临时 WebView2 用户数据目录的选择与准备。',
  CaptureScreen: '提供基于 Win32、System.Drawing 和 ImageMagick 的静态及动画屏幕捕获能力。',
  WindowsStartup: '封装传统注册表与打包应用 StartupTask 两种开机启动方案。',
  Icons: '由 .resx 生成的强类型图标资源容器。',
  Resources: '由 .resx 生成的强类型本地化字符串资源容器。',
};

function fileId(file) { return `${file.fileCategory === 'config' ? 'config' : 'file'}:${file.path}`; }
function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function domain(filePath) {
  if (filePath.includes('/Wallpapers/')) return '壁纸后端';
  if (filePath.includes('/Watchdog/')) return '看门狗';
  if (filePath.endsWith('/WinDesktopCore.cs')) return '桌面核心';
  if (filePath.includes('/Extensions/')) return '窗口扩展';
  if (filePath.includes('/Factories/')) return '壁纸工厂';
  if (filePath.includes('/Helpers/CaptureScreen')) return '屏幕捕获';
  if (filePath.includes('/Helpers/WindowsStartup')) return '开机启动';
  if (filePath.includes('/Properties/')) return '资源管理';
  return '核心配置';
}
function fileTags(file) {
  if (file.path.endsWith('.csproj')) return ['msbuild', '项目配置', '构建系统'];
  if (file.path.endsWith('Nlog.config')) return ['nlog', '日志配置', '诊断'];
  if (file.path.endsWith('.resx')) return ['resx', file.path.includes('Icons') ? '图标资源' : '本地化', '资源管理'];
  if (file.path.endsWith('.Designer.cs')) return ['csharp', 'generated-code', file.path.includes('Icons') ? '图标资源' : '本地化'];
  if (file.path.includes('/Wallpapers/')) return ['csharp', 'i-wallpaper', '壁纸后端'];
  if (file.path.includes('/Watchdog/')) return ['csharp', '看门狗', '进程管理'];
  if (file.path.endsWith('/WinDesktopCore.cs')) return ['csharp', '桌面核心', 'win32'];
  if (file.path.includes('/Factories/')) return ['csharp', 'factory', '壁纸后端'];
  if (file.path.includes('/Extensions/')) return ['csharp', 'extension-method', 'wpf'];
  if (file.path.includes('CaptureScreen')) return ['csharp', '屏幕捕获', '图像处理'];
  return ['csharp', '开机启动', 'windows'];
}
function languageNotes(file) {
  if (file.path.endsWith('.csproj')) return 'SDK 风格 MSBuild 项目描述 WPF、Win32 互操作、gRPC 与资源生成依赖。';
  if (file.path.endsWith('.resx')) return '.resx 资源在构建时嵌入程序集，并由 ResourceManager 按 CultureInfo 选择。';
  if (file.path.endsWith('.Designer.cs')) return '该文件由 .resx 代码生成器维护，使用强类型静态属性访问资源键。';
  if (file.path.includes('/Wallpapers/')) return '后端通过 C# 包装辅助进程和 IPC，并遵循统一 IWallpaper 生命周期。';
  if (file.path.endsWith('/WinDesktopCore.cs')) return '大量使用 Win32 WorkerW、窗口消息、原始输入和多屏坐标互操作。';
  if (file.path.includes('/Extensions/')) return '以 C# extension method 或 WPF MarkupExtension 扩展现有类型。';
  return undefined;
}
function classSummary(name, filePath) { return classDescriptions[name] ?? `封装 ${name} 在${domain(filePath)}中的主要职责和状态。`; }
function classTags(name, filePath) {
  if (name.startsWith('I')) return ['interface', domain(filePath), '核心契约'];
  if (name === 'Resources' || name === 'Icons') return ['class', 'generated-code', '资源管理'];
  if (filePath.includes('/Factories/')) return ['class', 'factory', '壁纸后端'];
  if (filePath.includes('/Wallpapers/')) return ['class', 'i-wallpaper', '壁纸后端'];
  if (name === 'WinDesktopCore') return ['class', '桌面核心', 'win32', 'event-handler'];
  return ['class', domain(filePath), '核心组件'];
}

const exactMethods = {
  TryParseUserCommandArgs: '解析用户提供的附加浏览器参数，只接受可安全传递给辅助进程的选项。',
  ResolveFilePath: '根据壁纸模型和输入路径解析 WebView2 实际加载的本地文件或网址。',
  Start: '启动看门狗辅助进程并建立可写的标准输入通道。',
  Add: '把进程 ID 加入看门狗监控集合。',
  Remove: '从看门狗监控集合移除进程 ID。',
  Clear: '清空看门狗当前维护的受监控进程集合。',
  SetupDesktopLayer: '查找或创建 WorkerW 桌面层，并建立动态壁纸窗口所需的层级与消息钩子。',
  SetWallpaperAsync: '异步创建并加载壁纸后端，将其挂接到目标显示器和 WorkerW 桌面层。',
  SetDesktopPictureOrLockscreen: '把图片型壁纸同步到 Windows 桌面背景或锁屏设置。',
  TrySetWallpaperPerScreen: '按单屏布局调整壁纸窗口到目标显示器边界。',
  TrySetWallpaperSpanScreen: '按跨屏布局把壁纸窗口调整到整个虚拟桌面。',
  ResetWallpaperAsync: '关闭当前壁纸并依据保存的布局异步重建桌面状态。',
  SaveWallpaperLayout: '把当前壁纸、显示器和布局信息持久化到用户设置。',
  RefreshWallpaper: '重新评估显示器拓扑并刷新活动壁纸的布局和连接状态。',
  UpdateWallpaperRect: '依据当前布局和显示器边界更新每个壁纸窗口的位置与尺寸。',
  RestoreDisconnectedWallpapers: '在显示器重新连接后恢复此前暂存的壁纸实例。',
  CloseAllWallpapers: '关闭所有活动壁纸，并按参数决定是否发布变更事件。',
  CloseWallpaper: '关闭匹配显示器、类别或壁纸实例的活动壁纸。',
  SendMessageWallpaper: '向指定显示器或属性文件对应的壁纸实例转发控制消息。',
  RefreshDesktop: '请求 Windows 刷新桌面层和壁纸显示状态。',
  TryAttachToDesktop: '尝试把指定窗口句柄设置为 WorkerW 桌面层的子窗口。',
  EnsureWorkerWZOrder: '校正 WorkerW 与图标层的 Z 顺序，确保壁纸位于桌面图标之后。',
  ForwardMouseToWallpapers: '把归一化的鼠标坐标和动作转发给允许交互的壁纸。',
  IsDesktop: '判断前台窗口是否属于桌面或 shell 层。',
  GetTaskbarExplorerPid: '取得承载任务栏的 Explorer 进程 ID。',
  ProvideValue: '从服务容器取得本地化资源服务，并按 ResourceKey 返回 XAML 所需字符串。',
  ToMilliseconds: '把屏幕保护空闲时间枚举转换为毫秒数。',
  SetProgramToFramework: '把外部程序窗口挂接到 WPF FrameworkElement 并同步尺寸与位置。',
  GetAbsolutePlacement: '计算 FrameworkElement 相对屏幕或宿主窗口的绝对矩形。',
  GetElementPixelSize: '结合 DPI 缩放计算 FrameworkElement 的实际像素尺寸。',
  CreateLivelyPropertyFolder: '复制壁纸属性文件并创建与显示器和布局隔离的可编辑工作目录。',
  CreateDwmThumbnailWallpaper: '创建用于预览现有窗口的 DWM 缩略图壁纸后端。',
  CreateWallpaper: '依据壁纸类别、布局和用户播放器偏好构造合适的 IWallpaper 实现。',
  GetWebView2UserDataDir: '根据布局、显示器和窗口模式选择 WebView2 用户数据目录。',
  GetWebView2Scale: '根据显示器 DPI 和窗口模式计算 WebView2 页面缩放值。',
  GetUserDataFolder: '返回适用于当前布局和显示器的持久 WebView2 用户数据目录。',
  GetTempUserDataFolder: '创建并返回一次性 WebView2 用户数据目录。',
  CaptureWindow: '通过 Win32 窗口设备上下文捕获指定窗口图像。',
  CaptureGif: '按时间间隔连续捕获屏幕区域，并编码为带进度回报的动画 GIF。',
  ToMagickImage: '把 System.Drawing 位图转换为 ImageMagick 图像对象。',
  ResizeAnimatedGif: '调整动画 GIF 的帧尺寸并保留动画时序。',
  TrySetStartup: '根据应用是否打包选择注册表或 StartupTask 方案来更新开机启动状态。',
  SetStartupRegistry: '创建或删除当前用户注册表中的 Lively 启动项。',
  SetStartupTask: '启用或禁用打包应用声明的 Windows StartupTask。',
};

function functionSummary(name, filePath, ownerClass) {
  if (name === ownerClass) return `初始化 ${ownerClass}，建立${domain(filePath)}所需的依赖、状态和事件订阅。`;
  if (exactMethods[name]) return exactMethods[name];
  if (name === 'ShowAsync') return '异步启动并呈现壁纸内容，等待辅助进程报告窗口和内容就绪。';
  if (name === 'Pause') return '暂停当前壁纸后端的播放。';
  if (name === 'Play') return '恢复当前壁纸后端的播放。';
  if (name === 'Close') return '请求壁纸后端正常退出并完成清理。';
  if (name === 'Terminate') return '强制终止壁纸辅助进程并更新退出状态。';
  if (name === 'ScreenCapture') return '截取当前壁纸画面并保存到指定路径。';
  if (name === 'SendMessage') return '向壁纸辅助进程或后端转发属性和控制消息。';
  if (name === 'SetVolume') return '设置壁纸后端的音频音量。';
  if (name === 'SetMute') return '切换壁纸后端的静音状态。';
  if (name === 'SetPlaybackPos') return '按指定模式调整壁纸播放位置。';
  if (name === 'Dispose') return '释放事件、原生句柄、图像对象或子进程等运行资源。';
  if (name === 'WaitForContentReadyAsync') return '在超时限制内等待网页壁纸内容发出就绪信号。';
  if (name.includes('_Exited')) return `响应 ${name} 进程退出事件并清理壁纸状态。`;
  if (name.includes('_OutputDataReceived')) return `解析 ${name} 收到的辅助进程输出和控制消息。`;
  if (name.includes('_')) return `响应 ${name} 事件，并同步${domain(filePath)}状态。`;
  if (name.startsWith('Get')) return `获取 ${name.slice(3)} 对应的${domain(filePath)}数据。`;
  if (name.startsWith('Set')) return `设置 ${name.slice(3)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Create')) return `创建 ${name.slice(6)} 对应的${domain(filePath)}对象。`;
  if (name.startsWith('Update')) return `更新 ${name.slice(6)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Refresh')) return `重新读取并刷新 ${name.slice(7)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Restore')) return `恢复 ${name.slice(7)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Restart')) return `重新启动 ${name.slice(7)} 对应的${domain(filePath)}对象。`;
  if (name.startsWith('Try')) return `尝试执行 ${name.slice(3)} 对应的${domain(filePath)}操作并安全处理失败。`;
  if (name.startsWith('Is')) return `判断 ${name} 所描述的${domain(filePath)}条件是否成立。`;
  return `执行 ${name} 对应的${domain(filePath)}逻辑。`;
}
function functionTags(name, filePath, ownerClass, exported) {
  const tags = ['function', domain(filePath)];
  if (name === ownerClass) tags.push('初始化');
  else if (name.includes('_')) tags.push('event-handler');
  else if (name === 'Dispose') tags.push('资源释放');
  else if (name.startsWith('Get') || name.startsWith('Is')) tags.push('查询');
  else if (name.startsWith('Set') || ['Play', 'Pause', 'Close', 'Terminate'].includes(name)) tags.push('状态控制');
  else tags.push('业务逻辑');
  if (exported) tags.push('public-api');
  return tags.slice(0, 5);
}

const resultsByPath = new Map(extraction.results.map((item) => [item.path, item]));
const nodes = [], edges = [];
const nodeIds = new Set(), edgeKeys = new Set();
function addNode(node) { if (nodeIds.has(node.id)) throw new Error(`重复节点 ID: ${node.id}`); nodeIds.add(node.id); nodes.push(node); }
function addEdge(edge) { if (edge.source === edge.target) throw new Error(`自引用边: ${edge.source}`); const key = `${edge.source}|${edge.target}|${edge.type}`; if (edgeKeys.has(key)) return; edgeKeys.add(key); edges.push(edge); }

for (const file of batch.files) {
  const result = resultsByPath.get(file.path);
  const node = { id: fileId(file), type: file.fileCategory === 'config' ? 'config' : 'file', name: path.basename(file.path), filePath: file.path, summary: summaries[file.path], tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines) };
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
    const old = best.get(fn.name); if (!old || fn.endLine - fn.startLine > old.endLine - old.startLine) best.set(fn.name, fn);
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

const f = (p) => `file:${p}`, c = (p, n) => `class:${p}:${n}`;
const iWatchdog = 'src/Lively/Lively/Core/Watchdog/IWatchdogService.cs';
const watchdog = 'src/Lively/Lively/Core/Watchdog/WatchdogProcess.cs';
const desktopCore = 'src/Lively/Lively/Core/WinDesktopCore.cs';
addEdge({ source: c(watchdog, 'WatchdogProcess'), target: c(iWatchdog, 'IWatchdogService'), type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: f(desktopCore), target: f(iWatchdog), type: 'depends_on', direction: 'forward', weight: 0.6 });

const iProperty = 'src/Lively/Lively/Factories/ILivelyPropertyFactory.cs';
const iWallpaperFactory = 'src/Lively/Lively/Factories/IWallpaperPluginFactory.cs';
const iWebView = 'src/Lively/Lively/Factories/IWebView2UserDataFactory.cs';
const propertyFactory = 'src/Lively/Lively/Factories/LivelyPropertyFactory.cs';
const wallpaperFactory = 'src/Lively/Lively/Factories/WallpaperPluginFactory.cs';
const webViewFactory = 'src/Lively/Lively/Factories/WebView2UserDataFactory.cs';
addEdge({ source: c(propertyFactory, 'LivelyPropertyFactory'), target: c(iProperty, 'ILivelyPropertyFactory'), type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: c(wallpaperFactory, 'WallpaperPluginFactory'), target: c(iWallpaperFactory, 'IWallpaperPluginFactory'), type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: c(webViewFactory, 'WebView2UserDataFactory'), target: c(iWebView, 'IWebView2UserDataFactory'), type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: f(wallpaperFactory), target: f(iProperty), type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: f(wallpaperFactory), target: f(iWebView), type: 'depends_on', direction: 'forward', weight: 0.6 });

const iconsDesigner = 'src/Lively/Lively/Properties/Icons.Designer.cs';
const iconsResx = 'src/Lively/Lively/Properties/Icons.resx';
addEdge({ source: f(iconsDesigner), target: f(iconsResx), type: 'depends_on', direction: 'forward', weight: 0.6 });
const resourcesDesigner = 'src/Lively/Lively/Properties/Resources.Designer.cs';
for (const culture of ['Resources.af-ZA.resx', 'Resources.ar-AE.resx', 'Resources.az-Latn.resx']) {
  addEdge({ source: f(resourcesDesigner), target: f(`src/Lively/Lively/Properties/${culture}`), type: 'depends_on', direction: 'forward', weight: 0.6 });
}

for (const file of batch.files.filter((item) => item.fileCategory === 'code')) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: f(target), type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5, configures: 0.6 };
if (nodes.length !== 149) throw new Error(`节点数异常: ${nodes.length}/149`);
if (edges.length !== 225) throw new Error(`边数异常: ${edges.length}/225`);
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
if (partCount !== 3) throw new Error(`分片数异常: ${partCount}/3`);
const sortedFiles = [...batch.files].sort((a, b) => a.path.localeCompare(b.path));
const groupSize = Math.ceil(sortedFiles.length / partCount);
const nodeById = new Map(nodes.map((node) => [node.id, node]));
const parts = []; let totalNodes = 0, totalEdges = 0;
for (let index = 0; index < partCount; index += 1) {
  const fileGroup = sortedFiles.slice(index * groupSize, (index + 1) * groupSize);
  const paths = new Set(fileGroup.map((file) => file.path));
  const partNodes = nodes.filter((node) => paths.has(node.filePath));
  const partIds = new Set(partNodes.map((node) => node.id));
  const partEdges = edges.filter((edge) => partIds.has(edge.source));
  for (const edge of partEdges) {
    if (!partIds.has(edge.source)) throw new Error(`分片 ${index + 1} 边源不在分片内: ${edge.source}`);
    if (!partIds.has(edge.target)) throw new Error(`分片 ${index + 1} 边目标不在分片内: ${edge.target}`);
    if (!nodeById.has(edge.target)) throw new Error(`分片 ${index + 1} 边目标未知: ${edge.target}`);
  }
  const outputPath = path.join(uaDir, 'intermediate', `batch-24-part-${index + 1}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)}\n`, 'utf8');
  totalNodes += partNodes.length; totalEdges += partEdges.length;
  parts.push({ outputPath, files: fileGroup.length, nodes: partNodes.length, edges: partEdges.length });
}
if (totalNodes !== nodes.length || totalEdges !== edges.length) throw new Error(`分片汇总不匹配: ${totalNodes}/${nodes.length} nodes, ${totalEdges}/${edges.length} edges`);
console.log(JSON.stringify({ parts, totals: { nodes: totalNodes, edges: totalEdges }, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
