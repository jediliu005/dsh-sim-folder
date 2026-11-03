# dsh-sim-folder

给 DeepSeek Harness 用的**会话文件夹**面板：把侧栏里那一堆会话，按自己的习惯装进文件夹里，纯粹的肉眼管理。

## 它做什么

- 侧栏多一行 **📁 会话文件夹**，点开是一块面板
- 新建 / 重命名 / 删除文件夹，▲▼ 调顺序，可折叠
- 会话拖到文件夹任意位置就放进去；拖到某一行上＝插到那一行前面（顺序会记住）
- 每行右侧一个下拉，也能直接选「未分类 / 某个文件夹」，不用拖
- 右键某一行：**重命名（别名）**、复制会话 ID
- 已归档的会话画淡 + 删除线 + 「已归档」徽章（只读 DSH 的归档名单，用来显示）
- 删除文件夹时，里面的会话自动回到「未分类」，会话本身不动

## 它不做什么

设计上就只做**显示**，不碰 DSH 的固有状态：

| 不碰 | 说明 |
| --- | --- |
| DSH 的会话分组 / 排序 / 归档 | 一个字节都不写，归档名单只读来上色 |
| workspace 注册表 | 不读也不写（只有归档名单是只读读取） |
| 会话本身 | 不移动、不删除、不改真实标题 |

「重命名（别名）」只改这个面板里显示的名字，存插件自己的 sidecar；清空即恢复原名。

## 数据存哪

```
~/.dsh/sim-folder.json
{ "folders": [{ "id": "fxxx", "name": "工作", "collapsed": false }],
  "assign":  { "<sessionId>": "fxxx" },
  "order":   { "fxxx": ["<sessionId>", "..."] },
  "alias":   { "<sessionId>": "面板里显示的名字" } }
```

删掉这个文件＝回到出厂状态，不会影响任何会话。

## 安装

```bash
dsh plugin add link:/path/to/dsh-sim-folder     # 本地
# 或者从仓库安装
dsh plugin add github:<owner>/dsh-sim-folder
```

宿主侧设置：插件只用 `webServer` 注册两条路由（`/sim-folder/api/list`、`/sim-folder/api/save`），客户端只用 `slots` 注册一行入口和一块面板，不 inject 任何 DSH 内部服务。

## 兼容性

- 需要宿主提供 `sidebar.panellist` 槽位
- 会话列表来自宿主 `sessions` 服务；标题形如 `[dsh-…]` 的内部派生子会话会被隐藏，底部会显示隐藏了多少条

## License

MIT