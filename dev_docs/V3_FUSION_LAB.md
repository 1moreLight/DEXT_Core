# V3 融合实验室

状态：样包已写，Core安装校验和后台DOM检查通过；真实Player与触屏尚未验收。对应工作包V3-P8-013步骤03（开做），总进度50%。

## 文件和用途

- `rooms/v3-fusion-lab/room.json`：独立API1作品，ID `4df04f4e-68d6-4c4c-a52f-013f0510a001`。
- 作者的 `dock/index.html` 只包含桌面导航。中间留白由正式宿主根据 `config.dextTaskArea` 放入官方应用任务区；样包不包含应用清单、程序路径或模拟应用。
- 共三页：共享（宽任务区）、专注（通过componentOverrides变成窄任务区）、留白（无Dock，用桌面“下一页”回到共享）。
- 原有六个冻结样包及主工作区个人Room未改。

## 当前限制

当前运行候选仍为c3e168c。本分支的Core任务消息仍为ActionsEnabled=false；导入此样包或在浏览器打开作者HTML，不会自动启用应用操作。P8-013继续原生输入与真实Player验证，P8-014再提供正式native/theme选择和单宿主切换。不得把浏览器中注入的测试快照截图当作真实应用操作证据。

## 开发复现

在当前工作分支的DEXT_Core目录：

1. `node tests/v3-task-area/fusion-sample.cjs`：读取真正样包的作者iframe和官方任务DOM，在1440×120、960×88检查导航无重叠、宽/窄列表滚动、反向进入和无Dock隐藏。测试数据只在后台浏览器生成。输出 `.build/fusion-sample-dock.png` 与独立安装快照目录。
2. 首次使用ProtocolTests项目先 `dotnet restore tests/Dext.RoomSession.ProtocolTests -p:NuGetAudit=false --ignore-failed-sources`。
3. `dotnet run --project tests/Dext.RoomSession.ProtocolTests -c Release --no-restore -- --verify-install .build/fusion-sample-installed`：使用生产RoomV3Installation验证API1清单、配置、资源摘要与文件闭包。没有应用壁纸、修改本机固定项或启动配置器。

## 后续统一人工步骤

沿用 `acceptance/V3-P8-013-theme-task-area.md`：同栏导航/应用操作；按下刷新或切页不误触；遮挡及鼠标/触摸/键盘；菜单/窄栏/全屏隐藏/退出恢复。该样包提供操作场景，四项均尚未记录通过。

## 真实 Release Player 边界探针

`dotnet run --project tests/Dext.Input.Tests -c Release --no-restore -- --v3-task-wire <ReleasePlayer.exe绝对路径> wallpapers/dext-room-v3 rooms/v3-fusion-lab`

使用正式宿主/样包及Player代码；Core快照、几何回执和物理边沿由测试进程模拟，不执行操作系统应用动作。非全屏时会短暂唤出隔离的autohide栏，再关闭并恢复鼠标；不注册AppBar、不改本机Room、不启动配置器。

若当前前台全屏，只验证私有快照到达及任务区不可用，并明确SKIP可见鼠标/键盘分支。该输出不能计作输入验收。全屏窗口由用户决定何时退出，测试不主动切换前台。

2026-10-11已知结果：全屏解除后快照、显示、键盘取样及官方菜单通过；鼠标回执仍会超时，探针当前在该阶段报失败。不要用前两项PASS声称整条输入通过。已修复恢复遮挡确认竞态（#295），实际Core的ActionsEnabled仍为false。
