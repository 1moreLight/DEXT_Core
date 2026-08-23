import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 26);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-26.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 26');
if (!extraction.scriptCompleted) throw new Error('批次 26 的官方结构提取未完成');

const cultures = {
  'my-MM': '缅甸语', 'nb-NO': '书面挪威语', 'nl-NL': '荷兰语', 'pl-PL': '波兰语',
  'pt-BR': '巴西葡萄牙语', 'pt-PT': '葡萄牙葡萄牙语', neutral: '中性语言', 'ro-RO': '罗马尼亚语',
  'ru-RU': '俄语', 'sk-SK': '斯洛伐克语', 'sr-Cyrl': '西里尔字母塞尔维亚语', 'sr-Latn': '拉丁字母塞尔维亚语',
  'sv-SE': '瑞典语', 'tr-TR': '土耳其语', 'uk-UA': '乌克兰语', 'vi-VN': '越南语',
  'zh-CN': '简体中文', 'zh-Hant': '繁体中文',
};

const codeSummaries = {
  'src/Lively/Lively/RPC/AppUpdateServer.cs': '实现应用更新 gRPC 服务，提供检查更新、读取版本、启动下载、切换发布通道、查询状态和订阅更新事件。',
  'src/Lively/Lively/RPC/CommandsServer.cs': '实现通用命令 gRPC 服务，控制 UI、调试器、屏幕保护、自动化命令和核心关闭。',
  'src/Lively/Lively/RPC/DisplayManagerServer.cs': '实现显示器 gRPC 服务，序列化屏幕与虚拟边界，并以服务器流推送显示拓扑变化。',
  'src/Lively/Lively/RPC/UserSettingsServer.cs': '实现用户设置 gRPC 服务，在 protobuf 模型与内部设置之间转换，并串行化应用规则和设置写入。',
  'src/Lively/Lively/RPC/WinDesktopCoreServer.cs': '实现桌面核心 gRPC 服务，覆盖壁纸创建、编辑、预览、关闭、查询、截图、消息转发和变更/错误订阅。',
  'src/Lively/Lively/Services/ResourceService.cs': '提供本地化资源服务，选择用户或系统文化、读取强类型字符串，并通过 Win32 获取首选 UI 语言。',
  'src/Lively/Lively/Services/RunnerService.cs': '启动、显示、重启和关闭 WinUI 前端进程，维护窗口句柄、可见性、位置和跨屏边界。',
};

const classDescriptions = {
  AppUpdateServer: '把更新器和下载器能力映射为 gRPC 请求、响应及更新状态流。',
  CommandsServer: '把远程 UI、屏保、自动化和关闭请求转发到相应核心服务。',
  DisplayManagerServer: '把显示器模型与变化事件映射为 gRPC 查询和服务器流。',
  UserSettingsServer: '负责设置 protobuf 转换、并发写入保护和设置变更触发的运行时副作用。',
  WinDesktopCoreServer: '把桌面核心、壁纸库和壁纸工厂能力映射为完整的远程壁纸管理 API。',
  ResourceService: '实现文化切换、资源键查找和 Windows 首选 UI 语言探测。',
  RunnerService: '封装 WinUI 子进程生命周期、窗口定位和可见状态。',
};

function fileId(file) { return `file:${file.path}`; }
function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function cultureInfo(filePath) {
  const base = path.basename(filePath);
  if (base === 'Resources.resx') return { code: 'neutral', language: cultures.neutral };
  const match = base.match(/^Resources\.(.+)\.resx$/);
  return { code: match?.[1], language: cultures[match?.[1]] };
}
function fileSummary(file) {
  if (file.path.endsWith('.resx')) {
    const { code, language } = cultureInfo(file.path);
    if (!language) throw new Error(`未识别文化资源: ${file.path}`);
    return code === 'neutral'
      ? '保存 Lively 核心界面的中性语言字符串，是各文化特定 .resx 文件的回退资源。'
      : `提供 Lively 核心界面的${language}本地化字符串，覆盖壁纸管理、设置、图库、屏幕保护和状态提示等文本键。`;
  }
  return codeSummaries[file.path];
}
function fileTags(file) {
  if (file.path.endsWith('.resx')) return ['resx', '本地化', cultureInfo(file.path).language];
  if (file.path.includes('/RPC/')) return ['csharp', 'grpc', 'rpc-server'];
  if (file.path.endsWith('ResourceService.cs')) return ['csharp', '本地化', 'service'];
  return ['csharp', '进程管理', 'service'];
}
function languageNotes(file) {
  if (file.path.endsWith('.resx')) {
    const { code } = cultureInfo(file.path);
    return code === 'neutral'
      ? '中性 .resx 在没有匹配区域性资源时由 ResourceManager 作为回退。'
      : `该 .resx 使用 ${code} CultureInfo，在构建时嵌入程序集并由 ResourceManager 按当前区域性选择。`;
  }
  if (file.path.includes('/RPC/')) return '继承 protobuf 生成的 gRPC 服务基类，并使用 async/await 与 IServerStreamWriter 实现远程调用。';
  if (file.path.endsWith('ResourceService.cs')) return '结合 ResourceManager、CultureInfo 和 GetUserPreferredUILanguages Win32 API 解析界面语言。';
  return '通过 System.Diagnostics.Process 和 Win32 窗口 API 管理独立 WinUI 前端。';
}
function classSummary(name) { return classDescriptions[name] ?? `封装 ${name} 的服务职责和运行状态。`; }
function classTags(name, filePath) {
  if (filePath.includes('/RPC/')) return ['class', 'grpc', 'rpc-server'];
  if (name === 'ResourceService') return ['class', '本地化', 'service'];
  return ['class', '进程管理', 'service'];
}

const exactMethods = {
  CheckUpdate: '触发一次应用更新检查并返回空响应。',
  GetLatestRelease: '读取最新发布版本并转换为 gRPC 发布信息。',
  StartUpdate: '启动更新包下载和安装准备，并报告无法更新的前置条件。',
  SwitchReleaseChannel: '切换正式版或测试版发布通道，并重新检查对应更新。',
  GetUpdateStatus: '返回当前更新检查、下载进度和可用版本状态。',
  SubscribeUpdateChecked: '订阅更新检查事件，并通过服务器流持续推送状态变化。',
  ShowUI: '请求显示 WinUI 前端窗口，必要时启动独立 UI 进程。',
  CloseUI: '请求关闭 WinUI 前端窗口或进程。',
  RestartUI: '重启 WinUI 前端并恢复默认启动参数。',
  RestartUIWithArgs: '使用请求中的参数重启 WinUI 前端。',
  ShowDebugger: '打开 Lively 的调试和日志界面。',
  Screensaver: '依据请求启动或停止屏幕保护模式。',
  ShutDown: '有序关闭 UI 和 Lively 核心进程。',
  AutomationCommand: '把远程自动化参数交给核心命令处理器。',
  SaveRectUI: '保存当前 WinUI 窗口位置，供下次启动恢复。',
  GetScreens: '把当前显示器集合序列化为 gRPC 屏幕响应。',
  GetVirtualScreenBounds: '返回所有显示器联合形成的虚拟桌面边界。',
  SubscribeDisplayChanged: '订阅显示拓扑变化，并通过服务器流推送最新显示器信息。',
  GetAppRulesSettings: '读取应用暂停规则并转换为 protobuf 响应。',
  SetAppRulesSettings: '校验并持久化应用暂停规则，同时使用写锁避免并发覆盖。',
  SetSettings: '把远程设置请求映射到内部模型，触发相关服务副作用并持久化。',
  GetSettings: '把完整内部用户设置转换为 protobuf 设置响应。',
  GetCoreStats: '返回当前桌面核心和活动壁纸的运行统计。',
  SetWallpaper: '根据请求中的壁纸和显示器标识设置活动壁纸。',
  CreateWallpaper: '从文件或链接创建壁纸库项目并准备相应后端。',
  EditWallpaper: '更新壁纸元数据、属性或资源文件并保存变更。',
  GetWallpapers: '通过服务器流枚举当前壁纸库和活动壁纸信息。',
  PreviewWallpaper: '创建临时壁纸后端并在预览窗口中显示。',
  CloseAllWallpapers: '关闭请求范围内的全部活动壁纸。',
  CloseWallpaperMonitor: '关闭指定显示器上的活动壁纸。',
  CloseWallpaperLibrary: '关闭来自指定壁纸库项目的实例。',
  CloseWallpaperCategory: '关闭指定类别的所有壁纸实例。',
  SubscribeWallpaperChanged: '订阅壁纸集合变化，并通过服务器流推送事件。',
  SubscribeWallpaperError: '订阅壁纸错误，并通过服务器流推送可诊断信息。',
  SendMessageWallpaper: '把属性或交互消息转发给匹配的壁纸实例。',
  TakeScreenshot: '截取指定显示器上的活动壁纸并返回结果路径。',
  GetError: '把内部异常转换为稳定的 gRPC 错误响应。',
  SetCulture: '设置当前 UI CultureInfo，并通知界面刷新本地化资源。',
  SetSystemDefaultCulture: '选择 Windows 系统首选 UI 语言作为当前文化。',
  GetString: '按资源键或枚举类型读取当前文化下的界面字符串。',
  GetSystemDefaultUICulture: '解析 Windows 首选 UI 语言列表并返回可用的 CultureInfo。',
  GetUserPreferredUILanguages: '声明 Windows GetUserPreferredUILanguages 原生入口。',
  ShowAppUpdatePage: '打开 WinUI 前端并导航到应用更新页面。',
  ShowCustomisWallpaperePanel: '打开 WinUI 前端中的壁纸自定义面板。',
  SaveRectUI: '保存当前 WinUI 窗口矩形。',
  SetBusyUI: '更新 WinUI 前端的忙碌状态。',
  SetWindowRect: '使用 Win32 API 恢复或调整 WinUI 进程的窗口矩形。',
  IsOnScreen: '判断指定窗口是否仍位于任一当前显示器的可见范围。',
};

function functionSummary(name, filePath, ownerClass) {
  if (name === ownerClass) return `初始化 ${ownerClass}，注入服务依赖并建立事件或并发状态。`;
  if (exactMethods[name]) return exactMethods[name];
  if (name.includes('_')) return `响应 ${name} 事件并同步远程服务或前端进程状态。`;
  if (name === 'Dispose') return '释放子进程、事件订阅和其他运行资源。';
  if (name.startsWith('Get')) return `获取 ${name.slice(3)} 对应的服务数据。`;
  if (name.startsWith('Set')) return `设置 ${name.slice(3)} 对应的服务状态。`;
  if (name.startsWith('Show')) return `显示 ${name.slice(4)} 对应的界面或内容。`;
  if (name.startsWith('Close')) return `关闭 ${name.slice(5)} 对应的界面或运行对象。`;
  return `执行 ${name} 对应的服务逻辑。`;
}
function functionTags(name, filePath, ownerClass, exported) {
  const tags = ['function', filePath.includes('/RPC/') ? 'grpc' : filePath.includes('ResourceService') ? '本地化' : '进程管理'];
  if (name === ownerClass) tags.push('初始化');
  else if (name.startsWith('Subscribe')) tags.push('server-streaming');
  else if (name.includes('_')) tags.push('event-handler');
  else if (name === 'Dispose') tags.push('资源释放');
  else if (name.startsWith('Get')) tags.push('查询');
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
  addNode({ id: fileId(file), type: 'file', name: path.basename(file.path), filePath: file.path, summary: fileSummary(file), tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines), languageNotes: languageNotes(file) });
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

const f = (p) => `file:${p}`;
const runner = 'src/Lively/Lively/Services/RunnerService.cs';
const resource = 'src/Lively/Lively/Services/ResourceService.cs';
for (const source of [
  'src/Lively/Lively/RPC/CommandsServer.cs',
  'src/Lively/Lively/RPC/UserSettingsServer.cs',
  'src/Lively/Lively/RPC/WinDesktopCoreServer.cs',
]) addEdge({ source: f(source), target: f(runner), type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: f('src/Lively/Lively/RPC/UserSettingsServer.cs'), target: f(resource), type: 'depends_on', direction: 'forward', weight: 0.6 });

for (const file of batch.files.filter((item) => item.fileCategory === 'code')) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: f(target), type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5 };
if (nodes.length !== 90) throw new Error(`节点数异常: ${nodes.length}/90`);
if (edges.length !== 130) throw new Error(`边数异常: ${edges.length}/130`);
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
if (partCount !== 2) throw new Error(`分片数异常: ${partCount}/2`);
const sortedFiles = [...batch.files].sort((a, b) => a.path.localeCompare(b.path));
const groupSize = Math.ceil(sortedFiles.length / partCount);
const parts = []; let totalNodes = 0, totalEdges = 0;
for (let index = 0; index < partCount; index += 1) {
  const fileGroup = sortedFiles.slice(index * groupSize, (index + 1) * groupSize);
  const paths = new Set(fileGroup.map((file) => file.path));
  const partNodes = nodes.filter((node) => paths.has(node.filePath));
  const partIds = new Set(partNodes.map((node) => node.id));
  const partEdges = edges.filter((edge) => partIds.has(edge.source));
  for (const edge of partEdges) {
    if (!partIds.has(edge.source) || !partIds.has(edge.target)) throw new Error(`分片 ${index + 1} 边端点不在本分片: ${edge.source} -> ${edge.target}`);
  }
  const outputPath = path.join(uaDir, 'intermediate', `batch-26-part-${index + 1}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)}\n`, 'utf8');
  totalNodes += partNodes.length; totalEdges += partEdges.length;
  parts.push({ outputPath, files: fileGroup.length, nodes: partNodes.length, edges: partEdges.length });
}
if (totalNodes !== nodes.length || totalEdges !== edges.length) throw new Error(`分片汇总不匹配: ${totalNodes}/${nodes.length} nodes, ${totalEdges}/${edges.length} edges`);
console.log(JSON.stringify({ parts, totals: { nodes: totalNodes, edges: totalEdges }, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
