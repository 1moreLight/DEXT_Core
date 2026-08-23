import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 27);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-27.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 27');
if (!extraction.scriptCompleted) throw new Error('批次 27 的官方结构提取未完成');

const summaries = {
  'src/Lively/Lively/Services/ScreensaverService.cs': '协调 Lively 屏幕保护模式：监控空闲输入、全屏应用和媒体播放，在多显示器上创建壁纸、空白或 DWM 预览窗口，并处理锁屏与退出。',
  'src/Lively/Lively/Services/Systray.cs': '管理系统托盘图标、主题、通知和动态菜单，响应壁纸、更新、播放及语言变化并提供随机壁纸等快捷操作。',
  'src/Lively/Lively/Services/TranslucentTBService.cs': '使用 Windows 组合属性控制任务栏透明、模糊、强调色和壁纸取色主题，并检测不兼容程序。',
  'src/Lively/Lively/Services/UserSettingsService.cs': '加载和保存用户设置、应用规则与壁纸布局，修正不可用播放器选项并把持久化显示器映射到当前拓扑。',
  'src/Lively/Lively/Services/WindowService.cs': '统一创建日志、诊断、网格覆盖和壁纸对话框窗口，并维护多显示器调试覆盖层状态。',
  'src/Lively/Lively/Themes/Dark.xaml': '定义 Lively WPF 核心窗口的深色主题资源字典，包括颜色、画刷和控件样式。',
  'src/Lively/Lively/Themes/Light.xaml': '定义 Lively WPF 核心窗口的浅色主题资源字典，包括颜色、画刷和控件样式。',
  'src/Lively/Lively/Themes/ToolStripRendererDark.cs': '为深色系统托盘菜单自定义箭头、勾选标记和菜单项背景绘制。',
  'src/Lively/Lively/Themes/ToolStripRendererLight.cs': '为浅色系统托盘菜单自定义箭头、勾选标记和菜单项背景绘制。',
  'src/Lively/Lively/ViewModels/DiagnosticViewModel.cs': '向诊断菜单提供日志归档、日志窗口、帮助页面和显示器网格覆盖命令。',
  'src/Lively/Lively/ViewModels/LibraryPreviewViewModel.cs': '管理壁纸预览编辑流程，载入元数据、捕获缩略图和动画预览，并更新壁纸资源文件。',
  'src/Lively/Lively/Views/BlankWindow.xaml': '定义屏幕保护使用的纯色空白窗口布局。',
  'src/Lively/Lively/Views/BlankWindow.xaml.cs': '实现空白屏幕保护窗口的代码隐藏层，提供可配置淡入淡出动画和关闭处理。',
  'src/Lively/Lively/Views/DebugLog.xaml': '定义实时日志查看窗口的 WPF 布局。',
  'src/Lively/Lively/Views/DebugLog.xaml.cs': '初始化调试日志窗口并连接其 XAML 内容。',
  'src/Lively/Lively/Views/DiagnosticMenu.xaml': '定义诊断工具菜单的 WPF 布局和命令绑定。',
  'src/Lively/Lively/Views/DiagnosticMenu.xaml.cs': '初始化诊断菜单窗口并连接其 XAML 内容。',
  'src/Lively/Lively/Views/DwmThumbnailWindow.xaml': '定义用于显示 DWM 窗口缩略图的透明预览窗口布局。',
  'src/Lively/Lively/Views/DwmThumbnailWindow.xaml.cs': '注册和更新 DWM 窗口缩略图，并转发预览窗口中的鼠标、键盘、触控和滚轮输入。',
  'src/Lively/Lively/Views/LibraryPreview.xaml': '定义壁纸元数据编辑、捕获区域选择和预览生成窗口的 WPF 布局。',
  'src/Lively/Lively/Views/LibraryPreview.xaml.cs': '协调壁纸预览窗口生命周期、位置、键盘操作和底层窗口消息。',
  'src/Lively/Lively/Views/ScreenSaverPreview.xaml': '定义嵌入 Windows 屏幕保护设置中的预览宿主窗口布局。',
  'src/Lively/Lively/Views/ScreenSaverPreview.xaml.cs': '初始化屏幕保护预览宿主并连接其 XAML 内容。',
  'src/Lively/Lively/Views/SplashWindow.xaml': '定义 Lively 核心启动时显示的启动画面布局。',
  'src/Lively/Lively/Views/SplashWindow.xaml.cs': '实现启动画面代码隐藏层，提供可配置淡入淡出动画和关闭处理。',
};

const classDescriptions = {
  ScreensaverService: '管理屏幕保护运行状态、空闲计时、多显示器窗口、输入监听和锁屏策略。',
  Systray: '维护托盘图标及其动态菜单，并把用户命令转发到壁纸、UI、更新和设置服务。',
  TranslucentTBService: '封装任务栏窗口枚举、组合属性、主题颜色和兼容性检测。',
  UserSettingsService: '负责设置模型的持久化、默认值修复和显示器引用解析。',
  WindowService: '作为核心窗口工厂和生命周期管理器，控制诊断及覆盖层窗口。',
  ToolStripRendererDark: '以深色画刷和 GDI 绘制 WinForms ToolStrip 菜单元素。',
  ToolStripRendererLight: '以浅色画刷和 GDI 绘制 WinForms ToolStrip 菜单元素。',
  DiagnosticViewModel: '向诊断视图暴露日志、帮助和显示器覆盖层命令。',
  LibraryPreviewViewModel: '维护壁纸预览编辑状态并驱动截图、GIF 生成和元数据保存。',
  BlankWindow: '承载带淡入淡出动画的空白屏幕保护窗口。',
  DebugLog: '承载实时调试日志窗口。',
  DiagnosticMenu: '承载诊断工具菜单及其视图模型。',
  DwmThumbnailWindow: '托管 DWM 缩略图句柄并把预览输入转发到底层源窗口。',
  LibraryPreview: '承载壁纸预览编辑窗口并协调原生窗口消息与视图模型完成状态。',
  ScreenSaverPreview: '承载 Windows 屏幕保护设置中的嵌入式预览区域。',
  SplashWindow: '承载带淡入淡出动画的应用启动画面。',
};

function fileId(file) { return `file:${file.path}`; }
function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function domain(filePath) {
  if (filePath.includes('/Services/Screensaver')) return '屏幕保护';
  if (filePath.includes('/Services/Systray')) return '系统托盘';
  if (filePath.includes('/Services/Translucent')) return '任务栏主题';
  if (filePath.includes('/Services/UserSettings')) return '用户设置';
  if (filePath.includes('/Services/Window')) return '窗口管理';
  if (filePath.includes('/Themes/')) return '主题渲染';
  if (filePath.includes('LibraryPreview')) return '壁纸预览';
  if (filePath.includes('Diagnostic') || filePath.includes('DebugLog')) return '诊断工具';
  if (filePath.includes('DwmThumbnail')) return 'dwm-thumbnail';
  if (filePath.includes('ScreenSaver') || filePath.includes('BlankWindow')) return '屏幕保护';
  if (filePath.includes('Splash')) return '启动界面';
  return '窗口视图';
}
function fileTags(file) {
  if (file.path.endsWith('.xaml')) return ['xaml', 'wpf', domain(file.path)];
  if (file.path.endsWith('.xaml.cs')) return ['csharp', '代码隐藏', domain(file.path)];
  if (file.path.includes('/ViewModels/')) return ['csharp', 'view-model', domain(file.path)];
  if (file.path.includes('/Themes/')) return ['csharp', 'custom-renderer', '主题渲染'];
  return ['csharp', 'service', domain(file.path)];
}
function languageNotes(file) {
  if (file.path.endsWith('.xaml')) return '使用 WPF XAML 的资源引用、数据绑定和控件层级声明窗口或主题。';
  if (file.path.endsWith('.xaml.cs')) return 'C# partial 类作为对应 XAML 窗口的代码隐藏层，并与 Win32 窗口消息互操作。';
  if (file.path.includes('/Themes/')) return '继承 WinForms ToolStripProfessionalRenderer，并通过 GDI 自定义菜单绘制。';
  if (file.path.includes('/Services/')) return '服务结合 async/await、事件订阅、Win32 API 和多显示器坐标管理运行状态。';
  return undefined;
}
function classSummary(name) { return classDescriptions[name] ?? `封装 ${name} 的界面或服务职责。`; }
function classTags(name, filePath) {
  if (filePath.includes('/ViewModels/')) return ['class', 'view-model', domain(filePath)];
  if (filePath.includes('/Themes/')) return ['class', 'custom-renderer', '主题渲染'];
  if (filePath.includes('/Views/')) return ['class', 'wpf', domain(filePath)];
  return ['class', 'service', domain(filePath)];
}

const exactMethods = {
  StartAsync: '异步进入屏幕保护模式，根据设置和显示器拓扑创建相应壁纸或空白窗口。',
  StopAsync: '异步关闭全部屏幕保护窗口、预览和输入监听并恢复正常状态。',
  StartIdleTimer: '按用户配置的空闲时间启动屏幕保护检测计时器。',
  StopIdleTimer: '停止空闲检测计时器并清理相关状态。',
  ShowScreensavers: '在所有目标显示器上创建并显示屏幕保护内容。',
  CloseScreensavers: '关闭当前全部屏幕保护窗口和壁纸实例。',
  ShowWindowAsScreensaver: '按屏保布局选择壁纸，并在各显示器上创建全屏屏幕保护窗口。',
  ShowPreviewWindowAsScreensaver: '在指定显示器或矩形中创建壁纸预览屏幕保护窗口。',
  CloseWindowAsScreensaver: '关闭壁纸型屏幕保护窗口。',
  ShowBlankWindowAsScreensaver: '在指定显示器或边界上显示纯色空白屏幕保护窗口。',
  CloseBlankWindowAsScreensaver: '关闭所有空白屏幕保护窗口。',
  ShowDwmThumbnailAsScreensaver: '使用 DWM 缩略图把当前壁纸窗口呈现为屏幕保护。',
  CloseDwmThumbnailAsScreensaver: '关闭并释放屏幕保护使用的 DWM 缩略图窗口。',
  IdleCheckTimer: '周期检查用户空闲、全屏程序和媒体播放状态，决定是否启动屏保。',
  CreatePreview: '在 Windows 提供的预览窗口句柄中创建嵌入式屏幕保护预览。',
  StartInputListener: '订阅原始键盘和鼠标事件，以便退出屏幕保护。',
  StopInputListener: '取消原始输入事件订阅。',
  LockWorkstationAndWaitAsync: '锁定工作站并在超时内等待会话进入锁定状态。',
  LockWorkStationSafe: '安全调用 Windows LockWorkStation，并屏蔽平台调用失败。',
  GetLastInputTime: '通过 Win32 GetLastInputInfo 计算用户空闲时长。',
  IsExclusiveFullScreenAppRunning: '判断是否存在应阻止屏幕保护启动的独占全屏应用。',
  IsSmtcPlayingAsync: '查询系统媒体传输控件，判断当前是否有媒体正在播放。',
  Visibility: '切换系统托盘图标的可见状态。',
  ShowBalloonNotification: '显示带标题和正文的托盘气泡通知。',
  SetTheme: '切换托盘菜单或任务栏服务使用的明暗主题资源。',
  ContextMenuStrip_Opening: '在托盘菜单打开前根据壁纸、更新和显示器状态重建菜单项。',
  CustomiseWallpaper: '打开当前壁纸的属性自定义界面。',
  SetUpdateMenu: '根据更新状态刷新托盘菜单中的更新入口和提示。',
  SetRandomWallpapers: '为目标显示器随机选择并设置壁纸。',
  GetRandomWallpaper: '从当前壁纸库筛选并随机返回一个可用项目。',
  CreateToolStripSeparator: '创建匹配当前主题颜色的托盘菜单分隔线。',
  GetMenuItemString: '按托盘菜单项标识取得当前文化下的显示文本。',
  SetAccentColor: '更新任务栏主题使用的强调色。',
  SetTaskbarTransparent: '把选定透明、模糊或着色策略应用到所有任务栏窗口。',
  GetTaskbars: '枚举主任务栏和多显示器辅助任务栏的窗口句柄。',
  ResetTaskbar: '恢复任务栏的默认 Windows 组合属性。',
  CheckIncompatiblePrograms: '检测可能覆盖或冲突于任务栏主题的外部程序。',
  GetAverageColor: '计算壁纸图像的平均色，供任务栏着色主题使用。',
  SetWindowCompositionAttribute: '声明并调用 Windows 组合属性 API 更新任务栏外观。',
  Save: '把用户设置、应用规则和壁纸布局序列化到持久化文件。',
  Load: '从磁盘加载设置文件，并修复缺失或不可用的配置值。',
  LoadOrInitialize: '加载指定设置文件；文件缺失或损坏时创建默认模型。',
  ResolveDisplay: '把持久化显示器信息映射到当前系统中的显示器模型。',
  ShowLogWindow: '创建或激活实时日志窗口。',
  ShowDiagnosticWindow: '创建或激活诊断工具窗口。',
  ShowGridOverlay: '显示或关闭所有显示器上的覆盖网格。',
  ShowWallpaperDialogWindowAsync: '异步打开壁纸详情或属性对话窗口。',
  ShowGridOverlayInternal: '为每个显示器创建覆盖范围调试窗口。',
  CloseGridOverlayInternal: '关闭并清理全部覆盖范围调试窗口。',
  OnRenderArrow: '按当前主题绘制 ToolStrip 子菜单箭头。',
  OnRenderItemCheck: '按当前主题绘制 ToolStrip 菜单勾选标记。',
  OnRenderMenuItemBackground: '按悬停和选中状态绘制 ToolStrip 菜单项背景。',
  CreateLogFile: '收集诊断日志并生成可供导出或分享的压缩包。',
  OpenLogView: '通过窗口服务打开实时日志查看窗口。',
  OpenHelp: '打开 Lively 的帮助或故障排查页面。',
  ToggleGridOverlay: '切换多显示器覆盖范围调试网格。',
  SaveLogFile: '把生成的诊断日志复制到用户选择的文件位置。',
  Cancel: '取消当前壁纸预览生成流程。',
  CanCancel: '返回当前预览生成状态是否允许取消。',
  LoadModel: '把壁纸元数据加载到可编辑的视图模型属性。',
  CreateThumbnailAndPreview: '捕获指定区域并生成静态缩略图和可选动画预览。',
  UpdateWallpaperFiles: '把编辑后的元数据和新生成的缩略图、预览写回壁纸项目。',
  WndProc: '处理原生窗口消息，并把需要的消息交给预览或桌面窗口逻辑。',
};

function functionSummary(name, filePath, ownerClass) {
  if (name === ownerClass) return `初始化 ${ownerClass}，建立${domain(filePath)}所需的依赖、视图状态和事件订阅。`;
  if (exactMethods[name]) return exactMethods[name];
  if (name.includes('_Closing')) return `响应 ${name} 窗口关闭事件并执行动画或资源清理。`;
  if (name.includes('_Loaded')) return `响应 ${name} 加载事件并完成窗口初始化或淡入动画。`;
  if (name.includes('_')) return `响应 ${name} 事件，并同步${domain(filePath)}状态。`;
  if (name === 'Dispose') return '释放计时器、托盘图标、事件订阅和原生资源。';
  if (name.startsWith('Get')) return `获取 ${name.slice(3)} 对应的${domain(filePath)}数据。`;
  if (name.startsWith('Set')) return `设置 ${name.slice(3)} 对应的${domain(filePath)}状态。`;
  if (name.startsWith('Show')) return `显示 ${name.slice(4)} 对应的${domain(filePath)}窗口或内容。`;
  if (name.startsWith('Close')) return `关闭 ${name.slice(5)} 对应的${domain(filePath)}窗口或对象。`;
  if (name.startsWith('Update')) return `更新 ${name.slice(6)} 对应的${domain(filePath)}数据。`;
  return `执行 ${name} 对应的${domain(filePath)}逻辑。`;
}
function functionTags(name, filePath, ownerClass, exported) {
  const tags = ['function', domain(filePath)];
  if (name === ownerClass) tags.push('初始化');
  else if (name.includes('_') || name.startsWith('OnRender')) tags.push('event-handler');
  else if (name === 'Dispose') tags.push('资源释放');
  else if (name.startsWith('Get') || name.startsWith('Is') || name.startsWith('Can')) tags.push('查询');
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
  const node = { id: fileId(file), type: 'file', name: path.basename(file.path), filePath: file.path, summary: summaries[file.path], tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines) };
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
    addNode({ id, type: 'class', name: cls.name, filePath: file.path, lineRange: [cls.startLine, cls.endLine], summary: classSummary(cls.name), tags: classTags(cls.name, file.path), complexity: complexity(length) });
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

const batchPaths = new Set(batch.files.map((file) => file.path));
const localPairs = [
  'src/Lively/Lively/Views/BlankWindow.xaml.cs',
  'src/Lively/Lively/Views/DebugLog.xaml.cs',
  'src/Lively/Lively/Views/DiagnosticMenu.xaml.cs',
  'src/Lively/Lively/Views/LibraryPreview.xaml.cs',
  'src/Lively/Lively/Views/ScreenSaverPreview.xaml.cs',
  'src/Lively/Lively/Views/SplashWindow.xaml.cs',
];
for (const sourcePath of localPairs) {
  const targetPath = sourcePath.slice(0, -3);
  if (!batchPaths.has(sourcePath) || !batchPaths.has(targetPath)) throw new Error(`缺少 XAML 配对: ${sourcePath}`);
  addEdge({ source: `file:${sourcePath}`, target: `file:${targetPath}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
}
for (const file of batch.files) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: `file:${target}`, type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5 };
if (nodes.length !== 123) throw new Error(`节点数异常: ${nodes.length}/123`);
if (edges.length !== 159) throw new Error(`边数异常: ${edges.length}/159`);
const fileNodes = nodes.filter((node) => node.type === 'file');
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
const expectedImports = batch.files.reduce((sum, file) => sum + (batch.batchImportData[file.path] ?? []).length, 0);
const actualImports = edges.filter((edge) => edge.type === 'imports').length;
if (expectedImports !== actualImports) throw new Error(`imports 边不匹配: ${expectedImports}/${actualImports}`);

const partCount = Math.ceil(Math.max(nodes.length / 60, edges.length / 120));
if (partCount !== 3) throw new Error(`分片数异常: ${partCount}/3`);
const sortedFiles = [...batch.files].sort((a, b) => a.path.localeCompare(b.path));
const groupSize = Math.ceil(sortedFiles.length / partCount);
const parts = []; let totalNodes = 0, totalEdges = 0;
for (let index = 0; index < partCount; index += 1) {
  const fileGroup = sortedFiles.slice(index * groupSize, (index + 1) * groupSize);
  const paths = new Set(fileGroup.map((file) => file.path));
  const partNodes = nodes.filter((node) => paths.has(node.filePath));
  const partIds = new Set(partNodes.map((node) => node.id));
  const partEdges = edges.filter((edge) => partIds.has(edge.source));
  for (const edge of partEdges) if (!partIds.has(edge.source) || !partIds.has(edge.target)) throw new Error(`分片 ${index + 1} 边端点不在本分片: ${edge.source} -> ${edge.target}`);
  const outputPath = path.join(uaDir, 'intermediate', `batch-27-part-${index + 1}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)}\n`, 'utf8');
  totalNodes += partNodes.length; totalEdges += partEdges.length;
  parts.push({ outputPath, files: fileGroup.length, nodes: partNodes.length, edges: partEdges.length });
}
if (totalNodes !== nodes.length || totalEdges !== edges.length) throw new Error(`分片汇总不匹配: ${totalNodes}/${nodes.length} nodes, ${totalEdges}/${edges.length} edges`);
console.log(JSON.stringify({ parts, totals: { nodes: totalNodes, edges: totalEdges }, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
