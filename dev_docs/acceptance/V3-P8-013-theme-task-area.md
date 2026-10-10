# V3-P8-013 官方HTML任务区与演示验收
状态：开做2/4=50%，03接线进行中；尚未替换当前候选。
目标：同一主题窗口中的官方应用区域，不能通过第二条原生Dock假装融合。
自动：布局和稳定状态Node行为检查，真实DOM按下/刷新/释放与跨页取消；Core/Player专用消息和输入互斥，Release构建。
统一人工步骤：
1. 融合演示同一主栏显示主题导航、固定应用、运行点；单击启动/切前台/最小化。
2. 按下期间其他窗口标题/运行状态变化，抬起仍仅触发原项目；切Desk/关闭窗口后旧选择不误触。
3. 官方区域覆盖的作者按钮不同时触发；区域外原导航仍顺畅；触摸/键盘可用。
4. 多窗口标题选择和固定菜单可用，窄区可滚动；隐藏/全屏时菜单同时消失；退出仍恢复任务栏。
原生缩略图/默认切换与完整回退由014接续，不把标题选择当缩略图交付。


阶段证据（不是验收通过）：71项Node与五组真实headlessEdge DOM交互通过。新模块尚未加载到正式index/main，Core/Player数据/原生动作/图标和融合演示尚待03；不把模拟onAction接收器当成启动应用成功。原dom-host新增方法默认null，不改变现有发布几何。
2026-10-10增量：Core展示适配、PNG缓存、私有IPC和Player接收入口编译通过；72项Node/六组headless DOM通过。正式main和原生动作仍未接，人工步骤尚未执行，工作包仍50%。
正式页面接线增量：资源白名单、index/main控制器已接，86项Node与七组后台DOM/Release通过。ActionsEnabled=false，未验证应用启动或触控；上述统一人工四步全部保留。
本轮最终自动证据：89项Node、七组DOM及Release构建；独立review提出的遮挡回退问题已复现并修复。运行仍旧候选；四项统一人工步骤未执行。
本轮原生取样增量：16项Core任务关联、17项原输入回归、90项Node、七组原DOM+四组原生目标取样DOM通过，完整Release通过。应用操作回调已接但ActionsEnabled仍false；人工四步全部保留，未执行真实Player输入。
最终复核：任务检查扩至20项，包含生产authority的排队后撤销与重新发布；独立review问题已RED→GREEN，最终Release通过。统一人工四步仍未执行。
键盘接线增量：正式DOM的独立taskTargets、Player私有回传、Core投影校验和现有RawInput/KeyDelivery已贯通；Tab/Shift+Tab、Enter/Space与本地菜单返回/Esc已接线。原生任务键不合成转发给作者frame。窄栏焦点滚出后回跳作者、作者重新进入跳过应用两处问题均RED→GREEN修复（ERRORS #293）。
证据：16项Core键盘、20项鼠标任务、17项原输入、90项Node、七组原DOM和八组取样/键盘DOM通过；完整Release构建通过。独立复核只有上述边界进入问题，已修复。CoreOnly确认旧Core39560继续运行，没有启动配置器；不是新代码实机验收。
当前03仍开做，2/4=50%。ActionsEnabled=false，真实Player/触控、独立融合样包仍待做；上述旧阶段缺少键盘接线的说明仅为历史。统一人工四步未执行，继续后续工作，不合并master。
独立融合样包已提供：rooms/v3-fusion-lab，覆盖共享/窄任务区/无Dock；四组真实DOM布局与无Dock隐藏、生产Core安装校验通过。复现见../V3_FUSION_LAB.md。它尚未在真实Player应用，统一四步仍未执行。
真实Release Player补证：生产私有任务快照成功到达正式main/controller/DOM；当前原生全屏状态使任务区保持不可用。可见鼠标/键盘分支SKIP，触屏及操作系统动作未验证，人工四步继续保留。

2026-10-11最新补证（替代前面仅全屏SKIP的当前口径）：前台全屏结束后，隔离实际Release Player任务区显示、Tab/Enter私有取样及完成打开窗口菜单均通过；Core消息仍为夹具，不算实际RawInput或OS操作。恢复render覆盖遮挡确认的缺陷已三项RED→GREEN修复，独立review无具体回归；最终93项Node、17项原输入及完整Release通过。鼠标阶段仍失败：Native input dispatch not observed，尚未定位，不记通过。曾用OS鼠标边沿辅助诊断，仍失败，已移除该诊断注入；临时guardian日志也已撤回并重建。探针仍可复现未解决的鼠标门槛。触屏未接、真实应用动作未启用；03继续开做，工作包2/4=50%。CoreOnly复核保留Core39560，没有启动配置器，也未更换用户运行候选。

2026-10-11鼠标回执问题已定向修复（#296）：外层Dock与WebView anchor可见，但Chromium实际input HWND隐藏；页面DOM取样成功不能证明真实显示/点击。同步controller.IsVisible后，最终无临时guardian日志的Release构建、隔离实际Player鼠标DOWN/UP同目标回执、Tab/Enter及官方菜单、隐藏/再次显示、无抢前台通过。恢复时探针补发新Core任务快照，保持暂停撤销操作许可的规则。证据：.build/task-visibility-red.log、task-visibility-final-build.log、task-visibility-final.log。旧“鼠标回执未定位”条目为历史，本次解决该故障。实际Core RawInput/OS动作及触屏仍待做，ActionsEnabled生产仍false，03开做、2/4=50%。CoreOnly复核旧候选39560，未更换用户运行版、未新增配置器。
2026-10-11步骤03操作许可增量做完：SendNativeDockTasks现按NativeDockAvailable设置ActionsEnabled；现有500ms刷新会在恢复就绪后补发快照，完成仍检查物理手势/当前窗口/投影。完整Core/Release Player/Watchdog构建通过，20任务、16键盘、17原指针检查通过（.build/task-actions-build.log、task-actions-regression.log）。这三组检查覆盖现有输入关联，不是新增许可门控的真实Core验收。CoreOnly核对仍为旧候选PID39560，没有启动配置器；新代码尚未部署。实际Core启动/激活/最小化和触屏待验证，03仍开做，2/4=50%。
2026-10-11真实Core补证完成一段：独立self-contained副本v3-task-live-20261011，真实Core47728→Player47868收到11应用任务，displayReady、ActionsEnabled=true且未抢前台。证据.build/task-fusion-live.log；夹具49c12d19-9221-4ed5-ae13-4fdabc0bfa01的Room/personal/checkpoint/偏好/鼠标已恢复。仍未验证应用OS动作或触屏，03继续50%。发现并修复发布资源漏4项（#297），新检查RED→GREEN、实际发布目录校验通过。退出RPC两版本均残留进程（#298待修），按精确路径清理后恢复原候选29792，状态/空Room复核通过，无新增配置器。
2026-10-11 #298退出修复做完：原生+SOS栈定位SystemEvents→WinForms Control.Invoke等待已停止UI，App启动前建立WPF同步上下文；完整Release与真实融合生命周期/退出3轮通过，无强杀新Core。原候选5924已恢复且RPC/空Room复核正常。实际OS应用操作及触屏未验收，03仍开做、2/4=50%；详见errors/backend #298和.build/exit-context-live.log。
2026-10-11真实OS任务动作增量：专用窗口探针已建立并实际运行，暴露旧原点与eventSamples关闭；Player平移刷新和仅官方任务区启用取样已改，68项宿主回归、完整Release通过。实际激活仍未通过，不标完成；后续追踪取样/完成回调。临时诊断已撤回，原候选14912恢复正常。#299详述证据，03继续开做、2/4=50%。
2026-10-11真实Core任务鼠标三步做完：定位到重复合成DOM边沿回执超时；官方任务改用私有视觉取样与Core原始物理pair，不重复转发。完整Release、53输入回归、实际Core专用窗口激活/最小化/恢复通过，.build/task-direct-actions-passed.log。临时日志已撤，原候选15620恢复，未部署用户运行版。首次应用启动、触屏/其他统一门槛仍待做，03继续开做2/4=50%。
2026-10-11首次启动探针增量：新增fusion-launch-live及45秒自动退出专用子程序，构建通过。真实Core固定/未运行任务可见，点击后8秒与30秒均未确认新窗口；随后观察到Explorer启动子程序，尚不能归因或记通过。清理RPC也发生超时，已补finally嵌套恢复且人工核对恢复原候选49468、enabled=true、pins=0、groups=11、error空，测试子程序已清理；Room夹具/原checkpoint恢复。证据.build/fusion-launch-first-failure.log、fusion-launch-second-failure.log、fusion-launch-live.log。下一步定位AppCatalogService/ExplorerShellLaunchService同步启动与延迟关系，避免继续重复输入测试。03仍开做，2/4=50%。
2026-10-11 #300增量修复：失败现场dotnet-stack证明UI线程停于Microsoft.CSharp ComMethodDesc/EnsureScanDefinedMethods→ExplorerShellLaunchService.TryOpen→CompleteTask；以Type.InvokeMember/ParameterModifier调用所需IDispatch成员，避免dynamic枚举类型信息。受控应用参数/工作目录检查通过（Explorer path=true，411ms），完整Release通过。相同真实Core47028/Player43644的Dock首次启动专用程序45860通过，临时固定项/偏好/夹具/checkpoint均自动恢复，RPC未再超时。注意探针12313ms包含准备点击时间，不能称为纯启动耗时或响应速度通过；后续拆分时间定位。证据.build/fusion-launch-stack.log、shell-dispatch-launch.log、shell-dispatch-build.log、shell-dispatch-live-passed.log。03仍开做，工作包2/4=50%，触屏/完整统一验收继续；未更换用户运行候选。
