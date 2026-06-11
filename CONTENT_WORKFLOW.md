# 内容数据工作流

这个项目现在采用“内容 JSON + 代码读取器 + 内容管理工具”的结构。游戏逻辑不再硬编码剧情、角色、抽卡、手机事件等内容。

## 内容文件

- `src/content/story.json`：章节和剧情节点。
- `src/content/characters.json`：角色、稀有度、台词、互动、效果、手机性格。
- `src/content/phone-events.json`：微信、短信、电话、浏览器推送事件。
- `src/content/gacha.json`：抽卡消耗、概率和保底。
- `src/content/rewards.json`：剧情、登录、角色等奖励数值。

`src/data/*.ts` 只负责把 JSON 类型化导入并提供查询函数，例如 `getNodeById`、`getCharacterById`。页面和引擎只依赖这些读取器。

## 为什么剧情用节点图

本游戏的剧情不是纯线性文本，节点会触发：

- 分支选项和条件判断。
- 资源、声望、好感、flag 等效果。
- 抽卡、打脸演出、手机通知等特殊节点。
- 后续手机事件和角色互动。

最可控的编辑方式是“可拖拽节点图 + JSON 详情编辑”：

- React Flow / XYFlow 节点图负责直接编排剧情流向：拖动节点排版，从节点右侧端口拖到目标左侧端口建边，点击连线修改目标或删除。
- 右侧表单负责编辑节点 ID、类型、说话人、背景、正文以及抽卡/打脸/手机通知等常用字段。
- 校验工具负责检查 `nextNodeId`、角色 ID、手机事件 ID、素材路径等引用。
- Mermaid 只保留为导出/排查用，不作为主要编辑入口。

## 常用命令

Windows 一键启动/停止：

```bat
start-xiashan.cmd
stop-xiashan.cmd
```

启动后：

- 游戏：`http://127.0.0.1:5173/`
- 内容工具中心：`http://127.0.0.1:5174/`

脚本运行信息和日志保存在 `.runtime/`。

也可以单独运行 npm 命令：

```bash
npm run content:validate
npm run content:stats
npm run content:graph
npm run content:tools
```

- `content:validate`：校验所有内容引用和基础规则。
- `content:stats`：输出角色数量、稀有度分布、剧情节点类型统计等。
- `content:graph`：导出 `tools/story-graph.mmd` Mermaid 剧情图，主要用于排查或文档引用。
- `content:tools`：启动本地内容工具中心，默认地址 `http://127.0.0.1:5174/`。
- `content:story`：兼容旧命令，同样启动内容工具中心。

工具中心包含：

- 剧情图编辑器：`http://127.0.0.1:5174/story`
- 内容校验
- 内容统计
- Mermaid 图导出
- 全量内容 JSON 查看

## 剧情节点规则

每个节点至少需要：

```json
{
  "id": "ch1_01",
  "chapterId": 1,
  "type": "narration",
  "text": "剧情文本"
}
```

常用流向：

- 线性节点用 `nextNodeId`。
- 分支节点用 `choices[].nextNodeId`。
- 结尾节点不写 `nextNodeId`，游戏会按章节结束处理。

常用联动：

- `effects` 里写资源、声望、好感、flag。
- `phoneNotify` 触发手机顶部通知。
- `trigger_phone_event` 可以引用 `phone-events.json` 里的事件 ID。

## 抽卡展示配置

角色抽卡大展示页优先读取角色数据里的抽卡专用字段：

```json
{
  "gachaPortraitUrl": "/characters/my_full_art.png",
  "gachaBackgroundUrl": "/bg/my_gacha_bg.png",
  "gachaQuote": "喂，少年，需要我帮你吗？",
  "gachaTags": ["增益", "精灵"]
}
```

字段都可选：

- `gachaPortraitUrl`：抽卡展示专用立绘。没有配置时使用 `portraitUrl`。
- `gachaBackgroundUrl`：抽卡展示背景。没有配置时使用默认抽卡展示背景。
- `gachaQuote`：抽卡展示台词。没有配置时使用角色第一条 `dialogues`。
- `gachaTags`：抽卡展示标签。没有配置时使用角色 `element` 和 `title`。

图片放在 `public` 下，JSON 里使用 `/characters/...`、`/bg/...` 这种路径。`npm run content:validate` 会检查这些资源是否存在。

## 新增内容前后检查

新增或修改内容后，至少运行：

```bash
npm run content:validate
npm run check
```

要验证打包：

```bash
npm run build
```

如果改了剧情结构，建议额外运行：

```bash
npm run content:graph
```

主要还是打开 `http://127.0.0.1:5174/story` 检查图上分支；`tools/story-graph.mmd` 只是辅助导出。
