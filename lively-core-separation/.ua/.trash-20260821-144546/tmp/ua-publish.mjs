import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.argv[2] ?? ".");
const uaRoot = path.join(projectRoot, ".ua");
const intermediate = path.join(uaRoot, "intermediate");
const graphPath = path.join(intermediate, "assembled-graph.json");
const reviewPath = path.join(intermediate, "review.json");
const fingerprintPath = path.join(uaRoot, "fingerprints.json");

const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const fingerprints = JSON.parse(fs.readFileSync(fingerprintPath, "utf8"));

if (!review.success) throw new Error("拒绝发布：review.json 未通过。 ");
if (Object.keys(fingerprints.files ?? {}).length !== 660) {
  throw new Error(`拒绝发布：指纹数量为 ${Object.keys(fingerprints.files ?? {}).length}，预期 660。`);
}

fs.writeFileSync(path.join(uaRoot, "knowledge-graph.json"), JSON.stringify(graph, null, 2) + "\n");
fs.writeFileSync(path.join(uaRoot, "meta.json"), JSON.stringify({
  lastAnalyzedAt: graph.project.analyzedAt,
  gitCommitHash: graph.project.gitCommitHash,
  version: graph.version,
  analyzedFiles: 660,
}, null, 2) + "\n");

console.log(JSON.stringify({
  graph: path.join(uaRoot, "knowledge-graph.json"),
  meta: path.join(uaRoot, "meta.json"),
  fingerprints: Object.keys(fingerprints.files ?? {}).length,
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  layers: graph.layers.length,
  tour: graph.tour.length,
}, null, 2));
