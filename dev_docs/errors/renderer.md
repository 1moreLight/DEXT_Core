# 踩坑记录 · 渲染器篇（wallpapers/dext-room，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / frontend / toolchain

## 4. 切桌永久卡死

- 根因：配置器写的 room.json 缺 transitionText 字段，main.js 对 undefined 调用函数抛异常，switching 锁死为 true
- 解决：缺字段回退默认文案（bc2af63）
- 防再犯：渲染器处处兜底（宽容读取），schema v1 要写明全部可选字段

## 19. SVG polyline points 不支持百分比坐标（R9 导图线条挤成左上角一坨）

- 现象：思维导图连线全部缩在画布左上角成一个"不明物体"小箭头，节点间反而看不到线
- 原因：<polyline points="15,48.6 ..."> 的 points 是用户单位（px），**不支持 %**；
  <line x1/y1/x2/y2> 才支持百分比。想当然把 % 塞进 points 就全挤到左上角了
- 解决：每条路由拆成 3 段 <line>（% 坐标），箭头 markerEnd 只放最后一段；
  strokeWidth 用固定值不受 % 影响
- 教训：SVG 里 polyline/polygon/path 的坐标一律是用户单位；要 % 就用 line/circle 等支持
  百分比的元素属性，或上 viewBox+preserveAspectRatio（注意描边会跟着缩放）

## 21. 主题令牌重构吃掉 CSS 属性名（dock 无底色/布局丢失）

- 现象：style.css 多处出现「-color: var(--dext-...)」这类残行，#dock 整块只剩
  backdrop-filter/box-shadow，position/flex/padding 全丢；.icon-del/.size-btn 同伤。
  始于 b4a0827（rgba→var(--dext-*) 的批量替换把「background-color:」前缀连值一起误删）
- 解决：对照 git show b4a0827~1 还原全部损坏规则，并用 node --check 式脚本全文件扫残留
- 防再犯：批量正则替换样式属性后，用正则扫 /[{};]\s*-color|^\s*-color/ 自检 + 浏览器视检一遍再提交

## 31. sandbox iframe 的完成消息与 WebView IPC 必须双层验源

- 症状：旧 HTML 场景只判断裸字符串 `dext:slotDone`，任意 frame 或顶层页面都能提前结束当前场景；同时 WebView2 会接收子 iframe 的 web message，sandbox 本身不足以保护启动/保存 IPC。
- 根因：只验证消息内容，没有绑定发送窗口、场景实例和 Player 顶层文档来源。
- 解决：每次 HTML 场景生成 `instanceId`，宿主同时校验 `event.source === iframe.contentWindow` 和结构化消息里的实例；Player 再比较 WebView message 的 `Source` 与当前顶层 URL，只允许官方顶层文档上行。
- 防再犯：跨窗口消息至少绑定来源窗口和一次性实例；涉及本机能力时还必须在最终宿主边界再次验源，不能只依赖前端 iframe sandbox。

## 33. Tauri 开发态 origin 与发布态不同导致预览被拒绝

- 症状：打包后的配置器预览正常，但 `npm run tauri dev` 中 iframe 一直停在默认 Room，内存草稿没有进入渲染器。
- 根因：渲染器只放行发布态 `http://tauri.localhost`，而 Vite 开发父页面实际是 `http://localhost:1420`。
- 解决：预览父页面使用固定双值白名单；仍校验 `event.source === window.parent`、消息结构和素材 origin，禁止 `*`。
- 防再犯：涉及 Tauri 自定义协议与开发服务器的 postMessage 时，发布态和开发态 origin 都要实测；白名单必须是明确值。
# #55 切 Desk 后能力实例保持旧身份

现象：Scene/Widget 能收到初始化时的 `desk.read`，但切换 Desk 后可能继续显示旧 Desk 名称或索引。

原因：渲染器只更新 `currentDesk` 并触发 UI 生命周期事件，没有调用能力桥的 `deskChanged()` 广播。

修复：把 `capabilityHost.deskChanged()` 放入 `renderDesk()` 的统一刷新路径，并增加 capability bridge 回归验证。

防再犯：任何改变 `currentDesk` 的入口必须经过 `renderDesk()`；新增能力字段时同步覆盖初始化快照和状态变更广播。
# #56 暂停状态仍持续推送能力数据

现象：Player 进入暂停后，能力桥的周期性 `time.read` 以及硬件、媒体、音量、频谱更新仍可能持续发送给 Scene/Widget。

原因：能力桥只把暂停当作一个普通 playback 字段，没有将其作为推送调度状态。

修复：暂停时缓存最新值但停止周期性发布；恢复时发送 `playback.read` 后为每个实例补发完整快照，保证恢复后不需要重建实例。

防再犯：涉及 Player suspend/resume 的能力都必须覆盖“暂停不推送、恢复补快照”的测试。
# #57 WebView 销毁缺少统一生命周期收口

现象：Room 替换、Player 重建或 WebView 页面销毁时，能力轮询定时器与实例注册主要依赖浏览器自然回收，旧回调存在继续触发的风险。

原因：能力轮询使用匿名 `setInterval`，Scene/Widget/转场资源没有统一的文档销毁入口。

修复：保存轮询句柄并新增幂等 `disposeRuntime()`，在 `pagehide` 时停止轮询、取消 active slot、卸载 Widget/Scene、停止视频、清空能力实例和 staging。

防再犯：新增 Player 级后台任务必须登记到 `disposeRuntime()`，不得留下不可取消的匿名定时器。
# #65 真桌面跨层拖拽两次实机失败，已放弃该交互目标

现象：DOCK-003（2026-08-29 原版：指针 rect 命中）与 DOCK-UX-001（2026-09-05 加固版：document 级
ghost、Dock 吸附带膨胀 48px、pointerup/pointercancel/lostpointercapture 统一按最后指针位置提交、
<24px 防误触）两版自动检查全绿、预览可用，但真实 Player（WorkerW 壁纸层）中拖拽仍不稳定；
第二版失败现场细节未采集，用户决定放弃真桌面拖入/拖出 Dock（实现 `638ee0e` 已 revert `de04a33`）。

原因（推断，未实证）：WebView2 壁纸窗口位于 WorkerW 层，拖拽跨越官方图标层与 Dock 层的指针捕获
边界；任务栏等 topmost 窗口会截走指针并触发 capture 丢失/pointercancel，事件层无法稳定还原
「拖拽中」语义。属于宿主输入链限制而非页面代码缺陷。

防再犯：真桌面跨层拖拽方向若重启，必须先立专项研究包（WebView2 指针捕获在 WorkerW/被 topmost
遮挡场景下的行为实证 + Player 原生输入桥可行性），不再直接实现页面级交互；Dock 图标管理的
正式入口保持为配置器 `DockEditor`。

# #68 Lively 注入负载是 JSON 字符串，直接交给能力桥导致硬件/媒体全空

现象：`--wallpaper-system-information` 已开启、Player 正常运行，但 Widget 的 CPU/GPU/内存/网速
永远为 0；媒体/频谱同理。时钟正常（本地生成，不经注入）。

原因：`Form1.cs` 用 `ExecuteScriptFunctionAsync("livelySystemInformation", JsonConvert.SerializeObject(e))`
注入的是 **JSON 字符串**（LIVELY_API.md 已注明），官方示例均先 `JSON.parse(data)`；
而 `main.js` 把字符串原样传给 `capabilityHost.updateHardware`，`sanitizeHardware` 的
`typeof value === "object"` 判断不过 → 走全零兜底，异常被 `catch { }` 静默吞掉。

修复：在注入边界统一解析（`parseLivelyPayload`）：字符串先 `JSON.parse`（失败按 null），
四个注入函数 `livelySystemInformation / livelyCurrentTrack / livelyAudioListener /
livelyWallpaperPlaybackChanged` 全部过一遍；对象负载原样通过。

防再犯：跨进程/宿主注入回调先确认负载是对象还是序列化字符串；能力桥 sanitize 全走
`typeof === "object"` 兜底，字符串不 parse 就等于永久空数据，且无任何报错。

# #69 P1 能力没有"自动允许"的落地方，授权 store 缺失时全部只读能力被静默丢弃

现象：Widget 硬件数据在 #68 修复后仍为空；`%LOCALAPPDATA%\Dext\permissions-v1.json` 根本不存在。

原因：授权链是 `permissions-v1.json` → Core `permissions-read` → 渲染器 `grantedPermissions`
（declared ∩ granted）。P1 只在 WIDGETS_V2 写了"自动允许"，运行时从未落地：没有任何代码
自动写 P1 授权，store 缺失即授权全空，`capabilityHost.post` 把 time/hardware 等全部丢弃。
时钟看似正常是因为 Widget 兜底时钟（加载时一次性判断无 session 即本地起跳）恰好工作，
掩盖了能力桥断链。

修复：渲染器 `grantedPermissions` 按契约落地 P1 自动允许（time/locale/viewport/desk/playback/
spectrum/hardware.* 只读集合，declared ∩ (granted ∪ P1)）；P2（媒体/音量读取）与
P4（action.invoke）仍必须来自 store 显式授权。

防再犯："自动允许"是运行时行为，不是文档形容词；加能力分级时同步实现对应授权路径，
并用空 store 场景验证 P1 可用、P2/P4 仍被拒。

# #72 拖拽预览的计时器、取消与异步 revision 必须共同失效

现象：图标在占用格停留不足 80ms 后移到空白，旧计时器仍会触发交换；`pointercancel` 会像
`pointerup` 一样提交已发布预览；实验台 Reset 后，旧 Zigzag/回弹/压力场景的延时回调还会覆盖
新布局。

原因：稳定格计时器只在进入另一个有效目标时清理，没有覆盖空白/源格；完成函数没有区分提交
与浏览器/OS 取消；场景 token 只在部分回调入口检查，没有在每次 `await` 后重新验证。

修复：离开候选格立即清理 timer 并恢复已发布预览；只有 `pointerup` 可提交，`pointercancel` 与
`lostpointercapture` 一律恢复拖拽基线；每个延时点返回后、任何 `apply/cancel/describe` 前都核对
当前 token。Playwright 使用真实 pointer 路径覆盖“30ms 后移开”“已交换后 pointercancel”和
“Zigzag 中 Reset”。

防再犯：带停留阈值的拖拽必须测试进入、停留、离开、换目标、取消和 capture 丢失；异步 revision
的有效性检查应放在每个异步边界之后，而不是只在任务开始时检查。

# #73 布局位移与苹果式编辑抖动必须分层拥有动画属性

现象：浏览器动画实验台能展示自动让位，但没有 500ms 长按进入编辑和图标抖动，用户看到后合理地
认为新重排会吃掉原有苹果式编辑模式；极限折返又以约 52ms 连续触发，看起来像日常动画过快。

原因：实验台把整个图标按钮直接作为 FLIP 节点，只展示布局技术场景，没有复现产品的编辑状态；
正常运动和压力测试也没有在命名与视觉上分开。真实桌面代码虽然未改，实验台却没有证明两类动画
能够共存。

修复：稳定 DOM 改为外层 positioner + 内层 icon face；FLIP/WAAPI 只写外层 transform/opacity，
500ms 长按后的 0.35s jiggle 只写内层 rotate。默认 move/rollback 放缓到 280/300ms，52ms 连续
revision 明确标为 `Stress · rapid`。Playwright 同时断言外层 FLIP animation 和内层 jiggle 存在。

防再犯：动画实验台必须包含被新机制影响的既有产品状态，不能只证明新动画自身；多个动画语义不要
共同拥有同一 DOM 层的 transform，压力场景必须与用户日常时序明确区分。

# #74 reduced-motion 必须处理运行中切换和系统偏好

现象：在 280ms FLIP 运行途中勾选 Reduce motion，外层 WAAPI 仍继续；系统设置
`prefers-reduced-motion: reduce` 时，内层编辑 jiggle 仍在播放。

原因：动画控制器只在下一次 `apply()` 查询实验台复选框，开关事件只切 CSS class；同时该 class
没有合并系统媒体查询，媒体规则也只压缩 transition，没有停止新加入的 keyframe animation。

修复：统一以“复选框或系统媒体查询命中”作为 reduced-motion 来源；任一来源变为 reduce 时立即
发布无动画 revision 并保持已写入的最终坐标，同时在 class 和媒体规则两层禁止内层 jiggle。若当前
是拖拽预览，则继续使用 preview mode 以保留 `previewBase`，后续取消仍能恢复。Playwright 覆盖运行中
切换、系统偏好以及降速后取消预览。

防再犯：reduced-motion 不只是创建动画前的分支；所有运行时偏好都要测试初始命中和中途切换，
并分别验证脚本动画与 CSS 动画。
