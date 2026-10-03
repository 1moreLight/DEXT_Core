# v3 连续交付与最终验收台账

> 2026-10-02：用户授权目标模式持续推进 v3 完整路线，至少达到计划 80%，尽量一次完成，再集中人工验收。此授权允许顺序执行后续工作包；各包仍有独立分支、worktree、验收卡和提交，最终确认前不合并 master。
> 需求依据：V3_PLAN §1–§7、PROJECT 已确认决策。执行入口仍为 ROADMAP；本表是证据台账，不替换产品要求。

## 完成口径

从 V3_PLAN §6.2 取出 16 项基础版交付，游戏的两项属于 F1 后续，不计入基础版。每项保留全部原要求；代码存在、演示原型、v2 同名功能均不能单独证明 v3 交付。开发就绪需自动验证与对应真实宿主证据，最终用户验收单独记录。13/16 约为 81%，持续目标为 16/16；此计数表达要求覆盖率，不是工时百分比。

| # | 原计划交付 | 当前证据与不足 | 开发就绪 |
|---|---|---|---|
| 1 | 契约与安装快照 | P3-001原生清单/摘要安装与Core复核、审查竞态修正；P5已证真实Rust安装→Core/Player切页；同安装副本Core重启已验证，正式配置器创建/应用待集成 | 否 |
| 2 | Room/Desk 状态服务 | V3-CORE-001～005；协议30/30、真实切页/重启恢复，2026-09-30 验收合入 | 是 |
| 3 | 本机绑定与授权服务 | Core私有绑定/授权、消费者KV与作者SDK导航/媒体/音量/可信退出已验证；RawInput静止精确命中、DOWN正数关联254/254；Core/Player鼠标/作者Enter/Space与SDK正数汇合基础通过；source动作/移动采样、个人编辑UI待贯通 | 否 |
| 4 | 持续桌面 Player | P5正式持续DOM与实际Core切页保持同Player/两份SDK文档；完整连续仪表盘/输入/异常恢复待完成 | 否 |
| 5 | 启动、待机与暂停生命周期 | 实际Core四媒体start/idle/暂停/wake与GIF视觉冻结、同安装Core重启/独立Player故障重建及WebAudio已验证；真实Windows锁屏、DPI与最终组合门槛保留 | 否 |
| 6 | 布局与输入同步 | 个人布局Core/私有IPC/DOM读取与saved/effective呈现、静止凸区域/遮挡/多图标/焦点已验证；移动事件取样/实际DPI继续，桌面拖动按用户暂缓 | 否 |
| 7 | 简单 Room 创建与节点保存 | v2编辑器存在；v3正式格式、稳定ID、四类内容和端到端待做 | 否 |
| 8 | Dock 模板与交互编辑 | v2固定参数；v3模板声明/共享值/逐字段连线差异待做 | 否 |
| 9 | 统一按钮与个人呈现编辑 | v3按钮列表、定位、个人绑定/皮肤覆盖待做 | 否 |
| 10 | 试验台与作者诊断 | v2预览可复用；v3生产协议、多尺寸、拒绝/缺数据/占用定位待做 | 否 |
| 11 | 本地 HTML 安全 | v2沙箱基础可复用；v3资源快照、作者API、外部导航/代码/原生消息/权限逃逸待验证 | 否 |
| 12 | 顶层 Dock 自动隐藏 | P2b和生产窗口均待做，含焦点/普通软件/游戏/退出恢复 | 否 |
| 13 | 顶层 Dock 常驻占位 | AppBar/工作区、原任务栏隐藏恢复、DPI/Explorer/异常退出待做 | 否 |
| 14 | 另存与分享 | v2zip可复用；v3独立副本、个人覆盖复制、导出脱敏待做 | 否 |
| 15 | 发布后 Room 兼容门槛 | 首发固定样包与升级兼容回归、转换原件保留待做 | 否 |
| 16 | 恢复与发布收口 | v3全链与四类内容、Release运行、无用入口/资产、性能基线待做 | 否 |

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
