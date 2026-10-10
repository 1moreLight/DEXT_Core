# DESK-SYNC-003 真实宿主接收验证

状态：开做

建立不写文件的OLE接收探针；验证父/子HWND、WebView2外部拖放和WorkerW接收位置。验证拖到其他窗口不误收、接收器注册/释放、原点击保持。记录有效接收路径和反例，正式代码在证据后实现。

- [ ] 实现或验证
- [ ] 必要检查及证据
- [ ] 记录并提交

## 2026-10-11 隐藏注册探针

做完：tests/Dext.DesktopDrop.Probe，独立net9 WinForms隐藏窗口，使用与Player一致的WebView2 SDK1.0.3595.46。无鼠标移动、无DoDragDrop、无文件复制/移动、无Explorer/当前Dext修改。只为本进程未注册的HWND临时注册拒绝全部操作的IDropTarget，立即注销；外部浏览器HWND仅列出。

结果：runtime154.0.4258.62，父Form/WinForms WebView/Chrome_WidgetWin_0在默认、AllowExternalDrop=false、恢复true三阶段均注册成功；Chrome_WidgetWin_1及Intermediate D3D Window属于浏览器子进程。日志 .build/drop-registration.log，退出0。这证明注册可用，但不证明实际OLE派发到父窗口。

开做：进一步验证实际派发；WorkerW实际接收者尚未确定。探针使用net9，与生产net472不同，不用它替代真实Player验收。本步保持开做，实施0/5=0%。

参考：[WinForms AllowExternalDrop](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.winforms.webview2.allowexternaldrop)、[WebView2官方仓库DragEnter讨论](https://github.com/MicrosoftEdge/WebView2Feedback/discussions/3973)。后者是现象线索，结论以本机实测为准。
- 完整Core/Player Release构建退出0（.build/drop-initial-core-build.log）；原Core51648保持，无新配置器。
