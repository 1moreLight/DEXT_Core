# V3-P8-014 主题宿主原生窗口预览

状态：开做

实现：从ApplicationDockWindow.Preview和DockPreviewWindow提取可附着主题HWND的预览入口。Core验证官方任务当前身份，原生客户区/DPI转换锚点；生命周期和固定作用域一起撤销。

- [ ] 写清并核对涉及入口和调用者。
- [ ] 为具体行为增加必要失败检查，然后实现。
- [ ] 执行相关检查并记录命令/结果；不外推范围。
- [ ] 更新本步骤状态、TODO并提交。

完成证据：两窗口缩略图可选择正确窗口；关闭窗更新；跨Desk/隐藏/全屏/退出清理；作者不接收私人窗口数据。

2026-10-11 附着入口增量：DockPreviewWindow新增ShowForNative/FollowNativeAnchor，绑定原生Owner，读取真实客户区原点/宽度/DPI；无效或不可见宿主隐藏并释放缩略图。NativeAnchor检查覆盖125%坐标偏移、150%边界和无效输入，先红后绿；既有预览检查、完整Release通过。日志theme-preview-anchor-red/green.log、theme-preview-anchor-build.log。入口尚未接CompleteTask；后续需Core验证当前任务/Desk、打开原生预览时替换HTML菜单、预览期间保持自动隐藏展开、切页/隐藏/全屏/退出关闭及点击前二次校验。不得称用户已经能用主题缩略图，整包仍3/6=50%。
