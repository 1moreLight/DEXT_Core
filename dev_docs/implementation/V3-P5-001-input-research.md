# P5原生输入接点研究（2026-10-03，仅研究）

只读agent input_boundary_map定位；未改生产代码、未构建、未操作Git、未开展全分支审查。源码行号为d1f9008附近快照。本文不代表物理输入已接通或已验收。

## 真实链与当前遗漏

WM_INPUT → RawInputMsgWindow → WinDesktopCore → MouseForwardingSession/InputUtil → Chrome_WidgetWin_1 → WebView DOM。

- RawInputMsgWindow.xaml.cs:73通过RawInputData.FromHandle(lParam)读取系统包；当前事件只保留坐标/按钮或键值/扫描码/Down，丢弃DeviceHandle、完整Flags和时序。鼠标坐标来自处理时GetCursorPos。
- WinDesktopCore.cs:1184只在桌面前台开始主按钮Down，Up发回原手势接收者；IsDesktop:1297只比较original_WorkerW/progman。
- Lively.Common/Helpers/MouseForwardingSession.cs:26保存HWND/显示器原点并拒绝重复Down，不含Player/session/geometry。InputUtil.cs:50最终PostMessageW；DOM已无法区别Core物理转发和直接HWND消息。
- Core/Wallpapers/WebWebView2.cs:340从Player上报WebView父窗查Chrome_WidgetWin_0/1；Core另持真实Process/PID。新身份应绑定该WebWebView2对象/私有桥，不能只存可能复用的HWND。

## 权威入口仍未实际调用

RoomActionAuthority.cs:68 IssueHostInput及:93 InvokeButton目前只有测试调用，生产仅DI注册。既有票据绑定connection/peer/session/consumer/button/install/global revision/personal revision，1500ms单调超时，一次消费；尚无RuntimeGeneration、geometryVersion、Down命中入口和Down→Up配对。

不能收到作者actions.activate后直接为它签当前票据。先由Core内部配对保存Down时的Player/session/revision/文档/几何/唯一按钮，Up再核验当前身份，才进入现有签发/消费。RoomSessionPlayerBridge持有私有connection/peer，是封装调用接点，不需把票据交给作者。

JS runtime-model.js:162/188有几何验证和invalidateInput effects，Core尚无实际接收存储。几何发布、配对核验和签发须同一版本边界，不能先检查后无锁签发。按钮重叠须由官方宿主按实际层级/裁剪选择唯一入口；任意作者矩形命中不能自动取得激活资格。刷新同session必须以runtimeGeneration取消旧Down/焦点/请求。

## 键盘与闲置的实施前置

- SettingsModel.cs:190默认InputForward=mouse；WinDesktopCore.cs:1214仅mousekeyboard转发键盘，按鼠标所在屏选择Player，尚无受控焦点入口。
- RawInputMsgWindow.xaml.cs:115用Flags != Up全值比较；E0|Up会误判Down。后续实现需按Up位判定，保留E0/E1；InputUtil.cs:74目前所有键都设extended位。
- Enter/Space按住重复Down只能消费一次；当前焦点不能只信作者focus消息，需要官方焦点路由与真实Tab/点击配对。
- 同Player idle提到前台应用上层后不能沿用仅Progman/WorkerW的桌面前台判断。唤醒输入是否同时激活动作须明确（优先只唤醒），并在生命周期入口贯彻。

## Windows来源与几何限制

ExInputSink只在前台未注册处理该类原始输入时投递后台，不是无条件全局源。精密触摸板的hDevice可为0，不能一律以非0认物理。RawInput没有低级钩子的injected标志；如门槛包含系统SendInput拒绝，须实际决定/验证与LLMHF_INJECTED/LLKHF_INJECTED证据关联，不能从WM_INPUT推论完成。此范围不扩大为防任意本机原生程序。

WinDesktopCore.cs:1251屏幕→Player仅减屏幕原点，而Form1.cs:165设置独立RasterizationScale。需读取当前client bounds/viewport/缩放校准，不能默认screen delta/devicePixelRatio永远正确。WebViewProbe/RoomReorderProbe通过PostMessage，只能证明原生消息转发，不能证明物理出票。

官方来源：
- RAWKEYBOARD Flags可组合：https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawkeyboard
- ExInputSink条件：https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputdevice
- hDevice可为0：https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-rawinputheader
- injected来源标志：https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-msllhookstruct
- PostMessage与SendInput区别：https://devblogs.microsoft.com/oldnewthing/20250319-00/?p=110979

## 后续实际门槛

物理主按钮/Enter/Space一次成功；JS合成、直接PostMessage、重放不得出票。Down后切页/改几何/刷新/锁屏/换Player，旧Up拒绝。DPI/坐标校准验证当前主屏契约；副屏/负坐标为后续扩展证据，不擅自扩大首发主屏范围。全部仍待Task2/4执行。
