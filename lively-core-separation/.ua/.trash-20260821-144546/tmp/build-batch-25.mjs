import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 25);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-25.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 25');
if (!extraction.scriptCompleted) throw new Error('批次 25 的官方结构提取未完成');

const cultures = {
  'be-BY': '白俄罗斯语',
  'bg-BG': '保加利亚语',
  'ca-ES': '加泰罗尼亚语',
  'cs-CZ': '捷克语',
  'da-DK': '丹麦语',
  'de-DE': '德语',
  'el-GR': '希腊语',
  'es-ES': '西班牙（西班牙）语',
  'es-MX': '西班牙（墨西哥）语',
  'fa-IR': '波斯语',
  'fi-FI': '芬兰语',
  'fil-PH': '菲律宾语',
  'fr-FR': '法语',
  'ga-IE': '爱尔兰语',
  'gl-ES': '加利西亚语',
  'he-IL': '希伯来语',
  'hi-IN': '印地语',
  'hu-HU': '匈牙利语',
  'id-ID': '印度尼西亚语',
  'it-IT': '意大利语',
  'ja-JP': '日语',
  'kk-KZ': '哈萨克语',
  'ko-KR': '韩语',
  'lt-LT': '立陶宛语',
  'ms-MY': '马来语',
};

const nodes = batch.files.map((file) => {
  const match = path.basename(file.path).match(/^Resources\.(.+)\.resx$/);
  const cultureCode = match?.[1];
  const language = cultures[cultureCode];
  if (!language) throw new Error(`未识别的文化资源: ${file.path}`);
  return {
    id: `file:${file.path}`,
    type: 'file',
    name: path.basename(file.path),
    filePath: file.path,
    summary: `提供 Lively 核心界面的${language}本地化字符串，覆盖壁纸管理、设置、图库、屏幕保护和状态提示等文本键。`,
    tags: ['resx', '本地化', language],
    complexity: 'complex',
    languageNotes: `该 .resx 资源使用 ${cultureCode} CultureInfo，在构建时嵌入程序集并由 ResourceManager 按当前区域性选择。`,
  };
});

const edges = [];
for (const file of batch.files.filter((item) => item.fileCategory === 'code')) {
  for (const target of batch.batchImportData[file.path] ?? []) {
    edges.push({ source: `file:${file.path}`, target: `file:${target}`, type: 'imports', direction: 'forward', weight: 0.7 });
  }
}

const ids = new Set();
for (const node of nodes) {
  if (ids.has(node.id)) throw new Error(`重复节点 ID: ${node.id}`);
  ids.add(node.id);
  if (!node.summary || !Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5 || node.complexity !== 'complex') throw new Error(`节点字段无效: ${node.id}`);
}
if (nodes.length !== 25 || nodes.length !== batch.files.length) throw new Error(`文件节点数异常: ${nodes.length}/${batch.files.length}`);
for (const file of batch.files) if (!nodes.some((node) => node.filePath === file.path)) throw new Error(`缺少文件节点: ${file.path}`);
const expectedImports = batch.files.filter((file) => file.fileCategory === 'code').reduce((sum, file) => sum + (batch.batchImportData[file.path] ?? []).length, 0);
if (edges.length !== expectedImports) throw new Error(`imports 边不匹配: ${expectedImports}/${edges.length}`);
if (nodes.length > 60 || edges.length > 120) throw new Error('批次 25 不应分片');

const outputPath = path.join(uaDir, 'intermediate', 'batch-25.json');
fs.writeFileSync(outputPath, `${JSON.stringify({ nodes, edges }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, nodes: nodes.length, edges: edges.length, imports: edges.length, files: batch.files.length, skipped: extraction.filesSkipped?.length ?? 0 }));
