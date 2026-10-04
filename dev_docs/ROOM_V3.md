# Room v3 作品契约（apiVersion 1）

> 2026-10-02 V3-P3-001：正式原生作品数据定义，运行/编辑入口按后续包接入；契约校验通过不等于功能已全部实现。当前证据与缺项见V3_DELIVERY.md。

## 作品与个人数据

唯一作者清单为`room.json`：`version:3`、`apiVersion:1`、非零UUID `id`、`name`、稳定ID `startDesk`、`desks`和完整`resources`清单。Desk必须有稳定`id`、`name`、`icons`和组件ID引用`components`。排序与改名不更换ID。本机另存及每次导入分享包生成新Room UUID，Desk/按钮/组件ID在各副本内部保持关联。

作者图标只声明ID、buttonId、格位、公开名称/字形。按钮有ID、名称、作用域`room`或Desk ID，可选默认通用动作。`binding.launch`只表示入口语义，不带程序、参数、工作目录、绑定目标或路径。个人绑定、授权、皮肤、实际布局覆盖和组件存储由Core持有，按Room副本ID分开，不写回共享作品。删除副本清理其专属个人数据，不删除全局应用目标。

## 画面与组件

`roomScene`可选，`entry`指向持续运行的本地HTML；无此字段时官方模板直接渲染Desk背景。`background`、可选`start`和`idle`采用`{type,src,capabilities?,buttonIds?}`，支持image/video/gif/html。capabilities与buttonIds缺省为空，按钮引用必须存在且不重复；声明不自动授予权限。默认`transition`为slide/fade/none，时长0..10000毫秒；author要求共享Room场景，完成与超时仲裁仍由Core决定。

组件在顶层声明`id/role/entry/placement/capabilities`，role为widget或dock；可公开config和buttonIds。placement使用1920×1080设计画布。Desk按ID选择组件；componentOverrides只保存该Desk更改的公开配置字段，其他字段继承共享值。原生Dock引用`dockComponentId`，Windows显示模式是独立本机偏好。

## 声明与授权

允许声明的API词汇为desk.read、desk.navigate、time.read、hardware.read、media.read/control、audio.read/control、storage.read/write、binding.launch、dext.exit。声明不自动获得权限；运行时必须报告当前支持和授权状态。作者API及各能力的生产行为在后续包实现，不允许直接原生Core调用或接触官方DOM。

按钮默认动作仅为desk.next/previous/go、binding.launch、dext.exit。desk.go必须引用已有Desk，其余动作不带deskId。dext.exit必须由Dext宿主显示确认；本机目标启动须宿主核验真实输入，作者自报isTrusted无效。

## 资源和安装

resources列出全部作者文件，入口/媒体必须在清单内。使用`/`相对路径，拒绝空段、`.`/`..`、绝对/URL/反斜杠/Windows设备名/ADS及URL歧义字符；同一清单拒绝大小写碰撞。只允许HTML/CSS/JS/JSON、媒体、图片与字体，不允许作者exe/native库。运行时网络、导航、弹窗和下载仍按宿主隔离，资源扫描不能代替运行时安全。

宿主安装快照为`installation.json`，独立formatVersion=1，记录Room ID、原生清单字节SHA256及每个资源的规范相对路径/SHA256/字节数。先检查源并构建同卷暂存安装，复核后替换；失败保留旧安装。Core独立重读全部已安装字节，匹配快照后才授予绑定的Player。个人布局不会改写此快照。

Windows发布使用已验证目录句柄完成改名，资源读取和暂存写入保留祖先句柄；遇到后来出现的非本包目标不会覆盖。前代安装保留在`.dext-previous-*`，失败暂存保留在`.dext-install-*`，避免对失去所有权的路径递归删除。发布收口必须增加有界、核验身份的遗留恢复与清理，当前不保证掉电事务恢复或自动空间回收。

限制：清单1MiB、64Desk、1024按钮、128组件、每Desk512图标/32组件，4096资源。Schema只做形状与值范围校验；Rust与Core另查引用、身份、路径/链接、完整资源摘要及实际安装。

## 样包与检查

- `rooms/v3-basic`：无共享HTML的简单Room，有待绑定应用入口。
- `rooms/v3-continuous`：持续scene控制source/target/shared矩阵，同一共享仪表盘从底部到整页返回；Widget实例ID/内部视口可观察，普通图标参与Desk动画。正式SDK已接实际Player基准验证，多尺寸及完整Core组合仍见V3_DELIVERY。
- `cargo test --manifest-path tests/room-v3-contract/Cargo.toml`：独立测试实际生产契约模块，不依赖Tauri或改桌面。

## Core个人数据与动作边界（V3-CORE-006）

Core持有`%LOCALAPPDATA%/Dext/v3/personal/personal.json`，格式版本1、递增revision，限1MiB。全局目标以UUID引用，Room副本分别保存按钮动作/目标/皮肤覆盖和消费者授权。独立另存复制覆盖、清空授权；删除Room覆盖保留全局目标。缺文件可初始化，不可读/损坏/未知字段不能静默清空。

安装复核同一清单字节生成消费者目录：`official`、`scene`、`component.<稳定ID>`；组件名不能冒充官方或场景。授权绑定消费者与当前installation stamp，声明不是授权。公开动作结果仅有安全状态、稳定ID、公开名称/动作及是否已绑定，不返回目标、参数、工作目录或私有异常。

原生输入核验后，Core内部宿主适配器才可签发一次性票据；作者IPC不提供签发方法。票据绑定connection/peer/session/consumer/button/安装戳/会话及个人revision，使用单调时钟1500ms过期，每次执行重查权限，编辑个人数据即使旧票据失效。实际RawInput适配器与作者SDK仍须在原生宿主包接通。

桌面暂停限制桌面入口。仍可见的Dock入口可启动绑定，但必须经过相同安装、授权与真实输入核验；导航仍由会话内核仲裁。`dext.exit`只返回需Dext确认状态，正式确认界面接通前不执行退出。

### 原子动作准备与撤销

动作先在短同步边界复核连接、当前安装、会话修订、消费者/按钮/作用域和个人快照，消耗票据并产生不可变派发计划。此前提交的关闭、失焦、安装撤销或个人修改均拒绝旧请求。准备提交之后的撤销作用于后续动作；已提交应用启动不可撤回。释放所有授权锁后才执行原生启动/通知，仍以单调时间复核1500ms有效期。导航在锁外再经过gateway当前会话核验。

生产安装权威必须实现与Bind/Unbind共锁的动作准备读取，普通Admit接口不能自动获得派发租约。个人读取持锁时不阻塞等待gateway，遇观察者竞争先释放再重试；准备回调不得启动、修改状态或发布订阅。

## P5共享模型与作者SDK

作者v1公开接口见`ROOM_V3_RUNTIME_API.md`和`creator-kit/v3/sdk`，生产纯模型在`wallpapers/dext-room-v3/runtime-model.js`。当前仅Task1自动验证，原生Core/Player边界及DOM适配仍待Task2–4；声明格式/授权基础不算完整运行交付。

共享配置递归按字段继承；数组整体覆盖、null显式值、删除差异恢复共享字段。生命周期stage与暂停/锁屏正交；媒体启动阈值和实例规则见作者API。几何订阅提供当前版本/viewport，重复相同报告不递增版本，避免跨消费者通知环。

### 媒体消费者与活动条件（P5）

消费者目录还包含`slot.start`、`slot.idle`和`slot.background.<DeskID>`，分别只在starting、idle及该Desk桌面阶段活动；采用各Content自己的capabilities/buttonIds，不继承scene或official授权。个人授权最多196消费者，background的Desk ID仍限80字符。

Core只允许未暂停、未锁屏且处于桌面前台的当前Player消费者实际读取能力或激活动作。starting/idle媒体不受仅描述桌面切页的IsOperable字段误拒；桌面阶段仍需IsOperable。独立可见Dock保留桌面暂停例外，锁屏无例外。公开按钮元数据可在结构上活动时读取，不代表可以消费能力。前台事实即使未改变IsOperable也递增全局revision，旧输入不能在恢复后复活。真实Windows/可见性/物理输入适配仍按P5验收卡推进。

### Core消费者JSON存储基础（2026-10-03）

个人Room数据增加storage（旧formatVersion1缺字段默认空）；命名空间按副本UUID/consumer/key，键为1..80字符稳定ID。storage.read/write分别经过当前安装、私有连接、会话修订、消费者活动和个人授权检查。get缺键返回null，set(null)保存JSON null。每值规范JSON32KiB/深度24/每容器4096项、每消费者128键/64KiB，全个人快照既有1MiB限制。成功写入增加个人revision，失败保留旧字节；显式null或损坏storage拒绝，不清空。另存仅复制已确认的按钮/皮肤覆盖，KV与授权默认空；删除副本清理其KV。

Core生产者历史110/110已通过；正式SDK/严格Player消息与实际Core消费者KV现已接通，包括撤权恢复、同安装重启读回与私有值不入日志。证据见V3_DELIVERY，不代填完整个人编辑UI或最终人工验收。

### 入口动作解析与作者动态导航（2026-10-03）

动作优先级为显式个人Action、作者默认Action；都缺省而有个人TargetId时按binding.launch解析。既无动作也无个人目标的已声明按钮，允许所属消费者在当前真实输入与desk.navigate授权下请求合法动态导航。作者请求不得替换已有默认/个人动作，未知Desk在消耗输入前拒绝。票据仍由Core内部签发、按同一当前私人快照和原生证明一次消费，不返作者。当前原生消息、统一默认/作者派发与正式SDK已接通，实际Core Windows注入验证和正常重启恢复通过；物理输入及精确移动/遮挡仍继续。


### 原生作者导航与默认回退（2026-10-03，P5接线）
Dext.desk.navigate三种公开动作已接固定消费者的生产Core授权入口，SDK无ticket/原生序号字段。官方输入宿主内部用Core真实完成序号关联100ms默认回退和作者请求；SDK在途时等待其真实消费回执，失败且未消费保留个人默认动作。延迟回退必须匹配原完成，不能消费同按钮的新输入。真实DOWN1500ms期限、个人授权/绑定优先及当前窗口/几何检查仍由Core决定。

已发出的动作回执可跟随本次动作推进的同文档修订到达；换代次/会话、暂停或销毁失效，数据/存储旧修订仍拒绝。私有回执元数据不交给作者。实际Core作者导航和Windows注入、正常重启恢复已验证；系统控制基础已按下节接通；Dext可信退出确认、精确移动/遮挡输入与个人布局及最终人工门槛继续开发。


### 原生作者系统控制（2026-10-03，P5接线）

Dext.media.control只接受play/pause/toggle/next/previous；Dext.audio.control接受非空volume（有限0..1）/muted（boolean）patch，不能携带目标、路径、按钮、票据或原生序号。私有宿主固定consumer和当前generation/session/revision/geometryVersion，并从Core当前真实完成推导已声明button。逐次复核安装、阶段、原生1500ms期限、授权及私有绑定；作者控制仅可用没有默认/个人动作的声明入口，不能替换个人应用、导航或退出。

Core准备与一次证明消费是短私有提交边界，Windows/COM在锁外线程池执行。每consumer+capability最多10次/秒；rateLimited不消费。每attachment至多1、全Core至多4个任务，非阻塞admission；外层4s后controlUnavailable，原生5s期限仍有界。挂起任务在真正终止前持有槽位，不能用重建attachment绕过；已取消请求在媒体等锁/解析和音量设备解析后的写入前再次拒绝。无法撤回已经发出的系统调用，超时不伪造成功。

Accepted/controlUnavailable等回执的inputSequence/inputConsumed只在私有宿主使用，SDK仅有安全status/错误码。实际消费后服务失败也取消默认回退；未消费的拒绝保留当前配置入口fallback。已发动作在同代次/会话修订中可回执，暂停/换代次/会话/销毁全部取消。实际Core五媒体意图到达拥有的静音publisher、音量改动后恢复、8次输入一次消费与正常重启恢复已验证；人工物理输入、听音、完整生命周期与可信退出确认仍独立进行。

- 2026-10-04 P5有效布局补证：持续Scene经SDK只读placements取得当前可见组件的组矩阵前有效设计矩形，内部逻辑视口不改。v3-continuous仪表盘改为1600×540，用当前矩形映射至底部1920×280/整页1920×1080；实际640×480 scale1.5底部展开往返、1920×1080放大缩回及有效布局恢复已通过。Core包/回复/raw OS键为fixture，更多物理DPI/完整Core OS门槛继续；全16项就绪仍1/16≈6%。

## 配置器应用来源（P6内部元数据）
官方宿主在content安装目录外使用source.v3.json，保存formatVersion1、规范sourcePath和完整installation快照。它服务配置器当前Room标记，作者资源/SDK/room.json/分享均不携带它；记录与当前安装不匹配时不显示该来源。apply_room通过规范宿主路径请求Core，等当前Room新会话/有效Player与稳定安装后才记来源；Core非活动时原生active_room为空。普通Core重启仍按同安装快照匹配，保存回执不能代表应用成功。

### 配置器本机只读授权（2026-10-04，P6-002）
个人Room增加readGrants，格式仍为1，缺字段默认空；按当前安装戳/固定consumer保存time.read、hardware.read、media.read、audio.read。当前readGrants记录对这四项优先（空数组表示明确撤销）；没有当前记录时兼容原grants当前戳中的明确许可。配置器只修改选择的读权限，原grants中的绑定/控制授权、目标、按钮、布局与KV保持。旧安装的读许可不继承，新安装允许time不会把旧控制授权提升到新戳。另存不复制授权，作者Room与分享不包含此字段。
Core当前Coordinator可在桌面不可操作时编辑这些本机选择；作者每个真实数据请求仍逐次核验当前连接/安装/声明/授权与生命周期。允许勾选不保证当前桌面可读或Windows来源存在。当前生产接线/真实Tauri/普通重启证据见V3_DELIVERY；物理桌面数据/输入门槛保持。
