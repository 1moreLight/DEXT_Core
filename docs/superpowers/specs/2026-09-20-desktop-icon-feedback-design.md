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

type DesktopIconPreferences = {
  feedbackStyle: IconFeedbackStyle;
  showLabels: boolean;
  hitTargetSize: IconHitTargetSize;
};
```

- 默认值：`{ feedbackStyle: "halo", showLabels: true, hitTargetSize: "standard" }`。
- 非法风格回退 `halo`；非法命中框档位回退 `standard`；`showLabels` 仅接受布尔值，否则回退 `true`。
- 页面根节点以 `data-icon-feedback`、`data-icon-labels` 和 `data-icon-hit-size` 表达偏好，不替换图标节点。
- `.icon` 只负责网格坐标和 FLIP；`.icon-face` 是收缩后的真实命中区并承载托起/抖动；`.icon-visual` 只承载光晕、紧凑框或无边框反馈。
- 同档所有 `.icon-face` 使用统一固定尺寸并与图标水平中心对齐：small 72×80、standard 80×84、large 84×88；名称长度与显示状态不得改变命中框几何。
- 名称为单行省略；隐藏名称时稳定悬停 500ms 显示不接收指针的轻量浮层，编辑、按下和拖动时抑制。

## Initial profiles

- `halo`：仅 `.icon-visual` 出现约 6px 外扩的柔和表面，名称不带背景。
- `compact`：图标与单行名称形成最大约 88px 的紧凑表面。
- `bare`：不绘制表面，只增加亮度、阴影和轻微缩放。
- 网格单元可在 88×100、100×112、120×124 三档之间比较，但不接收指针；命中框档位与网格间距解耦，仅 `.icon-face` 命中。
- reduced-motion 下关闭缩放、过渡和抖动，保留 hover 状态、名称省略和命中区。

## Browser lab

实验台覆盖 PNG、Glyph、短名称、长名称、明亮/深色/复杂背景，以及普通、hover、pressed、editing、dragging 状态。提供：

- 三种反馈模式即时切换；
- 显示/隐藏名称；
- 显示实际命中区；
- 三档网格间距与三档命中框大小独立切换；
- 编辑模式和拖动托起模拟；
- reduced-motion 模拟；
- 状态说明与当前偏好输出。

阶段 A 的自动测试锁定偏好规范化、节点不替换、空白格不命中、名称省略、500ms 浮层与抑制条件。阶段 B 的全局设置、Player 消息和真实桌面接入只有在浏览器人工验收后才能开始。
