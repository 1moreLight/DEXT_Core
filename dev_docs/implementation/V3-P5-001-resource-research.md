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
