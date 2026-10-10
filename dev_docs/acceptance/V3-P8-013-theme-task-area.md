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
