import fs from 'node:fs';
import path from 'node:path';

const projectRoot = 'D:/midDOW/lively-core-separation/lively-core-separation';
const uaDir = path.join(projectRoot, '.ua');
const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8')).batches;
const batch = batches.find((item) => item.batchIndex === 29);
const extraction = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', 'ua-file-extract-results-29.json'), 'utf8'));
if (!batch) throw new Error('batches.json 中缺少原始批次 29');
if (!extraction.scriptCompleted) throw new Error('批次 29 的官方结构提取未完成');
if (batch.files.length !== 1 || batch.files[0].path !== 'src/installer/Theme/wizard_small.bmp') throw new Error('批次 29 文件清单与预期不符');

const file = batch.files[0];
const nodes = [{
  id: `file:${file.path}`,
  type: 'file',
  name: path.basename(file.path),
  filePath: file.path,
  summary: '提供 Inno Setup 安装向导标题区域使用的小尺寸 Lively 品牌位图。',
  tags: ['bitmap', '安装主题', '品牌资源'],
  complexity: 'simple',
  languageNotes: '该 BMP 由 Inno Setup 的 WizardSmallImageFile 配置作为安装向导资源加载。',
}];
const edges = [];
for (const target of batch.batchImportData[file.path] ?? []) {
  edges.push({ source: `file:${file.path}`, target: `file:${target}`, type: 'imports', direction: 'forward', weight: 0.7 });
}
if (edges.length !== (batch.batchImportData[file.path] ?? []).length) throw new Error('imports 边计数不匹配');
if (!nodes[0].summary || nodes[0].tags.length !== 3 || nodes[0].complexity !== 'simple') throw new Error('节点字段无效');

const outputPath = path.join(uaDir, 'intermediate', 'batch-29.json');
fs.writeFileSync(outputPath, `${JSON.stringify({ nodes, edges }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputPath, nodes: nodes.length, edges: edges.length, imports: edges.length, files: batch.files.length, skipped: extraction.filesSkipped?.length ?? 0 }));
