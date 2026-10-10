# V3-P10-004 另存分享验收
状态：3/4=75%，自动部分通过、人工待统一验收；承接原P10-001与P10-002的人工门槛。
1. 编辑草稿后另存，新旧Room ID独立、节点/资源保持；原Room未被保存覆盖。
2. 新副本复制个人绑定/皮肤，但不继承权限、计数与个人摆放；删除副本不影响原Room与全局目标。
3. 导出副本再导入两次，资源/Desk/组件关联保持，可预览应用；分享包不带本机私人记录。
4. 取消/重名/资源缺失有明确错误，原文件不变，重试后可完成；四媒体最终使用链仍按原P10卡。

自动证据：cargo test --lib --features v3-release room_v3_sharing::tests 4/4；dotnet run --project tests/Dext.RoomActions.Tests -c Release -- --sharing-copy 2/2。使用临时目录和实际生产类，不代表Tauri对话框/Core RPC人工验收。运行逻辑未修改，当前候选不必替换。

