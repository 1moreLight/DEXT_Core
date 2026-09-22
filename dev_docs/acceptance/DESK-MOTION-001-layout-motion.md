# DESK-MOTION-001 桌面自动重排动画验收

- 状态：待验收（阶段 B，未合并 master）
- 分支：`feat/DESK-MOTION-001-layout-motion`
- 设计：`docs/superpowers/specs/2026-09-19-desk-layout-motion-design.md`
- 计划：`docs/superpowers/plans/2026-09-19-desk-layout-motion.md`
- 目标：用同一套轻量 FLIP/WAAPI 引擎表现 Desk 自动让位、路径重排、新增、移除和回弹；浏览器先验收，再接入真实桌面。
- 范围外：不改变 Room Schema，不实现按名称/频率一键整理，不引入 Muuri/dnd-kit/React Grid Layout，不投入即将由 UI-008 删除的配置器桌面画布。

## 阶段 A：浏览器动画实验台

### 自动检查

- [x] Node 14/14 覆盖稳定身份、重复签名、路径插入重排、Widget/Dock 障碍、move/enter/exit diff、受影响范围、revision、取消、回弹和 reduced-motion。
- [x] Playwright 25/25 覆盖稳定 DOM、图标内层与 Widget 整卡 jiggle、拖动暂停/恢复、双击空白退出与交互对象保护、外层 FLIP、托起/占位/路径让位/提交、Widget 保持与拖动、Dock 禁放及抖动安全余量、连续 revision、Reset/场景切换清理、每手势独立取消基线、旧 pointerup 失效、pointercancel、新增/移除、无解回弹、开关与系统级 reduced-motion 和 100 图标压力场景。
- [x] `npm test`（50/50）、`npm run build`、`npm run test:renderer:e2e`、渲染器 Node 测试（14/14）、语法检查、Room Schema 与 `git diff --check` 通过。

### 人工验收

1. [ ] 长按图标或 Widget 约 500ms 进入苹果式编辑模式；图标整体抖动，Widget 的边框、背景和文字整卡抖动；拖起当前对象时仅该对象暂停，松手/取消后恢复；点击 Done 或双击桌面真正空白处退出，双击图标/Widget/Dock 不退出。
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

> 阶段边界：浏览器实验台只验证运动规则与默认参数，不代表生产桌面的组件、主题或最终外观。2026-09-19 用户已明确授权进入阶段 B。

## 阶段 B：真实桌面集成（浏览器验收后）

### 自动检查

- [x] Node 21/21：默认 MotionProfile、稳定身份/重复签名、move/enter/exit、80ms 候选稳定、重复 pointerup、长按中断、Widget 双快照回滚、路径重排、四向 Dock 钳制、revision/cancel/reduced-motion。
- [x] 真实 `wallpapers/dext-room` Playwright 14/14：节点和 iframe 复用、热新增/移除、图标/Widget 拖动与缩放、Dock/取消/丢失捕获、权威更新、双击空白、启动/Dock 点击、reduced-motion。
- [x] 全套 Playwright 39/39；Vitest 50/50；`npm run build`、渲染器 `node --check`、Room Schema 和 `git diff --check` 通过。

### 真实桌面人工验收

1. [ ] 长按图标或 Widget，确认真实完整对象抖动且 Widget iframe 不重载。
2. [ ] 连续跨格拖动图标，确认占位稳定、路径让位、松手后顺序持久化。
3. [ ] 快速折返、拖入 Dock、丢失捕获和取消时完整恢复。
4. [ ] 拖动/缩放 Widget，确认 Widget 优先、图标避让且 Dock 不可进入。
5. [ ] 编辑中实时新增/移除应用，确认节点不闪烁、旧手势不覆盖新布局。
6. [ ] 双击真正空白退出；双击图标、Widget、编辑控件和 Dock 不退出。
7. [ ] 切 Desk、缩放窗口、启动应用、重启后检查布局和 Widget 状态。
8. [ ] 开启 Windows“关闭动画效果”后，确认 FLIP、托起过渡和抖动关闭，最终布局与占位语义仍正常。

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
- 2026-09-19：用户确认 Sortable/Widget 优先/Dock 禁放方向可用，并补充 Widget 在编辑模式下也应抖动；采用 Widget 外层负责坐标、内层 face 独立 jiggle，拖动暂停且 reduced-motion 关闭。
- 2026-09-19：Widget 编辑态 jiggle 浏览器回归先按预期失败后转绿；幅度为 ±0.38°、周期 420ms，拖动当前 Widget 时暂停，松手/取消恢复，退出编辑或 reduced-motion 时关闭。
- 2026-09-19：用户复验指出 Widget 只有文字抖动，并要求双击空白退出编辑；修正目标为整张 Widget 卡片抖动，且仅舞台背景的 `dblclick` 可退出。
- 2026-09-19：两条新行为回归先失败后转绿；完整 25 项浏览器回归发现整卡 rotate 外接框侵入 Dock 安全缝，追加 2px 旋转余量后 25/25 通过。
- 2026-09-19：用户明确实验台只是动画规则实验，不应成为生产桌面外观；生产接入复用运动引擎和默认参数，保留真实图标、Widget iframe、主题、边框与 Dock，并要求先消除稳定性阻塞项。用户随后明确要求实施阶段 B。
- 2026-09-20：阶段 B 已接入真实桌面。生产 DOM 保留原图标、Widget iframe、主题、编辑边框和 Dock；新增控制器只协调稳定节点、手势事务、Sortable 占位、Widget 优先避让与动画。
- 2026-09-20：真实 renderer 14/14、整套 Playwright 39/39、Vitest 50/50、Node 21/21 和构建/语法/Schema 检查全绿；当前停在真实桌面人工验收，未合并 master。
- 2026-09-20：阶段 B 实现提交 `64af642`；分支保持 `feat/DESK-MOTION-001-layout-motion`，等待用户按上述 8 步完成真实桌面验收。
