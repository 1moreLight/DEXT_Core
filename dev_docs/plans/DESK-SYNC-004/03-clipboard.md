# DESK-SYNC-004 系统剪贴板互通

状态：开做

新增DesktopShellClipboard.cs：STA读取/发布CF_HDROP与Preferred DropEffect，支持Explorer→Dext、Dext→Explorer、Dext→Dext。复制与剪切只在明确焦点和原生键盘证明下写剪贴板；粘贴由Core读取真实路径，调用DesktopShellTransfer，目标KnownFolder用户桌面。剪切变淡表示待移动，成功项才清除/更新对应剪贴板状态，用户已更换剪贴板时不覆盖。同目录粘贴复制交给Shell生成副本名称，与003同目录拖放不复制自身分开。数据格式测试通过独立HGLOBAL和Windows DragQueryFile，文件操作通过临时文件，实际全局剪贴板仅在可恢复验收中操作。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交

2026-10-11 开工：先实现CF_HDROP/Preferred DropEffect原生数据与快照，使用独立HGLOBAL和DragQueryFile验证Explorer兼容文件列表，不触碰全局剪贴板；再接有序STA读写与序列号匹配下的剪切完成更新，最后接原生快捷键。更新策略在OpenClipboard持有期间核对序列号，避免覆盖用户后来复制的新内容。

2026-10-11 第03步后端增量：新增DesktopShellClipboardData和DesktopShellClipboard。CF_HDROP使用20字节DROPFILES+Unicode双NUL路径列表，Preferred DropEffect发布COPY/MOVE；独立STA读取/发布，后台message-only所有者窗口不显示。部分移动仅移除实际completed源项，失败/未处理项保留；完成更新在OpenClipboard锁内核对原序列号，后来复制的内容不覆盖。没有自动化调用系统剪贴板读写。
证据：独立HGLOBAL交由真实DragQueryFile读取中文/空格/UNC路径，先因数量不匹配失败再10/10通过，含复制/剪切标记、部分失败与相对路径检查；日志.build/clipboard-data-red.log及clipboard-data-green.log。完整Core/Player/Watchdog Release成功（desktop-shell-actions-build-env/clipboard-backend-build.log）；start.ps1继续因主目录Debug Core26668持有产品身份退出1，未替换运行桌面。
剩余：Ctrl+C/X/V原生按键证明、私有命令/Core目标解析/粘贴执行、同目录副本、剪切变淡及实际系统剪贴板验收。03仍开做，实施2/6≈33%，路线2/4=50%。

实现说明：采用Win32剪贴板事务以便持锁核对序列号后更新，代替先读序列号再调用WPF Clipboard.SetDataObject的分离操作。原生窗口仅在后台STA上用作剪贴板所有者；写入使用立即呈现的全局内存，成功后由系统接管。
参考：[Shell Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/shell/clipboard)、[SetClipboardData所有者与内存规则](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata)。
