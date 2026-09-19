# DESK-MOTION-001 桌面自动重排动画验收

- 状态：待浏览器验收（阶段 A）
- 分支：`feat/DESK-MOTION-001-layout-motion`
- 设计：`docs/superpowers/specs/2026-09-19-desk-layout-motion-design.md`
- 计划：`docs/superpowers/plans/2026-09-19-desk-layout-motion.md`
- 目标：用同一套轻量 FLIP/WAAPI 引擎表现 Desk 自动让位、交换、新增、移除和回弹；浏览器先验收，再接入真实桌面。
- 范围外：不改变 Room Schema，不新增通用排序功能，不引入 Muuri/dnd-kit/React Grid Layout，不投入即将由 UI-008 删除的配置器桌面画布。

## 阶段 A：浏览器动画实验台

### 自动检查

- [x] Node 8/8 覆盖稳定身份、重复签名、move/enter/exit diff、受影响范围、revision、取消、回弹和 reduced-motion。
- [x] Playwright 10/10 覆盖稳定 DOM、动画中 transform、最终格坐标、连续 revision、中断恢复、真实指针 80ms 离格取消、pointercancel 恢复、新增/移除、无解回弹、reduced-motion 和 100 图标压力场景。
- [x] `npm test`（50/50）、`npm run build`、`npm run test:renderer:e2e`、渲染器 Node 测试（11/11）、语法检查、Room Schema 与 `git diff --check` 通过。

### 人工验收

1. [ ] 运行 `npm run dev:motion`；Widget 推开单个图标时，图标迅速但克制地滑入最近空格，没有跳变。
2. [ ] Widget 同时推开多个图标时，仅受影响图标移动，未冲突图标保持稳定。
3. [ ] 快速连续折返与连续 revision 不闪回旧位置、不出现重复节点或完成回调覆盖新布局。
4. [ ] 图标跨入占用格并稳定约 80ms 后出现交换预览；移开或取消时完整恢复。
5. [ ] 新增图标以 180ms 淡入并从 0.92 恢复；移除以 140ms 缩小淡出，最终 DOM 正确。
6. [ ] 无可用格时按 260ms 回弹；取消可以选择恢复，不遗留 transform/opacity。
7. [ ] reduced-motion 模式立即落位，仅保留冲突状态和新增高亮。
8. [ ] 100 图标压力场景交互连续，无明显卡顿；实验台信息和控制不遮挡主画布。

> 硬门槛：以上浏览器质感未经用户明确确认，不修改真实桌面 `main.js` 的现有交互。

## 阶段 B：真实桌面集成（浏览器验收后）

1. [ ] Widget 推开单个/多个图标、快速折返与无解回弹符合浏览器确认的运动语言。
2. [ ] 图标连续跨格交换、取消与落位稳定；pointerup 只提交一次。
3. [ ] 当前 Room 实时新增/移除复用节点并正确动画；旧 revision 不覆盖新节点。
4. [ ] 初次加载、Desk staging 切换和窗口缩放不播放自动重排动画。
5. [ ] Desk 切换、Widget 内容、应用启动、Dock、保存与重启持久化不回归。
6. [ ] 系统 reduced-motion 生效；布局读取与写入各批处理一次，以 60fps 为目标。

## 验收记录

- 2026-09-19：用户确认 DESK-LIVE-001 验收通过；依赖已合入 master，DESK-MOTION-001 开工。
- 2026-09-19：用户已批准浏览器先行、自研轻量动画层与两阶段硬门槛；当前等待阶段 A 实现和浏览器人工验收。
- 2026-09-19：阶段 A 实现完成；Playwright CLI 真实浏览器快照与截图复核通过，自动检查全绿。当前停在浏览器视觉验收，未修改真实桌面 `main.js`。
- 2026-09-19：独立代码审查发现并修复 3 项实验台手势竞态：离开候选格清理 80ms timer、pointercancel/lostpointercapture 恢复基线、异步场景逐 await 校验 token；对应 Playwright 回归由失败转为通过。
