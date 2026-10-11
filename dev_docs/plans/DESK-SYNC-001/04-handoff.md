# DESK-SYNC-001 构建与交接

状态：做完（实施交接完成，人工验收未完成）

实现：临时桌面混合夹具验证同名、去重、重复接入和原文件保留；必要构建及一次实际冒烟，记录人工验收缺口并提交。

- [x] 实现并记录涉及接口。
- [x] 执行必要检查，记录实际结果。
- [x] 更新状态并提交。

下一步：基于当前源制作完整候选并执行一次隔离实机冒烟，核对真实文件/文件夹/快捷方式与当前桌面图标显示、分组和原Dock点击；不能把模拟启动器调用当作实际Shell打开通过。保留用户Room/设置与原运行版，最后补交接差异及未验收事项。

## 交接结果

2026-10-11 DESK-SYNC-001第04步实施交接做完：927bff8生产源完整候选desktop-sync-clean-20261011构建通过，654文件/16宿主资源来源核对通过；候选本身未应用。隔离开发候选Core52052实际扫描117项，UIA限定Player窗口后确认临时文件夹图标显示、手动刷新数量保持、关闭后图标消失且源目录仍在，probe退出0。随后清理临时Room/目录，恢复原Core45136及原配置器19704，当前无活动Room。首轮全桌面UIA遍历卡住被终止，恢复流程和检查边界见04交接及#316。15项个人接口/99项Node/72项输入消息等前序证据仍有效；文件/快捷方式真实打开、重启配置及物理触控保留统一验收。实施4/4=100%待统一验收，未合master，唯一下一项DESK-SYNC-002。

- 完整正式候选：`D:/use/Orca/DEXT/DEXT_Core/.build/desktop-sync-clean-20261011`，生产源927bff8；没有诊断标记或临时Room。构建与来源核对日志：`.build/desktop-sync-clean-release.log` / `desktop-sync-clean-verify.log`。
- 实机仅使用隔离开发候选`desktop-sync-import-20261011`及既有49c12d19临时Room；一次空临时桌面目录用于显示识别，未打开用户个人文件。成功日志`.build/desktop-sync-live-retry.log`，恢复原运行版Core45136、配置器19704；最终RPC会话为空。
- 首轮`.build/desktop-sync-live.log`：Core39012扫描成功，但全桌面UIA查询遍历过久；正式CloseWallpaperLibrary/DeleteRoomPersonal清理临时Room后终止验收进程。首轮进程内原checkpoint备份未持久化，无法证明最初checkpoint字节完全恢复；残留的仅临时Room checkpoint，另存`.build/aborted-desktop-sync-checkpoint.json`，未猜写原内容。实际原运行版恢复为空桌面会话，用户Room文件及其他本机数据未改。此差异保留追溯。
- 修正版将UIA限定于Player HWND子树，WebView子节点不按Player PID过滤，查询最多5秒；测试前将checkpoint状态保存到磁盘。重跑备份`.build/runtime-recovery-6b0eb23f3c104d7fab4c522f58c8c427`，正常finally恢复了重跑前checkpoint并留下restored.txt。
- 更新测试入口：`desktop-sync-live EXPECTED_CORE_DIRECTORY FIXTURE_ROOM_ID`；恢复入口`cleanup-desktop-fixture`先核对Core与临时Room身份，只清理该夹具。恢复路径必须与SetWallpaper的Path.Combine分段结果一致。
- Rust打包产生Cargo.toml换行差异，核对与HEAD内容一致后恢复；无产品代码差异。

## 统一验收缺口

配置器实际操作、完整真实桌面外观/图标质量、文件/文件夹/快捷方式实际Shell打开、重启选择与布局、Room分享检查，以及原Dock/物理触控由用户统一验收。模拟原生输入和UIA可访问名称不替代这些人工步骤。后续自动监听、拖入、文件写操作仍在002/003/004。
