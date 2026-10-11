# DESK-SYNC-004 系统剪贴板互通

状态：待做

新增DesktopShellClipboard.cs：STA读取/发布CF_HDROP与Preferred DropEffect，支持Explorer→Dext、Dext→Explorer、Dext→Dext。复制与剪切只在明确焦点和原生键盘证明下写剪贴板；粘贴由Core读取真实路径，调用DesktopShellTransfer，目标KnownFolder用户桌面。剪切变淡表示待移动，成功项才清除/更新对应剪贴板状态，用户已更换剪贴板时不覆盖。同目录粘贴复制交给Shell生成副本名称，与003同目录拖放不复制自身分开。测试通过私有IDataObject/临时文件，实际全局剪贴板仅在可恢复验收中操作。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交
