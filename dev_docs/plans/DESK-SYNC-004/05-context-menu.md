# DESK-SYNC-004 原生右键与属性

状态：待做

新增DesktopShellContextMenu.cs：IShellFolder/GetUIObjectOf/IContextMenu菜单在STA且具备消息转发窗口；IContextMenu2/3消息正确转发，支持Unicode InvokeCommand、取消关闭、属性和混合公共/用户目录选择。位置来自Player当前真实窗口/DPI，不使用作者坐标作为任意系统点击。右键未选中项先单选，已选中项保留多选；键盘菜单键/Shift+F10同路径。右键输入扩展独立于既有左键/触控，作用域退休关闭菜单；Shell扩展异常返回可重试错误。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交
