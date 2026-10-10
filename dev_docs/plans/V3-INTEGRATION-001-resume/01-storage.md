# 01 Core存储授权
状态：做完
扩展配置器可编辑项至四读取加storage.read/write，保持实际ReadData白名单四项。定向生产源码测试先复现未列出/不能允许，再验证存储读取写入、独立撤销、持久状态重读和安装隔离。
命令：dotnet run --project tests/Dext.RoomActions.Tests -c Release -- --read-grants
Expected: 全部通过；原六项保持。

生产源码定向6/9 RED→9/9 GREEN，独立读写/撤销/磁盘重读、旧安装、失败保存均通过。过程中partial静态初始化顺序引用为空，改为独立集合初始化；不改私人格式。
