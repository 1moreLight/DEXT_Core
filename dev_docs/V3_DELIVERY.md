# v3 连续交付与最终验收台账

> 2026-10-02：用户授权目标模式持续推进 v3 完整路线，至少达到计划 80%，尽量一次完成，再集中人工验收。此授权允许顺序执行后续工作包；各包仍有独立分支、worktree、验收卡和提交，最终确认前不合并 master。
> 需求依据：V3_PLAN §1–§7、PROJECT 已确认决策。执行入口仍为 ROADMAP；本表是证据台账，不替换产品要求。

## 完成口径

从 V3_PLAN §6.2 取出 16 项基础版交付，游戏的两项属于 F1 后续，不计入基础版。每项保留全部原要求；代码存在、演示原型、v2 同名功能均不能单独证明 v3 交付。开发就绪需自动验证与对应真实宿主证据，最终用户验收单独记录。13/16 约为 81%，持续目标为 16/16；此计数表达要求覆盖率，不是工时百分比。

| # | 原计划交付 | 当前证据与不足 | 开发就绪 |
|---|---|---|---|
| 1 | 契约与安装快照 | P3-001原生清单/摘要安装与Core复核、审查竞态修正；P5已证真实Rust安装→Core/Player切页；同安装副本Core重启已验证，正式配置器创建/应用待集成 | 否 |
| 2 | Room/Desk 状态服务 | V3-CORE-001～005；协议30/30、真实切页/重启恢复，2026-09-30 验收合入 | 是 |
| 3 | 本机绑定与授权服务 | Core私有存储、已验证消费者目录、原子动作准备与票据35/35；真实Explorer参数传递、完整构建/启动通过；RawInput适配器、作者SDK和个人编辑UI待贯通 | 否 |
| 4 | 持续桌面 Player | P5正式持续DOM与实际Core切页保持同Player/两份SDK文档；完整连续仪表盘/输入/异常恢复待完成 | 否 |
| 5 | 启动、待机与暂停生命周期 | P5原生暂停桥/逐iframe音视频基础、实际Core GIF启动与视频解码；同安装副本Core正常重启及WebAudio原生基础已验证；完整idle/锁屏组合及Player故障重建待完成 | 否 |
| 6 | 布局与输入同步 | 原型占用区和旧输入回归；响应式/DPI/动画版本/无空位待验证 | 否 |
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
