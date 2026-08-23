import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const uaDir = path.join(projectRoot, '.ua');
const batchIndex = 13;
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8'));
const batch = batches.batches.find((item) => item.batchIndex === batchIndex);
const extracted = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-13.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始 batchIndex 13');
if (!extracted.scriptCompleted) throw new Error('batch 13 结构提取未成功完成');

const expectedPaths = batch.files.map((file) => file.path);
const extractedByPath = new Map(extracted.results.map((result) => [result.path, result]));
const skipped = new Set(extracted.filesSkipped || []);
for (const filePath of expectedPaths) {
  if (!extractedByPath.has(filePath) && !skipped.has(filePath)) throw new Error(`结构结果缺失: ${filePath}`);
  if (!fs.existsSync(path.join(projectRoot, filePath))) throw new Error(`批次文件不存在: ${filePath}`);
}

const summaries = new Map([
  ['src/Lively/Lively.Player.Vlc/Properties/Resources.Designer.cs', '由资源工具生成 VLC 播放器的强类型 ResourceManager、Culture 与加载图标访问入口。'],
  ['src/Lively/Lively.Player.Vlc/Properties/Resources.resx', '定义 VLC 播放器资源清单，并保存播放器加载状态使用的图标资源。'],
  ['src/Lively/Lively.Player.Vlc/Properties/Settings.Designer.cs', '由设置工具生成 VLC 播放器的强类型默认设置访问器。'],
  ['src/Lively/Lively.Player.Vlc/Properties/Settings.settings', '定义 VLC 播放器的 Visual Studio 设置架构；当前默认配置不包含持久化设置项。'],
  ['src/Lively/Lively.Player.Vlc/StartArgs.cs', '声明 VLC 播放器支持的命令行参数，包括媒体路径、音量、硬件解码、属性文件、几何范围、主题与日志选项。'],
  ['src/Lively/Lively.Player.Vlc/app.manifest', '声明 VLC 播放器以 asInvoker 权限运行，并启用长路径等 Windows 应用兼容能力。'],
  ['src/Lively/Lively.Player.WebView2/App.config', '配置 WebView2 播放器使用 .NET Framework 4.7.2，并启用 PerMonitorV2 高 DPI 感知。'],
  ['src/Lively/Lively.Player.WebView2/Extensions/WebView2/CoreWebView2Extensions.cs', '为 WebView2 提供本地路径导航、JavaScript 函数调用、媒体暂停恢复、主题映射及 Chromium 渲染窗口识别等扩展。'],
  ['src/Lively/Lively.Player.WebView2/Extensions/WebView2/DevToolsExtensions.cs', '封装 WebView2 DevTools 页面截图流程，可按指定格式捕获内容并写入目标文件。'],
  ['src/Lively/Lively.Player.WebView2/Form1.Designer.cs', '由 WinForms 设计器生成 WebView2 播放器窗体的组件容器、清理逻辑和基础初始化代码。'],
  ['src/Lively/Lively.Player.WebView2/Form1.cs', '实现 WebView2 动态壁纸播放器主窗体，负责运行时初始化、网页导航、父进程 IPC、属性恢复、系统服务桥接及渲染暂停恢复。'],
  ['src/Lively/Lively.Player.WebView2/Form1.resx', '提供 WebView2 WinForms 主窗体的 RESX 资源容器；当前仅包含标准资源头。'],
  ['src/Lively/Lively.Player.WebView2/Lively.Player.WebView2.csproj', '配置 .NET Framework 4.7.2 WinExe 的 WebView2 播放器项目，并引用公共服务、模型、CommandLineParser 与 Microsoft.Web.WebView2。'],
  ['src/Lively/Lively.Player.WebView2/Program.cs', '作为 WebView2 播放器入口点，检测 WebView2 Runtime 可用性并启动 WinForms 主窗体。'],
  ['src/Lively/Lively.Player.WebView2/Properties/AssemblyInfo.cs', '声明 WebView2 播放器程序集的标题、版本、可见性和产品元数据。'],
  ['src/Lively/Lively.Player.WebView2/Properties/Resources.Designer.cs', '由资源工具生成 WebView2 播放器的强类型 ResourceManager 与 Culture 访问入口。'],
  ['src/Lively/Lively.Player.WebView2/Properties/Resources.resx', '定义 WebView2 播放器的 RESX 资源清单；当前仅保留标准资源头和读写器信息。'],
  ['src/Lively/Lively.Player.WebView2/Properties/Settings.Designer.cs', '由设置工具生成 WebView2 播放器的强类型默认设置访问器。'],
  ['src/Lively/Lively.Player.WebView2/Properties/Settings.settings', '定义 WebView2 播放器的 Visual Studio 设置架构；当前默认配置不包含持久化设置项。'],
  ['src/Lively/Lively.Player.WebView2/StartArgs.cs', '声明 WebView2 播放器的 URL、显示器、缩放、可视化、用户数据目录、调试、音量、媒体暂停与主题等启动参数。'],
  ['src/Lively/Lively.Player.WebView2/app.manifest', '声明 WebView2 播放器以 asInvoker 权限运行，并启用长路径等 Windows 应用兼容能力。'],
  ['src/Lively/Lively.Player.Wmf/App.config', '配置 WPF/WMF 播放器使用 .NET Framework 4.7.2。'],
  ['src/Lively/Lively.Player.Wmf/App.xaml', '声明 WPF 播放器应用资源根，并把启动事件绑定到 Application_Startup。'],
  ['src/Lively/Lively.Player.Wmf/App.xaml.cs', '实现 WPF 播放器应用启动、会话结束拦截、全局异常记录和向父进程发送错误消息的逻辑。'],
  ['src/Lively/Lively.Player.Wmf/Lively.Player.Wmf.csproj', '配置 .NET Framework 4.7.2 WinExe 的 WPF/WMF 播放器项目，并引用公共模型、Newtonsoft.Json 与 WPF 框架程序集。'],
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
  if (base.endsWith('.csproj')) return ['configuration', 'build-system', '.net-framework', p.includes('WebView2') ? 'webview2' : 'wpf'];
  if (base.endsWith('.resx')) return ['资源文件', '本地化', 'resx', p.includes('Vlc') ? 'libvlc' : 'webview2'];
  if (base === 'App.config') return ['configuration', '.net-framework', '运行时配置', p.includes('Wmf') ? 'wpf' : 'webview2'];
  if (base === 'App.xaml') return ['xaml', '应用资源', '启动配置', 'wpf'];
  if (base === 'App.xaml.cs') return ['入口生命周期', '异常处理', '进程通信', 'wpf'];
  if (base === 'app.manifest') return ['应用清单', 'windows', '权限配置', '兼容性'];
  if (base === 'AssemblyInfo.cs') return ['程序集元数据', '版本信息', '.net-framework', '构建配置'];
  if (base === 'Resources.Designer.cs') return ['自动生成', '资源访问', 'resource-manager', '本地化'];
  if (base === 'Settings.Designer.cs' || base === 'Settings.settings') return ['自动生成', '应用设置', 'configuration', '强类型访问'];
  if (base === 'StartArgs.cs') return ['命令行参数', '启动配置', '数据模型', 'validation'];
  if (base === 'Program.cs') return ['入口点', 'winforms', 'webview2', '运行时检测'];
  if (base === 'Form1.Designer.cs') return ['自动生成', 'winforms', '界面布局', '组件生命周期'];
  if (base === 'Form1.cs') return ['播放器', 'webview2', '进程通信', 'winforms'];
  if (p.includes('/DevTools/')) return ['devtools', 'webview2', '截图', '异步操作'];
  if (base.includes('CoreWebView2Extensions')) return ['extension-method', 'webview2', 'javascript', '窗口集成'];
  return ['播放器', 'webview2', '浏览器集成', '事件处理'];
}

function languageNotes(file) {
  const base = path.posix.basename(file.path);
  if (base.endsWith('.csproj')) return '旧式 MSBuild 项目以 TargetFrameworkVersion 指定 .NET Framework 4.7.2，并通过项目引用与 NuGet 包组合播放器运行时。';
  if (base === 'Form1.Designer.cs') return '该 partial class 由 WinForms 设计器维护，InitializeComponent 负责构造窗体组件。';
  if (base === 'Form1.cs') return 'C# WinForms 事件模型与 WebView2 异步初始化、浏览器事件和标准输入输出 IPC 共同驱动播放器。';
  if (base === 'App.xaml') return 'XAML 通过 x:Class 与 App.xaml.cs 配对，并用 Startup 事件进入应用启动逻辑。';
  return undefined;
}

function classSummary(filePath, name) {
  if (name === 'Resources') return '提供当前播放器程序集资源管理器、区域文化及强类型资源访问。';
  if (name === 'StartArgs') return `聚合 ${filePath.includes('Vlc') ? 'VLC' : 'WebView2'} 播放器的命令行启动选项。`;
  if (name === 'CoreWebView2Extensions') return '汇集 WebView2 导航、脚本、媒体控制、主题与 Chromium 窗口查询的扩展方法。';
  if (name === 'DevToolsExtensions') return '提供基于 WebView2 DevTools 协议的异步页面截图扩展。';
  if (name === 'Form1' && filePath.endsWith('.Designer.cs')) return '定义 WebView2 播放器窗体的设计器组件与清理逻辑。';
  if (name === 'Form1') return '协调 WebView2 运行时、系统服务、父进程 IPC 和动态壁纸生命周期。';
  if (name === 'Program') return '承载 WebView2 Runtime 检测与 WinForms 应用入口。';
  if (name === 'App') return '协调 WPF 播放器应用启动、会话结束和全局异常处理。';
  return `封装 ${name} 的播放器集成职责。`;
}

function classTags(filePath, name) {
  if (name === 'Resources') return ['自动生成', '资源访问', 'resource-manager', '本地化'];
  if (name === 'StartArgs') return ['命令行参数', '启动配置', '数据模型', 'validation'];
  if (name === 'CoreWebView2Extensions' || name === 'DevToolsExtensions') return ['extension-method', 'webview2', '浏览器集成', '异步操作'];
  if (name === 'Form1') return ['桌面窗口', '播放器', '进程通信', 'webview2'];
  if (name === 'Program') return ['入口点', 'winforms', 'webview2', '运行时检测'];
  if (name === 'App') return ['应用生命周期', '异常处理', '进程通信', 'wpf'];
  return ['播放器', 'webview2', '事件处理', '桌面应用'];
}

function functionSummary(filePath, name) {
  const specific = {
    NavigateToLocalPath: '把本地文件路径转换为 WebView2 可导航的 URI 并加载内容。',
    ExecuteScriptFunctionAsync: '序列化函数参数并在 WebView2 页面上下文中异步调用指定 JavaScript 函数。',
    TryPauseMedia: '尝试执行脚本以暂停网页中的视频和音频媒体。',
    TryPlayMedia: '尝试执行脚本以恢复网页中的视频和音频媒体。',
    TryHideShaderToyGui: '尝试注入脚本隐藏 ShaderToy 页面界面控件。',
    GetPreferredColorScheme: '把 Lively 应用主题映射为网页首选配色方案。',
    TryGetChrome_WidgetWin_0: '尝试从 WebView2 控件定位 Chrome_WidgetWin_0 子窗口。',
    TryGetIntermediateD3DWindow: '尝试定位 WebView2 渲染链中的 Intermediate D3D Window。',
    TryGetCefD3DRenderingSubProcessId: '尝试解析 WebView2 Chromium D3D 渲染子进程标识。',
    InitializeComponent: '创建并配置 WebView2 WinForms 窗体的组件、布局和事件绑定。',
    Form1: '解析启动参数、连接宿主 IPC、初始化系统服务并准备 WebView2 播放器窗体。',
    InitializeWebView2Async: '创建 WebView2 环境，配置用户数据、调试与浏览器设置，并导航到目标内容。',
    CoreWebView2_NewWindowRequested: '拦截网页新窗口请求并在当前播放器策略下处理目标地址。',
    WebView_NavigationCompleted: '在导航完成后恢复壁纸属性、注入系统状态与主题，并同步媒体控制。',
    SuspendRenderingSubProcess: '挂起 WebView2 Chromium 渲染子进程以降低暂停状态下的资源占用。',
    ListenToParent: '持续读取父进程消息，反序列化并分派播放器控制与属性更新。',
    ProcessMessage: '根据 Lively 消息类型执行暂停、恢复、截图、属性和系统状态等操作。',
    HandleSuspend: '暂停 WebView2 媒体或渲染，并同步相关系统服务状态。',
    HandleResume: '恢复 WebView2 媒体或渲染，并重新同步系统服务状态。',
    RestoreLivelyProperties: '从属性文件恢复动态壁纸设置，并调用网页脚本应用各项值。',
    Main: '检测 WebView2 Runtime 后初始化 WinForms 播放器并进入应用消息循环。',
    IsWebView2Available: '查询已安装 WebView2 Runtime 版本，判断播放器能否启动。',
    Application_Startup: '注册会话结束与异常处理，使用启动参数创建并显示 WPF 主窗口。',
    SetupUnhandledExceptionLogging: '为 AppDomain、Dispatcher 和 TaskScheduler 注册未处理异常监听。',
    WriteToParent: '把 IPC 消息序列化为 JSON 并写入标准输出发送给父进程。',
  };
  if (name === 'CaptureScreenshot') return '通过 WebView2 DevTools 截取页面内容，并把图像数据写入目标文件。';
  return specific[name] || `处理 ${name} 对应的播放器生命周期或事件流程。`;
}

function functionTags(filePath, name) {
  if (name === 'Main' || name === 'IsWebView2Available') return ['入口点', '运行时检测', 'webview2', 'winforms'];
  if (name === 'InitializeComponent') return ['自动生成', 'winforms', '界面布局', '初始化'];
  if (filePath.includes('CoreWebView2Extensions') || filePath.includes('DevToolsExtensions')) return ['extension-method', 'webview2', '浏览器集成', '异步操作'];
  if (name === 'ListenToParent' || name === 'ProcessMessage' || name === 'WriteToParent') return ['进程通信', '消息分派', '播放器', 'json'];
  if (filePath.endsWith('App.xaml.cs')) return ['应用生命周期', '异常处理', 'wpf', '事件处理'];
  return ['播放器控制', 'webview2', 'winforms', '事件处理'];
}

const nodes = [];
const edges = [];
const significantIds = new Set();
for (const file of batch.files) {
  const result = extractedByPath.get(file.path);
  if (!result) fs.readFileSync(path.join(projectRoot, file.path), 'utf8');
  const id = nodeId(file);
  const fileNode = { id, type: nodeType(file), name: path.posix.basename(file.path), filePath: file.path, summary: summaries.get(file.path), tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines) };
  const note = languageNotes(file);
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

// These relationships remain within the second split fragment.
const appXaml = batch.files.find((file) => file.path === 'src/Lively/Lively.Player.Wmf/App.xaml');
const appCode = 'src/Lively/Lively.Player.Wmf/App.xaml.cs';
if (appXaml && expectedPaths.includes(appCode)) edges.push({ source: nodeId(appXaml), target: `file:${appCode}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
const wmfProject = batch.files.find((file) => file.path === 'src/Lively/Lively.Player.Wmf/Lively.Player.Wmf.csproj');
if (wmfProject && expectedPaths.includes(appCode)) edges.push({ source: nodeId(wmfProject), target: `file:${appCode}`, type: 'configures', direction: 'forward', weight: 0.6 });

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
  const output = path.join(uaDir, 'intermediate', `batch-13-part-${index + 1}.json`);
  fs.writeFileSync(output, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8');
  JSON.parse(fs.readFileSync(output, 'utf8'));
});

console.log(JSON.stringify({ batchIndex, files: expectedPaths.length, skippedFiles: [...skipped], nodes: nodeCount, edges: edgeCount, importsExpected: expectedImports, importsActual: actualImports, parts: parts.map((part, index) => ({ file: `batch-13-part-${index + 1}.json`, nodes: part.nodes.length, edges: part.edges.length })) }, null, 2));
