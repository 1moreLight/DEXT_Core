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

私有原生协议增加startupComplete：带当前runtimeGeneration/sessionId/revision及正整数lifecycleRevision，只允许结束当前starting阶段。Core保留暂停、锁屏、前台事实、已提交Desk与最终队列；旧阶段、旧文档或重复完成拒绝。只有可信Core新文档事件能重新进入starting，普通暂停/锁屏/闲置恢复不能重播start。闲置中重载可先播放新文档start，再回idle。同一实际文档ready只发送一次。生产媒体须在展示完成或规定超时后调用此入口，其DOM实现仍待Task3。

### 同Player闲置与宿主唤醒（P5阶段接线）

原生Room进入闲置时Core只改变stage，保留当前Desk、最终队列和Windows暂停/锁屏事实。屏保服务临时将当前Player置于对应显示器，保留同一文档；唤醒还原父窗、样式、坐标与层叠顺序，不另起原生屏保Player。Windows事实中的前台判断包含当前显示器上经核对的闲置展示，原桌面前台采样仍独立；退出展示后先移除此覆盖，再恢复desktop阶段。

原生闲置不因底层应用遮挡而暂停，手动暂停、锁屏、远程和电源规则继续生效。第一次RawInput仅唤醒，按住的鼠标/Enter/Space在松开前不得形成新激活。父窗已失效或还原不可确认时隐藏并关闭本Player，故障重建由后续恢复流程补齐。生产DOM需按idle阶段持续展示idle素材；没有idle时保持桌面画面，作者done不能唤醒。真实Core原生Room闲置、实际物理输入及多DPI门槛仍待最终集中验证。

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
