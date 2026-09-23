# CONFIG-EDIT-001 配置器 Room 打开与可恢复修复设计

## 问题

配置器当前用发布级严格检查驱动“进入编辑”。Room 目录中只要存在未在 `room.json` 声明的 Widget 文件，`get_permission_review` 就直接失败。前端又在异步检查完成前写入部分 React 状态，失败后只返回 `false`，因此用户看到的是“编辑按钮没有反应”。

## 目标与边界

- 打开编辑器前完成一次原子审计；致命错误不写任何编辑状态并显示可读原因。
- 未声明 Widget 文件是“可修复问题”：允许进入受限编辑器，列出相对路径。
- 由用户显式触发恢复操作；文件移到 Dext 数据目录下的恢复区，不直接永久删除。
- 孤儿存在时禁止保存、预览、应用和导出；现有严格后端校验继续作为最终边界。
- 不修改 Room Schema、Widget 契约、真实桌面与排序逻辑。

## 接口

- `inspect_room_for_edit(path)`：完成 Schema、声明资源安全性与权限审查，返回 `permissionReviews` 和 `orphanWidgetResources`。只把未声明的普通 Widget 资源降级为可修复项；缺失声明文件、越界路径、符号链接及无效 JSON 仍失败。
- `quarantine_room_orphan_resources(path)`：重新审计后，将当前孤儿复制到唯一恢复目录，核对复制长度，再删除源文件并清理空目录；返回 `recoveryDir` 与 `moved`。
- 发布路径继续调用严格 `validate_room_asset_references`，孤儿资源仍阻止保存/预览/应用/导出。

## 状态事务

`openRoom` 先在局部变量中读取、解析并调用 `inspect_room_for_edit`。全部致命步骤成功后才一次性提交 Room、路径、权限和孤儿状态。失败时保持原界面并显示错误；可修复孤儿成功时进入编辑器并显示警告条。

## 恢复安全

恢复目录位于 `%LOCALAPPDATA%/Dext/recovery/room-orphans/<唯一批次>/`，保留 `widgets/...` 相对结构。跨磁盘不依赖 rename。复制全部成功前不删除源；删除阶段失败时恢复副本仍存在，结果明确报错而不伪装成功。

## 顺序

CONFIG-EDIT-001 单独验收并合入 master 后，再同步 `feat/DESK-REORDER-002-stable-sortable`，重铺真实桌面验证路径重排。两个工作包不得混在同一次提交或验收中。
