# V3-P5-001 原生持续桌面宿主

- 状态：开发中
- 分支：feat/V3-P5-001-native-runtime
- 基线：V3-CORE-006 0acaa3d；依赖未合并，按用户授权连续推进，最终集中验收。
- 一句话目标：真实Core/ReleasePlayer运行原生v3作品，保留共享实例并同步图标/Widget/画面几何，完整处理切页与生命周期。
- 范围外：顶层Dock/AppBar、配置器节点/分享界面、游戏、发布清理；这些要求仍在完整路线中。

## 自动门槛

- [ ] 共享纯模型与SDK行为：current/target分离、queue/迟到拒绝、实例持续、深继承、正交生命周期、几何与父通道验证。
- [ ] 原生Content能力/按钮声明与Rust/Core/Schema一致；绑定/授权/可信输入及真实资源边界接通。
- [ ] Kernel/Protocol/Actions回归、前端构建、生产宿主浏览器e2e、隔离ReleasePlayer安全/IPC全部通过。
- [ ] 四类素材、默认/作者动画、真实Core/Player/配置器build→start及身份检查。
- [ ] 个人布局故障回原位、视口临时移位/缩小不写盘、占用同时阻止图标/Widget，陈旧命中拒绝。

## 最终集中人工步骤

1. 临时应用basic原生样包：图片、视频、GIF、本地HTML均能展示，切页后状态由Core提交；退出探针恢复原用户Room。
2. 应用continuous：同一仪表盘从底部到整页再返回，场景和共享Widget实例ID/计数不变，图标/Widget与作者画面同步运动。
3. 快速连续切页，只保留最后输入；作者不回完成或Alt-Tab失焦时立即收敛目标，回来可继续；旧完成不能覆盖。
4. 鼠标/Enter/Space真实激活背景按钮与普通图标，启动同一已授权测试目标一次；定时请求、伪造点击、错误消费者、过期/重放和陈旧几何均拒绝。 退出入口必须显示Core原生Dext确认；取消保留运行，确认后Core/Player/Watchdog/配置器全部正常退出并恢复普通Windows桌面。
5. 编辑态拖图标/Widget，Widget落作者占用区回原位；缩屏先临时移位再缩小，恢复尺寸还原保存布局。分别核对系统DPI和真实命中。
6. start/idle/播放暂停/锁屏组合及唤醒保持已提交Desk和共享实例；重启Core/Player恢复同一安装副本Desk，切换Room不接收旧状态。
7. 恶意样包尝试外部脚本/网站、导航、弹窗、下载、直接原生消息与未授权数据/动作均拒绝；缺数据仅隐藏读数，保留外框，诊断可定位。

通过标准：以上步骤与实际自动门槛一致，原用户Room/布局被恢复；物理输入/DPI/锁屏不能由Chromium测试代填。未得到用户最终确认前不合并master。

## Task1自动证据（2026-10-03）

纯运行模型14/14、作者SDK14/14；初始回放/销毁/几何通知实失败后修复。TypeScript声明及作者正反例、生产JS语法、原生样包Schema、Rust28/28通过。连续样包内声明并加载版本化SDK。仅Task1自动门槛，尚未验证Core原生上下文/资源/RawInput/持续DOM/真实DPI，不填人工通过。

## Task2媒体槽声明阶段（2026-10-03）

Rust31/31、Core51/51及Schema正反例通过；此前合法声明实际被拒绝，已同步修复。完整build.ps1成功。start.ps1因现有绑定分支Core67720占用身份而拒绝启动P5；真实P5运行/权限/物理输入门槛尚未完成。原始人工验收步骤保持待执行。

- 2026-10-03运行补证：用户明确授权退出；正常关闭绑定分支旧实例后，P5启动成功，Core104084/ReleasePlayer68604/Watchdog116972/配置器102068及mutex/pipe/data/log身份全OK。随后正常退出Core并停止本轮开发监听，进程与1620端口均已释放。此证据为已有v2恢复链，原生v3完整人工门槛仍待执行。

## Task2不可变上下文阶段（2026-10-03）

当前私有Player桥可读取同一次安装校验冻结的公开清单/资源摘要；源替换、篡改、错误进程/角色、换安装/会话、关闭/撤销/销毁与旧版隔离回归通过。协议63/63、动作35/35，输入探针编译成功（两项已有nullable警告）。完整build→start/identity全OK：Core115664、Player125508、Watchdog122228、配置器29228；验证后全部正常退出，开发端口释放。

当前启动仍恢复原用户v2作品；原生上下文尚未传入实际Player IPC/DOM。上方7步最终人工验收保持待执行；本次没有改写MSIroom或标记物理输入/DPI/生命周期已通过。

## Task2生命周期与快照传输阶段（2026-10-03）

内核17/17、协议65/65、动作35/35；隔离ReleasePlayer实测旧快照遗漏字段，修复后queue/deadline/install/active/lifecycle及空字段完整到页。完整Core/ReleasePlayer构建、Rust检查与前端构建成功；前端仍有共享依赖环境的Geist字体URL警告，不能计发布资源验收完成。

当前分支start/identity全OK：Core103408、Player89868、Watchdog79488、配置器70980；真实命名管道v3-status=inactive符合现有v2恢复。验证后正常退出，进程/端口0。上方7项最终人工步骤仍待执行：Windows事件尚未接生命周期协调者，RuntimeContext尚未传入原生宿主，媒体/物理输入/布局/DPI/安全门槛未代填通过。

## Task2媒体权限阶段（2026-10-03）

动作回归实际36/44失败后修复为44/44，内核17/17、协议65/65；覆盖独立媒体消费者、阶段/Desk/授权隔离、锁屏/暂停/前台、旧票据与196消费者上限。完整build→start/identity通过：Core57164、Player60216、Watchdog116664、配置器72136；随后正常退出并核实进程/1620监听0。

这轮启动仍是原有v2作品。Windows真实事实尚未连接协调者，原生v3媒体/DOM/资源/输入仍未完成；上方7步最终人工验收保持待执行，未申请中途人工确认。

## Task2 Windows完整事实阶段（2026-10-03）

实际Playback暂停/播放与SessionSwitch现在向独立事实源采样，前台不从暂停策略推断；协调者按Player显示器读取，并使首个Start/Restore快照就包含暂停/锁屏/前台，后续一次原子更新。新增接口初始CS0246后，协议72/72、内核17/17、动作44/44通过；完整build→start/identity通过，Core103208/Player43884/Watchdog31212/配置器82384。检查后全部正常退出，进程/开发端口0。

自动测试验证首次订阅、原子解锁、显示器范围、授权和失败重试；本轮实际启动仍恢复v2，不计原生v3首帧、真实锁屏/闲置或物理输入/DPI通过。上方7步人工验收保持待执行并集中确认。

## Task2上下文与撤销IPC阶段（2026-10-03）

协议80/80、消息边界19/19、内核17/17、动作44/44通过。实际ReleasePlayer验证context先于snapshot、错误代次拒绝、连续Resume只重放最后快照、暂停期间撤销、真实页面重载与代次墓碑、未知v3消息不落旧启动入口；旧完整字段探针也通过。中文传输、异步恢复与非对象Desk三个实际失败均修复。

完整build→start/identity成功，Core123128/Player71384/Watchdog116472/配置器76656；现有v2恢复状态inactive。启动日志一次WorkerW层级纠正分支，物理层级仍待Task4；正常退出后Dext与1620监听0。本轮验证了原生IPC，不代表已完成v3资源服务/物理输入/DOM宿主；上方7步最终人工验收继续集中执行。

## Task2原生资源服务阶段（2026-10-03）

31/31资源检查通过；隔离ReleasePlayer实际验证声明文件/Range、GIF/字体、MP4/WebM播放与seek，作者沙箱资源/外部fetch/worker/原生桥边界，撤销/新代次和页面重载。强制RTC策略在官方页和作者沙箱页产生浏览器enforce报告；模拟缺失报告API时诊断后退出。原有19/19消息、五组IPC和完整快照回归通过。

Runtime153禁RTC策略与mDNS接口初始化冲突曾使渲染进程退出；官方自检改为每WebView实例一次后资源/重载全部通过。作者重复构造禁用RTC仍可能触发Runtime退出，真实恶意内容故障恢复未完成，见ERRORS #150。不得把这轮安全证据代填为最终第7步通过。

完整build→start/identity通过（Core31152/Player81948/Watchdog89212/配置器2860），当前仍恢复已有v2。Core正常退出、开发监听停止后进程/端口/资源临时缓存均0；日志已有WorkerW层级纠正和D3D PID查找错误，最终物理层级仍待验收。上方7步人工验收保持待执行并最终集中确认。

## Task2原生输入接线阶段（2026-10-03）

原生RawInput配对、受控Tab/Enter/Space、当前几何/窗口/DPI绑定、一次消费与导航撤销已接到实际私有Player桥。动作62/62、输入消息25/25、运行消息20/20、协议80/80、内核17/17和隐藏Win32窗口5组通过。隔离ReleasePlayer4组验证真实IPC、显式scale1.5下640x480窗口映射、错误请求/沙箱拒绝、暂停/撤销/导航失效。

完整build→start/identity通过：Core69160、ReleasePlayer80360、Watchdog95932、配置器124352；恢复已有v2，实际状态inactive。正常关闭Core并停止开发监听后进程/1620/1621监听0。启动日志已有WorkerW层级纠正/D3D查找错误，未计物理层级通过。

该阶段没有用户物理鼠标/键盘、多系统DPI或生产v3 DOM证据；第4/5项仍待最终集中执行。启动完成、同Player闲置与生产宿主的几何失效握手继续实现，上方7项最终人工步骤保持不变。

## Task2启动完成仲裁阶段（2026-10-03）

内核21/21、协议83/83、输入消息26/26、动作62/62、运行消息20/20；实际ReleasePlayer五组输入/启动协议验证通过。覆盖当前阶段完成、旧阶段拒绝、保留Windows事实/Desk/队列、同文档ready去重与重载新ready。实际生产start媒体播放/超时和闲置窗口尚未接通，不能代填最终第6步。

完整build→start/identity通过：Core102804/Player41456/Watchdog115704/配置器73840；日志20261003_051414.txt，v2恢复inactive。正常退出后Dext进程与1620/1621监听0。日志已有WorkerW纠正和D3D查找错误，物理层级仍待Task4。上方7步最终人工验收保持待执行。

## Task2同Player闲置接线阶段（2026-10-03）

可信idle/desktop阶段入口、同Player窗口租期、屏保/播放事实、第一次唤醒与长按保护已接。内核22/22、协议86/86、动作65/65通过；真实Win32三组覆盖精确还原、传统popup/child两种挂接和丢失父窗隐藏。隔离ReleasePlayer同一HWND/PID实测两种挂接、原始父窗/样式/坐标及DPI120还原，随后五组原生IPC回归通过。

完整build→start/identity全OK：Core72912/Player63172/Watchdog39464/配置器93232；日志20261003_060229.txt，已有v2恢复inactive。正常退出后Dext进程/开发端口/资源缓存0。现有WorkerW纠正/D3D查找日志不计物理层级通过。当前证据没有生产Core原生Room的idle DOM或实际物理唤醒、多DPI、故障重建；第6步及其余7项仍待最终集中执行。

- 2026-10-03消费者能力元数据阶段：真实Core生产权限/私有桥77/77、严格原生消息27/27、内核22/22、协议86/86；实际ReleasePlayer能力请求/回复及旧身份/自报声明拒绝通过。完整构建→同分支start/identity成功，验证后正常退出。这里只证明Core授权元数据接线，未实现能力仍unsupported；生产DOM/逐次数据授权/真实物理验收不据此打勾，7项人工步骤与16项全景范围不变。

- 2026-10-03生产媒体模块阶段：模型14/SDK14/媒体12=40/40；实际ReleasePlayer同一生产脚本完成GIF500ms、MP4 ended、委托HTML done一次、保留WebM节点暂停/恢复后继续解码及idle done拒绝，原资源安全/撤销/重载保持通过。最新完整构建→同分支start/identity成功后正常退出。生命周期/完成回调在此媒体夹具里是模拟Core，正式页面/iframe和Core起止/原生挂起整体验证仍未完成，7项人工步骤不变。

- 2026-10-03生产iframe模块阶段：模型15/SDK14/媒体12/iframe13=54/54；真实ReleasePlayer加载生产frame-host和SDK，固定来源、Core状态映射、读数单独隐藏、单来源暂停恢复、所属消费者激活路由、沙箱原生拒绝、持续iframe重载/旧token拒绝通过。能力/数据/激活回复为模拟Core，未代填生产Core或物理动作通过。原生逐iframe媒体、官方页面/DOM/逐次Core授权/几何仍继续，7项最终人工步骤不变。

- iframe阶段完整build→start/identity通过：Core65052/Player8564/Watchdog50436/配置器59448，日志20261003_080601.txt；当前v2恢复inactive。核对PID/路径后正常退出，自己的开发监听停止，Dext进程/开发端口/资源缓存0。WorkerW纠正与D3D查找日志不计最终物理验收通过。

- 2026-10-03原生暂停模块阶段：模型15/SDK14/媒体14/iframe14/播放桥5=62/62，原生资源31/31、运行消息20/20和实际Player五组缓存/撤销/重载IPC通过。真实ReleasePlayer验证暂停前同步停止期限与来源，保持Core事实，恢复先revision3再剩余500ms活动预算，完成一次且数据新来源revision3。夹具Core回复为模拟；生产页面/实际Core与原生iframe媒体仍继续，7项人工步骤不据此通过。

- 暂停阶段最终完整build→start/identity通过：Core91052/Player70888/Watchdog83660/配置器78452，日志20261003_082904.txt；v2恢复inactive。用户明确允许正常退出，核对PID/绝对路径后关闭全部验证进程，开发端口/资源缓存0。现有WorkerW纠正和D3D日志未计最终物理步骤通过。

- 2026-10-03 Core消费者数据基础桥：98/98真实权限/来源、严格消息28/28、内核22/22、协议86/86；实际Windows时间/硬件/音量读取通过，无媒体会话诚实missing；真实ReleasePlayer SDK经当前private data IPC验证读数及暂停恢复，Core回包在该夹具仍模拟。完整build→start/identity成功，v2恢复inactive；正常退出后进程/开发端口/资源缓存0。正式DOM/连续provider/权限变化恢复与7项最终步骤仍待完成，不代填物理或完整Core原生Room验收。

- 2026-10-03正式通信模块：新10/10、组合72/72、资源31/31；真实ReleasePlayer/SDK持续逐值private data IPC，同revision撤权隐藏读数、恢复授权无需导航/重载重开来源，原生暂停剩余时间/最后revision3保持通过。Core回包仍模拟；完整build→start/identity通过后正常退出，进程/端口/资源缓存0。正式页面/Core原生Room与上方7项最终步骤未据此打勾。

- 2026-10-03正式入口基础：DOM12/Main7/生产组合91/91；实际ReleasePlayer整页加载官方index/main/style/modules，当前几何回执/真实SDK读数、两个文档UUID保留、default transition回告但Core fixture提交前current不变、queue和原生暂停/latest revision6、撤销释放均通过。Core权限/数据/提交仍模拟，未代填真实Core原生Room或物理/DPI通过。完整build→start/identity后按PID/路径正常退出，进程/端口/资源缓存0。默认动画静止shared命中基础之外，移动/旋转/遮挡/焦点/布局与原生HTML媒体继续实现；上方7项最终步骤与16项完整要求保持。


- 2026-10-03原生逐iframe音视频基础：政策10/Main8与原组合84，共102/102；真实C#帧策略/输入28/运行20/资源31通过。实际ReleasePlayer完整官方页面验证首航作者play默认暂停、真实WAV/closed Shadow MP4/嵌套音频持续、原始媒体方法不被实例覆盖、伪SDK token/globalThis alias拒绝、阶段和私有挂起/最新状态恢复/保留作者暂停意图/根帧更名暂停/撤销无崩溃。Core响应/提交仍由隔离夹具模拟，不代填真实Core原生Room或物理/DPI步骤；WebAudio仍需继续。完整build→start/identity成功：Core50684/Player57196/Watchdog76868/config122420（本轮共享D缓存），日志20261003_110420.txt；原v2 inactive、精确PID/路径正常退出。上方7项最终步骤与16项完整路线不变。

- 最终销毁路径补强：缓存FrameId移除幂等、政策失败先静音再通过UI队列退出原生事件栈、processFailed撤销其余媒体。最新完整build与实际整页媒体回归再通过；最终start/identity Core106108/Player87720/Watchdog75280/config119552（本轮共享D缓存），日志20261003_111305.txt；原v2 inactive，随后按PID/路径正常退出。

## Task4真实Core原生安装起步（2026-10-03）

生产Rust安装→真实Core独立复核→GIF启动→原生几何回执→Core切页提交通过；Player115676与场景/共享Widget两份实际SDK文档在home revision2→focus revision4保持。视频ready4、实际播放时间0.576、静音循环；授权诊断的取消/作用域顺序双缺陷先失败后修复，完整JS105/105，真实整页error/frameError均null。

导航是临时官方顶部的协议测试驱动，不计物理输入。finally重铺原壁纸、正常退出Core，布局/设置/checkpoint逐字节与原用户Room哈希恢复；临时目录已移除。完整build→start/identity核对后再次正常退出，最终进程/开发端口/资源暂存0。配置器使用本轮共享D缓存，identity显示OTHER并单独核对绝对路径。

四类完整生命周期/实际idle与重启、WebAudio、作者控制/存储/确认、个人布局与精确移动命中、物理输入/DPI及故障恢复仍继续；上方7项最终人工步骤保持待执行，不合并master。

## Task4实际Core正常重启恢复（2026-10-03）

同一临时生产安装副本不重装、不改checkpoint、不发恢复导航：Player83528提交focus后正常退出Core，新Player102184/新session自动恢复focus，安装stamp不变、测试nav=0、SDK新文档。真实GIF start在每个新文档只观察到一次starting→desktop（559ms/558ms），视频实际解码播放恢复。原壁纸及布局/设置/checkpoint逐字节和用户Room哈希恢复。完整build→start/identity后正常退出，最终Dext进程/开发端口/资源暂存/临时目录0。

这里只补正常Core重启门槛；独立Player故障重建、完整idle/锁屏组合、WebAudio、物理输入/DPI、个人布局和其余完整Task3/4仍未完成。上方7项最终人工步骤保持待执行。

## Task3 WebAudio原生基础与实际Core补证（2026-10-03）

生产组合116/116，额外作者方法借用、Array索引/species、Object.toJSON回执攻击均先失败后修复。AudioContext私有Gain即时输出闸门与真实原生suspend回执接到Player挂起屏障；作者暂停意图和迟到resume按当前事实收敛。实际ReleasePlayer两个根/嵌套AudioContext真实时钟、挂起1.1s排除墙钟、恢复/阶段/根更名/撤销通过，私有记录与回执未被作者取得；Core回包在该夹具仍模拟。

真实生产Core同安装副本切页与正常重启另外通过，两新SDK文档的AudioContext均running且time>0.05，focus自动恢复、GIF start每新文档一次、视频解码恢复；此Core运行早于最后null-prototype回执补强，补强后完整build与实际Player整页再次通过。finally原桌面及布局/设置/checkpoint逐字节和用户Room哈希恢复。最新build→start/identity后按精确PID/路径正常退出，Dext进程/开发端口/资源暂存/临时原生目录均0。

以上只补WebAudio基础，不把作者静音夹具的真实时钟当作物理听音验收。完整idle/锁屏与独立Player故障恢复、作者导航/控制/存储/确认、个人布局/精确命中/物理输入/DPI仍继续；上方7项最终人工步骤保持待执行，完整P5未完成、16项开发就绪仍1/16。

## Task3 Core消费者本机存储基础（2026-10-03）

实际生产Core源码回归110/110：当前storage.read/write分别授权，Room副本/消费者隔离，有界JSON与配额，缺键null、set(null)、持久重读；旧个人快照兼容，损坏/撤权/旧安装/关闭/错误作用域拒绝，写入失败保留原字节。4097项小数组实际失败后修复。只读/写入口通过私有Player连接调用，销毁后拒绝。

完整build→start/identity通过后，原v2状态inactive；核对PID/路径正常退出Core和配置器，自己的watcher结束，用户个人快照哈希/不存在状态未变。这里验证的是Core存储权威基础；严格Player消息、正式DOM/SDK与已授权实际Core KV端到端仍继续，上方7項最终人工步骤不打勾。

## Task3消费者存储原生接线与真实Core（2026-10-03）

生产JS121/121、严格原生消息30/30、Core动作/存储110/110；缺少DOM/Player/Core适配分别先RED后GREEN。正式SDK→所属消费者DOM→严格Player IPC→当前Core私有授权→原子KV已贯通。真实Rust安装/独立Core复核/WorkerW/ReleasePlayer中，两消费者相同key各自读写，中文和ISO日期字符串保持；撤权后拒绝，恢复后无重载继续。Core日志不得含私有KV值的实际marker检查曾失败，改原生请求只记协议元数据后通过。

同一生产安装副本正常Core重启，新Player/会话/SDK文档无需测试导航自动恢复focus并读回原KV，原值未被探针改写。测试管理员仅准备新临时Room的测试授权；权限UI未据此通过。首次用户grid规则正常暂停，探针临时采用真实前台算法并finally逐字节恢复原设置；不把该运行计为grid/idle/锁屏验收。

finally原桌面、布局/设置/checkpoint/personal逐字节或不存在状态及用户Room哈希恢复。完整build→start/identity后正常退出，进程/开发端口/资源暂存/临时原生目录0，个人快照未变。上方7项最终人工步骤保持待执行；作者导航/控制/确认、完整生命周期/独立Player故障、个人布局与精确输入/物理DPI继续，完整16项就绪仍1/16，不合并。

## Task3作者导航Core生产者（2026-10-03）

缺失私有NavigateNative API先RED，第一组125/125；无默认动作的动态入口及TargetId-only个人绑定再实际失败125/128，修复后128/128。生产Core源码验证当前consumer/按钮/动作、三导航变体、current/target分离、未知目标拒绝、用户覆盖优先、一次消费、无输入/撤权/过期/几何/代次/关闭/暂停/锁屏/失焦。完整build→start/identity后正常退出，原v2 inactive，个人快照未变。

这些正向输入通过生产native authority方法构造，非实际Windows物理事件；严格navigate消息、默认/SDK统一派发、已授权实际Core作者导航仍未接通，当前SDK诚实unsupported。上方7项集中人工步骤不打勾，整体Task3/4、系统控制/退出确认、布局/完整生命周期继续，16项就绪保持1/16，不合并。


## Task3作者导航与输入统一派发补证（2026-10-03）
生产JS132/132、动作132/132、严格消息32/32与完整Core/ReleasePlayer构建通过；实际ReleasePlayer原输入/HWND/拒绝/暂停/重载门槛保持。实际Core作者SDK导航：timer无输入拒绝、Windows注入形成真实Core完成、一次消费/一次accepted、同文档提交focus与保留共享实例；正常重启同安装恢复focus/KV和新SDK文档，最终11PASS。探针临时显示桌面，最终核对原窗口最小化/最大化状态、前台/鼠标和所有原数据恢复。

常规start Core22860/Player88968/Watchdog74480/config114160，日志20261003_162208.txt；原v2 inactive。配置器所属共享Dcache独立路径核对，身份脚本OTHER/exit1，未宣称全脚本OK。全部按PID/路径正常退出，watcherexit0，个人原hash/缺失状态不变。无中途验收/合并；Windows注入不能填上方第4/5项人工通过，最终7项与全16范围/readiness1/16不变。

- 2026-10-03最终清理核对：DextProcesses=0、DevListeners=0、ResourceCacheFiles=0、NativeFixtureDirectories=0；全部工具会话已终止。


## Task3系统控制原生接线与真实Core（2026-10-03）
封闭媒体五意图与有限音量patch贯通正式SDK/固定consumer DOM/严格Player消息/Core当前私有授权/真实证明/Windows服务；个人默认/绑定优先，限频与一次消费、真实消费回执统一fallback。JS140/140、消息35/35、Core168/168，分别先RED再GREEN；并发限每attachment1/全Core4、外层4s，超时原任务槽位留至实际终止。实际取消音量请求不写设备。

最终完整build后实际Rust安装/Core独立校验/WorkerW/ReleasePlayer：Player92064、sessionfc8791a9-596b-491a-ab7d-4d5f67c28c9c；音量改动→恢复原endpoint，五媒体意图只在真实Core当前title核验为本轮拥有的静音WinRT publisher时发出，均观察到本机回调。8次Windows注入各一次消费/accepted、无默认重复，共享文档保持并由作者动态导航提交focus。正常重启同安装stamp31a93df7...96fee、新Player71896/session1fd1777b...恢复focus/KV/新SDK/GIF/视频；最终15项PASS。

最初并发无输入、标题观察容量导致探针整轮未过，均保留失败证据并纠正夹具，未降生产输入/权限/并发规则。最终finally恢复原桌面、布局/settings/checkpoint/personal字节或不存在状态、用户Room哈希、原endpoint音量/静音、临时showdesktop窗口旗标/前台/鼠标；不代填物理DPI/听音/完整生命周期人工通过。

常规最终start Core40928/Player124608/Watchdog99404/config69696、日志20261003_173146.txt，原v2 inactive。配置器是所属D共享缓存，identity脚本OTHER/exit1并单独核对路径；没有宣称全脚本OK。正常精确PID/path退出，watcher41725exit0、个人原SHA256/缺失状态保持。可信退出确认及完整Task4仍继续，完整16项/readiness1/16、上方7项人工验收和最终P5审查不减、不提前合并。

- 2026-10-03系统控制最终清理核对：DextProcesses=0、DevListeners=0、ResourceCacheFiles=0、NativeFixtureDirectories=0；Core/配置器正常退出，全部工具会话已终止。

## Task3可信退出确认与完整产品退出补证（2026-10-03）

私有许可179/179、Core协调器185/185、正式宿主/SDK141/141、严格原生消息36/36、Rust生命周期7/7。许可仅Core内存且两JSON序列器排除；作者不能发送approved/confirmed/confirmation/token/exit或调用confirmExit。原生窗锁外固定Dext文本、默认否，全Core一窗；用户确认后重查当前授权/绑定/安装/文档/锁屏，自己的可信失焦/暂停不误拒决定。

最终实际生产Rust安装/Core/ReleasePlayer/SDK、真实OS鼠标中无输入exit timer拒绝，No取消保持Core/Player/configurator，Yes整套Core/Player/Watchdog/configurator正常退出并去除壁纸窗口；普通Core关闭/同副本重启保留配置器。最终13项PASS含原布局/settings/checkpoint/personal精确字节或缺失状态及用户Room哈希恢复；Windows注入不代填上方第4/5项物理输入/DPI人工验收。

历史取消点击实际命中覆盖窗口，等待真实按钮OS命中后No/Yes通过；悬挂确认的恢复先按精确Core PID/路径取消，再正常退出和恢复备份。之后辅助重启的异步原壁纸检查失败，已明确恢复；最终整轮完整退出后直接恢复原文件，保持普通Windows桌面。失败历史保留，不以局部结果冒充整轮通过（ERRORS #194）。

最后完整build→常规start：Core74912/Player27284/Watchdog27548/config32948，日志20261003_182449.txt；原v2 inactive。identity脚本将所属D共享缓存配置器记OTHER/exit1，实际路径独立核对。普通Core正常退出保持配置器，随后关本配置器窗口，启动watcher62965终止exit0；原四文件SHA256/缺失状态保持。最终DextProcesses/DevListeners/ResourceCacheFiles/NativeFixtureDirectories为0。Core产品退出通知等待正常配置器三秒，不强杀卡死实例。整包Task4/最终P5审查与7项人工步骤仍未通过，16项就绪1/16，不合并。

## Task4媒体生命周期与独立Player故障补证（2026-10-03）
无idle保留桌面图标但禁用官方输入；checkpoint保留式Retire撤销旧连接/订阅/完成。内核23/23、协议87/87、动作185/185、JS/SDK/媒体策略143/143通过。
实际生产Rust安装/真实Core/WorkerW/ReleasePlayer/SDK四媒体分别通过预暂停start（900ms墙钟不消耗启动阶段）、恢复、同安装正常Core重启、两轮同Player idle/暂停/恢复与OS注入wake/Core stop，原父窗/边界及Desk/session/文档/实例保持。image/video/html证据为task4-lifecycle-{image,video,html}-suspend/native-core-live.log；GIF为task4-lifecycle-gif-barrier/native-core-live.log，owned Player中心十次像素播放/暂停/恢复变化/固定/变化。视频与HTML AudioContext实际时钟排除暂停段后继续前进。
独立Player故障task4-recovery-exposed：只Kill已核对绝对路径的本轮Player，同Core新PID/session/SDK恢复已提交focus/相同安装stamp/原KV；主动CloseAll不重生。初次GIF真实视觉RED后补原生内存静帧；第一修复重测缺少异步静帧可见屏障，补实际窗口屏障后整轮通过。其余夹具失败按ERRORS #195–197保留，不计生产RED。
最新完整build task4-verified-build成功；实际ReleasePlayer task4-frame-media-wire通过（其Core回包仍fixture）。最新实际Core退出task4-native-exit-core-live十三项PASS：No取消、Yes四产品进程正常退出，普通Core关闭保留配置器。实机finally恢复原四文件精确字节/缺失状态、用户Room哈希、原窗口旗标/前台/鼠标，Dext保持退出。
以上增加第1/4/5/11/16项基础证据；锁屏仅行为回归、未锁用户账户。实际物理输入/多DPI、窗口还原故障、个人布局/移动精确命中/遮挡/多图标/焦点与最终P5一次审查继续；最终七项人工门槛、完整十六项范围与开发就绪1/16保持，不中途合并。

- 2026-10-03 Task4常规启动复核：Core121280/Player68580/Watchdog114424/config99916，日志20261003_192301.txt；原v2会话inactive。identity脚本将所属D共享缓存配置器记OTHER/exit1，实际绝对路径已独立核对，没有宣称全脚本OK。按精确PID/path正常退出Core和配置器、watcher95129结束exit0，原四文件SHA256/缺失状态保持；最终DextProcesses/DevListeners/NativeFixtureDirectories均0，保持Dext退出。

## Task4个人布局原子保存与官方接线计划（BASE58cd855，2026-10-03）
一句目标：Core按Room副本持有普通图标/共享Widget的位置覆盖，官方桌面保存后重启读回；非法落点或保存失败回原位，缩屏产生的临时布局不写盘。
范围：独立layoutRevision与图标Desk/icon稳定ID、全局widget component ID，固定1920×1080坐标；仅当前安装/DesktopPlayer/session/revision私有read/save，写入限当前可操作desktop且无转场；只读布局可在暂停/starting保留，不返回其他个人数据，不加入iframe/SDK作者能力。Dock/scene/作者固定按钮不走桌面拖动；另存继续只复制按钮/皮肤，不复制布局/KV/授权。占用由视图当前有效报告计算。
先生产行为RED：重开/独立revision、不认识ID/非widget/非法坐标/旧revision/旧连接及暂停锁屏转场拒绝、阻塞发布保留旧字节；随后严格Player/native-host和私有Core接线，再DOM长按编辑/拖动、占用回滚及响应式临时调整、实际Core保存重启/故障恢复。每小段更新TODO并具名commit，保持Dext退出，最终一次整体P5审查后集中人工验收。
人工步骤沿独立验收卡第5/6项：长按普通图标/Widget进入桌面编辑并拖动，落占用区回原位；有效落点保存、重启恢复；缩屏临时移位再缩小，恢复尺寸回保存位置；作品/安装摘要不变，故障保存回原位，物理DPI和旧命中继续专项。此计划不代填任何人工通过，完整16项/就绪1/16、七项最终门槛保持。

## Task4个人布局Core与私有IPC补证（2026-10-03）
Core布局/动作回归202/202、严格消息38/38、生产JS/SDK/原生媒体策略146/146；新layout字段185/186、严格消息36/38及JS三项分别真实RED后GREEN。覆盖独立layout CAS、原子发布失败保留原字节及双revision、当前安装/角色/连接/Desk/Widget限制、并发单胜者、旧格式兼容、另存不复制布局及安全只读投影。layout-private-wire-green实际ReleasePlayer通过当前read/save DTO、闭合形状拒绝、原生暂停完成后安全布局metadata延迟至resume、普通暂停回包拒绝、撤销与旧文档拒绝；其Core回包仍fixture，未据此宣称实际Core保存端到端。
layout-pause-controller-build完整成功。新实际controller可见性错误先复现后修复（#198）；最新layout-native-pause-gif-verified真实Rust安装/Core/WorkerW/ReleasePlayer整轮成功，实际屏幕GIF十次样本播放变化/暂停固定/恢复变化、同Player两次idle/wake/Core stop和原父窗/边界/Desk/session/文档/实例保持，finally原四文件字节/缺失状态与用户Room哈希恢复。
常规start Core110068/Player31972/Watchdog24180/config109340，日志20261003_205127.txt；RPC观察active=False（--v3-status误把Core路径当expectedDesk后按夹具规则抛错，不记该命令通过）。identity脚本将所属D共享缓存配置器记OTHER，实际绝对路径独立核对。按PID/path正常关闭Core和配置器，watcher81581结束exit0；原四文件SHA256/缺失状态保持，OwnedProcesses/DevListeners/NativeFixtures/ResourceCacheFiles均0，保持Dext退出。
当前仍是Core/IPC基础，DOM未读入个人布局，不能宣称桌面拖动、占用回滚、临时响应式或实际Core布局保存/重启已交付。继续纯视图布局及DOM；最终一次P5整体审查、七项集中人工门槛与全十六项/readiness1/16保持，不合并master。

## Task4官方有效布局与Core读取补证（2026-10-03）
纯layout-model 21/21（显式损坏覆盖20/21先失败后修复）、新增七项DOM行为RED→35/35，全部生产JS/SDK/原生媒体策略174/174。Core确认布局按稳定ID投影，saved/effective分开，合法原尺寸位置优先、冲突先移位再等比缩小、恢复视口回原保存位置；resize/占用绝不发Save。Widget保留原作者iframe逻辑尺寸、父节点/instanceId，已接受的局部按钮按有效placement重算且不累计偏移；占用限制保留到scene显式新报告。读取token/scope/Desk拒绝迟到、不阻塞新Desk，失败保留确认呈现并关闭保存准备状态。
完整layout-dom-build成功，layout-dom-frame-media-wire实际ReleasePlayer整页/根与嵌套媒体/WebAudio/暂停/最新修订/作者攻击/撤销回归通过，Core回复在该夹具仍模拟。旧--no-build复制清单及模拟Core方法白名单未更新导致的两次夹具失败如实记录ERRORS #199，不记生产RED。
最新layout-dom-core-live真实Rust安装/实际Core/WorkerW/ReleasePlayer/SDK读取当前私有layout revision0在切页前后和正常Core重启后均ready=true/error=null；同Player切页保留共享文档，新Core恢复同安装focus/KV/新SDK/GIF/视频，无测试导航。这里只验证布局读取，未执行layoutSave，不宣称桌面保存/重启非空覆盖已交付。finally原四文件字节/缺失状态及用户Room哈希恢复。
常规start Core92228/Player118936/Watchdog70784/config8336，日志20261003_211317.txt，原v2 Player路径已核对；identity的所属D共享配置器记OTHER，绝对路径独立核验，未宣称全脚本OK。精确PID/path正常退出Core/配置器，watcher19473终止exit1（CtrlC），原四文件SHA256/缺失状态不变；OwnedProcesses/DevListeners/NativeFixtures/ResourceCacheFiles为0，保持Dext关闭。
当前还没有长按编辑/拖动Save UI。下一段接官方Widget把手、编辑态空动作几何/原生pointer、UP一次原子保存与非法落点/失败回滚，再验证真实Core非空布局保存/重启。精确旋转/遮挡/多图标/焦点/物理DPI仍继续，最终一次P5整体审查、七项集中人工门槛、完整十六项/readiness1/16保持，不中途合并。

2026-10-03用户调整：桌面拖动先略过，保留待恢复；当前继续P5精确输入/遮挡/多图标与受控焦点。每次推进报告完整16项开发就绪比例，目前1/16=6.25%（对话约6%），此为交付覆盖率，不能将阶段测试数当百分比。Dext实机探针结束后保持关闭。
