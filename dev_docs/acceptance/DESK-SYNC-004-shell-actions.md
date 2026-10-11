# DESK-SYNC-004 独立验收

状态：开做，实施2/6≈33%；人工验收待确认，未实施功能不能记通过。
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
