# V3 融合实验室

状态（2026-10-11）：样包及正式任务区已实现；隔离实际Core的鼠标、注入触摸、键盘和多窗口操作已有证据，物理触屏和整包人工验收未通过。步骤03开做，总进度50%；当前交接看 plans/V3-P8-013/04-handoff.md。

## 文件和用途

- `rooms/v3-fusion-lab/room.json`：独立API1作品，ID `4df04f4e-68d6-4c4c-a52f-013f0510a001`。
- 作者的 `dock/index.html` 只包含桌面导航。中间留白由正式宿主根据 `config.dextTaskArea` 放入官方应用任务区；样包不包含应用清单、程序路径或模拟应用。
- 共三页：共享（宽任务区）、专注（通过componentOverrides变成窄任务区）、留白（无Dock，用桌面“下一页”回到共享）。
- 原有六个冻结样包及主工作区个人Room未改。

## 当前限制

用户运行候选仍为c3e168c。本分支已按任务栏/窗口就绪状态启用ActionsEnabled；实际证据来自隔离候选及专用夹具，未部署为用户正式运行版。P8-013剩余操作见 plans/V3-P8-013/03-remaining.md，P8-014继续正式native/theme选择与单宿主切换。浏览器预览不会启动系统应用，后台快照截图也不构成实际操作证据。

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

历史阶段结果（后续修复见下文及当前交接）：全屏解除后快照、显示、键盘取样及官方菜单通过；鼠标回执仍会超时，探针当前在该阶段报失败。不要用前两项PASS声称整条输入通过。已修复恢复遮挡确认竞态（#295），实际Core的ActionsEnabled仍为false。

2026-10-11鼠标回执问题已定向修复（#296）：外层Dock与WebView anchor可见，但Chromium实际input HWND隐藏；页面DOM取样成功不能证明真实显示/点击。同步controller.IsVisible后，最终无临时guardian日志的Release构建、隔离实际Player鼠标DOWN/UP同目标回执、Tab/Enter及官方菜单、隐藏/再次显示、无抢前台通过。恢复时探针补发新Core任务快照，保持暂停撤销操作许可的规则。证据：.build/task-visibility-red.log、task-visibility-final-build.log、task-visibility-final.log。旧“鼠标回执未定位”条目为历史，本次解决该故障。实际Core RawInput/OS动作及触屏仍待做，ActionsEnabled生产仍false，03开做、2/4=50%。CoreOnly复核旧候选39560，未更换用户运行版、未新增配置器。

## 实际Core就绪探针（2026-10-11）
`tests/Dext.ApplicationDock.RuntimeProbe`的`fusion-live EXPECTED_CORE_DIRECTORY FIXTURE_ID`只接受隔离夹具，先核对Core产品/路径；复用StorageGrantLiveProbe要求当前无Room/壁纸，结束恢复偏好、原checkpoint与清除夹具个人数据。
本次开发副本：D:/use/Orca/DEXT/DEXT_Core/.build/v3-task-live-20261011。Core/Player从669a857发布，配置器沿用旧候选且未启动；正式宿主资源按修正清单复制。content来自fusion-sample-installed，改独立UUID和名称Storage grant acceptance fixture，并重算installation.json的manifestSha256。不使用用户实际Room目录。
仅在开发副本main.js末尾追加标题观察器（不修改生产宿主源码）：
```js
setInterval(()=>{const t=globalThis.dextRuntimeDiagnostics?.().taskArea;document.title='DEXT_FUSION_PROBE:'+JSON.stringify({phase:t?.phase||'waiting',enabled:t?.inputEnabled===true,count:t?.snapshot?.items?.length||0});},250);
```
探针读取RPC确定的Player PID所属窗口标题，仅报告阶段/可操作性/条目数，恢复鼠标；不发送应用点击。实测11项、displayReady、enabled通过。必须另做真实OS启动/切换/最小化和触屏。退出仍有#298进程残留问题，不能将探针成功当退出验收通过。

### 真实OS鼠标用例（当前失败门槛）
模式`fusion-actions-live EXPECTED_CORE_DIRECTORY FIXTURE_ID`创建专用测试窗口，尝试激活/最小化/恢复；当前第一项激活尚未通过。正式版不含观察器。开发副本标题观察器额外输出`target`：从taskArea.snapshot.items按windows.title精确匹配`Dext Fusion Action Probe`，在`.dext-task-item`中按dataset.itemId找对应按钮，用getBoundingClientRect中心输出`{x,y,width:innerWidth,height:innerHeight}`；没有则null。测试依据比例换算原生坐标并检查当前Dock根窗口归属、鼠标键未按下、目标没移动。源码：FusionActionWindow.cs / FusionTaskLiveProbe.cs。不能把就绪探针成功算OS操作成功。
2026-10-11更新：上节的fusion-actions-live现已在无诊断Release上通过专用窗口激活/最小化/恢复；保留旧失败记录追溯，证据task-direct-actions-passed.log。仅测试进程OS鼠标注入，物理触屏、首次启动和完整统一验收仍待做。

### 首次启动专用探针（开做，尚未通过）
`fusion-launch-live EXPECTED_CORE_DIRECTORY FIXTURE_ID`临时固定当前探针apphost，参数`--owned-launch-window`。子程序只打开自有窗口，关闭或45秒后退出；主探针拒绝覆盖既有同路径固定项，点击前要求任务窗口数为零，点击后核对新PID、精确路径与窗口标题。30秒仅用于定位延迟，不代表启动性能验收标准。
开发副本标题观察器需优先选择`i.name === 'Dext Fusion Launch Probe'`的任务，否则沿用按测试窗口标题查找；额外输出`launchStopped: item?.name === 'Dext Fusion Launch Probe' && item.windows.length === 0`，保留target/phase/enabled/count。
2026-10-11实测：未在8秒或30秒内确认窗口，之后观察到Explorer启动专用子程序；首次启动仍失败。编辑/清理RPC有超时，不能把命令退出等同完整恢复；外层必须finally恢复原Core，再确认enabled/pins以及迟到子程序已退出。下次应先诊断同步Shell启动，不重复盲点。无正式宿主/运行版部署。
2026-10-11 #300增量修复：失败现场dotnet-stack证明UI线程停于Microsoft.CSharp ComMethodDesc/EnsureScanDefinedMethods→ExplorerShellLaunchService.TryOpen→CompleteTask；以Type.InvokeMember/ParameterModifier调用所需IDispatch成员，避免dynamic枚举类型信息。受控应用参数/工作目录检查通过（Explorer path=true，411ms），完整Release通过。相同真实Core47028/Player43644的Dock首次启动专用程序45860通过，临时固定项/偏好/夹具/checkpoint均自动恢复，RPC未再超时。注意探针12313ms包含准备点击时间，不能称为纯启动耗时或响应速度通过；后续拆分时间定位。证据.build/fusion-launch-stack.log、shell-dispatch-launch.log、shell-dispatch-build.log、shell-dispatch-live-passed.log。03仍开做，工作包2/4=50%，触屏/完整统一验收继续；未更换用户运行候选。
2026-10-11启动耗时拆分增量：探针新增实际DOWN/UP UTC及子进程创建时刻，纠正旧click-to-window包含准备时间的标签。一次实机成功：UP497ms，进程创建13827ms、窗口确认15933ms（.build/launch-timing-live.log）；另一次无抓栈的实机失败，UP293ms，30秒未创建进程，Core日志无Application launch begin（.build/launch-boundary-live-failure.log及20261011_015440.txt）。不能宣称首次启动稳定。Core Click现记录启动调用进入/返回耗时，不含用户路径。完整Release与探针构建通过。下一步追踪HandleNativeSample到CompleteTask的完成/拒绝，暂不继续假设剩余延迟在Shell内部。原运行候选恢复、enabled=true pins=0 groups=11 error空、无测试子程序，03仍开做2/4=50%。
2026-10-11输入完成链证据与启动线程修复：取样DOWN/UP配对成功，UP后约8ms进入Launch；同步Launch实际耗时11386ms，见.build/task-completion-before-worker-core.log。仅将已确认的启动请求放至Task.Run，Click以async void保留UI异常处理和刷新，激活/最小化不走后台。完整Release与探针构建通过；真实Core6272/Player38696启动49568通过，UP到窗口5266ms、进程创建在准备起点4097ms、UP后状态RPC2ms（不代表整个启动期间持续采样）。偏好/固定项/夹具/原checkpoint自动恢复，原候选复核正常，无测试子程序。证据.build/task-launch-worker-live.log、task-launch-worker-build.log。间歇丢点击尚未抓到拒绝原因，剩余启动耗时仍在，不能把本轮单次成功称稳定完成；03继续开做、2/4=50%。
2026-10-11原始边沿及Player阶段诊断增量：首次复现失败没有任何Task sample（.build/task-no-sample-failure.log），任务投影刷新不是已证实根因。补Core原始边沿/手势/投递日志和Player arm/prepare阶段日志；未改现有判定条件。完整Release通过，最新实际Core/Player串联日志覆盖down→arm=True→ready→up→配对→动作接受，首次启动成功，UP至窗口4895ms；清理/恢复通过。证据.build/task-player-stage-build.log、task-player-stage-live.log、task-player-stage-core.log。间歇失败的具体Player阶段仍未抓到，不能称修复；下次沿这些日志复现，勿继续重复审查投影ID。03开做，工作包2/4=50%，原候选恢复，无新增配置器。
2026-10-11触控路径探针做完一段：新增touch-path和fusion-touch-live。普通自有窗口的Windows注入触摸产生真实pointer消息及兼容鼠标/RawInput各一对；实际WebView2官方任务激活失败且未记录到Dock raw鼠标边沿，触控功能仍未接通。证据/接入约束/下一步见plans/V3-P8-013/03-touch-path.md。探针编译通过，原候选/偏好/Room/checkpoint恢复；不新增全局重定向、不改生产点击链，03继续开做2/4=50%。鼠标间歇失败保留未解决，不继续反复跑同一成功样本。
