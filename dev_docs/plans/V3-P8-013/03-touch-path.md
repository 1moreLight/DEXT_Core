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
