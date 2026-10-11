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

2026-10-11 第03步复制/剪切接线增量：Ctrl+C/X/V由Core按下时Ctrl+当前official.desktop文件焦点产生配对证明，普通字母拒绝；Player官方物理采样识别这些按键。复制/剪切通过desktopCopy/desktopCut只提交当前所选ID，Core校验整组并消费证明后调用DesktopShellClipboard，路径留Core。剪切变淡采用filter:opacity(.45)与切页内联opacity相乘；presentationRead附带剪贴板序列元数据，用户后来复制新内容则恢复图标，避免迟到旧读取清除刚完成的剪切。Ctrl+V仅原生证明已接，页面暂不派发粘贴，不能称粘贴已可用。
证据：快捷键用例先失败后6/6 sampled/direct通过（clipboard-keys-red/green.log）；Player pointer18项、原生消息79项、宿主114项通过，含保持多选/剪切状态/外部新剪贴板恢复。Core当前所选目标解析检查通过，个人编辑组先一次21/21，补切目标后一次20/21（旧drop placement返回storageUnavailable），保存失败为clipboard-copy-core-storage-failure.log；相同构建仅复查一次21/21（clipboard-copy-core-recheck.log）。第一次RED另有旧fixture原子发布Win32拒绝访问，未改存储实现、未宣称该间歇问题修复。F2原6组合通过。完整Core/Player/Watchdog Release成功（desktop-shell-actions-build-env/clipboard-copy-build.log）；start.ps1因现有Debug Core26668产品身份占用退出1，未替换运行版、未启动额外配置器。
剩余：Ctrl+V粘贴/同目录副本/成功项完成回执、空同步Desk的粘贴焦点入口、实机Explorer双向互通及触控。接粘贴时需核对原生桌面也收到Ctrl+V是否引起双执行，不能仅凭RawInput观察与消息用例认定实机无重复。系统剪贴板未在本轮自动测试中读写；实际复制/剪切与视觉效果仍待统一验收。03保持开做，实施2/6≈33%，路线2/4=50%。
