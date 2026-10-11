# DESK-SYNC-004 独立验收

状态：开做，代码实施4/6≈67%；人工验收待确认，未实施功能不能记通过。
目标：同步Desk提供Windows式真实文件交互。范围外：永久删除、虚拟Shell项、内部自由排序、Dock拖入。

1. 单击选中、Ctrl多选/反选、Shift范围，监听刷新保留仍存在项，换Desk/Room清空；其他窗口打字不操作桌面文件。
2. 文件/文件夹/快捷方式双击按系统关联打开，Ctrl多选后Enter打开所选项且保留选择；F2改名及Esc取消，中文/扩展名/重名行为正确；作者按钮和Dock仍单击。
3. Explorer与Dext双向复制/剪切/粘贴，源/目标字节和移动结果正确；剪切未粘贴不丢源，剪贴板被用户更换时不覆盖。
4. Delete把唯一临时文件送回收站且可从回收站恢复；取消或不支持回收不永久删除；Shift+Delete无永久删除入口。
5. 右键及菜单键出现原生菜单，打开/属性/取消正常，DPI和多选命中正确，不误触下层窗口。
6. 原Dock、作者按钮、触控、鼠标、键盘和切页正常；退出、停用、切Room不继续处理旧文件命令。

只使用唯一临时文件，实际剪贴板/Room运行验收先备份并恢复；不清空回收站、不操作用户原文件。003原生外部拖入验收保持独立。
2026-10-11 第01步实施接线做完：官方图标层加载desktop-selection模块，原生Ctrl/Shift支持单选/多选/范围选择，矩形选中样式与aria-pressed同步；同Desk刷新保留存在项，换Desk/分页清空。Core仅为official.desktop发布按下时修饰键/Key/坐标/单调时间及Windows双击时间/矩形参数；私有桥严格接收，普通DOM click不能启动文件。同步文件单击选择、双击/Enter打开、Space选择；作者按钮、分页导航和Dock保留单击。暂停、修订与图标上下文变化清理待双击。
定向证据：DOM单击旧行为1次启动的失败断言→修复通过；私有桥原丢弃事件失败→修复通过；选择/宿主/桥111项通过，包含双击超时/偏移/暂停及三击只打开一次；foreground-return四组通过并校验原生位置/键盘修饰键。正式Core/Player/Watchdog Release退出0，verify-release-host确认新增资源引用在白名单；start.ps1 CoreOnly复用旧Core52420，无新配置器。当前运行版未更换，实际鼠标/触控/DPI仍留统一验收。
第01步实施1/6≈17%，路线2/4=50%。第02步双击/Enter基础随接线实现，F2改名与多选打开细节待继续；未称整个02完成。候选尚非完整004交付；人工验收按独立卡：单击/Ctrl/Shift、双击/Enter、切Desk、作者/Dock单击与触控回归。
2026-10-11 第02步F2完整接线增量：官方宿主仅当前单选与原生焦点一致时发desktopRename，私有协议/Player序列化/Core桥解析并消费F2证明；原生WPF窗口Enter提交、Esc/取消关闭，文件默认选中不含扩展名，目录选全名，重名留在窗口提示。IFileOperation在后台STA执行，当前Room/同步Desk失效取消，执行期间关闭先请求取消并等待结果；与拖入共用串行门。路径仅留Core，成功由既有目录监听刷新。暂停/修订保留已发改名回执，替换会话取消。
证据：DOM与native-host新增用例先失败后112/112通过（rename-wire-red/green.log）；原生协议78/78通过（rename-messages.log）；完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/rename-dialog-build.log）。尚未实机操作改名窗口，不能以构建替代焦点/触控验收；多选打开细节仍待，第02步保持开做，1/6≈17%，整体50%。
启动核对：start.ps1 CoreOnly发现运行Core已变为主目录Debug路径PID26668，非先前PID52420；mutex/pipe被该实例占用，脚本拒绝启动目标候选。未停止该进程，未启动配置器或部署新宿主；后续先核对运行身份再安排集中验收。

2026-10-11 第02步代码实施做完（待统一实机验收）：Enter不再改写选择，desktopOpen携带当前所选ID，Core一次核对整组扫描目标并消费原生Enter证明，再逐项打开；单项失败继续其余项，切换会话/同步Desk停用时停止剩余项。单击/Ctrl/Shift与F2单选规则保留，双击走原单项打开。首个应用获取前台导致暂停时保留本次动作回执，避免已打开却报失败。
证据：宿主多选丢失断言先失败后通过；Core新检查先20/21失败后21/21通过，覆盖整组解析/缺失项不启动/一次消费/中途取消；113项宿主检查、79项私有消息检查、最终完整Release均通过。日志open-selection-core-red/green.log、open-selection-dom-red/green.log、open-selection-host-green.log、open-selection-messages.log及D盘desktop-shell-actions-build-env/open-selection-build.log。改名真实临时文件7项证据沿用此前后端检查；没有新增实机验收结论。
运行：start.ps1依然报告其他路径Core26668占用产品身份并退出1，未更换该Debug实例、未启动配置器。当前02做完仅指代码实施，窗口焦点/Enter/Esc/触控/DPI留统一验收，整个工作包尚未验收。实施2/6≈33%，路线仍2/4=50%，下一执行步骤03剪贴板。

2026-10-11 第03步复制/剪切接线增量：Ctrl+C/X/V由Core按下时Ctrl+当前official.desktop文件焦点产生配对证明，普通字母拒绝；Player官方物理采样识别这些按键。复制/剪切通过desktopCopy/desktopCut只提交当前所选ID，Core校验整组并消费证明后调用DesktopShellClipboard，路径留Core。剪切变淡采用filter:opacity(.45)与切页内联opacity相乘；presentationRead附带剪贴板序列元数据，用户后来复制新内容则恢复图标，避免迟到旧读取清除刚完成的剪切。Ctrl+V仅原生证明已接，页面暂不派发粘贴，不能称粘贴已可用。
证据：快捷键用例先失败后6/6 sampled/direct通过（clipboard-keys-red/green.log）；Player pointer18项、原生消息79项、宿主114项通过，含保持多选/剪切状态/外部新剪贴板恢复。Core当前所选目标解析检查通过，个人编辑组先一次21/21，补切目标后一次20/21（旧drop placement返回storageUnavailable），保存失败为clipboard-copy-core-storage-failure.log；相同构建仅复查一次21/21（clipboard-copy-core-recheck.log）。第一次RED另有旧fixture原子发布Win32拒绝访问，未改存储实现、未宣称该间歇问题修复。F2原6组合通过。完整Core/Player/Watchdog Release成功（desktop-shell-actions-build-env/clipboard-copy-build.log）；start.ps1因现有Debug Core26668产品身份占用退出1，未替换运行版、未启动额外配置器。
剩余：Ctrl+V粘贴/同目录副本/成功项完成回执、空同步Desk的粘贴焦点入口、实机Explorer双向互通及触控。接粘贴时需核对原生桌面也收到Ctrl+V是否引起双执行，不能仅凭RawInput观察与消息用例认定实机无重复。系统剪贴板未在本轮自动测试中读写；实际复制/剪切与视觉效果仍待统一验收。03保持开做，实施2/6≈33%，路线2/4=50%。

2026-10-11 第03步粘贴执行增量：Ctrl+V私有命令贯通Core原生证明、真实剪贴板读取、Shell粘贴与逐项反馈。同目录复制单独使用FOF_RENAMEONCOLLISION生成副本，普通目标冲突继续Shell确认；同目录剪切保留源，并清除已无须移动的对应剪切引用。部分失败保留真实成功项，完成剪切更新仍核对原剪贴板序列；暂停和同会话修订保留在途回执。
证据：实际临时文件/文件夹粘贴先红后绿6/6，剪贴板独立内存与完成状态11/11，原拖放回归通过，宿主114/114、私有消息79/79；完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/clipboard-paste-build.log）。Core新增Ctrl+V目标检查通过，但个人编辑整组20/21，旧explicit action检查再次出现storageUnavailable，保留paste-core-green.log并继续记为#330未解决；不将该组报告全绿。
运行核对：start.ps1仍因Debug Core26668占用mutex/pipe退出1；未替换运行桌面、未新增配置器。真实全局剪贴板、Explorer双向互通、原生快捷键是否双执行及触控未验收。空同步Desk粘贴入口仍待补，03继续开做，当前工作包2/6≈33%，路线2/4=50%。

2026-10-11 第03步空桌面入口增量做完：同步Desk顶部加入“粘贴到桌面”原生官方按钮，空文件列表也可点击/Enter/Space粘贴；该按钮有受控焦点时允许Ctrl+V，C/X/F2仍只允许真实文件焦点。按钮独立逻辑尺寸避免按96×104图标比例压扁文字，不改文件槽位、分页容量或选择。Core仍核对当前启用Desk/扫描上下文和一次原生证明，停用或切页拒绝旧命令。
证据：空列表DOM缺按钮断言先失败后通过；Core原NotOperable失败后22/22通过，新增鼠标/Enter/Space/Ctrl+V与停用检查；sampled/direct剪贴板8/8、Player指针18/18、私有消息79/79、宿主115/115；完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/clipboard-empty-paste-build.log）。本次22/22不消除此前#330间歇存储失败记录。start.ps1仍拒绝与Debug Core26668争用身份，原实例保留。
当前2/6≈33%，03保持开做：生产快捷键来自WinDesktopCore.RawInput_KeyboardClickRaw，RawInputMsgWindow注册Keyboard ExInputSink；现有代码只旁听转发，没有阻止Explorer原生快捷键，所以真实双执行风险尚未解决，不启用新候选。下一步先收敛键盘所有权/重复执行，再做实际Explorer互通；全局剪贴板和触控仍留统一验收。
人工验收（部署后统一进行）：空同步Desk用唯一临时文件测试“粘贴到桌面”；Explorer与Dext双向复制/剪切/粘贴，每次只产生一份结果、保留失败源项、更换剪贴板不被覆盖；随后核对原Dock、作者按钮、触控、切页和停用后旧命令失效。

2026-10-11 第03步代码实施做完，待统一实机验收：文件Ctrl+C/X/V、F2及Enter/Space在同步文件/粘贴按钮焦点下通过独立WH_KEYBOARD_LL线程确定单一执行方，成功入队后抑制原按键，RawInput不再二次执行。按下持有原接收者至抬起，重复按下去重，启动已按住的键不抢占；前台应用/视口/短期目标不符放行。Core出队重新核对会话、修订、几何、焦点与失效代次，超过500ms的迟到按下拒绝。屏幕键盘事件沿同一范围检查，不因注入标志排除；实际屏幕键盘仍待验收。官方分页导航不归文件快捷键钩子，鼠标/触控/作者/Dock原链保留。
证据：按键归属失败断言→8/8通过（desktop-key-ownership-red/green.log），无接管目标的真实Windows钩子安装/卸载3轮通过（desktop-key-hook-lifecycle.log）；本轮未发送系统按键。原生剪贴板配对8/8、F2六组合通过，完整Core/Player/Watchdog Release退出0（desktop-shell-actions-build-env/clipboard-key-owner-build.log）。此前Shell粘贴6项、剪贴板独立内存11项、宿主115项、消息79项证据沿用。#330间歇存储失败仍未解决。
当前工作包代码3/6=50%，路线2/4=50%，并非整体Windows体验已验证。第03步人工门槛：Explorer双向复制/剪切/粘贴、Ctrl+V只生成一份、焦点快速切换、屏幕键盘、原Dock/作者按钮/触控回归。运行仍为Debug Core26668，start.ps1退出1保留该实例；新候选未部署。下一执行步骤04回收站，唯一下一工作包仍为回补003实机门槛。

2026-10-11 第04步代码实施做完（待统一桌面验收）：Delete当前多选→原生一次证明→Core扫描ID解析→STA IFileOperation回收→逐项提示接通。采用RECYCLEONDELETE及撤销记录，PreDeleteItem缺回收标志直接拒绝；非本地固定卷/卷根不降级永久删除。Shift+Delete在有效同步文件焦点下由独占键盘链接收，Core不批准删除、页面提示使用Delete；不缩小多选，不增加永久删除命令。成功由目录监听移除图标，失败项保留，普通暂停保留回执，作用域退休取消后续操作。
证据：Shell实际唯一临时文件/目录回收并精确还原、原字节/子文件保留、预取消/失效/缺失源/回收标志检查9/9；夹具还原后删除本轮临时目录，无用户文件/回收站清空。DOM原Shift+Delete缩小选择的失败断言→宿主116/116；Core原Delete无证明失败→23/23；键盘独占9/9、私有消息79/79、指针18/18。完整Core/Player/Watchdog Release通过（desktop-shell-actions-build-env/recycle-build.log）；首次完整构建发现switch局部变量pasted重名，修复为recycled，失败日志保留recycle-build-failed.log。测试STA返回类型与共享回调匹配问题均在实际Shell执行前修正。
运行：start.ps1仍因主目录Debug Core26668占用身份退出1，未部署新候选、未启动配置器。代码4/6≈67%，路线2/4=50%，下一执行步骤05原生右键/属性；真实键盘独占、取消对话框、Explorer互通及鼠标/触控/DPI仍待统一验收，#330间歇存储问题未宣称修复。
人工步骤：在同步Desk只用唯一临时文件/文件夹，单选或多选后Delete，从回收站还原并核对内容；取消操作或目标不支持回收时源应保留，Shift+Delete无永久删除；随后检查Dock、作者按钮、切页、鼠标和触控。

2026-10-11 第05步菜单后端增量：新增 DesktopShellContextMenu，STA持有Shell桌面命名空间/PIDL/IContextMenu/HMENU，支持单项、同目录和跨目录选择查询。已写IContextMenu2/3消息转发、Unicode ordinal InvokeCommand、原生TrackPopupMenu及50ms退休取消检查；实际消息owner窗口/右键/菜单键接线仍待做，不把后端编译当作桌面菜单可用。delete/rename/cut/copy等返回已有Dext操作，避免Shell删除绕过回收站与rename依赖Explorer内联编辑。
证据：空菜单失败断言见context-menu-red.log，删除分流失败断言见context-menu-routing-red.log；最终实际临时Unicode文件单项/多项/跨目录菜单、Properties/copy动词、delete/copy分流、退休/无效命令拒绝、释放与原字节保持14/14（.build/context-menu-final.log）。仅查询菜单，无TrackPopup显示、InvokeCommand调用或系统剪贴板修改；夹具清理完成后才结束测试任务。
消息验证限度：本机IContextMenu2/3均可查询，但已静态填充的根/7zip菜单WM_INITMENUPOPUP返回E_FAIL；context-menu-messages-diagnostic.log保留。初始化“必须已处理”的假设不成立，保留未处理回退；最终测试仅证明转发不破坏菜单，owner绘制、动态子菜单、键盘与取消仍须真实弹窗验证。
完整Core/Player/Watchdog Release通过（desktop-shell-actions-build-env/context-menu-build.log）；随后对旧已部署v3-core-exit-20261010调用start.ps1仅作身份检查，因主目录Debug Core26668占用退出1（.build/context-menu-start-identity.log），没有启动本轮dev候选或额外配置器。当前4/6≈67%，05保持开做，桌面同步路线2/4=50%，#330存储间歇问题仍未解决。
下一执行：原生菜单owner窗口、右键及菜单键证明、选择保留与动作接线，再完整候选交接。人工（统一部署后）：唯一临时文件单选/多选右键或菜单键，检查打开/属性/取消、DPI、不误触下层；回归Dock、作者按钮、鼠标与触控。
