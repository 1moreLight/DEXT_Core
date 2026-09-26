# Room v3 开发想法与实现路径

> 更新日期：2026-09-25。状态：设计研究，尚未形成正式 v3 契约或开发工作包。
> “实现路径”是基于现有 v2 代码和公开 Windows 接口的候选方案，尚未经 v3 原型与真机验收。当前正式契约仍以 v2 文档为准；本轮只完善设计文档。
> 第二轮复核、代码证据、构建难度和预计问题见 [V3_FEASIBILITY.md](V3_FEASIBILITY.md)。该复核特别补充了全屏检测复用边界、可信输入、授权内容版本和透明/穿透/材质的区别。

## 想达到的体验

用户可以借助自己选择的 AI 工具，按喜好创作壁纸的画面和交互形式，并能在 Dext 中预览、调整和使用。v3 希望把壁纸创作统一到开放的 HTML/CSS/JS 形式，让作品更容易理解、管理、修改和分享。这里的“开放”指作者能直接编辑作品文件；Dext 仍负责 Windows 集成、权限、应用启动、Desk 状态和本机数据。

2026-09-25 用户进一步强调：v3 整体朝网页创作方式发展，作者应能自由画按钮、图标及其他画面元素；原有默认桌面只是其中一种呈现。占用区是否改用更直观的“图层”概念来设计，仍在讨论。

2026-09-26 用户提出更大调整：应用图标也应进入统一的 HTML 场景，图片/视频壁纸作为 HTML 素材，底层桌面运行逻辑整体朝网页方向设计，支持一张页面内连贯的 Desk 视角变化。现有 v2 图标本就由官方 HTML 绘制，但它与作者背景 iframe 分离、切页会重挂；v3 讨论的实际变化是**统一作者场景、Dext 图标和过渡的视觉运行契约**。作者对图标 DOM 的控制程度与权限隔离尚未决定；详见 [V3_RUNTIME_MODEL.md](V3_RUNTIME_MODEL.md)。

2026-09-26 用户继续明确：默认应用图标、可换肤/自绘的图标，以及壁纸上作者画的启动按钮都应纳入“交互层”。同一个本机应用目标可通过“图标 + 目标”和“画面按钮 + 目标”同时呈现；Word 按钮是使用者将作者留下的入口绑定到自己本机 Word 的例子。这里的“路径”指 Dext 本机持有的启动信息，**不随 Room 分享，也不直接暴露给作者 HTML**。情景化背景可预留多个可配置按钮，使用者还可在更上方放普通图标。两者都是交互内容，但视觉上分处不同深度；按钮的保留区域阻止普通图标/Widget 占据。具体编辑控件与位置保存规则仍待讨论。

不能只以“界面改用 HTML”作为完成标准。还需要清楚的作品格式、受控能力接口，以及导入、预览、发现问题、修改、再预览的创作闭环。是否在 Dext 内置 AI 创作入口尚未决定；外部 AI 生成作品文件夹、导入 Dext 是目前倾向的起点。

## 已明确的设计方向

- **Room 作品由多个 HTML 页面或组件组成。** 作者可直接编辑 Desk 背景、常驻界面、Dock、切页按钮、仪表和效果；同一作品可以共用素材和代码，不要求所有内容塞进一个 `main.html`。
  - **实现路径（候选）：**定义 v3 作品清单，列出可选 Room 入口、各 Desk 入口、可复用组件、start/switch/idle 入口和离线素材。画面和交互使用 HTML/CSS/JS，图片与视频作为素材引用；清单只描述入口、资源、能力与绑定，不强迫作者编辑一整份庞大的 JSON。沿现有 [v2 契约](../room-v2.schema.json)、[Rust 校验/应用链](../tauri-ui/src-tauri/src/lib.rs)和 [Creator Pack](../creator-kit/)另建 v3 验证、导入、预览和分享链；避免把 v2 字段直接扩成长期混合格式。
  - **代码落点：**`validate_room_contract` 目前只接收版本 2，`ROOM_ASSET_DIRS` 固定五类目录，`sync_room_to_package` 只镜像这些目录并注入运行时 `__source`；`apply_room` 再调用 gRPC 切壁纸。[Rust 入口](../tauri-ui/src-tauri/src/lib.rs)及 [Creator Pack 入口](../tauri-ui/src-tauri/src/creator.rs)都要按 v3 同一验证器更新。宜先定义 v3 作品源目录与安装包目录的映射，再让创建、复制、zip 导入、预览和应用共用路径校验；不能只让 renderer 读到新 JSON。WebView2 的[本地内容文档](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/working-with-local-content)说明虚拟主机有独立 origin，适合离线资源，但映射的目录及访问范围仍由 Dext 限定。
- **Room HTML 可选。** 有 Room HTML 时，它提供跨 Desk 持续存在的外形、布局和组件；切 Desk 时可改变这些组件显示的内容。没有 Room HTML 时，每个 Desk HTML 可以构成完整画面。两种创作方式可使用同一底层作品模型，Room HTML 是否存在由作品决定。
  - **实现路径（候选）：**官方宿主分开管理“持续挂载的 Room HTML”和“随 Desk 切换的 Desk HTML”，向存活的 Room 实例推送当前 Desk 状态及该 Desk 的展示数据；没有 Room 入口时只挂 Desk。v2 的 [renderDesk / mountBackground / mountWidgets](../wallpapers/dext-room/main.js)会在切页时重挂内容，v3 需明确常驻实例的生命周期、层叠顺序及切页过渡，不能靠复制一份 Room HTML 到每个 Desk 实现。
  - **代码落点：**在 [main.js](../wallpapers/dext-room/main.js)给 Room 层独立容器和实例表：`mountRoomLayer()` 在作品装载时执行一次，`renderDesk()` 只换 Desk 层并向 Room 实例发 `{deskId, revision, deskData}`；作品切换或 `pagehide` 再释放 Room 实例。沿用 `mountBackground()` 的 `sandbox="allow-scripts"`、token、能力注册和销毁流程。切页过渡中的临时 Desk 实例与正式实例要区分；按 revision 丢弃迟到的消息。没有 Room 入口时跳过这一层。跨独立原生 Dock 窗口的共享外形要加载第二个 HTML 实例并同步状态，不能跨窗口搬运 DOM。
- **单页连续场景是 v3 必须支持的创作方式。** 用户明确想要类似浏览连续网页时的丝滑叙事：Desk 可以是同一长期运行的 HTML 场景中的不同视角/状态，而不只是两张页面的硬切。例：Desk 1 的汽车仪表盘缩在底部充当 Dock；切换时镜头推近同一个可交互仪表盘，到 Desk 2 它占满桌面，成为主要背景和交互画面。共享视觉对象在切换中持续存在，尺寸、位置、层级、可点击部分和数据内容随状态连续变化；视频可以作为素材，但不能用过场视频替代用户所说的实时交互连续性。
  - **运行逻辑讨论稿：**持续宿主、共享场景、Desk 状态、切页阶段和图标过渡的候选契约集中见 [V3_RUNTIME_MODEL.md](V3_RUNTIME_MODEL.md)；本节记录产品意图，不单独冻结 API。
  - **架构含义（候选）：**作者可以把作品写成一张持续运行的网页，Desk 是其中的状态或锚点；CSS/JS/Canvas 等负责过渡，Dext 只发布受控 Desk 状态并维护用户内容。一个“作品”仍可拆分多个 HTML/CSS/JS 文件，不要求所有代码挤进单文件。若各 Desk 入口在切换时重建，必须让需要连续变化的元素留在常驻场景里；否则无法保证它真是同一个对象。当前 v2 重挂内容的思路不足以直接承诺这种体验。
  - **用户澄清的层变化与窗口边界：**仪表盘在 Desk 1 是 Dock 层，到 Desk 2 可以成为背景层，仍保留需要的交互；“层”是元素在当前 Desk 的呈现角色，不是永久身份。Desk 2 中仪表盘占满画面后仍能切回 Desk 1。用户倾向于在 Dext 不处于最前台时可能暂停 Desk 切换，因此连续推近的目标场景是 Dext 桌面正在被操作时；这个例子不要求同一 DOM 在原生顶层 Dock 窗口与桌面网页之间飞越。是否、何时暂停切换仍是待设计策略，不能当成现有行为。原生 Dock 在普通最大化软件前的显示/隐藏体验仍按独立窗口需求讨论。
  - **连续画布里的图标（2026-09-26）：**用户把单页 Room 理解为一块连续的逻辑画布，各 Desk 有自己的画面区域；该 Desk 的普通图标和 Widget 属于这个区域，翻页时随区域一起滑走/滑入，而不是由固定在视口上的图标层突然替换。这里的“画布”是场景组织比喻，不强制作者使用 HTML `<canvas>`。Dext 管理的图标也需要进入与作品一致的运动坐标系。汽车仪表盘是跨 Desk 的共享元素：它不能简单跟着 Desk 1 的内容滑走，而要在同一过渡里从 Dock 形态连续变化为 Desk 2 的主画面。具体 DOM 组织和过渡 API 尚未确定。
- **常驻外形可以随 Desk 改变内容。** 例：汽车仪表盘始终保持大致相同的造型和位置；游戏 Desk 的两个仪表显示 CPU/GPU 占用，生活 Desk 的相同位置显示待办和倒计时。切页按钮可以嵌入仪表盘两侧，当前页状态随之更新。
  - **实现路径（候选）：**将“组件的外形与布局”和“当前 Desk 提供的内容/配置”分开。宿主发送当前 Desk 的受控快照，Room HTML 自行决定同一仪表槽展示 CPU/GPU 或待办/倒计时。CPU/GPU 可延用 v2 受控能力桥；待办/倒计时的数据来源、保存位置与跨设备分享规则尚需定义，不能默认把用户私人数据打进 Room 包。
  - **代码落点：**[capability-bridge.js](../wallpapers/dext-room/capability-bridge.js)已有 `desk.read`、`hardware.cpu.read`、`hardware.gpu.read`、时间和媒体等裁剪后的快照，[main.js](../wallpapers/dext-room/main.js)在 `renderDesk()` 调用 `deskChanged()`；可增一条版本化 `desk-context` 消息给常驻实例，内容只含作品定义的该 Desk 展示参数与绑定 ID。待办应另立本机数据能力和授权，避免直接把任意文件系统或整份用户数据暴露给作者脚本。
- **屏幕导航可以完全没有可见按钮。** 用户可以只用键盘切 Desk；切页按钮也可以画在壁纸任意合适的位置或分开放在屏幕两边。Dock 不再是每个作品必备的固定栏。
  - **实现路径（候选）：**保留 Dext 的键盘切页入口，允许作品不声明任何导航组件。HTML 导航按钮只发送受控的切页动作，由宿主检查组件身份、真实输入和目标 Desk 后执行；左右分开的按钮可作为同一组件的多个命中区。v2 的 [switchDesk](../wallpapers/dext-room/main.js)可作为行为参考，不沿用“必须经官方 Dock DOM 才能导航”的结构。
  - **代码落点：**把 `switchDesk()` 从固定 Dock 按钮事件背后提成宿主命令；输入可以来自现有键盘路径或经授权的组件 `desk.navigate` 请求。作者 HTML 不应直接改 `currentDesk`。左右两块按钮可归一个组件，但各自提交命中区；作品完全不提供按钮仍可切页。
  - **复核：**现有 Core 键盘转发只在桌面活动且开启对应输入模式时执行；若要求在其他软件内也能切页，须新增可配置的系统热键，不能视为现有能力。组件消息的来源与 token 也不能证明真实点击，特权动作应从受信任输入层产生。详见可行性复核 §2.4、§2.7。
- **应用先进入 Dext 统一管理，再决定出现在哪些 Room/Desk。** Dext 保存本机应用绑定和用户图标皮肤；Room 定义自己的 Desk 结构与可选呈现方式，Dext 负责把用户选定的应用交给相应 Desk。应用的身份与启动动作不必绑定到“桌面图标”这种唯一外形。同一绑定可以被默认图标、Dock 项或作品中的 HTML 按钮呈现，是否允许同 Desk 多处出现及如何分发仍需决定。
  - **两种启动入口（2026-09-26 讨论）：**一种显示应用图标，外观可沿用默认、使用个人图标皮肤或由作者自绘；另一种是作者在壁纸上设计的按钮/可点击区域，由使用者绑定本机应用目标。它们共享 Dext 的目标绑定与启动校验。作者只定义可分享的外形、位置和可绑定槽位，不把 Word 等具体软件及其本机路径写死进作品。交互层容纳两种入口的职责，视觉上仍可嵌在背景或 Dock 中。
  - **共存与叠放（用户确认）：**同一 Desk 可以既有情景背景中预留的按钮，也有用户放在更上方的普通应用图标；一个本机目标也可从两个入口打开。“交互层”归纳交互职责，不意味着两者必须共处一个固定 DOM 平面。背景按钮声明占用后，普通图标和 Widget 不放到按钮区域里；它们仍可放在画面其余区域。
  - **在 Dext 内配置按钮（用户确认，2026-09-26）：**作者预留按钮后，用户进入 Dext 查看作品的全部已声明按钮，并为需要的按钮配置动作及个人目标。编辑器需要能按 Room/Desk 找到按钮，在画面中定位/高亮，并显示尚未配置动作的状态；不能只让用户在运行桌面上碰运气逐个点，也不能凭网页 `<button>` 或像素自动猜出按钮用途。作者侧需要稳定按钮 ID、可展示名称和动作声明，运行时把相应的 HTML 命中区域关联到 ID；具体 manifest/API 形式待设计。
  - **统一按钮模型（用户纠正）：**不应先把按钮分成“固定切页按钮”和“可绑定应用按钮”让作者或用户学习两套做法。先声明一个按钮，再给它一个动作：切 Desk、启动用户绑定目标、媒体控制、作品内部交互或留空等。Dext 在同一编辑界面列出全部按钮及其当前动作；各动作的参数和权限由系统内部处理。默认图标可以看作图标外观的启动入口，但拖动/放置仍需专门的布局规则。
  - **默认动作可覆盖（用户确认，2026-09-26）：**作者分享的 Room 可以给按钮预设 Dext 内置动作，例如切 Desk；用户可在 Dext 把它改配成另一种受支持的动作，包括启动自己绑定的应用。用户改配结果只存在本机，不回写分享包，也不把个人路径传给作者。作者还希望研究“退出 Dext”这类命令能否放进 Dext 动作列表；退出究竟是关闭当前 Room、桌面运行服务还是整个 Dext，以及是否需要确认，仍待定义。
  - **风格化入口（2026-09-25 候选）：**某个 Desk 可以留出一个或多个按钮/控件位置，作者用 HTML 设计其形状、文字与布局；使用者在 Dext 中决定这些位置实际打开什么。作品不预设“必须是某软件/某网址/某文件”的目标。尚未绑定的个人入口需显示可理解的待配置状态。现有类苹果桌面图标系统保留为默认体验，不要求每个作品提供这种入口。
  - **个人目标与分享边界（用户澄清）：**用户可能给按钮绑定应用、网址、文件夹等目标，但这些具体目标都属于 Dext 个人数据，**不随 Room 分享**。分享包只提供视觉设计、可绑定的入口，以及必要的通用 Dext 操作（例如切 Desk）；后者不是打开作者指定的个人内容。Dext 分类型校验并执行用户的绑定，作品 HTML 不携带本机路径或具体外部网址。哪些 Dext 内置操作可随作品声明，需按能力边界另定。
- **应用图标默认沿用 Dext 现有呈现；作品也可以开放 HTML 自绘。** 用户不使用自定义方案时，仍看到熟悉的默认图标和交互。作者可用 HTML/CSS 决定图标外观及布局；用户还希望能在创意工坊下载某个软件对应的图标。图标资源、图标渲染方式、应用绑定与启动是不同层次，不应因为换图就把本机可执行路径交给作品。用户放置的应用不应因更换壁纸而必须重新绑定。
  - **用户补充（2026-09-25）：**创意工坊图标像 Dext 的个人皮肤：同一用户可给不同 Desk 选择不同图标；皮肤资源和用户选择保存在 Dext 本机，**不写进可分享的 Room 包**。每个 Room 自己定义 Desk，名称和数量不由 Dext 预设；“游戏 Desk”“生活 Desk”只是举例。换 Room 时哪些 Desk 应沿用同一图标选择，需要 Dext 解决对应关系，不能仅凭 Desk 名称或数组下标认定。此前把“游戏 Desk”理解成 Dext 长期固定的 Desk 身份，是错误推断。
  - **实现路径（候选）：**保留官方默认图标层作为回退；自定义作品可通过受控作者 API 获取可见应用的绑定 ID 和展示信息，自行绘制图标。Dext 仍保存本机应用绑定、校验点击和执行启动；自绘作品如何申报图标命中区、拖动、位置与占用区，还需单独设计，不能假设默认网格逻辑直接适用。图标位置按 Room、Desk 还是用户全局保存，以及更换作品时如何保留布局，也尚未决定。创意工坊图标可以先视为可选择的展示资源；是逐个图标、图标包还是带布局的 HTML 模板，以及如何匹配本机软件，均待讨论。
  - **代码落点与安全差距：**[main.js](../wallpapers/dext-room/main.js)的 `renderIcons()`/拖放可作为默认图标层起点，但不能当成自绘 HTML 的完整交互模型。现有 `launchApp()` 会把 `target/args/workdir` 送给 Player；[Form1.cs](../lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs)将顶层网页消息的通用分支转成 `msg_launch`，[WebWebView2.cs](../lively-core-separation/src/Lively/Lively/Core/Wallpapers/WebWebView2.cs)再按路径启动。这是 v2 的既有路径，不能当成 v3 作者 HTML 的授权接口。v3 可研究按绑定 ID 发起的受控启动：Core 校验消息来源、组件/用户手势、绑定 ID 和当前可见 Desk 后，从本机绑定库解析启动目标；不接受 HTML 附带的可执行路径。现有通用分支的收紧属于该工作包的安全改造点。
- **应用目录属于 Dext，展示分配可覆盖所有适用 Desk 或只针对某个 Desk。** 之前说的“全局 + 当前 Desk”是展示范围，不是两套应用绑定库；Desk 应用是在全局展示之上增加，而非整体替换。Room/Desk 可选择默认图标或作品定义的按钮等入口。
  - **实现路径（候选）：**由宿主计算“全局绑定 + 当前 Desk 绑定”的有序结果，并把可展示字段交给有权组件；组件选择画法。v2 的 [dockCfg](../wallpapers/dext-room/main.js)在 Desk 有 icons 时会整体替换全局列表，v3 的合并语义需明确改为追加，并定义同一应用重复绑定时的去重或并存规则。
  - **代码落点：**新增一个宿主侧 `visibleAppBindings(room, desk)` 计算结果，供桌面图标层和特殊 Dock 组件读取；不要让两层各自拼接导致顺序或重复策略不一致。试验台需模拟全局、Desk、未绑定和重复绑定四种情况；去重规则仍由用户体验决定。
- **组件可以声明占用区。** 占用区相当于画面中的“空气墙”，普通桌面应用图标和普通 Widget 均不能放入；声明区域的组件自身可以占据它。一个组件可声明多块区域，使分开的按钮或仪表之间仍可使用。Dext 需要验证区域，并在屏幕布局变化时更新避让；具体声明格式与失败时的处理尚未确定。
  - **图层视角（2026-09-25 待讨论）：**作者可以把背景、装饰、可操作控件和 Dext 放置的应用/普通 Widget 理解为不同图层；某些作者图层或其中的元素可声明“这里不给 Dext 放东西”。图层帮助说明谁在上面、谁接收输入，以及哪些位置留给用户内容；实际放置仍需要从这些声明得到明确的区域。不能仅凭 CSS `z-index`、颜色或透明度推断占用，因为透明装饰可能要占位置，视觉上不透明的区域也可能允许放图标。例：底部仪表盘图层只把两个圆盘和中间按钮列为保留区，其间空隙仍可放置。可研究让作者标记 HTML 元素/图层，再由 Dext 测量和校验，而不是要求作者手写屏幕坐标。
  - **用户举出的图层例子：**背景层、互动层、Dock/Widget 层等。可把“层”作为作品组织画面的概念，但暂不把这些名称冻结成固定清单，也不要求每层恰好一个 HTML 文件。每层至少需回答：属于 Room 常驻还是随 Desk 切换、与其他层的显示顺序、哪些部分接收输入、哪些部分会阻挡 Dext 图标/普通 Widget 放置。互动能力也可属于某个具体元素，未必要求作者把所有按钮搬到独立顶层。若 Dock 需要显示在其他 Windows 应用之上，它仍要由独立原生窗口承载；网页里的 Dock/Widget 层只描述作品内部的组织与外观。
  - **实现路径（候选）：**作者 HTML 在布局完成和尺寸变化后报告多块区域；宿主以组件实例、版本和视口为依据校验坐标、数量、面积及来源，再把有效区域送进统一的图标/Widget 放置算法。占用区与可点击命中区分别声明；两块占用区之间的桌面空隙仍可放 Dext 图标或普通 Widget，这与顶层 Dock 是否把鼠标点到其他软件无关。可从现有 [widgetPlacementObstacles / findOpenDeskIconCell](../tauri-ui/src/lib/widget-layout.ts)和运行时避让逻辑扩展，但须让试验台、配置器与真实桌面使用同一套规则；区域失效、缩屏无空位及已有图标冲突的回退策略待实验。
  - **代码落点：**v2 [widget-layout.ts](../tauri-ui/src/lib/widget-layout.ts)只用 Widget 整块矩形及固定 Dock 边带避让；[main.js](../wallpapers/dext-room/main.js)拖图标时又临时从 DOM 算 Widget/Dock 矩形，存在两条路径。v3 先抽一份共用纯几何函数：输入视口、图标网格、普通 Widget 矩形、各组件多块占用区，输出合法位置/冲突。作者可用 SDK 报告元素 `getBoundingClientRect()` 转成组件局部矩形；消息须有 `instanceId`、token、layout revision 和 viewport revision，并对数量、尺寸、边界、频率做限制。父宿主只接受对应 iframe 的消息，把局部矩形映射为统一屏幕坐标；尺寸变化或 Desk 切换重算。占用区阻挡图标和普通 Widget 的放置/拖动，声明它的组件可在区内；点击命中区域单独处理。HTML 声明本身不会自动改变 Windows 最大化工作区。
- **需要设计权限边界。** 具有启动用户绑定应用、切 Desk 等能力的特殊组件可以画应用图标和切页按钮；普通 Widget 不自动获得这些能力。HTML 可展示受控的系统信息和媒体内容，动作仍经 Dext 授权与校验。常驻 Room 组件与逐 Desk 组件出现后，早先“每个 Desk 最多一个 Dock Widget”的想法需重新评估，不能当成已定规则。
  - **实现路径（候选）：**沿用 v2 的 sandbox iframe、实例 token、权限审阅和最终宿主校验，新增明确的组件身份与能力种类；导航/启动仅给有权的 Dock 类组件，普通 Widget 继续不能借父级 Room HTML 越权。v2 的 [registerCapabilityFrame / mountWidgets](../wallpapers/dext-room/main.js)和 [权限类型](../tauri-ui/src/lib/room-v2.ts)是改造入口。若一个 Room HTML 进程同时承载普通组件和特权组件，单靠 HTML 标签无法建立真正的权限隔离；需要独立的受控执行上下文或宿主代理。
  - **代码落点与边界：**v2 普通 Widget 是独立 `allow-scripts` iframe，`registerCapabilityFrame()` 按实例 token/权限送裁剪后的数据；系统媒体动作还会由 Core 读取授权文件复核。v3 的 Dock 类组件也应有单独 iframe/实例身份，宿主渲染真正接收点击的按钮或核验请求来自对应 iframe；不能因为同一个 Room 文件夹就把所有组件视为特权。建议把只读数据能力、系统媒体控制、`desk.navigate`、`app.launch` 分成不同能力。新原生 Dock 宿主也必须重复来源与授权校验。[微软 WebView2 安全指南](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security)要求校验网页来源、消息和参数，并限制不必要的 host object/导航；现有 Player 已有顶层来源检查与离线边界，可据此扩展，不能把任意 `postMessage` 当可信点击。
  - **复核修正：**上句的来源核验只解决“哪个实例发来请求”，不能替代可信点击。特权动作仍需受信任宿主输入层；v2 授权指纹只计算 room.json，v3 还须定义可执行资源变更后的授权与安装快照。待办存储不能默认依赖当前 opaque-origin iframe 的 localStorage。详见可行性复核 §2.4–§2.6。
- **高设计强度、很少移动的布局适合在试验台调整。** Dock、固定按钮、常驻仪表等可以在试验台里预览、编辑，并与 AI 修改作品文件的流程衔接。普通 Widget 是否仍在桌面编辑模式中直接拖动，尚未决定。
  - **实现路径（候选）：**把现有配置器内嵌预览和独立浏览器实验台扩成 v3 创作试验台：导入本地作品文件夹、预览多种屏幕尺寸、显示占用区与命中区、模拟 Desk/权限/绑定、提示资源与脚本错误，修改文件后快速刷新。生产宿主与试验台共用协议和几何规则，不能维护两套演示实现。外部 AI 先按模板生成文件夹，内置 AI 编辑入口后议。普通 Widget 在桌面编辑模式能否拖动，留作体验决定。
  - **代码落点：**从 [creator.rs](../tauri-ui/src-tauri/src/creator.rs)的 AI 上下文/导入能力、[room-draft.ts](../tauri-ui/src/features/room-editor/room-draft.ts)的序列化入口、[main.js](../wallpapers/dext-room/main.js)的 `PREVIEW_MODE` 起步。试验台应加载与真实桌面相同的 v3 renderer/SDK，用 mock 的时间、硬件、媒体、绑定回应；原生 Dock 的 AppBar/置顶行为必须另设 Windows 真机预览，浏览器画面只能预览 HTML 外观与几何。最小验收作品是双 Desk 汽车仪表盘，加一个不含 Room HTML 的作品。
- **现阶段只有一位现有用户。** 讨论中用户接受将现有 v2 Room 删除重做，因此设计 v3 时无需先承诺 v2 Room 自动迁移；实际实施范围仍需另行确定。
  - **实现路径（候选）：**允许新建 v3 作品替代现有 v2 演示 Room，不投入自动迁移器；但切换到 v3-only 前应验证 v3 的创建、导入、预览、应用、分享和删除闭环，并由用户确认何时清理自己的 v2 数据。拆分顺序见 [v2→v3 待办草案](V2_TO_V3_TODO.md)，该文件不是当前 ROADMAP 工作包。

## 网页式图层建议（2026-09-25 简化版讨论稿）

用户认为前一版把结构、数据、应用、效果等拆成太多固定层，会让创作管理反而复杂。当前倾向以三类容易理解的层组织作品；它们是编辑器/作者的概念，不强制一个层对应一个 HTML 文件或固定 CSS 层级。

| 层 | 作者眼中的含义 | 与 Dext 的关系 |
|---|---|---|
| **Desk 背景层** | 每个 Desk 人眼看到最多的主画面，可以是图片、视频或 HTML | 可包含装饰、仪表甚至按钮；默认不等于整页占用区 |
| **交互层** | 默认/自绘图标、壁纸按钮、导航键、Widget 控件等可操作入口 | 图标和自定义按钮可按授权指向同一目标并同时存在；按钮可嵌在背景或 Dock 中，普通图标可显示在更上方。它们不必全部搬到一个顶层 DOM；所在层本身不授予启动权限 |
| **Dock 层** | 类任务栏的界面，也可做成仪表盘、屏幕两侧控件或媒体面板；可完全不用 | 可以 Room 常驻并随 Desk 换内容，也可由作品选择逐 Desk；若要浮在普通软件上方，需独立原生窗口 |

**试验台辅助视图：**把作者标记的不可放置区域、按钮命中范围及 Dext 可放图标/普通 Widget 的空间显示出来，供设计与排错；这不是最终桌面的第四个可见层。

用户已明确保留 **Dock** 这个名字；它在 v3 中描述作品里的类任务栏界面，不规定必须在底部或必须是传统应用启动栏。

**属性仍需单独表达：**每层或其中元素的 Room/Desk 生命周期、前后顺序、可点击范围、占用标记和受控能力。同一个持续存在的元素可以随 Desk 从 Dock 角色变成背景角色；角色改变时占用和点击范围也应跟着变。尤其“在上层显示”不自动表示“整层不能放图标”。启动、切换和待机场景也不必硬塞进三类常驻图层。

## 桌面 Dock 的窗口模式

### 已明确的体验

- **全屏游戏：**Dock 完全隐藏，鼠标触边也不唤出；Dext 的 Dock 不需要盖在游戏画面上。
- **非游戏工作软件：**这里的“全屏”特指点击最大化按钮，不包含浏览器 F11 一类真正全屏。用户可选“自动隐藏”或“常驻占位”。
- **自动隐藏：**最大化窗口铺满屏幕；Dock 只留边缘触发条，鼠标触边时展开并显示在最大化窗口之上。
- **工作区解释：**自动隐藏时 Dext 不额外保留空间；Windows 任务栏及其他 AppBar 的占位仍由系统管理。
- **常驻占位：**Dock 一直显示，最大化窗口像避开任务栏一样避开它。
- **点击范围：**Dock 的可见区域与按钮应可操作；透明外观区域是否把点击交给后面的软件尚未被用户列为需求。首轮按窗口矩形接收输入评估，若它挡住实际需要操作的位置，再缩小或拆分窗口。

桌面 HTML 的占用区只影响 Dext 图标与普通 Widget；上述窗口行为必须由 Windows 宿主实现。用户以 MyDockFinder 的使用体验举例；其 [公开设置文字](https://github.com/mydockfinder/mydockfinder-for-Win10-Win11/blob/release/language/Traditional%20Chinese.ini)有窗口边界、智能隐藏和触发条等选项，但不能据此推断内部实现。

### 实现路径（候选）

1. **独立的 Dock 宿主。**当前壁纸 [Player/Core 链](../lively-core-separation/src/Lively/Lively/Core/Wallpapers/WebWebView2.cs)在桌面层，配置器关闭后仍由 Core 管理运行。研究由 Core 托管一个独立的原生顶层窗口或 Player 模式，加载专门的 Dock HTML 入口并同步当前 Room/Desk 状态；不把整页 Room HTML 提升到所有应用之上。作者仍用 HTML 定义造型，Windows 层负责窗口位置、输入和模式。这个组件边界是必要设计约束：单个桌面 WebView 中的任意 DOM 节点不能独自升为系统置顶窗口。
2. **自动隐藏。**研究边缘触发窗与置顶 Dock 窗的组合：收起时不保留工作区，触边后展开在普通最大化窗口上方，移开后收起。[Windows 顶层窗口机制](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features)支持置顶与窗口外形处理；[WebView2 透明背景](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/overview-features-apis?tabs=win32cpp)可作为 HTML 画面的基础。首轮需实测窗口可见、按钮可点击且不误抢焦点；透明区域点到下方软件仅在用户需要时再研究。Windows 的自动隐藏 AppBar 也可研究，但它与任务栏/同边 AppBar 的关系及是否符合“窗口铺满屏幕”需实测。
3. **常驻占位。**研究 [AppBar 的注册、位置协商与移除](https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars)：由 Dext 原生窗口向 Windows 协商贴边矩形，处理任务栏变化和退出恢复；作品 HTML 只负责画面。系统工作区按屏幕边缘矩形保留；若仪表盘只画在底部中间，左右空白也可能随整条边一起从最大化窗口扣除，不能让不规则 HTML 外形直接决定工作区。
4. **全屏游戏隐藏。**常驻占位模式可利用 [ABN_FULLSCREENAPP](https://learn.microsoft.com/en-us/windows/win32/shell/abn-fullscreenapp)作信号；自动隐藏模式还需自己的前台全屏判断。两种模式在进入游戏时都要撤去 Dock 与触发条，离开时恢复先前状态。窗口化游戏、无边框全屏、独占全屏、Alt-Tab、显示器与 DPI 变化必须在真机中验证，不把单个通知当成万能游戏检测。

### 结合代码的原生窗口研究

**建议边界。** [WebWebView2.cs](../lively-core-separation/src/Lively/Lively/Core/Wallpapers/WebWebView2.cs)启动独立 `Lively.Player.WebView2.exe` 并用 stdin/stdout IPC 通信；[Form1.cs](../lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs)创建 WinForms WebView2 窗口并回报 HWND；[WinDesktopCore.cs](../lively-core-separation/src/Lively/Lively/Core/WinDesktopCore.cs)把该 HWND 挂到 WorkerW。Dock 可复用“Core 托管子进程、WebView2 加载离线 HTML、IPC、崩溃恢复”的结构，但要新增 Dock 专用顶层窗口角色，不能走 `SetParent(..., workerW)` 的壁纸挂载分支。配置器只改偏好/发命令，关闭后 Dock 仍由 Core 生命周期管理。建议模块边界为 `DockWindowManager`（模式与 HWND）、Dock Player/专用入口（HTML）、`DockStateBridge`（Room/Desk/绑定快照）；名称仅是拟议，不是现有类。

**自动隐藏的候选状态机。** `Disabled → Collapsed(trigger only) → Expanded → Collapsed`，另有高优先级 `SuppressedFullscreen`。`Collapsed` 不注册工作区；`Expanded` 用独立顶层窗 `SetWindowPos(HWND_TOPMOST, ..., SWP_NOACTIVATE)` 显示在普通最大化窗口上方，[Windows API](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos)支持置顶且不激活的定位方式。触发条可先做窄的原生 HWND，鼠标进入时展开，离开 Dock 与触发条的联合区域后延时收起；避免鼠标横跨两窗时闪烁。Windows 自带自动隐藏 AppBar 虽能做触边，但[每屏幕边缘仅允许一个](https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars)，并可能与任务栏抢占；先用自管触发窗试验，AppBar 自动隐藏只作为对照方案。这个选择是实现推断，尚未真机确认。

**透明与输入的边界。**现有 [Form1.cs](../lively-core-separation/src/Lively/Lively.Player.WebView2/Form1.cs)虽将 WebView 的 `DefaultBackgroundColor` 设为透明，但当前窗口是普通 WinForms WebView2，不能由这一行推断顶层窗口能透出下方软件，更不能推断透明区域会点透。首轮可用包住实际 Dock 画面的矩形窗口，验证透明显示、按钮点击和焦点。只有实际需要跨窗口点击空隙时，才研究[分层窗口命中](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features)、缩小/拆分窗口或 WebView2 组合宿主；整个窗口加 `WS_EX_TRANSPARENT` 会使按钮也失去点击。毛玻璃模糊其他软件的画面是另一项独立效果，不能从 HTML 透明推导出来。

**常驻占位的候选状态机。**注册 Dock 顶层 HWND 为 [AppBar](https://learn.microsoft.com/en-us/windows/win32/shell/application-desktop-toolbars)：`ABM_NEW → ABM_QUERYPOS → ABM_SETPOS`，在 `ABN_POSCHANGED` 后重新协商，退出或切模式时 `ABM_REMOVE`。HTML 显示高度可以影响“请求保留多厚”，最终边缘矩形由 Windows 协商；[GetMonitorInfo 的 rcWork](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-monitorinfo)可用于验证目标显示器工作区结果。建议先只支持一个显示器的一条完整边带；汽车仪表盘只画中间时，系统仍可能保留整条矩形边带。若希望只扣除中间弧形，AppBar 并不直接提供这种不规则工作区语义。多屏自动隐藏注册需比较 `ABM_SETAUTOHIDEBAR` 与 [BAREX 的特定显示器版本](https://learn.microsoft.com/en-us/windows/win32/api/shellapi/nf-shellapi-shappbarmessage)。

**“游戏”与“最大化”的判别不能合并。**[ABN_FULLSCREENAPP](https://learn.microsoft.com/en-us/windows/win32/shell/abn-fullscreenapp)只通知已注册的 AppBar 有全屏应用开/关，不告诉它一定是游戏；自动隐藏窗若不注册 AppBar就拿不到这一信号。可用 [SetWinEventHook](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwineventhook)监听前台变化并复核 [GetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow)、窗口边界/显示器边界；以 [WINDOWPLACEMENT.showCmd](https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-windowplacement)区分标准最大化，再对铺满显示器的前台窗作“可能真全屏”候选。这是启发式判断，不能保证识别所有无边框游戏，也可能误判 F11 视频或演示。若产品坚持“游戏隐藏、普通最大化可触边”，可能还需应用规则/用户覆盖设置。进入 `SuppressedFullscreen` 时除了隐藏触发窗与 Dock，还应决定是否临时撤销 AppBar 占位并在退出后恢复；工作区切换可能使其他窗口重新布局，必须实测。

**屏幕适配。**Windows 侧处理每屏幕像素、负坐标、多屏目标、[WM_DPICHANGED 建议矩形](https://learn.microsoft.com/en-us/windows/win32/hidpi/high-dpi-desktop-application-development-on-windows)及显示器变化；HTML 侧用 CSS 响应式布局和容器尺寸，不以单一 1920×1080 整体缩放。Dock 窗口尺寸改变后重发 viewport revision，占用区与命中区重新上报。v2 的 `ROOM_CANVAS` 百分比放置可作为旧数据参考，不应强制新作品按固定比例。

**原生实验的判定顺序。**先用最小窗口验证：① 顶层 HTML 在普通最大化窗口上显示且不误抢焦点；② Dock 按钮能点击、窗口矩形不妨碍用户实际操作；③ AppBar 模式使同屏最大化窗口避让并在退出/崩溃后恢复；④ 自动隐藏触边无闪烁；⑤ 真全屏游戏时 Dock 和触发条均消失，Alt-Tab 后恢复；⑥ 多显示器、任务栏同边、DPI 变化。跨窗口点击穿透另列可选试验，不作为首轮通过条件。

**第二轮修正。**Core 已有 `Playback` 与 `WindowUtil` 覆盖检测，但它将普通最大化也视为覆盖，不能直接用于隐藏 Dock；Dock 与壁纸暂停应有独立策略。AppBar 遇真全屏先验证隐藏/降低 Z 顺序并保留注册，文档并不要求每次全屏撤销占位。透明外观和模糊其他软件的背景分别实验；点击穿透属于可选能力。项目的 Player 实际是 .NET Framework 4.7.2 WinForms，Core 才是 .NET 9 WPF。详细来源、构建选择和风险见 [可行性复核](V3_FEASIBILITY.md)。

这些路径属于产品和系统层的研究方向；需要先做一个隔离的原生窗口实验，验证置顶、按钮输入、避让、隐藏、恢复及异常退出，再冻结 v3 的窗口契约。Dock 的显示模式应是 Dext 管理的本机行为；由全局偏好还是逐 Room 保存，仍待决定。

### 游戏内覆盖层的边界

用户询问过类似微星小飞机的帧数数字，但尚未要求 Dext 在游戏内显示 Dock。若未来要做游戏 HUD，可研究 [Xbox Game Bar Widget](https://learn.microsoft.com/en-us/xbox/game-bar/api/xgb-widget)或独立图形渲染接入；[Game Bar 已知限制](https://learn.microsoft.com/en-us/xbox/game-bar/known-issues)指出部分 Vulkan/OpenGL 全屏游戏无法显示，且 WebView 不受支持。当前“游戏时隐藏 Dock”已避开这项额外能力。

## 已有实验

曾制作独立浏览器实验台，用两个 Desk、HTML 组件、占用区、动作命中区、桌面图标和普通 Widget 模拟避让与切页。实验说明这些概念可以作为交互模型讨论；它不是 v3 产品实现，也未改动仓库代码。

## 仍待想清楚

1. **适配屏幕尺寸。** 常驻仪表盘跨 Desk 保留外形，与屏幕分辨率/长宽比适配是两个独立问题。单纯整体等比缩放可能造成文字过大或按钮离得过远；倾向由 HTML 响应式布局决定位置、大小和空间不足时的变化，试验台应能预览不同尺寸。具体规则未定。
2. **Room 与 Desk 如何协作。** Desk 怎样给常驻 Room HTML 提供该页的内容或状态，以及共享组件如何复用，尚未定义文件和数据接口。
3. **作品交付契约。** 文件目录、入口、资源声明、能力申请、用户绑定配置、版本与导入/分享格式仍需设计，并提供 AI 易用的说明与示例。
   - 现有 v2 API、SDK 与文档差异及 v3 待定义的作者接口见 [v3 API 核查笔记](V3_API_NOTES.md)；该笔记不是已发布契约。
4. **占用区与交互区。** 作者如何从 HTML 声明区域、Dext 怎样区分不可放置区域与可点击区域、布局变化或失效时怎样处理，仍需设计。
5. **试验台与日常编辑的边界。** 哪些调整只能在试验台做，普通 Widget 能否在桌面编辑模式拖动，暂不细化。
6. **Windows 窗口避让。** 已明确工作软件是普通最大化窗口，自动隐藏模式展开后覆盖该窗口，常驻占位模式则让最大化窗口避让。若组件只占底部中间一小块，系统避让可能要留出一整条边缘空间。需要另行验证 Dext 现有 WorkerW 桌面层与系统 AppBar 的协作。
7. **游戏内覆盖层是另一类能力。** 用户询问微星小飞机一类的游戏帧数数字如何盖在游戏画面上；这与桌面 Dock 的窗口避让、贴边自动隐藏并非同一机制。目前是技术问题，尚未提出将游戏内覆盖层纳入 v3 的明确需求。

## 与现行 v2 的关系

当前 `MODEL.md`、`DOCK.md`、`ROOM_AUTHORING.md` 等仍描述正式 v2。上面关于可选 Room HTML、开放作者界面、常驻组件和占用区的内容只是 v3 设想，不应被当成现有实现、已批准的数据格式或下一开发工作包。等用户明确要求开始实施，再拆分工作包并建立正式契约与验收。
