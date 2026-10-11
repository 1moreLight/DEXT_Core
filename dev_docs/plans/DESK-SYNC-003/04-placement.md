# DESK-SYNC-003 运行时与落点

状态：开做

Core当前同步Desk授权目标和操作结果，落点附近空槽摆放；002扫描负责内容确认，避免双份图标；停用/切Room/退出拒绝迟到操作提交，文件操作状态可见。

- [ ] 实现或验证
- [ ] 必要检查及证据
- [ ] 记录并提交

2026-10-11页面接线增量：native-host.dropFiles只通过WebView2 AdditionalObjects发送文件对象，JSON仅含身份、Desk、坐标和效果；在途文件回执保留跨普通暂停/修订，换会话或销毁仍撤销。顶层container拖放验证当前同步页，非文件事件不干预，无效文件事件阻止默认导航；处理/完成/部分失败/取消提示与监听清理完成。
宿主101项测试通过（.build/drop-host-green.log），其中新增文件对象引用、暂停与修订回执、切页拒绝和dispose解绑。未更换原运行版，尚未实际Player端到端验证。
待做：落点槽位保存；作者iframe覆盖区的真实拖放命中；Explorer/OLE最终效果与源文件责任验证。DOM drop主动置none只是实现意图，不能据此断言OS源收到none。默认光标提示暂沿用浏览器效果，Core实际同卷判断不能由这个提示测试替代。
参考：[WebView2文件对象通道](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/javascript/webview)、[Shell拖放完成责任](https://learn.microsoft.com/en-us/windows/win32/shell/dataobject)。
