# DOCK-001 皮肤自动写入 room.css 验收

- 状态：待验收（已按 2026-08-28 反馈修订）
- 分支：`feat/dock-001-save-room-css`
- 提交：初版 `12606f0`；修订为本分支 HEAD（哈希见交付消息）
- 目标：Dock 页作为独立模板卡片库；只有进入具体 Room 编辑器选择 Dock 后，才真实保存并立即反映到预览。
- 范围外：DOCK-002 应用选择器、DOCK-003 桌面拖拽、DOCK-004 运行态圆点、ROOM-001 zip 导出、DOCK-LIB-001 模板文件/编辑器/创意工坊真实下载。

## 自动检查

- [x] Rust 测试覆盖：合法 Room 写入、非 Room 目录拒绝、重复选择覆盖。
- [x] `cargo check` 通过。
- [x] `npm run build` 通过。
- [x] `node --check wallpapers/dext-room/main.js` 通过。
- [x] 浏览器设计模式浅色/深色视觉检查与 Room 内选择交互通过。
- [x] Git 只包含 DOCK-001 具名文件，提交位于独立分支。

## 人工验收

1. [ ] 进入编辑 → Dock，看到独立 Dock 模板卡片和详情，不出现“当前桌/当前 Room”配置表单。
2. [ ] 在 Dock 模板库切换 HUD、Minimal、Glass 卡片，只改变库内选中和详情，不修改任何 Room 的 `room.css`。
3. [ ] 进入编辑 → Room，选择一个 Room 并点“编辑”，此时才看到“当前 Room Dock”选择入口。
4. [ ] 依次为该 Room 选择 HUD、Minimal、Glass；每次状态栏明确提示已保存到当前 Room。
5. [ ] 查看当前 Room 的 `room.css`，内容随所选模板覆盖更新；模板区块外的作者 CSS 保留。
6. [ ] 打开配置器预览，切换 Dock 后外观立即变化，不需要应用到真桌面。
7. [ ] 切换到其他 Room 再切回来，各 Room 的 Dock 选择互不串用。
8. [ ] 在浏览器设计模式运行，Room 内选择可演示且不出现 Tauri invoke TypeError。

## 回归

1. [ ] 保存 room.json、应用 Room、切 Desk、Dock per-desk 配置均不受影响。
2. [ ] 没有 room.css 的旧 Room 仍使用默认 Dock 样式。

## 通过标准

- 自动检查全部通过。
- 人工验收和回归无阻断问题。

## 验收记录

- 待用户确认。
