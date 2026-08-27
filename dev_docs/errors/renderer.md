# 踩坑记录 · 渲染器篇（wallpapers/dext-room，追加式勿删）

> 格式：症状 / 根因 / 解决 / 防再犯
> 全量索引见 `../ERRORS.md`；其他分册：git / backend / frontend / toolchain

## 4. 切桌永久卡死

- 根因：配置器写的 room.json 缺 transitionText 字段，main.js 对 undefined 调用函数抛异常，switching 锁死为 true
- 解决：缺字段回退默认文案（bc2af63）
- 防再犯：渲染器处处兜底（宽容读取），schema v1 要写明全部可选字段

## 19. SVG polyline points 不支持百分比坐标（R9 导图线条挤成左上角一坨）

- 现象：思维导图连线全部缩在画布左上角成一个"不明物体"小箭头，节点间反而看不到线
- 原因：<polyline points="15,48.6 ..."> 的 points 是用户单位（px），**不支持 %**；
  <line x1/y1/x2/y2> 才支持百分比。想当然把 % 塞进 points 就全挤到左上角了
- 解决：每条路由拆成 3 段 <line>（% 坐标），箭头 markerEnd 只放最后一段；
  strokeWidth 用固定值不受 % 影响
- 教训：SVG 里 polyline/polygon/path 的坐标一律是用户单位；要 % 就用 line/circle 等支持
  百分比的元素属性，或上 viewBox+preserveAspectRatio（注意描边会跟着缩放）
