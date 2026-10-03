# Room v3 作者 API v1

> V3-P5-001开发中：SDK、纯运行模型、Core生命周期、Player上下文/资源边界及原生输入私有接线已实现；启动完成、同Player闲置、生产DOM/消费者投影、个人布局和最终物理/安全验收仍在Task2–4。自动测试不代表原生宿主已经交付。状态见V3_DELIVERY。

## 作者接入

把`creator-kit/v3/sdk/dext-sdk.v1.js`复制进作品并列入resources，在自己的main.js之前加载。公开对象是`window.Dext`，类型定义见同目录`.d.ts`。`Dext.ready()`或`dext:ready`表示收到官方父窗口的版本化上下文。一个iframe只初始化一次；换会话销毁旧连接/实例，禁止旧文档自行复活。

```js
const releases = [];
addEventListener('dext:ready', () => {
  releases.push(Dext.desk.subscribe(snapshot => {
    // current是Core已经提交的Desk；target只表示尚在过渡的目标。
    document.body.dataset.desk = snapshot.targetDeskId || snapshot.currentDeskId;
  }));
  releases.push(Dext.data.bindReadout('time.read', document.querySelector('#readout'), value => {
    document.querySelector('#readout').textContent = String(value);
  }));
});
document.querySelector('[data-dext-button="open"]').addEventListener('click', () => {
  Dext.actions.activate('open').catch(() => {});
});
addEventListener('pagehide', () => { releases.forEach(release => release()); Dext.dispose(); });
```

作者按钮先在清单声明，组件/媒体槽列出buttonIds。SDK不提供本机路径、启动参数、工作目录或输入票据接口。`actions.activate`仅提出请求；物理鼠标/键盘输入必须由Core核验当前入口和几何，脚本调用和合成点击不能获得启动权限。iframe的路由token不是授权或输入证据。

## 公开接口

| 接口 | 行为 |
|---|---|
| ready / session / dispose / diagnostics | ready Promise；只读公开上下文，不含token；销毁释放订阅、拒绝请求；诊断只有安全代码/计数 |
| desk.get / subscribe / navigate | 获取完整Core快照、当前值回放/修订订阅、请求desk.next/previous/go；SDK不自行提交Desk |
| lifecycle.subscribe | stage=starting/desktop/idle，playbackPaused与locked独立；前台operable在完整Desk快照中 |
| config.get / subscribe | 合并后的公开配置；嵌套未覆盖字段继承，null显式覆盖，数组整体替换 |
| capabilities.get / subscribe | 已声明能力的available/denied/unsupported；声明不等于授权 |
| data.subscribe / bindReadout | time/hardware/media/audio的只读状态；available带任意JSON值，其余missing/denied/unsupported/error不带读数 |
| actions.list / activate | 当前消费者的公开按钮列表（id/name/scope/action/isBound）及安全状态；无私人目标 |
| storage.get / set | 请求当前消费者本机键值；host核验storage.read/write，未接通时明确unsupported |
| media.control / audio.control | 封闭播放动作和0..1音量/muted；host核验相应声明、授权与输入要求 |
| scene.publishGeometry | 提交本消费者已声明按钮矩形；roomScene可另交source/target/shared组矩阵、占用区 |
| scene.subscribeGeometry | 回放/订阅geometryVersion与viewport，resize后重新报告本页实际按钮；相同几何不递增版本，避免消费者互相重报循环 |
| scene.completeTransition | 仅roomScene可回告当前transitionId完成；真正提交由Core完成 |
| scene.done | 仅slot.start在starting时请求进入桌面；idle必须由宿主唤醒，作者done不能退出idle |

`bindReadout`只改变传入元素的hidden；静态外框由作者保留。无数据/权限或render抛错时隐藏读数，不替换整个仪表盘。任意JSON数据由作者解释，不按槽位外形自动换算。回调错误只留下renderError/subscriberError，不暴露异常字符串。

所有subscribe返回幂等释放函数，同一数据频道的多个监听只占一个宿主订阅；首次监听回放最新值。每频道最多128个监听。失效/暂停的宿主停止数据推送，恢复提供新状态；SDK不得凭旧数据报告available。

## 作者与官方父窗口的消息

共同信封为`{type,apiVersion:1,instanceId,sessionId,token}`。消息只接受固定parent WindowProxy；沙箱是opaque origin，postMessage目标使用`*`，不能以`event.origin`取代source和信封核验。Core仍独立验证真实Player/连接/安装/消费者。

- init：type=`dext:runtime:init`，含consumerId、kind、capabilities状态对象、config、viewport、geometryVersion、snapshot；一个文档只接受一次合法init。
- request：type=`dext:runtime:request`，含单调唯一requestId、method、params；response回同一信封/requestId，`ok:true,result`或`ok:false,error:{code}`。未知、过期、重复及错误token/版本/session响应不能结束其他请求。
- notify：type=`dext:runtime:notify`，用于ready、dispose以及desk/lifecycle/config/capabilities/data的subscribe/unsubscribe；无需响应。data频道params为`{capability}`。
- event：type=`dext:runtime:event`，含event、payload、正整数sequence。sequence按频道递增，data按capability分别递增。desk payload为完整快照；lifecycle为其生命周期；geometry为`{geometryVersion,viewport}`；config/capabilities为公开对象；data为`{capability,state}`。
- dispose：type=`dext:runtime:dispose`，旧连接永久失效；所有pending以disposed拒绝，移除消息监听，旧父消息不能重新ready。

每条JSON消息最多32768个UTF-8字节、嵌套24层，每容器最多4096项；最多64个pending请求，超时5000ms。SDK拒绝非JSON值、循环与非有限数。宿主必须另行同样检查，SDK不是安全边界。

## 快照与几何

快照含protocolVersion、Room/session/installation身份、revision、current/target/queued Desk、transitionId/deadlineUtc、active/operable和lifecycle。lifecycle含自己的revision，变化也增加全局revision。旧revision、旧session和同session换安装戳不接受。queue修订不会重播当前动画；动画完成只发完成请求，超时/失焦按Core最终快照收敛。

设计画布1920×1080；viewport为实际CSS宽高和dpr。SDK将当前session/revision/transition/geometryVersion加入几何报告，作者不能传入自己的这四个值。宿主接受报告后递增geometryVersion并通知所有活动消费者，取消旧输入。矩形必须有界，组只允许6项仿射matrix和opacity，不接受DOM、selector、CSS或原生窗口尺寸。

## 生命周期和媒体裁定

新Room以startDesk开始；同安装重启恢复已提交Desk。start仅新主Player文档建立时播放，切页/idle/暂停/锁屏恢复不重播。image/GIF start初始缺省500ms；video播放至ended，30s加载/停滞无进展降级；HTML done或60s超时进入已确定Desk。background持续（video静音循环），idle持续至宿主唤醒；无idle保留桌面。共享场景/组件暂停而不重建，恢复与Core状态一致。

这些缺省写入P5 ledger和PROJECT，最终集中验收可调整。合法长视频没有总时长60s截断。

## Core运行上下文边界

RoomV3Installation在同一清单与资源摘要校验完成后冻结公开Manifest和资源path/sha256/size；不携带绝对安装目录或个人绑定目标。RoomSessionPlayerBridge.ReadRuntimeContext只允许当前原生DesktopPlayer私有连接，重新核对进程、安装戳和session；旧连接、已撤销安装、篡改或旧版开发覆盖层不返回上下文。该对象供官方宿主使用，不能整体当作iframe授权；后续宿主仍必须按消费者裁剪并核验每次能力/动作请求。

Core.lifecycle变化同时增加全局revision和生命周期revision。暂停/锁屏/idle使桌面不可操作时，先提交已有动画目标；持久化失败不发布半个生命周期，恢复后沿用已提交Desk和最终队列。安装决定watchdog=max(3000,durationMs+2000)，作者请求不可缩改。原生恢复同时检查Room ID与installationStamp，新会话startup不覆盖恢复的已提交Desk。

媒体槽使用独立消费者：slot.start仅starting、slot.idle仅idle、slot.background.<DeskID>仅当前目标/已提交Desk的desktop阶段。每个槽需要自己的声明和安装戳授权。Core拒绝暂停、锁屏或非桌面前台Player的能力消费与激活；start/idle不用桌面切页IsOperable作为唯一判据。恢复前台会改变全局revision，之前的输入凭证失效；Dock的桌面暂停例外不能越过锁屏。

Windows适配以一次完整事实值传入内核：实际各显示器暂停结果、全局锁屏和独立桌面前台。未知采样按暂停/锁屏/非前台处理；Start/Restore首个快照即带事实，不能先发布可操作状态再补锁屏。锁屏与前台恢复在同一修订内变化，持久化失败保留原状态并由后续采样重试。真实闲置展示及暂停后Player最终快照重放仍在P5接线中。

### 官方宿主私有运行时传输

Core先发cmd_room_runtime，再发同代次完整快照；RuntimeGeneration由该Player的Core适配器单调递增，绑定session/room/installation。公开清单以原始JSON字符串跨Json.NET传输，资源仅含path/sha256/size。私有连接初始化与首次订阅在同一授权边界内，失效/Stop/换会话/Detach有显式cmd_room_runtime_revoke。

Player投影为dext:v3-runtime、dext:v3-session和dext:v3-runtime-revoked，固定官方顶层文档才可收取。导航/撤销保留旧代次墓碑，原context不能复活；重载后Core重新授权并发送新代次。暂停期间只缓存最新完整状态，异步恢复完成后先context后最后snapshot，撤销则只重放revoke；重复恢复命令不取消尚未完成的首次重放。

上述传输仅建立运行身份和公开数据。作者iframe不会因此取得授权；资源字节边界、真实输入和消费者级投影继续由后续P5实现验证。

### 原生资源字节边界（P5阶段实现）

私有dext:v3-runtime增加resourceBasePath=/content/<runtimeGeneration>/，相对作品路径必须拼接这一前缀。Player在首航前选择native模式；官方有限文件与清单内容分开服务，不映射整个目录。内容完整大小/SHA256校验后从私有临时缓存返回，源安装句柄随复制完成释放；同代次只读已验证字节，撤销/导航关闭缓存及旧响应。支持GET/HEAD和单区间Range，多区间返回完整200，越界416。

响应同时携带CSP和强制Connection-Allowlist，作者脚本/媒体/字体/fetch/frame限当前清单来源，worker不开放，RTC/重定向禁止。沙箱页不能升为官方顶层或直接调用原生桥。Player每WebView实例一次验证浏览器强制策略报告；不能验证则拒绝native启动。每个新文档仍经过正常导航和当前代次检查，策略随每份响应附加。

Runtime153的禁RTC/mDNS接口冲突可能在作者重复构造RTC时终止渲染进程；当前实现撤销状态与资源，不宣称恶意内容恢复完成（ERRORS #150）。原生资源服务目前由隔离ReleasePlayer验证；生产DOM接线、物理输入和消费者级投影继续按P5推进。

### 官方宿主私有原生输入协议（P5阶段实现）

固定官方顶层页通过dext:v3-native-request请求invalidateGeometry、geometry、buttons或activate。身份为protocolVersion=1、requestId、runtimeGeneration、sessionId和当前revision；activate另带当前geometryVersion/consumer/button，永不接受票据、目标路径、PID或HWND。返回dext:v3-native-response只含公开状态/按钮元数据；键盘受控焦点与激活由Core发送dext:v3-native-event。作者SDK继续走父宿主，不能直接使用此私有协议。

geometry是已经裁剪的前到后按钮列表，含consumer/button、归一化x/y/width/height和tabIndex。官方宿主在任何布局变更前请求invalidateGeometry并等待确认，变更后以递增版本发布完整几何并等待确认再接收激活。Player核对CSS viewport与自身原生客户区，Core复核实际Player窗口归属/客户区/屏幕原点/DPI以及当前消费者和按钮scope；窗口或快照改变必须重新发布。几何发布遇授权网关忙返回staleInput，宿主按当前身份重试，旧证明不能保留。

Windows RawInput DOWN/UP创建Core内部一次性配对，拖动、失焦、快照/代次/几何/DPI变化取消；到期从物理DOWN计时。真实Tab/点击选择声明按钮的Core焦点，Enter/Space配对由官方宿主转成同一activate请求。合成DOM点击、请求重放、错误消费者和无配对请求不能出票。新协议已由隔离ReleasePlayer验证，生产DOM接入和最终物理输入门槛仍待P5后续步骤。

### 启动完成仲裁（P5阶段实现）

私有原生协议增加startupComplete：带当前runtimeGeneration/sessionId/revision及正整数lifecycleRevision，只允许结束当前starting阶段。Core保留暂停、锁屏、前台事实、已提交Desk与最终队列；旧阶段、旧文档或重复完成拒绝。只有可信Core新文档事件能重新进入starting，普通暂停/锁屏/闲置恢复不能重播start。闲置中重载可先播放新文档start，再回idle。同一实际文档ready只发送一次。生产media-host已按展示完成或活动时间超时调用此入口；四媒体实际Core预暂停start、恢复与同文档idle验证见文末，实际锁屏仍待最终集中验收。

### 同Player闲置与宿主唤醒（P5阶段接线）

原生Room进入闲置时Core只改变stage，保留当前Desk、最终队列和Windows暂停/锁屏事实。屏保服务临时将当前Player置于对应显示器，保留同一文档；唤醒还原父窗、样式、坐标与层叠顺序，不另起原生屏保Player。Windows事实中的前台判断包含当前显示器上经核对的闲置展示，原桌面前台采样仍独立；退出展示后先移除此覆盖，再恢复desktop阶段。

原生闲置不因底层应用遮挡而暂停，手动暂停、锁屏、远程和电源规则继续生效。第一次RawInput仅唤醒，按住的鼠标/Enter/Space在松开前不得形成新激活。父窗已失效或还原不可确认时隐藏并关闭本Player，走Core有界故障恢复。生产DOM按idle持续展示素材；没有idle时保留暂停的桌面画面和普通图标，不发布可激活几何，作者done不能唤醒。实际Core四媒体同文档闲置、OS注入唤醒和父窗/边界还原已补证；实际物理输入、锁屏、多DPI及不可还原故障仍待最终集中验证。

## 原生宿主消费者能力元数据（2026-10-03，接线阶段）

官方顶层宿主使用私有 `dext:v3-native-request` 的 `method: "capabilities"` 查询；字段仅为 type/protocolVersion/requestId/method/runtimeGeneration/sessionId/revision/consumer，不接受作者自报能力清单、授权、输入票据或本机路径。Player严格核对当前代次与修订，Core在同一个个人存储/安装/会话授权边界裁剪当前消费者的声明集；返回字段 `capabilities` 的每项为 Core 状态（accepted、missingPermission、notOperable等），整体失败不带能力集合。原生桥将查询修订传入权威，等待期间修订改变返回 staleInput。

元数据是不可变副本，不是后续数据或动作的许可。暂停、锁屏、非前台使消费状态不可用；媒体槽仍按当前phase/Desk独立授权，Dock暂停例外保留且不绕锁屏。没有目标路径、参数、安装授权戳或个人修订。iframe的available/denied/unsupported视图必须从该Core结果与宿主实际实现能力合成；已授权但尚未实现只能unsupported。每次读取数据/动作仍要Core再次核验，宿主不可凭缓存元数据放行。生产DOM/消费者数据桥和真实人工步骤继续属于P5待办，本节不声称它们已完成。

## 生产媒体适配器（2026-10-03，接线阶段）

`media-host.js`以已验证资源解析器、当前Core快照读取器和启动完成回告为依赖，按模型instanceId保留节点；HTML挂载/状态/销毁交给iframe宿主。image/GIF start500ms、HTML done或60s、video ended或30s未加载/未进展降级；暂停/锁屏/非活动阶段不消耗计时，background/idle视频静音循环，idle持续至宿主唤醒。启动完成只携当前session、global/lifecycle修订回告，不自行提交Desk；失败每1s活动时间重试且仅一个进行中请求。旧播放Promise按当前意图收敛，不能停掉后来恢复的播放。

当前生产模块已在隔离ReleasePlayer实际解码、计时和持续节点检查通过；该夹具的生命周期和完成回调仍是模拟Core。官方页面、作者SDK、原生挂起投递和生产Core的完整闭环仍待接线，不能把这些模块检查当作完整Room可用或人工验收通过。

## 生产iframe路由模块（2026-10-03，接线阶段）

`frame-host.js`将每个固定消费者/instanceId绑定到一个持续sandbox iframe；只接受该WindowProxy、当前会话/文档token、apiVersion及严格字段。重新load关闭旧请求与数据源，换文档token后再次从Core查询能力，只初始化本次SDK一次。路由token不代表真实输入或权限。Core accepted与当前宿主实际支持共同决定available；授权而未实现是unsupported，暂停或拒绝是denied。

每帧最多64个5s请求，消息UTF8 32KiB、JSON深度24，方法/参数/按钮/阶段/几何范围有界；对外错误不含私有异常。数据按能力复用一个来源，暂停/修订/重载关闭旧源并拒绝迟到数据；来源失败仅回error供SDK隐藏读数。Core适配器必须对每个操作和每个数据值重新授权，不能把能力查询缓存当许可。rendering不受input operable直接控制，仍遵循Core播放和生命周期。

模块现已通过完整SDK与真实ReleasePlayer的来源/令牌/订阅/重载回归；该隔离夹具的私有权限和数据回复是模拟Core。原生逐iframe媒体暂停、完整官方页/DOM、生产Core数据/动作和几何握手仍在P5接线，不把inert当成媒体暂停或完整可用证明。

## 原生暂停的同步播放门（2026-10-03，接线阶段）

Player仅对固定官方文档调用私有 `dextNativePlaybackChanged`；payload为dext:v3-playback/protocolVersion1/单调sequence/runtimeGeneration/paused/messages。暂停的messages为空，await JS完成后才原生挂起；恢复的messages是最新缓存context/snapshot或revoke，同一次同步调用先应用再释放播放。官方页通过playback-host约束代次、顺序和类型；旧序列、错误代次、重入更新与失败回放不能释放旧状态。

media-host和frame-host的setPlaybackSuspended仅控制本机投递暂停，不修改Core的生命周期、已提交Desk或输入事实。计时保留剩余活动时间，iframe保留当前文档但关闭旧来源/请求，恢复重新获得当前Core修订的能力状态。native恢复不使用旧全DOM play()，避免重启非活动阶段媒体。作者SDK没有此控制入口；来源/动作后续仍需Core重新授权。

真实ReleasePlayer已验证同一生产模块的500ms期限在原生暂停中停止，恢复先观察最后revision3，再以该修订完成与恢复数据来源。夹具的Core回复仍为模拟；正式页面接入、真实Core生命周期和原生逐iframe音视频暂停继续验证。

## Core消费者逐值数据桥（2026-10-03，接线阶段）

私有请求增加method=data及capability，只有time.read/hardware.read/media.read/audio.read，仍带固定consumer和当前runtimeGeneration/sessionId/revision。请求不能传数据、来源、路径或票据。Core在采集前及返回不可变快照前分别核验当前私有连接、安装、会话、修订、消费者阶段/声明和个人授权；采集在个人存储/网关/内核锁外，撤权不依赖global revision改变。最多16个并行采集；available必须含JSON value，missing/unsupported/error没有value，限制UTF8 32KiB、深度24。失败不返回私人异常。

实际Windows来源：time含UTC、Unix毫秒和本地偏移；hardware按attachment懒建一份来源，健康标记为false时missing，暂停/撤销停止来源，数据只含CPU/GPU名称、百分比、内存MB和网络字节速率；media只投影媒体元数据/位置/控制状态，源ID若为路径/URI/控制字符或过长则清空；audio只含level和muted，排除设备ID/名称。授权元数据不是读数许可，每个data请求重新校验。原生回复data是JSON本身，ISO日期不被Json.NET转型。

Core真实源码98/98和实际Windows采集通过；真实ReleasePlayer验证SDK读数经过当前私有data IPC，但夹具仍模拟Core回复。正式官方页面的连续provider、权限改变后恢复及完整Core/DOM仍待接线；最终7项人工门槛未据此通过。

## 正式宿主私有通信模块（2026-10-03，接线阶段）

native-host发送Player要求的JSON字符串，只接受固定私有WebView消息；每个请求绑定generation/session/global revision，64个pending、5s超时。身份变化、暂停或dispose取消旧请求、来源和计时器，旧回包不能结束新请求。方法字段严格受限，不接受作者值/权限/票据。每个consumer+数据能力复用单来源，一次data返回后再间隔1秒发下次请求；Core逐值重新授权，available仅32KiB/深度24JSON，其余状态剥离value。

能力watch每秒向Core重查，合并同消费者同作用域进行中的查询，只在公开状态变化时刷新iframe能力。个人撤权和再授权即便没有global revision变化也可停止/恢复读数；暂停停止watch，恢复从当前scope查询。该模块已在真实ReleasePlayer与完整SDK通过持续读数及同revision撤权/恢复，Core回包在该隔离夹具仍模拟。正式index/DOM与真实Core闭环继续接入，未代填最终7项验收。

## 正式原生页面与DOM适配器（2026-10-03，接线基础）

正式index/main/style/LivelyInfo已建立。main等待同generation/session/Room/installation的Core上下文及完整快照才挂载，重复context/旧snapshot不重建，撤销保留generation墓碑。原生暂停钩子可先于首context；恢复同一次同步调用先接受最新状态/合法新代次再释放，旧代次不能释放新宿主。畸形transition/deadline不占用主页面修订号。

dom-host从纯模型完整实例表收敛；所有iframe位于固定wrapper下，切页不重挂或改src。HTML媒体委托frame-host，四类素材使用media-host。官方资源只从当前inventory解析/content/<generation>/路径。每个global revision先invalidate并等回执，再更新DOM并发布递增私有inputVersion，Core接受后才启用动作；queue修订不重播动画。发布staleInput按新inputVersion最多8次、50ms可取消间隔重试。模型的SDK geometryVersion与私有输入发布版本独立。作者Widget本地矩形须在自身placement内，再平移到设计画布；global组矩阵绕画布原点作用于同一wrapper/图标。默认slide/fade/none回告完成，current只来自Core。

现有基础仅给默认动画的静止shared区域提供命中；旋转/斜切暂不发布矩形，不能以包围框冒充精确命中。移动中输入、遮挡裁剪、多图标同按钮、受控焦点及个人布局继续属于input-host/Task4，原要求不取消。此段保留原接线阶段的输入限制；当前desk.navigate、media.control/audio.control及storage均已接消费者专用Core适配，见文末。可信退出确认已接私有Core许可与原生确认窗，见文末；未实现能力仍报告unsupported。HTMLMediaElement与WebAudio原生逐iframe基础已在下节接入；完整生命周期仍继续。inert不作为媒体暂停证据。

生产组合91/91，真实ReleasePlayer整页验证两个SDK文档持续、Core-only提交、queue/private pause/latest revision和撤销释放。该夹具Core回复仍模拟；后续真实Core安装/重启证据见文末，物理输入/DPI与最终7项仍待执行。


## Player原生子文档音视频策略（2026-10-03，HTMLMediaElement基础）

Player在首航前注入自身嵌入脚本，捕获原始音视频、DOM、事件与观察器方法；所有子文档初始暂停，顶部官方页由media-host独立控制。私有不可重定义函数使用Player secret、实际文档nonce和单调序列，SDK token不能调策略。原生执行采用真实realm的this，不把私参暴露给作者可替换的globalThis/window别名。closed Shadow音视频与嵌套Frame使用同一原生根消费者；官方页在append前生成私有frame.name，Player按FrameId/父链绑定，根window.name更改后永久暂停该根与后代。消息只能从固定官方顶部文档进入，严格绑定当前generation/session/revision及已声明消费者；这不是新增作者能力或Core输入证明。

是否渲染由Core缓存的完整快照再次限定：current与target都可在过渡中播放，queued不能授权，starting/idle只放对应槽，锁屏/播放暂停拒绝。原生挂起先完成每个子文档与官方宿主暂停屏障，再显示当前WebView的内存静帧、隐藏WebView并调用TrySuspendAsync；暂停期间状态只缓存，恢复先交付最新Core状态再按活动根恢复原播放意图和位置。作者主动pause会清除意图，迟到play事件不把已暂停元素改回wanted。移除节点/pagehide/新文档nonce/旧序列不恢复旧媒体。Destroyed回调只撤销宿主记录，不重入原生COM注销；活体政策失败/超时则静音并关闭Player。

102/102 JS及真实ReleasePlayer的WAV、closed Shadow MP4、嵌套音频验证通过；Core回包仍为fixture。该阶段证据只涵盖HTMLMediaElement；后续WebAudio/AudioContext与生产Core原生安装/重启补证见下节。物理输入、完整生命周期与布局/DPI等门槛继续，不能宣称Task3/4或最终7项完成。网络、安全、个人授权和逐值数据校验仍各有独立生产边界。

## Player原生WebAudio策略与当前实机证据（2026-10-03）

首航前捕获AudioContext/webkitAudioContext构造、原生state/destination与resume/suspend/close、AudioNode连线。当前子文档创建的每个实时上下文有私有Gain输出闸门，默认/非活动即时为0并原生suspend。作者resume只记录活动意图，作者suspend/close清除意图；迟到resume再次核对当前政策，不能开启已停或已销毁输出。硬件destination连接经私有闸门，公开destination和connect返回身份保持原样，不给作者闸门引用。未被当前文档跟踪的context与硬件destination不能借本realm保护方法绕过政策；普通AudioNode/AudioParam连接保持原生行为。每文档最多128个live上下文，close释放配额，pagehide关闭并退役；OfflineAudioContext保持其离线语义。

暂停回执的settled须等实际所有live上下文suspended/closed与挂起回调完成，Player有界轮询私有描述后才挂起renderer；等待期间输出已经静音。活体失败仍走静音并关闭Player。私有记录数组不用作者Array索引setter/species路径；回执是null-prototype对象，不被Object.prototype.toJSON拦截或伪造。该策略不添加SDK方法，不代表数据、网络、存储或动作授权。

生产JS组合116/116与实际ReleasePlayer的根/嵌套AudioContext currentTime、作者意图、阶段/私有暂停/销毁和攻击回归通过；该Player夹具Core回包模拟。生产Rust安装→真实Core复核→实际WorkerW原生Room另外通过同文档切页/正常重启恢复，两新SDK文档AudioContext真实running，原用户桌面与数据精确恢复；顶部测试导航只计协议证据。真实Core证据早于最后null-prototype回执补强，补强后完整build与实际Player再次通过。完整idle/锁屏、独立Player故障、AudioWorklet、布局/物理输入/DPI及最终人工门槛不据此宣称完成。

## 消费者存储生产权威基础（2026-10-03）

Core已提供ReadStorage/WriteStorage及私有Player连接适配，SDK storage.get仍返回JSON，缺键为null；set(null)保存JSON null。存储按Room副本UUID/固定consumer/稳定key隔离，不返回个人目标或其他消费者值。读写分别逐次重新授权，检查当前session/revision/安装、声明、个人许可与活动事实；不能凭capabilities缓存授权。每值规范JSON32KiB/深度24/每容器4096项、每消费者128键/64KiB、个人总1MiB，超限拒绝而不改原文件。成功保存增加个人revision，发布失败storageUnavailable。旧个人format1缺字段默认空，损坏状态不重置。

110/110为该生产者阶段历史；当前严格storageGet/storageSet、正式DOM/SDK和实际Core授权KV已接通，撤权恢复、同安装重启读取与日志隐私验证见V3_DELIVERY。最终7项仍待集中人工验收。


## 当前系统控制私有IPC（2026-10-03，P5接线）

Dext.media.control只接受play/pause/toggle/next/previous；Dext.audio.control接受非空volume（有限0..1）/muted（boolean）patch，不能携带目标、路径、按钮、票据或原生序号。私有宿主固定consumer和当前generation/session/revision/geometryVersion，并从Core当前真实完成推导已声明button。逐次复核安装、阶段、原生1500ms期限、授权及私有绑定；作者控制仅可用没有默认/个人动作的声明入口，不能替换个人应用、导航或退出。

Core准备与一次证明消费是短私有提交边界，Windows/COM在锁外线程池执行。每consumer+capability最多10次/秒；rateLimited不消费。每attachment至多1、全Core至多4个任务，非阻塞admission；外层4s后controlUnavailable，原生5s期限仍有界。挂起任务在真正终止前持有槽位，不能用重建attachment绕过；已取消请求在媒体等锁/解析和音量设备解析后的写入前再次拒绝。无法撤回已经发出的系统调用，超时不伪造成功。

Accepted/controlUnavailable等回执的inputSequence/inputConsumed只在私有宿主使用，SDK仅有安全status/错误码。实际消费后服务失败也取消默认回退；未消费的拒绝保留当前配置入口fallback。已发动作在同代次/会话修订中可回执，暂停/换代次/会话/销毁全部取消。实际Core五媒体意图到达拥有的静音publisher、音量改动后恢复、8次输入一次消费与正常重启恢复已验证；人工物理输入、听音、完整生命周期与可信退出确认仍独立进行。



Player私有mediaControl请求字段：consumer/action/geometryVersion/inputSequence；audioControl为consumer/settings/geometryVersion/inputSequence。均叠加原IdentityFields且不容额外字段、重复JSON字段、假proof或陈旧identity；settings非空且字段仅volume/muted。Core传输DTO的MediaAction/Volume/Muted与导航Action独立，二次闭合校验后才派发。Core未成功消费不报告inputConsumed=true。系统控制status新增controlUnavailable/rateLimited，安全错误码沿frame-host回SDK。正式SDK/DOM/原生消息与Core最终140/35/168项通过，真实Core控制15项PASS。

## 可信退出确认接线（2026-10-03）

具有当前dext.exit授权的已声明入口，在真实一次输入通过后由actions.activate返回requiresConfirmation。官方宿主只接收安全状态和私有消费回执；确认续体只在Core内存中，JSON与Player/作者协议均不包含。作者没有confirmed/approved/token或confirmExit接口，作者自己绘制提示不能代替Dext确认。

Core原生确认窗使用固定Dext标题和退出说明、默认“否”；UI在授权锁外，全Core同时至多一窗。取消保持产品运行并消费许可；确认后按当前安装、私有连接、消费者/按钮scope、授权、个人动作、锁屏和文档代次重查。该可信窗口造成的失焦/播放暂停仅允许完成自己的退出决定，不能放宽其他动作，旧文档/换Room/重放/撤权均不能退出。

通过确认后Core发布独立产品退出状态，原生配置器核对所属Core产品/pipe/data/worktree及实际进程路径后正常退出；Core保留RPC三秒供正常响应的配置器观察，再走既有正常关闭Player/Watchdog/Core。普通配置器“退出Core”保持原语义，配置器仍运行。此通知有界等待，不强杀卡死的配置器；完整运行与最终人工退出门槛仍以本包验收记录为准。

## Task4四媒体暂停与Player故障恢复（2026-10-03）
暂停保留同一WebView、SDK文档和模型实例。原生Player在媒体屏障后只CapturePreview本WebView到内存Bitmap，由原生静帧展示保证GIF画面不动，隐藏WebView满足TrySuspendAsync前提；挂起为best effort，不把返回false当成动画已停。捕获/挂起各三秒有界，当前playbackRevision失败关闭本Player；旧意图不关闭新意图。恢复先Resume、最新Core快照/上下文、当前消费者媒体策略，最后显示原WebView并释放Bitmap。没有作者截图入口或磁盘图像。
Core私有Retire仅撤销易失会话/连接/订阅，保留已提交Desk checkpoint及个人KV。意外退出的已加载原生Player，经窗口加载锁后复核仍为当前失败对象、非主动关闭、非Core退出，复用正常安装校验/工厂/WorkerW启动；三十秒最多三次，失败不保存空布局。新PID/新session重新授权并Restore，旧完成/超时/输入不能复活。主动CloseAll与普通/产品退出不自动重生，闲置父窗还原失败使用故障终止路径。
实际Core四媒体各经过预暂停start、恢复、同安装Core重启、两次idle/暂停/恢复及OS鼠标wake/Core stop；图像/视频/HTML保持实例，视频与AudioContext时钟排除暂停时间。GIF owned Player中心像素在播放/暂停/恢复分别变化/固定/变化。独立Player Kill后的同Core重建恢复focus/stamp/KV；主动关闭不重生。证据见验收卡与V3_DELIVERY。实际锁屏/物理DPI、故障还原、个人布局和精确输入继续，最终七项不据此打勾。
