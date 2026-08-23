// Batch 11 semantic graph builder. Structural facts come from extract-structure.mjs output.
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const uaDir = path.join(projectRoot, '.ua');
const batchIndex = 11;
const batchesPath = path.join(uaDir, 'intermediate', 'batches.json');
const extractPath = path.join(uaDir, 'tmp', 'ua-file-extract-results-11.json');
const batches = JSON.parse(fs.readFileSync(batchesPath, 'utf8'));
const batch = batches.batches.find((item) => item.batchIndex === batchIndex);
const extracted = JSON.parse(fs.readFileSync(extractPath, 'utf8'));

if (!batch) throw new Error('batches.json 中缺少原始 batchIndex 11');
if (!extracted.scriptCompleted) throw new Error('batch 11 结构提取未成功完成');

const expectedPaths = batch.files.map((file) => file.path);
const extractedByPath = new Map(extracted.results.map((result) => [result.path, result]));
const skipped = new Set(extracted.filesSkipped || []);
for (const filePath of expectedPaths) {
  if (!extractedByPath.has(filePath) && !skipped.has(filePath)) {
    throw new Error(`结构结果既未分析也未标记跳过: ${filePath}`);
  }
  if (!fs.existsSync(path.join(projectRoot, filePath))) {
    throw new Error(`批次文件不存在: ${filePath}`);
  }
}

const FILE_SUMMARIES = new Map([
  ['LivelyResumeCmd.cs', '定义恢复动态壁纸运行的 IPC 命令载荷，供宿主通知播放器继续渲染与播放。'],
  ['LivelyScreenshotCmd.cs', '定义截图请求的消息载荷，携带输出格式、文件路径与延迟参数。'],
  ['LivelySlider.cs', '定义可序列化的滑块属性消息，以名称、当前值和步长描述可调参数。'],
  ['LivelySuspendCmd.cs', '定义暂停动态壁纸运行的 IPC 命令载荷，供宿主控制播放器挂起。'],
  ['LivelySystemInformation.cs', '封装系统信息文本消息，用于把主机状态传递给动态壁纸内容。'],
  ['LivelySystemNowPlaying.cs', '封装系统当前播放媒体的信息文本，供动态壁纸响应 Now Playing 状态。'],
  ['LivelyTextBox.cs', '定义可序列化的文本输入属性消息，以名称和值承载壁纸自定义参数。'],
  ['LivelyVolumeCmd.cs', '定义音量控制消息载荷，用于向播放器传递目标音量。'],
  ['MessageType.cs', '声明 Lively 播放器消息协议的类型枚举，区分命令、属性更新、系统状态与回执等消息。'],
  ['ScreenshotFormat.cs', '声明截图命令支持的图像格式枚举，为 IPC 截图请求提供稳定的格式标识。'],
  ['ScreenLayoutModel.cs', '描述控制面板中的屏幕布局项，组合显示器信息、归一化边界、选择状态与壁纸元数据路径。'],
  ['ScreenSaverLayoutModel.cs', '保存屏幕保护程序的布局模式及各显示器壁纸映射，作为设置持久化的数据模型。'],
  ['AppUpdaterEventArgs.cs', '承载应用更新状态、版本、发布日期、下载地址与文件名，供更新服务通过事件通知界面。'],
  ['ColorProperties.cs', '集中保存主题配色的主色、辅色、文本色与互补色，供界面主题计算和展示使用。'],
  ['HardwareUsageEventArgs.cs', '承载 CPU、GPU、内存和网络设备名称及实时用量指标，供硬件监控事件发布状态。'],
  ['NowPlayingEventArgs.cs', '承载当前媒体的标题、艺术家、专辑、曲目、流派、缩略图与播放类型等元数据。'],
  ['SettingsModel.cs', '定义 Lively 的完整持久化设置模型，并在构造函数中集中建立播放器、性能、显示、主题与屏保的默认值。'],
  ['ThemeModel.cs', '描述可安装或可编辑的应用主题，包含元数据、预览资源、强调色、类型与标签，并支持复制构造。'],
  ['DialogNavigationItem.cs', '描述对话框导航条目所需的名称、图标、可见性和目标页面类型。'],
  ['ExplorerItem.cs', '描述文件浏览树节点，保存名称、条目类型及递归子项集合。'],
  ['FolderDropdownUserControlModel.cs', '描述文件夹下拉控件中的条目，关联显示文件名、实际路径与预览图像路径。'],
  ['MainNavigationItem.cs', '描述主导航菜单条目，包含名称、图标、提醒状态、提醒内容与目标页面类型。'],
  ['WallpaperLayoutModel.cs', '描述单个显示器与壁纸元数据路径之间的布局映射，用于保存或恢复多屏壁纸安排。'],
  ['App.config', '配置 CefSharp 播放器使用 .NET Framework 4.7.2，并启用 PerMonitorV2 高 DPI 感知。'],
  ['BrowserExtensions.cs', '为 CefSharp 浏览器提供窗口句柄、D3D 子进程识别、DevTools 脚本调用与 ShaderToy 界面隐藏等扩展能力。'],
]);

const CLASS_SUMMARIES = new Map([
  ['LivelyResumeCmd', '表示恢复播放器运行的 IPC 命令对象。'],
  ['LivelyScreenshotCmd', '表示带格式、目标路径和延迟参数的截图命令对象。'],
  ['LivelySlider', '表示动态壁纸属性中的滑块名称、数值与步长。'],
  ['LivelySuspendCmd', '表示暂停播放器运行的 IPC 命令对象。'],
  ['LivelySystemInformation', '封装发送给动态壁纸的系统信息文本。'],
  ['LivelySystemNowPlaying', '封装发送给动态壁纸的系统当前播放信息。'],
  ['LivelyTextBox', '表示动态壁纸属性中的文本框名称和值。'],
  ['LivelyVolumeCmd', '表示向播放器发送的音量控制命令。'],
  ['ScreenLayoutModel', '聚合单个显示器的布局边界、选择状态、截图及壁纸描述信息。'],
  ['ScreenSaverLayoutModel', '聚合屏保布局模式及显示器到壁纸的映射集合。'],
  ['AppUpdaterEventArgs', '为应用更新事件提供状态、版本、日期、地址和文件名。'],
  ['ColorProperties', '保存界面主题使用的一组语义颜色。'],
  ['HardwareUsageEventArgs', '为硬件监控事件提供设备名称与 CPU、GPU、内存、网络指标。'],
  ['NowPlayingEventArgs', '为媒体状态事件提供完整的当前播放元数据。'],
  ['SettingsModel', '集中定义并初始化 Lively 的用户设置、播放器选项、性能策略、主题及屏保参数。'],
  ['ThemeModel', '表示可复制、可序列化的 Lively 主题元数据与资源引用。'],
  ['DialogNavigationItem', '表示对话框中的可见导航目标及其图标。'],
  ['ExplorerItem', '表示可递归包含子项的文件浏览树节点。'],
  ['FolderDropdownUserControlModel', '表示文件夹下拉控件中的文件与预览资源。'],
  ['MainNavigationItem', '表示带提醒状态的主界面导航目标。'],
  ['WallpaperLayoutModel', '表示一个显示器与其壁纸描述路径的持久化映射。'],
  ['BrowserExtensions', '汇集 CefSharp 浏览器与 Windows 窗口、D3D 渲染和 DevTools 交互的扩展方法。'],
]);

const FUNCTION_SUMMARIES = new Map([
  ['LivelyResumeCmd', '初始化恢复命令并设置对应的消息类型。'],
  ['LivelyScreenshotCmd', '初始化截图命令并设置截图消息类型，属性随后承载格式、路径和延迟。'],
  ['LivelySlider', '初始化滑块属性消息并设置对应的消息类型。'],
  ['LivelySuspendCmd', '初始化暂停命令并设置对应的消息类型。'],
  ['LivelySystemInformation', '初始化系统信息消息并设置对应的消息类型。'],
  ['LivelySystemNowPlaying', '初始化当前播放信息消息并设置对应的消息类型。'],
  ['LivelyTextBox', '初始化文本框属性消息并设置对应的消息类型。'],
  ['LivelyVolumeCmd', '初始化音量命令并设置对应的消息类型。'],
  ['ScreenLayoutModel', '根据显示器、截图、属性文件和标题构建屏幕布局项，并计算归一化边界。'],
  ['AppUpdaterEventArgs', '把更新状态、版本、日期、下载地址和文件名封装为事件参数。'],
  ['SettingsModel', '为应用设置建立完整默认值，覆盖播放器、暂停策略、显示、主题、屏保和性能选项。'],
  ['ThemeModel', '初始化主题元数据；同名重载还支持复制现有模型或创建空主题。'],
  ['WallpaperLayoutModel', '把显示器对象与壁纸描述路径封装为布局映射。'],
  ['TryGetChrome_WidgetWin_1', '尝试从 CefSharp 浏览器句柄定位 Chrome_WidgetWin_1 子窗口。'],
  ['TryGetIntermediateD3DWindow', '尝试定位浏览器渲染链中的 Intermediate D3D Window。'],
  ['TryGetCefD3DRenderingSubProcessId', '尝试解析 CefSharp D3D 渲染子进程的进程标识。'],
  ['ExecuteScriptAsyncEx', '通过 DevTools Runtime API 调用指定 JavaScript 函数，并异步返回执行结果。'],
  ['TryHideShaderToyGui', '尝试在 ShaderToy 页面中注入脚本以隐藏其界面控件。'],
]);

function fileNodeType(file) {
  if (file.fileCategory === 'config') return 'config';
  if (file.fileCategory === 'docs') return 'document';
  if (file.fileCategory === 'data') return 'schema';
  return 'file';
}

function fileNodeId(file) {
  return `${fileNodeType(file)}:${file.path}`;
}

function complexityFromLines(lines) {
  if (lines < 50) return 'simple';
  if (lines <= 200) return 'moderate';
  return 'complex';
}

function fileTags(filePath) {
  const base = path.posix.basename(filePath);
  if (base === 'App.config') return ['configuration', '.net-framework', 'dpi', 'cefsharp'];
  if (base === 'MessageType.cs' || base === 'ScreenshotFormat.cs') return ['枚举', '消息协议', '类型标识', '进程通信'];
  if (filePath.includes('/Message/')) return ['进程通信', '消息协议', '命令模型', '序列化'];
  if (base === 'SettingsModel.cs') return ['配置模型', '应用设置', '默认值', '持久化'];
  if (base === 'ThemeModel.cs') return ['主题模型', '外观设置', '序列化', '数据复制'];
  if (base === 'BrowserExtensions.cs') return ['extension-method', 'cefsharp', '窗口集成', 'devtools'];
  if (base.endsWith('EventArgs.cs')) return ['事件数据', '数据模型', '状态通知', '序列化'];
  if (filePath.includes('/UserControls/')) return ['控件模型', '界面导航', '数据绑定', 'mvvm'];
  if (base.includes('LayoutModel')) return ['布局模型', '多显示器', '持久化', '数据模型'];
  return ['数据模型', '状态传递', '序列化', 'lively'];
}

function classTags(name) {
  if (name === 'BrowserExtensions') return ['extension-method', 'cefsharp', '窗口集成', 'devtools'];
  if (name.endsWith('EventArgs')) return ['事件数据', '状态通知', '数据模型', '序列化'];
  if (name.includes('Navigation') || name.includes('Explorer') || name.includes('Dropdown')) return ['控件模型', '数据绑定', '界面导航', 'mvvm'];
  if (name.includes('Layout')) return ['布局模型', '多显示器', '数据模型', '持久化'];
  if (name === 'SettingsModel') return ['配置模型', '默认值', '持久化', '应用设置'];
  if (name === 'ThemeModel' || name === 'ColorProperties') return ['主题模型', '外观设置', '数据模型', '序列化'];
  return ['消息模型', '进程通信', '序列化', '命令载荷'];
}

function functionTags(name) {
  if (name.startsWith('TryGet')) return ['extension-method', '窗口查找', 'win32', 'cefsharp'];
  if (name === 'ExecuteScriptAsyncEx' || name === 'TryHideShaderToyGui') return ['extension-method', 'devtools', 'javascript', 'cefsharp'];
  if (name === 'SettingsModel') return ['构造函数', '默认值', '配置初始化', '应用设置'];
  if (name === 'ThemeModel') return ['构造函数', '主题模型', '数据复制', '初始化'];
  if (name.includes('Layout')) return ['构造函数', '布局模型', '多显示器', '初始化'];
  if (name === 'AppUpdaterEventArgs') return ['构造函数', '事件数据', '状态通知', '初始化'];
  return ['构造函数', '消息模型', '初始化', '进程通信'];
}

function languageNotesForFile(filePath) {
  const base = path.posix.basename(filePath);
  if (base === 'App.config') return 'XML 配置同时声明 CLR 运行时版本与 WinForms PerMonitorV2 DPI 感知。';
  if (base === 'BrowserExtensions.cs') return 'C# extension method 把 Win32 窗口枚举与 CefSharp DevTools 异步 API 封装为浏览器级能力。';
  if (base === 'SettingsModel.cs') return '大型 C# POCO 通过构造函数集中设置默认值，便于 JSON 设置缺省与版本迁移保持一致。';
  return undefined;
}

const nodes = [];
const edges = [];
const significantNodeIds = new Set();

for (const file of batch.files) {
  const result = extractedByPath.get(file.path);
  if (!result) {
    // The bundled extractor skipped App.config; reading it here satisfies the skipped-file protocol.
    fs.readFileSync(path.join(projectRoot, file.path), 'utf8');
  }
  const base = path.posix.basename(file.path);
  const nodeId = fileNodeId(file);
  const fileNode = {
    id: nodeId,
    type: fileNodeType(file),
    name: base,
    filePath: file.path,
    summary: FILE_SUMMARIES.get(base),
    tags: fileTags(file.path),
    complexity: complexityFromLines(result?.nonEmptyLines ?? file.sizeLines),
  };
  const languageNotes = languageNotesForFile(file.path);
  if (languageNotes) fileNode.languageNotes = languageNotes;
  if (!fileNode.summary) throw new Error(`缺少文件摘要映射: ${file.path}`);
  nodes.push(fileNode);

  if (!result) continue;
  const exportedNames = new Set((result.exports || []).map((item) => item.name).filter(Boolean));

  const classes = (result.classes || []).filter((item) => item?.name);
  for (const item of classes) {
    const lineCount = item.endLine - item.startLine + 1;
    const significant = lineCount >= 20 || (item.methods || []).length >= 2 || exportedNames.has(item.name);
    if (!significant) continue;
    const id = `class:${file.path}:${item.name}`;
    nodes.push({
      id,
      type: 'class',
      name: item.name,
      filePath: file.path,
      lineRange: [item.startLine, item.endLine],
      summary: CLASS_SUMMARIES.get(item.name) || `封装 ${item.name} 的领域状态与行为。`,
      tags: classTags(item.name),
      complexity: complexityFromLines(lineCount),
    });
    significantNodeIds.add(id);
    edges.push({ source: nodeId, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exportedNames.has(item.name)) {
      edges.push({ source: nodeId, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }

  const bestFunctionByName = new Map();
  for (const item of (result.functions || []).filter((entry) => entry?.name)) {
    const lineCount = item.endLine - item.startLine + 1;
    if (lineCount < 10 && !exportedNames.has(item.name)) continue;
    const previous = bestFunctionByName.get(item.name);
    if (!previous || lineCount > previous.endLine - previous.startLine + 1) {
      bestFunctionByName.set(item.name, item);
    }
  }
  for (const item of bestFunctionByName.values()) {
    const lineCount = item.endLine - item.startLine + 1;
    const id = `function:${file.path}:${item.name}`;
    nodes.push({
      id,
      type: 'function',
      name: item.name,
      filePath: file.path,
      lineRange: [item.startLine, item.endLine],
      summary: FUNCTION_SUMMARIES.get(item.name) || `实现 ${item.name} 的核心处理流程。`,
      tags: functionTags(item.name),
      complexity: complexityFromLines(lineCount),
    });
    significantNodeIds.add(id);
    edges.push({ source: nodeId, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exportedNames.has(item.name)) {
      edges.push({ source: nodeId, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }

  for (const importedPath of batch.batchImportData[file.path] || []) {
    edges.push({
      source: nodeId,
      target: `file:${importedPath}`,
      type: 'imports',
      direction: 'forward',
      weight: 0.7,
    });
  }
}

const nodeCount = nodes.length;
const edgeCount = edges.length;
const partCount = Math.ceil(Math.max(nodeCount / 60, edgeCount / 120));
const sortedPaths = [...expectedPaths].sort((a, b) => a.localeCompare(b));
const chunkSize = Math.ceil(sortedPaths.length / partCount);
const parts = [];
for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
  const partPaths = new Set(sortedPaths.slice(partIndex * chunkSize, (partIndex + 1) * chunkSize));
  if (!partPaths.size) continue;
  const partNodes = nodes.filter((node) => partPaths.has(node.filePath));
  const partNodeIds = new Set(partNodes.map((node) => node.id));
  const partEdges = edges.filter((edge) => partNodeIds.has(edge.source));
  parts.push({ nodes: partNodes, edges: partEdges });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const allNodeIds = new Set(nodes.map((node) => node.id));
if (allNodeIds.size !== nodes.length) throw new Error('batch 11 存在重复节点 ID');

for (const node of nodes) {
  for (const field of ['id', 'type', 'name', 'summary', 'tags', 'complexity']) {
    if (node[field] === undefined || node[field] === null || node[field] === '') {
      throw new Error(`节点 ${node.id} 缺少必填字段 ${field}`);
    }
  }
  if (!allowedTypes.has(node.type)) throw new Error(`节点 ${node.id} 类型非法: ${node.type}`);
  if (!allowedComplexity.has(node.complexity)) throw new Error(`节点 ${node.id} 复杂度非法`);
  if (!Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5) throw new Error(`节点 ${node.id} 标签数量非法`);
  if ((node.type === 'function' || node.type === 'class') && (!Array.isArray(node.lineRange) || node.lineRange.length !== 2)) {
    throw new Error(`符号节点 ${node.id} 缺少 lineRange`);
  }
}

const fileLevelNodes = nodes.filter((node) => !['function', 'class'].includes(node.type));
if (fileLevelNodes.length !== expectedPaths.length) throw new Error(`文件节点数不匹配: ${fileLevelNodes.length}/${expectedPaths.length}`);
for (const filePath of expectedPaths) {
  const matches = fileLevelNodes.filter((node) => node.filePath === filePath);
  if (matches.length !== 1) throw new Error(`文件节点覆盖错误 ${filePath}: ${matches.length}`);
}

for (const edge of edges) {
  if (edge.source === edge.target) throw new Error(`自引用边: ${edge.source}`);
  if (!allNodeIds.has(edge.source)) throw new Error(`边源节点不存在: ${edge.source}`);
  if (!allNodeIds.has(edge.target) && edge.type !== 'imports') throw new Error(`边目标节点不存在: ${edge.target}`);
}

const expectedImportCount = batch.files
  .filter((file) => file.fileCategory === 'code')
  .reduce((sum, file) => sum + (batch.batchImportData[file.path] || []).length, 0);
const actualImportCount = edges.filter((edge) => edge.type === 'imports').length;
if (expectedImportCount !== actualImportCount) {
  throw new Error(`imports 边数量不匹配: ${actualImportCount}/${expectedImportCount}`);
}

const expectedSignificantIds = new Set();
for (const file of batch.files) {
  const result = extractedByPath.get(file.path);
  if (!result) continue;
  const exportedNames = new Set((result.exports || []).map((item) => item.name).filter(Boolean));
  for (const item of (result.classes || []).filter((entry) => entry?.name)) {
    const lineCount = item.endLine - item.startLine + 1;
    if (lineCount >= 20 || (item.methods || []).length >= 2 || exportedNames.has(item.name)) {
      expectedSignificantIds.add(`class:${file.path}:${item.name}`);
    }
  }
  for (const item of (result.functions || []).filter((entry) => entry?.name)) {
    const lineCount = item.endLine - item.startLine + 1;
    if (lineCount >= 10 || exportedNames.has(item.name)) {
      expectedSignificantIds.add(`function:${file.path}:${item.name}`);
    }
  }
}
for (const id of expectedSignificantIds) {
  if (!significantNodeIds.has(id)) throw new Error(`遗漏显著符号节点: ${id}`);
}

parts.forEach((fragment, index) => {
  const partIds = new Set(fragment.nodes.map((node) => node.id));
  for (const edge of fragment.edges) {
    if (!partIds.has(edge.source)) throw new Error(`part ${index + 1} 边源不在本 part: ${edge.source}`);
    if (!partIds.has(edge.target) && edge.type !== 'imports') throw new Error(`part ${index + 1} 边目标不在本 part: ${edge.target}`);
  }
  const outputPath = path.join(uaDir, 'intermediate', `batch-11-part-${index + 1}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8');
  JSON.parse(fs.readFileSync(outputPath, 'utf8'));
});

console.log(JSON.stringify({
  batchIndex,
  files: expectedPaths.length,
  skippedFiles: [...skipped],
  nodes: nodeCount,
  edges: edgeCount,
  importsExpected: expectedImportCount,
  importsActual: actualImportCount,
  parts: parts.map((fragment, index) => ({
    file: `batch-11-part-${index + 1}.json`,
    nodes: fragment.nodes.length,
    edges: fragment.edges.length,
  })),
}, null, 2));
