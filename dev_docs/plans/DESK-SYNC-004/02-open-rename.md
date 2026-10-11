# DESK-SYNC-004 双击打开与F2改名

状态：开做

RoomNativeInputAuthority/Player保留原按下抬起证明，对official.desktop接系统双击时间/矩形及输入类型；相同文件、同scope、相邻有效输入才打开，作者按钮立即单击。Enter打开选中文件；F2仅单选显示改名输入，Esc取消。新增Services/DesktopSync/DesktopShellActions.cs提供RenameAsync(source,newName,owner,cancellation)并复用IFileOperation STA及逐项实际完成回执。Core只接受当前扫描ID，重新解析路径；名字不能含路径分隔符，冲突交由Shell，不覆盖性重试。检查快速同项/不同项、失焦、扩展名、中文、重名取消与真实临时文件改名。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交

2026-10-11 第02步改名后端：新增DesktopShellActions.RenameAsync，复用抽出的STA执行器/正式IFileOperation接口和逐项结果；校验单个文件名、实际路径、取消与当前scope，返回真实Unicode目标，目录内容保留。已存在目标返回conflict供编辑器重输，同名原样返回unchanged。用户交互操作保留Shell撤销与冲突界面，路径竞态仍由Shell裁决，不自动覆盖。
7项真实临时文件检查通过：中文、同名不变、非法路径、已存在目标保留双方、预取消、退场取消、目录改名；共用执行器原23项拖入检查通过。第一次测试清理因旧父目录已改名而抛异常，已改为存在检查并仅清理本轮唯一夹具；真实重名Shell尝试停在PerformOperations，精确停止测试PID50612并清理残留，未记通过。正式Core/Player/Watchdog Release退出0，日志desktop-shell-actions-build-env/rename-core-build.log，start.ps1 CoreOnly保持旧Core52420。
Ruling：改名编辑器对已存在目标直接显示冲突，取代原计划全部冲突交Shell的做法；原因是静默Shell仍可能等待冲突确认，用户可在原输入框重新命名；不允许自动覆盖，竞态与权限错误仍交Shell。F2/输入框/私有Core命令尚未接线，本步继续开做；当前包1/6≈17%，路线2/4=50%。
2026-10-11 第02步F2输入链：Core仅给DesktopPlayer的official.desktop/desktop-*焦点接收114按键，沿用原生配对与当前可见几何采样；Player私有pointer允许该范围的F2，官方宿主事件校验接收114。6项Core配对检查（sampled/direct × 文件/官方按钮/作者场景）通过；Player pointer18项通过；Node111项通过；完整Core/Player/Watchdog Release退出0，日志desktop-shell-actions-build-env/f2-input-core-build.log。start.ps1 CoreOnly保持原Core52420。
同时修正实际代码中的官方桌面输入漏接：ArmInputAsync将official.desktop键盘错误要求匹配作者iframe；Form1等待作者DOM回执/转发模拟按键、鼠标ReceiveOfficialInputDispatch也只认official。统一IsOfficialConsumer/UsesOfficialKeyboard，官方桌面键盘走已有物理采样路径，鼠标保留顶层实际派发回执。没有绕过原生配对或新增覆盖层。上述证据是生产类/消息与构建，不是实机鼠标或触控验收。
F2已经能产生Core文件命令完成事件；DOM尚未处理改名UI和新私有命令，按F2尚不能实际改名，不能标第02步完成。下一步原生证明绑定当前文件ID→改名窗口→Shell服务→结果刷新；保持1/6≈17%，路线2/4=50%。
2026-10-11 F2选择副作用已修复：命令键在选择操作前分流并清空待双击，不再把多选缩成单选，不触发文件打开。新增实际宿主断言先失败（少一个选中项）再通过，相关111项通过，日志.build/f2-selection-red.log与f2-selection-green.log。start.ps1 CoreOnly确认原Core52420，不启动配置器、不部署新宿主。改名私有命令与窗口仍待接，02开做，1/6≈17%，整体50%。
