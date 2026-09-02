# Dext Room v2 创作者协议

> `room-v2.schema.json` 是机器格式真相源，`MODEL.md` 是运行语义真相源。Dext 只支持 Room v2；旧 Room 不兼容、不迁移。

## 一、目录

```text
my-room/
├─ room.json
├─ background/
├─ start/
├─ switch/
├─ idle/
└─ widgets/
   ├─ clock/
   │  ├─ index.html
   │  ├─ style.css
   │  └─ main.js
   └─ now-playing/
      └─ index.html
```

只把实际使用的文件放入包内。所有引用使用正斜杠相对路径；禁止外网 URL、绝对路径、`..`、符号链接/重解析点和未声明 Widget 文件。

## 二、最小 Room

```json
{
  "version": 2,
  "startDesk": 0,
  "switches": {},
  "desks": [
    {
      "name": "主页",
      "background": null,
      "iconSize": "medium",
      "icons": [],
      "widgets": []
    }
  ]
}
```

每个 Desk 都必须写 `widgets`。配置器保存、另存、预览、应用和 zip 只接受/产生这个 v2 结构。

## 三、选择 Scene 还是 Widget

- 想让墙上的钟、唱片机封面、建筑灯条、HUD 或画面任意部位显示实时数据：使用 background HTML Scene。
- 想让用户独立拖动、缩放、复用和组合：使用 Widget。
- 一个 Desk 可以有多个 Widget，也可与完整 Scene 混用。Widget 可以不同大小并受控层叠。
- 不要为了“支持小组件”把高度艺术化的壁纸拆成一堆卡片。

Scene/Widget 都只负责视觉和本地前端交互。系统数据和动作必须经未来官方受控桥，不能直接调用本机。

## 四、Scene 内容

Content 固定为：

```json
{ "name": "主页背景", "type": "html", "src": "background/home/index.html" }
```

支持 image/video/html。background 长驻；start/switch 在完成后推进；idle 只在 Lively 屏保实例中持续显示。复杂动画和时序放在 HTML 内，不新增任意脚本入口。

start/switch HTML 完成时发送：

```js
parent.postMessage({
  type: "dext:scene",
  event: "done",
  instanceId: new URLSearchParams(location.search).get("dextInstanceId")
}, "*");
```

宿主会校验 iframe window 与 instanceId；这不是系统能力接口。background/idle 不应依赖 `done`。

## 五、Widget

```jsonc
{
  "id": "system-meter",
  "name": "系统仪表",
  "src": "widgets/system-meter/index.html",
  "resources": [
    "widgets/system-meter/index.html",
    "widgets/system-meter/style.css",
    "widgets/system-meter/main.js"
  ],
  "placement": { "x": 72, "y": 96, "width": 420, "height": 220, "z": 2 },
  "config": { "accent": "#7cecff" },
  "permissions": ["hardware.cpu.read", "hardware.memory.read"]
}
```

- id 在 Room 内唯一并与 `widgets/<id>/` 一致。
- resources 必须完整、去重、自包含，src 必须列入其中。
- placement 基于 1920×1080 逻辑画布，最小 64×64，z 为 0..255。
- config 会随 Room 分享；不要放秘密、设备信息或用户数据。
- permissions 只声明需求。宿主未实现或用户未授权时，Widget 必须能显示安全空状态。

WidgetHost 尚未实现视觉运行；DXT-003 只保证 manifest、素材、保存/另存/应用/zip 和后端能力边界。不要在当前作者代码里自造替代桥。

## 六、安全规则

Scene/Widget iframe 使用 `sandbox="allow-scripts"`，没有 `allow-same-origin`。禁止：

- `chrome.webview`、Tauri `invoke`、gRPC、Node、ActiveX；
- Shell、PowerShell、cmd、注册表、文件系统、环境变量；
- 任意 exe/lnk/URI/URL 启动；
- fetch、WebSocket、远程 script/iframe/font/CDN；
- 直接读系统媒体、音量、硬件或其他 Widget 数据；
- 修改官方 Desk、Dock、图标、保存链或伪造用户手势。

未来联网只能通过用户批准、可审计的 Dext 代理。未来系统点击只能声明标准 action，由官方可信热点接收真实鼠标/触摸/键盘事件后执行。

## 七、保存与分享

- “保存”严格验证 v2 后原子写入，不写 `__source`。
- “另存为”复制五类目录和完整 Widget 声明，原 Room 不变。
- “应用”镜像五类目录到运行包并校验声明文件；只在运行包加入可信 `__source`。
- zip 导入导出仅支持自包含 v2；拒绝路径穿越、链接、重复项、压缩炸弹、未声明文件和未知版本。
- 授权、当前歌曲、音量、设备 id、Widget KV 和运行态不进入复制或分享包。

## 八、发布前检查

1. `python scripts/validate-room-schema.py` 全部通过。
2. `room.json` 为 `version: 2`，每个 Desk 有 `widgets`。
3. 所有 Content 与 Widget 资源存在、类型匹配、位于许可目录且无未声明文件。
4. HTML 完全离线，不含危险 API、外链、导航、下载或本机路径。
5. 1920×1080、16:10 和超宽屏构图可接受；Widget placement 未出界。
6. 没有把权限批准、个人数据、密钥或运行态写进包。
7. 需要系统能力的界面在无授权/无会话时有安全空状态。

合法结构与自包含样包见 `dev_docs/fixtures/room-v2/`；AI 创作可使用 `ROOM_V2_AI_PROMPT.md`。
