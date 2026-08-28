# DOCK-001 皮肤自动写入 room.css 验收

- 状态：待验收
- 分支：`feat/dock-001-save-room-css`
- 提交：本分支 HEAD（提交哈希见交付消息）
- 目标：在配置器里选择 Dock 皮肤后，真实保存到当前 Room，并立即反映到预览。
- 范围外：DOCK-002 应用选择器、DOCK-003 桌面拖拽、DOCK-004 运行态圆点、ROOM-001 zip 导出。

## 自动检查

- [x] Rust 测试覆盖：合法 Room 写入、非 Room 目录拒绝、重复选择覆盖。
- [x] `cargo check` 通过。
- [x] `npm run build` 通过。
- [x] `node --check wallpapers/dext-room/main.js` 通过。
- [x] Git 只包含 DOCK-001 具名文件，提交位于独立分支。

## 人工验收

1. [ ] 在配置器打开任意测试 Room，进入编辑 → Dock。
2. [ ] 依次选择 HUD、Minimal、Glass；每次状态栏明确提示已保存到当前 Room，没有“请手工粘贴 CSS”。
3. [ ] 查看当前 Room 的 `room.css`，内容随所选预设覆盖更新。
4. [ ] 打开配置器预览，切换皮肤后 Dock 外观立即变化，不需要应用到真桌面。
5. [ ] 切换到其他 Room 再切回来，原 Room 的 room.css 外观仍然存在。
6. [ ] 在浏览器设计模式运行，皮肤按钮可演示且不出现 Tauri invoke TypeError。

## 回归

1. [ ] 保存 room.json、应用 Room、切 Desk、Dock per-desk 配置均不受影响。
2. [ ] 没有 room.css 的旧 Room 仍使用默认 Dock 样式。

## 通过标准

- 自动检查全部通过。
- 人工验收和回归无阻断问题。

## 验收记录

- 待用户确认。
