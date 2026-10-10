状态：做完（2026-10-10），模块已实现，main/Player接线归03。
新增task-area-host.js/task-area.css，默认不可用，收到显式可用且合法区域/数据后呈现。按下期间状态保留旧display，节点不重建；跨context/失效/隐藏取消；键盘Enter/Space、固定菜单和窗口标题选择、横向溢出可用。
主dom-host新增仅Dock可调用setTaskAreaOcclusion，沿原render屏障重发作者几何，边界与原生取样都扣除官方区域，清除后恢复且不重挂作者iframe。默认null不改变旧桌面输入。
证据：.build/task-area-dom-red.log缺按钮失败；task-area-dom-green.log真实headless Edge四组通过（模拟onAction，无Core）；task-area-occlusion-red.log目标assert失败；task-area-node.log新增模型与完整dom-host共71/71通过。
尚无实际Player/物理鼠标证明，未启用运行宿主。App图标目前是首字占位，03需接官方图标数据，不可宣称图标已完成。

独立复核发现返回按钮在刷新时丢点击，新增真实DOM复现task-area-menu-red.log失败；保留返回节点后task-area-dom-final.log五组通过。该修复只涉及新模块，没有替换当前运行的输入路径。
