# v3 连续交付与最终验收台账

> 2026-10-02：用户授权目标模式持续推进 v3 完整路线，至少达到计划 80%，尽量一次完成，再集中人工验收。此授权允许顺序执行后续工作包；各包仍有独立分支、worktree、验收卡和提交，最终确认前不合并 master。
> 需求依据：V3_PLAN §1–§7、PROJECT 已确认决策。执行入口仍为 ROADMAP；本表是证据台账，不替换产品要求。

## 完成口径

从 V3_PLAN §6.2 取出 16 项基础版交付，游戏的两项属于 F1 后续，不计入基础版。每项保留全部原要求；代码存在、演示原型、v2 同名功能均不能单独证明 v3 交付。开发就绪需自动验证与对应真实宿主证据，最终用户验收单独记录。13/16 约为 81%，持续目标为 16/16；此计数表达要求覆盖率，不是工时百分比。

| # | 原计划交付 | 当前证据与不足 | 开发就绪 |
|---|---|---|---|
| 1 | 契约与安装快照 | P3-001原生清单/摘要安装与Core复核、审查竞态修正；P5已证真实Rust安装→Core/Player切页；同安装副本Core重启及正式配置器创建/保存/重开/实际应用已验证；最终全链组合复核保留 | 否 |
| 2 | Room/Desk 状态服务 | V3-CORE-001～005；协议30/30、真实切页/重启恢复，2026-09-30 验收合入 | 是 |
| 3 | 本机绑定与授权服务 | Core私有绑定/授权、消费者KV与作者SDK导航/媒体/音量/可信退出已验证；RawInput静止精确命中、DOWN正数关联254/254；Core/Player鼠标/作者Enter/Space与SDK正数汇合基础通过；源鼠标保护动作Core类281/281、真实Player移动图标取样通过；已有焦点Enter/Space可见采样Core288/288及实际Player通过；单次Tab/移动焦点及连续Tab早到键Core295/295、生产Core类/实际Player组合通过；实际Core OS与个人编辑UI待贯通 | 否 |
| 4 | 持续桌面 Player | P5正式持续DOM与实际Core切页保持同Player/两份SDK文档；作者纯视觉矩阵/焦点及实际Player仪表盘同文档bottom→full→bottom基础通过；SDK有效矩形与640×480 scale1.5展开/放大缩回已验证；完整Core输入/异常恢复组合待完成 | 否 |
| 5 | 启动、待机与暂停生命周期 | 实际Core四媒体start/idle/暂停/wake与GIF视觉冻结、同安装Core重启/独立Player故障重建及WebAudio已验证；真实Windows锁屏、DPI与最终组合门槛保留 | 否 |
| 6 | 布局与输入同步 | 个人布局Core/私有IPC/DOM读取与saved/effective呈现、静止凸区域/遮挡/多图标/焦点已验证；Core两边事件取样与真实Player移动源图标样本已接；已有焦点Enter/Space两边可见采样已接；单次Tab/移动焦点与连续键顺序Core295/295、生产Core类/实际Player组合通过；作者矩阵本地帧/保持/焦点与实际Player通过；作者/有效布局小窗口展开及恢复已验证，实际Core OS/DPI继续，桌面拖动按用户暂缓 | 否 |
| 7 | 简单 Room 创建与节点保存 | 真实Tauri创建/四媒体导入/HTML依赖/Dock、稳定节点/历史/保存重开/库改名/失败原文保持，实际Core/Player应用呈现和同安装普通重启/来源状态通过；默认桌面导航/动画、非起点恢复/系统选择框及最终整体审查待集中 | 否 |
| 8 | Dock 模板与交互编辑 | P6-002正式v3模板/共享值/逐字段差异和实际Core/Player/重启已接；实际可操作桌面读数/导航及集中验收未完成 | 否 |
| 9 | 统一按钮与个人呈现编辑 | P6-003按钮/目标/覆盖/皮肤及多普通呈现已实现并部分实机；最后定位/表单收尾完整打包和重启集中 | 否 |
| 10 | 试验台与作者诊断 | P7原生只读资源会话、正式DOM/SDK预览适配、多尺寸/Desk/模拟拒绝与区域/资源诊断已编码；必要构建/一次真实冒烟未做 | 否 |
| 11 | 本地 HTML 安全 | v2沙箱基础可复用；v3资源快照、作者API、外部导航/代码/原生消息/权限逃逸待验证 | 否 |
| 12 | 顶层 Dock 自动隐藏 | P8-001编码4/5=80%，正式Core/SDK/输入/任务栏恢复及高度反馈已接线；构建/Windows集中门槛待 | 否 |
| 13 | 顶层 Dock 常驻占位 | P8-002编码3/4=75%，统一模式/正式宿主/AppBar与实际工作区确认已接线；Windows运行和故障恢复仍待 | 否 |
| 14 | 另存与分享 | P10-001编码3/4=75%；原生作者资源zip/独立UUID、本机绑定皮肤复制、当前草稿另存及删除重试接线；构建/实际全链待游戏后 | 否 |
| 15 | 发布后 Room 兼容门槛 | P10-002编码3/4=75%；API1冻结基线、六套作者/zip及摘要、Rust/Core未知要求拒绝和UI只读接线；实际升级全链回归仍待 | 否 |
| 16 | 恢复与发布收口 | P10-003编码4/5=80%；认证残留恢复/清理与UI、v3专用Release路径/资产、实际计时/资源采样已接线；完整Release全链/实测性能/最终审查仍待 | 否 |

## 顺序与工程约束

1. V3-P3-001：正式清单、路径/资源校验、内容摘要安装快照、双语言一致性样包。
2. 绑定权限与持久个人覆盖，作者动作只接受宿主核验的输入。
3. 原生v3持续Player、共享场景/默认及作者动画、布局和生命周期；验证P2a剩余物理输入/DPI。
4. 创建/节点/Dock模板与差异、统一按钮/皮肤、作者试验台，全部贯通v3契约。
5. P2b原生Dock输入与AppBar实验，再接两种Dock产品模式和恢复看护。
6. 分享/另存/删除个人数据、首发样包库、Release及性能与全链验收。

Rust缓存放D盘并复用同一个Tauri target，避免每个worktree复制数GB缓存。旧用户Room和个人数据不被当作测试夹具；实机测试保存并恢复运行布局。每一步提交具名文件，遇坑追加ERRORS。

## 执行记录

- 2026-10-02：master=e67cd03，干净；创建隔离worktree `v3-room-contract`，分支 `feat/V3-P3-001-room-contract`。本轮按用户授权连续开发，设计和阶段验收集中到最终交付；不另加中途确认门槛。

## 最终验收来源

V3_PLAN §7 A/B/C/D/E/G/H全部纳入最终验收；F仅属后续游戏候选。基础内容图片、视频、GIF、本地HTML逐类创建/导入、预览、应用、切页、恢复、分享。每项证据链接随实际执行追加，缺证据保持未就绪。

## P5正式原生页面基础补证（2026-10-03）

Core消费者权限/逐值数据98/98、严格消息28/28、实际Windows只读来源通过；正式SDK/模型/媒体/iframe/暂停/通信/DOM/入口组合91/91。真实ReleasePlayer整套官方页保持两个SDK文档，逐值私有IPC、同revision撤权恢复、Core fixture提交、queue/原生暂停/latest状态和撤销释放通过；完整构建/本分支启动身份门槛通过后正常退出。

以上为条目3/4/5/6/11/16的基础证据。隔离Player仍模拟Core回复；实际Core原生Room/WorkerW生命周期、HTML逐iframe音视频、个人布局/精确移动与非矩形命中/遮挡/多图标/焦点、物理DPI和异常恢复尚待Task3/4，作者控制/存储/退出确认适配及其余产品包亦未完成。不得把临时拒绝的输入范围当作减少原要求。开发就绪继续1/16，13/16目标与最终16/16范围不变。

## P5真实Core原生接入补证（2026-10-03）

生产Rust安装、真实Core独立复核、实际WorkerW/ReleasePlayer、GIF启动、SDK/几何、Corehome→focus revision2→4与同Player/两个SDK文档保持已验证；视频实际解码播放，授权诊断双缺陷先RED后修复，完整JS105/105。临时官方顶部导航只计协议回归，所有Core回复/权限/Windows事实/提交均为真实来源。原桌面、布局/设置/checkpoint逐字节及用户Room哈希恢复，完整build→start/identity和正常退出后进程/端口/暂存0。

第1/4/5项因此补基础证据；正式配置器应用与重启、完整生命周期、个人布局/占用/精确命中/物理输入/DPI及故障恢复等门槛仍未完成。最终7项人工步骤与16项完整范围不变，当前开发就绪1/16。

- Task4实际Core正常重启补证：同安装摘要、新Player/新session无需测试导航自动恢复focus；每个新文档GIF启动观察一次559ms/558ms，SDK新文档和实际视频解码恢复，原用户桌面与数据精确恢复。此项不替代独立Player故障重建、完整idle/锁屏、WebAudio和正式配置器门槛，开发就绪仍1/16。

## P5 WebAudio原生基础补证（2026-10-03）

生产116/116与真实ReleasePlayer整页验证AudioContext私有输出闸门、原生suspend完成屏障、作者暂停意图、根/嵌套文档实际时钟；作者Array与Object.toJSON攻击先RED后修复。实际Core生产安装/同副本正常重启补证两份新SDK文档AudioContext运行、focus自动恢复、GIF start仅一次与视频解码，原用户桌面/数据精确恢复。最后回执补强后完整build/实际Player/start/identity通过，正常退出后进程/端口/暂存0。

第5/11项增加基础证据。完整四媒体idle/锁屏、独立Player故障、作者控制/存储/确认、布局/精确移动命中/物理输入/DPI和其余产品项仍继续；不声称AudioWorklet或全恶意内容安全验证。最终7项人工步骤保持，开发就绪仍1/16。

## P5消费者存储Core基础补证（2026-10-03）

Core按副本/消费者隔离JSON KV，当前读写分别授权、配额、故障原字节保留、旧format1兼容、私有连接关闭拒绝；生产110/110，完整build→start/identity与用户个人快照不变检查通过，随后正常退出。该Core基础阶段当时尚未接通Player严格消息/正式DOM/SDK与实际Core已授权KV端到端，作者能力当时仍unsupported；最新状态见下一节。该基础不增加开发就绪计数，保持1/16和完整最终7项/16项。

## P5消费者存储实际接入补证（2026-10-03）

取代上一节“当时未接通”的阶段状态：正式SDK get/set、固定消费者DOM、严格Player原生消息和当前Core私有授权KV已经贯通。生产JS121/121、原生消息30/30、存储/动作110/110；实际生产Rust安装/真实Core/WorkerW/ReleasePlayer验证同key消费者隔离、Unicode/ISO字符串、撤权拒绝与授权恢复、同安装副本Core正常重启后的原值读取。原生日志不含私有KV值曾实失败，再修复并通过。测试授权仅新临时Room，由夹具管理员准备，不代填权限UI验收。

用户grid规则实测正常暂停，隔离探针临时前台算法运行并finally恢复所有原设置；原桌面、布局/checkpoint/个人数据和用户Room哈希恢复。完整build→start/identity/正常退出，个人快照不变，进程/监听/暂存0。该证据补条目3/4/11/16基础；作者导航/系统控制/退出确认、完整四媒体idle/锁屏与Player故障、个人布局/精确输入/物理DPI及其余产品项继续。开发就绪保持1/16，最终7项/16项不减。

## P5作者导航Core适配基础补证（2026-10-03）

Core私有桥从当前原生完成证明取得consumer/button，作者仅请求合法导航意图；同当前个人/安装/修订/权限边界复核并一次消费。已配置默认/个人动作优先，无配置入口可动态导航；无作者默认动作时的TargetId-only个人绑定补为binding.launch，未知Desk拒绝不消费证明。实际源码RED→128/128，完整build→start/identity与正常退出、个人快照不变通过。

正向输入由生产native authority方法构造，非Windows物理事件。正式navigate消息、统一input-host、SDK及已授权真实Core作者导航仍继续；这不是整体导航/输入门槛。全16项/最终7项保留，开发就绪仍1/16。


- 2026-10-03P5作者导航补证：严格原生navigate+私有完成序号/真实消费回执+100ms默认回退接通，个人绑定优先和一次消费保留。JS132/132、动作132/132、消息32/32；实际Core作者SDK在Windows注入后accepted/一次切页，无输入timer拒绝，共享文档保留；正常重启同安装恢复focus/KV，全11PASS。原用户数据、临时showdesktop窗口状态与鼠标恢复；常规启动身份及正常关闭已验证。仍为P5阶段实现，完整Task3/4、最终7项和全16就绪1/16未提前完成，系统控制/退出确认/生命周期/个人布局与精确输入继续。


## Task3系统控制原生接线与真实Core（2026-10-03）
封闭媒体五意图与有限音量patch贯通正式SDK/固定consumer DOM/严格Player消息/Core当前私有授权/真实证明/Windows服务；个人默认/绑定优先，限频与一次消费、真实消费回执统一fallback。JS140/140、消息35/35、Core168/168，分别先RED再GREEN；并发限每attachment1/全Core4、外层4s，超时原任务槽位留至实际终止。实际取消音量请求不写设备。

最终完整build后实际Rust安装/Core独立校验/WorkerW/ReleasePlayer：Player92064、sessionfc8791a9-596b-491a-ab7d-4d5f67c28c9c；音量改动→恢复原endpoint，五媒体意图只在真实Core当前title核验为本轮拥有的静音WinRT publisher时发出，均观察到本机回调。8次Windows注入各一次消费/accepted、无默认重复，共享文档保持并由作者动态导航提交focus。正常重启同安装stamp31a93df7...96fee、新Player71896/session1fd1777b...恢复focus/KV/新SDK/GIF/视频；最终15项PASS。

最初并发无输入、标题观察容量导致探针整轮未过，均保留失败证据并纠正夹具，未降生产输入/权限/并发规则。最终finally恢复原桌面、布局/settings/checkpoint/personal字节或不存在状态、用户Room哈希、原endpoint音量/静音、临时showdesktop窗口旗标/前台/鼠标；不代填物理DPI/听音/完整生命周期人工通过。

常规最终start Core40928/Player124608/Watchdog99404/config69696、日志20261003_173146.txt，原v2 inactive。配置器是所属D共享缓存，identity脚本OTHER/exit1并单独核对路径；没有宣称全脚本OK。正常精确PID/path退出，watcher41725exit0、个人原SHA256/缺失状态保持。可信退出确认及完整Task4仍继续，完整16项/readiness1/16、上方7项人工验收和最终P5审查不减、不提前合并。

## P5可信退出确认基础补证（2026-10-03）

dext.exit经真实一次Core输入签发仅内存可用的确认续体，Core原生Dext确认窗锁外、默认否、单窗；取消消费许可保持运行，确认后当前授权/绑定/安装/消费者/按钮/文档/锁屏重查。作者没有确认方法或私有token。正式SDK/DOM、严格Player消息和实际Core/配置器正常产品退出已贯通：185/141/36项与Rust生命周期7/7；最终真实安装/SDK/OS鼠标No/Yes整轮13PASS，普通Core退出保留配置器。

最终正常build→start/身份及原v2 inactive、按PID/path正常关闭、用户四文件原hash/缺失状态与Room哈希恢复、进程/端口/暂存/夹具0；失败夹具和精确恢复记录保留。配置器产品退出监听核对当前worktree及实际Core PID/path，三秒通知等待不强杀卡死实例。此补条目3/4/11/16基础；完整四媒体生命周期/独立Player故障/个人布局/移动与精确输入、最终7项人工门槛和其余产品交付继续，开发就绪保持1/16。

## Task4媒体生命周期与独立Player故障补证（2026-10-03）
无idle保留桌面图标但禁用官方输入；checkpoint保留式Retire撤销旧连接/订阅/完成。内核23/23、协议87/87、动作185/185、JS/SDK/媒体策略143/143通过。
实际生产Rust安装/真实Core/WorkerW/ReleasePlayer/SDK四媒体分别通过预暂停start（900ms墙钟不消耗启动阶段）、恢复、同安装正常Core重启、两轮同Player idle/暂停/恢复与OS注入wake/Core stop，原父窗/边界及Desk/session/文档/实例保持。image/video/html证据为task4-lifecycle-{image,video,html}-suspend/native-core-live.log；GIF为task4-lifecycle-gif-barrier/native-core-live.log，owned Player中心十次像素播放/暂停/恢复变化/固定/变化。视频与HTML AudioContext实际时钟排除暂停段后继续前进。
独立Player故障task4-recovery-exposed：只Kill已核对绝对路径的本轮Player，同Core新PID/session/SDK恢复已提交focus/相同安装stamp/原KV；主动CloseAll不重生。初次GIF真实视觉RED后补原生内存静帧；第一修复重测缺少异步静帧可见屏障，补实际窗口屏障后整轮通过。其余夹具失败按ERRORS #195–197保留，不计生产RED。
最新完整build task4-verified-build成功；实际ReleasePlayer task4-frame-media-wire通过（其Core回包仍fixture）。最新实际Core退出task4-native-exit-core-live十三项PASS：No取消、Yes四产品进程正常退出，普通Core关闭保留配置器。实机finally恢复原四文件精确字节/缺失状态、用户Room哈希、原窗口旗标/前台/鼠标，Dext保持退出。
以上增加第1/4/5/11/16项基础证据；锁屏仅行为回归、未锁用户账户。实际物理输入/多DPI、窗口还原故障、个人布局/移动精确命中/遮挡/多图标/焦点与最终P5一次审查继续；最终七项人工门槛、完整十六项范围与开发就绪1/16保持，不中途合并。

- 2026-10-03 Task4常规启动复核：Core121280/Player68580/Watchdog114424/config99916，日志20261003_192301.txt；原v2会话inactive。identity脚本将所属D共享缓存配置器记OTHER/exit1，实际绝对路径已独立核对，没有宣称全脚本OK。按精确PID/path正常退出Core和配置器、watcher95129结束exit0，原四文件SHA256/缺失状态保持；最终DextProcesses/DevListeners/NativeFixtureDirectories均0，保持Dext退出。

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

## P5静止精确区域/多图标/焦点基础验证（2026-10-03）
纯geometry20/20，生产JS/SDK/媒体策略205/205；Core authority237/237、strict native message69/69，分别真实行为RED后修正。完整precise-core-build四阶段成功。actualReleasePlayer precise-official-host-wire通过：严格Player保留同动作双icon的两个凸区域，模拟Core焦点准确选第二icon并显示SVG、几何失效清除；原正式SDK/同文档/队列/暂停/最新修订/撤销门槛保持。此wire的Core回包仍fixture，不当作实际Windows物理证明。

本阶段实际Core作者动作探针尚未完成。两轮前台未满足导致动作/KV拒绝，后续两轮将曝光/空白桌面聚焦前置后，安全像素门槛拒绝继续点击；最终记录命中Credential Dialog Xaml Host，并独立核实系统CredentialUIBroker.exe占前台。没有关闭该系统凭据窗或放宽Core规则，四轮finally原桌面/布局/settings/checkpoint/personal字节或缺失状态/用户Room以及临时窗口旗标均恢复，Dext退出。已询问用户关闭窗口后补测；等待期间继续作者派发守卫和移动采样设计。该外部条件仅阻挡实际Core输入补证，不标完整P5完成。

常规build后start Core113804/Player46424/Watchdog125196/config80780、日志20261003_222129.txt；原v2 Player路径核对，Core/插件产品身份及mutex/pipe/data/log报告OK。共享D缓存配置器由identity报告OTHER/exit1，实际绝对路径独立核对，没有宣称全脚本OK。按精确PID/path正常退出Core和配置器、watcher74869 exit0、原四文件SHA256/缺失状态不变；OwnedProcesses=0，本轮1420/1421/1621开发监听=0，NativeFixtureDirectories=0，ResourceCacheFiles=0。保持Dext关闭。

当前完成的是静止几何与受控焦点基础；默认动画事件取样、source手势级动作、原生作者同步事件见证与Core实机补证继续，桌面拖动按用户暂缓。全16项交付开发就绪仍1/16=6.25%（对话约6%），最终7项人工与单次整体P5审查保持待执行，不合并master。

## P5 同步输入守卫与原生请求汇合基础验证（2026-10-04）

私有guardian在作者脚本前与媒体policy同次bootstrap安装；只在当前真实primary鼠标/Enter/Space回调内接受完整SDK requestJson，原始method/params/requestId固定到私有文档/gesture/structural/dispatch envelope。add/remove、inline/property、once/AbortSignal、native Window裸调用和onerror五参数保留；非输入重入清上下文，返回后恢复外层回调，跨文档getter/收养节点不能借父回调。私有描述/arm/revoke回执不暴露消费票据。

行为RED/GREEN包含嵌入缺失、prototype捕获、Window默认this、native onerror参数以及真实child点击借收养父wrapper。最终guardian24/24、完整生产JS229/229、真实headless Chromium40检查通过；Chromium驱动的可信事件不是Windows/Core物理证据。native request join先43/83与撤销边界83/84失败后84/84；两路不可变typed请求、native scope、固定半包1500ms、64pending/196frame、重复/错配/旧文档清理验证。该半包期限不替代Core从真实DOWN起的期限。

完整guardian-core-build-final四阶段成功。guardian-frame-media-wire-green实际ReleasePlayer两个作者文档初始化、guardian默认关闭/受保护hooks、根/闭合shadow/嵌套音视频与WebAudio暂停/恢复、最新修订、撤销回归通过；Core回包仍fixture，没有签发正数原生gesture。常规start Core7084/Player121916/Watchdog122856/config100832；identity插件/pipe/mutex/data/log正常，所属D共享配置器OTHER/exit1且路径独立核对。精确正常关闭、watcher9524 exit0、原四文件hash/缺失保持、浏览器关闭，Dext进程0。

本阶段只交付私有基础，生产SDK尚未提交witness，实际native frame注册/同UI原生输入arm、Core精确正数gesture、移动取样和source动作还需接通，当前author inputSequence=0仍存在。不得以本阶段通过宣称整条动作链的timer/最近完成问题已解决。用户指定本地功能优先，后续不扩展网络安全测试；桌面拖动暂缓，实际Core输入受系统凭据窗影响的补证保持待恢复。最终人工仍按上方第4项鼠标/Enter/Space与异步/伪造/重调，第5项移动/遮挡/多入口/DPI集中执行，不新增中途验收。全16项就绪1/16=6.25%（约6%），7项和单次P5审查不提前勾选，不合并master。

- 最终清理补记：常规日志20261004_003713.txt，本轮1420/1421/1621监听0。git staged check发现新guardian末尾空行，仅修正EOF格式后继续提交，不重跑已充分验证的行为。

## P5 Core真实DOWN正数关联基础验证（2026-10-04）
Core当前RawInput适配已调用的MouseDown/Key流程，现改为在可操作实际视口内DOWN时分配私有正数序号并冻结generation/session/revision/geometryVersion/HWND/viewport/DPI/OS点/键和单调时间；UP沿用原序号完成。空静止区域可保留raw点供后续运动样本配对，单独DOWN或无命中UP不产生动作证明。重复DOWN不改序号/时间，拖动超容差、结构/窗口/前台变化与跨键鼠新DOWN取消旧配对，按住状态保留到对应UP。

新增实际生产行为RED238/254（16失败，其中1500ms UP错误生成proof），修复后gesture-down-core-green 254/254。完成时和动作准备统一从DOWN起1500ms半开期限，UP/移动/重读不续期；已及时完成但后来过期的proof仍由动作权威返回expiredInput，已过期的未完成DOWN不能再生成完成。未做新的网络安全专项。本轮只验证Core生产类与必要动作回归，没有补填被凭据窗阻挡的实际Core OS输入。

完整gesture-down-core-build四阶段通过；常规start Core73828/Player123844/Watchdog113464/config24756，日志20261004_010606.txt。identity Core/Player/Watchdog及产品/mutex/pipe/data/log OK，所属D共享配置器OTHER/exit1且绝对路径独立核验。精确正常关闭、watcher33543 exit0、原四文件hash/缺失保持，Dext进程0、1420/1421/1621监听0。首次启动调用自动审批超时在CreateProcess前拒绝，原参数单次重试后成功。

下一段传送冻结gesture到Player，在同UI操作内arm和真实Win32转发，再贯通nativeframe witness/SDK requestId及移动DOWN/UP样本。当前SDK/nativeframe尚未使用本关联，author inputSequence=0路径仍在，不能宣称整条作者异步借用已修好；source动作继续，拖动按用户暂缓。最终集中人工仍为卡第4项鼠标/Enter/Space、长按超时/AltTab取消，第5项移动/遮挡/多图标/DPI；完整16项就绪1/16=6.25%（約6%）、七项人工与单次P5审查不提前打勾，不合并master。

## P5 SDK正数鼠标与作者Enter/Space接线补证（2026-10-04）
Core受控Tab焦点后的真实Enter/Space DOWN扩展冻结Key/ScanCode/extended/consumer/button/entry私有字段，UP使用同次关联。Player同UI队列先原生controller.MoveFocus(Programmatic)，只对选中consumer的唯一直接作者root arm与捕获Window.focus，再发送Win32 DOWN/UP；不调用作者DOM节点focus或改Tab顺序，官方入口保持Core默认激活。作者SDK仍原rN完整请求与native文档见证汇合，仅同UP转发后发送正数Core动作。

行为：DTO/队列RED10/13→13/13，guardian焦点RED24/25→25/25，生产JS233/233；选中consumer与原动作delivery8/8，Core动作254/254。仅Window.focus与WinForms.Focus的实际两轮没有keydown；NativeViewController原生MoveFocus修正后实际ReleasePlayer+正式SDK Enter、Space和鼠标均exit0，trusted DOWN等UP，一次Core n1/gesture7，前台HWND不变（ERRORS #211）。失败证据保留，Core包/回执及小official route为fixture，正式DOM另由既有行为回归；不当作真实Core OS输入验收。

keyboard-controller-focus-build完整四阶段和keyboard-frame-media-wire-final实际媒体回归通过。常规start Core56016/Player54552/Watchdog106276/config96456，日志20261004_032947.txt；共享配置器OTHER/exit1且精确绝对路径独立核验。正常关闭、watcher91523 exit0，原四文件SHA256/缺失状态保持，Dext进程/开发监听/author fixture均0，Dext保持关闭。

移动即时样本/source动作与Core内部零序号兼容收口继续；实际Core输入补证仍待凭据窗解除。最终人工第4项鼠标/Enter/Space、长按/AltTab取消，第5项移动/遮挡/多入口/DPI集中执行，拖动按用户暂缓；不新增网络专项、不加中途验收，七项与单次全P5审查仍待执行，整体16项就绪1/16≈6%，不合并master。

## P5 移动可见区取样配对生产基础（2026-10-04）
RoomNativeInputAuthority新增内部sampleMouse模式与SampleMouse：raw DOWN冻结原QPC/序号/OS点，raw UP冻结释放点，任一可见区半包不能完成；两个edge命中同consumer/button/entry才建立原始DOWN期限的proof。严格凸多边形沿用DextNativeGeometry不可变副本，移动区域可以位置不同，前层遮挡空区域或同动作不同图标不配对；重复样本不替换，拖动/1500ms/原生视口DPI/前台/结构修订变化仍取消。静止旧模式保持原行为，生产适配尚未切换。

官方DOM readInputSample只在当前ack/identity/geometryVersion下读取已绘制visualGroups，允许当前moving节点并扣除当前moving前层，返回独立normalized凸区域，不触发逐帧native消息。Core新API缺失编译RED后实现，完整动作回归含18项本地采样行为272/272。DOM RED43/46缺API→45/46（测试精确归一化宽度断言）→46/46；只修测试到机器舍入误差，未扩大实际命中区（ERRORS #212）。

event-sample-core-build四阶段通过，常规start Core55712/Player82324/Watchdog93260/config65212，日志20261004_034829.txt；核对DLL构建03:48:23早于03:48:29启动，共享D配置器OTHER/exit1而绝对路径独立核验。精确正常关闭、watcher82155 exit0，原四文件hash/缺失保持、Dext进程/开发监听/author fixtures0。

Player私有采样通道与原生派发期间视觉保持/释放尚未接，生产Core仍静止模式；此阶段不能声称移动点击、source动作或实际Core物理门槛已通过。继续完成整条链并以实际Player/Core证据验证，最终第4项真实鼠标/Enter/Space、长按/AltTab，第5项移动/遮挡/多入口/DPI集中验收。拖动暂缓、无新增网络专项/中途验收，七项及单次全P5审查保持待执行，完整16项就绪1/16≈6%，不合并master。
## P5 Player原生采样与派发屏障验证（2026-10-04）
同一Player UI队列先读取正式DOM已绘制凸区域并保持官方RAF，再转发Win32 DOWN/UP；当前直接作者root或官方top实际trusted primary事件回执到达后，释放视觉并发私有样本。默认动画随后沿原活动时钟继续，无逐帧IPC。Core重测实际HWND/OS origin/尺寸/DPI/前台、当前安装/scope/声明入口，并以自己的原始raw点配对；两个edge同entry才完成，UP样本先于同UP释放的作者动作。
队列RED缺prepare参数→15/15、DOM hold RED46/48→48/48、消息71/71、Core动作273/273；官方顶层字符串回执RED26/27→27/27。正式geometry已eventSamples:true，前阶段“未接线/静止生产”只为8a738f1历史，当前由本节替代。
event-barrier-sample-native-wire实际ReleasePlayer/正式SDK：可信DOWN/UP两份私有样本先于一次原r1→n1/gesture7作者动作；小official几何/路由及Core包/回执fixture。event-barrier-official-top-wire-final实际生产index/main/dom/native/frame/media/SDK：两个精确图标多边形采样、同入口一条官方动作、原前台不变；切页、同文档、受控SVG焦点/清除、暂停/最新修订和撤销通过。首轮顶层对象receipt被现有字符串receiver拒绝，按ERRORS #170补充修复后整轮exit0，未放宽来源/物理权限。实际wire图标静止；运动/遮挡为DOM行为证据，不据此填写移动或实际Core OS/DPI验收。
event-barrier-enter-native-wire-final/space-native-wire-final与frame-media-wire-final必要回归均exit0。event-barrier-core-build-final完整四阶段成功后，常规start Core25536/Player57252/Watchdog30248/config120196，日志20261004_043025.txt。产品/插件/mutex/pipe/data/log正常，共享D配置器在identity脚本为OTHER/exit1且精确绝对路径独立核验；本次常规启动恢复原v2，不计原生v3物理输入。
精确正常退出Core/配置器、watcher73666 exit0；原四文件SHA256/缺失保持，Dext进程/1420/1421/1621监听/author与official GUID临时目录0。后续source手势级准入、真正移动正式宿主与Core OS输入、物理DPI/锁屏和故障还原保持完整范围；凭据窗限制不能用fixture代替。拖动按用户暂缓，本地功能优先、无新网络专项/中途验收/master合并，完整16项就绪仍1/16=6.25%（约6%）；最终第4/5项与七项/单次P5审查集中执行。
## P5 转场source鼠标入口与真实移动Player验证（2026-10-04）
Core原生完成增加内部SampledMouse，source scope只给当前同一两边视觉样本完成；普通无proof票据/旧静止键盘完成不扩大source。保护动作沿实际私有bridge票据查回原proof，在准备和消费处重核，原consumer声明/按钮Desk/授权/个人动作/1500ms/QPC/一次消费保留。导航仍以现有target排最后意图。只读按钮与已授权保护动作能力可显示source，源data/storage仍按target活动规则拒绝。源退出的Core原生确认冻结原source/target对，确认自身失焦提交同target后继续复核安装/会话/声明/授权/个人配置/锁屏。
修正媒体夹具先desktop、退出确认沿同bridge后，对提交基线重跑实质source-action-core-corrected-red 272/281（8新增功能与1旧元数据预期变更），当前source-action-core-corrected-green281/281。四类consumer源应用一次启动、无输入源票据拒绝、动作元数据不授予storage、导航相对target排队、源媒体控制一次消费、可信退出自身pause后保持决定均通过；原失败历史与夹具原因见ERRORS #213。
公开geometry允许仍挂载source消费者的声明Desk矩形，标准边界几何仍target有效区域；物理event sample按当前画布/遮挡裁剪source/target图标和Widget，commit后去掉source。DOM真实行为RED48/50；修复后DOM50+model15=65/65，无逐帧IPC。
source-moving-official-wire actual ReleasePlayer/生产index/main/dom/native/frame/media/SDK整轮exit0：4500ms滑动进行中源图标两个采样X不同、各自精确凸区域都包含同一实际鼠标点；两个可信原生边沿回执后gesture8只释放一次原官方动作、前台不变。已有静止采样/图标区分/焦点/切页/同文档/暂停/最新修订/撤销保持。该wire的Core输入包/回复为fixture，不能代填实际Core OS证明。
实际source-action-native-core-live已尝试生产安装/Core/WorkerW，但WindowsFromPoint仍命中Credential Dialog Xaml Host全屏；Orca可见应用列表未列出且process.MainWindowHandle=0是弱证据。点击前断言停止、没有点击/关闭系统凭据窗，finally恢复原壁纸、四文件原字节/缺失、Room哈希和临时窗口旗标；此轮不计实际Core输入通过（ERRORS #191补充），待系统窗真正解除才补。
source-action-core-build完整四阶段后常规start Core43772/Player72276/Watchdog120536/config119928，日志20261004_050155.txt。identity共享D配置器OTHER/exit1且精确绝对路径独立核验。精确正常关闭Core/配置器，watcher2576 exit0，原四文件hash/缺失状态保持，Dext进程/开发监听/author、official、Core原生GUID目录0。
此阶段完成转场源鼠标入口与保护动作基础。动态键盘焦点的再次可见取样、完整Core OS/物理DPI/锁屏/故障还原和最终7项/单次P5整体审查仍继续；Core旧零值proof兼容待全输入链收口。桌面拖动按用户暂缓，本地功能优先、无新增网络专项/中途验收/master合并；完整16项就绪1/16=6.25%（約6%）。

## P5 受控焦点 Enter/Space 的当前可见样本验证（2026-10-04）
正式eventSamples模式下Core原始Enter/Space DOWN冻结同一键/焦点entry/正数序号/QPC，UP仅记录释放。Player私有SampleKeyboard沿同UI队列读取已绘制source/target可见凸区域并保持官方RAF；两边都含Core原焦点同entry才形成SampledVisual并允许一次源保护动作，移动改变矩形不换entry，缺一边/遮挡/同动作另实例均不完成。
作者只arm当前consumer直接root，真实trusted keydown/up回执后发msg_room_native_sample，UP样本先于一次SDK原请求释放。官方默认按钮复用Core实际原始键事实，只读取样本，不向官方DOM合成键事件；样本不能创建Core输入，OS HWND/bounds/DPI/前台/修订/期限复核保留。source data/storage仍按目标上下文，普通静止键完成不扩大source。
新API编译RED保留；必要Core功能keyboard-visible-core-green 288/288（Enter/Space配对、隐藏半边、同按钮另实例、源应用两种键一次消费），可信键回执夹具修正receiver后实质RED27/28→28/28，私有DTO/队列16/16。fixture调用与部分文本替换问题见ERRORS #214。
keyboard-visible-enter-wire和space-wire实际ReleasePlayer+正式SDK整轮exit0：trusted DOWN等待同UP，两份键盘样本先于唯一r1→n1/gesture7请求，前台不变。其official几何/路由和Core包/回复fixture。
keyboard-visible-moving-official-wire实际ReleasePlayer+生产index/main/dom/native/frame/media/SDK整轮exit0：真正移动源图标键盘两边X不同、同entry当前区域，样本先于唯一gesture9默认动作；旧静止/移动鼠标、图标区分、焦点、切页/共享文档、暂停/最新修订、撤销继续通过。该官方键不合成DOM事件；Core物理键/包/回复fixture，不代填真实Core OS。
keyboard-visible-core-build四阶段后常规start Core48472/Player53308/Watchdog97636/config116124，日志20261004_052345.txt。identity共享D配置器OTHER/exit1，精确四进程路径独立核验；常规恢复原v2不计v3物理输入。正常退出、watcher58656 exit0，原四文件hash/缺失保持、Dext进程/开发监听/原生author及official临时目录0，Dext保持关闭。
本段只完成已有Core受控焦点的动态Enter/Space。转场中新的Tab遍历仍用边界表，动态Tab与移动焦点显示继续；Core零序号兼容、实际Core OS/物理DPI/锁屏/故障还原和最终7项/单次P5审查未完成。系统凭据宿主仍为实际桌面阻碍，本轮不重复Core桌面点击。拖动暂缓、本地功能优先、无新增网络专项/中途验收/master合并，16项就绪仍1/16=6.25%（约6%），13/16及16/16目标不变。
最终人工仍沿卡第4项验证鼠标/Enter/Space一次动作、长按与AltTab取消；第5项在移动/遮挡/多入口/物理DPI下复核，集中执行。

## P5 原生单次Tab可见选择与移动焦点验证（2026-10-04）
Core在实际Tab/ShiftTab DOWN冻结方向/正数序号/QPC，正式eventSamples模式不从旧边界表立即选定，拥有的Player同UI一次begin/read/end后发私有focus样本，Core按当时可见region中TabIndex顺序与稳定consumer/button/entry选择。多呈现同动作独立循环，空表清焦点；焦点取样不生成Completed/proof，输入期限/OS/安装/声明/修订复核保持。
私有pointer支持Kind=focus/Key9/Reverse，Core不指定作者DOM节点。队列先撤销前一作者对，再单次prepare/complete；不arm作者文档、不转发DOM Tab、不调用动作release。正式DOM的轮廓仅按本地已绘制多边形每RAF刷新，出画布/遮挡隐藏且保留逻辑entry，commit/geometry失效/暂停清空，无逐帧Core IPC。
API编译RED后tab-visible-core-green291/291；必要队列17/17。轮廓停留旧位置实质DOM RED50/52→52/52，源轮廓运动/出画布隐藏、目标轮廓到最终位置与旧DOM回归通过（ERRORS #215）。
tab-visible-moving-official-wire实际ReleasePlayer+生产index/main/dom/native/frame/media/SDK整轮exit0：移动源图标一次私有Tab样本含同动作第二呈现，后续SVG多边形真实随RAF改变，geometry计数/版本与动作计数不增加，前台保持，出画布隐藏且逻辑entry保留，commit后清空；原鼠标、移动键盘、共享文档/暂停/最新修订/撤销通过。该wire的Core Tab物理键/选择包/回复fixture，不代填实际Core OS。
tab-visible-core-build四阶段后常规start Core96444/Player49548/Watchdog78756/config31380，日志20261004_054313.txt。identity共享D配置器OTHER/exit1且精确路径独立核验；常规恢复原v2不计v3物理键。正常退出、watcher25867 exit0，原四文件hash/缺失保持、Dext进程/开发监听/原生author及official临时目录0，Dext保持关闭。
历史单次Tab阶段（910b964）只保留一个未返回的Core焦点gesture；新的raw DOWN会替换它。快速连续Tab和Tab采样待回时立即Enter/Space需继续顺序仲裁，不能据此称完整快速键盘已交付。Core零序号兼容、持续作者动画组合与真实Core OS/DPI/锁屏/还原及最终7项/单次P5审查继续；系统凭据窗未解除，本轮没有重复Core桌面点击。
最终人工沿卡第4项Tab/ShiftTab、鼠标/Enter/Space一次动作、长按/AltTab取消，第5项移动/遮挡/多入口/DPI集中执行；拖动按用户暂缓，无新增网络专项/中途确认/master合并，完整16项就绪1/16=6.25%（约6%），13/16及16/16目标保持。

## P5 连续Tab与早到激活的生产Core/实际Player验证（2026-10-04）
Core保存至多64个未回Tab/ShiftTab原始DOWN请求，SampleFocus只处理FIFO首项，按各自当前可见表逐一推进。紧接Enter/Space冻结原始键/scan/QPC/正数关联，等待此前最后Tab；早到UP只标释放，最终焦点确定后私有RoomNativeKeyDelivery发送一对原序号DOWN/UP。新激活仍覆盖旧激活，不扩展多动作队列；新鼠标/几何/会话取消等待，过期前置Tab取消键，不能使用旧焦点或续签1500ms。焦点请求不创建动作证明。
编译新API的RED后，生产功能实质keys-ordered-core-behavior-red291/295→keys-ordered-core-green295/295：两次未回Tab、Enter/Space早到UP和前置Tab过期均覆盖。原单次Tab、动态样本/source动作等回归保持。新增输入探针首次把Guid SessionId写成string导致CS0029，按真实DTO类型修正后构建成功；这次夹具编译错误不计生产行为RED。
keys-ordered-moving-official-wire实际ReleasePlayer+生产index/main/dom/native/frame/media/SDK，接入生产RoomNativeInputAuthority/RoomNativeKeyDelivery整轮exit0：两个未回ShiftTab的实际样本逐一选source second→first；已记录的Enter UP等待最终焦点再发送原QPC/序号的一对，两份实际可见样本在生产authority中形成SampledVisual，最终entry只产生一次动作，原前台保持。原鼠标、移动键/焦点、切页/共享文档、暂停/最新修订、撤销回归通过。原始OS边沿、完整Core窗口/动作回复仍fixture；不代填实际Core OS/物理DPI。
keys-ordered-core-build四阶段通过后，常规start Core92332/Player98004/Watchdog63388/config74552，日志20261004_060652.txt。identity脚本共享D缓存配置器OTHER/exit1，四精确绝对路径另行核验；常规恢复原v2，不计v3物理键。精确正常关闭、watcher51624 exit0，原四文件SHA256/缺失保持，Dext进程/1420/1421/1621监听/原生author及official与Core GUID临时目录0，Dext保持关闭。
下一段为Core零序号兼容收口与持续作者动画组合；实际Core OS/DPI/锁屏/故障还原及最终七项/单次P5审查继续，系统凭据窗未解除时不重复桌面点击。拖动按用户暂缓，本地功能优先、无新增网络专项/中途验收/master合并。完整16项开发就绪仍1/16=6.25%（约6%），13/16及16/16目标不变。
最终人工第4项增加连续Tab/ShiftTab后立即Enter/Space，确认最终可见焦点只动作一次；长按与AltTab取消。第5项集中验证移动/遮挡/同动作多入口与物理DPI，拖动部分暂缓。

## P5 持续作者动画与本地视觉矩阵验证（2026-10-04）
scene.publishGeometry保留既有API。模型只在按钮矩形/占用区/视口等结构变化递增geometryVersion并撤销输入；仅source/target/shared矩阵或opacity变化返回applyVisualGroups，Player本地一次绘制Widget/图标/焦点，不清焦点、不重发Core几何。真实原生事件继续读取当前已绘制可见区域，不用旧边界位置命中。保持native sample时只排最新矩阵，匹配end后应用；结构/快照/暂停/销毁取消旧保持。普通图标在无转场的已提交Desk也使用source组，可与共享仪表盘分别控制。
实质author-visual-dom-red67/70（三个持续视觉/保持功能失败）；实现后旧边界位置断言改读实际样本，失效夹具改为生命周期变化而非同状态空修订，GREEN含SDK86/86。当前图标误跟shared的新增独立RED后，必要模型/DOM/SDK87/87。这些为本地功能检查，无新增网络专项。
rooms/v3-continuous升级为共享仪表盘组件+持续scene控制器：仪表盘逻辑1600×280、底部展开到整页返回不重建，普通图标按Desk组参与作者运动；作者等待一次publish完成再下一RAF，queue修订不重播动画，完成只回告Core。初次资源一致性检查发现样包SDK副本陈旧，已复制当前生产版本；正式v3 Schema/全部resources/SDK字节一致均通过。
author-visual-continuous-wire-final实际ReleasePlayer/生产宿主及SDK整轮exit0：1920×1080设计基准同一仪表盘document ID/内部1600×280视口bottom→full→bottom、两次作者完成回告、Core fixture提交；实际ordinary icon矩形与仪表盘位置变化，current native样本含共享按钮，SVG焦点持续运动，几何计数/版本不因视觉帧增加、动作0、读数存在、前台保持。Core包/动作回执/raw OS键仍fixture，不计实际Core OS输入。
首轮author-visual-continuous-wire在640×480/scale1.5因既定CSS像素保留和临时布局移位，使基准矩阵叠加后仪表盘出画布；该失败保留。490fcbb阶段当时实机仅证明设计基准，随后小窗口有效布局组合见下节；多物理DPI仍须继续，不将修改验证窗口写成响应式已通过。
author-visual-default-regression实际ReleasePlayer整轮exit0：静止/移动鼠标、动态键样本、原生Tab/移动焦点、生产Core类连续ShiftTab早到Enter、切页/共享文档/暂停/最新修订/撤销保持通过。
author-visual-core-build四阶段后，常规start Core96152/Player95220/Watchdog70036/config58572，日志20261004_063733.txt；identity共享D配置器OTHER/exit1，四精确路径另核。正常关闭、watcher3287 exit0，原四文件SHA256/缺失保持，Dext进程/开发监听/author、official、Core和author-visual GUID目录0。常规恢复原v2，不计v3物理输入，Dext保持关闭。
后续本地功能继续Core零序号兼容与作者矩阵/小窗口有效布局组合；实际Core OS/物理DPI/锁屏/故障还原仍待补，系统凭据宿主未解除时不重复桌面点击。最终第2项仪表盘跨页实例，第4项连续Tab与键一次动作，第5项移动/遮挡/多入口/DPI集中执行，拖动暂缓。完整16项开发就绪仍1/16=6.25%（约6%），13/16与16/16目标、最终七项与单次P5审查保持，未合并master。


## P5 作者矩阵与小窗口有效布局（2026-10-04）
生产SDK session与scene.subscribeGeometry增加只读placements；Scene读当前可见组件的组矩阵前有效设计矩形，其他消费者仅读自身，无saved布局、私人绑定或OS输入字段。null无法放置，未呈现不提供；同版本有效变化按geometry频道序号发布，重复值和纯视觉帧不通知，内部逻辑视口保持。
三个功能实质RED后必要模型/DOM/Frame/SDK108/108，类型/语法通过。样包仪表盘逻辑1600×540，根据有效矩形映射到期望底部1920×280/整页1920×1080；async publish期间记录dirty，geometry/resize不能丢下一次绘制。Schema/resources/current SDK字节一致通过。
effective-layout-author-wire-final实际ReleasePlayer/生产宿主与SDK整轮exit0：640×480/scale1.5的CSS小视口底部→整页→底部、1920×1080放大→缩回，真实DOM矩形满宽/期望高度、同一instrument document/1600×540逻辑视口、有效布局返回原值、读数与前台保持；运动焦点/当前可见样本、结构版本与零逐帧Core几何/动作仍通过。Core包/回复/raw OS键为fixture，不计实际Core OS或多物理DPI。第一轮探针在组件挂载前读getBoundingClientRect导致自身轮询中断，保留effective-layout-author-wire失败日志，修正等待节点后通过，未降低位置验收。
effective-layout-default-regression实际Player原输入整轮exit0：静止/移动鼠标、动态键、单次Tab/移动焦点、生产Core连续ShiftTab+早到Enter、Core提交/共享文档/暂停/撤销保持通过。无新增网络专项。
effective-layout-core-build完整四阶段后常规start Core45276/Player113480/Watchdog70200/config114976、日志20261004_070019.txt；identity共享D配置器OTHER/exit1，四精确路径独立核验。正常关闭、watcher96341 exit0、原四文件SHA256/缺失保持、Dext进程/开发监听/author、official、Core及author-visual GUID目录0，Dext保持关闭。常规恢复原v2，不计v3物理输入。
接续Core零序号兼容与最终功能组合。系统凭据窗未解除时不重复桌面点击；实际Core OS/物理DPI/锁屏/故障还原及最终七项/单次P5审查待补。最终人工第2项：在v3-continuous底部→整页→底部切页，并缩小/恢复窗口，确认仪表盘实例标识/逻辑尺寸不变、面板满宽且返回底部；第4/5项连续键与移动/DPI集中执行。拖动暂缓，16项开发就绪仍1/16≈6%，13/16和16/16目标保持，不中途验收或合并master。

- 最终证据补记：探针显式断言实际large CSS width>1000及small<500，避免等待deadline后旧窗口矩形被误报缩放通过；重新编译隔离探针及effective-layout-author-wire-final整轮exit0，产品代码不再改变。


## P5 原生动作精确正数关联收口（2026-10-04）
Core GetProof与ActivateNative/NavigateNative/ControlNativeAsync要求显式原始输入序号，零值不再代表最近完成。Player私有activate/navigate/mediaControl/audioControl只接受正数；作者公开SDK的原始request和authorInput仍无序号，由已有native见证/请求汇合补齐。无输入失败回复0继续表示未关联/未消费，不能用它请求动作。
四个必要功能实质RED295/299：零lookup、启动、导航与系统控制仍取当前完成；移除旧回退、迁移旧fixture调用后299/299。原有正数错误消费者/几何由旧零值InputRequired改为StaleInput，仍拒绝且不消费；零本身为InputRequired。消息实质RED71/72，旧合法packet改正数、旧零值接受断言改拒绝后72/72。未扩大网络或攻击矩阵。
positive-input-official-wire-final在本轮完整构建部署后实际ReleasePlayer/生产正式宿主整轮exit0：静止/移动源鼠标、动态键、Tab/随帧焦点、生产Core authority/key delivery两个未回ShiftTab+早到Enter、原始正数/QPC/最终entry与一次动作，切页/共享文档/暂停/撤销保持。原始OS边沿/完整Core窗口/动作回复fixture，真实Core OS门槛不代填。
完整positive-input-core-build四阶段；常规start Core73636/Player39996/Watchdog40208/config96192、日志20261004_071614.txt。identity共享D配置器OTHER/exit1，四精确路径另核；正常关闭、watcher94664 exit0、原四文件SHA256/缺失保持、Dext进程/开发监听/author、official、Core与author-visual GUID临时目录0，Dext保持关闭。
P5剩余实际Core OS/物理DPI/锁屏/故障还原与最终七项/单次P5审查保留，系统凭据宿主未解除时不重复桌面点击。接续V3-P6-001原生Room创建与节点保存，先实际创建/保存重开/撤销重做/应用产品闭环，不扩展网络专项。最终人工第4项连续Tab后Enter/Space与鼠标只动作一次、长按/AltTab取消，第2/5项跨页缩放与实际DPI集中执行；拖动暂缓，全16项就绪仍1/16≈6%，13/16及16/16目标保持，未合并master。

## P6配置器创建与节点保存基础（2026-10-04，BASE99dd8fe）
独立v3-configurator-create worktree/feat/V3-P6-001-configurator-create，以未合并P5为依赖。新建Room默认两Desk/稳定UUID与Desk ID；v3独立编辑组件保留作者字段，官方导航/待绑定图标分开稳定呈现ID/按钮ID，名称/顺序/起点和Dock组件引用进入原生清单，撤销重做与基于磁盘基线的本机草稿恢复分离。导入资源清单在撤销背景后仍保留，保存不产生孤儿文件。
生产Rust作者模块共享正式v3校验和资源读取，创建、复制图片/视频/GIF、整目录本地HTML依赖、原子保存重开与正式安装通过。资源缺失或尝试变更副本UUID拒绝，原文不变。保存/应用沿正式Tauri命令接线。旧连续样包重复icon id改detail-view，正式样包检查恢复。
功能RED为文档3项、v3操作矩阵1项、删除共享按钮引用1项及Rust作者3项；最终Vitest66/66、生产Rust契约+作者34/34、npm build及cargo check通过。p6-ui-browser-final实际headless浏览器整轮新建/节点改名/排序/起点/默认图标/撤销重做/草稿重开及深浅截图通过；文件/Core为mock，不作为真实Tauri证据。Rust媒体字节仅文件夹具，不当作实际解码。
接续Task3：真实Tauri新建/四媒体导入/保存重开→实际Core/Player应用、active_room原生状态来源、实际播放/切页/重启恢复及库操作支持边界。Dext本段未启动；测试仅拥有的临时文件，浏览器/开发Vite正常关闭。一次最终审查与本包5项/P5七项人工门槛保持；拖动暂缓，无新增网络专项。完整16项开发就绪仍1/16≈6%，未合并master。

## P6真实配置器与原生应用闭环（2026-10-04，BASE2ba11e5）
host私有source.v3.json保存规范绝对源路径和完整安装快照；来源不注入作者清单。active_room识别原生v3时要求活跃Core会话/有效Player及与当前安装完全相同的来源记录。原生库改名更新作者name，保持UUID/节点/资源，命令返回显示路径，避免Windows扩展前缀使配置器选错Room。复制入口按saveAs能力禁用，后续分享包接通。

实际配置器Room0fbf8cd6-1d2b-46c3-915c-0137242255fe从默认两Desk创建，导入四类可解码媒体及HTML目录CSS/JS，添加同Dock引用四Desk；生产Rust作者/安装/Core/ReleasePlayer贯通。prompt/文件选择是本地输入夹具，不覆盖生产Tauri invoke、作者文件、RPC或Core/Player，也不当作系统选择框物理验收。首次应用仅SetWallpaper排队回执，Core inactive、Player导航OperationCanceled；路径含../..，与原生资源服务器规范化后的主机哈希不同。改为规范绝对宿主路径；apply_room最多等待25s，确认当前Room新session/Player及稳定安装后才记录来源和返回成功。最后同安装重复应用明确新session/Player、同安装戳通过。

p6-media-native-live通过：由实际配置器逐Desk设起点重应用，真实Player图片/GIF自然尺寸非零，视频ready/实际尺寸/无错误/播放时间变化，HTML背景与Dock有正确CSS色值及持续JS计数。只读官方title观察器和自有HTML观测代码是证据夹具，没有注入会话/授权/输入，之后恢复main.js原字节并移除自有素材。此证据不替代桌面切页手势或GIF多帧物理观察。

实际UTF-8库改名后立即打开正确Room，身份/四Desk/Dock/资源和应用来源保持；实际撤销重做、缺资源保存失败的清楚反馈/未保存状态及原清单字节不变通过。普通Core退出再启动，同安装戳和Room/current Desk/源路径，新Player/session，HTML/Dock重新运行；本轮Desk恰为配置起点，非起点checkpoint恢复仍沿最终步骤核对。

必要自测为生产Rust36/36（两个来源/改名功能RED→GREEN）、Vitest66/66、两个具名v2库改名/Windows显示路径回归、npm build、cargo check；此前完整build.ps1四阶段通过。最后start watcher78843/75916 exit0；Core45588/config58764/Player34052精确路径核验，配置器先正常关、Core普通退出，原四文件SHA256/缺失和原localStorage精确恢复，Dext进程/监听/自有GUID/安装前代副本/观察器0。第一轮Core先关导致配置器窗口关闭但驻留，所有权核对后停止，未称该轮正常退出；最终两轮均正常退出。

最终本包五项/P5七项及一次整体审查保持；默认导航/动画同步、非起点重启、系统选择框和物理输入/DPI待集中，凭据宿主未解除时不做桌面点击。无新增网络专项，拖动暂缓，按连续授权接续独立P6-002；完整16项仍1/16≈6%，不合并。主要证据在本线程evidence目录：p6-canonical-live、media-native-live/actual-media、save-failure-live、restart-live/actual-restart、final-product-live/native-final-evidence、final-restore。

## P6 Dock模板与字段差异基础（2026-10-04，BASE6d15d1b）
独立v3-dock-template / feat/V3-P6-002-dock-template，承接未合并P6-001。原生目录/导入/检查命令嵌入两款自包含模板描述/HTML/CSS/JS和当前SDK，导入完整资源不改源清单，真实本地保存/重读/安装通过。config保存公开模板描述、参数、启用语义区域、数据选择及稳定按钮映射；所有四个已开放只读源均可选。Desk只写递归差异，null显式/数组替换，逐字段重置恢复共享；动作相同恢复共享按钮。替换保留共区ID，删除仍有其他引用的按钮保留，重建用新ID，不动个人目标。
生产配置器代码接外观→共享交互→Desk引用/差异，默认导航/待绑定/退出及目标Desk、删除区域、历史/草稿重开。UI先RED后浏览器功能夹具通过。作者HTML按真实DOM/resize报自己的按钮，缺数据/格式错误保外框隐藏读数；作者数据/动作明确为夹具。正式Dock不允许occupied，官方宿主按当前Desk引用的placement为普通图标/Widget避让；不引用时恢复保存位置，旧精确遮挡门槛用作者矩阵移动Dock覆盖继续验证。字体junction本地403修正，编辑资源零失败。
必要检查：模型/原文档10/10，生产Rust作者5/5+Dock3/3，两款作者HTML夹具1/1、编辑浏览器夹具，DOM57/57，npm build/cargo check通过。未运行额外网络专项。日志p6-dock-frontend-final、native-files、browser-host/browser-final、tauri-check；UI/两款作者截图均在本线程evidence目录。本段不启动Dext，不改用户数据；浏览器Vite结束退出。
接续Task3当前Core只读授权状态/允许/撤销，再Task4真实Tauri保存重开、Core/ReleasePlayer实际数据/按钮几何/普通重启和原状态保护。最终本包六项/P5七项与一次整体审查保持，凭据宿主未解除时不做Core OS桌面输入；拖动暂缓，完整16项仍1/16≈6%，不合并master。

## P6 Dock只读授权与生产模板集成（2026-10-04，BASE27e9f2a）
当前分支feat/V3-P6-002-dock-template。Core个人readGrants独立保存四种只读权限，保留原grants控制/绑定授权和私人目标/按钮/布局/KV；旧format1缺字段默认空，旧当前grants许可兼容。当前Coordinator内部上下文与原子存储接生产RPC、两份proto、Tauri命令和独立React本机授权面板。四项明确允许/撤销、失败确认值保持、旧安装清空/重读，不修改作者文档/草稿/历史。
限定Core功能RED0/6→6/6，含实际生产time provider和失败原字节、旧安装不提升、暂停可编辑/作者仍不可读、无关状态保持/无变化不发布；UI运输夹具RED缺控件→GREEN，原Dock编辑夹具通过。npm build/cargo check、完整四阶段build.ps1→start.ps1通过。没有增加网络/安全专项或重跑完整攻击矩阵。
实际Room748940f7-db74-436f-ab08-27c050954200经真实Tauri创建、三栏导入/完整资源/共享与Desk稀疏差异/保存重开/应用，真实Core当前授权读回/独立time与hardware允许及time撤销通过；作者清单字节和已保存状态保持。实际正式ReleasePlayer/SDK六区静态框和按钮几何accepted；当前Core operable=false，三栏数据denied且隐藏，所以真实读数仍未计通过。CDP仅只读观察真实帧，没有注入会话/授权或OS输入。
普通Core退出/启动保持Room、当前Desk、安装戳与读权限，新session/Player重新初始化模板/SDK/几何。实际替换导航模板保留组件/共有按钮ID和旧资源；新安装四项读许可false，明确允许time不使hardware变true，作者字节保持。两模板生产呈现与几何已核对，物理切页/同实例/缩放继续集中。
原localStorage逐键精确恢复，配置器按owned PID/绝对路径正常OS关窗，再Core app --shutdown true普通退出；start watcher39064 exit0。原四文件字节/缺失精确恢复、自己Temp及同Room安装/前代/source记录删除，Dext进程/1620/1621/9226/9227监听0；最终只读恢复核对exit0。默认JS close/minimize未获权限，未为测试开放；日志末行重定向工具失败不重做已完成删除，以只读证据收口。
证据：p6-read-grants-core-final/ui/build/tauri-check、dock-native-live/grants-native/native-evidence、dock-before/after-restart、dock-new-install、dock-runtime-start/restored和actual configurator/Player截图。本包六项/P5七项/最终一次审查和集中确认保持；不重复凭据宿主覆盖的Core OS输入、不扩展网络专项，拖动暂缓，完整16项就绪仍1/16≈6%，13/16及16/16目标不变，未合并master。按连续授权下一项接P6-003统一按钮与个人呈现编辑。

## P6 统一按钮与本机呈现基础（2026-10-04，BASE6c32e66）
独立v3-personal-editor / feat/V3-P6-003-personal-editor。Core当前Coordinator读取全按钮并原子编辑动作/全局目标/皮肤；跨Room目标删除引用、恢复作者默认不删目标，作者公开投影不变。限定Core0/7→7/7，官方投影/定位7/9→9/9，只读授权必要6/6，无新增网络专项。
统一按钮/来源/未绑定、动作/目标库/应用库/皮肤与普通呈现UI已接。新iconId复用buttonId，删呈现不删按钮；模型3项RED→GREEN，连原文档6/6。npm build/cargo check/Core四阶段build→start通过。
真实自有Room a4f2e314-53a0-4673-9b91-5cb4dc8b6fa2，两Desk/作者按钮/两普通呈现：Tauri目标创建/绑定、同buttonId本机设置、增呈现/撤销重做/保存应用、发现未绑定和其他Desk。作者文件无私人目标ID/路径/皮肤；ReleasePlayer正式SDK几何accepted，两图标glass→outline，作者iframe保留。未发送物理动作；Core operable=false不能计真实程序启动成功。
初始ActiveRoom snake_case使面板不可用，按实际camelCase sourcePath修正/重新打开后通过。真实定位accepted但visible=false，发现视觉提示误用动作operable条件；补本地功能RED→GREEN，动作采样仍为空。最后修复后的实际定位/普通重启、Desk改名排序、目标删改重置与呈现删除UI继续。
用户将全屏游戏，立即正常关配置器再Core普通退出，watcher30520 exit0；原localStorage/四文件字节/缺失恢复，自有Temp/安装前代/source记录清理，Dext和1620/1621/9226/9227监听0。游戏期间不启动、编译或做桌面输入；最后前端字段/视觉定位收尾待下一轮打包/实际核对。集中本卡六项/P5物理门槛/一次整体审查保留，完整16项仍1/16≈6%，不合并master。证据p6-personal-*在本线程evidence。

### P6-003 游戏期间轻量选择保持（2026-10-04，BASE e495615）
修复目标库保存/定位回执丢弃待保存动作、Desk和皮肤；闭合操作回执更新选择，成功目标删除仅清对应引用，显式按钮保存失败恢复原确认值。列表用Core当前有效动作识别本机导航与缺目标启动。生产TS由本机Node直接执行，0/3→3/3及3/4→4/4，最终约0.25秒；未启动界面/编译器/应用，不触及用户状态。最后完整打包、实际UI/定位/普通重启仍在游戏后补证，本卡六项集中，完整16项仍1/16≈6%，不合并。

P6-003轻量目标删除收尾（2026-10-04）：Core确认同ID目标删除后关闭旧编辑表单，防随后保存意外重建；失败保内容/重试ID。生产TS直接Node5/6→6/6约0.14秒，未启动编译器/应用/窗口。实际第5项UI/打包/重启留待用户游戏结束，整体仍1/16≈6%，不合并master。

P6-003轻量呈现数量收尾（2026-10-04）：模型/两UI共用正式512图标及1024新按钮上限，满额有提示且原作品保持，现有按钮复用不占新声明。直接Node6/8→8/8约0.16秒，未编译/窗口/应用；实际第3项和重启游戏后，完整16项仍1/16≈6%。

2026-10-04用户要求少验证优先推进：P6-003保留待集成验收，直接接P7试验台编码，不反复拓展边界检查。P7资源会话→正式模拟宿主→多尺寸/区域诊断→一次构建与冒烟；游戏期间只代码/轻量记录。完整V3范围/最终门槛保持，实施步骤与交付就绪比例分别报告。

P7首轮功能编码（2026-10-04）：Task1资源会话、Task2正式渲染/SDK模拟适配、Task3工作台UI已写入，3/4编码步骤=75%；不是已验证完成率。仅JS语法/diff核对，无构建、窗口或专项矩阵。完整就绪仍1/16≈6%。用户要求少验证优先推进后，非阻塞实机验收集中，不再为旧包重复打磨阻塞新功能编码。

P7创作操作代码补齐：组件共享默认布局编辑→作者草稿/原历史，来源源码有界只读查看，任意JSON示例与重置。预览设置不进作品、公开布局需明确应用并保存。首轮仍3/4编码步骤=75%，必要构建/一次真实冒烟未做；没有扩大验证，全范围及完整就绪1/16≈6%保持。

### P2b 顶层 Dock 原型编码（2026-10-04）
独立feat/V3-P2B-001-top-dock从7a1f31b继续；ReleasePlayer显式原型入口、底部/DPI尺寸宿主、正常非激活鼠标/明确键盘焦点、AppBar协商/注销、触边与全屏抑制、Explorer恢复及本地交互/窗口/工作区诊断已编码，3/4=75%。只有JS语法/PS解析，游戏期间未编译或启动；Windows/透明外观/正常及异常恢复没有证据，P8正式Core/SDK/统一偏好、Windows任务栏替代恢复仍完整待做。严格就绪1/16≈6%，不合并。

### P8 自动隐藏 Task1 编码（2026-10-04）
feat/V3-P8-001-dock-autohide从2afcfd5继续。Core全局Dock偏好独立原子保存、当前安装/正式dockComponentId和Desk资格→双proto/RPC/Tauri→设置页已编码，1/5=20%。偏好启用与宿主运行分开，当前宿主未接入明确不可运行/PID0；常驻模式不冒称支持。Core单实例Player、正式SDK/真实输入、原任务栏替代/异常恢复及必要构建仍在Task2-5完整范围，不因低占用约束缩水。游戏期间未构建/启动，完整就绪1/16≈6%，不合并。

## P8 Task2 独立 Dock Player 编码（2026-10-04）
Core创建单个Dock进程，当前主Player/安装摘要的独立Dock身份，共用原内核上下文/快照；偏好与Desk变化、安装替换和退出协调，关闭旧进程后才重建，有界启动与故障退避。runtime显式desktop/dock，正式Dock视图/真实输入尚待Task3，因此Player保持隐藏、连接状态显示初始化，自动隐藏/任务栏替代可用性仍false。当前包编码2/5=40%，非全路线完成率；条目12实际宿主/任务栏恢复证据仍不足。游戏期间没有构建、应用/窗口或桌面输入，最终六项验收保留。

## P8 Task3 正式Dock视图与原生窗口部分（2026-10-05）
共享Core会话的独立Dock视图已编码：仅呈现正式dockComponentId及当前Desk配置，复用作者SDK、发现/绑定与有效按钮几何，作者逻辑画布保持；原生窗口与私有状态/策略、可见性同步、媒体暂停和可见时只读数据接线已编码。正式输入策略仍关闭，因此状态awaitingInput、窗口隐藏，不计实际宿主可用。实际OS鼠标/受控键盘/桌面暂停时导航继续Task3，任务栏替代恢复继续Task4。当前包编码约50%，非全路线交付比例；条目12实际Windows运行证据仍不足。五份JS语法、Player csproj XML及差异检查通过，未编译/启动/桌面输入；游戏后六项集中验收保持，未合并。

## P8 Task3 OS输入/受控键盘/暂停切页编码（2026-10-05）
Core复用现有RawInput，独立Dock窗口的实际命中、可见性、全屏/锁屏与显式键盘会话决定准入；鼠标不再依赖桌面前台，受控Tab/Enter/Space与Esc恢复接线。预装Dock门控阻止未准备/重复的自然与转发边沿，一次click预算，既有物理采样与SDK动作消费保持。外围键不清闲置Dock几何，触边刷新避开未完成动作。可信Dock切页在桌面暂停/非前台时同kernel先写checkpoint再直接更新Desk，不伪造桌面可操作事实或等待暂停动画。当前包编码3/5=60%，Task4任务栏替代/看护待；Task3此前输入策略关闭状态已由本轮接线取代。只检查guardian JS语法与具名差异，未编译或实际运行；条目12原生Windows证据仍不足，六项游戏后集中验收保持。

## P8 Task4 独立任务栏恢复编码（2026-10-05）
Watchdog新增独立Dock模式，不混入壁纸清理名单；Core/Dock PID+启动时刻、lease/mutex与心跳确定所有权。主任务栏原自动隐藏/可见状态及Explorer身份先原子落盘，再变更Shell状态并读取实际状态确认。独立看护关闭故障后的精确自有Dock并恢复，Core监督及落盘记录支持看护/Explorer/下次启动恢复；无Dock/禁用/退出先恢复，失败保留记录。全屏恢复不强行显示任务栏到游戏上，Player UI恢复有宽限；健康心跳不反复读安装/Room。配置器区分窗口可用和任务栏替代确认。Windows接口依据：[ABM_GETSTATE](https://learn.microsoft.com/en-us/windows/win32/shell/abm-getstate)、[ABM_SETSTATE](https://learn.microsoft.com/en-us/windows/win32/shell/abm-setstate)。当前包编码4/5=80%；仅csproj XML/源包含及diff核对，未构建/启动/系统变更。条目12实际原生证据仍不足，六项游戏后人工验收与整体审查保留，不合并。

P8高度反馈/离线样包（2026-10-05）：有效输入窗口测量决定就绪及任务栏替代资格，配置器显示实际高度DIP/DPI/受限状态，不改已保存偏好。完整native-dock源包复用正式三栏模板/SDK，覆盖共享、Desk差异及无Dock返回路径，不预制安装身份或私人目标。当前包仍编码4/5=80%，游戏期间仅源码/静态资源核对，构建和Windows证据待Task5；完整V3范围保持。
## P8 常驻占位首轮编码（2026-10-05，BASE9cf1664）
独立feat/V3-P8-002-dock-reserve / v3-dock-reserve。统一reserve偏好→Core需求模式比较→正式Player参数；切模式/高度先停止旧Dock，不并发开第二实例。复用P2b AppBar/回调/DPI/Explorer与P8共享SDK/输入/看护；不可呈现时注销占位，恢复重新协商，全屏隐藏保留原注册策略。Player真实矩形/工作区确认加Core有效窗口/GetMonitorInfo复核，未确认不替代任务栏；配置器区分保存偏好和实际占位，可从自动隐藏直接选择常驻。编码3/4=75%，仅源接线/项目XML及差异核对，C#/Rust/TS构建和六项Windows验收仍待游戏后。完整V3范围保持，下一项另存与分享，最终验收前不合并。
### P10 Task2/3 编码收尾（2026-10-05）
当前包编码3/4=75%。Core双proto/RPC新增个人复制和删除，沿用正式个人存储规则：仅复制绑定/皮肤，不复制授权/KV/个人布局，删除保留全局目标；活动Room需先停用。Tauri另存使用编辑器当前草稿，完整声明资源在暂存区生成新UUID，Core复制确认后发布；库复制、原生导出导入沿既有入口接线。
复制RPC结果不明或发布回滚未确认时保留明确恢复记录；Core串行生命周期与删除标记阻止迟到复制重新生成已清理数据。删除先确认Core可清理，再记录意图并移入回收站；记录租约避免恢复清理抢先执行。中断记录留在库根、不进入作者包；配置器连接Core后重试，源Room已恢复时取消清理，清理未确认有明确提示。
本轮仅源代码接线与git差异检查，现有政策测试期望更新但未运行；没有C#/Rust/TS编译、窗口、桌面输入或新网络专项。Task4完整构建、一次全链本地冒烟和本卡六项人工步骤/整体审查仍未完成，不合并master。断电/跨进程时序与实际回收站行为保留最终门槛，不声称Windows已验证。
P10-002编码3/4=75%（2026-10-05）：API1基线冻结既有格式/API/协议/安装与个人版本、能力/动作/媒体/转场/组件词汇；六套完整作者目录及原zip、catalog摘要保留。小视频/GIF以单线程生成约11KiB，样包本轮只准备，不冒称通过Player。
正式Rust校验前区分版本/能力等要求，未来zip分派在发布前拒绝；共用版本函数阻止未来作品进入v2写入/应用。Core独立拒绝未知格式/能力等。库列表携带兼容原因并禁用编辑/应用/复制/分享，原始清单只读对话框不进入规范化草稿；已运行Room仍可停止。清单改动后打开再次核对，不依赖旧卡片结果。
只读冻结摘要六套通过，git差异核对；仅增一个政策回归用例、未执行。C#/Rust/TS构建及一次真实全链/六项人工升级验收仍待游戏后，不合并master。没有新增网络矩阵。下一项恢复与发布收口。
P10-003编码4/5=80%（2026-10-05，源码）：新暂存记录Windows目录身份和预期摘要，维护页有界分页/只读元数据。退出Core后选择完整旧代恢复，当前原件保留quarantine；逐句柄清理核对所有剩余字节后才删除，中断有身份记录重试。未认证/不匹配保持；孤立记录可清理，不做路径递归删除或自动重铺。
v3-release Cargo/MSBuild配置限定官方原生宿主/WebView2，旧入口从发布工厂分派移除、旧Plugin/Bundle内容不发布；Core错误有真实RPC拒绝。原生宿主/活动识别/许可文档路径按产品目录解析，v3配置器要求匹配Dext v3元数据。build-v3-release脚本新目录部署自包含Core、ReleasePlayer/看护和配置器，按精确资产清单/许可/实际文件摘要收口，不覆盖旧包、不启动应用。
实际成功操作的64项有界计时进入既有诊断，Core切页采用单调钟并在gateway回调锁外异步写日志；资源脚本只读产品路径所属进程的CPU/内存/逐GPU引擎和本轮内核事件。首样本/缺事件/不支持计数均缺失，不填0或假定阈值；会话确认与内核到达不冒充屏幕首帧，渲染帧/普通重启checkpoint恢复及数值仍在Task5。
本轮仅脚本AST、项目XML和具名差异核对；没有C#/Rust/TS构建、应用/窗口/桌面输入、系统改变、性能采样或新网络矩阵。Win32接口查微软原文核对ABI，不是网络测试。Task5完整Release/一次四媒体与Dock全链/兼容样包/性能数据和六项集中验收/整体审查未完成，不合并或发布；完整16项仍以实际证据为准。

2026-10-08 集成现况（补充上方历史阶段记录）：完整Core/Player/Watchdog与配置器v3 Release已构建、实际连接和重新应用通过；用户确认b73c1ae点击响应修复通过。新增rooms/v3-orbit-lab星轨实验HTML Room，13项资源/清单经正式安装器验证，独立1920×1080预览通过；覆盖持续场景/共享Widget/三Desk配置差异/统一按钮及真实数据和生命周期的验收素材已交付。浏览器外观与局部点击通过不替代16项全验收；用户KV授权入口仍待收口，拖动按用户暂缓，集成仍2/4=50%。人工步骤见V3_ORBIT_LAB及INTEGRATION验收卡。

## 2026-10-09 halfV3阶段合入记录
用户明确回复“合并到主线吧 名字叫halfV3”，授权当前集成成果及其堆叠依赖合入master；合并提交与本地标记均命名halfV3。本次不补填尚未执行的完整人工步骤：Task3/4和完整16项保持未完成，进度2/4=50%。最近代码f395e67，五项只读数据回归通过、Release构建和实际重新应用通过；没有把媒体源可用当成具体B站标题验收。后续按ROADMAP集中验收续项恢复。
