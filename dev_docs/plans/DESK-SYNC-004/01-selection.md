# DESK-SYNC-004 选择状态与焦点

状态：开做

新增wallpapers/dext-room-v3/desktop-selection.js及desktop-selection.test.js：createDesktopSelection()提供update(scope, ids)、select(id, {ctrl,shift})、clear()和read()，返回selectedIds/focusedId/anchorId。保持输入顺序，Ctrl切换，Shift按可见槽位范围，Ctrl+Shift追加，后台刷新裁剪消失项，换scope清空。将模块接dom-host官方图标选中样式/aria-selected；经原生激活消息单击选择，作者入口不改。先写状态用例得到明确失败，再实现、接线并跑定向Node检查。焦点不在同步图标层时不处理文件快捷键；页切换必须重算可见范围。完成标准包含DOM接线与原生输入路径，不以纯模型检查代替。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交

2026-10-11 第01步增量：新增desktop-selection.js，提供update/select/clear/read，单选、Ctrl切换、Shift范围、Ctrl+Shift追加、同scope刷新保留/裁剪、换scope清空、未知项拒绝与快照隔离7项通过。首次运行因模块缺失明确失败，实现后7/7通过，日志.build/selection-red.log与selection-green.log。尚未接DOM/原生输入，不能称多选已可用；后续需同时更新index.html、v3-release-assets.json及DextNativeResourceServer.cs官方资源白名单。原Core与配置器未启动或更换。01仍开做，0/6，整体2/4=50%。

2026-10-11 第01步原生输入增量：RoomNativeInputGesture/Proof保留按下瞬间的Ctrl/Shift（内部位1/2）及完成的Key；WebWebView2在现有MouseDown入口转换Windows MK_CONTROL/MK_SHIFT，无新增输入层、无DOM鼠标替代。新增断言先因缺API/字段编译失败，实现后foreground-return四组（Desktop/Dock × sampled/direct）通过，含失焦后重新点击；完整Core/Player/Watchdog Release成功，日志D:/use/Orca/DEXT/DEXT_Core/.build/desktop-shell-actions-build-env/core-build.log。新分支缺失的bin/obj目录链接到D盘，已有目录不移动；TEMP/TMP置D盘。start.ps1 CoreOnly继续旧候选。
尚未向JS私有activate事件发布新字段，选择模块仍未加载，不能称多选或双击已可用。下一步：native-host事件字段验证→Core NotifyNative字段→dom-host选择/范围/双击（读取系统时间与矩形）→资源白名单与发布清单；作者/Dock单击保留。01继续开做，0/6，路线2/4=50%。