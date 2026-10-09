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

# #91 图标布局格与命中框不应维护两套独立矩形

现象：命中框已经统一尺寸并水平居中，但打开调试后，橙色布局 cell 仍是 88×100 / 100×112 /
120×124，绿色命中框则是 72×80 / 80×84 / 84×88；两者只能局部居中，边界永远无法重合。

原因：把“图标密度”直接建模为 cell 宽高，又单独增加命中框尺寸。一个图标因此同时拥有两套可配置
占位矩形，排序定位、点击范围和调试表达互相脱节。

修复：以单一 footprint 同时作为 `.lab-icon` 布局格和 `.icon-face` 命中边界；小/标准/大控制该矩形。
紧凑/标准/宽松仅改 footprint 之间的 column/row gap，gap 不接收指针。调试时橙绿边界四边重合。

防再犯：桌面对象只有一个占位契约，密度应表达为对象之间的间隙，而不是再造第二套对象尺寸。
浏览器测试必须直接比较布局节点与 face 的真实 x/y/width/height，并点击 gap 验证其为空白。

# #92 隐藏图标名称时 footprint 也要切换到无标签规格

现象：关闭桌面图标名称后，文字虽然消失，但 unified footprint 仍保留显示标签时的高度和宽度；视觉上只剩
56px 图标，实际可点区域却还包含一圈无意义空白，实验台尺寸读数也可能继续显示旧值。

原因：最初把 `hitTargetSize` 直接映射成唯一尺寸，`showLabels` 只控制文字可见性，没有参与 footprint 几何和
读数计算。统一布局/命中矩形后，这会把“布局稳定”误解成“隐藏内容也必须保留其空间”。

修复：每个大小档同时定义显示名称和隐藏名称两套规格：72×80 / 80×84 / 84×88 与 64×64 / 72×72 /
80×80。CSS 以 `data-icon-labels="hidden"` 切换，实验台读数由 `showLabels + hitTargetSize` 共同计算；布局格
与 face 仍共享同一矩形，gap 不变。Playwright 同时验证三档切换、真实 bounding box 和读数。

防再犯：隐藏内容时必须重新审视它占用的交互空间；若几何受两个偏好共同决定，视觉 CSS、状态读数和测试
断言必须引用同一套离散规格，不能各自缓存旧尺寸。

# #93 纯旋转 jiggle 不足以表达图标与文字的整体位移

现象：图标进入编辑模式后图形的倾斜很明显，但下方名称看起来像停在原地，用户无法确认文字是否属于同一
抖动对象。

原因：DOM 上图形和名称都在 `.icon-face` 内，浏览器双时点采样也证明文字坐标随父层变化；但关键帧只有
绕 footprint 中心的 ±3° 旋转，矩阵平移分量始终为 0，文字基线的视觉位移不够明确。

修复：仍只动画同一个 `.icon-face`，在 ±3° / 150ms 旋转两端加入 -1.5px / +1.5px 水平位移。图形、文字
和命中边框继续是刚性整体，不给子节点叠加第二套动画。Playwright 直接读取 CSSAnimation 关键帧矩阵，
同时断言角度和水平位移。

防再犯：整体动画不能只检查父节点是否存在 animation-name；需要验证最终视觉矩阵包含设计所需的旋转和
位移分量，并确认所有可见内容仍由同一运动节点承载。

纠正（2026-09-20）：用户后续明确“图标文字不抖”是要求名称保持静止，并不是反馈名称没有跟随。上述
“整体运动”修复基于语义误解，已由最终方案取代：编辑 jiggle 只放在 `.icon-visual`，使用 ±3° / 150ms
纯旋转；`.icon-face` 和 `.icon-label` 的 animation-name 均为 none。拖动仍由 face 整体托起，reduced-motion
继续关闭 visual 动画。防再犯时应先把“没有抖”与“不要抖”复述成肯定句，再决定运动节点。

# #95 共享 Glyph 渐变必须读取真实桌面的颜色变量

现象：图标实验台中的 Glyph 保持各自颜色，接入真实桌面后，无 PNG 的应用图标却可能全部变成共享 CSS
默认的蓝色渐变；节点、尺寸和交互测试仍会通过。

原因：共享 `.icon-glyph` 用 `--icon-color` 生成渐变，实验台直接写该变量；真实桌面的旧实现只更新
`backgroundColor`。CSS `background` 渐变继续使用默认变量，内联背景色不会替换渐变图层。

修复：创建和热更新真实 Glyph 时同时写入 `--icon-color`，并由真实 Room Playwright 断言自定义属性保持
Room 图标颜色。

防再犯：共享视觉模块引入 CSS 自定义属性后，生产节点构造器必须显式映射同一契约；视觉回归不能只验证
DOM 分层和几何，还要覆盖至少一个来自真实数据的主题色值。

# #96 reduced-motion 不能清除拖动所需的指针位移

现象：Windows 开启减少动态效果后，图标仍能提交排序，但拖动中的真实图标停在原位，仅占位与其他图标
变化，手势反馈像“隔空拖动”。

原因：共享 reduced-motion 规则把 `.icon-face` 的所有 transform 强制为 none；该层不仅承载装饰性的托起
和缩放，也承载控制器计算的实时 pointer translate，导致必要位移被一并清除。

修复：控制器在 reduced-motion 下仍输出 pointer translate，但将托起偏移归零、scale 固定为 1；共享 CSS
只清除 `.icon-visual` 的装饰 transform，并仅对实验台模拟卡片清除 face transform。Node 与真实 Room 测试
分别验证内联 `scale(1)` 和 computed transform 仍有位移。

防再犯：减少动态效果应区分“交互所需的位置反馈”和“装饰性运动”；不能用一个宽泛的
`transform: none !important` 同时覆盖两类职责。

# #97 生产 Room 的启动资源必须位于 WebView2 映射目录内

现象：图标实验台和 Vite 下的真实 Room 测试全部通过，但正式 Player 里桌面只剩黑底与静态 Dock 箭头；
背景、图标、Widget 和 Desk 指示器都没有初始化。

原因：WebView2 Player 会把 `index.html` 所在的 `wallpapers/dext-room` 单独映射为本地虚拟主机根目录。
生产页面使用 `../dext-icon-feedback/icon-feedback.js` 和 `.css` 时，Vite 能访问仓库兄弟目录，但虚拟主机
只会在映射根目录内解析该 URL，资源不存在。随后 `main.js` 检测不到 `DextIconFeedback` 并在首次
`renderDesk()` 前中止，形成“骨架存在、内容全黑”的假象。

修复：把唯一共享 `icon-feedback.js/.css` 收进生产 `dext-room`，生产页面使用同目录相对路径；浏览器
实验台和 Node 测试反向引用生产文件，继续保持单一实现。新增 Playwright 边界场景，阻断
`/wallpapers/dext-room/` 之外的全部请求，确认仅暴露生产映射目录时仍能完成启动和图标渲染。

防再犯：官方 Room 的 boot-critical HTML、JS、CSS 必须自包含于 Player 映射目录。浏览器实验台可引用
生产资源，但生产页面不得依赖实验台或仓库兄弟目录；Vite 全仓库服务不能替代虚拟主机边界回归。

# #98 长按进入编辑必须把同一 pointer 交接给拖动事务

现象：真实桌面长按图标后会进入编辑并出现托起感，但继续移动无法排序；松手后图标立即回到原位。
只有先松手、再第二次按住图标才能拖动。

原因：长按计时到点时，控制器先把 `pressing` 状态和 transaction 清成 `idle`，再请求进入编辑。
仍按住的原始 pointer 因此失去归属；后续 `pointermove` 在 idle 状态被忽略，`pointerup` 也没有可提交事务。
既有测试先长按并松手，再启动第二段拖动，恰好绕过了这条连续手势路径。

修复：长按回调先同步进入编辑，再把原 transaction 的 pointerId、起点和节点直接交给
`_startIconDrag()`，状态从 pressing 连续变成 draggingIcon。若进入编辑期间事务已被权威更新或 abort
撤销，则守卫阻止旧回调复活。Node 和真实 Room Playwright 均覆盖同一 pointer 长按、跨格、80ms
占位和单次保存。

防再犯：长按不是一个需要结束的独立点击，而是拖动手势的前半段；测试必须至少保留一条
pointerdown → dwell → pointermove → pointerup 全程不松手的真实序列，不能只覆盖“先进入编辑再拖”。

纠正（2026-09-21）：真实桌面连续操作表明这条修复本身引入了更差的手势模型。用户要求回到最早已验收的
Sortable：长按只进入编辑，松手后再次按下拖动。#99 记录最终根因与替代方案，本节保留为历史错误路径。

# #99 不要把长按续拖、原格锚定和候选延迟叠加到已验收 Sortable

现象：真实桌面十余次尝试只有少数能拖起；拖到其他位置尚未松手时，被拖图标与让位预览会跳；双击某些
空白层也无法退出编辑。浏览器自动测试仍然全绿。

原因：生产控制器后来同时引入了三项实验台没有的行为：长按计时到点把同一 pointer 强行交给拖动、把被拖
图标外层固定在源格、目标格再等待 80ms 才更新。最早通过人工验收的 `2694f0d` 实际是两段式手势，跨格
立即求解，并让被拖外层落目标格、face 根据当前外层矩形反向补偿到指针下。后续测试断言了新实现本身，
因此无法发现运动模型已经偏离验收基线；空白退出又只在冒泡阶段监听 document，可能被中间桌面层截断。

修复：按历史提交逐段恢复已验收模型：300ms 长按只进入编辑并结束 pressing；编辑态下一次 pointerdown
开始拖动；跨格同步求解并展示 placeholder；motion 立即写被拖外层最终 left/top，排除其 FLIP，face 用
当前 node rect 计算补偿保持在指针下。document 的空白双击改为捕获阶段，仍排除图标、Widget、iframe、
Dock 和控件。Node 与真实 Room Playwright 先分别在“仍等待 80ms / 仍续接长按 / 冒泡被拦截”处失败，
再转绿；连续 12 次往返拖动使用每轮真实目标图标中心，不再用会跑出网格的固定屏幕坐标。

防再犯：用户已经验收过交互实验台时，真实集成应保持它的输入事务和坐标职责，不要只复用视觉参数。
自动测试必须断言用户可观察的基线（长按后未 dragging、跨格立即占位、外层目标格、face 指针中心），
不能把后来新增的实现细节当成需求。

# #100 Chromium 自动化不能替代 WorkerW/WebView2 真实指针验收

现象：生产图标拖动先后经历同 pointer 续拖、恢复两段式 Sortable 和立即跨格占位等三轮修正；每轮 Node 与
Playwright 都全绿，但真实 WorkerW/WebView2 中仍表现为几乎无法拖动或拖动中乱跳，而同页面的 Widget
拖动正常。

原因边界：自动化运行在 Chromium 页面环境，没有覆盖 WorkerW 承载、WebView2 指针捕获和实际桌面输入链。
现有证据只能确认 DOM/控制器在测试环境中的行为，不能据此认定真实宿主事件流正常；本轮没有采到足以
定位具体丢失环节的 WebView2 事件轨迹，因此不得把某个 timer、阈值或坐标换算继续宣称为根因。

处理：停止在失败集成上继续叠加局部补丁，把生产 `dext-room` 的 HTML、主脚本、控制器和真实 Room 回归
作为一个边界整体恢复到已验收的 DESK-MOTION 提交 `64af642`。浏览器图标实验台、共享视觉模块以及全局
偏好保存/投递代码保留，但生产 Room 暂不消费这些偏好，待另开真实宿主输入诊断后再重新集成。

防再犯：涉及桌面 pointer capture、WorkerW 或 WebView2 的手势，Chromium 自动测试只能作为回归门槛之一；
必须在真实桌面重复拖放通过后才能宣布生产交互完成。连续三次“自动化绿、实机红”时应回退完整交互边界，
下一轮先记录真实 `pointerdown/move/up/cancel/lostpointercapture` 序列，再决定修改位置。

# #101 回退旧手势时必须验证绑定点，不只检查函数是否还在

现象：把生产 Room 回退到 `64af642` 的父提交 `b8b00f0` 后，源码中仍能找到完整的
`attachPress()` 和 `startDrag()`，但编辑态第二次按下时图标仍完全不跟随，表现与真实桌面一致。

原因：`b8b00f0` 用节点协调器重写 `renderIcons()` 时删除了旧实现中的 `attachPress(el, i)` 调用，却没有
同步删除两个旧函数。它们因此成为外观完整但没有任何调用方的死代码；只按函数名或提交位置判断“旧逻辑
仍在”会选错回退点。最后一个真正绑定旧手势的提交是 `15147f2`。

处理：新增真实 pointer Playwright 回归，要求进入编辑后第二次按下能让图标在 pointerup 前实时移动，松手
后交换两个格子。该回归在 `b8b00f0` 上先失败，生产 `index.html/main.js/style.css` 恢复到 `15147f2` 并移除
未使用的桌面控制器后转绿；布局/动画引擎和两个浏览器实验台继续保留当前实现。

防再犯：回退交互不能只比较定义，必须同时检查 DOM 创建处的绑定调用，并用真实指针序列验证
`pointerdown → pointermove（对象已移动）→ pointerup（数据已提交）`。若旧函数没有调用方，应继续向前
查找最后一个实际可执行提交。

# #102 图标实验台不可覆盖生产共享间距变量

现象：收紧生产共享模块的三档间距后，配置器与真实 Room 的格距变化，但浏览器实验台的图标 pitch 仍是旧
`100px`；实验台读数也继续显示旧的 `20×28px`。

原因：实验台 `style.css` 按 `data-icon-spacing` 再定义一套 `--dext-icon-column-gap/row-gap`，比共享 CSS
选择器更具体；`lab.js` 也硬编码了第二套文本。跨端几何一致性单元测试没有覆盖实验台自己的 CSS 覆盖。

修复：删除实验台的间距变量覆盖，读数由生产 `resolveDesktopIconGeometry()` 生成；三档实际 pitch 和
读数的 Playwright 用手算尺寸先红后绿。配置器与生产 Room 的几何常量仍按同一值维护并交叉验证。

防再犯：实验台可以定义容器排布，但不能重新定义要预览的生产参数；修改档位时同时检验真实 DOM pitch、
共享几何和配置器投影，而不只看 dataset 是否切换。

# #108 深拷贝不能把可选 launch 变成空对象

现象：路径排序对旧 Glyph/action 图标提交后，内存中的图标被补上 `launch: {}`；Room v2 Schema 要求一旦存在 `launch` 就必须有 target、args 和 workdir，后续保存会产生非法 Room。

原因：通用 `cloneIcons()` 无条件执行 `{ launch: { ...icon.launch } }`。JavaScript 展开 `undefined` 不报错，却创建了一个原数据不存在的空对象。

修复：只在 `launch` 确实是对象时深拷贝它，否则保持字段原始缺失形态；纯事务 Node 测试和隔离 Player 保存探针都验证 Glyph 图标仍不含 `launch`。

防再犯：复制带可选嵌套字段的 Schema 对象时必须同时保留“字段缺失”语义；测试不仅比较值，也用 `Object.hasOwn` 和最终序列化消息检查字段形状。
# #121 页面视觉 Room 未加载完就附加 v3 会话

现象：Player 已发 `msg_wploaded`，Core 立即送初始 v3 快照，但页面的异步 `room.json` 读取随后把当前 Desk 重新设为 v2 起始 Desk；表面上 Core 已激活，实际画面可能回退。

原因：`msg_wploaded` 表示 WebView 导航完成，不表示 `loadRoom()` 的异步数据和节点已构建。

修复：官方页面在 `loadRoom()` 结束后再发 `dext:v3-page-ready`；Core 只在这个消息与 `msg_wploaded` 均到达后附加 Player 并发送完整快照。真实样包切页和重启恢复已验证。

## #134 消费者重报同一几何触发循环（2026-10-03）

P5每次接受按钮几何都会通知全部消费者新版本；若监听者重报同一矩形，旧实现再次递增版本并重新通知，可能形成跨组件消息环。新增生产模型回归实际RED（重复报告产生invalidateInput/applyGeometry/notifyGeometry）后，规范化几何并比较有效值；不变报告返回accepted、无effects、版本不动。28/28模型与SDK通过，真实DOM适配随后验证。resize仍先失效旧输入，变化报告正常更新。

## #135 SDK就绪与销毁重入（2026-10-03）

初始化期间作者监听可立即dispose，旧代码继续回放并发ready；已resolve的ready Promise又让销毁后的ready()返回旧实例。生产SDK回归初始回放11/13与销毁ready13/14实际失败后，所有回放/事件分支检查disposed，ready()再次调用明确拒绝，移除监听并释放所有pending/订阅。最终SDK14/14、模型14/14通过。token不公开，旧session不能重新初始化。

## #160 旧play Promise不能暂停后来的播放意图（2026-10-03）

媒体宿主暂停→恢复两次，旧play Promise迟到完成时，初版用playEpoch不同就pause，误停已恢复的新播放。生产回归实际11/12失败（pause次数3，期望2）。完成回调只在当前实例确实不应播放时pause；迟到失败诊断仍要求匹配当前playEpoch，避免旧拒绝覆盖新成功。最终12/12通过；真实ReleasePlayer验证相同生产脚本的解码、暂停后继续前进及持续节点。异步结果应收敛到当前播放意图，不把旧操作过期等同当前需要暂停。

## #162 输入不可操作不等于播放暂停（2026-10-03）

runtime-model曾把desktopActive写成playing且desktop且operable。正常Core过渡仍允许排队；实际问题是仅失焦关闭输入就暂停场景、共享组件和背景。新增生产回归实际RED（suspended而非active），移除输入operable条件，渲染仍受active/stage/playbackPaused/locked控制；15/15通过。动作权限继续由Core逐次核验，不以渲染活动推断输入授权。

## #163 订阅失败必须在关闭provider前发送读数错误（2026-10-03）

frame-host异步subscribeData拒绝时先删除provider，再调用emit。emit为防迟到数据要求provider仍匹配，因此作者收不到error，读数状态留在旧值。完整生产SDK回归实际12/13失败；先发送有界error再关闭provider，13/13通过。停止订阅后的迟到值仍被拒绝，静态外框保留。

## #171 官方页先校验完整transition再占修订（2026-10-03）

新main只检查身份/revision/lifecycle，畸形无target却带transition/deadline的revision5先写主缓存，虽然下层模型拒绝，随后合法revision2仍被主层判旧。实际单位回归5!=1失败；主层补target-null与transition/deadline一致性及有限日期校验，在缓存前拒绝。后续合法revision2可用，真实正式页Player回归保持通过。

## #172 几何发布要处理生产Core忙状态（2026-10-03）

Core的TryWithActionContext不等待授权网关，竞争返回staleInput；宿主单次失败后inputReady=false，若作者重报同几何又无模型effects就可能一直关输入。单位按既有协议模拟第一发布staleInput，实际1!=2失败。最多8次50ms间隔重试，每次递增私有inputVersion；新epoch/暂停/销毁取消等待，身份变化拒绝旧回包。回归和最新真实整页Player通过；这不代表完整物理输入/DPI或移动中命中已验收。


## #177 迟到play事件不能恢复已被作者pause清除的意图（2026-10-03）

媒体播放事件异步排队；作者play后pause，迟到play/playing若无条件设wanted=true，下一次宿主恢复会误播。定向RED确实失败；捕获原始paused getter，只在当前元素仍实际播放时从事件建立意图，已暂停的迟到事件不改wanted。政策10/10与真实作者暂停→原生挂起/恢复通过。

## #178 权限失败回调必须先验证当前查询作用域（2026-10-03）

真实Core切页取消旧capabilities请求，frame-host成功回调检查epoch/query/scope，失败回调却先写permissionsUnavailable。旧修订和已销毁文档的失败都会污染当前诊断。两个定向RED后统一current守卫，超时/同步失败/Promise失败仅在当前活文档、当前查询、当前scope下诊断和收敛。当前真实故障仍报告，旧取消不复活状态。

## #179 推进原生身份必须早于新快照的iframe授权查询（2026-10-03）

只修#178后真实Core仍报告permissionsUnavailable。dom-host.acceptSnapshot先frames.acceptSnapshot，再进入render推进native identity；frame更新同步发新revision的授权请求，native-host仍用旧revision，立即返回staleInput，此时查询本身却是当前的。使用生产native-host的定向RED复现accepted/staleInput，先native.acceptIdentity再更新frame后GREEN。完整JS105/105和真实Corehome→focus revision2→4、同文档/解码视频/无frameError通过。原生作用域推进后旧查询取消必须搭配#178当前检查，不应靠忽略所有授权错误掩盖顺序缺陷。

## #180 WebAudio方法借用须拒绝未跟踪上下文和硬件目的端（2026-10-03）

保护本realm AudioContext/AudioNode原型仍不足：作者可以把保护方法call到别的realm创建的上下文或硬件destination。生产JS行为RED复现未拒绝借用。捕获原生destination最大声道品牌getter，实时context必须存在本政策WeakMap；硬件目的端必须有本document私有闸门，未跟踪者InvalidAccessError，普通AudioNode/AudioParam连接保留。实际blank-child试验由沙箱SecurityError先行拒绝，不能将它误记为品牌守卫路径执行证据；新守卫直接由生产JS行为测试覆盖。

## #181 捕获原始Array方法不能保护私有记录（2026-10-03）

政策预先捕获Array.push/splice，作者后来仍可在Array.prototype安装数字索引setter，push的继承Set将私有context/Gain记录作为参数暴露；splice删除项还会调用作者Array species，Proxy defineProperty观察删除记录。两项实际RED取得私有对象。私有数组改用捕获Object.defineProperty逐个建立自有dense索引和手动移动/删除，从不调用作者Array方法或species；适用于媒体/上下文/observer列表和私有连接参数。最新生产JS与实际ReleasePlayer攻击回归未取得记录。

## #182 私有JSON回执要避开继承toJSON（2026-10-03）

WebView2 ExecuteScript序列化返回对象会调用Object.prototype.toJSON。普通私有receipt原先可让作者看到documentNonce/sequence甚至伪造settled=true，绕过异步挂起屏障。生产RED确实拦截一次。receipt改用捕获Object.create(null)并写自身字段，作者原型方法无参与；生产组合116/116及实际Player持续安装恶意Object.toJSON后的拦截次数0。公开JSON可按作者行为处理，私有执行参数/回执不能含作者可接管的原型序列化路径。

## #197 GIF暂停必须验证真实画面，WebView睡眠与静帧各有边界
- 2026-10-03，task4-lifecycle-gif-visual实际Core/ReleasePlayer中原生暂停receipt为true但owned全屏Player中心OS像素仍连续变化。GIF是img，media-host并不控制它；旧GPU debugger调用不保证冻结。不能由自然尺寸或start预算宣称GIF画面已暂停。
- Native Player在媒体/官方宿主暂停屏障后CapturePreview当前WebView到一张内存Bitmap，以原生PictureBox显示，隐藏WebView后TrySuspendAsync；使用三秒有界等待，当前代次失败正常关闭自己的Player，交由Core有界故障恢复。resume先CoreWebView2.Resume、最新Core事实及媒体策略，再显示原WebView并释放Bitmap。串行渲染操作与playbackRevision拒绝迟到步骤。作者没有截图入口，图像不落盘。
- 第一次修复重测仍过早：私有JS paused receipt早于异步静帧完成，立即采样可能跨越准备期。探针须等待本Player实际可见的原生静帧窗口；task4-lifecycle-gif-barrier完整通过，播放/暂停/恢复10次OS中心像素分别变化/单色/变化，同文档/实例。此为Windows采样自动证明，实际锁屏/多DPI/用户视觉门槛仍最终集中验收。
- 新Player文件使用显式Compile列表与C#8；忘加文件/使用文件范围namespace的两次编译错误分别纠正，不把它们计生产RED。不要更改产品语言版本来迎合新文件语法。
- WebView官方IsVisible=false要求与best-effort说明：[TrySuspendAsync](https://learn.microsoft.com/dotnet/api/microsoft.web.webview2.core.corewebview2.trysuspendasync)。[HTML Canvas规范](https://html.spec.whatwg.org/multipage/canvas.html)的drawImage针对animated img仅取默认/首帧，不能拿它伪造“当前GIF帧”的冻结；使用本WebView的CapturePreview。

## #198 暂停必须核对原生controller的可见状态（2026-10-03）
实际ReleasePlayer接线回归中，managed control=False/controller=True，TrySuspendAsync报COM 0x8007139F并走当前暂停失败关闭。SDK包装提示“disposed”不能据此认定控件真的被销毁；原生错误与本次布尔诊断符合ERROR_INVALID_STATE/IsVisible要求。外部父窗和样式操作是否造成初始不一致仍是推断。
复用当前固定WinForms SDK初始化RasterizationScale已使用的controller字段，在静帧可见并隐藏managed控件后明确controller.IsVisible=false且复核，再有界TrySuspend；恢复按当前revision同步两者可见后释放静帧。保留串行门、三秒界限、迟到拒绝和失败关闭自己的Player，不放宽生产暂停策略。新增私有IPC日志只报告原生渲染完成，不含截图或个人布局。
官方约束：[TrySuspendAsync](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.trysuspendasync)；同错误的厂商追踪：[WebView2Feedback #2398](https://github.com/MicrosoftEdge/WebView2Feedback/issues/2398)。

## #200 显式损坏覆盖与缺少覆盖应区分（2026-10-03）
新纯布局模块初版把非对象的已保存图标位置当作缺少位置，实际行为回归20/21失败。使用自有ID是否存在来区分，存在却无效必须拒绝，不静默回退作者默认；缺少覆盖才用默认格子。修复后21/21。Core严格持久校验与私有native回复仍是前置边界，纯视图层也不吞损坏输入。

## #202 几何裁剪舍入与SVG焦点隐藏（2026-10-03）
纯geometry首次18项中2项失败，轴向交点插值产生负坐标/极薄假片；将轴向交点固定到精确裁剪线，并在叉积误差界中计入坐标相减舍入，补斜向/多遮挡后20/20。误差界按机器epsilon，不加CSS像素命中padding；Core C#的machine epsilon为2.2204460492503131e-16，不是double.Epsilon。
SVGElement不能只靠HTMLElement式hidden属性假设隐藏；官方焦点显式设置/移除hidden attribute，清空polygon并加pointer-events:none，避免焦点轮廓残留或截获指针。实际ReleasePlayer轮廓验证仍需本阶段wire证据。

## #204 跨文档getter不能返回隐藏输入wrapper（2026-10-03）
两个已注入guardian的同源文档各自有originals WeakMap；子文档的patched onclick getter借到父DOM上时，原生getter取到父wrapper，子WeakMap不认识而将wrapper直接返回。真实Chromium中，在可信callback后的queueMicrotask用缓存真实Event重调该wrapper，eventPhase仍有效，实际再次生成见证。guardian-browser-cross-realm-red.log明确复现；一般timer/缓存original callback单位测试不能覆盖这个边界。
捕获Node.ownerDocument并固定实际document/root；DOM属性getter/setter、事件注册/移除/dispatch、attribute和attachShadow先核对真正文档，foreign DOM抛SecurityError，不能读作者覆写的ownerDocument。generic非DOM EventTarget仍由捕获的原生方法核验brand，不提供callback获取。对应pure行为RED/GREEN和实际组合跨realm GREEN见当前验收卡，不借sandbox偶然拒绝代替guard本身的边界。

## #205 RegExp.test会动态调用RegExp.exec（2026-10-03）
仅预捕获RegExp.prototype.test不足以固定验证行为；其内置算法仍调用当前pattern.exec，作者覆盖RegExp.prototype.exec可改变匹配。guardian原语篡改行为测试实际失败。改捕获exec直接执行，同时捕获String.substring/Number.isFinite/整数上限，私有回调记录用自有dense索引，receipt/witness采用null-prototype，禁止原型toJSON、数字setter、species参与私有记录。宿主测试自己的sent.push被数字setter看到不等于生产泄漏，需按真实原生传输边界修夹具并保留失败来源。

## #207 原生Window默认receiver、onerror参数与收养节点派发（2026-10-04）
新增输入guardian的包装不能改变原生Window裸调用：native add/remove/dispatch的undefined/null receiver映射当前Window；DOM属性getter仍按实际文档品牌核对。function listener必须保留原生全部参数，尤其Window.onerror(message,source,lineno,colno,error)，object handleEvent仍按标准传Event。
节点跨文档收养会让旧document wrapper在新document派发。真实child click复现父输入见证被借用后，包装和见证发送同时核对captured Event.currentTarget、callback receiver与实际文档；未知foreign Function属性getter禁止暴露私有wrapper，已知作者callback保持读取原值。生产单测先21/24失败后24/24，最新Chromium40与实际ReleasePlayer正式文档/媒体初始化通过。第一次onerror断言在前项失败后未执行，不能把未执行项当实机RED。此修复只闭合模块边界，Core/SDK原生手势接线仍待完成。

## #211 非激活Player键盘需原生controller焦点再路由frame（2026-10-04）
实际ReleasePlayer保留WS_EX_NOACTIVATE。私有frame arm成功后仅captured Window.focus，或先WinForms webView.Focus，Own-HWND Enter检查都没有keydown，不能把私有回执armed当作键盘已到作者文档。复用固定SDK已有NativeViewController，调用MoveFocus(Programmatic)，随后对选中直接root执行captured Window.focus，再发真实Win32键。Enter/Space/鼠标正式SDK wire均收到isTrusted DOWN/UP与一次正数请求，检查前台HWND不变，不伪造JS事件。该检查的Core包/回执仍为fixture，完整Core实际桌面OS验收不能打勾。
MoveFocus官方语义为将焦点移入WebView并恢复先前/默认文档元素：[Microsoft WebView2 Controller](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2controller)。这里使用Programmatic，不代替Core受控Tab焦点，也不逐个focus作者DOM节点。生产文件首次C# pattern局部focus重复名导致CS0136，改releasedFocus后完整构建通过；探针替换Console.WriteLine时以首分号切片遇到字符串内部分号，修正精确锚点后才取得运行证据。

## #212 归一化采样宽度的浮点断言（2026-10-04）
移动前层把200px Widget裁到40px时，DOM normalized width按right-x得到0.020833333333333315，而测试40/1920为0.020833333333333332，45/46失败。几何本身位置正确；断言改为32*Number.EPSILON机器误差界，生产裁剪和Native验证均未增像素padding。新的readInputSample读已绘制矩阵、不通过估算下一帧位置判断命中；此阶段只是基础，不当作实际Player/Core点击接线通过。

## #215 SVG焦点不能沿旧边界坐标停留（2026-10-04）
正式DOM以前只在Core focus event画一次inputEntries里的多边形，默认动画随后只移动图标/Widget。源和目标真实行为新增2项均RED（50/52），轮廓的points保持旧值。
将逻辑focus与SVG绘制分开，每个默认动画绘制帧按当前已绘制可见区域更新轮廓；移出画布/被遮挡隐藏，但不丢逻辑entry；commit/geometry失效/暂停仍清空。必要DOM52/52，实际ReleasePlayer移动source的points随RAF变化、出画布隐藏、geometry版本/请求数和动作数不增加；不靠逐帧IPC或扩大命中区域修复。
Tab的单次可见查询不等于动作proof，也不证明快速连续键序列已收口；当前Core单gesture覆盖语义的连续Tab/立即激活仲裁继续。

## #217 作者纯矩阵逐帧重发几何并清焦点（2026-10-04）
原acceptGeometry对groups/opacity变化总是递增geometryVersion，DOM随即render→invalidateGeometry/geometry并清focus、释放native hold。生产行为RED67/70：连续视觉帧失去原版本和焦点，保持中第二份报告因版本推进被拒。
仅按钮/占用等结构改变才产生invalidateInput/applyGeometry；纯groups产生applyVisualGroups，Widget/图标/焦点同次本地绘制。native hold存最新待矩阵，匹配end后应用；结构/快照/暂停/销毁丢旧待帧。旧断言改读当前物理样本，空同状态修订本来保留模型groups，失效夹具使用真实生命周期变化。GREEN86/86。
相邻功能发现：普通图标在无转场时错误使用shared矩阵，仪表盘缩放会带走当前Desk入口。新增独立RED后改为source组，shared继续控制共享呈现；透明共享Dock恢复下方独立图标输入，必要87/87。实际ReleasePlayer作者仪表盘/普通图标/焦点、本地无逐帧Core几何与原默认输入回归通过；真实Core OS/DPI最终门槛仍未代填。

## #219 作者应从有效矩形映射到目标呈现（2026-10-04）
640×480/scale1.5实际窗口的CSS小视口按既定布局规则保留像素尺寸、移位/缩放组件，作者固定原始y800矩阵再次叠加后把仪表盘移出画布。设计基准通过无法证明响应式。SDK只读placements提供当前可见组矩阵前有效矩形；Scene读集合、其他消费者自身，内部逻辑视口仍固定。三个功能RED后108/108；样包以有效矩形映射至期望底部/整页，实际小窗口展开及放大缩回通过。
同geometryVersion的有效投影变化也需通知，完全相同不重复；纯视觉帧不通知。作者async publish未完成时geometry/resize仍须保留dirty待绘制，finally再安排一帧，避免稳定Desk改变有效布局后丢重绘。矩阵限幅保持，物理DPI与完整Core OS门槛另行验证。

## 224. 持续样包图标ID在两个Desk重复
- 现象：新P6 worktree运行正式Rust契约的样包检查，v3-continuous报duplicate icon id；两Desk都使用view。
- 修复：保留overview/view，detail图标改detail-view；按钮navigate仍共用，符合两种呈现关联同一按钮的既有契约。正式Rust全套34/34通过。
- 防再犯：样包不能只跑渲染模型；更新后也运行真实作者Manifest校验。公开按钮可复用，图标呈现ID必须按契约唯一。

## #228 Dock模板占用不能误用Scene的occupied权限（2026-10-04）
现象：P6模板计划把Dock按钮与占用一起发布，但正式runtime只允许scene交occupied/groups；未保留固定Dock框时，本地图标/Widget会与Dock重叠（新增功能检查实际RED）。
原因：把roomScene布局接口与Dock组件按钮接口合并理解；旧精确遮挡夹具也故意用静止Dock盖图标，不能代表应有布局。
修复：模板只报buttons，官方宿主按当前Desk引用的Dock placement加入保留区。不引用的Desk恢复保存位置。精确遮挡检查保留，通过作者shared矩阵把原本不重叠的Dock移到图标上，再读取当前可见采样，继续验证两片/全遮挡；新避让检查与DOM57/57通过。
下次：先核对consumer准入范围；作者矩形为组件自身逻辑坐标，Dock不新增占用发布权限。

## #232 视觉定位不能误用桌面动作可操作条件（2026-10-04）
Core定位accepted/投影真实送达，但配置器前台operable=false，buttonGeometry返回空，图标换肤正常而无提示。新增该状态功能RED定位null，保留原动作几何条件，抽取visibleButtonGeometry仅用于视觉提示；GREEN同时确认动作采样仍为空。暂停/锁屏/非Desktop仍不定位，不产生动作/证明。用户随后全屏游戏，立即退出Dext；最后修复的实际定位/普通重启待继续，不将旧accepted或fixture冒称实机成功。

## #238 顶层Dock初次隐藏需同步原生HWND状态（2026-10-04）
源码核对发现：原型在Form.Shown后创建窗口行为，logical visible初始false，但HWND实际已在屏外显示。直接布局移动后，autohide或已有全屏时next=false与缓存相同，UpdateVisibility提前返回，会把实际可见窗口留在主屏。现在AssignHandle后先SWP_HIDEWINDOW/NOACTIVATE，再布局并统一显示策略；实际原生运行仍待游戏结束，未虚构故障复现或修复通过。DPI默认处理还可能改变实际矩形，布局比较用GetWindowRect；首次跨DPI重排，ABM_REMOVE后的工作区用GetMonitorInfo即时读回。原生透明框HRESULT仅说明API调用，不证明WebView/背景透出，验收仍看实际普通软件。

## #241 独立Dock不能压缩整Room或提前冒报窗口可用（2026-10-05）
源码接线发现：复用整桌面宿主会把Scene/图标与桌面暂停规则带入Dock；仅缩小viewport又可能低于既有64px校验或令作者按钮几何失配。Dock视图现在只呈现正式dockComponentId，保持作者组件逻辑画布，通过有效矩形映射到宿主，Dock高度允许48 DIP，官方键盘控件进入遮挡；桌面过渡完成仍由桌面视图负责。
原生宿主还须区分rendererReady与真实输入已连接，并等待媒体/可见性同步后才报WindowReady。当前Core实际OS输入未接，策略为false、状态awaitingInput、窗口保持隐藏，不能用进程存在或偏好enabled代填成功。以上为源码发现与处理，仅语法/XML/差异检查通过，真实Windows/DPI/输入尚未验证。

## #242 原生Dock自然输入不能与Core转发重复；暂停桌面不应卡住Dock导航（2026-10-05）
源码接线发现：原生顶层WebView会自然收到输入，既有Core私有链又会转发同一边沿。Dock专用预装门控现在在样本准备后允许一次对应边沿及一次click，阻止未准备和重复边沿；桌面默认不开该门控。外围按键只记录本地held，避免误清空闲Dock几何；触边刷新避开未完成的鼠标/键盘动作，鼠标准入读取真实Dock HWND而非要求桌面前台。
同一次接线发现kernel普通Request在桌面不可操作时只排队，Dock普通软件前导航会等桌面恢复。已消费真实输入的Dock内部请求现在先持久化并直接提交Desk，保留原播放/前台事实，锁屏和非Desktop阶段仍拒绝；旧过渡完成不再匹配。以上为源码处理，只有JS语法/diff检查，不宣称C#编译或真实Windows点击/导航已通过，实际门槛集中游戏后执行。
