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
切换、系统偏好以及降速后取消预览；生产 CSS 同时移除 icon face 与 placeholder 的 transition，避免托起
和占位仍缓动。

防再犯：reduced-motion 不只是创建动画前的分支；所有运行时偏好都要测试初始命中和中途切换，
并分别验证脚本动画与 CSS 动画。

# #75 图标 Reorder 不是占用格两两交换

现象：实验台把图标拖动实现为“进入占用格后交换两枚图标”，用户要求的却是卡片排序：当前图标
托起、目标位置留位、路径中的其他图标依次让开，松手后保留新顺序。

原因：把旧桌面的 sparse-grid swap 当成了运动语言本身，没有先区分“交换坐标”和“插入排序”两种
数据语义。即使 FLIP 平滑，两两交换也不会产生连续队列让位的视觉。

修复：`resolveIconReorder` 按当前有序槽位移除 dragged item 并插入目标槽，再把沿途图标映射回槽位；
拖动 face 独立跟随指针并 `scale(1.06)`，placeholder 占目标格，其他图标由外层 FLIP 让位。Widget
作为不可移动障碍传入，Dock 作为 reserved/指针禁区。

防再犯：涉及 reorder/sort 的需求先写出序列变化示例（如 `A B C → B C A`），不能用“换位”一词
代替数据语义；测试至少跨过两个相邻项，避免两项样本让 swap 与 insert 看起来相同。

# #76 非法拖放和场景中断必须同时恢复布局与视觉状态

现象：图标先发布路径重排预览、再进入 Dock/Widget 等非法区时，只隐藏 placeholder 会留下已经让位
的其他图标；脚本 Reorder 场景在抬起状态被 Reset，中断 token 虽阻止旧回调改布局，却会残留
`is-dragging` 与 face transform。

原因：把临时状态分散为布局 preview、placeholder、drop-zone、lift class 和 inline transform，却只在
各自主流程清理，没有为非法目标和外部中断定义完整恢复边界。

修复：非法目标立即以 preview mode 发布拖拽基线，保留控制器 `previewBase` 供最终取消，同时清空
目标占位；Reset 或切换场景时统一扫描并清理全部 lift 状态，旧异步回调仍由 scenario token 拦截。
Playwright 覆盖“先合法让位再进入 Dock”“脚本托起途中 Reset”和“托起途中切换场景”。

防再犯：拖拽临时状态测试必须覆盖 valid→invalid→release 和 active→external reset 两条路径；清理
不能只依赖 pointerup。

# #77 Reset 必须同时终止画面状态、指针所有权和长按计时

现象：Widget 拖动中点击 Reset 后，画面先回到初始位置，但同一指针后续 move/up 仍会再次移动 Widget
并提交避让布局；图标或 Widget 的 500ms 长按尚未到时点击 Reset，计时器随后仍会重新进入编辑模式。

原因：Reset 只清了图标拖动样式和布局，没有清空 `widgetDrag/widgetPress/iconPress`，也没有取消 timer
和释放 pointer capture。重置后的旧输入序列仍被事件处理器视为活跃手势。

修复：统一 `abortActiveInput`，先令全部 press/drag 状态失效，再清计时器、托起样式和 pointer capture；
之后才发布 Reset 的最终布局。Playwright 覆盖拖动中 Reset 后继续 move/up，以及长按计时中 Reset。

防再犯：任何外部 Reset/切换都要按一个输入事务的 abort 处理，不能只清视觉；测试必须在 Reset 后继续
投递原指针事件，并等待超过长按阈值。

# #78 每个真实拖动手势必须建立自己的取消基线

现象：先运行 Widget 推开场景，再开始图标或 Widget 拖动并取消，DOM 会跳回运行场景前的初始布局，
但实验台内存仍保存手势开始时的布局；下一次交互因此从与画面不一致的数据继续。

原因：控制器的 `previewBase` 只在首个 preview 建立。脚本场景留下的基线跨进了后续真实手势，
`cancel({restore:true})` 恢复的是更早场景，而不是本次 pointerdown 时用户看到的布局。

修复：真实图标或 Widget 拖动开始前先无恢复地结清当前动画/预览并清空旧基线，再以当前已发布布局
创建本次 drag.base；本手势首次 preview 随后建立独立基线。Playwright 分别覆盖图标和 Widget 取消。

防再犯：取消基线属于手势事务，不属于页面全局；测试“预览 A → 手势 B → 取消 B”而不只测从初始态取消。

# #79 任意外部场景切换都必须先取消真实拖拽

现象：拖着 Alpha 已发布路径让位时切换到 Add，India 会先出现；随后旧指针松手仍进入
`finishIconDrag`，用不含 India 的旧 `drag.preview` 提交，导致新场景结果被删除。

原因：场景切换只在没有 `iconDrag` 时清理视觉，Reset 虽已 abort 输入，其他场景入口却保留了真实
drag 对象和 pointer capture。旧 pointerup 因此仍有提交权。

修复：所有非 Reset 场景也先调用统一输入 abort；若存在真实 drag，先恢复该手势基线，再释放 capture
和执行新场景 revision。Playwright 覆盖“真实路径预览 → Add → 旧 pointerup”，最终保持 9 个节点。

防再犯：任何能从手势外部发布布局的入口都必须先撤销当前手势的提交权；不能只处理 Reset 特例。

# #80 Widget 的编辑抖动必须包含整张卡片

现象：编辑模式下 Widget 只有时间和说明文字在抖，边框、背景与阴影保持静止，看起来像内容从卡片里
脱开，不符合苹果式“整个可编辑对象在抖动”的视觉语义。

原因：为了分离坐标与动画，把 `motion-widget-jiggle` 错挂在 `.demo-widget-face` 内容层；Widget 外框
仍是静态 positioner，因此只有内部子树旋转。

修复：Widget 继续用 `left/top` 承担坐标，但把 CSS individual `rotate` 动画挂到 `.demo-widget` 整体；
边框、背景、阴影和内容共同运动。拖动以 `is-dragging` 暂停，reduced-motion 仍关闭；Dock 钳制额外保留
2px，覆盖 rotate 后外接框比静态 `offsetHeight` 增大的部分。

防再犯：视觉对象的 jiggle 所有权应落在用户认知中的完整对象，而不是为了技术分层任意选内层；
浏览器测试同时断言外框有 animation、内容层没有独立 animation。

# #82 拖拽回归必须先证明手势真的进入 dragging

现象：最初的真实桌面 Playwright 只检查“拖到 Dock 后未保存”和“热更新后旧松手未覆盖”，在图标/Widget
根本没有开始拖动时也会得到相同终态，导致缺失手势实现仍可能假绿。

原因：测试只断言负向结果，没有在 pointerdown 后验证 `.dragging` / `.widget-dragging`、placeholder 或预览
动画等中间态；“什么都没发生”和“正确取消”无法区分。

修复：每条取消/权威中断回归先断言手势状态已经建立，再投递 move、cancel、lost capture 或热更新；Widget
让位额外断言真实图标节点存在 WAAPI animation，避免旧的直接改 left/top 实现蒙混通过。

防再犯：涉及 cancel、rollback、stale callback 的测试必须采用“三段式”断言：进入事务 → 出现临时状态 →
恢复或权威终态。只检查最后没有保存不构成有效拖拽测试。

# #83 Dock 安全余量必须在 Room 坐标与屏幕像素之间换算

现象：Widget 在 Room 逻辑坐标中与 Dock 保留 2px 后，1440×960 实际画面仍有约 0.9px 外接框侵入 Dock；
Playwright 的真实 bounding box 检查失败。

原因：Widget placement 使用 1920×1080 Room 坐标，Dock 命中来自屏幕像素；2 个逻辑像素缩放后不足
2 个屏幕像素，整卡 ±0.38° rotate 的外接框又会额外增大。

修复：Dock rect 先统一映射到 Room 坐标，生产 Widget 钳制使用 8 个逻辑像素的安全缝，再由真实 DOM
bounding box 验证旋转暂停前后的卡片均不进入 Dock。图标避让仍对 Dock reserve 额外扩张 40 逻辑像素。

防再犯：跨坐标系的安全距离必须注明单位；布局纯函数测试覆盖四个 Dock 方向，浏览器测试再用实际
`getBoundingClientRect()` 验证最终视觉边界，不能把逻辑 px 直接当 CSS px。

# #84 通用 abort 不能假定每种输入事务都有布局快照

现象：对仍处于 500ms `pressing` 的控制器调用 `abort({restore:true})`，会把已发布图标快照清成空数组；
press transaction 只有计时器和指针信息，并没有 `baseIcons`。

原因：外部 Widget 和图标拖动都带布局基线，通用 abort 因而无条件执行 `cloneIcons(transaction.baseIcons)`，
把不同状态的事务误当成同一结构。

修复：只有事务显式携带 `baseIcons` 数组时才恢复 published icons；pressing 仅清 timer 和状态。Node 回归
先进入 pressing，再 restore abort，验证原图标快照保持不变。

防再犯：状态机共享清理入口时，恢复字段必须按状态或字段存在性判断；不能用一个“最大事务结构”假定
所有状态都拥有相同快照。

# #85 reduced-motion 必须同时清除静态 transform 规则

现象：实验台开启减少动态效果后，transition 与 jiggle 虽然关闭，hover 仍保持 `scale(1.035)`，模拟拖动仍
保持 `translateY(-8px) scale(1.06)`；视觉不再过渡，但对象依然瞬间位移。

原因：reduced-motion 规则只覆盖 `animation` 和 `transition-duration`，没有覆盖由 hover/drag 选择器直接写入
的 `transform`。停止“动画过程”不等于消除“运动结果”。

修复：在页面显式开关和系统 `prefers-reduced-motion` 两条路径下，均将 icon face/visual 的装饰性 transform
置为 none，同时保留背景、阴影、命中区和名称规则。Playwright 分别覆盖 hover 与托起。

防再犯：减少动态效果测试必须读取最终 computed transform，不能只断言 transition/animation 名称为 none。

# #86 window blur 不能在捕获阶段复用指针结束处理器

现象：图标 pointerdown 后 pressed 会立刻恢复 false；隐藏名称浮层甚至在鼠标仍按住时重新出现。

原因：为处理鼠标在页面外松手，把同一个结束处理器以 capture 方式挂到 window 的 `blur`。点击图标会让
先前聚焦的设置控件失焦；该元素 blur 虽不冒泡，却会经过 window 捕获阶段，于是被误判为整个窗口失焦。

修复：pointerup/pointercancel 继续在 owning window 捕获阶段监听并按 pointerId 过滤；window blur 使用非捕获
监听，只在窗口自身失焦时结束 pressed。Playwright 覆盖按下后移出视口、松手、返回并恢复 500ms 浮层。

防再犯：窗口级 blur 与元素 blur 必须区分；若使用捕获监听，要显式验证 `event.target === window`。

# #89 图标命中区不能由名称内容决定几何

现象：打开命中区调试后，不同名称长度会产生不同宽度的绿色框；短名称框偏窄，长名称框接近上限，
命中范围看起来向文字一侧偏移，无法作为统一可管理的桌面交互规格。

原因：`.icon-face` 使用 `width: fit-content` 和 `max-width`，实际尺寸由图标、gap 和单行名称的 intrinsic
size 共同决定。虽然外层网格居中，但每个可点击对象自身的宽高并不统一。

修复：以共享 CSS 变量固定 `.icon-face` 宽高，并通过 `data-icon-hit-size` 提供 small 72×80、standard
80×84、large 84×88 三档；名称在固定框内省略，显示/隐藏不改变几何。命中框与网格间距独立，最紧凑
88px 步距搭配最大 84px 命中框仍保留 4px 间隙。

防再犯：命中区属于交互规格，不能从内容 intrinsic size 反推。测试必须逐个比较真实 bounding box、
图标与框的中心线，并覆盖最长名称、隐藏名称和最密间距组合。

# #90 固定预览属性不能常驻并冒充直接交互模式

现象：实验台虽然有“悬停 / 按下 / 编辑 / 拖动”按钮，但用户直接点击图标时像静态截图；真实 hover
和 press 没有视觉反馈，无法像 Widget 实验台那样验证手感。

原因：共享 CSS 为避免固定状态受鼠标干扰，用 `:not([data-icon-preview-state])` 保护真实 hover/press；
实验台却始终保留 `data-icon-preview-state="normal"`，等于永久关闭真实指针分支。

修复：新增默认“交互”状态并在该状态删除固定预览属性；真实 pointer 生命周期负责短按选择、500ms
长按编辑、编辑中托起/跟手/回位和双击空白退出。固定五状态仍显式写属性，仅用于诊断。

防再犯：交互实验台必须同时覆盖“真实输入路径”和“固定视觉快照”，不能让用于快照隔离的属性成为
页面默认态。Playwright 必须从真实 pointerdown/move/up 验证中间态，不只点击状态按钮。
