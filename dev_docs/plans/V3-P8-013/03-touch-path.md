# V3-P8-013 触控输入路径核查

日期：2026-10-11。状态：开做；工作包仍2/4=50%。

## 已确认

- `touch-path`仅使用自有无激活WinForms窗口，注册本进程RawInput鼠标接收，注入一组Windows触摸；结束释放触点、注销注册、恢复原焦点/光标。
- 实测：pointerDown=1、pointerUp=1、GetPointerInfo成功=2、兼容mouseDown/up各1、rawMouseDown/up各1。此结果只证明该测试窗口的系统注入路径，不代表物理触屏或WebView2。
- `fusion-touch-live EXPECTED_CORE_DIRECTORY FIXTURE_ID`复用正式Core/Player和自有目标窗口，通过InjectTouchInput触摸官方任务按钮；首项激活失败，当前Core日志没有Dock raw边沿。激活/最小化/恢复均不能标完成。
- 构建通过；证据`.build/touch-path-build.log`、`touch-path-live.log`、`fusion-touch-build.log`、`fusion-touch-live.log`、`fusion-touch-core.log`。原候选/偏好/Room/checkpoint/光标已恢复，无新增配置器。

## 接入约束与下一步

1. 现有鼠标使用Core RawInput配对；保留这条已工作的路径，触摸不能靠放宽鼠标时限或DOM onAction直通来冒充完成。
2. 先核对真实WebView2触摸事件落在哪个HWND/线程，以及是否产生兼容鼠标；普通Form的结果不能外推。
3. GetPointerInfo必须在拥有接收窗口的线程当前消息内读取，不能从Core用Player上报的pointerId补查；跨进程Chromium子窗口也需实际核对归属。
4. 不使用RegisterPointerInputTarget作为局部Dock接法：它是全局重定向且要求UI Access，与保护其他应用触控的目标不符。
5. 若普通WebView2控制器无法给宿主原生触摸入口，再评估局部CompositionController接入；先做小型可运行验证，不直接替换产品宿主。
6. 成功标准仍为实际官方任务触摸激活/最小化/恢复、滑动取消、离开目标取消、切Desk/隐藏取消；Windows注入验证与用户物理触屏验收分别记录。

## 官方依据

- [GetPointerInfo：调用线程与窗口所有权限制](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getpointerinfo)
- [RegisterPointerInputTarget：全局重定向](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerpointerinputtarget)
- [InjectTouchInput：触点状态和取消](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-injecttouchinput)
- [Windows Touch兼容鼠标事件说明](https://learn.microsoft.com/en-us/windows/win32/wintouch/troubleshooting-applications)

首次探针注入参数返回87；调整为pointerId=0并提供有效接触矩形后通过，不能将先前参数失败解释为系统不支持触控。曾有一次执行命令自动审批超时而未执行，按工具允许重试一次成功，没有绕过拒绝。

2026-10-11：鼠标EXINPUTSINK改INPUTSINK后，实际前台RawInput注册窗口的Dock最小化已通过；后续激活被工作区反馈循环打断。触控同例仍未收到RawInput边沿，不能将鼠标修正计为触控接通。

2026-10-11几何反馈修复后复核：实际Dock位置不再往返，但触摸激活仍失败，Core原始鼠标边沿0；因此下一步继续追踪WebView2窗口/线程原生触摸入口，不能再归因任务栏抖动。日志20261011_023315.txt。
2026-10-11触点归属与观测边界：探针记录实际命中Chrome_RenderWidgetHostHWND属于Chromium PID46936/TID49504，其父Chrome_WidgetWin_0及Form属于Player25508/TID1316。候选专用main.js记录DOM touchEvents，最新为空且inputEnabled=false；代码复核installOfficial在预注入capture gate对无expected事件preventDefault/stopImmediatePropagation，故后置监听为空不能证明浏览器未收到触摸。下一步在守卫入口添加只读诊断，保留配对判定，不直接放行DOM、不据此重写CompositionController。探针构建通过；fusion-touch-live仍失败并完成清理，证据.build/touch-target-build.log、.build/fusion-touch-live.log、Core日志20261011_023904.txt。生产代码本轮未改，03仍2/4=50%。
参考已核对：Microsoft ICoreWebView2Environment3说明CompositionController由parent HWND接收指针并转发；这只提供候选架构，不证明当前控制器无法实现。https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2environment3
2026-10-11守卫入口诊断结果：新增私有diagnostics计数查询与Player差异日志，实机Core49620/Player49636记录touchDown=1、touchUp=1、touchBlocked=3（含兼容click），官方页也记录trusted touchstart/end。因此浏览器确已收到真实触摸；Core依赖鼠标RawInput未建立对应手势，守卫按当前规则拦截。无需据后置监听为空直接换CompositionController。下一步设计并接入守卫可信触摸→Player→Core的专用配对通道，仍须保留真实顶层文档/会话/坐标/按下抬起/取消检查，不能直接DOM onAction放行。当前触控激活仍失败。最终Release构建与29项现有守卫测试通过；证据.build/touch-gate-build.log、touch-gate-tests.log、fusion-touch-live.log和20261011_024500.txt。原候选Core25612恢复，无新增配置器；03仍开做2/4=50%。

## 专用触摸通道实施步骤（2026-10-11）
- 做完：预注入观察器读取原生PointerEvent getter及isTrusted，单指DOWN/UP，6 CSS像素移动取消，多指/取消/页面离开撤销；仅私有原生握手启用。
- 做完：Player验证私有token、当前documentNonce及递增序列，带当前会话发送归一化触点；Core读取实时原生窗口后换算坐标。
- 开做：Core分别持有触摸与鼠标所有权；触摸经过现有可见窗口/几何/任务投影/取消校验，不依赖当前鼠标游标位置或鼠标物理按键；禁止用全局触摸重定向。
- 开做：实际单指激活/最小化/恢复与移动、多指、隐藏、切Desk取消；原鼠标回归。官方任务触控先接通，作者区域必须继续排除，作者按钮触控另按已有契约验证，不能把一个子用例当全包完成。
2026-10-11触摸观察器增量：observeOfficialTouch捕获原生Event/PointerEvent/MouseEvent getter，默认关闭，私有touchEnable/touchDisable启停；真实单指DOWN/UP递增序列，6 CSS像素外移动、多指、pointercancel、lostpointercapture、pagehide、尺寸变化取消。消息仅含触点/视口/序列和私有文档标识，不直接调用动作。新增7项行为检查，与已有29项守卫检查合计36通过；最终7项复核及Release通过，证据.build/touch-observer-tests.log、touch-observer-final-tests.log、touch-observer-build.log。尚未启用：Player接收验证和Core触摸所有权/配对仍待接，不能称实际触控已通；旧Core25612保留，03仍开做2/4=50%。
2026-10-11触摸端到端接通：私有握手绑定当前generation/session/revision/documentNonce，Player解析并过滤旧序列，独立IPC去掉私有token后进入Core。Core按实时HWND/视口换算触点坐标，独立持有触摸联系并复用现有DOWN/UP采样、任务投影及动作完成；隐藏/未就绪/断连/会话变化/过期清除。首轮探针因等待就绪后仍用旧窗口origin而未注入，修正为注入前重测，归属检查保留。最终Release及探针构建通过；实际Core40296/Player45652的Windows注入触摸：拖动取消、激活、最小化、恢复、随后第一下鼠标点击均通过。证据.build/touch-bridge-build.log、touch-bridge-probe-build.log、touch-bridge-observer-tests.log、fusion-touch-live.log。物理触屏、多指/隐藏/切Desk实机取消、鼠标游标远离时触控及作者区域仍待验收；不能把Windows注入成功称为物理触屏通过，03仍开做、工作包2/4=50%。原运行候选/偏好/夹具已恢复，无新增配置器。
