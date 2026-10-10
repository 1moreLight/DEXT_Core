# 04 复核与交接

状态：开做（2026-10-11）。开始集中证据核查，03尚未收口；工作包仍2/4=50%，没有用户整包验收或主线合并。

## 当前事实

- 开发分支：feat/V3-P8-013-theme-task-area。当前用户运行目录为 `.build/v3-core-exit-20261010`，不是本分支候选。
- 隔离候选：主项目 `.build/v3-task-live-20261011`；含候选专用只读观测，不可原样作为正式分发包。
- 本次核查代码基线：9bb2a88。最新生产修复为37f122f（同宿主跨Desk保持任务栏租约），另含d26359a（重复可见性通知去重）及6ff48bc（作者鼠标兼容事件修复）。正常退出恢复证据已更新到9bb2a88。
- 接续开发先读 [剩余操作清单](03-remaining.md)，不要从下方旧记录重复恢复已完成的接线。

## 已核对的证据及边界

以下日志位于本开发worktree的 `.build`。它们来自不同增量，不能称为HEAD一次性全量测试。

| 功能 | 已有证据 | 尚不能推出 |
|---|---|---|
| 启动未运行应用 | fusion-launch-live.log：真实点击启动自有子进程 | 启动性能已优化完成；旧测量UP到窗口约4953ms |
| 鼠标/注入触摸激活、最小化、恢复及交接 | touch-bridge-actions-passed.log | 物理触屏验收通过 |
| 多应用键盘Tab/Enter | fusion-keyboard-live.log，d2ae04e修复后12应用通过 | 所有作者按钮键盘行为已验收 |
| 多窗口菜单与缩减到单窗口 | task-menu-complete-passed.log | 最新HEAD所有菜单场景已重复验证 |
| 实际固定/取消固定 | fusion-pin-live.log：Core47612/Player22924，两次菜单收起并恢复投影 | 物理触屏固定菜单已验收 |
| 首次产品允许点击 | fusion-startup-live.log：移除额外稳定等待后通过 | 所有显示器/启动竞态均已排除 |
| 手动恢复任务栏后继续操作 | fusion-restored-live.log：实际可见任务栏＋选窗/恢复通过 | 所有任务栏模式均完成实机矩阵 |
| 切Desk撤销旧手势 | task-desk-cancel-tests.log：25项生产输入逻辑检查 | 按住物理触点并真实切Desk已验收 |
| 同栏导航、窄栏滚动及应用操作 | fusion-navigation-live.log：Core46800/Player52720，双向切页、实际横向滚动及激活/最小化/恢复；25ms观察任务栏隐藏且Dock位置不变 | 按住跨Desk取消已实际验证 |
| 按住时关闭目标 | fusion-close-live.log：Core25504/Player51580，DOWN后121ms关闭自有窗口，UP后无误激活/重开 | 旧完成一定在输入配对层被拒绝；实际还由DockWindows拒绝已关闭HWND |
| 全屏隐藏和恢复 | fusion-fullscreen-live.log：Core44152/Player16632，原生Dock隐藏、菜单清空、恢复可操作 | 所有游戏/显示器组合已验证 |
| 切无Dock页 | fusion-no-dock-live.log：Core49376/Player53244，正式导航进入quiet，旧宿主销毁且系统任务栏可见 | 所有异常退出都恢复成功 |
| 正常退出Core | fusion-exit-live.log：Core46892和两个Player正常退出，系统任务栏恢复；51144仅为夹具清理重启 | 强杀/崩溃故障回退已完成；该范围由014继续 |
| 完整构建 | task-lease-build.log，37f122f生产修复的完整Release通过；其后为探针/记录提交 | 当前用户已运行本分支；诊断候选可以直接分发 |

## 本轮核对结论

2026-10-11只读复核上述五份最新实机日志与提交记录，均保留PASS和原偏好/夹具恢复记录。未重复运行实机、未改变用户桌面。03剩余清单第1/2/4项已有证据，第3项实际按住跨Desk、第5项最终核对仍未完。

候选不能直接交付：包含标题观察和临时夹具。正式候选须从生产源独立构建，核对不含这些诊断内容；不把当前旧运行版视为新候选。

按住跨Desk的下一条验证路径必须能独立触发真实Desk revision变化。已检查RoomNativeInputAuthority.MouseDown/Key：鼠标按下会重置焦点/取样，键盘按下会先清除mouse/gesture。因此“按住应用再按Enter切页”即使通过，也无法隔离Desk变化取消，不能填补该证据缺口；不为测试新增绕过物理证明的生产导航接口。

## 04剩余交付

- 待做：完成03剩余操作后，对最终diff进行一次聚焦复核，修具体缺陷；不重新跑广泛安全/网络矩阵。
- 待做：整理最终构建、来源、可复现命令和四项统一人工步骤，清楚区分旧用户候选与新验收候选。
- 做完（打包核对）：正式候选排除临时标题观测/探针夹具；未应用或修改用户Room与私人绑定。实际启动/统一验收仍待完成。
- 待做：提交待统一验收。用户明确通过前不合master；物理触屏和完整人工四步不得倒填通过。

## 历史记录（不代表当前实现状态）

最新状态（2026-10-10）：04仍待做，03仍开做。正式页面只读接线已实现，完整Release构建通过；已用-CoreOnly复核并保留现有候选Core39560，没有启动配置器。本包原生任务动作、演示与实际Player输入尚未验证，仍为2/4=50%。

下文为01/02阶段历史记录；其中“未改C# / 未构建”不再描述当前状态，当前以03-bridge及V3_CURRENT为准。
状态：待做。必要构建、复核、证据与统一验收交接。

阶段提交：01/02通过必要检查并修复一次独立复核发现；03仍开做，04未完成。未改C#/proto，未运行完整Release构建；start.ps1 -CoreOnly只复核并保留旧候选，日志task-area-runtime-preserved.log，不代表新模块实际挂接。
下一次从03-bridge.md接续同一worktree/分支，禁止把前两步提交标成整包待验收。

## 2026-10-11 无诊断正式候选

来源76252ac（本轮仅追加记录，生产源不变）。执行 `scripts/build-v3-release.ps1 -OutputDirectory D:/use/Orca/DEXT/DEXT_Core/.build/v3-fusion-clean-20261011`，完整Core/Release Player/Watchdog/配置器构建退出0；日志 `.build/task-fusion-clean-release.log`。配置器编译2项警告，无错误。

654个清单文件重新计算SHA256均匹配；16项hostAssets与源码哈希一致，HTML引用检查通过。wallpapers内未检出DEXT_FUSION_PROBE、__fusionNavigation、测试Room UUID及夹具名称。全新目录没有复制旧诊断候选；融合样包源在rooms/v3-fusion-lab，尚未导入/应用。

未启动新候选/配置器、未修改用户数据。核查时旧Core48280/配置器19704仍在。实际启动验收和03跨Desk取消缺口保留，整包50%。构建工具只改变Cargo.toml换行，内容核对相同后恢复原字节。

只读复核命令：scripts/verify-v3-release-candidate.ps1 -CandidateDirectory D:/use/Orca/DEXT/DEXT_Core/.build/v3-fusion-clean-20261011。脚本核对全部清单尺寸/哈希、拒绝清单外文件、逐项比对当前源码宿主、检查HTML引用与已知诊断标记。本轮实际执行PASS：654文件、16宿主资源。后续生产源改变时旧候选可能按预期不匹配，需要新构建；该脚本不声明运行验收通过。
