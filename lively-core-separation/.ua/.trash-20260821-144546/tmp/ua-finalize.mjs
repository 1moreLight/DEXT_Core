import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(process.argv[2] ?? ".");
const uaRoot = path.join(projectRoot, ".ua");
const intermediate = path.join(uaRoot, "intermediate");
const coreSchema = "C:/Users/JAN/.codex/understand-anything/understand-anything-plugin/packages/core/dist/schema.js";

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(intermediate, fileName), "utf8"));
}

function unwrapArray(value, keys) {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function normalizePath(value) {
  return String(value ?? "").replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
}

const partial = readJson("assembled-graph.json");
const scan = readJson("scan-result.json");
const rawLayers = readJson("layers.json");
const rawTour = readJson("tour.json");
const nodes = Array.isArray(partial.nodes) ? partial.nodes : [];
const edges = Array.isArray(partial.edges) ? partial.edges : [];
const nodeIds = new Set(nodes.map((node) => String(node.id)));
const pathToNodeId = new Map();

for (const node of nodes) {
  if (!node.filePath) continue;
  const key = normalizePath(node.filePath);
  if (!pathToNodeId.has(key) || ["file", "config", "document", "schema"].includes(node.type)) {
    pathToNodeId.set(key, String(node.id));
  }
}

function resolveNodeId(value) {
  const text = String(value ?? "");
  if (nodeIds.has(text)) return text;
  return pathToNodeId.get(normalizePath(text));
}

const layers = unwrapArray(rawLayers, ["layers", "data"]).map((layer, index) => ({
  id: String(layer.id ?? `layer-${index + 1}`),
  name: String(layer.name ?? `架构层 ${index + 1}`),
  description: String(layer.description ?? ""),
  nodeIds: [...new Set(unwrapArray(layer.nodeIds ?? layer.nodes, ["nodeIds", "nodes"])
    .map(resolveNodeId)
    .filter(Boolean))],
}));

const tour = unwrapArray(rawTour, ["tour", "steps", "data"])
  .map((step, index) => ({
    order: index + 1,
    title: String(step.title ?? `学习步骤 ${index + 1}`),
    description: String(step.description ?? ""),
    nodeIds: [...new Set(unwrapArray(step.nodeIds ?? step.nodes, ["nodeIds", "nodes"])
      .map(resolveNodeId)
      .filter(Boolean))],
    ...(step.languageLesson ? { languageLesson: String(step.languageLesson) } : {}),
  }));

const analyzedAt = new Date().toISOString();
const snapshot = "unversioned-69d29b61c1bf85d952f9b36d49103c16769c62d0c695ec15c90d76cbc9a6d07d";
let graph = {
  version: "1.0.0",
  kind: "codebase",
  project: {
    name: String(scan.name ?? "lively-core-separation"),
    languages: Array.isArray(scan.languages) ? scan.languages.map(String) : [],
    frameworks: Array.isArray(scan.frameworks) ? scan.frameworks.map(String) : [],
    description: String(scan.description ?? "Lively Wallpaper 源代码知识图谱。"),
    analyzedAt,
    gitCommitHash: snapshot,
  },
  nodes,
  edges,
  layers,
  tour,
};

const { validateGraph } = await import(pathToFileURL(coreSchema).href);
const first = validateGraph(graph);
if (!first.success || !first.data) {
  const review = { success: false, fatal: first.fatal ?? "知识图谱验证失败", issues: first.issues ?? [] };
  fs.writeFileSync(path.join(intermediate, "review.json"), JSON.stringify(review, null, 2) + "\n");
  throw new Error(review.fatal);
}

graph = first.data;
const second = validateGraph(graph);
if (!second.success || !second.data) {
  const review = { success: false, fatal: second.fatal ?? "知识图谱二次验证失败", issues: second.issues ?? [] };
  fs.writeFileSync(path.join(intermediate, "review.json"), JSON.stringify(review, null, 2) + "\n");
  throw new Error(review.fatal);
}
graph = second.data;

const graphIds = new Set(graph.nodes.map((node) => node.id));
const duplicateNodeIds = graph.nodes.length - graphIds.size;
const danglingEdges = graph.edges.filter((edge) => !graphIds.has(edge.source) || !graphIds.has(edge.target));
const assigned = graph.layers.flatMap((layer) => layer.nodeIds);
const assignedSet = new Set(assigned);
const sourcePaths = new Set((scan.files ?? []).map((file) => normalizePath(file.path)));
const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
const assignedSourcePaths = assigned
  .map((id) => nodeById.get(id))
  .filter((node) => node?.filePath)
  .map((node) => normalizePath(node.filePath));
const assignedSourcePathSet = new Set(assignedSourcePaths);
const layerMissing = [...sourcePaths].filter((filePath) => !assignedSourcePathSet.has(filePath));
const layerExtraPaths = [...assignedSourcePathSet].filter((filePath) => !sourcePaths.has(filePath));
const layerDuplicates = assigned.length - assignedSet.size;
const layerPathDuplicates = assignedSourcePaths.length - assignedSourcePathSet.size;
const layerDangling = assigned.filter((id) => !graphIds.has(id));
const tourDangling = graph.tour.flatMap((step) => step.nodeIds).filter((id) => !graphIds.has(id));
const tourOrdersSequential = graph.tour.every((step, index) => step.order === index + 1);

const checks = {
  duplicateNodeIds,
  danglingEdges: danglingEdges.length,
  sourceFiles: sourcePaths.size,
  assignedSourcePaths: assignedSourcePaths.length,
  assignedUniqueSourcePaths: assignedSourcePathSet.size,
  layerAssigned: assigned.length,
  layerUnique: assignedSet.size,
  layerMissing: layerMissing.length,
  layerExtraPaths: layerExtraPaths.length,
  layerDuplicates,
  layerPathDuplicates,
  layerDangling: layerDangling.length,
  tourSteps: graph.tour.length,
  tourDangling: tourDangling.length,
  tourOrdersSequential,
};
const critical = duplicateNodeIds !== 0 || danglingEdges.length !== 0 ||
  layerMissing.length !== 0 || layerExtraPaths.length !== 0 || layerDuplicates !== 0 || layerPathDuplicates !== 0 || layerDangling.length !== 0 ||
  graph.layers.length < 3 || graph.layers.length > 10 || graph.tour.length < 5 || graph.tour.length > 15 ||
  tourDangling.length !== 0 || !tourOrdersSequential;

const review = {
  success: !critical,
  fatal: critical ? "结构完整性检查失败" : undefined,
  issues: [...(first.issues ?? []), ...(second.issues ?? [])],
  checks,
};
fs.writeFileSync(path.join(intermediate, "review.json"), JSON.stringify(review, null, 2) + "\n");
fs.writeFileSync(path.join(intermediate, "assembled-graph.json"), JSON.stringify(graph, null, 2) + "\n");
fs.writeFileSync(path.join(intermediate, "fingerprint-input.json"), JSON.stringify({
  projectRoot,
  sourceFilePaths: (scan.files ?? []).map((file) => String(file.path)),
  gitCommitHash: snapshot,
}, null, 2) + "\n");

if (critical) throw new Error(`${review.fatal}: ${JSON.stringify(checks)}`);
console.log(JSON.stringify({ project: graph.project, nodes: graph.nodes.length, edges: graph.edges.length, layers: graph.layers.length, tour: graph.tour.length, issues: review.issues.length, checks }, null, 2));
