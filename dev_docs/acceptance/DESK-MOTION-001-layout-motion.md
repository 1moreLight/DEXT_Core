# DESK-MOTION-001 桌面自动重排动画验收

- 状态：待浏览器验收（阶段 A）
- 分支：`feat/DESK-MOTION-001-layout-motion`
- 设计：`docs/superpowers/specs/2026-09-19-desk-layout-motion-design.md`
- 计划：`docs/superpowers/plans/2026-09-19-desk-layout-motion.md`
- 目标：用同一套轻量 FLIP/WAAPI 引擎表现 Desk 自动让位、路径重排、新增、移除和回弹；浏览器先验收，再接入真实桌面。
- 范围外：不改变 Room Schema，不实现按名称/频率一键整理，不引入 Muuri/dnd-kit/React Grid Layout，不投入即将由 UI-008 删除的配置器桌面画布。

## 阶段 A：浏览器动画实验台

### 自动检查

- [x] Node 14/14 覆盖稳定身份、重复签名、路径插入重排、Widget/Dock 障碍、move/enter/exit diff、受影响范围、revision、取消、回弹和 reduced-motion。
- [x] Playwright 22/22 覆盖稳定 DOM、外层 FLIP 与内层 jiggle 并存、托起/占位/路径让位/提交、Widget 保持与拖动、Dock 禁放、连续 revision、Reset/场景切换清理、每手势独立取消基线、旧 pointerup 失效、pointercancel、新增/移除、无解回弹、开关与系统级 reduced-motion 和 100 图标压力场景。
- [x] `npm test`（50/50）、`npm run build`、`npm run test:renderer:e2e`、渲染器 Node 测试（14/14）、语法检查、Room Schema 与 `git diff --check` 通过。

### 人工验收

1. [ ] 长按图标约 500ms 进入苹果式编辑模式，图标持续轻微抖动；重排时抖动与位移动画同时存在，点击 Done 退出。
2. [ ] 运行 `npm run dev:motion`；Widget 推开单个图标时，图标以 280ms 克制地滑入最近空格，没有跳变。
3. [ ] Widget 同时推开多个图标时，仅受影响图标移动，未冲突图标保持稳定。
4. [ ] `Stress · rapid` 作为极限连续 revision 场景不闪回旧位置、不出现重复节点或完成回调覆盖新布局；它不代表日常速度。
5. [ ] 拖起图标时轻微抬高并保留占位；跨过目标格中线后，占位沿路径移动，中间图标依次滑动让位，不做两两交换。
6. [ ] 松手保存新的图标顺序；pointercancel、无效目标或拖入 Dock 时完整恢复。图标重排不得移动 Widget。
7. [ ] Widget 自身可以拖动，经过图标时保持 Widget 位置并让冲突图标避让；Widget 也不能进入 Dock。
8. [ ] 新增图标以 180ms 淡入并从 0.92 恢复；移除以 140ms 缩小淡出，最终 DOM 正确。
9. [ ] 无可用格时按 300ms 回弹；取消可以选择恢复，不遗留 transform/opacity。
10. [ ] reduced-motion 模式立即落位，仅保留冲突状态、新增高亮、托起和占位语义。
11. [ ] 100 图标压力场景交互连续，无明显卡顿；实验台信息和控制不遮挡主画布。

> 硬门槛：以上浏览器质感未经用户明确确认，不修改真实桌面 `main.js` 的现有交互。

## 阶段 B：真实桌面集成（浏览器验收后）

1. [ ] Widget 推开单个/多个图标、快速折返与无解回弹符合浏览器确认的运动语言。
2. [ ] 图标连续跨格路径重排、取消与落位稳定；pointerup 只提交一次，Widget 不被图标排序移动，Dock 不接受放置。
3. [ ] 当前 Room 实时新增/移除复用节点并正确动画；旧 revision 不覆盖新节点。
4. [ ] 初次加载、Desk staging 切换和窗口缩放不播放自动重排动画。
5. [ ] Desk 切换、Widget 内容、应用启动、Dock、保存与重启持久化不回归。
6. [ ] 系统 reduced-motion 生效；布局读取与写入各批处理一次，以 60fps 为目标。

## 验收记录

- 2026-09-19：用户确认 DESK-LIVE-001 验收通过；依赖已合入 master，DESK-MOTION-001 开工。
- 2026-09-19：用户已批准浏览器先行、自研轻量动画层与两阶段硬门槛；当前等待阶段 A 实现和浏览器人工验收。
- 2026-09-19：阶段 A 实现完成；Playwright CLI 真实浏览器快照与截图复核通过，自动检查全绿。当前停在浏览器视觉验收，未修改真实桌面 `main.js`。
- 2026-09-19：独立代码审查发现并修复 3 项实验台手势竞态：离开候选格清理 80ms timer、pointercancel/lostpointercapture 恢复基线、异步场景逐 await 校验 token；对应 Playwright 回归由失败转为通过。
- 2026-09-19：用户反馈实验台缺少原有苹果式长按抖动且部分切换过快；核对确认真实桌面文件未改，阶段 A 改为外层 positioner 承载 FLIP、内层 face 保留长按 jiggle，并放缓普通 move/rollback。等待重新验收。
- 2026-09-19：复审发现 reduced-motion 中途切换、系统偏好和预览恢复未完全覆盖；以三条先失败的 Playwright 用例修复，现会立即结束 FLIP、落最终坐标并关闭 jiggle，同时保留取消预览所需基线。
- 2026-09-19：用户将图标交互从“两两交换”明确为 Sortable 路径重排，并确认 Widget 始终优先但可自行拖动、Dock 禁止放入；浏览器实验台按此重新验收。
- 2026-09-19：独立复核补出两个输入事务边界：Reset 未终止 Widget/长按手势，以及旧场景 `previewBase` 污染下一次取消。新增 4 条真实指针回归并修复：Reset 统一 abort 全部输入状态；每次图标/Widget 拖动从当前可见布局建立独立恢复基线。
- 2026-09-19：二次复核发现非 Reset 场景切换仍保留真实 drag，旧 pointerup 可覆盖 Add 结果；统一在所有外部场景切换前撤销当前手势提交权，新增回归确保 India 和 9 节点终态不被覆盖。
- 2026-09-19：最终独立复核无 Critical/Important；全量验证为 Vitest 50/50、Node 14/14、Playwright 22/22，前端构建、语法检查、Room Schema 与 `git diff --check` 均通过。继续停在阶段 A 浏览器人工验收，不接入真实桌面。
