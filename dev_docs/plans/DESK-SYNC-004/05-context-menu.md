# DESK-SYNC-004 原生右键与属性

状态：开做

新增DesktopShellContextMenu.cs：IShellFolder/GetUIObjectOf/IContextMenu菜单在STA且具备消息转发窗口；IContextMenu2/3消息正确转发，支持Unicode InvokeCommand、取消关闭、属性和混合公共/用户目录选择。位置来自Player当前真实窗口/DPI，不使用作者坐标作为任意系统点击。右键未选中项先单选，已选中项保留多选；键盘菜单键/Shift+F10同路径。右键输入扩展独立于既有左键/触控，作用域退休关闭菜单；Shell扩展异常返回可重试错误。

- [ ] 失败用例与实现
- [ ] 实际接线及必要检查
- [ ] 记录证据并提交

2026-10-11：先验证真实 Shell 菜单会话（单项、同目录多项、混合目录、Unicode 属性动词及释放），仅查询临时文件菜单，不显示弹窗或执行命令。随后接原生消息转发、菜单选择、右键/菜单键和退休取消；保留现有鼠标左键与触控。IShellItemArray 的 BHID_SFUIObject 文档仅支持同目录，不能直接用于混合公共/用户桌面；以 Shell 桌面命名空间为共同父级验证默认菜单。

### 后端增量（开做，未接入桌面）

- [x] 真实Shell菜单查询与单项/同目录/跨目录多选；临时文件字节保持、STA释放、删除/复制分流检查14/14。
- [x] IContextMenu2/3转发、Unicode命令、TrackPopup退休取消代码及完整Release构建。
- [ ] 原生owner消息窗口、右键/菜单键、当前选择与动作接线。
- [ ] 真实弹窗/动态子菜单/属性/外部点击取消/屏幕坐标与DPI门槛。查询检查不能替代。

证据与局限详见本包验收卡2026-10-11菜单后端增量；原生静态菜单WM_INITMENUPOPUP可返回E_FAIL，不能要求每条初始化消息都必须被扩展处理。当前运行Core26668保留，本轮候选未部署。人工步骤沿用验收卡第5、6项。

参考：[SHCreateDefaultContextMenu](https://learn.microsoft.com/en-us/windows/win32/api/shlobj_core/nf-shlobj_core-shcreatedefaultcontextmenu)、[IContextMenu3消息](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-icontextmenu3-handlemenumsg2)、[Unicode命令结构](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/ns-shobjidl_core-cminvokecommandinfoex)。

### 菜单键接线增量（实施已写，05仍开做）

- [x] Apps/Shift+F10独占原生键盘、私有desktopMenu、当前所选ID一次证明与多选保持。
- [x] Core STA零尺寸原生owner、菜单消息转发、坐标及已有文件动作接线；完整Release构建通过。
- [ ] 鼠标右键单独接同一菜单入口；避免Explorer重复弹菜单，保持原左键/触控。
- [ ] 真实菜单焦点/属性/动态子菜单/外点和Esc取消/退休/DPI统一验收。

Core24/24、原生菜单键12组、键盘所有权10/10、宿主117/117、消息79/79、指针18/18。当前Core26668保留，新候选未部署；完整证据与人工步骤见验收卡同日菜单键增量。
