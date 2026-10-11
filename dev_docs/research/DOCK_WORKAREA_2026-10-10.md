# Dock 工作区占位调查（2026-10-10）

状态：调查做完；实际窗口避让留统一验收，未开启或修改用户设置。

## 用户现象与本机事实
用户截图显示普通窗口延伸到浮动 Dock 后方，希望像 MyDockFinder 一样为 Dock 留出空间。截图本身不能证明该窗口处于最大化。
本机 application-dock.json 为 Enabled=true、AutoHide=false，缺省 ReserveSpace=false；这是常显浮动模式。只读运行探针确认当前 Core39560 来自 v3-core-exit-20261010。
现有配置器 ApplicationDockSettings.tsx 已有“常驻占位：最大化窗口为 Dock 留出空间”。不要把已有功能误写成尚未开发，也不要把它写成实机验收通过。

## 可采用的方案
做完：核对现有 DockAppBar.cs 使用 ABM_NEW / ABM_QUERYPOS / ABM_SETPOS / ABM_REMOVE，DockReservation 检查系统工作区是否实际留出底部。
待做：统一验收启用常驻占位后，最大化与贴边窗口下缘留在 Dock 上方；关闭、退出、恢复任务栏后工作区恢复；HTML 融合 P8-014 复用同一占位机制和单一 owner。
待做：如用户进一步要求普通自由拖动窗口也绝不穿过 Dock，先单独观察该行为。AppBar 工作区不能当成所有第三方窗口不可越界的通用硬约束，不在当前点击接线中加入全局强制搬窗逻辑。

## BewlyCat 能借鉴什么
调查做完：keleus/BewlyCat 是 Bilibili 浏览器扩展。src/components/Dock/Dock.vue 的 useWindowSize/useElementSize、dockScale/transformOrigin 根据网页视口缩放、摆放 Dock。适合参考外观和适配，不提供 Windows AppBar 或系统窗口占位实现。本轮未复制其代码。

来源：
- https://github.com/keleus/BewlyCat
- https://github.com/keleus/BewlyCat/blob/main/src/components/Dock/Dock.vue
- https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars
- https://learn.microsoft.com/en-us/windows/win32/shell/abm-setpos

## 人工步骤（统一验收）
1. 配置器的应用 Dock 设置开启“常驻占位”，等待“Windows 已确认 Dock 工作区占位”。
2. 最大化一个普通应用，并测试 Windows 贴边排列，确认底部避让。
3. 将普通还原窗口手动拖至底部，另记它能否越过边界，不与最大化混算。
4. 关闭常驻占位，检查工作区恢复；之后测试 Core 退出/任务栏恢复。
