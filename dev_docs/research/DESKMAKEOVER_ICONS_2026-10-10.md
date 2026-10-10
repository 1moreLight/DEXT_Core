# DeskMakeover 桌面图标借鉴调查（2026-10-10）

状态：调查做完；迁移实施待做。当前 P8-013 主任务继续，唯一下一项不变。
来源仓库 nicepkg/deskmakeover，已读取源码版本 0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8。仅源码调查，未安装、运行或复制第三方代码。

## 值得用于 Dext 的内容

| 内容 | 源码证据 | Dext 落点 | 状态 |
|---|---|---|---|
| 图标主体视觉大小归一 | dm-icon-core/src/analysis/mod.rs 的 find_content_bounds、foreground_auto、max_scale_auto 及 alpha 分析 | 复用 ROADMAP 已有 CORE-004，按主体包围盒调整显示，保留完整命中框；透明、带底板和已圆角图标分别处理 | 待做 |
| 预览/实际显示共用渲染规则 | dm-icon-core 纯 Rust 像素管线，规格06规定 WASM 前台与 native 后台共享核心 | 同一份派生 PNG 给配置器、桌面、应用 Dock；避免三个界面各套 CSS 导致外观不一致 | 待做 |
| 图标缓存按内容失效 | icon_host/source_cache.rs 的内容寻址 URL、32 MiB LRU 与跨扫描旧资源保留；render_session.rs 的源分析缓存 | 目前 DockTaskDisplay 已缓存提取结果但按目标路径；后续加文件/图标版本失效、有界缓存，状态轮询不重复提取 | 待做 |
| 读取 Explorer 图标布局 | dm-windows/src/shell/layout.rs 使用 STA COM 的 IFolderView2/GetItemPosition，考虑虚拟桌面原点 | 以后“从 Windows 桌面导入布局”可参考；不替换 Room 自有布局权威 | 待做，非本轮 v3 必做 |
| 桌面扫描区分失败与空目录 | shell/scan.rs 用户桌面读取失败返回错误，公共桌面按可用性处理 | 导入桌面时显示真实失败，避免把读取失败当空桌面而覆盖现有数据 | 待做，随导入功能 |

## 与 Dext 的不同
该项目主要重绘图标、产出图像，并通过 IShellLinkW/SetIconLocation 等修改 Explorer 展示来源；Explorer 继续负责实际桌面图标的点击与拖动。shell/layout.rs 读取原有位置，规格明确不接管排序。它不是 Dext WorkerW/WebView2 输入链的替代方案。
Dext 应优先借鉴图像处理和缓存；保留已经可用的点击路径，以及用户选择保留的矩形交互高亮。九种样式、圆角外观并不意味着引入圆角命中框或额外悬浮输入层。

## 实施次序与验收建议
1. 当前 P8-013/014 先完成主题与应用 Dock 融合及稳定输入。
2. CORE-004 再做主体占比：透明标志、带底板应用、细长图标、带角标图标各取真实样本；对比清晰度、视觉大小、完整边缘，不要求本轮新开任务。
3. 共用显示输出和缓存失效纳入同一视觉处理链；应用更新后图标刷新，连续状态轮询不重复提取；点击和键盘命中区域不随像素裁剪缩小。
4. Windows 桌面布局读取与导入保持远期。拖动仍按用户要求暂缓。

许可证已核对为 MIT。将来直接复用代码时保留原版权与许可证；本次只有调查笔记。

## 源码链接
- https://github.com/nicepkg/deskmakeover/tree/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/crates/dm-icon-core/src/analysis/mod.rs
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/crates/dm-icon-core/src/render_session.rs
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/src-tauri/src/icon_host/source_cache.rs
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/crates/dm-windows/src/shell/layout.rs
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/crates/dm-windows/src/shell/scan.rs
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/crates/dm-windows/src/shell/shell_link.rs
- https://github.com/nicepkg/deskmakeover/blob/0bdd2ccfbcc24dfd71754f320ccf380e9b34c8c8/docs/specs/06-icons-module.md
