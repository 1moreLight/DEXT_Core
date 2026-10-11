# DESK-SYNC-003 实机与候选交接

状态：开做

真实Explorer/Player拖放验证、原点击/触控验收保留；构建正式候选并核对来源、清临时内容、恢复原运行状态；交接未覆盖环境条件，不把合成事件当物理验收。

- [ ] 实现或验证
- [ ] 必要检查及证据
- [ ] 记录并提交

2026-10-11实机准备与恢复验证：RuntimeProbe新增desktop-drop-live，使用StorageGrantLiveProbe磁盘checkpoint备份/恢复，临时源与真实桌面唯一目标、8分钟上限、cancel信号、ready/result/cleaned记录。只清理本次唯一文件和空源目录，源内容/实际目的内容/私有槽位检查已写。
第一次候选缺宿主资源，应用前失败，按#321补齐16项官方资产与显式content后重试。第二次Core47700/Player33976实际Room及桌面同步ready，恢复备份runtime-recovery-d1874d4376f64f73b2b17ccc664b6534。
Orca UI接口仅列出Explorer14388的1×1窗口，新启动Explorer50264没有可枚举窗口，因此未执行鼠标拖动；主动写cancel退出，不计实际拖入通过。cleaned/restored标记存在；旧Core52420已恢复，session-status为空，checkpoint备份与当前哈希一致，配置器仍只有19704。日志 .build/desktop-drop-live-retry.log。该轮证明准备/取消恢复有效，不证明Explorer/OLE、文件传输、落点或触控。
待继续：解决当前桌面会话的Explorer窗口可见性后复用夹具实际拖入；或采用可观测的独立OLE源先补源效果证据。不能仅因看不到窗口反复切换Core。

2026-10-11 完整候选打包受阻：npm ci --prefer-offline --no-audit --no-fund 报 ENOSPC，C盘剩余0字节；已核对绝对路径并仅删除本轮新建且安装失败的 tauri-ui/node_modules，释放146161664字节。正式 desktop-drop-clean-20261011 尚未创建，未启动/替换Core或配置器。恢复条件：将依赖和临时构建目录安排到D盘（当时可用246813810688字节），或释放足够C盘空间后重跑完整打包及来源检查。真实Explorer拖入门槛仍待；实施0/5，桌面同步路线2/4=50%。日志 .build/drop-npm-ci.log。

2026-10-11 正式候选打包恢复：锁定package.json/package-lock.json复制至D盘独立构建环境，npm ci退出0；当前worktree node_modules链接到该依赖，未运行的Core bin搬到D盘并保留目录链接。TEMP/TMP/npm缓存及Rust目标均位于D盘；构建后C盘剩余391573504字节。完整build-v3-release.ps1退出0，候选 D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-clean-20261011；来源c73d153（生产代码42d7add），654文件哈希核对、16项官方宿主与源码一致、已知夹具标记检查通过。保留Rust既有两项警告。日志D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-build-env/release-build.log。
候选未启动；旧Core52420/配置器19704路径仍为v3-core-exit-20261010。构建造成的Cargo.toml纯换行变化经HEAD内容比较后恢复；工作区无代码变更。真实Explorer/WorkerW拖入、OLE源效果、重名/取消UI、落点及原触控仍待，05状态继续开做，实施0/5（完整门槛），路线2/4=50%。下一步补实际OS拖入证据，不重复打包或切换Core来代替鼠标验收。
2026-10-11 DESK-SYNC-003实机补证恢复开做：004在其分支完成实施与r3候选交接（1f13850，生产0ed6d12）；路线实施3/4=75%，本分支早期“004下一项/2/4”仅历史。复用当前003分支与独立验收文件，先核对当前Explorer窗口，再准备唯一临时文件与磁盘恢复清单；候选切换前记录当前Core精确路径、布局与个人状态，测试后恢复。仅真实Explorer→原生宿主→Shell文件结果→可见图标全链计通过，不用后台文件复制替代拖放。禁止覆盖现有文件、重复打开配置器或更换原点击/触控链。
环境核对：Orca CLI当前不存在，按computer-use技能停止该CLI尝试；改用已安装Windows computer-use插件。最新list_windows未列Explorer，并非沿用旧1×1窗口结论，下一步正常启动Explorer后重新选择窗口。CodeGraph显示Not initialized，源码定位使用rg兜底，不新建索引。

2026-10-11 实机补证本轮结果：Windows computer-use 能读取正常 Explorer 文件列表；隔离 Core31808/Player38976 已 ready，但实际拖动前检测到用户输入及窗口最小化，主动取消，未发生本轮自动拖动，未产生 result.json。日志 .build/desktop-drop-live-r3.log；drop-live-223fc78615044e6092ae84a6dc43d581/cleaned.txt 和 drop-return-f3b4cc5dc7f94f0c84c3c2a28645e41d/restored.txt 记录清理恢复。原 Debug Core 恢复为34196，无活动Room；Settings/WallpaperLayout/room-session字节一致，personal仅revision变化。桌面原生图标由用户主动关闭，不作为故障，不擅自修改。
进度：桌面同步路线实施3/4=75%，003完整实机门槛0/5；未通过的测试不计完成。本轮探针观察窗口延长到45秒并可用observed/cancel提前结束。发现磁盘文件和私有槽位也可能由Explorer原生落盘+监听产生，因此将探针PASS改为OBSERVED，结果明确dextDropRouteVerified=false。
下一步（待做）：为唯一临时文件关联真实Player接收、Core执行和页面回执证据，再做一次Explorer拖入；其后按独立验收卡核对效果、取消/重名、生命周期和原输入。当前记录整理做完；真实链路补证仍开做。用户已要求不用Orca技能。
任务栏请求记录：新探针taskbar-visible已构建，但旧Debug Core返回Unimplemented，未确认恢复；Windows设置自动操作被工具拒绝（Computer Use was not approved to use systemsettings）。用户随后改为只需操作说明，已提供，不再继续修改任务栏。

2026-10-11 关联诊断实施做完：Core现有desktopDrop分支记录received/result，Shell完成后记录transfer；三者以session/request/player关联，transfer仅记录哈希newIds、逐项状态/HRESULT和placement，不记录源/目标绝对路径。received代表已通过会话校验到达Core，不代表Shell成功；result代表Core处理结果，不代表页面已呈现，须观察官方完成提示。全量build.ps1 -V3Release通过；start.ps1 -CoreOnly自动补Debug构建后因旧Core34196占用同身份按设计拒绝启动（退出1），未停止旧Core、未打开配置器。诊断未部署到运行版，实机门槛保持0/5，路线3/4=75%。
下次证据：ready.json的SessionId/PlayerPid与received匹配；同一request的transfer.newIds必须含唯一目标文件的desktop-ID且对应completed、placement accepted、aborted false；result accepted；最后观察官方已完成提示及落点图标。缺任何一环均不能把文件监听当Dext拖放成功。后续仍需五项独立验收，未合并master。

2026-10-11 实机重试未进入拖放：Explorer正常窗口525492可读；将当前003框架依赖Release输出覆盖到原自包含测试副本后启动Core28888，但35秒内RPC身份未就绪，也无本次Core启动日志。该混合输出不是可验收候选，根因尚未确认，禁止复用为正式包。启动脚本finally中的正常退出RPC也超时并提前中断恢复；随后核对PID28888精确路径，仅结束本轮失败测试进程，恢复原Debug Core36228。session-status为空，Settings/WallpaperLayout/room-session/personal四项SHA256均与本轮启动前一致；未启动Player/配置器、未产生新ready或拖动文件。
证据：.build/desktop-drop-live-diagnostics.log；备份 .build/drop-return-19c6d1d01f5146f2abdba8bfe31ba453/recovery.json。下一步先构建独立空目录的完整publish候选，不能再覆盖旧发布目录混用依赖；修复测试编排的finally，保证停止测试副本失败不会无记录地跳过原Core恢复。实机0/5，路线3/4=75%。

2026-10-11 干净候选恢复做完：build-v3-release.ps1从全新目录构建，生产源de16333/记录644098e，输出D:/use/Orca/DEXT/DEXT_Core/.build/desktop-drop-diagnostics-clean-20261011。完整构建退出0，既有Rust两项警告；654文件清单和16项宿主来源核对通过。runtimeconfig为includedFrameworks 9.0.19，区别于失败副本被覆盖成frameworks 9.0.0；不能将两类产物直接覆盖混用。
候选Core15732实际RPC身份及空session通过，正常退出后原Core9696恢复；四项checkpoint文件SHA256全一致，无壁纸应用/新配置器。日志.build/drop-diagnostics-clean-build.log、.build/clean-core-start.log；恢复备份drop-return-0c73c456b0ef484da30bbdfbaad190d5。测试编排副本增加失败停止的精确路径回收，再恢复原Core；本轮正常退出，未触发强制回收。Cargo.toml构建产生的纯换行变化核对后恢复。
下一步仍是从干净包复制独立夹具副本并关联真实Explorer拖入，不在干净候选中写夹具、不覆盖框架依赖输出。打包/启动障碍解除，实际拖放0/5门槛保持，路线3/4=75%；原五项人工验收未变。
