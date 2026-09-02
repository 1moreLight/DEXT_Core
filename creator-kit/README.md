# Dext Creator Kit v1

AI 或人工作者只生成 `creator.json` 与 `content/`。Dext 会先做离线静态检查，在无同源权限的 sandbox iframe 中预览，用户确认后才复制进 Room。

- 包根目录只能有 `creator.json` 和 `content/`。
- `entry` 与 `resources` 都相对 `content/`，且每个文件必须显式声明。
- 禁止远程 URL、网络 API、子 iframe、下载、弹窗、表单提交和顶层导航。
- 系统数据只能订阅已声明且由本机用户批准的 Dext capability。
- 系统动作只能由 Room manifest 的官方透明热点触发；作者 JavaScript 不能直接执行动作。
- 预览不等于授权，分享包永远不携带本机授权。

打包时将 `creator.json` 和 `content/` 直接放在 zip 根目录，扩展名建议 `.dext-content.zip`。
