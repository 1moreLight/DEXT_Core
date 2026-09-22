# DESK-REORDER-002 稳定输入上的路径重排 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task after user confirmation. 本轮仅交付计划，不实现排序，不启动或重铺桌面。

**Goal:** 保留已经修正原生输入的旧直接拖动，在跨格时让沿途图标平滑让位，松手后一次保存，不再牺牲跟手可靠性。

**Architecture:** 输入继续由 Core 转发会话与 `attachPress → startDrag` 负责；纯函数计算预览，独立的同伴动画层只处理未被拖动的现有节点。事务数据不写入 Room，提交/取消由当前单一手势终结。

**Tech Stack:** 原生 JS、现有布局求解器、WAAPI、Node、Playwright、现有 .NET/Release WebView2 测试。

**Spec:** 本文的行为约束是本包冻结规格；沿用用户 DESK-REORDER-001 的路径重排需求，但基线改为修复原生输入后的 master，不恢复旧实现。

## 基线、范围及交付

- 产品基线：master merge `4fd2986`，含 Core 修复 `3c42552`；收尾文档 `23da621`。
- 分支：`feat/DESK-REORDER-002-stable-sortable`；worktree：`D:/use/Orca/DEXT/DEXT_Core-desk-reorder-002`。
- 验收卡：`dev_docs/acceptance/DESK-REORDER-002-stable-sortable.md`。
- 当前版本已按用户授权合并；本包只规划，实施需用户确认，之后仍提交待实机验收，不自动合并。
- 范围外：替换 Core 输入、恢复 DextDesktopLayoutController、改造 Widget 拖动、Room Schema、新设置、依赖大型排序库、自动压缩所有历史空格。
- 原 prefs 工作区仍运行并有用户布局；不删除、不切换其分支、不复制或覆盖真实 Room。

## 历史回溯：为什么“能拖动”后来又失败

| 证据 | 变化 | 判断与防再犯 |
|---|---|---|
| `15147f2` → `b8b00f0` / `64af642` | 真实绑定从 attachPress 移交新控制器；旧函数仍留在文件；控制器把 lostpointercapture 当取消 | 不能只看旧函数是否存在，必须检查实际绑定路径。旧控制器还引入了长按连续拖动等变化，历史各次失败无法仅凭现有日志一一归因 |
| `9f8d569` | 旧直接拖动上加排序，同时新增 lostpointercapture 整体回滚 | 输入监听的取消语义也变了，并非只加动画。与后来 buttons=8 故障链一致，但没有该提交的完整实机日志，不宣称每次失败均已证明同一原因 |
| `cf318ad` | 回退旧排序；相对 `6eca2db` 的 main.js 无差异 | 不 cherry-pick 旧分支 HEAD 来“恢复排序”；算法可参考，手势补丁不能整体搬回 |
| `95d9b5c` + 用户实机日志 | 按下 buttons=1，随后 lostpointercapture buttons=8 | 当前故障中捕获确实成功，之后被取消；不是“命中框一开始没按到” |
| master 旧 InputUtil → `3c42552` | WM_MOUSEMOVE 固定 wParam=0x20，是侧键位而非移动标志；UP 也携带错误按下位 | 原生窗口测试旧码先失败；生产 Release WebView2 复现旧 buttons=8；正确会话连续十轮 capture/MOVE=1/UP=0。根因已在 Core 修复，不通过忽略所有取消事件掩盖 |

这不是需要推倒整个桌面的证据。当前生产只走旧直接拖动，实验台的大量代码不等于运行时并存多套控制器。需要控制的是输入、布局与动画的写入职责。

### 新集成必须规避的现存接口陷阱

1. `DextLayoutMotion.apply(..., { excludeKeys })` 仍对排除节点写最终 left/top；`dispose()` 会移除其管理节点。不能把捕获节点交给它，也不能把整个真实图标层当它拥有的节点树。
2. 当前几何有 `gapX/gapY`、footprint 与五项偏好。旧 reorder 的 `x * cellW` 少了半间隙，旧逻辑画布坐标也不能直接与 DOM 像素混用。
3. 当前 `startDrag` 松手会 `renderDesk`；新预览收尾必须只更新本次图标节点，避免 Widget iframe 重挂。
4. 现有 `resolveIconReorder` 只检查目标与障碍、会规范化源坐标。需补足整个候选布局合法性测试，不能让非法历史布局被悄悄提交。

## Global Constraints

- 保留两段式：长按 500ms 进入编辑并松手，再按住开始拖动；不修改 pointer capture 的对象及直接跟手计算。
- 占用格采用行优先路径插入，沿途图标让位；空格只移动被拖图标。保留数组身份顺序，只更新 x/y。
- 每次从手势基线重新计算，不从上次预览累计；目标格改变立即预览，无 80ms 等待。
- 同伴图标最终 left/top 立即写入，只有 transform 过渡：280ms、cubic-bezier(.22,1,.36,1)。动画中折返从当前视觉位置续接。
- 拖动节点的位置只由 pointermove 写入，动画模块不得读取后反写其布局；松手或取消再吸附。
- Widget 不因图标排序移动；Dock/Widget 为障碍。目标 footprint（含旋转安全边距）也不得相交，不仅检查指针点。
- 指针无效时保留上次有效同伴预览，非法松手整体回滚；不存档。有效且确有变化的松手只更新一次并调用一次 persistRoom。
- pointercancel、丢失捕获、退出编辑恢复基线；热布局、切 Desk、缩放等权威重绘先撤销旧提交权，不再把旧快照写回新状态。
- 五项偏好沿用已有手势中排队机制，手势结束后再消费；不得由排序自行改偏好投递协议。
- 不显示目标框、占位框、位置文字、新增位置描边。仅图形 ±3°/150ms 抖动，名称静止；拖起当前名称隐藏，结束恢复。
- reduced-motion 禁用装饰动画但保留跟手、预览和保存；双击真正空白退出编辑，Widget/Dock/图标交互不误退出。

## 文件与接口边界

| 文件 | 职责 |
|---|---|
| `wallpapers/dext-room/layout.js` / `layout.test.cjs` | 复用 resolveIconReorder；增加可选 footprint 网格参数、输入与最终布局合法性检查，默认兼容实验台 |
| 新 `wallpapers/dext-room/icon-reorder-session.js` / `.test.cjs` | 纯事务：基线、目标、最后有效预览、一次性结算；无 DOM、无 pointer 监听、无持久化 |
| `wallpapers/dext-room/layout-motion.js` / `layout-motion.test.cjs` | 增加非拥有型同伴移动 helper；复用现有参数，不创建/删除/重排 DOM，不改现有 apply/cancel/dispose |
| `wallpapers/dext-room/main.js` / `index.html` | 旧 startDrag 接线、真实几何适配、同伴节点列表、原地提交/回滚及名称样式；移除 highlightIcon 与旧描边 |
| `tauri-ui/src/App.tsx` | 新增应用消息保留 highlightTarget 字段，值改 null；不修改其它偏好与消息协议 |
| 新 `tauri-ui/tests/renderer/desktop-reorder.e2e.ts` | 使用真实 Room 入口验证交互，而非实验台 |
| `tests/Dext.Input.Tests/WebViewProbe.cs`、新 `RoomReorderProbe.cs` | 在现有隔离 Release Player 测试上增加实际 Room 原生消息拖动场景 |

纯事务接口：`createIconReorderSession({ icons, draggedIndex, grid, obstacles, reserved })` 返回 `preview(target|null)`、`finish({commit})`、`abort()`。preview 返回 `{valid, icons, moved}`，非法时 icons 为最后有效预览。finish 首次返回 `{committed, icons, moved}`，重复调用返回 null；abort 只撤销提交权。grid 使用 iconLayer-local CSS px，新增可选 `offsetX/offsetY/footprintWidth/footprintHeight`，缺省按旧整格。

动画接口：`createPeerMotion({ reducedMotion })` 返回 `apply(entries)`、`cancel()`、`dispose()`；entry 为 `{key,node,left,top}`。三者不增删节点；apply 仅允许同一手势冻结的未拖动节点。每次先批读视觉矩形，再取消旧动画/批写最终位置，最后用 oldRect 减目标绝对位置播放 FLIP；回调用 revision 与 animation 对象双重校验。

## Review Focus

- 真实 WebView2 与浏览器输入不同：Task 1/5 必须验证原生消息，不只使用 page.mouse。
- 偏好中隐藏名称、大图标小命中框、Windows 缩放：Task 2/5 同时验证像素坐标与 footprint。
- 拖动途中第二根指针/旧 pointerup：Task 3 过滤 pointerId 并校验单次结算。
- 高频折返过程中热更新/偏好到达：Task 3/4 验证新状态不被回调或排队顺序覆盖。
- Widget iframe 点击与拖动结束后的启动应用：Task 5 验证节点身份及点击，不能只比较最终截图。

## Task 1：锁定可拖动输入基线

- [ ] 在本包执行前运行 `dotnet run --project tests/Dext.Input.Tests` 与 README 的隔离 Release Player 命令。预期十轮 capture、MOVE=1、UP=0；Core 输入源码相对 master 零差异。
- [ ] 在 `desktop-reorder.e2e.ts` 建立至少五图标、Widget 和 Dock 的 Room fixture。复用现有 desktop-room.e2e.ts 的 chrome.webview 记录方式与 route，长按 530ms 松手后再拖动。
- [ ] 先锁定不加排序时“松手前跟手”的绿基线：记录 down 时节点和坐标，move(120,40) 后断言同一节点 x/y 同量变化、saveRoom 为0。
- [ ] 记录 pointermove/capture 及图标节点身份，失败则停在输入诊断，不继续动画实现。提交测试基线。

## Task 2：几何与纯排序事务（先不接动画）

- [ ] 给 layout.test.cjs 加失败用例：源越界不被 clamp 后提交；非法中间 footprint 不穿 Widget；稀疏空格不搬其它图标；大图小命中、隐藏名称及三档 gap 一致。
- [ ] 为事务写先失败测试，明确验证不修改源数组和连续 preview 从基线推导：

```js
const base = ['A', 'B', 'C', 'D'].map((label, x) => ({label, x, y: 0}));
const tx = createIconReorderSession({icons: base, draggedIndex: 0,
  grid: {cellWidth: 100, cellHeight: 100, columns: 6, rows: 1}, obstacles: [], reserved: []});
assert.deepEqual(tx.preview({x: 2, y: 0}).icons.map(i => i.x), [2, 0, 1, 3]);
assert.deepEqual(tx.preview({x: 1, y: 0}).icons.map(i => i.x), [1, 0, 2, 3]);
assert.deepEqual(tx.preview({x: 5, y: 0}).icons.map(i => i.x), [5, 1, 2, 3]);
assert.equal(tx.preview(null).valid, false);
assert.equal(tx.finish({commit: false}).committed, false);
assert.equal(tx.finish({commit: true}), null);
assert.deepEqual(base.map(i => i.x), [0, 1, 2, 3]);
```

- [ ] 实现上述接口，只保存副本与 settled 位；有效候选必须所有格合法、唯一、不与障碍相交；无法满足则返回原基线，不部分修复历史 Room。
- [ ] 运行 `node --test wallpapers/dext-room/layout.test.cjs wallpapers/dext-room/icon-reorder-session.test.cjs`，预期全绿；提交纯计算层。

## Task 3：只接预览/提交，不改变鼠标入口

- [ ] Playwright 先增加失败断言：A 跨入 C 的格，pointerup 前 B/C 已改格且 Room 尚未保存；非法释放恢复所有图标，有效释放只存一次。
- [ ] startDrag 内冻结 desk、icons、nodes、pointerId 和当前几何。保留原始跟手两行，再调用 preview；不得对拖动元素 set transform 或调用 renderIcons/renderDesk。

```js
// 留在原 onMove；不得由布局动画替换。
el.style.left = `${origLeft + ev.clientX - sx}px`;
el.style.top = `${origTop + ev.clientY - sy}px`;
// 对其它节点写 preview 的 x*cellW+gapX/2、y*cellH+gapY/2。
```

- [ ] 从 iconLayer.getBoundingClientRect 与实际 Widget/Dock rect 转为同一 local px；边界/障碍点无效或候选 footprint 无效时 preview(null)。旋转安全余量用未旋转宿主尺寸和既有角度计算，不采样正在抖动的 rect 当稳定布局。
- [ ] clearDrag 先撤销本手势 token、解绑监听，再释放捕获；只处理匹配 pointerId。有效 up 再采一次坐标并结算；changed 才写 desk.icons、persistRoom，一律原地更新本次图标节点。
- [ ] 为 hot layout、renderDesk、resize、退出编辑、Widget 开始添加测试；权威更新 abort(false)，用户取消恢复本次基线。旧 up/旧动画无提交权；随后消费现有 pending preferences。
- [ ] 运行真实 Room Playwright 和 Task 1 基线；提交无动画排序。此时必须仍可靠跟手，失败不进入下一步。

## Task 4：同伴动画与反馈

- [ ] layout-motion.test.cjs 先加失败测试：apply 不写拖动节点、不 append/remove；快速 revision 旧回调无权清样式；cancel/dispose 保留节点；animate 抛错立即最终落位。
- [ ] 在共享 layout-motion.js 增加 createPeerMotion，不实例化节点拥有型 DextLayoutMotion。同伴 helper 只接 Task 3 的固定 nodes（排除 draggedIndex），取消时清其自身动画，不清图形内层抖动。
- [ ] Playwright 断言中途 peers transform 非单位、拖动节点仍按指针移动；反向重定向无旧坐标闪回；reduced-motion 下 peers 无动画但最终位置和保存相同。
- [ ] 移除 highlightIcon 调用/函数与 live-layout-highlight CSS，App 的 highlightTarget 为 null。保留 Widget 冲突反馈。编辑仅图形 ±3°/150ms；当前拖动名称隐藏，结束恢复。
- [ ] 检查无新增框/占位/位置文字，连续重复方向不重启动画，提交同伴动画与反馈改动。

## Task 5：原生 Player、回归和交付门槛

- [ ] 扩展隔离 Player probe：在测试临时目录复制本 worktree 的真实 Room 资源并校验 main.js/CSS 哈希；仅临时 index.html 注入观察脚本和固定 Room fixture，通过原生 PostMessage 驱动两段式拖动。观察脚本包装原 livelyPropertyListener，接收现有 lp_textbox 命令触发测量，以 chrome.webview.postMessage 输出诊断；不得假设 Player 存在任意 JS 执行 IPC，不把测试桥写入产品 main.js。
- [ ] 保留旧 fixture 的 buttons=8 对照；实际 Room 连续十轮在 up 前验证拖动坐标、同伴让位、节点身份、有效 up 一次保存、非法 up 不保存。测试不连接 Core、不修改用户 Room、不结束真实 Player。
- [ ] 运行以下命令并记录结果；如修改测试 C#，构建隔离测试；产品 C# 预计零差异。

```powershell
npm test --prefix tauri-ui
npm run build --prefix tauri-ui
npm run test:renderer:e2e --prefix tauri-ui
node --test wallpapers/dext-room/layout.test.cjs wallpapers/dext-room/layout-motion.test.cjs wallpapers/dext-room/icon-preferences-layout.test.cjs wallpapers/dext-room/icon-reorder-session.test.cjs
node --check wallpapers/dext-room/main.js
node --check wallpapers/dext-room/icon-reorder-session.js
dotnet run --project tests/Dext.Input.Tests
git diff --check
```

- [ ] 按 tests/Dext.Input.Tests/README.md 启动隔离 Release Player 回归；运行现有 Room contract/Schema 检查，Room Schema 相对 master 零差异。
- [ ] 用户准备实机验收后才从新 worktree 启动/重铺，先核对 Core/Player/wallpaper 绝对路径；C# 输出不存在则先 scripts/build.ps1。不得复用旧运行目录伪称本包已验证。
- [ ] 完成验收卡七项；自动结果不能替代物理鼠标验收。更新 TODO/ERRORS/FRONTEND，具名暂存提交，停在待用户验收，不合并。

## 回退边界

每阶段单独提交。若 Task 3 或 Task 4 破坏输入，撤回该阶段的排序接线/动画改动，保留 master `3c42552` 原生输入修复和五项偏好；不得整体回退到旧 Core。真实故障先保存运行路径与原生按钮序列，不继续叠加定时器、忽略 lostpointercapture 或另一套控制器。
