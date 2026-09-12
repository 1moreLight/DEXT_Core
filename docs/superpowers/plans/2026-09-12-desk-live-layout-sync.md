# DESK-LIVE-001 实时布局同步实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让当前 Room 新增/移除应用立即同步到真实桌面，并让 Widget 在配置器画布和真实桌面都以原子方式优先占位、驱动冲突图标智能让位。

**Architecture:** 将布局规则集中为可测试的纯函数；配置器只向 Rust 提交目标 Desk 的图标快照，Rust 在串行锁内验证并原子写回可信源 Room/运行包，再复用现有 `SendMessageWallpaper` RPC 发显式下行消息。Player 只做类型化转发，宿主在同 Desk 仅重绘图标层，跨 Desk 才走正常切桌。桌面上行仍复用现有 `saveRoom`，配置器重新获焦时只合并图标和 Widget placement。

**Tech Stack:** React 19、TypeScript 5.8、Vitest、Tauri 2、Rust/Tokio/Serde、C#/.NET、WebView2、原生浏览器 JavaScript、Node test runner。

**Spec:** `docs/superpowers/specs/2026-09-11-desk-live-layout-sync-design.md`

## Global Constraints

- 只修改 `feat/DESK-LIVE-001-live-layout-sync` 对应独立 worktree；主 worktree 的用户/runtime 改动不得触碰。
- 每个任务严格执行 red → green → refactor；只提交本任务具名文件。
- `MessageType` 新成员只能追加在末尾，保持现有 0–25 的数值稳定；本包使用 `cmd_room_layout_sync = 26`。
- 配置器不得提供或信任运行包路径、`__source`；Rust 必须从合法 Room 与当前 wallpaper 记录推导目标。
- 非当前 Room、Core 离线、验证失败或热同步失败都不得最小化配置器。
- 同 Desk 热更新只替换 `icons` 并调用 `renderIcons`，不得重建已挂载 Scene/Widget；偏好关闭时不得切换当前 Desk。
- Widget 避让必须全有解才一次提交；任一图标无解则 Widget 和全部图标整体回退。

---

## Task 1: 固化智能图标放置与 Widget 避让求解器

**Files:**

- Modify: `tauri-ui/src/lib/widget-layout.ts`
- Modify: `tauri-ui/src/lib/widget-layout.test.ts`
- Modify: `tauri-ui/src/lib/desk.test.ts`

- [ ] **Step 1: 写智能成组放置的失败测试**

在 `widget-layout.test.ts` 增加以下覆盖：空桌仍取首个合法格；已有图标时优先填组内空洞；其次贴近图标组；同分按 `y/x`；Widget/Dock 障碍不会被选中；输入保持不变。核心断言形态：

```ts
expect(findOpenDeskIconCell(groupedDesk, grid)).toEqual({ x: 1, y: 0 });
expect(groupedDesk).toEqual(before);
```

在 `desk.test.ts` 断言 `toggleDeskApplication` 使用同一结果且不会移动旧图标。

同时修正安全矩形为四周各 40 逻辑像素：Widget obstacle 的 `x/y` 各减 40，`width/height` 各加 80；Dock reserve 也使用同样的对称扩张，避免当前只扩左/上而漏掉右/下。

- [ ] **Step 2: 运行定向测试并确认红灯**

Run: `npx vitest run src/lib/widget-layout.test.ts src/lib/desk.test.ts`

Expected: 新增“靠近图标组/组内空洞”断言失败，现状仍返回第一个 row-major 空格。

- [ ] **Step 3: 实现确定性候选评分**

在 `widget-layout.ts` 将合法候选排序固定为：正交邻居数降序、到既有图标集合的最小曼哈顿距离升序、`y`/`x` 升序。保留空桌 row-major 行为。建议提取：

```ts
type IconCell = { x: number; y: number };

function rankOpenCell(candidate: IconCell, occupied: IconCell[]) {
  const adjacent = occupied.filter(({ x, y }) =>
    Math.abs(candidate.x - x) + Math.abs(candidate.y - y) === 1
  ).length;
  const distance = occupied.length
    ? Math.min(...occupied.map(({ x, y }) => Math.abs(candidate.x - x) + Math.abs(candidate.y - y)))
    : 0;
  return { adjacent, distance };
}
```

- [ ] **Step 4: 写避让优先级与原子失败测试**

新增多图标争抢唯一近邻、其他 Widget/Dock 保留区、只移动冲突项、无解时返回原始 `icons` 的测试。把返回契约改为：

```ts
export interface IconAvoidanceResult {
  icons: RoomIcon[];
  moved: number[];
  unresolved: number[];
  committed: boolean;
}
```

无解时 `committed === false`、`icons` 深等于输入；有解时先处理合法近邻数最少的冲突图标，原数组索引稳定打平。

- [ ] **Step 5: 实现最少候选优先与整体回退**

先为每个冲突图标计算当前合法候选列表并排序，再按候选数/原索引选择下一个图标；每分配一个格重新计算剩余候选。任何列表为空立即返回输入深拷贝和全部未解索引，不暴露半成品。

- [ ] **Step 6: 跑测试并提交**

Run: `npx vitest run src/lib/widget-layout.test.ts src/lib/desk.test.ts`

Expected: PASS。

Run: `git diff --check`

Commit: `git add tauri-ui/src/lib/widget-layout.ts tauri-ui/src/lib/widget-layout.test.ts tauri-ui/src/lib/desk.test.ts && git commit -m "feat: add deterministic desk layout solver"`

---

## Task 2: 增加本地偏好、布局合并与 latest-wins 队列纯函数

**Files:**

- Create: `tauri-ui/src/lib/config-preferences.ts`
- Create: `tauri-ui/src/lib/config-preferences.test.ts`
- Create: `tauri-ui/src/lib/live-layout.ts`
- Create: `tauri-ui/src/lib/live-layout.test.ts`

- [ ] **Step 1: 写偏好默认值和持久化失败测试**

测试键不存在、值为 `"true"`、值为 `"false"` 以及存储异常。目标 API：

```ts
export const MINIMIZE_AFTER_DESK_APP_ADD_KEY = "dext.minimizeAfterDeskAppAdd.v1";

export function loadMinimizeAfterDeskAppAdd(
  storage: Pick<Storage, "getItem">,
): boolean;

export function saveMinimizeAfterDeskAppAdd(
  storage: Pick<Storage, "setItem">,
  value: boolean,
): void;
```

默认与异常回退都必须为 `true`。

- [ ] **Step 2: 写焦点合并测试**

在 `live-layout.test.ts` 构造“草稿背景已改、源 Room 图标/Widget placement 已改”的快照，断言只更新：

```ts
export function mergeLiveLayoutFields(
  draft: RoomEditorSnapshot,
  persistedDesks: Desk[],
): RoomEditorSnapshot;
```

必须保留草稿的 background、dock、Widget config/permissions、transition、edges；Widget 以 `id` 匹配，只覆盖 `placement`。

- [ ] **Step 3: 写队列失败测试**

定义类型化请求/结果，并用受控 Promise 证明：同一时间只有一个发送；忙碌时多个 `submit` 只保留最后快照；较旧完成结果不能触发 `onSettled` 覆盖最新状态。

```ts
export interface DeskLayoutSyncRequest {
  roomDir: string;
  deskIndex: number;
  icons: RoomIcon[];
  enterEdit: boolean;
  highlightTarget: string | null;
}

export interface DeskLayoutSyncResult {
  active: boolean;
  saved: boolean;
  liveUpdated: boolean;
  roomJson: string | null;
  liveError: string | null;
}

export function createDeskLayoutSyncQueue(
  send: (request: DeskLayoutSyncRequest) => Promise<DeskLayoutSyncResult>,
  onSettled: (request: DeskLayoutSyncRequest, result: DeskLayoutSyncResult) => void,
): { submit(request: DeskLayoutSyncRequest): Promise<DeskLayoutSyncResult> };
```

- [ ] **Step 4: 运行定向测试并确认红灯**

Run: `npx vitest run src/lib/config-preferences.test.ts src/lib/live-layout.test.ts`

Expected: FAIL，因为模块尚不存在。

- [ ] **Step 5: 最小实现并跑绿**

实现安全 storage 包装、不可变 live 字段合并和单飞 latest-wins 队列。队列为每个 `submit` 返回最终实际处理结果；被后续请求合并的调用与最后请求共享结果，不悬挂 Promise。

Run: `npx vitest run src/lib/config-preferences.test.ts src/lib/live-layout.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交**

Run: `git diff --check`

Commit: `git add tauri-ui/src/lib/config-preferences.ts tauri-ui/src/lib/config-preferences.test.ts tauri-ui/src/lib/live-layout.ts tauri-ui/src/lib/live-layout.test.ts && git commit -m "feat: add live layout client state helpers"`

---

## Task 3: 建立 Rust 受控布局写入与 RPC 客户端

**Files:**

- Modify: `tauri-ui/src-tauri/src/grpc.rs`
- Modify: `tauri-ui/src-tauri/src/lib.rs`

- [ ] **Step 1: 为纯布局补丁和消息契约写失败测试**

在 `lib.rs` 测试模块覆盖：非法 library/Room/Desk、非 v2、非数组 icons、仅替换目标 `icons`、剥离客户端 `__source`、素材校验失败不写盘、消息 `Type === 26`。核心辅助函数先以签名占位：

```rust
const CMD_ROOM_LAYOUT_SYNC: i32 = 26;
static DESK_LAYOUT_SYNC_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn replace_desk_icons(
    room: &mut serde_json::Value,
    desk_index: usize,
    icons: serde_json::Value,
) -> Result<(), String>;

fn room_layout_message(
    room_json: &str,
    desk_index: usize,
    enter_edit: bool,
    highlight_target: Option<&str>,
) -> Result<String, String>;
```

- [ ] **Step 2: 运行 Rust 定向测试并确认红灯**

Run: `cargo test desk_layout --manifest-path tauri-ui/src-tauri/Cargo.toml`

Expected: 编译失败或新断言失败，因为命令与辅助函数尚不存在。

- [ ] **Step 3: 增加 `SendMessageWallpaper` Rust 客户端**

在 `grpc.rs` 导入生成的 `WallpaperMessageRequest` 并实现：

```rust
pub async fn send_message_wallpaper(lively_info_path: &str, msg: &str) -> Result<(), String> {
    let request = WallpaperMessageRequest {
        monitor_id: String::new(),
        lively_info_path: lively_info_path.to_string(),
        msg: msg.to_string(),
    };
    verified_call(
        "/Lively.Grpc.Common.Proto.Desktop.DesktopService/SendMessageWallpaper",
        &request.encode_to_vec(),
    ).await.map(|_| ())
}
```

- [ ] **Step 4: 实现可测试的受控写入内核**

增加 camelCase DTO：

```rust
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DeskLayoutSyncResult {
    active: bool,
    saved: bool,
    live_updated: bool,
    room_json: Option<String>,
    live_error: Option<String>,
}
```

把“当前 wallpaper 匹配 + `__source` 读取”提取为同时返回 `ActiveRoom` 与确切 `lively_info_path` 的内部结构。命令签名固定为：

```rust
#[tauri::command]
async fn sync_active_desk_icons(
    library_dir: String,
    room_dir: String,
    desk_index: usize,
    icons: serde_json::Value,
    enter_edit: bool,
    highlight_target: Option<String>,
) -> Result<DeskLayoutSyncResult, String>;
```

锁内顺序：`direct_room_in_library` → 再确认当前 `__source` 匹配 → 读取源 JSON → 只替换 icons → 完整校验 → `atomic_write` 源 → 带可信 `__source` 原子写运行包 → 生成 Type 26 消息 → RPC。非当前返回 `active:false,saved:false`；源成功后任何运行态失败返回 `Ok(saved:true,liveUpdated:false,liveError:...)`。

- [ ] **Step 5: 补并发和部分失败测试**

把磁盘/RPC 边界抽成最小内部函数或闭包注入点，测试两次并发更新不会基于同一旧 JSON 丢字段；测试源写成功、运行包/RPC 失败时结果不伪装成功且源文件保留新 icons。

- [ ] **Step 6: 注册命令并跑绿**

在 `tauri::generate_handler!` 注册 `sync_active_desk_icons`。

Run: `cargo test desk_layout --manifest-path tauri-ui/src-tauri/Cargo.toml`

Expected: PASS。

Run: `cargo check --manifest-path tauri-ui/src-tauri/Cargo.toml`

Expected: PASS。

- [ ] **Step 7: 提交**

Run: `git diff --check`

Commit: `git add tauri-ui/src-tauri/src/grpc.rs tauri-ui/src-tauri/src/lib.rs && git commit -m "feat: add controlled active desk sync command"`

---

## Task 4: 增加 Core → Player 类型化布局消息

**Files:**

- Modify: `lively-core-separation/src/Lively/Lively.Models/Message/MessageType.cs`
- Create: `lively-core-separation/src/Lively/Lively.Models/Message/LivelyMessageRoomLayoutSyncCmd.cs`
- Modify: `lively-core-separation/src/Lively/Lively.Common/JsonConverters/IpcMessageConverter.cs`
- Modify: `lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs`

- [ ] **Step 1: 追加消息类型和模型**

只在 enum 末尾追加：

```csharp
cmd_room_layout_sync,
```

模型固定为：

```csharp
public class LivelyMessageRoomLayoutSyncCmd : IpcMessage
{
    public string RoomJson { get; set; }
    public int DeskIndex { get; set; }
    public bool EnterEdit { get; set; }
    public string HighlightTarget { get; set; }

    public LivelyMessageRoomLayoutSyncCmd() : base(MessageType.cmd_room_layout_sync) { }
}
```

- [ ] **Step 2: 接入转换器并先用全量构建捕获契约错误**

在 `IpcMessageConverter.ReadJson` 增加 `cmd_room_layout_sync` 分支。

Run: `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`

Expected: 若模型/项目包含或转换类型有误则 FAIL；修正后 PASS。该仓库没有独立 C# 测试项目，因此用 Rust 的 Type 26 JSON 测试 + C# 全量编译共同锁定跨语言契约。

- [ ] **Step 3: Player 只转发可信 JSON 对象**

在 WebView2 `ProcessMessage` 增加分支；先解析 `RoomJson`，失败时记录错误且不向页面发消息：

```csharp
case MessageType.cmd_room_layout_sync:
    var layout = (LivelyMessageRoomLayoutSyncCmd)obj;
    var room = JsonConvert.DeserializeObject<JObject>(layout.RoomJson);
    webView.CoreWebView2.PostWebMessageAsJson(JsonConvert.SerializeObject(new {
        type = "dext:room-layout",
        room,
        deskIndex = layout.DeskIndex,
        enterEdit = layout.EnterEdit,
        highlightTarget = layout.HighlightTarget ?? string.Empty,
    }));
    break;
```

- [ ] **Step 4: 重跑构建并提交**

Run: `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`

Expected: PASS。

Run: `git diff --check`

Commit: `git add lively-core-separation/src/Lively/Lively.Models/Message/MessageType.cs lively-core-separation/src/Lively/Lively.Models/Message/LivelyMessageRoomLayoutSyncCmd.cs lively-core-separation/src/Lively/Lively.Common/JsonConverters/IpcMessageConverter.cs lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs && git commit -m "feat: forward room layout updates to player"`

---

## Task 5: 让真实桌面热更新图标并原子避让 Widget

**Files:**

- Create: `wallpapers/dext-room/layout.js`
- Create: `wallpapers/dext-room/layout.test.cjs`
- Modify: `wallpapers/dext-room/index.html`
- Modify: `wallpapers/dext-room/main.js`
- Modify: `wallpapers/dext-room/style.css`

- [ ] **Step 1: 写无 DOM 的布局契约失败测试**

使用 Node test runner 覆盖运行态网格换算、单/多冲突、候选争抢、Dock/其他 Widget、无解整体回退、只移动冲突项、输入不变。UMD API：

```js
const {
  logicalIconGrid,
  resolveWidgetIconAvoidance,
} = require("./layout.js");
```

Run: `node --test wallpapers/dext-room/layout.test.cjs`

Expected: FAIL，因为 `layout.js` 尚不存在。

- [ ] **Step 2: 实现浏览器/Node 共用纯函数并跑绿**

`layout.js` 通过 UMD 同时导出给 `module.exports` 和 `globalThis.DextLayout`。`logicalIconGrid` 必须把实际 `iconLayer` 尺寸映射到 1920×1080 逻辑坐标；`resolveWidgetIconAvoidance` 与 Task 1 使用相同的最少候选、最近距离、稳定打平和原子失败规则。

Run: `node --test wallpapers/dext-room/layout.test.cjs`

Expected: PASS。

- [ ] **Step 3: 接入下行热更新且保持实例生命周期**

在 `index.html` 中于 `main.js` 前加载 `layout.js`。在 WebView `message` handler 增加 `dext:room-layout` 校验和处理：

```js
function applyRoomLayoutUpdate(data) {
  if (!validRoomLayoutMessage(data)) return;
  const target = data.deskIndex;
  const nextIcons = JSON.parse(JSON.stringify(data.room.desks[target].icons));
  ROOM.desks[target].icons = nextIcons;
  if (data.enterEdit && target !== currentDesk) {
    currentDesk = target;
    renderDesk(currentDesk);
  } else if (target === currentDesk) {
    renderIcons(iconLayer, ROOM.desks[currentDesk], sizeOf(ROOM.desks[currentDesk]));
  }
  if (data.enterEdit) enterEdit();
  if (data.highlightTarget) highlightIcon(data.highlightTarget);
}
```

`highlightIcon` 只增加短时 CSS class，不写入 Room；运行中应用集合继续独立保留。`enterEdit()` 已处于编辑模式时也要允许刷新后高亮，不能因早退丢动作。

- [ ] **Step 4: 接入 Widget 拖动预览与原子提交**

`startWidgetDrag` 保存 Widget origin 和 `ROOM.desks[currentDesk].icons` 深拷贝。pointermove 只调用求解器更新半透明 ghost/冲突 CSS，不改 icons；pointerup 有完整解才同时写 Widget placement 与新 icons、重绘并只调用一次 `persistRoom()`；无解恢复 origin/icons、重绘并 toast。pointercancel 始终恢复，不落盘。

- [ ] **Step 5: 自动检查并提交**

Run: `node --test wallpapers/dext-room/layout.test.cjs`

Run: `node --check wallpapers/dext-room/layout.js`

Run: `node --check wallpapers/dext-room/main.js`

Expected: 全部 PASS。

Run: `git diff --check`

Commit: `git add wallpapers/dext-room/layout.js wallpapers/dext-room/layout.test.cjs wallpapers/dext-room/index.html wallpapers/dext-room/main.js wallpapers/dext-room/style.css && git commit -m "feat: hot update desk icons and prioritize widgets"`

---

## Task 6: 让配置器画布遵守同一原子回退语义

**Files:**

- Modify: `tauri-ui/src/components/DesktopCanvasEditor.tsx`
- Modify: `tauri-ui/src/lib/widget-layout.test.ts`

- [ ] **Step 1: 增加无解回退回归测试**

在纯函数测试中补充“求解失败时 Widget 候选不能形成可提交 Desk”的断言，并确认 `avoidIconObstacles(...).committed === false` 返回原 icons。

- [ ] **Step 2: 修改 `finishPlacement` 的提交条件**

让 `finishPlacement` 返回 boolean；只有 `avoided.committed` 时调用一次：

```ts
onDeskChange({ ...desk, widgets, icons: avoided.icons }, detail);
```

失败时用拖动开始前保存的 `originWidgets` 恢复画面，不调用 `onDeskChange` 写入半完成状态，并显示与真实桌面一致的“空间不足，Widget 已恢复原位”。pointermove 可计算预览，但不得更新 Desk icons。

- [ ] **Step 3: 测试、构建并提交**

Run: `npx vitest run src/lib/widget-layout.test.ts`

Run: `npm run build`

Expected: PASS。

Run: `git diff --check`

Commit: `git add tauri-ui/src/components/DesktopCanvasEditor.tsx tauri-ui/src/lib/widget-layout.test.ts && git commit -m "fix: make configurator widget avoidance atomic"`

---

## Task 7: 接通配置器实时同步、自动最小化与焦点回读

**Files:**

- Modify: `tauri-ui/src/App.tsx`
- Modify: `tauri-ui/src/components/SettingsPage.tsx`
- Modify: `tauri-ui/src/lib/live-layout.ts`
- Modify: `tauri-ui/src/lib/live-layout.test.ts`
- Modify: `tauri-ui/src/lib/config-preferences.test.ts`

- [ ] **Step 1: 写流程决策失败测试**

在 `live-layout.ts` 增加并测试纯决策函数，覆盖新增/移除、偏好开关、当前/非当前 Room、Core 离线、`saved/liveUpdated` 部分失败：

```ts
export function deskAppSyncOutcome(input: {
  action: "added" | "removed";
  preference: boolean;
  isActiveRoom: boolean;
  coreConnected: boolean;
  result?: DeskLayoutSyncResult;
}): { minimize: boolean; closePicker: boolean; message: string };
```

只有“added + preference + active + connected + saved + liveUpdated”可同时 `minimize:true,closePicker:true`；移除从不自动最小化。

- [ ] **Step 2: Settings 接入默认开启的本地偏好**

由 `App` 持有状态并传给 `SettingsPage`：

```ts
minimizeAfterDeskAppAdd: boolean;
onMinimizeAfterDeskAppAddChange: (value: boolean) => void;
```

在“偏好设置”独立小节加入开关“放入应用后前往桌面编辑”，说明“新增成功后最小化配置器，并在目标 Desk 高亮新图标”。该开关不得受 Core 在线状态禁用。

- [ ] **Step 3: 把 `toggleDeskApp` 改为异步热同步流程**

先不可变更新草稿/历史；仅当 `roomPath === appliedRoom` 且 Core 已连接时向 Task 2 队列提交：

```ts
invoke<DeskLayoutSyncResult>("sync_active_desk_icons", {
  libraryDir: libDir,
  roomDir: roomPath,
  deskIndex,
  icons: result.desk.icons,
  enterEdit: result.action === "added" && minimizeAfterDeskAppAdd,
  highlightTarget: result.action === "added" ? app.target : null,
});
```

成功结果更新 `roomBaselineRef` 和配置器 persisted baseline；部分失败显示“已保存，桌面同步失败”且不最小化。完全成功且偏好开启时，先 `setAppPickerDesk(null)`，再 `await getCurrentWindow().minimize()`；关闭偏好则保留选择器以便连续添加。

- [ ] **Step 4: 撤销/重做复用同一队列**

比较 undo/redo 前后的 Desk `icons`；当前 Room 有成员/坐标变化时提交目标 Desk 的最新快照，`enterEdit:false`、`highlightTarget:null`。其他字段继续只改草稿。

- [ ] **Step 5: 窗口获焦时定向合并桌面布局**

仅在 Tauri、Room 已打开且当前 Room 为 applied Room 时监听 `focus`，调用 `read_room` 后以 `cleanDesk` 解析源 desks，再用 `mergeLiveLayoutFields(snapshot(), persistedDesks)` 更新图标和 Widget placement。随后以源 JSON 更新 baseline，并用 `buildRoomV2(mergedDesks)` 与源 baseline 比较重新计算 dirty；不得覆盖背景/转场/Dock/权限等草稿。对已卸载组件和过期 Room 路径使用 request token 防止旧响应回写。

- [ ] **Step 6: 运行前端测试/构建并提交**

Run: `npm test`

Run: `npm run build`

Expected: PASS。

Run: `git diff --check`

Commit: `git add tauri-ui/src/App.tsx tauri-ui/src/components/SettingsPage.tsx tauri-ui/src/lib/live-layout.ts tauri-ui/src/lib/live-layout.test.ts tauri-ui/src/lib/config-preferences.test.ts && git commit -m "feat: sync desk app changes into active room"`

---

## Task 8: 全链验证、文档收口并进入待验收

**Files:**

- Modify: `dev_docs/README.md`
- Modify: `dev_docs/ROADMAP.md`
- Modify: `dev_docs/TODO.md`
- Modify: `dev_docs/FRONTEND.md`
- Modify: `dev_docs/ERRORS.md`（仅本轮实际出现且已解决新坑时追加）
- Modify: `dev_docs/acceptance/DESK-LIVE-001-live-layout-sync.md`

- [ ] **Step 1: 同步接口与行为文档**

在 README 接口索引登记 `sync_active_desk_icons` 和 `cmd_room_layout_sync`；在 FRONTEND 记录偏好键、同 Desk 只重绘图标层、Widget 原子回退；TODO 每完成一项立即打标。不要提前把 ROADMAP 标为完成。

- [ ] **Step 2: 运行全量自动验证**

Run: `npm test --prefix tauri-ui`

Expected: 全部 PASS。

Run: `npm run build --prefix tauri-ui`

Expected: PASS。

Run: `node --test wallpapers/dext-room/layout.test.cjs`

Run: `node --check wallpapers/dext-room/layout.js`

Run: `node --check wallpapers/dext-room/main.js`

Expected: 全部 PASS。

Run: `cargo test --manifest-path tauri-ui/src-tauri/Cargo.toml`

Run: `cargo check --manifest-path tauri-ui/src-tauri/Cargo.toml`

Expected: 全部 PASS。

Run: `powershell -ExecutionPolicy Bypass -File scripts/build.ps1`

Expected: PASS。

Run: `powershell -ExecutionPolicy Bypass -File scripts/start.ps1`

Expected: Dext Core 与配置器从当前 worktree 启动，日志身份/路径指向本 worktree。

Run: `python scripts/validate-room-schema.py`

Expected: 所有 Room v2、Creator Pack 与正反 fixtures Schema 检查通过。

Run: `git diff --check`

Run: `git status --short`

Expected: 只有本工作包文档更新待提交，无临时运行文件混入。

- [ ] **Step 3: 按验收卡做开发者实机预检**

至少预检：默认新增自动前往桌面、关闭偏好连续新增、非当前 Room 不最小化、Widget 移动/缩放让位、无解回退、回到配置器保留其他草稿、Dock/启动/运行圆点回归。会改变桌面状态，只在当前工作包验收阶段执行。

- [ ] **Step 4: 更新状态并提交文档**

将验收卡自动检查逐项打勾，追加测试命令与结果；ROADMAP 改为“待验收”，TODO 改为 `[?] 用户按独立验收卡确认`。

Commit: `git add dev_docs/README.md dev_docs/ROADMAP.md dev_docs/TODO.md dev_docs/FRONTEND.md dev_docs/acceptance/DESK-LIVE-001-live-layout-sync.md && git commit -m "docs: prepare DESK-LIVE-001 acceptance"`

- [ ] **Step 5: 停在待验收，不合并 master**

向用户逐项给出 `dev_docs/acceptance/DESK-LIVE-001-live-layout-sync.md` 的 8 条人工步骤。只有用户明确回复通过后，才使用 `superpowers:finishing-a-development-branch` 收口、合并 master、归档 TODO 并清理分支/worktree。

---

## Plan Self-Review

- [x] 规格覆盖：目标、非目标、成功/部分失败、最新写入获胜、同 Desk 生命周期、跨 Desk 行为、焦点合并、撤销/重做均有对应任务和测试。
- [x] 占位扫描：实施步骤没有 `TBD`、伪代码占位或跳过的失败测试；所有代码块均为明确接口或最小实现骨架。
- [x] 类型一致：TypeScript `DeskLayoutSyncResult`、Rust camelCase DTO、C# `MessageType=26` 和宿主 `dext:room-layout` 字段逐项一致。
- [x] 安全一致：所有写入路径来自 Rust 规范化结果；非法 Room/Desk/JSON 在任何写盘前失败；桌面上行继续只接受顶层官方宿主。
- [x] 验收边界：实现提交后只转“待验收”，用户通过前不合并 master。
