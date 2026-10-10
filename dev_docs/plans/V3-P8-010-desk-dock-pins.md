# V3-P8-010 应用Dock按Desk固定项
目标：用户能为当前Desk建立独立固定列表，并恢复跟随全局；保留运行应用与现有点击。
基线683c8fa；分支feat/V3-P8-010-desk-dock-pins；worktree v3-desk-dock-pins。
设计：旧全局Pins保持；Desk没有覆盖时跟随全局，首次增删复制当时有效列表后修改，空列表是有效覆盖；恢复继承删除覆盖。以Room/Desk稳定ID保存，切页完成后切列表，转场时不提前换。保存请求携带会话和Desk，迟到选择不能写到新页面。
持久化：Desk固定项归Core RoomPersonalData，删除Room自动清理；另存复制本机固定项且独立；导出不包含。全局固定项仍属于application-dock.json。
范围外：拖动排序、HTML内嵌任务区、多屏、改写原生按钮/鼠标路由。原窗口增减与点击保护保持。
四步：01模型存储开做；02Core/UI接线待做；03构建与定向检查待做；04统一人工验收待做。
