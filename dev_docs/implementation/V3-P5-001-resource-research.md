# P5资源与上下文接入研究（2026-10-03）

只读研究记录，供Task2后续实施；不是验收或完成声明。CodeGraph目录存在但status=Not initialized，按当前源码定位。研究agent未改文件、构建或审查。

## 已确认的边界

- `Lively.Player.WebView2/Extensions/WebView2/CoreWebView2Extensions.cs:NavigateToLocalPath`将入口目录整体SetVirtualHostNameToFolderMapping，Allow。微软说明该映射的资源不会触发WebResourceRequested，故v3必须在首航前选择受控响应路径，不能仅给现有事件加inventory检查。v2保留旧映射。官方说明：https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/webresourcerequested
- `Form1.InitializeWebView2Async`配置边界后local分支直接映射导航；trusted-host同时用于v2/v3，不能单凭此标志选择。`ConfigureDextOfflineBoundary`目前允许同host、首航任意.localhost和about:blank；v3须固定官方顶层身份和独立内容清单。
- `tauri-ui/src-tauri/src/lib.rs:apply_room`把v3安装到官方dext-room-v3/content；目前官方host尚无index/LivelyInfo，仍明确拒绝应用。不能先让新host直接fetch content/room.json绕过Core上下文。
- Core `RoomV3Installation.OpenResource`已保留祖先/资源句柄、防reparse与替换；实际响应必须校验并返回同一读取句柄的字节。Core .NET9源码不能原样链接到Player .NET Framework4.7.2/C#8。

## 顺序、序列化与撤销

1. Gateway.Subscribe同步发首个snapshot，然后PlayerBridge.Connect构造out bridge，最后WebWebView2.AttachRoomSession赋字段。首回调不能依赖该字段读取RuntimeContext；需要明确context→snapshot顺序或有界缓存早到快照。
2. 生产Core SendMessage使用JsonConvert.SerializeObject，而Manifest是System.Text.Json.JsonElement。显式用GetRawText字符串DTO再由Player解析JToken，或显式跨框架投影。现有RoomSessionWireProbe.Send使用System.Text.Json，新增测试须穿过生产Json.NET路径，不能掩盖格式错误。
3. Gateway.Deliver遇撤权/inactive直接终止观察，没有最终inactive帧。Detach也只清Core字段。持久Player context必须有显式revoke，清inventory/文档代次/输入，不能依赖订阅结束后再来最后一帧。
4. Player stdin后台通过Control.Invoke(async Action)进入UI，不等异步处理完成。资源异步完成后重新核验文档/context代次，拒绝导航/撤销后迟到响应；请求使用deferral且异常也Complete。重hash不能阻塞UI或Gateway观察锁。官方线程说明：https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/threading-model
5. 顶层NavigationStarting、FormClosing、非预期ProcessFailed、Core detach/stop统一失效；frame只撤销对应实例。IsTopLevelWebMessage目前只比较当前URL，必须防作者页升顶层继承官方IPC。NewWindowRequested用户弹窗会OpenBrowser，v3必须明确拒绝。

## 后续最小实施顺序

先做RuntimeContext/revoke DTO与生产Json.NET回归，再处理attach初帧顺序；首航前v3资源服务只开放有限官方文件，收到Core context才开放清单内容；导航/撤销/迟到响应拒绝后接Task3 DOM。保留v2和历史overlay选择路径。

复用`tests/Dext.Input.Tests/RoomSessionWireProbe.cs`的`--v3-wire <ReleasePlayer>`隔离临时目录/stdin/stdout，不接用户Room。`ContinuousSceneProbe`仅为v2 P2a骨架，不能代填原生v3。资源用例须验证声明资源、未声明/清单文件、编码穿越、hash/size篡改、目录替换、外域/worker、导航撤销后的旧请求，及真实video/GIF加载。

## Framework与响应流跟进（2026-10-03，仅研究）

当前Player为Framework4.7.2，已安装WebView2 SDK1.0.3595.46/net462。Core实际安全实现为RoomV3Installation.ResourceReader/OpenResource，并无WindowsSafeFile类型。CreateFileW/SafeFileHandle、GetFileInformationByHandle、GetFinalPathNameByHandleW可移植；保留祖先句柄、拒绝reparse/type异常和删除共享、真实根分隔符边界。改用SHA256.Create/ComputeHash、byte[] Read/ReadAsync、BitConverter十六进制，不使用.NET9独有API。同步打开句柄不能设FileStream isAsync=true，除非使用OVERLAPPED。

WebView2响应Content在deferral完成时必须已全部可读，但此时尚未消费；不能在事件handler的using退出时关闭流。响应包装流在EOF/异常关闭，context登记活动流并在导航/撤销/退出兜底，处理浏览器提前取消。UI提取请求/generation/deferral，后台完整验证，回UI重新核验generation再发布，所有路径完成deferral。官方Content与流示例：
- https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2webresourceresponse.content?view=webview2-dotnet-1.0.3595.46
- https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content#example-of-handling-the-webresourcerequested-event

System.Net.Http.RangeHeaderValue已可用。首版支持单区间0-/N-M/-S，206与准确Content-Range/Length/Accept-Ranges，越界416；多区间可忽略并完整200。先验证整个文件hash再截取；包装Length/Position/Seek/Read均限制区间，0字节Read不当作EOF。单文件1GiB/总2GiB，禁止通用ReadAllBytes。

使用三参数AddWebResourceRequestedFilter("*", All, CoreWebView2WebResourceRequestSourceKinds.All)并在首航前注册。旧两参数重载已deprecated，iframe覆盖不足。Document包括顶层/iframe和Dedicated/SharedWorker入口，worker内部请求另有source kind；source kind不是Room身份。同环境多个WebView可收到共享/服务worker请求，官方要求一个处理者；不能清共享profile的ServiceWorkers替代本会话撤销。过滤器不承诺blob/data/WebSocket全部覆盖。
- https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.addwebresourcerequestedfilter?view=webview2-dotnet-1.0.3595.46

当前Rust apply_room先install再set_wallpaper；长视频若一直持原安装文件/目录句柄，会阻止替换content。实施裁定待落实：验证时复制到响应自有不可变字节存储，小资源有界内存、大资源临时文件，校验成功即释放源句柄；响应/会话负责临时存储清理。不持有全部资源的会话级安装锁。

实际验证需覆盖声明/未声明/根清单/编码穿越，等长改字节/截短/增长/junction/symlink，后台验证期间撤销，Range边界与真实MP4/WebM播放seek，iframe与各类worker，取消/导航/退出后的句柄和临时文件释放。本记录不表示已实现这些能力。

## 实际资源与网络验证结论（2026-10-03）

实现与证据见同包ledger。实际媒体使用仓库GIF/字体及ffmpeg合成3秒MP4/WebM，不使用个人媒体；Player完成decode/play/seek。CSP connect-src不能单独覆盖RTC。响应Connection-Allowlist允许response-origin、禁止RTC/重定向；原生URL拦截和CSP继续限制清单字节、frame与worker。其网络服务实施范围见[Chromium设计](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/docs/connection_allowlist_design.md)与[规范](https://wicg.github.io/connection-allowlists/)。

RTC对象仍可构造；强制策略将ICE标为administratively prohibited。report-to必须是Structured Fields token；没有它可能不向本地observer排报告。使用组名dext-native-policy，不配置Reporting-Endpoints，避免报告外发。报告type是connection-allowlist，body.connection=webrtc、disposition=enforce、allowlist为响应origin；takeRecords同步可取，callback才异步。官方源码：[RTC](https://chromium.googlesource.com/chromium/src/third_party/+/master/blink/renderer/modules/peerconnection/rtc_peer_connection.cc)、[报告生成](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/frame/connection_allowlist_violation_report_body.cc)、[报告上下文](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/frame/reporting_context.cc)、[observer](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/frame/reporting_observer.cc)。实际Runtime153官方/沙箱报告通过，删除报告API反例拒绝启动。

### mDNS实际崩溃限制

现场日志：RenderProcessExited/Crashed/exit3；No binder found for interface network.mojom.MdnsResponder for the frame/document scope；bad IPC123。当前Chromium main的[PopulateFrameBinders](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/browser_interface_binders.cc#1036)在强制RTC-block时不注册mDNS/P2P接口；[RTC factory](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/peerconnection/peer_connection_dependency_factory.cc#795)仍可能创建[MdnsResponderAdapter](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/p2p/mdns_responder_adapter.cc#44)，后者立即请求接口。[broker](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/browser_interface_broker_impl.h#91)找不到接口会报bad message；[导航逻辑](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/renderer_host/render_frame_host_impl.cc#17598)在相关feature启用时重建broker。此链与实测吻合，但未独立确认Edge私有源码/feature配置。

因此官方只在每WebView实例首次文档检测Runtime支持，响应策略每次保留；实际资源/撤销/重载通过。此规避不保证作者恶意重复RTC不会触发renderer退出；JS异常捕获无法接住这种进程结束。P5最终安全稳定性和故障恢复仍未验收。about:blank诊断曾崩溃，不能计为通过；不使用版本号、代理参数或JS API覆盖代替浏览器策略。
