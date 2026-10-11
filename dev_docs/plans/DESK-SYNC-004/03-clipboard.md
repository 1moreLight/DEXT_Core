# DESK-SYNC-004 系统剪贴板互通

状态：做完（代码实施，Windows实机验收待做）

新增DesktopShellClipboard.cs：STA读取/发布CF_HDROP与Preferred DropEffect，支持Explorer→Dext、Dext→Explorer、Dext→Dext。复制与剪切只在明确焦点和原生键盘证明下写剪贴板；粘贴由Core读取真实路径，调用DesktopShellTransfer，目标KnownFolder用户桌面。剪切变淡表示待移动，成功项才清除/更新对应剪贴板状态，用户已更换剪贴板时不覆盖。同目录粘贴复制交给Shell生成副本名称，与003同目录拖放不复制自身分开。数据格式测试通过独立HGLOBAL和Windows DragQueryFile，文件操作通过临时文件，实际全局剪贴板仅在可恢复验收中操作。

- [x] 失败用例与实现
- [x] 代码接线及定向检查；实际Explorer/触控验收仍待做
- [x] 记录证据并提交工作分支

2026-10-11 开工：先实现CF_HDROP/Preferred DropEffect原生数据与快照，使用独立HGLOBAL和DragQueryFile验证Explorer兼容文件列表，不触碰全局剪贴板；再接有序STA读写与序列号匹配下的剪切完成更新，最后接原生快捷键。更新策略在OpenClipboard持有期间核对序列号，避免覆盖用户后来复制的新内容。

2026-10-11 第03步后端增量：新增DesktopShellClipboardData和DesktopShellClipboard。CF_HDROP使用20字节DROPFILES+Unicode双NUL路径列表，Preferred DropEffect发布COPY/MOVE；独立STA读取/发布，后台message-only所有者窗口不显示。部分移动仅移除实际completed源项，失败/未处理项保留；完成更新在OpenClipboard锁内核对原序列号，后来复制的内容不覆盖。没有自动化调用系统剪贴板读写。
证据：独立HGLOBAL交由真实DragQueryFile读取中文/空格/UNC路径，先因数量不匹配失败再10/10通过，含复制/剪切标记、部分失败与相对路径检查；日志.build/clipboard-data-red.log及clipboard-data-green.log。完整Core/Player/Watchdog Release成功（desktop-shell-actions-build-env/clipboard-backend-build.log）；start.ps1继续因主目录Debug Core26668持有产品身份退出1，未替换运行桌面。
剩余：Ctrl+C/X/V原生按键证明、私有命令/Core目标解析/粘贴执行、同目录副本、剪切变淡及实际系统剪贴板验收。03仍开做，实施2/6≈33%，路线2/4=50%。

实现说明：采用Win32剪贴板事务以便持锁核对序列号后更新，代替先读序列号再调用WPF Clipboard.SetDataObject的分离操作。原生窗口仅在后台STA上用作剪贴板所有者；写入使用立即呈现的全局内存，成功后由系统接管。
参考：[Shell Clipboard Formats](https://learn.microsoft.com/en-us/windows/win32/shell/clipboard)、[SetClipboardData所有者与内存规则](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setclipboarddata)。

2026-10-11 第03步复制/剪切接线增量：Ctrl+C/X/V由Core按下时Ctrl+当前official.desktop文件焦点产生配对证明，普通字母拒绝；Player官方物理采样识别这些按键。复制/剪切通过desktopCopy/desktopCut只提交当前所选ID，Core校验整组并消费证明后调用DesktopShellClipboard，路径留Core。剪切变淡采用filter:opacity(.45)与切页内联opacity相乘；presentationRead附带剪贴板序列元数据，用户后来复制新内容则恢复图标，避免迟到旧读取清除刚完成的剪切。Ctrl+V仅原生证明已接，页面暂不派发粘贴，不能称粘贴已可用。
证据：快捷键用例先失败后6/6 sampled/direct通过（clipboard-keys-red/green.log）；Player pointer18项、原生消息79项、宿主114项通过，含保持多选/剪切状态/外部新剪贴板恢复。Core当前所选目标解析检查通过，个人编辑组先一次21/21，补切目标后一次20/21（旧drop placement返回storageUnavailable），保存失败为clipboard-copy-core-storage-failure.log；相同构建仅复查一次21/21（clipboard-copy-core-recheck.log）。第一次RED另有旧fixture原子发布Win32拒绝访问，未改存储实现、未宣称该间歇问题修复。F2原6组合通过。完整Core/Player/Watchdog Release成功（desktop-shell-actions-build-env/clipboard-copy-build.log）；start.ps1因现有Debug Core26668产品身份占用退出1，未替换运行版、未启动额外配置器。
剩余：Ctrl+V粘贴/同目录副本/成功项完成回执、空同步Desk的粘贴焦点入口、实机Explorer双向互通及触控。接粘贴时需核对原生桌面也收到Ctrl+V是否引起双执行，不能仅凭RawInput观察与消息用例认定实机无重复。系统剪贴板未在本轮自动测试中读写；实际复制/剪切与视觉效果仍待统一验收。03保持开做，实施2/6≈33%，路线2/4=50%。

2026-10-11 第03步粘贴执行增量：Ctrl+V私有命令贯通Core原生证明、真实剪贴板读取、Shell粘贴与逐项反馈。同目录复制单独使用FOF_RENAMEONCOLLISION生成副本，普通目标冲突继续Shell确认；同目录剪切保留源，并清除已无须移动的对应剪切引用。部分失败保留真实成功项，完成剪切更新仍核对原剪贴板序列；暂停和同会话修订保留在途回执。
证据：实际临时文件/文件夹粘贴先红后绿6/6，剪贴板独立内存与完成状态11/11，原拖放回归通过，宿主114/114、私有消息79/79；完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/clipboard-paste-build.log）。Core新增Ctrl+V目标检查通过，但个人编辑整组20/21，旧explicit action检查再次出现storageUnavailable，保留paste-core-green.log并继续记为#330未解决；不将该组报告全绿。
运行核对：start.ps1仍因Debug Core26668占用mutex/pipe退出1；未替换运行桌面、未新增配置器。真实全局剪贴板、Explorer双向互通、原生快捷键是否双执行及触控未验收。空同步Desk粘贴入口仍待补，03继续开做，当前工作包2/6≈33%，路线2/4=50%。

2026-10-11 第03步空桌面入口开做：同步Desk增加小型“粘贴到桌面”官方按钮，位于图标网格上方；不占文件槽位，不增加透明全屏输入层。沿用原生几何和点击/Enter/Space证明，空扫描列表也可发粘贴；Ctrl+V仅在该按钮或真实文件已有受控焦点时准入。普通C/X/F2不作用于粘贴按钮。先验证空列表按钮、一次请求、选择不被修改及禁用后消失，再接Core当前上下文核对。RawInput与Explorer重复处理仍留实际OS门槛，不宣称已解决。

2026-10-11 第03步空桌面入口增量做完：同步Desk顶部加入“粘贴到桌面”原生官方按钮，空文件列表也可点击/Enter/Space粘贴；该按钮有受控焦点时允许Ctrl+V，C/X/F2仍只允许真实文件焦点。按钮独立逻辑尺寸避免按96×104图标比例压扁文字，不改文件槽位、分页容量或选择。Core仍核对当前启用Desk/扫描上下文和一次原生证明，停用或切页拒绝旧命令。
证据：空列表DOM缺按钮断言先失败后通过；Core原NotOperable失败后22/22通过，新增鼠标/Enter/Space/Ctrl+V与停用检查；sampled/direct剪贴板8/8、Player指针18/18、私有消息79/79、宿主115/115；完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/clipboard-empty-paste-build.log）。本次22/22不消除此前#330间歇存储失败记录。start.ps1仍拒绝与Debug Core26668争用身份，原实例保留。
当前2/6≈33%，03保持开做：生产快捷键来自WinDesktopCore.RawInput_KeyboardClickRaw，RawInputMsgWindow注册Keyboard ExInputSink；现有代码只旁听转发，没有阻止Explorer原生快捷键，所以真实双执行风险尚未解决，不启用新候选。下一步先收敛键盘所有权/重复执行，再做实际Explorer互通；全局剪贴板和触控仍留统一验收。
人工验收（部署后统一进行）：空同步Desk用唯一临时文件测试“粘贴到桌面”；Explorer与Dext双向复制/剪切/粘贴，每次只产生一份结果、保留失败源项、更换剪贴板不被覆盖；随后核对原Dock、作者按钮、触控、切页和停用后旧命令失效。

2026-10-11 第03步键盘单一执行方开做：针对当前同步桌面文件焦点的Ctrl+C/X/V、F2和Enter/Space建立窄范围WH_KEYBOARD_LL接收，捕获成功后抑制Explorer同一按键；其他焦点/应用继续放行。专用消息线程只核对短期有效的目标快照、前台HWND、光标所属视口并排队，不在钩子内执行文件/IPC。按下确定归属，重复按下不重复执行，抬起归还原接收者；退出卸钩。Core执行前重新核对同一会话/几何/焦点；RawInput不再作为这些文件命令的第二入口。鼠标、触控、作者和Dock输入保留。先配对策略测试，再接生命周期和构建；实机Explorer双执行仍待验收。
依据：[Microsoft LowLevelKeyboardProc](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc)：非零回值阻止目标窗口继续收到消息；回调需消息循环，应尽快转交后台工作，超时可能被系统移除。若钩子不可用，文件快捷键不得回退为RawInput执行以避免双操作；可见粘贴按钮继续可用。

2026-10-11 第03步代码实施做完，待统一实机验收：文件Ctrl+C/X/V、F2及Enter/Space在同步文件/粘贴按钮焦点下通过独立WH_KEYBOARD_LL线程确定单一执行方，成功入队后抑制原按键，RawInput不再二次执行。按下持有原接收者至抬起，重复按下去重，启动已按住的键不抢占；前台应用/视口/短期目标不符放行。Core出队重新核对会话、修订、几何、焦点与失效代次，超过500ms的迟到按下拒绝。屏幕键盘事件沿同一范围检查，不因注入标志排除；实际屏幕键盘仍待验收。官方分页导航不归文件快捷键钩子，鼠标/触控/作者/Dock原链保留。
证据：按键归属失败断言→8/8通过（desktop-key-ownership-red/green.log），无接管目标的真实Windows钩子安装/卸载3轮通过（desktop-key-hook-lifecycle.log）；本轮未发送系统按键。原生剪贴板配对8/8、F2六组合通过，完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/clipboard-key-owner-build.log）。此前Shell粘贴6项、剪贴板独立内存11项、宿主115项、消息79项证据沿用。#330间歇存储失败仍未解决。
当前工作包代码3/6=50%，路线2/4=50%，并非整体Windows体验已验证。第03步人工门槛：Explorer双向复制/剪切/粘贴、Ctrl+V只生成一份、焦点快速切换、屏幕键盘、原Dock/作者按钮/触控回归。运行仍为Debug Core26668，start.ps1退出1保留该实例；新候选未部署。下一执行步骤04回收站，唯一下一工作包仍为回补003实机门槛。
