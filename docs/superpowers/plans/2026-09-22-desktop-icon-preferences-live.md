# DESK-PREFS-001 五项桌面图标偏好真实生效 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 设置页现有五项图标偏好在真实 Dext Room、重载后的 Player 和配置器新增应用网格中一致生效，且 `6eca2db` 的旧直接拖动仍可用。

**Architecture:** 复用现有 Settings→Rust→Core→Player 投递和实验台的几何/视觉规则。生产 `.icon` 继续接收 pointer 与 capture，视觉分层只在内部；独立纯函数负责按格索引最小搬格，桌面适配器统一负责事务和持久化。设置回执只表示消息发送，Room 搬格保存另用带请求 ID 的结果消息。

**Tech Stack:** 原生浏览器 JS/CSS、Node `node:test`、Playwright、React/TypeScript/Vitest、Tauri Rust、C# WebView2/.NET9、PowerShell。

**Spec:** `docs/superpowers/specs/2026-09-22-desktop-icon-preferences-live-design.md`；人工验收卡：`dev_docs/acceptance/DESK-PREFS-001-icon-settings-live.md`。

## Global Constraints

- 只在 `D:\use\Orca\DEXT\DEXT_Core-desk-prefs-001` 的 `feat/DESK-PREFS-001-icon-settings-live` 开发；不操作其他 worktree 的未提交文件，不合并 master。
- 五项默认值逐项是 `halo / true / standard / standard / standard`；可见图形 48/56/64px；显示名称的 footprint 72×80/80×84/84×88px，隐藏名称为 64×64/72×72/80×80px；gap 为 4×12/20×28/40×40px。
- `room.json` 的图标 `x/y` 是整数列/行编号，Widget placement 是 1920×1080 逻辑坐标；格子视觉像素变化不等于 Room 坐标变化。
- `.icon` 必须保留 `attachPress(el,index)`、`startDrag()` 和 `setPointerCapture` 主体；不得重新引入 `DextDesktopLayoutController` 或生产 `.icon {pointer-events:none}`。
- 生产启动依赖的 JS/CSS 只能放在 `wallpapers/dext-room/` 映射目录内；浏览器实验台可以反向引用生产文件。
- 不增 Room Schema 字段/运行时依赖；Widget/Dock 仍是图标障碍；有效几何搬格只提交一次 Room；设置仅发送不得谎称渲染完成。
- 自动浏览器测试不能替代 WorkerW/WebView2 连续至少十次真实拖放；自测通过只停在工作分支待验收。

## Review Focus

1. 当前 Room 的两个图标占同一格或某个索引超过缩小后列数：Task 1 测试确定性只搬冲突者，不改输入。
2. 隐藏名称且命中框变小后，鼠标落在旧透明单元边缘：Task 2 Playwright 验证不启动也不拖动，名称浮层无命中。
3. loaded 快照迟于用户新 patch 到达：Task 3/4 测试 revision=0 不覆盖更高 revision；重复消息幂等。
4. 正在拖动图标或 Widget 时更改间距：Task 4 Playwright 验证延迟几何应用且旧 pointerup 不能覆盖新 Room。
5. Core 已写运行包但源 Room 写入失败，或结果消息丢失：Task 3/4 测试显式失败恢复双份旧数据；结果未知时不声称已保存、不凭超时覆盖新状态。

---

## File map（只改当前任务确有必要的文件）

| 文件 | 唯一职责 |
|---|---|
| `wallpapers/dext-room/icon-preferences-layout.js`（新）及 `.test.cjs`（新） | 以格索引、footprint、图标层 CSS 像素障碍做纯函数最小搬格与整 Room 成败汇总 |
| `wallpapers/dext-room/icon-feedback.js/.css` | 现有规范化与视觉样式；为生产外层 `.icon` 命中、内层装饰提供专用选择器，实验台继续共用 |
| `wallpapers/dext-room/index.html`, `style.css`, `main.js` | 生产加载、自身 DOM、旧 pointer 链、偏好事务/启动快照消费、Widget 预览网格和 Room 保存请求 |
| `tauri-ui/tests/renderer/desktop-room.e2e.ts`, `desktop-room-boundary.e2e.ts` | 真 Room 浏览器指针/节点/几何/消息/资源边界回归；不以图标实验台代替 |
| `tauri-ui/src/lib/desktop-icon-preferences.ts` 及 `.test.ts`, `widget-layout.ts` 及 `.test.ts`, `desk.test.ts` | 设置文案、与生产几何契约对照、编辑器网格和新增放置 |
| `tauri-ui/src/App.tsx`, `tauri-ui/src/components/SettingsPage.tsx` | 新增应用时读当前设置；设置 patch 防并发和诚实状态 |
| `tauri-ui/src-tauri/src/lib.rs` | 五项完整快照消息加本配置器实例单调 revision；原有字段不改语义 |
| `lively-core-separation/src/Lively/Lively.Models/Message/LivelyMessageDesktopIconPreferencesCmd.cs`, `LivelyMessageSaveRoomCmd.cs`, 新建 `LivelyMessageRoomSaveResultCmd.cs`, `MessageType.cs`, `Lively.Common/JsonConverters/IpcMessageConverter.cs`, `Lively/Core/Wallpapers/WebWebView2.cs`, `Lively.Player.WebView2/Form1.cs` | revision 转发、带 requestId 的 Room 保存结果，只对可信宿主回传；原启动快照保持完整 |
| `dev_docs/FRONTEND.md`, `dev_docs/README.md`, `dev_docs/PROJECT.md`, `dev_docs/TODO.md`, `dev_docs/acceptance/DESK-PREFS-001-icon-settings-live.md` | 函数/消息表、确认过的结构决策、逐步台账和真实桌面验收结果 |

## Task 1: 纯布局规划器与几何契约

**Files:** Create `wallpapers/dext-room/icon-preferences-layout.js`, `wallpapers/dext-room/icon-preferences-layout.test.cjs`; Modify `tauri-ui/src/lib/desktop-icon-preferences.ts`, `.test.ts`, `widget-layout.ts`, `.test.ts`.

**Interfaces:** Consumes `DextIconFeedback.resolveDesktopIconGeometry(preferences)`，参数 `{icon,art,footprintWidth,footprintHeight,gapX,gapY,cellW,cellH}`。Produces `DextIconPlacement.planDeskReflow(icons,geometry,viewport,blocked)` → `{committed,icons,moved:number[]}`；`planRoomReflow(room,geometry,views)` → `{committed,room,moved:{deskIndex:number,iconIndex:number}[]}`；TS `desktopIconGridForPreferences(preferences,viewport)` → `IconGrid`。`views[i]` 为 `{width,height,blocked:Rect[]}`，所有 Rect 均在 icon-layer 局部 CSS 像素中；TS `IconGrid.cellWidth/cellHeight` 是供 Widget/Dock 判断使用的 1920×1080 逻辑尺寸（与 `DextLayout.logicalIconGrid` 同口径），不是 CSS 步长。

- [ ] **Step 1: 先准备本 worktree 依赖，再写 RED Node/TS 测试。** 若 `tauri-ui/node_modules` 不存在，在本 worktree 运行 `cd tauri-ui; npm ci`；首次运行 Playwright 才执行 `npx playwright install chromium`。复制 `layout.test.cjs` 的 `node:test` 格式，至少固定以下输入/输出：

```js
const G = {footprintWidth:80,footprintHeight:84,gapX:20,gapY:28,cellW:100,cellH:112};
const src = [{label:'A',x:0,y:0},{label:'B',x:1,y:0},{label:'C',x:1,y:0}];
const r = planDeskReflow(src,G,{width:300,height:224,blocked:[]});
assert.equal(r.committed,true);
assert.deepEqual(r.icons.map(v=>[v.x,v.y]),[[0,0],[1,0],[2,0]]);
assert.deepEqual(r.moved,[2]);
assert.deepEqual(src[2],{label:'C',x:1,y:0});
assert.deepEqual(planDeskReflow([{x:8,y:0}],G,{width:100,height:112,blocked:[{x:0,y:0,width:100,height:112}]}).committed,false);
```

  再加：跨 Widget/Dock、隐藏名称 footprint、越界、等距按行列、无解整 Room 回滚、缩回间距不逆迁移、渲染器/TS 全 `3×2×3×3=54` 组几何严格相等。TS 参数例 `desktopIconGridForPreferences({feedbackStyle:'halo',showLabels:false,hitTargetSize:'small',visualSize:'large',spacing:'compact'},{width:1840,height:940})` 应得 `cellWidth=1920/1840*68,cellHeight=1080/940*76,columns=27,rows=12`；另外测试视觉尺寸 64 不改变 footprint 或列数。
- [ ] **Step 2: 运行 RED。** `node --test wallpapers/dext-room/icon-preferences-layout.test.cjs` 与 `cd tauri-ui; npm test -- desktop-icon-preferences widget-layout`；预期分别因新 API 不存在失败，不接受因模块解析或测试语法错误的假 RED。
- [ ] **Step 3: 写最小纯实现。** 与 `layout.js` 一样用 UMD。候选矩形 `left=x*cellW+gapX/2, top=y*cellH+gapY/2, width=footprintWidth, height=footprintHeight`；行列数 `floor(viewport/step)`；合法旧格先按数组顺序占用，冲突者再按 Manhattan 距离→行→列找最近空格，不变图标的原 `x/y` 不写。`planRoomReflow` 对所有 Desk 先求解，任一失败即返回原 Room 的克隆；成功时仅替换变更 Desk 的 icons。TS 几何表直接对应 `icon-feedback.js`，用跨语言契约测试防漂移；`IconGrid.cellWidth = 1920/viewport.width * geometry.cellW`，`cellHeight = 1080/viewport.height * geometry.cellH`。

```js
const overlaps = (a, b) => a.x < b.x+b.width && a.x+a.width > b.x &&
  a.y < b.y+b.height && a.y+a.height > b.y;
const rectAt = (x, y, g) => ({
  x: x * g.cellW + g.gapX / 2, y: y * g.cellH + g.gapY / 2,
  width: g.footprintWidth, height: g.footprintHeight,
});
const valid = (x, y, columns, rows, g, blocked, occupied) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
  x < columns && y < rows && !occupied.has(`${x}:${y}`) &&
  !blocked.some((rect) => overlaps(rectAt(x, y, g), rect));
// 先扫描保留 valid 原格，再为 pending 按 |dx|+|dy|、y、x 排序查找。
```
- [ ] **Step 4: 运行 GREEN 并提交。** 两组定向测试全绿，`git diff --check`；只 add 本 Task 文件并 `git commit -m "feat: plan minimal icon preference reflow"`。TODO 对应步骤立即标记进度。

## Task 2: 生产图标视觉层，不改变旧指针目标

**Files:** Modify `wallpapers/dext-room/index.html`, `style.css`, `main.js`, `icon-feedback.css`（必要时 `icon-feedback.js`）, `tauri-ui/tests/renderer/desktop-room.e2e.ts`, `desktop-room-boundary.e2e.ts`.

**Interfaces:** Consumes `DextIconFeedback.applyDesktopIconPreferences`、`createDesktopIconFeedbackController`、`resolveDesktopIconGeometry`。Produces `applyIconAppearance(preferences)`，只更新 `iconLayer.dataset`、CSS 变量和现有 `.icon` 的 footprint/中心 offset；`renderIcons` 仍调用 `attachPress(el,i)`。

- [ ] **Step 1: 写 RED 真实 Room Playwright。** 保留原基线测试，增加以下观测（不要把“edit remounts”基线测试误改成“编辑不重挂”，本轮只要求*偏好切换*不替换节点）：

```ts
await page.evaluate(() => {
  window.__alphaNode = document.querySelector('[data-launch-target="alpha.exe"]') ?? undefined;
  window.__widgetFrame = document.querySelector('.dext-widget iframe') ?? undefined;
  window.__dextDispatch({type:'dext:desktop-preferences',revision:1,preferences:{feedbackStyle:'bare',showLabels:false,hitTargetSize:'small',visualSize:'large',spacing:'compact'}});
});
expect(await page.evaluate(() => window.__alphaNode === document.querySelector('[data-launch-target="alpha.exe"]'))).toBe(true);
expect(await page.evaluate(() => window.__widgetFrame === document.querySelector('.dext-widget iframe'))).toBe(true);
await expect(page.locator('[data-launch-target="alpha.exe"]')).toHaveCSS('pointer-events','auto');
```

  另测透明边缘的 `document.elementFromPoint` 不落 `.icon`，图形/名称区点击，500ms 浮层及编辑/按下/拖动抑制，PNG 与 Glyph，旧第二次 pointerdown→move 的松手前跟手，系统 reduced-motion 下仍跟手。边界测试拦截 `dext-room/` 外请求并要求页面正常渲染。
- [ ] **Step 2: 运行 RED。** `cd tauri-ui; npm run test:renderer:e2e -- desktop-room.e2e.ts desktop-room-boundary.e2e.ts`；预期新消息或 DOM 断言失败，旧拖动测试仍绿。
- [ ] **Step 3: 引入生产同目录资源和 DOM。** `index.html` 在 `style.css` 后加载 `icon-feedback.css`，在 `layout.js` 后/`main.js` 前加载 `icon-feedback.js` 与 Task 1 的布局 JS。`.icon` 保留当前 `pointerdown` listener、capture 与实际 footprint，设置 `data-dext-icon-face`；内部 `.icon-face` / `.icon-visual` / `.icon-label` / `.icon-label-tooltip` 仅展示，内层 `pointer-events:none`，外层 `auto`。给 Glyph 同时写 `--icon-color`；名称用 `aria-label` 留完整值。生产 CSS 专用选择器把 `.icon` 旧整格 hover/active/jiggle 关闭，悬停在 `.icon:hover` 时给内部 visual 上光晕/框/纯净反馈；编辑只让 visual `±3°/150ms` 抖，文字不抖；拖动当前 visual 暂停并隐藏名称。此阶段先让 `dext:desktop-preferences` 消息更新视觉/footprint，不做搬格或持久化；Task 4 扩展同一个 listener 为完整事务。`applyIconAppearance` 原地改节点样式，不调用 `renderDesk/renderIcons`；没有 Player 快照时保留原 `desk.iconSize` 兼容外观。

```js
el.className = 'icon';
el.dataset.dextIconFace = '';
el.setAttribute('aria-label', item.label ?? '');
const face = document.createElement('div'); face.className = 'icon-face';
const visual = document.createElement('div'); visual.className = 'icon-visual';
visual.appendChild(iconVisual(item)); face.appendChild(visual);
face.append(label, tooltip); el.appendChild(face);
attachPress(el, i); // 仍是外层 el，不是 face
```
- [ ] **Step 4: 运行 GREEN 并提交。** 全真 Room/边界与原 `icon-lab.e2e.ts` 均绿，`node --check wallpapers/dext-room/main.js`，确认 `attachPress(el,i)` 仍有调用，`git diff --check`。只 add 本 Task 文件并提交 `feat: apply icon feedback to direct-drag nodes`。

## Task 3: 可靠的消息顺序与 Room 保存结果

**Files:** Modify `tauri-ui/src-tauri/src/lib.rs`；C# 文件见 File map 的消息/Core/Player 项；Test Rust `lib.rs` 已有测试模块及 `tauri-ui/tests/renderer/desktop-room.e2e.ts`。

**Interfaces:** Existing message `{type:'dext:desktop-preferences',preferences}` extends with numeric `revision`。Core loaded snapshot uses revision `0`，Rust patch carries positive monotonic revision。New optional save request `{type:'saveRoom',room,requestId}` returns `{type:'dext:room-save-result',requestId,success,error?}`；原来不带 requestId 的 saveRoom 不受影响。

- [ ] **Step 1: 写 RED 合约测试。** Rust 断言两个连续 patch 消息 `Revision` 严格递增且五字段完整；Player/renderer 浏览器模拟先投 revision 2 后投 revision 0/1，最终仍为 2；保存请求含 `requestId` 时测试 Core 成功/失败都回传同 ID，旧不带 ID 的保存继续允许。Core 故障注入测试至少模拟第二份源 Room 写入失败，运行包和源 Room 均恢复旧内容。
- [ ] **Step 2: 运行 RED。** `cd tauri-ui/src-tauri; cargo test desktop_icon --lib`；浏览器定向 Playwright；C# 本轮没有现成测试工程，先以 `scripts/build.ps1` 编译和实机/模拟 IPC 合约作为 C# 回归门槛，新增可调用纯保存助手测试时再补定向测试。预期新 revision/requestId 断言失败。
- [ ] **Step 3: 最小协议实现。** Rust 把 `desktop_icon_preferences_message(settings)` 改为 `desktop_icon_preferences_message(settings, revision:u64)`；用 `AtomicU64` 加 `SystemTime` 毫秒组成进程内递增正数，在保存设置成功后写 JSON `Revision`。C# 偏好 IPC model 增 `long Revision`，Player 映射为 `revision`；Core 的 loaded 快照固定 `0`，其旧载荷不因时间早晚覆盖本进程后续 patch。`LivelyMessageSaveRoomCmd` 加可选 `RequestId`；在 `MessageType` 末尾追加 `cmd_save_room_result`，新 `LivelyMessageRoomSaveResultCmd : IpcMessage` 含 `RequestId/Success/Error`，`IpcMessageConverter` 加映射；Core 在 `SaveTrustedRoomCopies` 执行结束后发结果，Player 仅在 trusted host 转为页面消息。双写保存使用写前快照或可恢复备份，第二写异常时恢复第一写并回传失败；不泄漏系统路径到用户可见错误，只保留日志具体异常。

```csharp
public class LivelyMessageRoomSaveResultCmd : IpcMessage
{
    public string RequestId { get; set; }
    public bool Success { get; set; }
    public string Error { get; set; }
    public LivelyMessageRoomSaveResultCmd() : base(MessageType.cmd_save_room_result) { }
}
// Player: 仅 startArgs.DextTrustedHost 时 PostWebMessageAsJson
// { type = "dext:room-save-result", requestId = result.RequestId,
//   success = result.Success, error = result.Error }。
```

```csharp
// Core: 只有 requestId 非空才回结果；旧调用保持原行为。
try { SaveTrustedRoomCopies(roomPath, incoming); SendRoomSaveResult(id, true, null); }
catch (Exception ex) { Logger.Error(ex); SendRoomSaveResult(id, false, "Room 保存失败"); }
```

- [ ] **Step 4: 运行 GREEN 并提交。** Rust 定向测试、`scripts/build.ps1`、`scripts/start.ps1`（不强制重铺）、真 Room 消息测试、`git diff --check`。只 add 本 Task 具名 Rust/C#/测试文件并提交 `feat: order preferences and acknowledge room saves`。

## Task 4: 真实桌面偏好事务与布局持久化

**Files:** Modify `wallpapers/dext-room/main.js`, `icon-preferences-layout.js`, 对应 Node/Playwright tests；必要时 `style.css`。

**Interfaces:** Consumes Task 1 `planRoomReflow`, Task 2 `applyIconAppearance`, Task 3 `revision`/save-result。Produces `receiveDesktopPreferences(message)`、`requestRoomSave(room)`（仅新几何事务等待 ACK）、`viewsForAllDesks(geometry)`（测量或投影每 Desk 的局部 CSS 障碍）、`applyNonGeometryOnly(requested)`、`applyPlannedPreferences({revision,requested,plan})`；在 `startDrag/startWidgetDrag` 声明并结清 `activeIconDrag/activeWidgetGesture`，`pendingPreferences` 只保留最高 revision。旧 `persistRoom()` 和 icon `startDrag()` 的普通保存保留。

- [ ] **Step 1: 写 RED Node/Playwright。** 先测普通外观变更不发 saveRoom，间距/命中/名称变化仅在 `x/y` 实际改动时发一次；无解保持原几何并 toast；跨 Desk 任一无解不修改任何 Desk；Core 显式保存失败还原此前 Room/画面；消息超时只提示“保存结果未确认”而不假装已保存；最新 revision 胜过迟到的 loaded；图标/Widget 手势期间消息暂存到 release/cancel 后应用；热布局和窗口缩放不会让旧回调盖回新布局。

```ts
await page.evaluate(() => window.__dextDispatch({
  type:'dext:desktop-preferences', revision:7,
  preferences:{feedbackStyle:'compact',showLabels:false,hitTargetSize:'large',visualSize:'standard',spacing:'spacious'},
}));
await expect(page.locator('.icon-layer')).toHaveAttribute('data-icon-spacing','spacious');
expect(await page.evaluate(() => window.__roomSavePosts.length)).toBe(1);
```

  测试中的 `__roomSavePosts` 由 `addInitScript` 的 mock `chrome.webview.postMessage` 收集；仅在收到同一 requestId 的成功回执后才把本次事务标记完成。补 `pointercancel/lostpointercapture`，不能只在正常 up 触发延迟偏好。
- [ ] **Step 2: 运行 RED。** Node + `npm run test:renderer:e2e -- desktop-room.e2e.ts`；确认失败定位于缺事务，而非已有拖动基线。
- [ ] **Step 3: 实现。** 消息处理先规范化完整快照，拒绝 `revision < lastAppliedRevision`，相同内容幂等；区分全局 `requestedPreferences` 和本 Room `effectivePreferences`。只有反馈风格/图形大小改变时直接 `applyIconAppearance` 且不保存；名称、命中框、间距变更先用新几何规划，不可先把新 geometry CSS 应用到画面。每 Desk 的 Widget placement、合并后 Dock 位置和当前图标层实际宽高构造 `views`（Widget 的 1920×1080 坐标投影到 icon-layer 局部 CSS 像素；Dock 用实际矩形，非当前 Desk 用 Dock 配置对应的保留矩形）。`planRoomReflow` 先对所有 Desk 计算；无解则保持原 `showLabels/hitTargetSize/spacing`，仅采用新的 `feedbackStyle/visualSize` 并 toast“空间不足，当前 Room 未应用布局偏好”。有解后临时阻止新 icon/Widget 手势，应用完整 `effectivePreferences`，原地改当前图标位置和所有 Desk 的 `icons`，仅有坐标变化时发一次带 ID 的保存。ACK 明确失败时恢复事务快照；ACK 超时视为未知，不虚构已保存，权威热布局到来时清除旧事务。正在拖动时先记最后一个偏好快照，手势结束后再应用，避免旧 pointerup 与新网格混用。Widget 现有 `iconGrid()`、预览 `left/top` 以及图标 drop 列行计算必须统一使用当前有效几何；不改旧 pointer 捕获/跟手代码。窗口缩放只重算视图/中止旧手势，不因暂时缩窄屏幕而持久化 Room 格位。

```js
function receiveDesktopPreferences(message) {
  const revision = Number.isSafeInteger(message?.revision) ? message.revision : 0;
  if (revision < lastAppliedRevision) return;
  const requested = DextIconFeedback.normalizeDesktopIconPreferences(message.preferences);
  if (activeIconDrag || activeWidgetGesture) { pendingPreferences = { revision, requested }; return; }
  const geometry = DextIconFeedback.resolveDesktopIconGeometry(requested);
  const plan = DextIconPlacement.planRoomReflow(ROOM, geometry, viewsForAllDesks(geometry));
  if (!plan.committed) { applyNonGeometryOnly(requested); showToast('空间不足，当前 Room 未应用布局偏好'); return; }
  applyPlannedPreferences({ revision, requested, plan });
}
```
- [ ] **Step 4: 运行 GREEN 并提交。** Node/真 Room/图标实验台全绿，`node --check`、Schema 与 `git diff --check`；只 add Task 相关文件，提交 `feat: apply desktop preferences with safe reflow`。

## Task 5: 配置器新增应用与诚实状态

**Files:** Modify `tauri-ui/src/App.tsx`, `tauri-ui/src/lib/widget-layout.ts`, `tauri-ui/src/lib/desk.ts`（仅必要时）, `tauri-ui/src/lib/desktop-icon-preferences.ts` 及对应 `*.test.ts`, `tauri-ui/src/components/SettingsPage.tsx`。

**Interfaces:** Consumes `desktopIconGridForPreferences(preferences,{width,height})`；原 `toggleDeskApplication(desk,app,grid,dock)` 已支持传 grid。Produces `loadDesktopIconGrid()` in App：Tauri `invoke('get_dext_settings')` 取保存后的五项，按主显示器 CSS viewport 和 `.icon-layer` 的 40/40/100px inset 算网格；无 Tauri 的 UI 设计模式用默认偏好。读取失败不得默默声称布局与真实桌面一致。

- [ ] **Step 1: 写 RED。** `desktop-icon-preferences.test.ts` 把 `applied` 文案改为“Dext 设置已保存，已发送至当前桌面”；`desk.test.ts` 给 `toggleDeskApplication` 传新 grid，断言最右格与 Widget/Dock 避让；`widget-layout.test.ts` 测 1920×1080 的可用图标层 1840×940，标准模式 18 列/8 行。快速连续两次切换设置的组件测试/纯队列测试应确认最后一次保存的完整快照不会被较早响应覆盖。
- [ ] **Step 2: 运行 RED。** `cd tauri-ui; npm test -- desktop-icon-preferences desk widget-layout`；文案与新几何预期失败。
- [ ] **Step 3: 实现。** 将当前 `SettingsPage.tsx` 内私有 `DextSettings` 类型移到 `desktop-icon-preferences.ts` 并导出为 `DextSettingsView`，两处共用，避免 App 再造字段名。`App.toggleDeskApp` 改为 async，在新增前获取最新五项设置并计算 grid，向已有第四参数 `dock` 前的 `grid` 位传入；已存在应用的“移除”不需要等设置读取。若 Core 离线，可使用旧兼容 `desktopIconGrid(desk.iconSize)`，但 `setStatus` 明说“无法读取当前图标设置，按兼容网格放置”，不宣称匹配桌面。`SettingsPage.patch` 在 saving 时拒绝重入或串行排队，按钮和开关禁用到本次 patch 完成；状态改为“已发送”而非“已更新”。

```ts
const saved = await invoke<DextSettingsView>('get_dext_settings');
const viewport = { width: window.screen.width - 80, height: window.screen.height - 140 };
const grid = desktopIconGridForPreferences({
  feedbackStyle: saved.desktopIconFeedbackStyle, showLabels: saved.showDesktopIconLabels,
  hitTargetSize: saved.desktopIconHitTargetSize, visualSize: saved.desktopIconVisualSize,
  spacing: saved.desktopIconSpacing,
}, viewport);
const result = toggleDeskApplication(targetDesk, app, grid, dock);
```
- [ ] **Step 4: 运行 GREEN 并提交。** 定向 Vitest 与 `npm run build`、设计模式深/浅色简查、`git diff --check`；只 add Task 文件并提交 `feat: align editor placement with desktop preferences`。

## Task 6: 全链回归、文档与待验收交付

**Files:** Modify `dev_docs/FRONTEND.md`, `README.md`, `PROJECT.md`（结构决策记录）, `TODO.md`, `ROADMAP.md`, `acceptance/DESK-PREFS-001-icon-settings-live.md`；如果解决新坑，向 `ERRORS.md` 和对应分册追加，不覆写历史。

**Interfaces:** 不新增运行时 API；更新正式入口、协议字段、几何规则、设置状态与操作步骤。

- [ ] **Step 1: 按设计规格逐条核对。** 逐项核对五字段/默认值、`.icon` 指针归属、最小搬格/单次保存、Widget/Dock、真实资源目录、Player loaded 快照、编辑器新增、reduced-motion；若任何项缺少测试，先补前述所属 Task 的定向回归再继续。
- [ ] **Step 2: 完整自动验证。** PowerShell 分开运行：`cd tauri-ui; npm test`、`npm run build`、`npm run test:renderer:e2e`、`cargo test desktop_icon --lib` 与 `cargo check`（在 `src-tauri`）、从仓库根运行 `node --test wallpapers/dext-room/layout.test.cjs wallpapers/dext-room/icon-preferences-layout.test.cjs wallpapers/dext-room/layout-motion.test.cjs`、`node --check wallpapers/dext-room/main.js`、`python scripts/validate-room-schema.py`、`./scripts/build.ps1`、`./scripts/start.ps1`、`./scripts/verify-runtime-identity.ps1`、`git diff --check`。测试结果写入验收卡；不要用 Bash 通配命令或 PowerShell 管道误吞退出码。
- [ ] **Step 3: 实际宿主检查。** 确认 Core、Player、壁纸路径都指向本 worktree；只在用户准备人工验收时按项目指令强制重铺。先自行做一次可重复的旧式图标拖放冒烟，再交用户按验收卡做连续十次、五项设置、重启、Widget/Dock、新增应用和 reduced-motion。若 WebView2 手势失败，留在同一分支修正，不以 Chromium 全绿宣布完成。
- [ ] **Step 4: 文档与提交。** 更新 README/FRONTEND 的函数和 Windows 测试命令，PROJECT 决策注明旧拖动主导/几何事务/设置已发送语义；TODO 每完成一步即打标；验收卡状态改“待验收”、填提交与自动检查结果。`git status --short` 核对，只 add 本任务具名文件并 `git commit -m "docs: record icon preferences acceptance"`；最终停在分支，不合并 master。

## 书面计划通过后的执行顺序

按 Task 1→6 顺序，每一步先测试 RED 再做最小实现、复测 GREEN、具名提交。Task 3 的 Core 双写回执是几何事务可信落盘的前置；Task 4 不得用“消息已发送”替代 Room 保存确认。用户真实桌面验收按独立验收卡八项进行，明确回复通过才进入合并流程。
