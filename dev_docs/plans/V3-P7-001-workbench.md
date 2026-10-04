# V3-P7-001 试验台与作者诊断
2026-10-04；基线99c6ea7，feat/V3-P7-001-workbench / v3-workbench。

目标：正式DOM/FrameHost/Runtime/Layout/Media模块和作者SDK执行当前草稿，检查多尺寸、Desk切换、按钮/占用区域和缺数据/权限反馈。
设计：编辑器内独立视图；iframe sandbox仅allow-scripts，固定官方宿主源码通过Vite raw导入打包。原生资源通过短期v3preview会话，只读当前已校验草稿声明的Room资源；退出撤销。不向预览送真实Core IPC、用户私人目标或授权。预览适配器模拟快照、只读数据及权限；导航/阶段只改变预览，启动/媒体控制/退出明确拒绝。使用正式DOM/frame/layout代码，支持作者发布实际几何，诊断展示声明与实际区域差异。尺寸改变不重建作者frame，允许切Desk、数据available/missing/denied及暂停/唤醒。

Task1 Rust资源会话及命令/协议接线：复用room_v3校验/open_resource，缺文件报告位置，资源读无写磁盘。
Task2 workbench-host.js适配正式DOM与模拟快照/数据；诊断与区域SVG独立覆盖层，不写入作品。
Task3 React工作台入口/宽高预设/缩放适配、生命周期、按钮来源/实际几何/组件/错误/资源诊断。
Task4 用户游戏结束后必要npm build/cargo check与一次真实配置器预览冒烟；保留P6/P5未完成门槛和最终集中验收。不扩大攻击/网络矩阵，不因未实测阻塞下一段可编码功能。

完整V3_PLAN范围保留，游戏/拖动遵用户暂缓。功能实施按4步报告，整项就绪仍按16条完整门槛。

首轮实现：Task1-3代码已写，Task4待游戏后。只做JS语法与差异检查；没有将代码存在算成完整功能通过。编码3/4=75%。
