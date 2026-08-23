import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const uaDir = path.join(projectRoot, '.ua');
const batchIndex = 12;
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8'));
const batch = batches.batches.find((item) => item.batchIndex === batchIndex);
const extracted = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-12.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始 batchIndex 12');
if (!extracted.scriptCompleted) throw new Error('batch 12 结构提取未成功完成');

const expectedPaths = batch.files.map((file) => file.path);
const extractedByPath = new Map(extracted.results.map((result) => [result.path, result]));
const skipped = new Set(extracted.filesSkipped || []);
for (const filePath of expectedPaths) {
  if (!extractedByPath.has(filePath) && !skipped.has(filePath)) throw new Error(`结构结果缺失: ${filePath}`);
  if (!fs.existsSync(path.join(projectRoot, filePath))) throw new Error(`批次文件不存在: ${filePath}`);
}

const summaries = new Map([
  ['src/Lively/Lively.Player.CefSharp/Extensions/CefSharp/DevTools/DevToolsExtensions.cs', '封装 CefSharp DevTools 截图流程，可把页面捕获为 PNG、JPEG 或 WebP 数据并写入目标文件。'],
  ['src/Lively/Lively.Player.CefSharp/Extensions/CefSharp/DevTools/TaskMethodDevToolsMessageObserver.cs', '把 CefSharp DevTools 方法回执适配为可等待的 Task，并在消息标识匹配时完成异步调用。'],
  ['src/Lively/Lively.Player.CefSharp/Extensions/CefSharp/MenuHandler.cs', '实现 CefSharp 上下文菜单处理器，清空默认菜单并拒绝自定义菜单命令。'],
  ['src/Lively/Lively.Player.CefSharp/Extensions/CefSharp/PopUpHandle.cs', '实现 CefSharp 生命周期处理器，拦截并阻止浏览内容创建新的弹出窗口。'],
  ['src/Lively/Lively.Player.CefSharp/Extensions/CefSharp/YoutubeRequestHandler.cs', '为 YouTube 页面请求选择专用资源处理器，使资源加载阶段能够应用定制策略。'],
  ['src/Lively/Lively.Player.CefSharp/Extensions/CefSharp/YoutubeResourceRequestHandler.cs', '在 YouTube 资源请求发送前执行定制处理，作为 CefSharp 请求管线的轻量扩展点。'],
  ['src/Lively/Lively.Player.CefSharp/Form1.Designer.cs', '由 WinForms 设计器生成 CefSharp 播放器窗体的组件容器、生命周期清理和基础控件初始化代码。'],
  ['src/Lively/Lively.Player.CefSharp/Form1.cs', '实现 CefSharp 动态壁纸播放器主窗体，负责启动参数、父进程 IPC、浏览器初始化、属性恢复、系统服务桥接及渲染暂停恢复。'],
  ['src/Lively/Lively.Player.CefSharp/Form1.resx', '提供 CefSharp WinForms 主窗体的 RESX 资源容器；当前仅包含标准资源头，未定义额外窗体资源。'],
  ['src/Lively/Lively.Player.CefSharp/Lively.Player.CefSharp.csproj', '配置 .NET Framework 4.7.2 WinExe 的 CefSharp 播放器项目，并引用公共服务、模型、CefSharp.WinForms 与 CommandLineParser。'],
  ['src/Lively/Lively.Player.CefSharp/Program.cs', '作为 CefSharp 播放器入口点，初始化 WinForms 运行环境、解析启动参数并启动主窗体。'],
  ['src/Lively/Lively.Player.CefSharp/Properties/AssemblyInfo.cs', '声明 CefSharp 播放器程序集的标题、版本、可见性和产品元数据。'],
  ['src/Lively/Lively.Player.CefSharp/Properties/Resources.Designer.cs', '由资源工具生成 CefSharp 播放器的强类型 ResourceManager 与 Culture 访问入口。'],
  ['src/Lively/Lively.Player.CefSharp/Properties/Resources.resx', '定义 CefSharp 播放器的 RESX 资源清单；当前仅保留标准资源头和读写器信息。'],
  ['src/Lively/Lively.Player.CefSharp/Properties/Settings.Designer.cs', '由设置工具生成 CefSharp 播放器的强类型默认设置访问器。'],
  ['src/Lively/Lively.Player.CefSharp/Properties/Settings.settings', '定义 CefSharp 播放器的 Visual Studio 设置架构；当前默认配置不包含持久化设置项。'],
  ['src/Lively/Lively.Player.CefSharp/StartArgs.cs', '声明 CefSharp 播放器支持的命令行参数，包括 URL、属性文件、显示器、几何范围、可视化、缓存、调试、音量和主题选项。'],
  ['src/Lively/Lively.Player.CefSharp/app.manifest', '声明 CefSharp 播放器以 asInvoker 权限运行，并启用长路径等 Windows 应用兼容能力。'],
  ['src/Lively/Lively.Player.Vlc/App.config', '配置 VLC 播放器使用 .NET Framework 4.7.2，并启用 PerMonitorV2 高 DPI 感知。'],
  ['src/Lively/Lively.Player.Vlc/Form1.Designer.cs', '由 WinForms 设计器生成 VLC 播放器窗体的视频视图、占位图像和组件生命周期代码。'],
  ['src/Lively/Lively.Player.Vlc/Form1.cs', '实现基于 LibVLCSharp 的媒体壁纸播放器主窗体，负责播放控制、缩放、截图、属性应用、父进程 IPC 与错误处理。'],
  ['src/Lively/Lively.Player.Vlc/Form1.resx', '提供 VLC WinForms 主窗体的 RESX 资源容器；当前仅包含标准资源头，未定义额外窗体资源。'],
  ['src/Lively/Lively.Player.Vlc/Lively.Player.Vlc.csproj', '配置 .NET Framework 4.7.2 WinExe 的 VLC 播放器项目，并引用公共模型、LibVLCSharp.WinForms 与 VideoLAN Windows 运行库。'],
  ['src/Lively/Lively.Player.Vlc/Program.cs', '作为 VLC 播放器入口点，初始化 WinForms 环境并启动媒体播放主窗体。'],
  ['src/Lively/Lively.Player.Vlc/Properties/AssemblyInfo.cs', '声明 VLC 播放器程序集的标题、版本、可见性和产品元数据。'],
]);

function nodeType(file) {
  if (file.fileCategory === 'config') return 'config';
  if (file.fileCategory === 'docs') return 'document';
  return 'file';
}
function nodeId(file) { return `${nodeType(file)}:${file.path}`; }
function complexity(lines) { return lines < 50 ? 'simple' : lines <= 200 ? 'moderate' : 'complex'; }

function fileTags(file) {
  const p = file.path;
  const base = path.posix.basename(p);
  if (base.endsWith('.csproj')) return ['configuration', 'build-system', '.net-framework', p.includes('CefSharp') ? 'cefsharp' : 'libvlc'];
  if (base.endsWith('.resx')) return ['资源文件', 'winforms', 'resx', '本地化'];
  if (base === 'App.config') return ['configuration', '.net-framework', 'dpi', 'winforms'];
  if (base === 'app.manifest') return ['应用清单', 'windows', '权限配置', '兼容性'];
  if (base === 'AssemblyInfo.cs') return ['程序集元数据', '版本信息', '.net-framework', '构建配置'];
  if (base === 'Resources.Designer.cs') return ['自动生成', '资源访问', 'resource-manager', '本地化'];
  if (base === 'Settings.Designer.cs' || base === 'Settings.settings') return ['自动生成', '应用设置', 'configuration', '强类型访问'];
  if (base === 'Program.cs') return ['入口点', 'winforms', p.includes('CefSharp') ? 'cefsharp' : 'libvlc', '启动流程'];
  if (base === 'StartArgs.cs') return ['命令行参数', '启动配置', '数据模型', 'validation'];
  if (base === 'Form1.Designer.cs') return ['自动生成', 'winforms', '界面布局', '组件生命周期'];
  if (base === 'Form1.cs') return ['播放器', 'winforms', '进程通信', p.includes('CefSharp') ? 'cefsharp' : 'libvlc'];
  if (p.includes('/DevTools/')) return ['devtools', 'cefsharp', '异步处理', '浏览器集成'];
  if (base.includes('Menu')) return ['事件处理', '上下文菜单', 'cefsharp', '浏览器集成'];
  if (base.includes('PopUp')) return ['事件处理', '弹窗拦截', 'cefsharp', '浏览器集成'];
  if (base.includes('Youtube')) return ['请求处理', 'youtube', 'cefsharp', '网络资源'];
  return ['cefsharp', '浏览器集成', '事件处理', '播放器'];
}

function fileLanguageNotes(file) {
  const base = path.posix.basename(file.path);
  if (base.endsWith('.csproj')) return '旧式 MSBuild 项目使用 TargetFrameworkVersion 指定 .NET Framework 4.7.2，并通过项目引用和 NuGet 包组成播放器运行时。';
  if (base === 'Form1.Designer.cs') return '该 partial class 由 WinForms 设计器维护，InitializeComponent 负责构造控件树。';
  if (base === 'Form1.cs' && file.path.includes('CefSharp')) return 'C# WinForms 事件模型与 CefSharp 异步回调、标准输入输出 IPC 共同驱动播放器生命周期。';
  if (base === 'Form1.cs' && file.path.includes('Vlc')) return 'C# WinForms 通过 LibVLCSharp 包装原生 VLC 播放器，并用 IPC 接收宿主命令。';
  return undefined;
}

function classSummary(filePath, name) {
  if (name === 'DevToolsExtensions') return '提供基于 CefSharp DevTools 协议的异步页面截图扩展。';
  if (name === 'TaskMethodDevToolsMessageObserver') return '观察 DevTools 回执并把指定消息标识的结果转化为 Task 完成状态。';
  if (name === 'MenuHandler') return '控制浏览器上下文菜单的创建、命令、关闭与运行流程。';
  if (name === 'PopUpHandle') return '拦截 CefSharp 弹窗生命周期并阻止新浏览器窗口。';
  if (name === 'YoutubeResourceRequestHandler') return '在 YouTube 资源加载前提供 CefSharp 请求处理钩子。';
  if (name === 'Program') return '承载 WinForms 播放器的静态应用入口。';
  if (name === 'Resources') return '提供当前程序集资源管理器和区域文化的强类型访问。';
  if (name === 'StartArgs') return '聚合 CefSharp 播放器的命令行启动选项。';
  if (name === 'Form1' && filePath.endsWith('.Designer.cs')) return '定义播放器窗体的设计器控件与组件清理逻辑。';
  if (name === 'Form1' && filePath.includes('CefSharp')) return '协调 CefSharp 浏览器、系统信息服务、父进程 IPC 和动态壁纸生命周期。';
  if (name === 'Form1' && filePath.includes('Vlc')) return '协调 LibVLC 媒体播放、图像选项、父进程 IPC 和动态壁纸生命周期。';
  return `封装 ${name} 的播放器集成职责。`;
}

function classTags(filePath, name) {
  if (name === 'Program') return ['入口点', 'winforms', '启动流程', '播放器'];
  if (name === 'Resources') return ['自动生成', '资源访问', 'resource-manager', '本地化'];
  if (name === 'StartArgs') return ['命令行参数', '启动配置', '数据模型', 'validation'];
  if (name === 'Form1') return ['桌面窗口', '播放器', '进程通信', filePath.includes('CefSharp') ? 'cefsharp' : 'libvlc'];
  if (name.includes('DevTools')) return ['devtools', '异步处理', 'cefsharp', 'observer'];
  if (name.includes('Menu')) return ['事件处理', '上下文菜单', 'cefsharp', 'handler'];
  if (name.includes('PopUp')) return ['事件处理', '弹窗拦截', 'cefsharp', 'handler'];
  if (name.includes('Youtube')) return ['请求处理', 'youtube', 'cefsharp', '网络资源'];
  return ['浏览器集成', 'cefsharp', '事件处理', '播放器'];
}

function functionSummary(filePath, name) {
  const cef = filePath.includes('CefSharp');
  const specific = {
    TaskMethodDevToolsMessageObserver: '初始化 DevTools 消息观察器，并记录需要匹配的方法消息标识。',
    OnDevToolsMethodResult: '在收到匹配的 DevTools 方法回执时解析结果并完成等待中的 Task。',
    OnBeforeContextMenu: '在菜单显示前清除 CefSharp 默认上下文菜单项。',
    OnContextMenuCommand: '拒绝处理浏览器上下文菜单命令。',
    OnContextMenuDismissed: '响应上下文菜单关闭通知而不保留额外状态。',
    RunContextMenu: '拒绝运行自定义上下文菜单并保持默认拦截策略。',
    DoClose: '处理浏览器关闭请求并允许 CefSharp 完成关闭。',
    OnAfterCreated: '接收浏览器创建完成通知。',
    OnBeforeClose: '接收浏览器关闭前通知。',
    OnBeforePopup: '拦截弹窗请求并阻止创建新的浏览器窗口。',
    InitializeComponent: '创建并配置 WinForms 控件、布局、事件绑定与组件容器。',
    ListenToParent: '持续读取父进程发送的消息，反序列化后分派播放器控制与属性更新。',
    ProcessMessage: '根据 Lively 消息类型执行暂停、恢复、截图、属性和系统状态等操作。',
    HandleSuspend: '暂停浏览器或播放器渲染，并同步相关系统服务状态。',
    HandleResume: '恢复浏览器或播放器渲染，并重新同步系统服务状态。',
    InitializeCefSharp: '配置 CefSharp 运行时、缓存、调试端口、请求处理器和浏览器事件。',
    ChromeBrowser_LoadingStateChanged: '在页面加载状态变化时注入属性、系统信息、媒体状态和主题数据。',
    ChromeBrowser_IsBrowserInitializedChanged1: '在浏览器初始化完成后设置窗口句柄、渲染进程和初始状态。',
    ChromeBrowser_LoadError: '处理页面加载失败并把错误信息反馈给宿主。',
    SuspendRenderingSubProcess: '挂起 CefSharp D3D 渲染子进程以降低暂停状态下的资源占用。',
    Form1_Shown: '在 VLC 窗体首次显示时准备媒体资源并开始播放。',
    InitializeVlc: '初始化 LibVLC、MediaPlayer、媒体事件和视频输出视图。',
    Play: '恢复或开始媒体播放。',
    Pause: '暂停当前媒体播放。',
    IsPlaying: '返回 LibVLC 媒体播放器的当前播放状态。',
    SetVolume: '把宿主提供的音量应用到媒体播放器。',
    SetScale: '依据缩放策略和窗体尺寸调整视频宽高比与显示比例。',
    SetLivelyProperty: '把动态壁纸属性键值映射到播放、音量、速度、静音、缩放或图像选项。',
    MapWithPivot: '围绕指定枢轴点把数值从源区间分段映射到目标区间。',
    Main: `初始化 ${cef ? 'CefSharp' : 'VLC'} WinForms 播放器并进入应用消息循环。`,
  };
  if (name === 'CaptureScreenshot') return cef && filePath.includes('/DevTools/')
    ? '通过 DevTools Page.captureScreenshot 捕获页面，并把返回的 Base64 图像写入文件。'
    : '调用 LibVLC 视频输出截图并保存到目标路径。';
  if (name === 'Form1') return cef
    ? '解析启动参数、连接宿主 IPC、初始化系统服务并准备 CefSharp 播放器窗体。'
    : '解析启动参数、连接宿主 IPC并准备 LibVLC 播放器窗体与事件。';
  if (name === 'RestoreLivelyProperties') return `从属性文件恢复动态壁纸设置，并应用到 ${cef ? '网页脚本' : 'VLC 播放器'}。`;
  return specific[name] || `处理 ${name} 对应的播放器生命周期或事件流程。`;
}

function functionTags(filePath, name) {
  if (name === 'Main') return ['入口点', 'winforms', '启动流程', '播放器'];
  if (name === 'InitializeComponent') return ['自动生成', 'winforms', '界面布局', '初始化'];
  if (name.includes('DevTools') || filePath.includes('/DevTools/')) return ['devtools', '异步处理', 'cefsharp', '消息观察'];
  if (name.includes('ContextMenu')) return ['事件处理', '上下文菜单', 'cefsharp', 'handler'];
  if (['DoClose', 'OnAfterCreated', 'OnBeforeClose', 'OnBeforePopup'].includes(name)) return ['事件处理', '弹窗拦截', 'cefsharp', 'handler'];
  if (name === 'ListenToParent' || name === 'ProcessMessage') return ['进程通信', '消息分派', '播放器', '事件循环'];
  if (name === 'CaptureScreenshot') return ['截图', filePath.includes('CefSharp') ? 'cefsharp' : 'libvlc', '文件输出', '异步操作'];
  if (filePath.includes('Vlc')) return ['媒体播放', 'libvlc', '播放器控制', 'winforms'];
  return ['浏览器集成', 'cefsharp', '播放器控制', 'winforms'];
}

const nodes = [];
const edges = [];
const significantIds = new Set();
for (const file of batch.files) {
  const result = extractedByPath.get(file.path);
  if (!result) fs.readFileSync(path.join(projectRoot, file.path), 'utf8');
  const id = nodeId(file);
  const fileNode = {
    id,
    type: nodeType(file),
    name: path.posix.basename(file.path),
    filePath: file.path,
    summary: summaries.get(file.path),
    tags: fileTags(file),
    complexity: complexity(result?.nonEmptyLines ?? file.sizeLines),
  };
  const note = fileLanguageNotes(file);
  if (note) fileNode.languageNotes = note;
  if (!fileNode.summary) throw new Error(`缺少文件摘要: ${file.path}`);
  nodes.push(fileNode);
  if (!result) continue;
  const exported = new Set((result.exports || []).map((item) => item.name).filter(Boolean));
  for (const item of (result.classes || []).filter((entry) => entry?.name)) {
    const lines = item.endLine - item.startLine + 1;
    if (lines < 20 && (item.methods || []).length < 2 && !exported.has(item.name)) continue;
    const symbolId = `class:${file.path}:${item.name}`;
    nodes.push({ id: symbolId, type: 'class', name: item.name, filePath: file.path, lineRange: [item.startLine, item.endLine], summary: classSummary(file.path, item.name), tags: classTags(file.path, item.name), complexity: complexity(lines) });
    significantIds.add(symbolId);
    edges.push({ source: id, target: symbolId, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exported.has(item.name)) edges.push({ source: id, target: symbolId, type: 'exports', direction: 'forward', weight: 0.8 });
  }
  const best = new Map();
  for (const item of (result.functions || []).filter((entry) => entry?.name)) {
    const lines = item.endLine - item.startLine + 1;
    if (lines < 10 && !exported.has(item.name)) continue;
    const prior = best.get(item.name);
    if (!prior || lines > prior.endLine - prior.startLine + 1) best.set(item.name, item);
  }
  for (const item of best.values()) {
    const lines = item.endLine - item.startLine + 1;
    const symbolId = `function:${file.path}:${item.name}`;
    nodes.push({ id: symbolId, type: 'function', name: item.name, filePath: file.path, lineRange: [item.startLine, item.endLine], summary: functionSummary(file.path, item.name), tags: functionTags(file.path, item.name), complexity: complexity(lines) });
    significantIds.add(symbolId);
    edges.push({ source: id, target: symbolId, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exported.has(item.name)) edges.push({ source: id, target: symbolId, type: 'exports', direction: 'forward', weight: 0.8 });
  }
  for (const importedPath of batch.batchImportData[file.path] || []) edges.push({ source: id, target: `file:${importedPath}`, type: 'imports', direction: 'forward', weight: 0.7 });
}

// The two project files configure their colocated executable entry points.
for (const project of batch.files.filter((file) => file.path.endsWith('.csproj'))) {
  const programPath = `${path.posix.dirname(project.path)}/Program.cs`;
  if (expectedPaths.includes(programPath)) edges.push({ source: nodeId(project), target: `file:${programPath}`, type: 'configures', direction: 'forward', weight: 0.6 });
}

const nodeCount = nodes.length;
const edgeCount = edges.length;
const partCount = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));
const sortedPaths = [...expectedPaths].sort((a, b) => a.localeCompare(b));
const chunkSize = Math.ceil(sortedPaths.length / partCount);
const parts = [];
for (let index = 0; index < partCount; index += 1) {
  const paths = new Set(sortedPaths.slice(index * chunkSize, (index + 1) * chunkSize));
  if (!paths.size) continue;
  const partNodes = nodes.filter((node) => paths.has(node.filePath));
  const partIds = new Set(partNodes.map((node) => node.id));
  const partEdges = edges.filter((edge) => partIds.has(edge.source));
  parts.push({ nodes: partNodes, edges: partEdges });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const allIds = new Set(nodes.map((node) => node.id));
if (allIds.size !== nodes.length) throw new Error('存在重复节点 ID');
for (const node of nodes) {
  for (const field of ['id', 'type', 'name', 'summary', 'tags', 'complexity']) if (node[field] === undefined || node[field] === null || node[field] === '') throw new Error(`节点 ${node.id} 缺少 ${field}`);
  if (!allowedTypes.has(node.type)) throw new Error(`节点类型非法: ${node.id}`);
  if (!allowedComplexity.has(node.complexity)) throw new Error(`复杂度非法: ${node.id}`);
  if (!Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5) throw new Error(`标签数量非法: ${node.id}`);
  if (['function', 'class'].includes(node.type) && (!Array.isArray(node.lineRange) || node.lineRange.length !== 2)) throw new Error(`缺少 lineRange: ${node.id}`);
}
const fileNodes = nodes.filter((node) => !['function', 'class'].includes(node.type));
if (fileNodes.length !== expectedPaths.length) throw new Error(`文件节点数不匹配: ${fileNodes.length}/${expectedPaths.length}`);
for (const filePath of expectedPaths) if (fileNodes.filter((node) => node.filePath === filePath).length !== 1) throw new Error(`文件覆盖错误: ${filePath}`);
for (const edge of edges) {
  if (edge.source === edge.target) throw new Error(`自引用边: ${edge.source}`);
  if (!allIds.has(edge.source)) throw new Error(`边源不存在: ${edge.source}`);
  if (!allIds.has(edge.target) && edge.type !== 'imports') throw new Error(`边目标不存在: ${edge.target}`);
}
const expectedImports = batch.files.filter((file) => file.fileCategory === 'code').reduce((sum, file) => sum + (batch.batchImportData[file.path] || []).length, 0);
const actualImports = edges.filter((edge) => edge.type === 'imports').length;
if (actualImports !== expectedImports) throw new Error(`imports 数量不匹配: ${actualImports}/${expectedImports}`);

const expectedSignificant = new Set();
for (const file of batch.files) {
  const result = extractedByPath.get(file.path);
  if (!result) continue;
  const exported = new Set((result.exports || []).map((item) => item.name).filter(Boolean));
  for (const item of (result.classes || []).filter((entry) => entry?.name)) {
    const lines = item.endLine - item.startLine + 1;
    if (lines >= 20 || (item.methods || []).length >= 2 || exported.has(item.name)) expectedSignificant.add(`class:${file.path}:${item.name}`);
  }
  for (const item of (result.functions || []).filter((entry) => entry?.name)) {
    const lines = item.endLine - item.startLine + 1;
    if (lines >= 10 || exported.has(item.name)) expectedSignificant.add(`function:${file.path}:${item.name}`);
  }
}
for (const id of expectedSignificant) if (!significantIds.has(id)) throw new Error(`遗漏显著符号: ${id}`);

parts.forEach((fragment, index) => {
  const ids = new Set(fragment.nodes.map((node) => node.id));
  for (const edge of fragment.edges) {
    if (!ids.has(edge.source)) throw new Error(`part ${index + 1} 边源不在本 part: ${edge.source}`);
    if (!ids.has(edge.target) && edge.type !== 'imports') throw new Error(`part ${index + 1} 边目标不在本 part: ${edge.target}`);
  }
  const output = path.join(uaDir, 'intermediate', `batch-12-part-${index + 1}.json`);
  fs.writeFileSync(output, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8');
  JSON.parse(fs.readFileSync(output, 'utf8'));
});

console.log(JSON.stringify({ batchIndex, files: expectedPaths.length, skippedFiles: [...skipped], nodes: nodeCount, edges: edgeCount, importsExpected: expectedImports, importsActual: actualImports, parts: parts.map((part, index) => ({ file: `batch-12-part-${index + 1}.json`, nodes: part.nodes.length, edges: part.edges.length })) }, null, 2));
