import fs from 'node:fs';

const [graphPath, layersPath, outputPath] = process.argv.slice(2);
if (!graphPath || !layersPath || !outputPath) {
  console.error('Usage: node ua-tour-prepare.mjs <assembled-graph.json> <layers.json> <output.json>');
  process.exit(1);
}

try {
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const rawLayers = JSON.parse(fs.readFileSync(layersPath, 'utf8'));
  const layers = Array.isArray(rawLayers) ? rawLayers : rawLayers.layers;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(layers)) {
    throw new Error('输入必须包含 nodes、edges 和 layers 数组');
  }
  const input = {
    nodes: graph.nodes,
    edges: graph.edges,
    layers: layers.map(({ id, name, description }) => ({ id, name, description })),
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
  console.log(`Tour input: ${input.nodes.length} nodes, ${input.edges.length} edges, ${input.layers.length} layers`);
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
