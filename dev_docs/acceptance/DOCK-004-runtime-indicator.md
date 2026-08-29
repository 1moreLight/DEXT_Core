# DOCK-004 运行态指示圆点验收

- 状态：待验收
- 分支：`feat/dock-004-runtime-indicator`
- 提交：实现 `e4a8cd3`；连续拖拽修复 `2af99ce`；文档收口 `9f5d4eb`
- 目标：Dock 图标能够显示对应应用是否正在运行；应用关闭后状态及时消失。
- 范围外：Dock 拖拽、应用库扫描/清理/排序、模板与 Room zip、多显示器及其他路线图项目。

## 自动检查

- [x] `node --check wallpapers/dext-room/main.js`
- [x] `cd tauri-ui/src-tauri && cargo test --lib applies_room_wallpaper`（Core 启动后通过）
- [x] `cd tauri-ui/src-tauri && cargo check`
- [x] `cd tauri-ui && npm run build`
- [x] `git diff --check`
- [x] 如修改 C#/.proto：`scripts/build.ps1`（Player Release）已通过；`scripts/start.ps1` 已启动 Core（配置器首次因 worktree 未安装依赖退出，安装依赖后前端构建通过）
- [x] Room 预览连续手势：长按图标 650ms 后不松手直接拖到 Dock，drop 命中且 Dock 内存列表新增图标；预览不写盘

## 人工验收

1. [ ] 启动一个 Dock 应用，看到对应运行态圆点出现。
2. [ ] 关闭该应用，圆点及时消失。
3. [ ] 同时启动多个 Dock 应用，各图标状态互不串扰。
4. [ ] 切换 Desk 后，Dock 图标和运行态状态正确。
5. [ ] 重启/重新应用 Room 后，Dock 配置仍存在，运行态不被错误持久化。
6. [x] 用户决定豁免真桌面拖入/拖回回归：当前通过配置器 `DockEditor` 管理 Dock 图标；真实 Player 拖拽重做转远期 `DOCK-UX-001`。
7. [ ] 预览模式不会写入真实文件。
8. [ ] 现有 Dock 点击启动行为不回归。

## 通过标准

- 所有必选项通过；没有阻断问题。

## 验收记录

- 2026-08-29 首轮反馈：长按桌面图标后直接拖入 Dock 无法加入；已确认不是分支未合并导致。
- 2026-08-29 同分支修复：长按进入编辑态后沿用当前指针继续拖动，预览连续手势复验通过，等待用户复验真桌面。
- 2026-08-29 真桌面复验失败：连续手势方案造成输入命中不稳定，已撤回并恢复 DOCK-003 原有两段式拖拽交互；等待用户复验。
- 2026-08-29 用户决定跳过真桌面拖入目标：实机存在上方/侧面边界卡住、下方绿色命中后仍无法落入；配置器 `DockEditor` 作为当前正式管理入口，该问题转远期 `DOCK-UX-001`，不再阻塞 DOCK-004。
