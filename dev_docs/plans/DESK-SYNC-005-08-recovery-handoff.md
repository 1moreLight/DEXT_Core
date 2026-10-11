# 005 第08步：运行与回退交接

状态：做完（3/3=100%，2026-10-12）；仅文档交接，未执行回退。
目标：下一会话能找到当前候选、唯一配置器和已验证备份。
范围外：实际回退、用户Room和缓存清理、重复功能验收。

## 当前身份

- 开发目录：`C:/Users/JAN/.codex/worktrees/desktop-background-menu/DEXT_Core`。
- 分支：`feat/DESK-SYNC-005-background-menu`；本记录基于文档提交`4de8b31`，后续交接提交以该分支`git log -1`为准。
- 主线：`71d4c33`，已验收文件菜单修复；005背景菜单/粘贴尚未人工通过，禁止合并。
- 生产源：`c74095b`；其后为探针/文档，不需要据此重建。
- 候选：`D:/use/Orca/DEXT/DEXT_Core/.build/longpress-edit-20261011-r5`。
- 最后启动观察Core42028、配置器42292；PID仅供历史定位，操作前必须重查路径与身份。两个Watchdog分别负责壁纸与任务栏恢复，不是重复Core。
- 当前入口：[V3_CURRENT](../V3_CURRENT.md)；[两组验收](../acceptance/DESK-SYNC-005-background-menu.md)。

## 启动与恢复

正常启动在上述开发目录执行：

```powershell
./scripts/start.ps1 -ReleaseDirectory D:/use/Orca/DEXT/DEXT_Core/.build/longpress-edit-20261011-r5 -CoreOnly
```

已有配置器保持一份。不得因文档提交重新启动Core；当前运行正常，无需执行以下回退。

确需回退005时：

1. 先以`verify-runtime-identity.ps1`及实际进程绝对路径确认当前候选；正常退出该Core并等Player退出。若无法确认身份，停止回退，不终止其他路径的同名进程。
2. 备份源为主项目`.build/before-background-menu`。之前只读核对确认65个变化文件全部匹配旧inventory摘要、没有新增清单路径、没有缺失备份。执行时重新确认备份与旧`release-inventory.json`相符，且每个相对路径解析后仍位于候选根目录。
3. 只将这65个已核对文件按原相对路径恢复到候选；最后恢复备份中的`release-inventory.json`。若中途失败，不启动半恢复候选，补齐并核对后再继续。不得覆盖安装的Room、个人数据或其他未列入变化清单的文件；不做递归删除。
4. 核对恢复后的清单文件大小/摘要，再用上述`-CoreOnly`入口启动。检查原Home恢复及身份日志；原配置器复用，不再开第二份。

回退目标是本包之前的已验收文件菜单版本，不是恢复旧鼠标/触控实现。主项目Room有未提交内容，保持原样；不得reset/clean或全量add。

## 完成记录

1. 做完：记录生产/主线/文档基线与启动入口。
2. 做完：复用65文件备份核对证据，写清失败时不启动半恢复候选。
3. 做完：文档入口检查；主项目`.build/current-handoff.md`保留跨工作区入口。00:59最终停止记录另见第07步。
