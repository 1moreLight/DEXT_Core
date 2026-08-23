import fs from 'node:fs';
import path from 'node:path';

export function buildBatch(options) {
  const projectRoot = process.cwd();
  const uaDir = path.join(projectRoot, '.ua');
  const batchIndex = options.batchIndex;
  const batches = JSON.parse(fs.readFileSync(path.join(uaDir, 'intermediate', 'batches.json'), 'utf8'));
  const batch = batches.batches.find((item) => item.batchIndex === batchIndex);
  const extracted = JSON.parse(fs.readFileSync(path.join(uaDir, 'tmp', `ua-file-extract-results-${batchIndex}.json`), 'utf8'));
  if (!batch) throw new Error(`batches.json 中缺少原始 batchIndex ${batchIndex}`);
  if (!extracted.scriptCompleted) throw new Error(`batch ${batchIndex} 结构提取未成功完成`);

  const expectedPaths = batch.files.map((file) => file.path);
  const extractedByPath = new Map(extracted.results.map((result) => [result.path, result]));
  const skipped = new Set(extracted.filesSkipped || []);
  for (const filePath of expectedPaths) {
    if (!extractedByPath.has(filePath) && !skipped.has(filePath)) throw new Error(`结构结果缺失: ${filePath}`);
    if (!fs.existsSync(path.join(projectRoot, filePath))) throw new Error(`批次文件不存在: ${filePath}`);
  }

  const complexity = (lines) => lines < 50 ? 'simple' : lines <= 200 ? 'moderate' : 'complex';
  const defaultNodeType = (file) => {
    if (file.fileCategory === 'config') return 'config';
    if (file.fileCategory === 'docs') return 'document';
    if (file.fileCategory === 'infra') {
      if (/\.github\/workflows|\.gitlab-ci|jenkinsfile|\.circleci/i.test(file.path)) return 'pipeline';
      if (/\.tf(?:vars)?$|cloudformation|vagrantfile/i.test(file.path)) return 'resource';
      return 'service';
    }
    if (file.fileCategory === 'data') {
      if (/\.sql$/i.test(file.path)) return 'table';
      if (/openapi|swagger/i.test(file.path)) return 'endpoint';
      return 'schema';
    }
    return 'file';
  };
  const getNodeType = options.nodeType || defaultNodeType;
  const getNodeId = (file) => `${getNodeType(file)}:${file.path}`;

  const nodes = [];
  const edges = [];
  const significantIds = new Set();
  for (const file of batch.files) {
    const result = extractedByPath.get(file.path);
    if (!result) fs.readFileSync(path.join(projectRoot, file.path), 'utf8');
    const id = getNodeId(file);
    const fileNode = {
      id,
      type: getNodeType(file),
      name: path.posix.basename(file.path),
      filePath: file.path,
      summary: options.fileSummary(file, result),
      tags: options.fileTags(file, result),
      complexity: complexity(result?.nonEmptyLines ?? file.sizeLines),
    };
    const note = options.fileLanguageNotes?.(file, result);
    if (note) fileNode.languageNotes = note;
    nodes.push(fileNode);
    if (!result) continue;

    const exported = new Set((result.exports || []).map((item) => item.name).filter(Boolean));
    for (const item of (result.classes || []).filter((entry) => entry?.name)) {
      const lines = item.endLine - item.startLine + 1;
      if (lines < 20 && (item.methods || []).length < 2 && !exported.has(item.name)) continue;
      const symbolId = `class:${file.path}:${item.name}`;
      nodes.push({
        id: symbolId,
        type: 'class',
        name: item.name,
        filePath: file.path,
        lineRange: [item.startLine, item.endLine],
        summary: options.classSummary(file, item, result),
        tags: options.classTags(file, item, result),
        complexity: complexity(lines),
      });
      significantIds.add(symbolId);
      edges.push({ source: id, target: symbolId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exported.has(item.name)) edges.push({ source: id, target: symbolId, type: 'exports', direction: 'forward', weight: 0.8 });
    }

    const bestFunctions = new Map();
    for (const item of (result.functions || []).filter((entry) => entry?.name)) {
      const lines = item.endLine - item.startLine + 1;
      if (lines < 10 && !exported.has(item.name)) continue;
      const prior = bestFunctions.get(item.name);
      if (!prior || lines > prior.endLine - prior.startLine + 1) bestFunctions.set(item.name, item);
    }
    for (const item of bestFunctions.values()) {
      const lines = item.endLine - item.startLine + 1;
      const symbolId = `function:${file.path}:${item.name}`;
      nodes.push({
        id: symbolId,
        type: 'function',
        name: item.name,
        filePath: file.path,
        lineRange: [item.startLine, item.endLine],
        summary: options.functionSummary(file, item, result),
        tags: options.functionTags(file, item, result),
        complexity: complexity(lines),
      });
      significantIds.add(symbolId);
      edges.push({ source: id, target: symbolId, type: 'contains', direction: 'forward', weight: 1.0 });
      if (exported.has(item.name)) edges.push({ source: id, target: symbolId, type: 'exports', direction: 'forward', weight: 0.8 });
    }

    for (const importedPath of batch.batchImportData[file.path] || []) {
      edges.push({ source: id, target: `file:${importedPath}`, type: 'imports', direction: 'forward', weight: 0.7 });
    }
  }

  options.addEdges?.({ batch, expectedPaths, nodes, edges, nodeId: getNodeId });

  const allowedTypes = new Set(['file', 'function', 'class', 'config', 'document', 'service', 'table', 'endpoint', 'pipeline', 'schema', 'resource']);
  const allowedComplexity = new Set(['simple', 'moderate', 'complex']);
  const edgeWeights = new Map([
    ['contains', 1.0], ['imports', 0.7], ['calls', 0.8], ['inherits', 0.9], ['implements', 0.9],
    ['exports', 0.8], ['depends_on', 0.6], ['tested_by', 0.5], ['configures', 0.6],
    ['documents', 0.5], ['deploys', 0.7], ['migrates', 0.7], ['triggers', 0.6],
    ['defines_schema', 0.8], ['serves', 0.7], ['provisions', 0.7], ['routes', 0.6], ['related', 0.5],
  ]);
  const allIds = new Set(nodes.map((node) => node.id));
  if (allIds.size !== nodes.length) throw new Error('存在重复节点 ID');
  for (const node of nodes) {
    for (const field of ['id', 'type', 'name', 'summary', 'tags', 'complexity']) {
      if (node[field] === undefined || node[field] === null || node[field] === '') throw new Error(`节点 ${node.id} 缺少 ${field}`);
    }
    if (!allowedTypes.has(node.type)) throw new Error(`节点类型非法: ${node.id}`);
    if (!allowedComplexity.has(node.complexity)) throw new Error(`复杂度非法: ${node.id}`);
    if (!Array.isArray(node.tags) || node.tags.length < 3 || node.tags.length > 5) throw new Error(`标签数量非法: ${node.id}`);
    if (['function', 'class'].includes(node.type) && (!Array.isArray(node.lineRange) || node.lineRange.length !== 2)) throw new Error(`缺少 lineRange: ${node.id}`);
  }
  const fileNodes = nodes.filter((node) => !['function', 'class'].includes(node.type));
  if (fileNodes.length !== expectedPaths.length) throw new Error(`文件节点数不匹配: ${fileNodes.length}/${expectedPaths.length}`);
  for (const filePath of expectedPaths) if (fileNodes.filter((node) => node.filePath === filePath).length !== 1) throw new Error(`文件覆盖错误: ${filePath}`);
  for (const edge of edges) {
    if (!edgeWeights.has(edge.type)) throw new Error(`边类型非法: ${edge.type}`);
    if (edge.direction !== 'forward') throw new Error(`边方向非法: ${edge.source}`);
    if (edge.weight !== edgeWeights.get(edge.type)) throw new Error(`边权重非法: ${edge.type}=${edge.weight}`);
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
    for (const edge of partEdges) {
      if (!partIds.has(edge.source)) throw new Error(`part ${index + 1} 边源不在本 part: ${edge.source}`);
      if (!partIds.has(edge.target) && edge.type !== 'imports') throw new Error(`part ${index + 1} 边目标不在本 part: ${edge.target}`);
    }
    const fragment = { nodes: partNodes, edges: partEdges };
    const suffix = partCount === 1 ? '' : `-part-${index + 1}`;
    const fileName = `batch-${batchIndex}${suffix}.json`;
    const output = path.join(uaDir, 'intermediate', fileName);
    fs.writeFileSync(output, `${JSON.stringify(fragment, null, 2)}\n`, 'utf8');
    JSON.parse(fs.readFileSync(output, 'utf8'));
    parts.push({ file: fileName, nodes: partNodes.length, edges: partEdges.length });
  }

  return { batchIndex, files: expectedPaths.length, skippedFiles: [...skipped], nodes: nodeCount, edges: edgeCount, importsExpected: expectedImports, importsActual: actualImports, parts };
}
