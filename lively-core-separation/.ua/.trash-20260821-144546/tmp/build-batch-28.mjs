import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 28);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-28.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 28');
if (!extraction.scriptCompleted) throw new Error('批次 28 的官方结构提取未完成');

const summaries = {
  'src/Lively/Lively/Views/TransparentWindow.xaml': '定义无边框透明 WPF 宿主窗口的最小布局，供覆盖层或原生内容承载场景使用。',
  'src/Lively/Lively/Views/TransparentWindow.xaml.cs': '初始化透明宿主窗口并连接其 XAML 内容。',
  'src/Lively/Lively/Views/WallpaperPreview.xaml': '定义独立壁纸预览窗口的加载状态、内容宿主和基础控制布局。',
  'src/Lively/Lively/Views/WallpaperPreview.xaml.cs': '创建临时壁纸后端并在窗口中加载预览，随窗口尺寸调整壁纸边界并在关闭时释放资源。',
  'src/Lively/Lively/Views/WindowCoverageDebugOverlay.xaml': '定义显示器窗口覆盖范围调试层的网格和标注布局。',
  'src/Lively/Lively/Views/WindowCoverageDebugOverlay.xaml.cs': '按显示器 DPI 和边界生成调试网格，周期更新窗口覆盖信息并管理覆盖层生命周期。',
  'src/Lively/Lively/Views/WindowMsg/RawInputMsgWindow.xaml': '定义用于接收 Windows Raw Input 消息的隐藏 WPF 窗口。',
  'src/Lively/Lively/Views/WindowMsg/RawInputMsgWindow.xaml.cs': '注册键盘和鼠标 Raw Input 设备，解析 WM_INPUT 消息并发布移动、按键和鼠标点击事件。',
  'src/Lively/Lively/Views/WindowMsg/WndProcMsgWindow.xaml': '定义承载通用 Windows 窗口消息钩子的隐藏 WPF 窗口。',
  'src/Lively/Lively/Views/WindowMsg/WndProcMsgWindow.xaml.cs': '建立 WPF HwndSource 消息钩子，识别任务栏重建等窗口消息并通过事件参数向核心服务发布。',
  'src/Lively/Lively/app.manifest': '声明 Lively WPF 核心进程的 Windows 执行级别、兼容性、DPI 感知、长路径和系统能力。',
  'src/installer/Languages/Arabic.isl': '为 Lively Inno Setup 安装向导提供阿拉伯语界面消息。',
  'src/installer/Languages/ChineseSimplified.isl': '为 Lively Inno Setup 安装向导提供简体中文界面消息。',
  'src/installer/Languages/ChineseTraditional.isl': '为 Lively Inno Setup 安装向导提供繁体中文界面消息。',
  'src/installer/Languages/Greek.isl': '为 Lively Inno Setup 安装向导提供希腊语界面消息。',
  'src/installer/Languages/Indonesian.isl': '为 Lively Inno Setup 安装向导提供印度尼西亚语界面消息。',
  'src/installer/Languages/Korean.isl': '为 Lively Inno Setup 安装向导提供韩语界面消息。',
  'src/installer/Languages/Lithuanian.isl': '为 Lively Inno Setup 安装向导提供立陶宛语界面消息。',
  'src/installer/Languages/SerbianCyrillic.isl': '为 Lively Inno Setup 安装向导提供西里尔字母塞尔维亚语界面消息。',
  'src/installer/Languages/SerbianLatin.isl': '为 Lively Inno Setup 安装向导提供拉丁字母塞尔维亚语界面消息。',
  'src/installer/Languages/Swedish.isl': '为 Lively Inno Setup 安装向导提供瑞典语界面消息。',
  'src/installer/Languages/Vietnamese.isl': '为 Lively Inno Setup 安装向导提供越南语界面消息。',
  'src/installer/Script.iss': '定义 Lively x86 Inno Setup 安装包：复制应用文件、注册快捷方式和开机启动，检查运行库，处理升级卸载，并集成多语言和向导主题。',
  'src/installer/Script_x64.iss': '定义 Lively x64 Inno Setup 安装包：配置 64 位安装目录与文件，检查运行库，处理升级卸载，并集成多语言和向导主题。',
  'src/installer/Theme/wizard_large.bmp': '提供 Inno Setup 安装向导左侧使用的大尺寸品牌位图。',
};

const classDescriptions = {
  TransparentWindow: '承载无边框透明窗口的最小 WPF 宿主。',
  WallpaperPreview: '维护预览壁纸模型、后端实例和窗口几何，协调异步加载与资源释放。',
  WindowCoverageDebugOverlay: '维护目标显示器、DPI、网格尺寸和刷新计时器，用于可视化窗口覆盖范围。',
  RawInputMsgWindow: '封装 Raw Input 注册和 WM_INPUT 解析，并向上层发布统一输入事件。',
  MouseRawArgs: '封装原始鼠标移动的 X、Y 增量。',
  MouseClickRawArgs: '封装原始鼠标点击位置和按键类型。',
  KeyboardClickRawArgs: '封装原始键盘消息、虚拟键、扫描码和按下状态。',
  WndProcMsgWindow: '托管通用 HwndSource 消息钩子并发布窗口消息事件。',
  WindowMessageEventArgs: '封装窗口句柄、消息编号、参数和结果等 Win32 消息数据。',
};

function fileId(file) { return `file:${file.path}`; }
function complexity(lines, filePath) {
  if (filePath.endsWith('.bmp')) return 'simple';
  return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple';
}
function domain(filePath) {
  if (filePath.includes('/WindowMsg/')) return 'win32-input';
  if (filePath.includes('WallpaperPreview')) return '壁纸预览';
  if (filePath.includes('Coverage')) return '调试覆盖层';
  if (filePath.includes('/Views/')) return '窗口视图';
  if (filePath.includes('/Languages/')) return '安装本地化';
  if (filePath.endsWith('.iss')) return '安装程序';
  if (filePath.endsWith('.bmp')) return '安装主题';
  return '应用清单';
}
function fileTags(file) {
  if (file.path.endsWith('.xaml')) return ['xaml', 'wpf', domain(file.path)];
  if (file.path.endsWith('.xaml.cs')) return ['csharp', '代码隐藏', domain(file.path)];
  if (file.path.endsWith('.manifest')) return ['windows', '应用清单', '兼容性'];
  if (file.path.endsWith('.isl')) return ['inno-setup', '本地化', '安装程序'];
  if (file.path.endsWith('.iss')) return ['inno-setup', 'deployment', '安装程序'];
  return ['bitmap', '安装主题', '品牌资源'];
}
function languageNotes(file) {
  if (file.path.endsWith('.xaml')) return '使用 WPF XAML 声明窗口布局，并由对应 C# partial 类提供行为。';
  if (file.path.endsWith('.xaml.cs')) return '结合 WPF HwndSource 与 Win32 消息、Raw Input 或原生窗口几何互操作。';
  if (file.path.endsWith('.isl')) return 'Inno Setup Language 文件以节和键值对覆盖安装器消息。';
  if (file.path.endsWith('.iss')) return 'Inno Setup 脚本混合声明式安装节与 Pascal Script 运行库检查和升级逻辑。';
  return undefined;
}
function classSummary(name) { return classDescriptions[name] ?? `封装 ${name} 的窗口或消息职责。`; }
function classTags(name, filePath) {
  if (name.endsWith('Args')) return ['class', 'event-data', 'win32-input'];
  if (filePath.includes('/WindowMsg/')) return ['class', 'win32', 'message-hook'];
  return ['class', 'wpf', domain(filePath)];
}

const exactMethods = {
  LoadWallpaperAsync: '异步创建壁纸后端、等待内容加载并把其窗口嵌入预览宿主。',
  SetWallpaperVolume: '设置预览壁纸实例的音频音量。',
  Window_SizeChanged: '响应预览窗口尺寸变化并更新壁纸子窗口边界。',
  UpdateGrid: '依据目标显示器像素边界和 DPI 重新生成覆盖范围调试网格。',
  Window_SourceInitialized: '取得窗口句柄、注册 Raw Input 设备并安装 WndProc 消息钩子。',
  Hook: '解析 WM_INPUT 中的鼠标和键盘原始数据，并发布标准化输入事件。',
  OnSourceInitialized: '取得 WPF HwndSource 并安装通用窗口消息钩子。',
  WndProc: '处理窗口消息，识别已注册的系统消息并发布 WindowMessageEventArgs。',
};
function functionSummary(name, filePath, ownerClass) {
  if (name === ownerClass) return `初始化 ${ownerClass}，建立${domain(filePath)}所需的窗口状态、依赖和事件数据。`;
  if (exactMethods[name]) return exactMethods[name];
  if (name.includes('_Closing')) return `响应 ${name} 窗口关闭事件并释放${domain(filePath)}资源。`;
  if (name.includes('_Loaded')) return `响应 ${name} 加载事件并完成${domain(filePath)}初始化。`;
  if (name.includes('_')) return `响应 ${name} 事件，并同步${domain(filePath)}状态。`;
  return `执行 ${name} 对应的${domain(filePath)}逻辑。`;
}
function functionTags(name, filePath, ownerClass, exported) {
  const tags = ['function', domain(filePath)];
  if (name === ownerClass) tags.push('初始化');
  else if (name.includes('_') || ['Hook', 'WndProc'].includes(name)) tags.push('event-handler');
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
  const node = { id: fileId(file), type: 'file', name: path.basename(file.path), filePath: file.path, summary: summaries[file.path], tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines, file.path) };
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
    addNode({ id, type: 'class', name: cls.name, filePath: file.path, lineRange: [cls.startLine, cls.endLine], summary: classSummary(cls.name), tags: classTags(cls.name, file.path), complexity: complexity(length, file.path) });
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
    addNode({ id, type: 'function', name, filePath: file.path, lineRange: [fn.startLine, fn.endLine], summary: functionSummary(name, file.path, ownerClass), tags: functionTags(name, file.path, ownerClass, exported.has(name)), complexity: complexity(length, file.path) });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exported.has(name)) addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
  }
}

for (const sourcePath of batch.files.map((file) => file.path).filter((filePath) => filePath.endsWith('.xaml.cs'))) {
  const targetPath = sourcePath.slice(0, -3);
  addEdge({ source: `file:${sourcePath}`, target: `file:${targetPath}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
}
const languageFiles = [
  'Arabic.isl', 'ChineseSimplified.isl', 'ChineseTraditional.isl', 'Greek.isl', 'Indonesian.isl', 'Korean.isl',
  'Lithuanian.isl', 'SerbianCyrillic.isl', 'SerbianLatin.isl', 'Swedish.isl', 'Vietnamese.isl',
].map((name) => `src/installer/Languages/${name}`);
for (const scriptPath of ['src/installer/Script.iss', 'src/installer/Script_x64.iss']) {
  for (const languagePath of languageFiles) addEdge({ source: `file:${scriptPath}`, target: `file:${languagePath}`, type: 'depends_on', direction: 'forward', weight: 0.6 });
  addEdge({ source: `file:${scriptPath}`, target: 'file:src/installer/Theme/wizard_large.bmp', type: 'depends_on', direction: 'forward', weight: 0.6 });
}
for (const file of batch.files) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: `file:${target}`, type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5 };
if (nodes.length !== 53) throw new Error(`节点数异常: ${nodes.length}/53`);
if (edges.length !== 77) throw new Error(`边数异常: ${edges.length}/77`);
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
if (nodes.length > 60 || edges.length > 120) throw new Error('批次 28 不应分片');

const outputPath = path.join(uaDir, 'intermediate', 'batch-28.json');
fs.writeFileSync(outputPath, `${JSON.stringify({ nodes, edges }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, nodes: nodes.length, edges: edges.length, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
