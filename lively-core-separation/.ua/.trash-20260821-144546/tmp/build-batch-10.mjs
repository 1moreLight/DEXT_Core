import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 10);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-10.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 10');
if (!extraction.scriptCompleted) throw new Error('批次 10 的官方结构提取未完成');

const summaries = {
  'src/Lively/Lively.Models/LivelyControls/FolderDropdownModel.cs': '定义文件夹下拉属性控件的 JSON 模型，保存当前值、起始文件夹和文件筛选器。',
  'src/Lively/Lively.Models/LivelyControls/IDropdownItem.cs': '定义带字符串选项集合的下拉控件模型契约。',
  'src/Lively/Lively.Models/LivelyControls/LabelModel.cs': '定义只读标签属性控件的 JSON 模型和显示值。',
  'src/Lively/Lively.Models/LivelyControls/LocalizationFile.cs': '定义壁纸属性本地化文件的根模型，把语言代码映射到每种语言的控件字符串字典。',
  'src/Lively/Lively.Models/LivelyControls/LocalizationLanguage.cs': '表示单一语言的壁纸属性本地化字典，把控件键映射为本地化文本集合。',
  'src/Lively/Lively.Models/LivelyControls/LocalizedStrings.cs': '保存控件的本地化文本、值、帮助说明和下拉选项。',
  'src/Lively/Lively.Models/LivelyControls/ScalerDropdownModel.cs': '定义壁纸缩放模式下拉控件的 JSON 模型，保存选中值和可选缩放项。',
  'src/Lively/Lively.Models/LivelyControls/SliderModel.cs': '定义滑块属性控件的 JSON 模型，保存刻度、最小值、最大值、当前值和步长。',
  'src/Lively/Lively.Models/LivelyControls/TextboxModel.cs': '定义文本输入属性控件的 JSON 模型和当前字符串值。',
  'src/Lively/Lively.Models/LivelyInfoLocalizationFile.cs': '定义壁纸元数据本地化文件，把语言代码映射到对应的 LivelyInfoModel。',
  'src/Lively/Lively.Models/LivelyInfoModel.cs': '描述 livelyinfo.json 壁纸元数据，包括标题、作者、预览、类型、入口文件、启动参数、图库标识、标签和版本。',
  'src/Lively/Lively.Models/Message/ConsoleMessageType.cs': '定义壁纸 IPC 控制台消息的日志、错误和普通控制台输出类别。',
  'src/Lively/Lively.Models/Message/IpcMessage.cs': '提供可序列化 IPC 消息的抽象基类，以 MessageType 作为 JSON 多态消息判别值。',
  'src/Lively/Lively.Models/Message/LivelyButton.cs': '表示壁纸属性按钮点击消息，携带控件名称及是否为默认操作。',
  'src/Lively/Lively.Models/Message/LivelyCheckbox.cs': '表示壁纸属性复选框变更消息，携带控件名称和布尔值。',
  'src/Lively/Lively.Models/Message/LivelyCloseCmd.cs': '表示请求壁纸后端关闭的无负载 IPC 命令。',
  'src/Lively/Lively.Models/Message/LivelyColorPicker.cs': '表示壁纸颜色选择器变更消息，携带控件名称和颜色字符串。',
  'src/Lively/Lively.Models/Message/LivelyDropdown.cs': '表示普通壁纸下拉控件变更消息，携带控件名称和选中值。',
  'src/Lively/Lively.Models/Message/LivelyDropdownScaler.cs': '表示壁纸缩放模式下拉控件变更消息，携带控件名称和缩放值。',
  'src/Lively/Lively.Models/Message/LivelyFolderDropdown.cs': '表示壁纸文件夹下拉控件变更消息，携带控件名称和选中路径。',
  'src/Lively/Lively.Models/Message/LivelyMessageConsole.cs': '表示壁纸后端控制台输出消息，携带消息正文和输出类别。',
  'src/Lively/Lively.Models/Message/LivelyMessageHwnd.cs': '表示壁纸后端窗口就绪消息，携带原生窗口句柄。',
  'src/Lively/Lively.Models/Message/LivelyMessageScreenshot.cs': '表示壁纸截图完成消息，携带文件名和成功状态。',
  'src/Lively/Lively.Models/Message/LivelyMessageWallpaperLoaded.cs': '表示壁纸内容加载完成消息，携带加载是否成功。',
  'src/Lively/Lively.Models/Message/LivelyReloadCmd.cs': '表示请求壁纸后端重新加载内容的无负载 IPC 命令。',
};

const classDescriptions = {
  FolderDropdownModel: '保存文件夹下拉控件的值、浏览起点和过滤规则，并声明 folderDropdown 控件类型。',
  IDropdownItem: '约束下拉类属性模型必须公开可选字符串项。',
  LabelModel: '保存标签控件的显示值并声明 label 控件类型。',
  LocalizationFile: '作为控件本地化文件根对象，按语言代码组织 LocalizationLanguage。',
  LocalizationLanguage: '以 Dictionary 派生类承载一个语言下的控件键和 LocalizedStrings。',
  LocalizedStrings: '聚合单个控件可本地化的文本、值、帮助和选项字段。',
  ScalerDropdownModel: '保存缩放下拉的选中值和选项，并实现 IDropdownItem。',
  SliderModel: '保存滑块控件的数值范围、步长、刻度和当前值。',
  TextboxModel: '保存文本框控件值并声明 textbox 控件类型。',
  LivelyInfoLocalizationFile: '作为壁纸元数据本地化根对象，按语言代码组织 LivelyInfoModel。',
  LivelyInfoModel: '承载壁纸包的展示、作者、许可、启动和版本元数据，并支持默认初始化。',
  IpcMessage: '为所有壁纸 IPC 消息保存不可变的 MessageType 判别值。',
  LivelyButton: '封装按钮控件 IPC 负载。',
  LivelyCheckbox: '封装复选框控件 IPC 负载。',
  LivelyCloseCmd: '封装关闭壁纸的 IPC 命令。',
  LivelyColorPicker: '封装颜色选择器 IPC 负载。',
  LivelyDropdown: '封装普通下拉控件 IPC 负载。',
  LivelyDropdownScaler: '封装缩放模式下拉控件 IPC 负载。',
  LivelyFolderDropdown: '封装文件夹下拉控件 IPC 负载。',
  LivelyMessageConsole: '封装壁纸后端控制台输出 IPC 负载。',
  LivelyMessageHwnd: '封装壁纸窗口句柄 IPC 负载。',
  LivelyMessageScreenshot: '封装截图完成 IPC 负载。',
  LivelyMessageWallpaperLoaded: '封装壁纸加载完成 IPC 负载。',
  LivelyReloadCmd: '封装重新加载壁纸的 IPC 命令。',
};

function fileId(file) { return `file:${file.path}`; }
function complexity(lines) { return lines > 200 ? 'complex' : lines >= 50 ? 'moderate' : 'simple'; }
function domain(filePath) {
  if (filePath.includes('/Message/')) return 'ipc-message';
  if (filePath.includes('Localization')) return '本地化模型';
  if (filePath.endsWith('LivelyInfoModel.cs')) return '壁纸元数据';
  return '属性控件';
}
function fileTags(file) {
  if (file.path.includes('/Message/')) return ['csharp', 'data-model', 'ipc-message'];
  if (file.path.includes('Localization')) return ['csharp', 'data-model', '本地化'];
  if (file.path.endsWith('LivelyInfoModel.cs')) return ['csharp', 'data-model', '壁纸元数据'];
  return ['csharp', 'data-model', '属性控件'];
}
function languageNotes(file) {
  if (file.path.includes('/Message/')) return '使用 Serializable 和 Newtonsoft.Json 构成带 MessageType 判别值的轻量 IPC 数据传输对象。';
  if (file.path.includes('/LivelyControls/')) return '使用 Newtonsoft.Json 属性名映射到 livelyproperties.json 控件结构。';
  return '纯 C# POCO 模型用于 JSON 序列化和跨层数据传递。';
}
function classSummary(name) { return classDescriptions[name] ?? `封装 ${name} 的数据结构。`; }
function classTags(name, filePath) {
  if (name === 'IDropdownItem') return ['interface', '属性控件', '核心契约'];
  if (filePath.includes('/Message/')) return ['class', 'data-model', 'ipc-message'];
  if (filePath.includes('Localization')) return ['class', 'data-model', '本地化'];
  return ['class', 'data-model', domain(filePath)];
}

const constructorDescriptions = {
  FolderDropdownModel: '初始化文件夹下拉模型，并把控件类型设为 folderDropdown。',
  LabelModel: '初始化标签模型，并把控件类型设为 label。',
  ScalerDropdownModel: '初始化缩放下拉模型，并把控件类型设为 scalerDropdown。',
  SliderModel: '初始化滑块模型，并把控件类型设为 slider。',
  TextboxModel: '初始化文本框模型，并把控件类型设为 textbox。',
  LivelyInfoModel: '初始化壁纸元数据的应用版本、默认网页类型及其他空值和初始版本字段。',
  IpcMessage: '保存具体 IPC 消息的 MessageType 判别值。',
  LivelyButton: '初始化按钮消息并设置 lp_button 消息类型。',
  LivelyCheckbox: '初始化复选框消息并设置相应 MessageType。',
  LivelyCloseCmd: '初始化关闭命令并设置相应 MessageType。',
  LivelyColorPicker: '初始化颜色选择器消息并设置相应 MessageType。',
  LivelyDropdown: '初始化普通下拉消息并设置相应 MessageType。',
  LivelyDropdownScaler: '初始化缩放下拉消息并设置相应 MessageType。',
  LivelyFolderDropdown: '初始化文件夹下拉消息并设置相应 MessageType。',
  LivelyMessageConsole: '初始化控制台输出消息并设置相应 MessageType。',
  LivelyMessageHwnd: '初始化窗口句柄消息并设置相应 MessageType。',
  LivelyMessageScreenshot: '初始化截图结果消息并设置相应 MessageType。',
  LivelyMessageWallpaperLoaded: '初始化壁纸加载结果消息并设置相应 MessageType。',
  LivelyReloadCmd: '初始化重新加载命令并设置相应 MessageType。',
};
function functionSummary(name) { return constructorDescriptions[name] ?? `初始化 ${name} 数据模型。`; }
function functionTags(filePath) { return ['function', '初始化', domain(filePath), 'public-api']; }

const resultsByPath = new Map(extraction.results.map((item) => [item.path, item]));
const nodes = [], edges = [];
const nodeIds = new Set(), edgeKeys = new Set();
function addNode(node) { if (nodeIds.has(node.id)) throw new Error(`重复节点 ID: ${node.id}`); nodeIds.add(node.id); nodes.push(node); }
function addEdge(edge) { if (edge.source === edge.target) throw new Error(`自引用边: ${edge.source}`); const key = `${edge.source}|${edge.target}|${edge.type}`; if (edgeKeys.has(key)) return; edgeKeys.add(key); edges.push(edge); }

for (const file of batch.files) {
  const result = resultsByPath.get(file.path);
  addNode({ id: fileId(file), type: 'file', name: path.basename(file.path), filePath: file.path, summary: summaries[file.path], tags: fileTags(file), complexity: complexity(result?.nonEmptyLines ?? file.sizeLines), languageNotes: languageNotes(file) });
}
for (const file of batch.files) {
  const result = resultsByPath.get(file.path); if (!result) continue;
  const source = fileId(file);
  const exported = new Set((result.exports ?? []).map((item) => item.name).filter(Boolean));
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
    const id = `function:${file.path}:${name}`;
    addNode({ id, type: 'function', name, filePath: file.path, lineRange: [fn.startLine, fn.endLine], summary: functionSummary(name), tags: functionTags(file.path), complexity: complexity(length) });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exported.has(name)) addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
  }
}

const f = (p) => `file:${p}`, c = (p, n) => `class:${p}:${n}`;
const controls = 'src/Lively/Lively.Models/LivelyControls/';
addEdge({ source: c(`${controls}ScalerDropdownModel.cs`, 'ScalerDropdownModel'), target: c(`${controls}IDropdownItem.cs`, 'IDropdownItem'), type: 'implements', direction: 'forward', weight: 0.9 });
addEdge({ source: f(`${controls}LocalizationFile.cs`), target: f(`${controls}LocalizationLanguage.cs`), type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: f(`${controls}LocalizationLanguage.cs`), target: f(`${controls}LocalizedStrings.cs`), type: 'depends_on', direction: 'forward', weight: 0.6 });
addEdge({ source: f('src/Lively/Lively.Models/LivelyInfoLocalizationFile.cs'), target: f('src/Lively/Lively.Models/LivelyInfoModel.cs'), type: 'depends_on', direction: 'forward', weight: 0.6 });

for (const file of batch.files) {
  for (const target of batch.batchImportData[file.path] ?? []) addEdge({ source: fileId(file), target: f(target), type: 'imports', direction: 'forward', weight: 0.7 });
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const weights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5 };
if (nodes.length !== 68) throw new Error(`节点数异常: ${nodes.length}/68`);
if (edges.length !== 90) throw new Error(`边数异常: ${edges.length}/90`);
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
  for (const edge of partEdges) if (!partIds.has(edge.source) || !partIds.has(edge.target)) throw new Error(`分片 ${index + 1} 边端点不在本分片: ${edge.source} -> ${edge.target}`);
  const outputPath = path.join(uaDir, 'intermediate', `batch-10-part-${index + 1}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify({ nodes: partNodes, edges: partEdges }, null, 2)}\n`, 'utf8');
  totalNodes += partNodes.length; totalEdges += partEdges.length;
  parts.push({ outputPath, files: fileGroup.length, nodes: partNodes.length, edges: partEdges.length });
}
if (totalNodes !== nodes.length || totalEdges !== edges.length) throw new Error(`分片汇总不匹配: ${totalNodes}/${nodes.length} nodes, ${totalEdges}/${edges.length} edges`);
console.log(JSON.stringify({ parts, totals: { nodes: totalNodes, edges: totalEdges }, imports: actualImports, files: fileNodes.length, skipped: extraction.filesSkipped?.length ?? 0 }));
