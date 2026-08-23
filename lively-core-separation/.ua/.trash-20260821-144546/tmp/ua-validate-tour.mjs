import fs from 'node:fs';

const [tourPath, resultsPath] = process.argv.slice(2);
const tour = JSON.parse(fs.readFileSync(tourPath, 'utf8'));
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const errors = [];
const knownIds = new Set(Object.keys(results.nodeSummaryIndex ?? {}));
const hasChinese = (value) => /[\u3400-\u9fff]/u.test(value);
const isExcludedPath = (id) => /(?:^|[/:\\])(?:bin|obj)(?:[/:\\]|$)/iu.test(id);

if (!Array.isArray(tour)) errors.push('tour.json 顶层必须为数组');
if (Array.isArray(tour) && (tour.length < 5 || tour.length > 15)) {
  errors.push(`步骤数 ${tour.length} 不在 5–15 范围内`);
}

const referencedIds = [];
for (let index = 0; index < tour.length; index += 1) {
  const step = tour[index];
  const expectedOrder = index + 1;
  if (step.order !== expectedOrder) errors.push(`第 ${expectedOrder} 项的 order 为 ${step.order}`);
  if (typeof step.title !== 'string' || !step.title.trim() || !hasChinese(step.title)) {
    errors.push(`步骤 ${expectedOrder} 标题缺失或不是中文`);
  }
  if (typeof step.description !== 'string' || !step.description.trim() || !hasChinese(step.description)) {
    errors.push(`步骤 ${expectedOrder} 描述缺失或不是中文`);
  } else {
    const sentences = step.description.split(/[。！？]/u).filter((part) => part.trim()).length;
    if (sentences < 2 || sentences > 4) errors.push(`步骤 ${expectedOrder} 描述为 ${sentences} 句`);
  }
  if ('languageLesson' in step && (typeof step.languageLesson !== 'string' || !hasChinese(step.languageLesson))) {
    errors.push(`步骤 ${expectedOrder} languageLesson 缺失中文说明`);
  }
  if (!Array.isArray(step.nodeIds) || step.nodeIds.length < 1 || step.nodeIds.length > 5) {
    errors.push(`步骤 ${expectedOrder} nodeIds 数量不在 1–5 范围内`);
    continue;
  }
  for (const id of step.nodeIds) {
    referencedIds.push(id);
    if (!knownIds.has(id)) errors.push(`步骤 ${expectedOrder} 引用了不存在的节点 ${id}`);
    if (isExcludedPath(id)) errors.push(`步骤 ${expectedOrder} 引用了已排除的 bin/obj 路径 ${id}`);
  }
}

if (tour[0]?.nodeIds?.[0] !== 'document:README.md') errors.push('步骤 1 未从 README 项目概览开始');

const coverage = {
  '核心启动': referencedIds.includes('file:src/Lively/Lively/App.xaml.cs'),
  '桌面核心与编排': referencedIds.includes('file:src/Lively/Lively/Core/WinDesktopCore.cs'),
  'WinUI/MVVM': referencedIds.some((id) => id.includes('Lively.UI.WinUI')) && referencedIds.some((id) => id.includes('ViewModels')),
  '壁纸运行时与播放器': referencedIds.some((id) => id.includes('Core/Wallpapers/')) && referencedIds.some((id) => /Lively\.Player\.[^/]+\/Program\.cs$/u.test(id)),
  'gRPC/Protobuf 契约': referencedIds.some((id) => id.startsWith('schema:') && id.includes('/Proto/')) && referencedIds.some((id) => id.includes('WinDesktopCoreServer.cs')),
  '配置/构建/安装': referencedIds.some((id) => id.endsWith('Lively.sln')) && referencedIds.some((id) => id.includes('src/installer/'))
};
for (const [area, covered] of Object.entries(coverage)) {
  if (!covered) errors.push(`缺少指定覆盖领域：${area}`);
}

if (errors.length > 0) {
  console.error(JSON.stringify({valid: false, errors}, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  steps: tour.length,
  references: referencedIds.length,
  uniqueNodeIds: new Set(referencedIds).size,
  graphNodesAvailable: knownIds.size,
  sequentialOrders: true,
  allReferencesResolved: true,
  excludedBinObjReferences: 0,
  coverage
}, null, 2));
