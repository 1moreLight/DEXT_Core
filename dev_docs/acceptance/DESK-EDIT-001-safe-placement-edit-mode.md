# DESK-EDIT-001 Desk 安全放置与精简编辑验收

- 状态：开发中
- 分支：`feat/DESK-EDIT-001-safe-placement-edit-mode`
- 目标：配置器向 Desk 添加应用时立即选择未占用位置；真桌面长按编辑模式只保留桌面图标移动。
- 范围外：不删除 Room v2 的 `iconSize` 字段；不改变 Widget 移动/缩放；不删除 C# `addDockIcon` 兼容协议；不改 DockEditor 的管理能力。

## 自动检查

- [ ] 空位分配单元测试覆盖稀疏图标、Widget/Dock 障碍、满网格和输入不可变。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] `node --check wallpapers/dext-room/main.js` 通过。
- [ ] `python scripts/validate-room-schema.py` 通过。
- [ ] `git diff --check` 通过。

## 人工验收

1. [ ] 在配置器打开一个已有图标被手动摆成稀疏布局的 Room，从 Desk 的“放入应用”连续加入多个应用；新图标逐个进入空格，不覆盖旧图标，旧图标位置不变化。
2. [ ] 在带 Widget 且启用 Dock 的 Desk 加入应用，确认新图标不会进入 Widget 安全区域或 Dock 保留区。
3. [ ] 应用 Room，在真桌面长按图标进入编辑：只能在桌面网格内拖动/交换图标；松手后位置持久化。
4. [ ] 确认编辑态没有桌面/Dock 删除按钮、没有大中小尺寸按钮、没有“拖入 Dock”提示，桌面图标不能拖进 Dock，Dock 图标不能拖回桌面。
5. [ ] 确认 Widget 仍能移动和缩放，完成按钮与 Esc 仍能退出编辑。
6. [ ] 退出编辑后双击 Dock 应用仍能启动，运行状态圆点仍显示；配置器 DockEditor 仍能添加、删除和排序 Dock 图标。

## 通过标准

- 自动检查全部通过。
- 新增应用不产生坐标重叠且不重排旧图标。
- 真桌面编辑态只留下用户确认保留的移动能力；Dock 管理入口统一在配置器。

## 验收记录

- 待实现与自测完成后由用户确认。

