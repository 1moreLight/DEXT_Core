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
