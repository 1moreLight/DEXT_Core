const fs = require("fs");
const path = require("path");

const [inputPath, resultsPath, outputPath] = process.argv.slice(2);
if (!inputPath || !resultsPath || !outputPath) {
  console.error("用法：node ua-write-layers.js <input.json> <results.json> <layers.json>");
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));

const clusterToIds = new Map(
  Object.entries(results.projectClusters).map(([cluster, nodeIds]) => [cluster, nodeIds])
);

const definitions = [
  {
    id: "layer:desktop-core",
    name: "桌面核心与编排层",
    description:
      "承载 Lively 桌面核心进程、壁纸生命周期编排、Windows 桌面集成、后端服务入口及其本地化资源。",
    clusters: ["src/Lively/Lively"],
  },
  {
    id: "layer:ui",
    name: "WinUI 与 MVVM 层",
    description:
      "实现 Lively 的 WinUI 3 界面、共享 ViewModel、导航与命令、状态管理、XAML 资源以及多语言文案。",
    clusters: ["src/Lively/Lively.UI.Shared", "src/Lively/Lively.UI.WinUI"],
  },
  {
    id: "layer:playback-runtime",
    name: "壁纸播放器与运行时层",
    description:
      "提供 CefSharp、WebView2、VLC 与 WMF 等独立播放器进程，负责网页、视频和媒体壁纸的实际渲染与进程通信。",
    clusters: [
      "src/Lively/Lively.Player.CefSharp",
      "src/Lively/Lively.Player.Vlc",
      "src/Lively/Lively.Player.WebView2",
      "src/Lively/Lively.Player.Wmf",
    ],
  },
  {
    id: "layer:integration-services",
    name: "集成与智能服务层",
    description:
      "封装硬件、音频与更新服务、Gallery HTTP 集成、named-pipe gRPC 客户端，以及 MiDaS ONNX 深度估计能力。",
    clusters: [
      "src/Lively/Lively.Common.Services",
      "src/Lively/Lively.Gallery.Client",
      "src/Lively/Lively.Grpc.Client",
      "src/Lively/Lively.ML",
    ],
  },
  {
    id: "layer:shared-foundation",
    name: "共享基础能力层",
    description:
      "集中提供 Windows interop、文件归档、进程与窗口工具、序列化、异常处理、service contracts 和跨项目 common utilities。",
    clusters: ["src/Lively/Lively.Common"],
  },
  {
    id: "layer:contracts-models",
    name: "契约与数据模型层",
    description:
      "定义领域模型、枚举、IPC 消息、LivelyProperties JSON Schema 以及 gRPC Protobuf contracts，形成跨进程与跨项目的数据边界。",
    clusters: [
      "schemas",
      "src/Lively/Lively.Grpc.Common",
      "src/Lively/Lively.Models",
    ],
  },
  {
    id: "layer:utility-hosts",
    name: "辅助宿主与运维工具层",
    description:
      "包含命令行自动化入口、gRPC console demo、Windows screensaver host 与进程 watchdog，为部署和故障恢复提供辅助能力。",
    clusters: [
      "src/Lively/Lively.Utility.Commandline",
      "src/Lively/Lively.Utility.ConsoleDemo",
      "src/Lively/Lively.Utility.Screensaver",
      "src/Lively/Lively.Utility.Watchdog",
    ],
  },
  {
    id: "layer:build-delivery-support",
    name: "构建、安装与项目支持层",
    description:
      "包含 Visual Studio solution、Inno Setup 安装器及其主题和本地化、GitHub issue/funding 配置，以及 Understand Anything 分析配置。",
    clusters: [".github", ".ua", "src/installer", "src/Lively/Lively.sln"],
  },
  {
    id: "layer:documentation",
    name: "文档与项目治理层",
    description:
      "汇总项目说明、贡献指南、隐私说明和安全支持策略，说明使用边界与协作规范。",
    clusters: ["root"],
  },
];

const definedClusters = definitions.flatMap((definition) => definition.clusters);
const duplicateClusters = definedClusters.filter(
  (cluster, index) => definedClusters.indexOf(cluster) !== index
);
const missingClusters = definedClusters.filter((cluster) => !clusterToIds.has(cluster));
const unassignedClusters = [...clusterToIds.keys()].filter(
  (cluster) => !definedClusters.includes(cluster)
);

const layers = definitions.map(({ clusters, ...layer }) => ({
  ...layer,
  nodeIds: clusters
    .flatMap((cluster) => clusterToIds.get(cluster) || [])
    .slice()
    .sort(),
}));

const validFileIds = new Set(input.fileNodes.map((node) => node.id));
const assignedIds = layers.flatMap((layer) => layer.nodeIds);
const assignedSet = new Set(assignedIds);
const duplicateNodeIds = assignedIds.filter(
  (id, index) => assignedIds.indexOf(id) !== index
);
const inventedNodeIds = assignedIds.filter((id) => !validFileIds.has(id));
const missingNodeIds = [...validFileIds].filter((id) => !assignedSet.has(id));
const emptyLayers = layers.filter((layer) => layer.nodeIds.length === 0).map((layer) => layer.id);
const duplicateLayerIds = layers
  .map((layer) => layer.id)
  .filter((id, index, ids) => ids.indexOf(id) !== index);

const validation = {
  layerCount: layers.length,
  sourceFileNodeCount: validFileIds.size,
  assignedNodeCount: assignedIds.length,
  uniqueAssignedNodeCount: assignedSet.size,
  missingNodeCount: missingNodeIds.length,
  inventedNodeCount: inventedNodeIds.length,
  duplicateNodeCount: new Set(duplicateNodeIds).size,
  emptyLayerCount: emptyLayers.length,
  sourceClusterCount: clusterToIds.size,
  assignedClusterCount: new Set(definedClusters).size,
  missingClusterCount: missingClusters.length,
  unassignedClusterCount: unassignedClusters.length,
  duplicateClusterCount: new Set(duplicateClusters).size,
  duplicateLayerIdCount: new Set(duplicateLayerIds).size,
};

const valid =
  layers.length >= 3 &&
  layers.length <= 10 &&
  validation.assignedNodeCount === validation.sourceFileNodeCount &&
  validation.uniqueAssignedNodeCount === validation.sourceFileNodeCount &&
  validation.missingNodeCount === 0 &&
  validation.inventedNodeCount === 0 &&
  validation.duplicateNodeCount === 0 &&
  validation.emptyLayerCount === 0 &&
  validation.missingClusterCount === 0 &&
  validation.unassignedClusterCount === 0 &&
  validation.duplicateClusterCount === 0 &&
  validation.duplicateLayerIdCount === 0;

if (!valid) {
  console.error(
    JSON.stringify(
      {
        validation,
        missingClusters,
        unassignedClusters,
        duplicateClusters: [...new Set(duplicateClusters)],
        missingNodeIds,
        inventedNodeIds,
        duplicateNodeIds: [...new Set(duplicateNodeIds)],
        emptyLayers,
        duplicateLayerIds: [...new Set(duplicateLayerIds)],
      },
      null,
      2
    )
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(layers, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      validation,
      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        nodeCount: layer.nodeIds.length,
      })),
    },
    null,
    2
  )
);
