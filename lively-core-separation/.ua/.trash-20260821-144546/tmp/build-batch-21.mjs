import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 21);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-21.json'), 'utf8'));

if (!batch) throw new Error('batches.json 中缺少原始批次 21');
if (!extraction.scriptCompleted) throw new Error('批次 21 的官方结构提取未完成');

const purposeByView = {
  GalleryLoginView: '图库账号登录页',
  GallerySubscriptionView: '图库订阅状态与权益页面',
  GalleryView: '在线图库的主导航页面',
  ManageAccountView: '图库账号管理页面',
  ReportWallpaperView: '图库壁纸举报页面',
  RestoreWallpaperView: '图库壁纸恢复页面',
  ShareWallpaperView: '图库壁纸分享页面',
  HelpView: '帮助与社区入口页面',
  LibraryAboutView: '本地壁纸详情页面',
  LibraryView: '本地壁纸库主页面',
  PatreonSupportersView: 'Patreon 支持者致谢页面',
  FindMoreAppsView: '关联应用推荐页面',
  SettingsGeneralView: '通用设置页面',
};

const detailByView = {
  GalleryLoginView: '呈现账号认证提示、登录操作与登录状态',
  GallerySubscriptionView: '呈现订阅方案、权益信息与订阅操作',
  GalleryView: '组织图库分区导航，并依据认证状态切换可访问页面',
  ManageAccountView: '呈现账号资料、导出、退出与删除等管理操作',
  ReportWallpaperView: '收集举报原因与附加说明并提交壁纸举报',
  RestoreWallpaperView: '展示恢复进度与结果，用于重新取得图库壁纸',
  ShareWallpaperView: '提供壁纸链接或压缩包等分享方式',
  HelpView: '汇集官网、文档、社区、源码与问题反馈入口',
  LibraryAboutView: '展示所选壁纸的标题、作者、说明与来源信息',
  LibraryView: '展示壁纸网格并支持选择、右键菜单和拖放导入',
  PatreonSupportersView: '通过 WebView2 加载支持者内容并处理外部链接与导航状态',
  FindMoreAppsView: '展示可进一步获取的关联应用和跳转入口',
  SettingsGeneralView: '配置语言、启动行为、界面主题与常规应用选项',
};

const functionDescriptions = {
  GalleryView: '初始化图库导航页，建立页面映射并根据当前认证状态选择初始内容。',
  NavigatePage: '根据导航标签和可选参数切换图库子页面，同时避免重复导航。',
  LibraryView: '初始化壁纸库页面，并取得桌面核心、设置、对话框和显示器等依赖。',
  contextMenu_Click: '处理壁纸右键菜单命令，分派设置、预览、编辑、导出和删除等操作。',
  GridView_RightTapped: '响应壁纸网格右键操作，选中目标磁贴并打开其上下文菜单。',
  MoreButton_Click: '响应壁纸磁贴的更多操作按钮，定位目标并显示上下文菜单。',
  Page_Drop: '处理拖放到壁纸库的文件或链接，校验输入后启动相应的添加流程。',
  Page_DragOver: '在拖放悬停期间检查数据类型，并更新允许的拖放效果与提示。',
  PatreonSupportersView: '初始化支持者页面，绑定视图模型并启动 WebView2 内容加载。',
  InitializeWebView2Async: '异步准备 WebView2 环境并导航到支持者页面内容。',
  WebView_CoreWebView2Initialized: '完成 WebView2 初始化后的安全设置、事件订阅和页面导航配置。',
  OnClose: '关闭支持者页面并释放其 WebView2 导航状态。',
};

function viewNameFromPath(filePath) {
  return path.basename(filePath).replace(/\.xaml\.cs$/i, '').replace(/\.xaml$/i, '');
}

function fileId(file) {
  return `${file.fileCategory === 'config' ? 'config' : 'file'}:${file.path}`;
}

function complexityFromLines(lines) {
  if (lines > 200) return 'complex';
  if (lines >= 50) return 'moderate';
  return 'simple';
}

function fileSummary(file) {
  const viewName = viewNameFromPath(file.path);
  const purpose = purposeByView[viewName] ?? `${viewName} 页面`;
  const detail = detailByView[viewName] ?? '承载该页面的交互内容';
  if (file.path.endsWith('.xaml')) {
    return `以 WinUI XAML 定义${purpose}的视觉结构，${detail}。`;
  }
  if (file.path.endsWith('.xaml.cs')) {
    return `实现${purpose}的代码隐藏层，${detail}。`;
  }
  return `实现 ${path.basename(file.path)} 对应的项目功能。`;
}

function fileTags(file) {
  const viewName = viewNameFromPath(file.path);
  const domain = viewName.startsWith('Gallery') || ['ManageAccountView', 'ReportWallpaperView', 'RestoreWallpaperView', 'ShareWallpaperView'].includes(viewName)
    ? '在线图库'
    : viewName.includes('Library')
      ? '壁纸库'
      : viewName.includes('Settings') || viewName === 'FindMoreAppsView'
        ? '设置'
        : viewName === 'PatreonSupportersView'
          ? 'webview2'
          : '用户界面';
  return file.path.endsWith('.xaml')
    ? ['xaml', 'winui', domain]
    : ['csharp', '代码隐藏', domain];
}

function fileLanguageNotes(file) {
  return file.path.endsWith('.xaml')
    ? '使用 WinUI XAML 的控件层级、数据绑定和资源引用声明页面。'
    : 'C# partial 类作为对应 XAML 页面的代码隐藏层。';
}

function classSummary(className) {
  const purpose = purposeByView[className] ?? `${className} 页面`;
  if (className === 'LibraryView') {
    return '协调本地壁纸库的网格交互、上下文命令和拖放导入，是壁纸管理界面的主要事件承载类。';
  }
  if (className === 'GalleryView') {
    return '协调在线图库的分区导航与登录状态，根据导航项映射切换对应页面。';
  }
  if (className === 'PatreonSupportersView') {
    return '托管 Patreon 支持者页面的 WebView2 生命周期、导航策略和外部链接处理。';
  }
  if (className === 'HelpView') {
    return '承载帮助页面，并将各帮助卡片事件转发到官网、文档、社区、源码和问题反馈地址。';
  }
  return `承载${purpose}，负责初始化页面并连接 XAML 视图与相关视图模型。`;
}

function classTags(className) {
  if (className === 'LibraryView') return ['class', 'winui', '壁纸库', 'event-handler'];
  if (className === 'PatreonSupportersView') return ['class', 'winui', 'webview2', '事件处理'];
  if (className === 'GalleryView') return ['class', 'winui', '在线图库', '导航'];
  return ['class', 'winui', '页面组件'];
}

function constructorSummary(name) {
  const purpose = purposeByView[name] ?? `${name} 页面`;
  return `初始化${purpose}，加载 XAML 组件并建立所需的页面状态。`;
}

function functionSummary(name, ownerClass) {
  if (functionDescriptions[name]) return functionDescriptions[name];
  if (name === ownerClass) return constructorSummary(name);
  if (name.includes('_')) return `响应 ${name} 对应的界面事件，并同步页面状态或用户操作结果。`;
  return `执行 ${name} 对应的页面逻辑，并维护相关界面状态。`;
}

function functionTags(name, filePath) {
  const viewName = viewNameFromPath(filePath);
  const domain = viewName === 'LibraryView' ? '壁纸库' : viewName === 'PatreonSupportersView' ? 'webview2' : viewName === 'GalleryView' ? '在线图库' : '页面逻辑';
  if (name.includes('_')) return ['function', 'event-handler', domain];
  if (name === viewName) return ['function', '初始化', domain];
  return ['function', 'ui-logic', domain];
}

const resultsByPath = new Map(extraction.results.map((item) => [item.path, item]));
const nodes = [];
const edges = [];
const nodeIds = new Set();
const edgeKeys = new Set();

function addNode(node) {
  if (nodeIds.has(node.id)) throw new Error(`重复节点 ID: ${node.id}`);
  nodeIds.add(node.id);
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
  const effectiveLines = result?.nonEmptyLines ?? file.sizeLines;
  addNode({
    id: fileId(file),
    type: file.fileCategory === 'config' ? 'config' : 'file',
    name: path.basename(file.path),
    filePath: file.path,
    summary: fileSummary(file),
    tags: fileTags(file),
    complexity: complexityFromLines(effectiveLines),
    languageNotes: fileLanguageNotes(file),
  });
}

for (const file of batch.files) {
  const result = resultsByPath.get(file.path);
  if (!result) continue;
  const source = fileId(file);
  const exportedNames = new Set((result.exports ?? []).map((item) => item.name).filter(Boolean));
  const classNames = (result.classes ?? []).map((item) => item.name).filter(Boolean);

  for (const cls of result.classes ?? []) {
    if (!cls.name || !Number.isInteger(cls.startLine) || !Number.isInteger(cls.endLine)) continue;
    const length = cls.endLine - cls.startLine + 1;
    const significant = (cls.methods?.length ?? 0) >= 2 || length >= 20 || exportedNames.has(cls.name);
    if (!significant) continue;
    const id = `class:${file.path}:${cls.name}`;
    addNode({
      id,
      type: 'class',
      name: cls.name,
      filePath: file.path,
      lineRange: [cls.startLine, cls.endLine],
      summary: classSummary(cls.name),
      tags: classTags(cls.name),
      complexity: complexityFromLines(length),
    });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exportedNames.has(cls.name)) {
      addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }

  const bestFunctionByName = new Map();
  for (const fn of result.functions ?? []) {
    if (!fn.name || !Number.isInteger(fn.startLine) || !Number.isInteger(fn.endLine)) continue;
    const current = bestFunctionByName.get(fn.name);
    const length = fn.endLine - fn.startLine + 1;
    const currentLength = current ? current.endLine - current.startLine + 1 : -1;
    if (!current || length > currentLength) bestFunctionByName.set(fn.name, fn);
  }
  for (const [name, fn] of bestFunctionByName) {
    const length = fn.endLine - fn.startLine + 1;
    if (length < 10 && !exportedNames.has(name)) continue;
    const id = `function:${file.path}:${name}`;
    const ownerClass = classNames.find((className) => className === name) ?? classNames[0] ?? '';
    addNode({
      id,
      type: 'function',
      name,
      filePath: file.path,
      lineRange: [fn.startLine, fn.endLine],
      summary: functionSummary(name, ownerClass),
      tags: functionTags(name, file.path),
      complexity: complexityFromLines(length),
    });
    addEdge({ source, target: id, type: 'contains', direction: 'forward', weight: 1.0 });
    if (exportedNames.has(name)) {
      addEdge({ source, target: id, type: 'exports', direction: 'forward', weight: 0.8 });
    }
  }
}

const batchPaths = new Set(batch.files.map((file) => file.path));
for (const file of batch.files) {
  if (!file.path.endsWith('.xaml.cs')) continue;
  const xamlPath = file.path.slice(0, -3);
  if (!batchPaths.has(xamlPath)) continue;
  addEdge({
    source: fileId(file),
    target: `file:${xamlPath}`,
    type: 'depends_on',
    direction: 'forward',
    weight: 0.6,
  });
}

for (const file of batch.files.filter((item) => item.fileCategory === 'code')) {
  for (const targetPath of batch.batchImportData[file.path] ?? []) {
    addEdge({
      source: fileId(file),
      target: `file:${targetPath}`,
      type: 'imports',
      direction: 'forward',
      weight: 0.7,
    });
  }
}

const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
const edgeWeights = { contains: 1.0, imports: 0.7, calls: 0.8, inherits: 0.9, implements: 0.9, exports: 0.8, depends_on: 0.6, tested_by: 0.5 };

if (nodes.length !== 58) throw new Error(`节点数异常：预期 58，实际 ${nodes.length}`);
if (edges.length !== 70) throw new Error(`边数异常：预期 70，实际 ${edges.length}`);
if (nodes.filter((node) => ['file', 'config', 'document', 'service', 'pipeline', 'schema', 'resource'].includes(node.type)).length !== batch.files.length) {
  throw new Error('并非每个批次文件都对应一个文件级节点');
}
for (const node of nodes) {
  if (!node.id || !allowedTypes.has(node.type) || !node.name || !node.summary || !Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5 || !allowedComplexity.has(node.complexity)) {
    throw new Error(`节点必填字段无效: ${node.id}`);
  }
  if (['function', 'class'].includes(node.type) && (!Array.isArray(node.lineRange) || node.lineRange.length !== 2)) {
    throw new Error(`子文件节点缺少 lineRange: ${node.id}`);
  }
}
for (const edge of edges) {
  if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) throw new Error(`边端点不存在: ${JSON.stringify(edge)}`);
  if (edge.direction !== 'forward' || edgeWeights[edge.type] !== edge.weight) throw new Error(`边字段无效: ${JSON.stringify(edge)}`);
}
const expectedImports = batch.files.filter((file) => file.fileCategory === 'code').reduce((sum, file) => sum + (batch.batchImportData[file.path] ?? []).length, 0);
const actualImports = edges.filter((edge) => edge.type === 'imports').length;
if (actualImports !== expectedImports) throw new Error(`imports 边数不匹配：预期 ${expectedImports}，实际 ${actualImports}`);

const fragment = { nodes, edges };
const outputPath = path.join(uaDir, 'intermediate', 'batch-21.json');
fs.writeFileSync(outputPath, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, nodes: nodes.length, edges: edges.length, imports: actualImports, files: batch.files.length, skipped: extraction.filesSkipped?.length ?? 0 }));
