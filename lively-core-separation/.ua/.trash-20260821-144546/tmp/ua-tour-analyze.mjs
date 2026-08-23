import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node ua-tour-analyze.mjs <input.json> <output.json>');
  process.exit(1);
}

try {
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = input.nodes;
  const edges = input.edges;
  const layers = input.layers;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(layers)) {
    throw new Error('Topology input requires nodes, edges, and layers arrays');
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const fanIn = new Map(nodes.map((node) => [node.id, 0]));
  const fanOut = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (nodeById.has(edge.target)) fanIn.set(edge.target, (fanIn.get(edge.target) || 0) + 1);
    if (nodeById.has(edge.source)) {
      fanOut.set(edge.source, (fanOut.get(edge.source) || 0) + 1);
      outgoing.get(edge.source).push(edge);
    }
  }

  const ranked = (counts, field, direction = 'desc') => nodes
    .map((node) => ({ id: node.id, [field]: counts.get(node.id) || 0, name: node.name }))
    .sort((a, b) => direction === 'desc'
      ? b[field] - a[field] || a.id.localeCompare(b.id)
      : a[field] - b[field] || a.id.localeCompare(b.id));
  const fanInAll = ranked(fanIn, 'fanIn');
  const fanOutAll = ranked(fanOut, 'fanOut');
  const highFanOutIds = new Set(fanOutAll.slice(0, Math.max(1, Math.ceil(nodes.length * 0.10))).map((item) => item.id));
  const lowFanInIds = new Set(ranked(fanIn, 'fanIn', 'asc').slice(0, Math.max(1, Math.ceil(nodes.length * 0.25))).map((item) => item.id));

  const codeEntryNames = new Set([
    'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js', 'mod.rs',
    'main.go', 'main.py', 'main.rs', 'manage.py', 'app.py', 'wsgi.py', 'asgi.py', 'run.py', '__main__.py',
    'application.java', 'main.java', 'program.cs', 'config.ru', 'index.php', 'app.swift', 'application.kt',
    'main.cpp', 'main.c',
  ]);
  const entryCandidatesAll = [];
  for (const node of nodes) {
    const filePath = (node.filePath || '').replaceAll('\\', '/');
    const fileName = (node.name || path.posix.basename(filePath)).toLowerCase();
    let score = 0;
    if (node.type === 'file') {
      if (codeEntryNames.has(fileName)) score += 3;
      const segments = filePath.split('/').filter(Boolean);
      if (segments.length <= 2) score += 1;
      if (highFanOutIds.has(node.id)) score += 1;
      if (lowFanInIds.has(node.id)) score += 1;
    } else if (node.type === 'document') {
      if (filePath.toLowerCase() === 'readme.md') score += 5;
      else if (/^[^/]+\.md$/i.test(filePath)) score += 2;
    }
    if (score > 0) entryCandidatesAll.push({ id: node.id, score, name: node.name, summary: node.summary });
  }
  entryCandidatesAll.sort((a, b) => b.score - a.score || (fanOut.get(b.id) || 0) - (fanOut.get(a.id) || 0) || a.id.localeCompare(b.id));
  const entryPointCandidates = entryCandidatesAll.slice(0, 5);
  const codeStart = entryCandidatesAll.find((candidate) => nodeById.get(candidate.id)?.type === 'file');

  const bfsTraversal = { startNode: codeStart?.id || null, order: [], depthMap: {}, byDepth: {} };
  if (codeStart) {
    const queue = [codeStart.id];
    bfsTraversal.depthMap[codeStart.id] = 0;
    while (queue.length) {
      const current = queue.shift();
      const depth = bfsTraversal.depthMap[current];
      bfsTraversal.order.push(current);
      if (!bfsTraversal.byDepth[String(depth)]) bfsTraversal.byDepth[String(depth)] = [];
      bfsTraversal.byDepth[String(depth)].push(current);
      const nextIds = (outgoing.get(current) || [])
        .filter((edge) => edge.direction !== 'backward' && (edge.type === 'imports' || edge.type === 'calls'))
        .map((edge) => edge.target)
        .filter((id) => nodeById.has(id))
        .sort((a, b) => a.localeCompare(b));
      for (const next of nextIds) {
        if (bfsTraversal.depthMap[next] !== undefined) continue;
        bfsTraversal.depthMap[next] = depth + 1;
        queue.push(next);
      }
    }
  }

  const inventoryItem = (node) => ({ id: node.id, name: node.name, type: node.type, summary: node.summary });
  const nonCodeFiles = {
    documentation: nodes.filter((node) => node.type === 'document').map(inventoryItem),
    infrastructure: nodes.filter((node) => ['service', 'pipeline', 'resource'].includes(node.type)).map(inventoryItem),
    data: nodes.filter((node) => ['table', 'schema', 'endpoint'].includes(node.type)).map(inventoryItem),
    config: nodes.filter((node) => node.type === 'config').map(inventoryItem),
  };

  const signalEdges = edges.filter((edge) => edge.type === 'imports' || edge.type === 'calls');
  const pairDirections = new Map();
  const undirected = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of signalEdges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target) || edge.source === edge.target) continue;
    const key = `${edge.source}\u0000${edge.target}`;
    pairDirections.set(key, (pairDirections.get(key) || 0) + 1);
    undirected.get(edge.source).add(edge.target);
    undirected.get(edge.target).add(edge.source);
  }
  const seeds = [];
  const seenSeed = new Set();
  for (const edge of signalEdges) {
    const reverse = `${edge.target}\u0000${edge.source}`;
    if (!pairDirections.has(reverse)) continue;
    const pair = [edge.source, edge.target].sort();
    const key = pair.join('\u0000');
    if (!seenSeed.has(key)) {
      seenSeed.add(key);
      seeds.push(pair);
    }
  }
  const clusterMap = new Map();
  for (const seed of seeds) {
    const cluster = new Set(seed);
    let changed = true;
    while (changed && cluster.size < 5) {
      changed = false;
      const candidates = new Set();
      for (const member of cluster) for (const candidate of undirected.get(member) || []) if (!cluster.has(candidate)) candidates.add(candidate);
      const rankedCandidates = [...candidates]
        .map((candidate) => ({ candidate, links: [...cluster].filter((member) => undirected.get(candidate)?.has(member)).length }))
        .filter((item) => item.links >= 2)
        .sort((a, b) => b.links - a.links || a.candidate.localeCompare(b.candidate));
      if (rankedCandidates.length) {
        cluster.add(rankedCandidates[0].candidate);
        changed = true;
      }
    }
    const clusterNodes = [...cluster].sort();
    const key = clusterNodes.join('\u0000');
    let edgeCount = 0;
    const memberSet = new Set(clusterNodes);
    for (const edge of signalEdges) if (memberSet.has(edge.source) && memberSet.has(edge.target)) edgeCount += 1;
    const prior = clusterMap.get(key);
    if (!prior || edgeCount > prior.edgeCount) clusterMap.set(key, { nodes: clusterNodes, edgeCount });
  }
  const clusters = [...clusterMap.values()]
    .sort((a, b) => b.edgeCount - a.edgeCount || b.nodes.length - a.nodes.length || a.nodes[0].localeCompare(b.nodes[0]))
    .slice(0, 10);

  const nodeSummaryIndex = Object.fromEntries(nodes.map((node) => [node.id, { name: node.name, type: node.type, summary: node.summary }]));
  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking: fanInAll.slice(0, 20),
    fanOutRanking: fanOutAll.slice(0, 20),
    bfsTraversal,
    nonCodeFiles,
    clusters,
    layers: { count: layers.length, list: layers.map(({ id, name, description }) => ({ id, name, description })) },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Topology complete: ${nodes.length} nodes, ${edges.length} edges, BFS ${bfsTraversal.order.length}, ${clusters.length} clusters`);
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
