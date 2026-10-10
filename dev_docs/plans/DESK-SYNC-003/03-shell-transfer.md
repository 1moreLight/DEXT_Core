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
