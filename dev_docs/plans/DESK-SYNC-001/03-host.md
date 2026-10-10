# DESK-SYNC-001 图标呈现与配置器入口

状态：开做

实现：一键接入/关闭/手动刷新；真实名称与图标显示在官方图标层，点击由Core打开；保持已有Desk和Dock鼠标/触控路径。

- [ ] 实现并记录涉及接口。
- [ ] 执行必要检查，记录实际结果。
- [ ] 更新状态并提交。

## 增量记录

2026-10-11 DESK-SYNC-001第03步增量：后台STA读取Windows Shell名称/PNG图标；Core私有路径映射与官方显示快照分离，以会话/Room/安装/Desk及扫描票据拒绝迟到结果。16项扫描/快照检查、真实临时文件与文件夹Shell图标检查、完整Release构建通过；CoreOnly确认原Core49448仍运行，无新配置器。运行时服务、配置器按钮和官方桌面显示/打开尚未接完，03保持开做，实施2/4=50%。

证据：`.build/desktop-catalog-green.log`、`.build/desktop-shell-icons.log`、`.build/desktop-catalog-core-build.log`。这些是底层检查，不代表用户桌面已经显示同步图标。

2026-10-11 DESK-SYNC-001第03步本机接口增量：现有EditRoomPersonal JSON通道新增setDesktopSync(deskId,enabled)，沿用当前会话/安装的原子编辑；编辑器快照返回本机同步选择与保存条目数。真实Desk校验、相同设置不写盘、切Desk及关闭保留槽位/原应用绑定，12项个人编辑检查通过（新增用例先红后绿）。完整Release退出0，CoreOnly复核旧Core49448，无新配置器。扫描服务发布、刷新、UI及桌面渲染/打开仍待接，实施2/4=50%。

接口复用：Tauri `edit_v3_personal` → 既有gRPC `EditRoomPersonal` → `RoomActionAuthority.EditPersonal`；无需新增proto。证据：`.build/desktop-editor-red.log`、`desktop-editor-green.log`、`desktop-editor-core-build.log`。设置入口未挂UI，不能据此宣称一键导入已可用。

2026-10-11 DESK-SYNC-001第03步运行时扫描接线：Room就绪与setDesktopSync/refreshDesktopSync本机编辑触发后台扫描、Shell元数据和私有快照发布；新请求取消旧请求，退出取消并清空。扫描提交复核当前会话/安装、设置版本、启用状态与同步Desk，过期扫描不写排列；现有13项个人编辑检查及完整Core Release通过。CoreOnly复核旧Core49448，无新配置器，尚无新版真实Room导入实测。官方桌面快照输送/图标层/打开与配置器按钮仍待，实施2/4=50%。

检查日志：`.build/desktop-scan-commit.log`、`.build/desktop-worker-core-build.log`。当前版本在扫描期间个人设置被其他写操作更新时会拒绝本次结果，显式刷新可重试；后续UI接线需呈现刷新状态，不能把无结果当导入成功。

2026-10-11 DESK-SYNC-001第03步显示通道：扫描结果接入官方presentationRead私有回包，按会话/安装/同步Desk/启用状态过滤；desktopContextId命中时不重复传图片，官方页面缓存结果并在关闭时清理。14项个人接口检查和97项Node检查通过，Core/Player完整Release通过。修正Player原1MiB回包限额与图标批次不匹配，仅presentationRead允许4MiB；其余请求保持原限额。原Core49448保留，无新配置器。当前只是通道与缓存，不是图标已绘制/可点击；图标层、物理动作和UI仍待，实施2/4=50%。
