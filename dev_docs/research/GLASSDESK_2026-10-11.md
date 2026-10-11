# GlassDesk 发布记录借鉴调查（2026-10-11）

状态：调查做完（3/3=100%）；建议实施待做。用户确认对象为 everlosttime/glassdesk-updates。本记录附属于调查当时的 DESK-SYNC-004 交接，不新增实现工作包，不改变 ROADMAP 唯一下一项。

## 范围与证据

目标：核实公开材料，提取可用于 Dext 的交互、性能与兼容经验。
范围外：安装或启动 GlassDesk、反编译安装包、迁移未公开源码、改动当前桌面输入。

2026-10-11 读取 GitHub main 完整递归树，提交 3a31cffda7bb23cc53614638a92702705c6cf030，仅 README.md，truncated=false；未发现实现源码或许可证文件。公开 Releases 返回12条（v0.2.9至v1.2.2），资产为安装程序与校验和。README仍指向1.0.7，最新发布为1.2.2（北京时间2026-10-11 00:38）。因此这是公开更新仓库，不能作为已审查开源实现的证据；GitHub自动生成的Source code压缩包也不能证明包含产品源码。

本次结论来自作者的发布说明，未运行安装包；其测试数量、性能数字和兼容声明不是Dext实测结果。

## 独立调查步骤

| 步骤 | 状态 | 结果 |
|---|---|---|
| 1 确认同名仓库 | 做完 | 用户确认第1项 everlosttime/glassdesk-updates |
| 2 核对源码范围和版本 | 做完 | 完整树只有README；核对12条发布记录 |
| 3 映射Dext借鉴点并留交接 | 做完 | 下表区分发布事实、建议与缺失证据 |

## 可借鉴内容

以下Dext做法均为基于发布记录的建议，不代表还原了GlassDesk内部实现。

| 发布记录的内容 | 对Dext的建议 | 状态 |
|---|---|---|
| [1.0.7](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.0.7)：Dock动画按渲染帧更新，合并鼠标位置变化，减少布局和分配 | 高频移动只保存最新位置，在渲染帧统一更新视觉；点击/触控事件仍即时处理，不能将动作触发也排队到动画之后 | 待做（性能候选） |
| [1.2.2](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.2.2)：修复图标DPI通知误触发整个背景重建；过滤隐藏或采集区域外窗口移动 | 把图标变化、材质参数变化、真实窗口DPI/尺寸变化分开；只更新受影响资源。防止“移动鼠标或拖动时整个背景闪失” | 待做（材质候选） |
| [1.0.5](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.0.5)：复用捕获/缩放缓冲和位图，隐藏后回收；帧租约保护消费中的缓冲 | 将来增加实时玻璃采集时，明确缓冲所有权和窗口隐藏后的资源释放；不要因外观优化反复重建Player | 待做（真实玻璃功能尚非本包） |
| [1.0.2](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.0.2)：切页方向随上一页/下一页命令；连续反向保持页码/内容一致；减少动画可立即切页 | 作为切页回归标准：末页到首页仍按命令方向；快速反向、隐藏/搜索后无残留过渡层。不据此修改已验收输入 | 待做（后续视觉回归参考） |
| [1.1.7](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.1.7)、[1.2.0](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.2.0)：长按、图标让位、跨页、Esc取消与捕获中断后的布局保护 | 后续恢复内部排序时，先定义取消恢复和丢失捕获规则，再做动效；长按阈值需自行验证触控体验 | 待做（用户暂缓范围，不自动开工） |
| [1.0.6](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.0.6)：不同Win11版本采用隔离采集与兼容背景路径，回退不保证第三方动态壁纸 | 将来玻璃采集失败时可降级材质；不能影响桌面输入、文件显示或Dock运行 | 待做（兼容候选） |
| [1.0.7](https://github.com/everlosttime/glassdesk-updates/releases/tag/v1.0.7)：更新保留配置、布局、应用库和图标缓存，安装载荷不含用户Data | PACKAGING-001后续检查升级保留本机数据；文件扫描和用户布局不得被安装载荷覆盖 | 待做（既有打包工作包参考） |

## 不能从此仓库得出的结论

- 没有公开实现证明它支持原桌面文件枚举、目录监听、Explorer外部文件拖入、Shell右键；启动台图标排序不等于真实桌面文件操作。
- 没有公开实现证明其Dock通过AppBar预留工作区。[0.2.10](https://github.com/everlosttime/glassdesk-updates/releases/tag/v0.2.10)反而记录移除了不支持的任务栏边缘拦截选项。这不证明其余版本没有占位功能，只说明本次材料不足以借用实现。
- 1.0.7去除持久蓝色框、改为鼠标打开是该项目的选择；Dext保留用户指定的矩形反馈及键盘/触控能力，不照搬鼠标唯一入口。
- 1.2.2描述的背景重建问题不能直接当作Dext先前数据清空或点击迟钝的根因；须有本项目日志/代码证据。

## 调查当时执行与验收（历史）

以下百分比和下一步仅为2026-10-11调查时点快照。004文件右键修复随后已获用户通过并合入；当前005背景菜单待验收，准确状态见[V3_CURRENT](../V3_CURRENT.md)。上表长按/排序建议同样不覆盖后来用户指定的编辑迁移、拖动方式与视觉反馈要求。

当前DESK-SYNC-004仍为4/6≈67%，桌面同步路线2/4=50%，均未增加人工验收完成数。下一执行仍为第05步鼠标右键接线，之后候选交接；GlassDesk视觉建议不插队。

本次仅文档调查：人工可打开下列固定提交树和版本说明，核对“有公开源码”与“作者声称功能”的区别，无需操作桌面。运行版未更换。实际004验收仍以 [独立验收卡](../acceptance/DESK-SYNC-004-shell-actions.md) 为准。

来源入口：[固定提交树](https://github.com/everlosttime/glassdesk-updates/tree/3a31cffda7bb23cc53614638a92702705c6cf030)、[README](https://github.com/everlosttime/glassdesk-updates/blob/3a31cffda7bb23cc53614638a92702705c6cf030/README.md)、[Releases](https://github.com/everlosttime/glassdesk-updates/releases)。
