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
2026-10-11：隐藏WebView2沙盒iframe命中→顶层drop→生产native-host.dropFiles→AdditionalObjects→生产Player文件读取贯通，路径与临时源一致。只验证浏览器CDP路径，实际OLE及落点仍待。

2026-10-11落点保存接通：新增RoomDesktopSync.PlaceDropped按目标分页优先、格心距离选空槽，保留原图标，允许纠正监听先分配给本次新文件的临时槽位。Core按原生视口/DPI与页面归一化落点计算槽位，实际Shell成功的目标路径转私有ID；排除拖入前已存在ID。当前会话/同步Desk原子写入personal存储，停用或切页拒绝迟到位置；已显示视图换context刷新，新项由目录监听补齐。页面携带分页并保留同Desk刷新后的当前组；位置失败与文件完成分别反馈。
验证：槽位20项、个人编辑19项、私有IPC76项、宿主101项通过；完整Core/Player Release成功。日志drop-placement-green/drop-placement-store-green/drop-page-message/drop-page-host/drop-placement-core-build。高DPI实机落点、多屏、真实Explorer/OLE效果未验证，本步仍开做，0/5。
2026-10-11反馈链修复：发现Player暂停时只发出desktopDrop却丢弃其结果，统一请求/回包允许集合为layoutRead、presentationRead、desktopDrop。新增检查先失败后通过，77/77消息检查和完整Release成功；未切当前运行Core。真实暂停拖放待验收，见ERRORS #322。
