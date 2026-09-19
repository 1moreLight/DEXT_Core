# DESK-MOTION-001 桌面自动重排动画设计

## 目标与边界

现有 `DextLayout` 继续只计算最终布局：Widget 避让由 `resolveWidgetIconAvoidance` 求解，图标路径重排由 `resolveIconReorder` 求解；调用方传入 Widget 障碍和 Dock 保留区。独立 `DextLayoutMotion` 接收最终布局和稳定身份，在 DOM 上执行可中断的 move、enter、exit 与 rollback 动画。两层都不修改 `room.json`，也不引入通用网格或拖拽运行时。

本工作包分为两个强制阶段：先在浏览器实验台直接使用产品动画引擎并由用户验收运动质感；只有明确通过后，才允许修改真实桌面 `main.js` 的图标协调、Widget 预览和图标路径重排逻辑。

## 接口

```js
const motion = new DextLayoutMotion(container, options)
motion.apply(items, { mode, excludeKeys })
motion.cancel({ restore })
motion.dispose()
```

`MotionItem` 至少包含稳定 `key`、最终 `left/top` 和原始图标数据。控制器拥有节点映射、视觉快照、当前 revision 和动画句柄；调用方拥有布局求解、拖动手势和最终持久化。

应用图标的 key 取规范化 launch target/args/workdir；旧图标没有可靠 launch 时，以 action、label、glyph 的规范化签名加同签名序号区分。相同布局中 key 必须稳定且唯一。

## 动画语义

| 场景 | 时长 | 行为 |
|---|---:|---|
| 自动让位/重排 | 280ms | `cubic-bezier(.22,1,.36,1)`；先写最终 left/top，再以反向 transform FLIP 到视觉原位并归零 |
| 新增 | 180ms | opacity 0→1，scale .92→1 |
| 移除 | 140ms | opacity 1→0，scale 1→.92；仅本 revision 完成后移除节点 |
| 无解回弹 | 300ms | 从当前视觉位回到已提交布局 |
| 图标路径重排 | 越过格子中线 | 被拖图标轻微抬高并跟随指针；占位进入目标格，源格至目标格之间的图标按顺序让位 |

只动画 `transform` 和 `opacity`；`left/top` 立即写入最终值。新 revision 先捕获当前视觉位置，再取消旧动画并从该位置继续。所有完成回调都校验 revision 和节点身份，旧回调不得删除、覆盖或清理新节点。

运动节点必须是外层 positioner；原图标视觉、Widget 内容和标签放在各自内层 face。FLIP/Widget 坐标只由外层负责，长按 500ms 后的苹果式 `jiggle` 只写内层 rotate，两者可同时运行且互不覆盖。图标 face 以 ±1.35°/350ms 抖动；面积更大的 Widget face 使用更克制的 ±0.38°/420ms，拖动当前对象时暂停，松手或取消后恢复。拖起图标时内层 face 使用 `translate3d + scale(1.06)` 跟随指针，当前目标由独立 placeholder 留位；被拖节点排除 FLIP，其他路径图标参与 FLIP。真实桌面集成不得删除既有 `body.editing`、500ms 长按或抖动语义。

图标重排只改变图标坐标，不移动 Widget；Widget 当前矩形作为不可放置障碍。Widget 自身仍可拖动并继续优先占位，让冲突图标避让。Dock 是图标和 Widget 的禁放区：图标进入时撤销路径预览并隐藏占位，释放恢复原顺序；Widget 接近时钳制在 Dock 外。松手只提交一次新的图标坐标顺序，pointercancel、lostpointercapture、无解和非法目标都恢复基线。

恢复基线以一次真实 pointer 手势为边界：pointerdown 开始拖动前先结清旧场景或旧动画的 preview 状态，以当前已发布布局建立本手势基线。Reset/场景切换必须作为输入事务 abort，先清 drag/press、长按 timer 与 pointer capture，再发布重置布局，旧 pointer 事件不得继续生效。

reduced-motion 下立即写最终布局并清理动画，只保留冲突状态和新增高亮。初次加载、Desk 切换 staging 和窗口缩放使用即时模式。

## 浏览器实验台的视觉与交互

- 视觉论点：深色、低噪声的桌面运动工作台，让图标运动成为唯一主角；材质克制、反馈精确，不用装饰性卡片堆叠。
- 内容计划：顶部单行场景切换和运动状态；中央全尺寸网格舞台；底部仅保留时间、revision、节点复用和 reduced-motion 等诊断信息。
- 交互论点：图标托起形成清晰层级，占位沿路径移动，沿途图标依次让位；Widget 拖动带来局部避让；连续 revision 从当前视觉态续接而不是重新起跳。

实验台提供 Widget 推开单个/多个图标、连续折返、图标路径重排、Dock 禁放、新增、移除、无解回弹、取消、reduced-motion 和 100 图标压力场景。它不复制动画实现，只准备输入并调用 `DextLayout` 与 `DextLayoutMotion`。

## 失败与降级

控制器的所有 DOM/WAAPI 操作都包在可降级边界内。Web Animations API 不可用、节点尺寸异常或动画抛错时，立即写入最终 left/top/opacity 并继续交互、保存和启动应用。取消与 dispose 必须清理动画句柄和临时样式。

## 测试策略

Node 测试纯身份与 diff；浏览器 Playwright 测真实 DOM、WAAPI 生命周期和视觉终态。Playwright 通过 Vite 在 `127.0.0.1:5174` 启动，失败保留 trace、截图和视频。真实桌面集成阶段再用 init script 模拟 `chrome.webview` 的布局消息边界，验证节点复用和热更新。
