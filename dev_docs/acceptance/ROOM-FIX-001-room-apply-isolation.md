# ROOM-FIX-001 Room 应用隔离清理验收

- 状态：待验收
- 分支：`fix/room-fix-001-apply-isolation`
- 提交：待提交
- 目标：应用新 Room 时完整替换运行包内属于 Room 的可选脚本、样式和素材，上一 Room 的 cockpit HUD 不再残留。
- 范围外：DOCK-004 运行态、Dock 拖拽、`__source` 契约重构、C# / proto、多显示器及其他路线图功能。

## 自动检查

- [x] `cd tauri-ui/src-tauri && cargo test room_apply_removes_previous_room_owned_files`
- [x] `cd tauri-ui/src-tauri && cargo test invalid_room_json_keeps_active_package_unchanged`
- [x] `cd tauri-ui/src-tauri && cargo test --lib applies_room_wallpaper`
- [x] `cd tauri-ui/src-tauri && cargo check`
- [x] `cd tauri-ui && npm run build`
- [x] `node --check wallpapers/dext-room/main.js`
- [x] `scripts/build.ps1`（Player Release）后 `scripts/start.ps1`
- [x] `git diff --check`

## 人工验收

1. [ ] 启动 Dext，先应用 `cockpit-room`，确认 cockpit HUD、全屏 Canvas 或底部淡字会出现。
2. [ ] 再应用 `my-room`，确认 cockpit HUD、`MID-DOW DOCK MANUFACTURER` 淡字和 cockpit 样式全部消失。
3. [ ] 在 `my-room` 和另一个不带 `room.js` / `room.css` 的 Room 之间切换，确认不会继承上一个 Room 的脚本、样式、启动/结束素材或旧背景文件。
4. [ ] 重启 Core / Player 或重新应用 `my-room`，确认污染不会再次出现。
5. [ ] 确认 `my-room` 的背景、桌面图标、Dock 配置和点击启动行为仍正常。
6. [ ] 确认源 Room 目录未被运行包文件反向覆盖，主工作区原有 `rooms/my-room/room.json` 改动仍保留。

## 通过标准

- 所有自动检查通过。
- cockpit → 普通 Room 的切换不残留任何 Room-owned 文件或可见 HUD。
- 普通 Room 现有配置和运行行为没有回归。

## 验收记录

- 2026-08-29 开发侧预验收：实际依次应用 `cockpit-room` 和 `my-room`；运行包中的 `room.js`、`room.css`、`transition`、`switch`、`start`、`end` 均按源 Room 清理，桌面截图无 cockpit HUD 和底部淡字。
- 待用户确认。
