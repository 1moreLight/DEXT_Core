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

## 2026-10-11 WebView原生文件对象通道

做完：隐藏探针用真实临时文件，通过CDP file input把磁盘File交给页面，再用postMessageWithAdditionalObjects传给C#，CoreWebView2File.Path与源一致。进一步Input.dispatchDragEvent发送文件+文件夹，页面drop收到后原生宿主同时拿到两条正确路径。日志 .build/drop-file-object.log，退出0。无系统鼠标移动、无文件复制/移动，临时源按精确路径非递归删除。

依据：[微软官方ScenarioDragDrop](https://github.com/MicrosoftEdge/WebView2Samples/blob/main/SampleApps/WebView2APISample/ScenarioDragDrop.cpp)。因此优先沿用WebView2自身原生拖入→官方顶层宿主drop→AdditionalObjects→Player/Core的通道，避免替换浏览器进程子HWND或新建覆盖输入层。该通道仍需真实Player/WorkerW/Explorer命中及源效果验证；CDP不替代OS拖放，01继续开做，0/5=0%。

一次探针误假设脚本new File会传入空路径，实际上当前runtime在发送时抛TypeError；ExecuteScriptAsync不直接抛该脚本异常导致等待超时。改为显式返回脚本异常后验证通过，见#319。
- 完整Core/Player Release构建退出0（.build/drop-file-object-core-build.log），旧Core51648保持，无新配置器。

## 2026-10-11 生产Player读取模块

做完：DextNativeDroppedFiles加入生产Player显式编译项；仅从CoreWebView2File读取本机绝对路径，去重，限制256项和总路径长度，失败不返回部分项目。没有文件写操作，没有新增窗口或改变点击/触控。

同一生产源码链接到隐藏探针，真实磁盘File及浏览器派发的文件+目录两种对象读取通过，退出0（.build/drop-reader.log）。这证明读取模块对真实WebView对象可用；当前尚未接入正式WebMessage事件/会话/落点，也未启用页面拖入入口。真实WorkerW/Explorer门槛保持，01仍开做、0/5=0%。
- 生产net472 Player及完整Core/Player Release构建退出0（.build/drop-reader-core-build.log）；原Core51648保持，无新配置器。

## 2026-10-11 Player私有消息接线

做完：既有dext:v3-native-request新增desktopDrop消息，严格解析当前generation/session/revision、已确认desktopContextId、Desk、归一化落点、修饰键和源允许效果。页面JSON不接受files字段；Player正式WebMessage入口在顶层官方文档/原生运行态校验后从AdditionalObjects填入私有IPC字段，独立Dock不接收。

证据：新增3项消息检查，含实际IPC序列化往返；75/75输入消息检查通过。原点击/触控的证明与派发路径未改。

尚未完成：官方页面拖入事件及Core同步Desk资格/文件操作；当前Core对新方法仍返回denied，未显示可拖入或允许写盘。真实Player/WorkerW/Explorer验收保持，实施0/5=0%。
- 完整Core/Player Release构建退出0（.build/drop-envelope-core-build.log）；原Core51648保持，无新配置器。

## 2026-10-11 Core同步页核对

做完：CheckDesktopDrop与Player桥入口核对当前会话/安装、确切呈现context、当前Desk及本机同步启用、锁屏/转场/生命周期；文件操作开始前必须调用。新增2项实际Core类检查先红后绿，共18项个人接口通过。

外部拖动时Explorer通常占前台，壁纸可能因规则暂停；因此不能照搬布局写入的IsDesktopForeground/PlaybackPaused限制。Player允许desktopDrop消息穿过普通播放暂停门槛，Core仍核对同步页/锁屏/转场。真实命中及来源由后续Player/OS验证继续承担，未放宽现有点击/触控动作。

待接：WebWebView2操作执行分支、官方DOM事件、实际Shell写盘结果；核对函数尚未用于执行文件操作。01保持开做、0/5=0%。
- 完整Core/Player Release构建退出0（.build/drop-scope-core-build.log）；旧Core51648保持，无新配置器。

2026-10-11 iframe命中补证：新增隐藏IframeDropProbe，沙盒allow-scripts作者iframe铺满视口；CDP在iframe区域发送拖放，观测top:dragenter/dragover/drop目标IFRAME。随后通过实际生产native-host.js的dropFiles发AdditionalObjects，由生产DextNativeDroppedFiles验证源文件身份成功。源内容保持，临时文件删除；未移动OS鼠标或替换当前桌面。
日志：.build/drop-iframe-production.log，探针退出0，SDK1.0.3595.46/runtime154.0.4258.62。这排除了该浏览器夹具中“事件只进iframe”的假设，不能外推到所有作者页面或WorkerW/Explorer。仍待完整官方DOM宿主、实际Player/WorkerW与OS OLE效果验证，01保持开做。
