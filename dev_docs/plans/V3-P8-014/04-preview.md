# V3-P8-014 主题宿主原生窗口预览

状态：做完（实施；待统一验收）

实现：从ApplicationDockWindow.Preview和DockPreviewWindow提取可附着主题HWND的预览入口。Core验证官方任务当前身份，原生客户区/DPI转换锚点；生命周期和固定作用域一起撤销。

- [x] 写清并核对涉及入口和调用者。
- [x] 为具体行为增加必要失败检查，然后实现。
- [x] 执行相关检查并记录命令/结果；不外推范围。
- [x] 更新本步骤状态、TODO并提交。

完成证据：两窗口缩略图可选择正确窗口；关闭窗更新；跨Desk/隐藏/全屏/退出清理；作者不接收私人窗口数据。

2026-10-11 附着入口增量：DockPreviewWindow新增ShowForNative/FollowNativeAnchor，绑定原生Owner，读取真实客户区原点/宽度/DPI；无效或不可见宿主隐藏并释放缩略图。NativeAnchor检查覆盖125%坐标偏移、150%边界和无效输入，先红后绿；既有预览检查、完整Release通过。日志theme-preview-anchor-red/green.log、theme-preview-anchor-build.log。入口尚未接CompleteTask；后续需Core验证当前任务/Desk、打开原生预览时替换HTML菜单、预览期间保持自动隐藏展开、切页/隐藏/全屏/退出关闭及点击前二次校验。不得称用户已经能用主题缩略图，整包仍3/6=50%。

2026-10-11 动作/生命周期接线增量：CompleteTask已验证的openWindows接原生预览；打开用私有LeaveKeyboard清理HTML列表。当前宿主/会话修订/Desk固定作用域及任务投影每150ms复核，选窗前再次按HWND/PID/目标身份解析；窗口列表更新、离开650ms、切页/隐藏/全屏/宿主更换/退出清理。Player私有策略新增可空PreviewHoldMilliseconds，仅预览续约，最长1500ms自动失效，隐藏/全屏清零，不改变鼠标/触摸配对。预览/输入检查、19项官方入口/controller检查、最终完整Release通过；CoreOnly保持原Core52692。日志theme-preview-wiring-checks.log、theme-preview-input-checks.log、theme-preview-host-checks.log、theme-preview-wiring-build.log。尚无本增量实际双窗选窗/缩略图和跨Desk清理证据，仍开做，3/6=50%。下一步用隔离夹具实际点击打开原生预览并选择第二窗口，核对退出后无残留；不可把旧HTML菜单探针通过算新预览通过。

2026-10-11 实际选窗证据：无诊断标题的正式候选Core45248，UIA只读按钮位置后发送真实鼠标边沿，打开Core原生预览、悬停1600ms保持Dock展开、选择第二张卡激活精确自有窗口并关闭预览，通过且探针退出0。原运行版Core49448/设置/fixture/checkpoint恢复。首轮Core50508在任务栏接管和按钮启用前点击，未取得分发回执；等待实际启用/接管后通过，生产输入规则未改（#308补记）。证据fusion-native-preview-live.log，probe命令fusion-native-preview-live <candidate> <fixture-id>。图片内容观感、关闭目标窗口更新、跨Desk/全屏/锁屏/退出清理与物理触控仍列统一人工验收，未用选窗通过冒充整组通过。
