# DESK-ICON-001 Desktop Icon Feedback Design

## Goal

把桌面图标的反馈从整格透明卡片收缩到可见内容，让 hover、按下和拖动命中更接近苹果式桌面，同时保留 Dext 的网格布局、排序动画和编辑抖动。

阶段 A 只交付浏览器实验台。用户确认三种视觉方案和实际命中区前，不得修改 `wallpapers/dext-room/main.js`、生产样式、设置页或 Core。

## Visual direction

- **视觉论点：** 深色桌面上的克制玻璃反馈应贴合图标本体，而不是暴露 96×120 的布局格。
- **内容结构：** 顶部为三种模式和背景控制；中央是一块真实桌面尺度的比较画布；底部只展示当前模式、名称策略和命中区说明。
- **交互论点：** 用紧贴图标的 hover/press、长按后的轻微托起与抖动、可开关的命中区轮廓，让用户直接判断“看起来多大”和“实际上哪里可点”。
- 不复制真实 Room 外观，也不把实验台卡片、颜色或背景带入生产桌面。

## Shared contract

共享模块采用浏览器全局与 CommonJS 双入口，阶段 A 由实验台直接使用，阶段 B 再由真实桌面接入：

```ts
type IconFeedbackStyle = "halo" | "compact" | "bare";
type IconHitTargetSize = "small" | "standard" | "large";
type IconVisualSize = "small" | "standard" | "large";

type DesktopIconPreferences = {
  feedbackStyle: IconFeedbackStyle;
  showLabels: boolean;
  hitTargetSize: IconHitTargetSize;
  visualSize: IconVisualSize;
};
```

- 默认值：`{ feedbackStyle: "halo", showLabels: true, hitTargetSize: "standard", visualSize: "standard" }`。
- 非法风格回退 `halo`；非法命中框或视觉大小档位回退 `standard`；`showLabels` 仅接受布尔值，否则回退 `true`。
- 页面根节点以 `data-icon-feedback`、`data-icon-labels`、`data-icon-hit-size` 和 `data-icon-visual-size` 表达偏好，不替换图标节点。
- `.icon` 只负责网格坐标和 FLIP；`.icon-face` 是收缩后的真实命中区并承载托起/抖动；`.icon-visual` 只承载光晕、紧凑框或无边框反馈。
- 同档所有 `.lab-icon` 与 `.icon-face` 使用同一 footprint：显示名称时 small 72×80、standard 80×84、large 84×88；隐藏名称时 small 64×64、standard 72×72、large 80×80。布局、点击和拖动四边重合，图标保持居中，名称长度不得改变同一显示模式下的几何。
- `.icon-visual` 独立提供 small 48px、standard 56px、large 64px 三档；它只改变图形/光晕，不改变 footprint 或 gap，最小 footprint 与大图标组合仍完整容纳单行名称。
- 名称为单行省略；隐藏名称时稳定悬停 500ms 显示不接收指针的轻量浮层，编辑、按下和拖动时抑制。

## Initial profiles

- `halo`：仅 `.icon-visual` 出现约 6px 外扩的柔和表面，名称不带背景。
- `compact`：图标与单行名称形成最大约 88px 的紧凑表面。
- `bare`：不绘制表面，只增加亮度、阴影和轻微缩放。
- footprint 之间的 gap 可在 4×12、20×28、40×40 三档之间比较；gap 不接收指针，间距切换不改变 footprint，只有 `.icon-face` 命中。
- 图标编辑抖动只作用于 `.icon-visual`，使用 ±3° / 150ms 纯旋转；`.icon-label` 与 footprint/命中边框保持静止。长按为 300ms，Widget 抖动参数不在本阶段修改。
- reduced-motion 下关闭缩放、过渡和抖动，保留 hover 状态、名称省略和命中区。

## Browser lab

实验台覆盖 PNG、Glyph、短名称、长名称、明亮/深色/复杂背景，以及普通、hover、pressed、editing、dragging 状态。默认采用真实交互：hover/pointerdown 直接反馈，短按切换当前目标，长按 300ms 进入编辑抖动；编辑中拖动托起并跟手，松手恢复原单元，双击真正画布空白退出。阶段 A 不执行排序或保存。固定五状态仍作为诊断入口。提供：

- 三种反馈模式即时切换；
- 显示/隐藏名称；
- 显示实际命中区；
- 三档图标视觉大小、三档 footprint 大小与三档框间 gap 独立切换；
- 编辑模式和拖动托起模拟；
- reduced-motion 模拟；
- 状态说明与当前偏好输出。

阶段 A 的自动测试锁定偏好规范化、节点不替换、48/56/64px 真实视觉尺寸与居中、空白格不命中、名称省略、500ms 浮层与抑制条件。阶段 B 的全局设置、Player 消息和真实桌面接入只有在浏览器人工验收后才能开始。
