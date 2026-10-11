# DESK-SYNC-003 Shell文件传输

状态：开做

STA Shell文件操作，复制/移动/快捷方式；重名交互、取消、部分失败、同目录和源保留；临时目录验证实际文件内容和结果，不修改用户现有文件。

- [ ] 实现或验证
- [ ] 必要检查及证据
- [ ] 记录并提交

## 2026-10-11 真实Shell复制/移动底层

先推进与接收HWND无关的文件后端，01真实Player/Explorer门槛仍保留；没有提前开放页面文件写入。

做完：DesktopShellTransfer与Interop，独立STA线程初始化COM，使用Windows IFileOperation一次排队多项，逐项ProgressSink只依据实际回调报告completed/skipped/failed，返回aborted与HRESULT。文件/目录共同走Shell；保留标准用户交互，探针以无UI早失败模式运行。取消令牌在排队和进度回调核对。COM资源在STA释放。

六项真实临时目录检查通过：复制内容/源保留、移动目录内容/源消失、同目录不动、缺失源失败、混合失败且重复源只计一次、预取消不移动。日志 .build/drop-transfer-checks.log。仅操作唯一测试目录，清理限定该目录，未操作用户桌面。

待做：快捷方式、默认同卷/跨卷与修饰键策略、实际冲突/取消UI，Core执行及结果反馈、拖入落点。当前不是完整文件拖入功能，0/5=0%。

接口声明顺序及GUID核对本机Windows SDK shobjidl_core.h；[IFileOperation说明](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ifileoperation)、[逐项结果回调](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-ifileoperationprogresssink)。
- 完整Core/Player Release构建退出0（.build/drop-transfer-core-build.log），旧Core51648保持，无新配置器。

2026-10-11快捷方式底层做完：IShellLinkW/IPersistFile在传输STA生成独立暂存lnk，IFileOperation负责目标复制/冲突/取消；回调关联暂存源但结果返回用户原始源。允许同目录生成快捷方式，原文件不移动。暂存仅删除自产文件和唯一空目录。
新增真实lnk存在/源保留、独立WScript.Shell解析目标2项先红后绿，连同已有策略和Shell检查16项通过（.build/drop-link-green.log）；完整Core/Player Release退出0（.build/drop-link-core-build.log）。未对用户桌面执行拖放，实际冲突UI/运行时接线仍待，03保持开做。

2026-10-11 Core执行入口已接：desktopDrop私有IPC进入独立处理器，拒绝Dock/无效坐标/并发请求；系统Known Folder决定目标，STA入场复核原始context，排队与Shell回调复核当前会话/同步Desk。自己的文件更新可刷新context，不误用旧context取消自身操作。每项结果只回名称/状态/HRESULT，不把路径返回页面。
21项定向检查通过（.build/drop-execution-checks.log），新增原生卷识别、来源禁止移动、入场失效、排队后失效保源。完整Core/Player Release成功（.build/drop-execution-core-build.log）。Core处理器目前仅构建验证，尚无页面入口与真实Player调用证据，不能将此记为端到端完成；落点摆放和冲突/取消实机仍待。
2026-10-11取消回执修复：真实Shell进度撤销暴露GetAnyOperationsAborted=false/HRESULT取消的不一致，已合并取消回调锁存和返回码。23项真实文件/策略检查通过，覆盖首项已移动后取消保留第二源及首项成功记录；完整Release成功。重名交互与实际Explorer Esc仍待，见ERRORS #323。
