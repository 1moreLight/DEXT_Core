const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(String(message) + '\n');
  process.exit(1);
}

function norm(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function directorySegments(filePath) {
  const parts = norm(filePath).split('/').filter(Boolean);
  return parts.slice(0, -1);
}

function commonDirectoryPrefix(paths) {
  if (!paths.length) return [];
  const directories = paths.map(directorySegments);
  if (directories.some((segments) => segments.length === 0)) return [];
  const prefix = [];
  const shortest = Math.min(...directories.map((segments) => segments.length));
  for (let index = 0; index < shortest; index++) {
    const segment = directories[0][index];
    if (directories.every((segments) => segments[index] === segment)) prefix.push(segment);
    else break;
  }
  return prefix;
}

function extensionClass(filePath) {
  const value = norm(filePath).toLowerCase();
  const base = path.posix.basename(value);
  if (/\.(test|spec)\./.test(base) || /(^test_|_test\.|tests\.cs$|test\.cs$)/.test(base)) return 'test';
  if (/\.config\./.test(base) || /\.(csproj|sln|props|projitems|shproj|json|ya?ml|config|settings)$/.test(base)) return 'config';
  if (/\.(md|rst)$/.test(base)) return 'documentation';
  if (/\.(proto|graphql|gql|prisma|sql)$/.test(base)) return 'types';
  return (path.posix.extname(base).replace(/^\./, '') || 'other');
}

function groupForPath(filePath, prefix, flat) {
  const normalized = norm(filePath);
  const parts = normalized.split('/').filter(Boolean);
  const dirs = parts.slice(0, -1);
  if (flat) return extensionClass(normalized);
  if (dirs.length <= prefix.length) return 'root';
  return dirs[prefix.length] || 'root';
}

function projectClusterForPath(filePath) {
  const parts = norm(filePath).split('/').filter(Boolean);
  if (!parts.length || parts.length === 1) return 'root';
  if (parts[0] === 'src' && parts[1] === 'Lively' && parts[2]) return `src/Lively/${parts[2]}`;
  if (parts[0] === 'src' && parts[1]) return `src/${parts[1]}`;
  if (parts[0] === '.github') return '.github';
  if (parts[0] === '.ua') return '.ua';
  if (parts[0] === 'schemas') return 'schemas';
  return parts[0] || 'root';
}

function patternForName(name) {
  const value = String(name || '').toLowerCase();
  const patterns = [
    ['api', ['routes','api','controllers','endpoints','handlers','controller','routers','blueprints','serializers']],
    ['service', ['services','core','lib','domain','logic','internal','signals','mailers','jobs','channels','composables']],
    ['data', ['models','db','data','persistence','repository','entities','entity','migrations','sql','database','schema']],
    ['ui', ['components','views','pages','ui','layouts','screens']],
    ['middleware', ['middleware','plugins','interceptors','guards']],
    ['utility', ['utils','helpers','common','shared','tools','pkg','templatetags']],
    ['config', ['config','constants','env','settings','management','commands']],
    ['test', ['__tests__','test','tests','spec','specs']],
    ['types', ['types','interfaces','schemas','contracts','dtos','dto','request','response']],
    ['state', ['store','state','reducers','actions','slices']],
    ['assets', ['assets','static','public']],
    ['entry', ['cmd','bin']],
    ['documentation', ['docs','documentation','wiki']],
    ['infrastructure', ['deploy','deployment','infra','infrastructure','k8s','kubernetes','helm','charts','terraform','tf','docker']],
    ['ci-cd', ['.github','.gitlab','.circleci']],
  ];
  for (const [label, names] of patterns) {
    if (names.some((candidate) => value === candidate || value.includes(candidate))) return label;
  }
  return null;
}

function filePattern(filePath) {
  const value = norm(filePath).toLowerCase();
  const base = path.posix.basename(value);
  if (/\.(test|spec)\./.test(base) || /^test_/.test(base) || /_test\./.test(base) || /tests?\.cs$/.test(base)) return 'test';
  if (base.endsWith('.d.ts')) return 'types';
  if (['index.ts','index.js','__init__.py','manage.py','main.rs','lib.rs','application.java','program.cs','config.ru'].includes(base)) return 'entry';
  if (['wsgi.py','asgi.py','cargo.toml','go.mod','gemfile','pom.xml','build.gradle','composer.json'].includes(base)) return 'config';
  if (base === 'dockerfile' || base.startsWith('docker-compose.') || /\.(tf|tfvars)$/.test(base)) return 'infrastructure';
  if (value.startsWith('.github/workflows/') || base === '.gitlab-ci.yml' || base === 'jenkinsfile') return 'ci-cd';
  if (base.endsWith('.sql')) return 'data';
  if (/\.(graphql|gql|proto)$/.test(base)) return 'types';
  if (/\.(md|rst)$/.test(base)) return 'documentation';
  if (base === 'makefile') return 'infrastructure';
  return null;
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function sortedObjectOfArrays(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, [...values].sort()]));
}

function countTop(values, limit = 12) {
  const counts = new Map();
  for (const value of values) increment(counts, value);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([name, count]) => ({ name, count }));
}

try {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) fail('usage: node ua-arch-analyze.js <input.json> <output.json>');
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const fileNodes = Array.isArray(input.fileNodes) ? input.fileNodes : fail('fileNodes must be an array');
  const importEdges = Array.isArray(input.importEdges) ? input.importEdges : fail('importEdges must be an array');
  const allEdges = Array.isArray(input.allEdges) ? input.allEdges : fail('allEdges must be an array');
  const fileById = new Map(fileNodes.map((node) => [node.id, node]));
  if (fileById.size !== fileNodes.length) fail('duplicate file node IDs');

  const paths = fileNodes.map((node) => norm(node.filePath));
  const commonPrefixSegments = commonDirectoryPrefix(paths);
  const flat = paths.every((filePath) => directorySegments(filePath).length === 0);
  const directoryGroups = new Map();
  const nodeGroup = new Map();
  const projectClusters = new Map();
  const nodeCluster = new Map();
  const nodeTypeGroups = new Map();
  for (const node of fileNodes) {
    const group = groupForPath(node.filePath, commonPrefixSegments, flat);
    const cluster = projectClusterForPath(node.filePath);
    if (!directoryGroups.has(group)) directoryGroups.set(group, new Set());
    if (!projectClusters.has(cluster)) projectClusters.set(cluster, new Set());
    if (!nodeTypeGroups.has(node.type)) nodeTypeGroups.set(node.type, new Set());
    directoryGroups.get(group).add(node.id);
    projectClusters.get(cluster).add(node.id);
    nodeTypeGroups.get(node.type).add(node.id);
    nodeGroup.set(node.id, group);
    nodeCluster.set(node.id, cluster);
  }

  const fanIn = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const fanOut = Object.fromEntries(fileNodes.map((node) => [node.id, 0]));
  const adjacency = Object.fromEntries(fileNodes.map((node) => [node.id, []]));
  const importedBy = Object.fromEntries(fileNodes.map((node) => [node.id, []]));
  const groupImportsFrom = new Map();
  const groupImportedBy = new Map();
  const interGroupImportCounts = new Map();
  const groupInternalEdges = new Map();
  const groupTotalEdges = new Map();
  for (const group of directoryGroups.keys()) {
    groupImportsFrom.set(group, new Set());
    groupImportedBy.set(group, new Set());
    groupInternalEdges.set(group, 0);
    groupTotalEdges.set(group, 0);
  }
  for (const edge of importEdges) {
    if (!fileById.has(edge.source) || !fileById.has(edge.target)) continue;
    fanOut[edge.source]++;
    fanIn[edge.target]++;
    adjacency[edge.source].push(edge.target);
    importedBy[edge.target].push(edge.source);
    const from = nodeGroup.get(edge.source);
    const to = nodeGroup.get(edge.target);
    if (from === to) {
      groupInternalEdges.set(from, groupInternalEdges.get(from) + 1);
      groupTotalEdges.set(from, groupTotalEdges.get(from) + 1);
    } else {
      groupImportsFrom.get(from).add(to);
      groupImportedBy.get(to).add(from);
      groupTotalEdges.set(from, groupTotalEdges.get(from) + 1);
      groupTotalEdges.set(to, groupTotalEdges.get(to) + 1);
      increment(interGroupImportCounts, `${from}\u001f${to}`);
    }
  }
  for (const id of Object.keys(adjacency)) adjacency[id].sort();
  for (const id of Object.keys(importedBy)) importedBy[id].sort();

  const crossCategoryCounts = new Map();
  const semanticGroupCounts = new Map();
  const semanticClusterCounts = new Map();
  const allEdgeTypeCounts = new Map();
  const nonCodeConnections = [];
  for (const edge of allEdges) {
    const sourceNode = fileById.get(edge.source);
    const targetNode = fileById.get(edge.target);
    if (!sourceNode || !targetNode) continue;
    increment(allEdgeTypeCounts, edge.type);
    increment(crossCategoryCounts, `${sourceNode.type}\u001f${targetNode.type}\u001f${edge.type}`);
    increment(semanticGroupCounts, `${nodeGroup.get(edge.source)}\u001f${nodeGroup.get(edge.target)}\u001f${edge.type}`);
    increment(semanticClusterCounts, `${nodeCluster.get(edge.source)}\u001f${nodeCluster.get(edge.target)}\u001f${edge.type}`);
    if (sourceNode.type !== 'file' || targetNode.type !== 'file') {
      nonCodeConnections.push({ source: edge.source, target: edge.target, edgeType: edge.type });
    }
  }

  const crossCategoryEdges = [...crossCategoryCounts.entries()].map(([key, count]) => {
    const [fromType, toType, edgeType] = key.split('\u001f');
    return { fromType, toType, edgeType, count };
  }).sort((a, b) => b.count - a.count || `${a.fromType}:${a.toType}:${a.edgeType}`.localeCompare(`${b.fromType}:${b.toType}:${b.edgeType}`));
  const interGroupImports = [...interGroupImportCounts.entries()].map(([key, count]) => {
    const [from, to] = key.split('\u001f');
    return { from, to, count };
  }).sort((a, b) => b.count - a.count || `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`));
  const interGroupSemanticEdges = [...semanticGroupCounts.entries()].map(([key, count]) => {
    const [from, to, edgeType] = key.split('\u001f');
    return { from, to, edgeType, count };
  }).sort((a, b) => b.count - a.count || `${a.from}:${a.to}:${a.edgeType}`.localeCompare(`${b.from}:${b.to}:${b.edgeType}`));
  const interClusterSemanticEdges = [...semanticClusterCounts.entries()].map(([key, count]) => {
    const [from, to, edgeType] = key.split('\u001f');
    return { from, to, edgeType, count };
  }).sort((a, b) => b.count - a.count || `${a.from}:${a.to}:${a.edgeType}`.localeCompare(`${b.from}:${b.to}:${b.edgeType}`));

  const intraGroupDensity = {};
  for (const group of [...directoryGroups.keys()].sort()) {
    const internalEdges = groupInternalEdges.get(group) || 0;
    const totalEdges = groupTotalEdges.get(group) || 0;
    intraGroupDensity[group] = { internalEdges, totalEdges, density: totalEdges ? Number((internalEdges / totalEdges).toFixed(4)) : 0 };
  }
  const patternMatches = {};
  for (const group of [...directoryGroups.keys()].sort()) patternMatches[group] = patternForName(group);

  const filePatternMatches = {};
  for (const node of fileNodes) {
    const match = filePattern(node.filePath);
    if (match) filePatternMatches[node.id] = match;
  }

  const deploymentRegex = {
    dockerfile: /(^|\/)dockerfile(?:\.|$)/i,
    compose: /(^|\/)docker-compose(?:\.|$)/i,
    k8s: /(^|\/)(k8s|kubernetes|helm|charts)(\/|$)|\.(k8s|kube)\.ya?ml$/i,
    terraform: /\.(tf|tfvars)$/i,
    ci: /(^|\/)\.github\/workflows\/|(^|\/)\.gitlab-ci\.ya?ml$|(^|\/)jenkinsfile$|(^|\/)\.circleci\//i,
  };
  const infraFiles = fileNodes.filter((node) => Object.values(deploymentRegex).some((regex) => regex.test(norm(node.filePath))) || ['service','pipeline','resource'].includes(node.type)).map((node) => norm(node.filePath)).sort();
  const deploymentTopology = {
    hasDockerfile: paths.some((value) => deploymentRegex.dockerfile.test(value)),
    hasCompose: paths.some((value) => deploymentRegex.compose.test(value)),
    hasK8s: paths.some((value) => deploymentRegex.k8s.test(value)),
    hasTerraform: paths.some((value) => deploymentRegex.terraform.test(value)),
    hasCI: paths.some((value) => deploymentRegex.ci.test(value)),
    infraFiles,
  };

  const dataPipeline = {
    schemaFiles: fileNodes.filter((node) => ['schema','table','endpoint'].includes(node.type) || /\.(proto|graphql|gql|prisma|sql)$/i.test(node.filePath)).map((node) => norm(node.filePath)).sort(),
    migrationFiles: fileNodes.filter((node) => /(^|\/)migrations?(\/|$)|\.(migration|sql)$/i.test(node.filePath)).map((node) => norm(node.filePath)).sort(),
    dataModelFiles: fileNodes.filter((node) => /(^|\/)(models?|entities|dtos?)(\/|$)/i.test(node.filePath) || (node.tags || []).some((tag) => ['data-model','schema-definition','type-definition'].includes(tag))).map((node) => norm(node.filePath)).sort(),
    apiHandlerFiles: fileNodes.filter((node) => /(^|\/)(api|controllers?|routes?|handlers?|endpoints?)(\/|$)/i.test(node.filePath) || (node.tags || []).some((tag) => ['api-handler','api-client','grpc-client'].includes(tag))).map((node) => norm(node.filePath)).sort(),
  };

  const groupsWithDocs = new Set();
  for (const node of fileNodes) {
    if (node.type === 'document' || /\.(md|rst)$/i.test(node.filePath)) groupsWithDocs.add(nodeGroup.get(node.id));
  }
  const undocumentedGroups = [...directoryGroups.keys()].filter((group) => !groupsWithDocs.has(group)).sort();
  const docCoverage = {
    groupsWithDocs: groupsWithDocs.size,
    totalGroups: directoryGroups.size,
    coverageRatio: directoryGroups.size ? Number((groupsWithDocs.size / directoryGroups.size).toFixed(4)) : 0,
    undocumentedGroups,
  };

  const pairCounts = new Map();
  for (const item of interGroupImports) {
    const pair = [item.from, item.to].sort();
    const key = pair.join('\u001f');
    if (!pairCounts.has(key)) pairCounts.set(key, { a: pair[0], b: pair[1], aToB: 0, bToA: 0 });
    const record = pairCounts.get(key);
    if (item.from === record.a) record.aToB += item.count;
    else record.bToA += item.count;
  }
  const dependencyDirection = [];
  for (const record of pairCounts.values()) {
    if (record.aToB === record.bToA) continue;
    dependencyDirection.push(record.aToB > record.bToA
      ? { dependent: record.a, dependsOn: record.b, forwardCount: record.aToB, reverseCount: record.bToA }
      : { dependent: record.b, dependsOn: record.a, forwardCount: record.bToA, reverseCount: record.aToB });
  }
  dependencyDirection.sort((a, b) => b.forwardCount - a.forwardCount || `${a.dependent}:${a.dependsOn}`.localeCompare(`${b.dependent}:${b.dependsOn}`));

  const clusterStats = {};
  const clusterPatternMatches = {};
  for (const [cluster, ids] of [...projectClusters.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const nodes = [...ids].map((id) => fileById.get(id));
    clusterStats[cluster] = {
      fileCount: nodes.length,
      nodeTypeCounts: Object.fromEntries(countTop(nodes.map((node) => node.type), 50).map(({ name, count }) => [name, count])),
      topTags: countTop(nodes.flatMap((node) => node.tags || []), 12),
      filePatternCounts: Object.fromEntries(countTop(nodes.map((node) => filePattern(node.filePath)).filter(Boolean), 50).map(({ name, count }) => [name, count])),
    };
    clusterPatternMatches[cluster] = patternForName(cluster);
  }

  const result = {
    scriptCompleted: true,
    commonPathPrefix: commonPrefixSegments.length ? `${commonPrefixSegments.join('/')}/` : '',
    directoryGroups: sortedObjectOfArrays(directoryGroups),
    projectClusters: sortedObjectOfArrays(projectClusters),
    nodeTypeGroups: sortedObjectOfArrays(nodeTypeGroups),
    importAdjacency: adjacency,
    importedBy,
    groupImportsFrom: sortedObjectOfArrays(groupImportsFrom),
    groupImportedBy: sortedObjectOfArrays(groupImportedBy),
    crossCategoryEdges,
    nonCodeConnections: nonCodeConnections.sort((a, b) => `${a.source}:${a.target}:${a.edgeType}`.localeCompare(`${b.source}:${b.target}:${b.edgeType}`)),
    interGroupImports,
    interGroupSemanticEdges,
    interClusterSemanticEdges,
    intraGroupDensity,
    patternMatches,
    filePatternMatches,
    clusterPatternMatches,
    projectClusterStats: clusterStats,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection,
    allEdgeTypeCounts: Object.fromEntries([...allEdgeTypeCounts.entries()].sort(([a], [b]) => a.localeCompare(b))),
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup: Object.fromEntries([...directoryGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group, ids]) => [group, ids.size])),
      filesPerProjectCluster: Object.fromEntries([...projectClusters.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cluster, ids]) => [cluster, ids.size])),
      nodeTypeCounts: Object.fromEntries([...nodeTypeGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([type, ids]) => [type, ids.size])),
      importEdgeCount: importEdges.length,
      fileLevelEdgeCount: allEdges.length,
    },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
  };
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
} catch (error) {
  fail(error && error.stack ? error.stack : error);
}
