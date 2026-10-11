# DESK-SYNC-004 回收站删除

状态：做完（代码实施，实际桌面验收待做）

DesktopShellActions.DeleteToRecycleBinAsync(paths,owner,cancellation)使用IFileOperation回收标志并检查支持回收语义，不能回收的目标提示/拒绝，不降级永久删除。Delete仅针对当前选中项；Shift+Delete不提供永久删除入口。逐项取消/失败保持源与选择信息，成功由目录监听移除图标。定向临时文件验证回收站项目可恢复；禁止清空用户回收站。

- [x] 失败用例与实现
- [x] 代码接线、真实Shell夹具回收还原及定向检查；实际桌面仍待验收
- [x] 记录证据并提交工作分支

2026-10-11 第04步回收站开做：IFileOperation启用FOFX_RECYCLEONDELETE/撤销记录，并在PreDeleteItem核对回收标志；未提供回收语义返回错误，禁止退化永久删除。先限制真实本地固定卷文件项，当前不支持回收的目标明确失败。逐项结果保留已完成项，取消/当前Desk失效停止后续项。自动验证仅使用D盘本轮唯一临时文件和文件夹，回收后通过Shell仅还原这些夹具，再检查原内容；不清空回收站、不读取或修改其他回收项内容。随后接Delete当前所选ID和独占原生输入，Shift+Delete不提供永久删除。
参考：[SetOperationFlags](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileoperation-setoperationflags)、[PreDeleteItem](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ifileoperationprogresssink-predeleteitem)。

2026-10-11 第04步代码实施做完（待统一桌面验收）：Delete当前多选→原生一次证明→Core扫描ID解析→STA IFileOperation回收→逐项提示接通。采用RECYCLEONDELETE及撤销记录，PreDeleteItem缺回收标志直接拒绝；非本地固定卷/卷根不降级永久删除。Shift+Delete在有效同步文件焦点下由独占键盘链接收，Core不批准删除、页面提示使用Delete；不缩小多选，不增加永久删除命令。成功由目录监听移除图标，失败项保留，普通暂停保留回执，作用域退休取消后续操作。
证据：Shell实际唯一临时文件/目录回收并精确还原、原字节/子文件保留、预取消/失效/缺失源/回收标志检查9/9；夹具还原后删除本轮临时目录，无用户文件/回收站清空。DOM原Shift+Delete缩小选择的失败断言→宿主116/116；Core原Delete无证明失败→23/23；键盘独占9/9、私有消息79/79、指针18/18。完整Core/Player/Watchdog Release通过（desktop-shell-actions-build-env/recycle-build.log）；首次完整构建发现switch局部变量pasted重名，修复为recycled，失败日志保留recycle-build-failed.log。测试STA返回类型与共享回调匹配问题均在实际Shell执行前修正。
运行：start.ps1仍因主目录Debug Core26668占用身份退出1，未部署新候选、未启动配置器。代码4/6≈67%，路线2/4=50%，下一执行步骤05原生右键/属性；真实键盘独占、取消对话框、Explorer互通及鼠标/触控/DPI仍待统一验收，#330间歇存储问题未宣称修复。
人工步骤：在同步Desk只用唯一临时文件/文件夹，单选或多选后Delete，从回收站还原并核对内容；取消操作或目标不支持回收时源应保留，Shift+Delete无永久删除；随后检查Dock、作者按钮、切页、鼠标和触控。
