# DESK-SYNC-004 选择状态与焦点

状态：开做

新增wallpapers/dext-room-v3/desktop-selection.js及desktop-selection.test.js：createDesktopSelection()提供update(scope, ids)、select(id, {ctrl,shift})、clear()和read()，返回selectedIds/focusedId/anchorId。保持输入顺序，Ctrl切换，Shift按可见槽位范围，Ctrl+Shift追加，后台刷新裁剪消失项，换scope清空。将模块接dom-host官方图标选中样式/aria-selected；经原生激活消息单击选择，作者入口不改。先写状态用例得到明确失败，再实现、接线并跑定向Node检查。焦点不在同步图标层时不处理文件快捷键；页切换必须重算可见范围。完成标准包含DOM接线与原生输入路径，不以纯模型检查代替。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交
