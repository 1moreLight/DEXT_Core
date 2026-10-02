# Room v3 作者 API v1

> V3-P5-001开发中：SDK、纯运行模型及Core已验证不可变RuntimeContext/私有Player读取已实现；版本化生命周期与完整Player快照IPC已接通；Windows事件、RuntimeContext传入Player、资源/输入边界与DOM适配仍在Task2–4。自动测试不代表原生宿主已经交付。状态见V3_DELIVERY。

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
