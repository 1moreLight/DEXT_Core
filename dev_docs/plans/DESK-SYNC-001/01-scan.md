# DESK-SYNC-001 系统桌面只读识别

状态：做完（实施）

实现：系统Known Folder解析用户/公共桌面；枚举真实文件、目录、lnk/url；路径身份去重，同名不同路径保留；坏项单独反馈，不移动源文件。

- [x] 实现并记录涉及接口。
- [x] 执行必要检查，记录实际结果。
- [x] 更新状态并提交。

2026-10-11：新增Core DesktopDirectoryScanner，系统DesktopDirectory/CommonDesktopDirectory解析（包含重定向），后台调用的只读顶层枚举；路径身份稳定、跨来源去重但同名不同路径保留；lnk/url分类不要求解析目标；过滤隐藏/系统/desktop.ini，单项错误与截断显式返回。9项临时夹具先红后绿，源文件内容保持。本机--system只输出计数：用户88、公共28、总116、issues0、无截断。完整Core Release通过，CoreOnly确认原Core49448，无新配置器。日志desktop-scan-red/green/system.log、desktop-scan-core-build.log。仅识别器，尚未接私人同步页/渲染/UI，不能称116项已导入。
