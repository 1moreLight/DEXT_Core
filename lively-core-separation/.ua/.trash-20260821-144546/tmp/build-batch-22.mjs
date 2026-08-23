import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 22);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-22.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 22');
if (!extraction.scriptCompleted) throw new Error('批次 22 的官方结构提取未完成');

const viewPurposes = {
  SettingsGeneralView: '通用设置页，用于管理语言、主题及常规应用行为',
  SettingsPerformanceView: '性能设置页，用于配置暂停策略、硬件加速与节能行为',
  SettingsScreensaverView: '屏幕保护设置页，用于配置模式、空闲触发与锁屏选项',
  SettingsSystemView: '系统设置页，用于管理系统集成、启动与运行选项',
  SettingsWallpaperView: '壁纸设置页，用于配置播放器、布局、缩放与质量选项',
  TrayMenuHelp: '托盘菜单帮助页，用于集中展示帮助与项目链接',
};

const exactFileSummaries = {
  'src/Lively/Lively.UI.WinUI/app.manifest': '声明 WinUI 前端进程的 Windows 应用清单，配置执行级别、兼容性和系统感知能力。',
  'src/Lively/Lively.Utility.Commandline/Lively.Utility.Commandline.csproj': '定义 Lively 命令行工具的 MSBuild 项目、目标框架及对共享库和 gRPC 客户端的引用。',
  'src/Lively/Lively.Utility.Commandline/Program.cs': '提供 Lively 自动化命令行入口，解析壁纸、屏保和截图选项，并将原始参数转发给正在运行的核心进程。',
  'src/Lively/Lively.Utility.ConsoleDemo/Lively.Utility.ConsoleDemo.csproj': '定义 gRPC 控制台演示程序的 MSBuild 项目及其共享模型和客户端依赖。',
  'src/Lively/Lively.Utility.ConsoleDemo/Program.cs': '实现交互式控制台演示，通过 Lively gRPC 客户端查询屏幕和设置、切换壁纸、启动屏保并关闭核心。',
  'src/Lively/Lively.Utility.Screensaver/App.config': '配置传统 .NET 屏幕保护启动器的运行时版本与兼容启动策略。',
  'src/Lively/Lively.Utility.Screensaver/Com/ApplicationActivationManager.cs': '声明 Windows ApplicationActivationManager 的 COM 运行时类，用于按 AUMID 激活 Lively 应用。',
  'src/Lively/Lively.Utility.Screensaver/Com/IApplicationActivationManager.cs': '定义 ApplicationActivationManager 的 COM 接口和 ActivateOptions 标志，描述应用、文件与协议激活契约。',
  'src/Lively/Lively.Utility.Screensaver/Lively.Utility.Screensaver.csproj': '定义 Windows .scr 屏幕保护启动器的 MSBuild 项目、部署属性和所需共享引用。',
  'src/Lively/Lively.Utility.Screensaver/Program.cs': '实现 Windows 屏幕保护启动器入口，解析 /s、/p、/c 参数并通过 COM 激活 Lively 的屏保模式。',
  'src/Lively/Lively.Utility.Screensaver/Properties/AssemblyInfo.cs': '保存屏幕保护启动器的程序集标题、版本、COM 可见性和产品元数据。',
  'src/Lively/Lively.Utility.Watchdog/App.config': '配置看门狗进程使用的传统 .NET 运行时版本。',
  'src/Lively/Lively.Utility.Watchdog/Lively.Utility.Watchdog.csproj': '定义 Lively 看门狗可执行程序的 MSBuild 项目、目标框架与发布属性。',
  'src/Lively/Lively.Utility.Watchdog/Program.cs': '监控 Lively 父进程及外部壁纸进程；父进程异常退出后清理子进程并强制刷新桌面壁纸。',
};

const classSummaries = {
  SettingsGeneralView: '承载通用设置页面，并在离开页面时解绑视图模型状态。',
  SettingsPerformanceView: '承载性能与播放策略设置，并连接 XAML 控件和设置视图模型。',
  SettingsScreensaverView: '承载屏幕保护设置，并连接 XAML 控件和屏保设置视图模型。',
  SettingsSystemView: '承载系统集成设置，并连接 XAML 控件和系统设置视图模型。',
  SettingsWallpaperView: '协调壁纸设置页的视图模型变更，并将当前配置项滚动到可见区域。',
  TrayMenuHelp: '承载托盘帮助界面并初始化相应的 XAML 内容。',
  ApplicationActivationManager: '映射 Windows ApplicationActivationManager COM 类，向托管代码暴露应用、文件和协议激活方法。',
  IApplicationActivationManager: '描述 Windows 应用激活 COM 接口，约束按 AUMID、文件或协议启动应用的调用形式。',
};

function fileId(file) {
  return `${file.fileCategory === 'config' ? 'config' : 'file'}:${file.path}`;
}

function complexity(lines) {
  if (lines > 200) return 'complex';
  if (lines >= 50) return 'moderate';
  return 'simple';
}

function viewName(filePath) {
  return path.basename(filePath).replace(/\.xaml\.cs$/i, '').replace(/\.xaml$/i, '');
}

function fileSummary(file) {
  if (exactFileSummaries[file.path]) return exactFileSummaries[file.path];
  const name = viewName(file.path);
  const purpose = viewPurposes[name];
  if (purpose && file.path.endsWith('.xaml')) return `以 WinUI XAML 定义${purpose}的视觉结构、数据绑定和交互控件。`;
  if (purpose && file.path.endsWith('.xaml.cs')) return `实现${purpose}的代码隐藏层，负责初始化和页面级事件衔接。`;
  return `为 ${path.basename(file.path)} 提供项目所需的配置或运行逻辑。`;
}

function fileTags(file) {
  if (file.path.endsWith('.csproj')) return ['msbuild', '项目配置', '构建系统'];
  if (file.path.endsWith('.xaml')) return ['xaml', 'winui', '设置界面'];
  if (file.path.endsWith('.xaml.cs')) return ['csharp', '代码隐藏', '设置界面'];
  if (file.path.endsWith('app.manifest')) return ['windows', '应用清单', '兼容性'];
  if (file.path.endsWith('App.config')) return ['dotnet', '运行时配置', '兼容性'];
  if (file.path.includes('/Com/')) return ['csharp', 'com-interop', '应用激活'];
  if (file.path.includes('Screensaver')) return ['csharp', '屏幕保护', 'windows'];
  if (file.path.includes('Watchdog')) return ['csharp', '看门狗', '进程管理'];
  if (file.path.includes('ConsoleDemo')) return ['csharp', 'grpc', '示例程序'];
  if (file.path.includes('Commandline')) return ['csharp', '命令行', '自动化'];
  return ['csharp', '程序集元数据', '配置'];
}

function languageNotes(file) {
  if (file.path.endsWith('.csproj')) return '使用 SDK 风格 MSBuild XML 描述目标框架、项目引用和生成属性。';
  if (file.path.endsWith('.xaml')) return '使用 WinUI XAML 的控件层级、资源引用和数据绑定声明设置界面。';
  if (file.path.endsWith('.xaml.cs')) return 'C# partial 类作为对应 XAML 页面的代码隐藏层。';
  if (file.path.includes('/Com/')) return '通过 ComImport、Guid 和 InterfaceType 特性映射 Windows COM ABI。';
  return undefined;
}

function classSummary(name, filePath) {
  if (classSummaries[name]) return classSummaries[name];
  if (name === 'Program' && filePath.includes('Commandline')) return '组织命令行选项解析与自动化命令转发，是命令行工具的进程入口类。';
  if (name === 'Program' && filePath.includes('ConsoleDemo')) return '组织交互式 gRPC 演示菜单和客户端调用，是控制台示例的入口类。';
  if (name === 'Program' && filePath.includes('Screensaver')) return '组织 .scr 参数解析、安装路径查找、系统锁定检测和 Lively 应用激活。';
  if (name === 'Program' && filePath.includes('Watchdog')) return '维护受监控进程集合，在父进程退出后终止残留壁纸与 UI 进程。';
  return `封装 ${name} 的主要职责和相关运行状态。`;
}

function classTags(name, filePath) {
  if (name.startsWith('IApplication')) return ['interface', 'com-interop', '应用激活'];
  if (name === 'ApplicationActivationManager') return ['class', 'com-interop', '应用激活'];
  if (name === 'Program' && filePath.includes('Watchdog')) return ['class', '入口点', '进程管理'];
  if (name === 'Program' && filePath.includes('Screensaver')) return ['class', '入口点', '屏幕保护'];
  if (name === 'Program') return ['class', '入口点', filePath.includes('ConsoleDemo') ? 'grpc' : '命令行'];
  return ['class', 'winui', '页面组件'];
}

function functionSummary(name, filePath, ownerClass) {
  if (name === ownerClass) return `初始化 ${ownerClass}，建立运行所需的依赖与初始状态。`;
  const key = `${filePath}:${name}`;
  const exact = {
    'src/Lively/Lively.UI.WinUI/Views/Pages/Settings/SettingsWallpaperView.xaml.cs:ScrollElementIntoView': '将指定设置控件平滑滚动到可见区域，便于定位外部请求指向的配置项。',
    'src/Lively/Lively.Utility.Commandline/Program.cs:Main': '解析支持的自动化命令类型，检查核心进程是否运行，并把原始参数发送到 Commands gRPC 客户端。',
    'src/Lively/Lively.Utility.ConsoleDemo/Program.cs:Main': '运行交互式异步菜单，演示壁纸、屏幕、设置、屏保和关闭等 gRPC 调用。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:Main': '解析屏幕保护启动参数，定位已安装应用，并按预览或全屏模式激活 Lively。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:ParseScreensaverArgs': '解析 Windows 屏幕保护程序的 /s、/p 和 /c 参数，得到启动模式及预览窗口句柄。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:TryGetInnoInstalledAppPath': '从注册表查询 Inno Setup 安装记录，返回 Lively 的安装目录。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:IsSystemLocked': '结合前台窗口和进程信息判断当前 Windows 会话是否已锁定。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:IsAppMutexRunning': '检查指定互斥体是否存在，以确认 Lively 核心是否正在运行。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:GetForegroundWindow': '声明 user32 GetForegroundWindow 原生入口，以取得当前前台窗口句柄。',
    'src/Lively/Lively.Utility.Screensaver/Program.cs:GetWindowThreadProcessId': '声明 user32 GetWindowThreadProcessId 原生入口，以解析窗口所属进程。',
    'src/Lively/Lively.Utility.Watchdog/Program.cs:Main': '取得父进程并等待其退出，随后终止登记的外部壁纸与 UI 进程并刷新桌面。',
    'src/Lively/Lively.Utility.Watchdog/Program.cs:StdInListener': '异步读取标准输入中的 ADD、RMV 和 CLR 命令，持续维护需要清理的进程 ID 集合。',
    'src/Lively/Lively.Utility.Screensaver/Com/ApplicationActivationManager.cs:ActivateApplication': '通过 Windows COM 激活指定 AUMID 的应用，并返回新进程标识。',
    'src/Lively/Lively.Utility.Screensaver/Com/ApplicationActivationManager.cs:ActivateForFile': '通过 Windows COM 使用给定文件集合和动词激活应用。',
    'src/Lively/Lively.Utility.Screensaver/Com/ApplicationActivationManager.cs:ActivateForProtocol': '通过 Windows COM 使用给定协议项激活应用。',
  };
  if (exact[key]) return exact[key];
  if (name.includes('_')) return `响应 ${name} 对应的页面事件，并同步设置界面状态。`;
  return `执行 ${name} 对应的程序逻辑，并维护相关运行状态。`;
}

function functionTags(name, filePath, ownerClass) {
  if (name === ownerClass) return ['function', '初始化', filePath.includes('/Com/') ? 'com-interop' : '页面组件'];
  if (name === 'Main') return ['function', '入口点', filePath.includes('ConsoleDemo') ? 'grpc' : filePath.includes('Watchdog') ? '进程管理' : filePath.includes('Screensaver') ? '屏幕保护' : '命令行'];
  if (filePath.includes('/Com/')) return ['function', 'com-interop', '应用激活'];
  if (name.includes('_')) return ['function', 'event-handler', '设置界面'];
  if (filePath.includes('Watchdog')) return ['function', '看门狗', '进程管理'];
  if (filePath.includes('Screensaver')) return ['function', '屏幕保护', 'windows'];
  return ['function', 'ui-logic', '设置界面'];
}

const resultsByPath = new Map(extraction.results.map((item) => [item.path, item]));
const nodes = [];
const edges = [];
const ids = new Set();
const edgeKeys = new Set();
function addNode(node) {
  if (ids.has(node.id)) throw new Error(`重复节点 ID: ${node.id}`);
  ids.add(node.id);
  nodes.push(node);
}
function addEdge(edge) {
  if (edge.source === edge.target) throw new Error(`自引用边: ${edge.source}`);
  const key = `${edge.source}|${edge.target}|${edge.type}`;
  if (edgeKeys.has(key)) return;
  edgeKeys.add(key);
  edges.push(edge);
}

for (const file of batch.files) {
  const result = resultsByPath.get(file.path);
  const node = {
    id: fileId(file), type: file.fileCategory === 'config' ? 'config' : 'file', name: path.basename(file.path), filePath: file.path,
    summary: fileSummary(file), tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines),
  };
  const notes = languageNotes(file);
  if (notes) node.languageNotes = notes;
  addNode(node);
}

for (const file of batch.files) {
  const result = resultsByPath.get(file.path);
  if (!result) continue;
  const source = fileId(file);
  const exports = new Set((result.exports ?? []).map((item) => item.name).filter(Boolean));
  const classNames = (result.classes ?? []).map((item) => item.name).filter(Boolean);
  for (const cls of result.classes ?? []) {
    if (!cls.name || !Number.isInteger(cls.startLine) || !Number.isInteger(cls.endLine)) continue;
    const length = cls.endLine - cls.startLine + 1;
    if ((cls.methods?.length ?? 0) < 2 && length < 20 && !exports.has(cls.name)) continue;
    const id = `class:${file.path}:${cls.name}`;
    addNode({ id, type: 'class', name: cls.name, filePath: file.path, lineRange: [cls.startLine, cls.endLine], summary: classSummary(cls.name, file.path), tags: classTags(cls.name, file.path), complexity: complexity(length) });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exports.has(cls.name)) addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
  }
  const best = new Map();
  for (const fn of result.functions ?? []) {
    if (!fn.name || !Number.isInteger(fn.startLine) || !Number.isInteger(fn.endLine)) continue;
    const old = best.get(fn.name);
    if (!old || fn.endLine - fn.startLine > old.endLine - old.startLine) best.set(fn.name, fn);
  }
  for (const [name, fn] of best) {
    const length = fn.endLine - fn.startLine + 1;
    if (length < 10 && !exports.has(name)) continue;
    const ownerClass = classNames.find((item) => item === name) ?? classNames[0] ?? '';
    const id = `function:${file.path}:${name}`;
    addNode({ id, type: 'function', name, filePath: file.path, lineRange: [fn.startLine, fn.endLine], summary: functionSummary(name, file.path, ownerClass), tags: functionTags(name, file.path, ownerClass), complexity: complexity(length) });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exports.has(name)) addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
  }
}

const batchPaths = new Set(batch.files.map((item) => item.path));
for (const file of batch.files.filter((item) => item.path.endsWith('.xaml.cs'))) {
  const target = file.path.slice(0, -3);
  if (batchPaths.has(target)) addEdge({ source: fileId(file), target: `file:${target}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
}
for (const file of batch.files.filter((item) => item.path.endsWith('.csproj'))) {
  const target = `${path.posix.dirname(file.path)}/Program.cs`;
  if (batchPaths.has(target)) addEdge({ source: fileId(file), target: `file:${target}`, type: 'configures', direction: 'forward', weight: 0.6 });
}
for (const file of batch.files.filter((item) => item.path.endsWith('/App.config'))) {
  const target = `${path.posix.dirname(file.path)}/Program.cs`;
  if (batchPaths.has(target)) addEdge({ source: fileId(file), target: `file:${target}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
}

const activationPath = 'src/Lively/Lively.Utility.Screensaver/Com/ApplicationActivationManager.cs';
const activationInterfacePath = 'src/Lively/Lively.Utility.Screensaver/Com/IApplicationActivationManager.cs';
const screensaverProgramPath = 'src/Lively/Lively.Utility.Screensaver/Program.cs';
addEdge({ source: `class:${activationPath}:ApplicationActivationManager`, target: `class:${activationInterfacePath}:IApplicationActivationManager`, type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: `file:${screensaverProgramPath}`, target: `file:${activationPath}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: `function:${screensaverProgramPath}:Main`, target: `function:${activationPath}:ActivateApplication`, type: 'calls', direction: 'forward', weight: 0.8 });

for (const file of batch.files.filter((item) => item.fileCategory === 'code')) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: `file:${target}`, type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedNodeTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexities = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5, configures: 0.6 };
if (nodes.length !== 58) throw new Error(`节点数异常：预期 58，实际 ${nodes.length}`);
if (edges.length !== 66) throw new Error(`边数异常：预期 66，实际 ${edges.length}`);
const fileNodes = nodes.filter((node) => ['file', 'config', 'document', 'service', 'pipeline', 'schema', 'resource'].includes(node.type));
if (fileNodes.length !== batch.files.length) throw new Error(`文件级节点数异常：${fileNodes.length}/${batch.files.length}`);
for (const file of batch.files) if (!fileNodes.some((node) => node.filePath === file.path)) throw new Error(`缺少文件节点：${file.path}`);
for (const node of nodes) {
  if (!node.id || !allowedNodeTypes.has(node.type) || !node.name || !node.summary || !Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5 || !allowedComplexities.has(node.complexity)) throw new Error(`节点字段无效：${node.id}`);
  if (['function', 'class'].includes(node.type) && (!Array.isArray(node.lineRange) || node.lineRange.length !== 2)) throw new Error(`lineRange 无效：${node.id}`);
}
for (const edge of edges) {
  if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`悬空边：${edge.source} -> ${edge.target}`);
  if (edge.direction !== 'forward' || weights[edge.type] !== edge.weight) throw new Error(`边字段无效：${JSON.stringify(edge)}`);
}
const expectedImports = batch.files.filter((file) => file.fileCategory === 'code').reduce((sum, file) => sum + (batch.batchImportData[file.path] ?? []).length, 0);
const actualImports = edges.filter((edge) => edge.type === 'imports').length;
if (expectedImports !== actualImports) throw new Error(`imports 边不匹配：${expectedImports}/${actualImports}`);

const outputPath = path.join(uaDir, 'intermediate', 'batch-22.json');
fs.writeFileSync(outputPath, `${JSON.stringify({ nodes, edges }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, nodes: nodes.length, edges: edges.length, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
