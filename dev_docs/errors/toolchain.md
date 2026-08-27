# 踩坑记录 · 工具链篇（PowerShell / 编码 / 环境，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / frontend / renderer

## 6. 日志偶发 Unexpected WorkerW Z-order

- 根因：虚拟显示器适配器（GameViewer / Luminoncore IDDCX）干扰桌面窗口枚举
- 解决：忽略即可；测试时只留 DISPLAY1 主屏

## 8. PowerShell 5.1 读无 BOM UTF-8 JSON 中文乱码

- 症状：ConvertFrom-Json 对含中文的 room.json 报"无效对象"
- 根因：PS5.1 默认按 ANSI 读文件，多字节字符被拆坏
- 说明：仅 PS 工具链问题，浏览器 fetch 正常；PS 里需 -Encoding UTF8

## 9. PowerShell 改写 UTF-8 文件会加 BOM / 正则匹配中文易漏

- 症状：用 PS -replace + Set-Content 改 TODO.md 后文件带 BOM；含中文/反引号的行正则漏匹配
- 解决：结构化改写一律用 node -e（JSON/UTF-8 无 BOM）；打标用编辑工具逐条改
- 防再犯：dev_docs 的批量改写别走 PS 管道

## 10. node -e 里的 $1 被 PowerShell 双引号吞掉

- 症状：`node -e "...replace(/re/,'- [x] $1')"` 经 bash 工具执行后，$1 变空串，替换结果丢字
- 根因：PowerShell 双引号字符串先做自己的变量插值，$1 是 PS 的空变量
- 解决：跨 PS 传正则替换时用单引号包 node 脚本，或干脆用编辑工具逐条改

## 14. node -e 批量正则替换里的 $1 反复被 PowerShell 吞（第三次）

- 症状：ACCEPTANCE.md 批量打勾后 V1-V10 编号全丢变成 **V**
- 根因：双引号字符串里 PowerShell 先行插值 $1；单引号包脚本或用编辑工具可避免
- 解决：涉及捕获组替换一律用编辑工具逐条改；此坑已犯三次，不再用 PS 传正则替换

## 16. PS 控制台显示中文乱码 ≠ 文件乱码（虚惊）

- 症状：Add-Content 追加中文后 Select-String/Get-Content 输出全是乱码，以为文件坏了
- 根因：PS 5.1 控制台按代码页显示，文件本身是正确的 UTF-8；Read 工具读出来完全正常
- 解决：判断文件是否乱码一律用编辑/读文件工具看，别信 PS 控制台显示
- 防再犯：与 #8 区分——#8 是 PS 管道**读取解析**坏（ConvertFrom-Json 报错），本条只是**显示**层假象
