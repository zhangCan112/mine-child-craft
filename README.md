# mine-child-craft · 我孩子的工坊

> mine · child · craft —— 把 **child** 藏进 MINE**CRAFT** 中间；
> 古雅英语里 "mine" 即 "my"。这是我孩子的工坊。

为 6 岁孩子打造的 Minecraft 风格体素游戏乐园：孩子在自己喜欢的方块世界里玩，
家长得到基于认知科学的结构化训练。

## 玩法模式

| 模式 | 说明 |
| --- | --- |
| 专注训练营 | 五维注意力训练，约 100 关渐进式（见下） |
| 数学冒险岛 | 数学口算闯关，TTS 中文语音主导 |
| 探险模式 | 冒险闯关，昼/夜/下界动态切换 |
| 建造 | 自由搭建方块世界 |
| 竞技场 / 坦克演习场 | 动作玩法 |
| 体验馆 | 开发者调试场（`?dev=1` 解锁，默认隐藏） |

## 开发模式（`?dev=1`）

面向开发者的读侧旁路（设计见 `docs/dev-mode-design.md`）：dev 向模式卡可见（体验馆）、
儿童时限与训练营每日限额失效（无限游玩）、数学岛 120 关全亮可点、专注训练营今日页
跳关直达任意关、每日体检/魔鬼特训可重复进。无参数路径行为零变化，存档照常写。

## 专注训练营

孩子每天 20 分钟内的科学练习，不是多打一小时游戏：

- **五维范式**：持续警觉 / 抑制控制 / 干扰控制 / 视空记忆 / 规则切换，
  每维 8 级难度 × 递进关卡，约 100 关
- **设计有出处**：范式结构对应儿童认知训练文献
  （Diamond 2013、K-CPT、EndeavorRx 设计参数），
  宣称口径诚实——技能练习，不提智商、不提治疗
- **零压迫反馈**：过程性表扬、零惩罚、零倒计时；夸努力，不夸聪明
- **防沉迷内置**：每日 6 关 / 20 分钟硬锁定，到点就停
- **家长面板**：分维度正确率 / 反应时间趋势、CSV 导出、诚实免责声明

为 6 岁设计：纯鼠标点选，零文字依赖（图标 + 中文 TTS 语音），无键盘、无指针锁定。

## 安装与启动

**环境**：一个较新的 [Node.js](https://nodejs.org/)（仅用来起本地静态服务器）。
游戏运行**零 npm 依赖**——克隆即玩，不需要 `npm install`。

```bash
git clone https://github.com/<你的用户名>/mine-child-craft.git
cd mine-child-craft
node server.js        # 启动本地服务，默认 http://localhost:8080
```

浏览器打开 <http://localhost:8080> 即玩（纯鼠标，零文字门槛）。
进度经 `/progress` 与本地文件同步。

- **不想装 Node.js**：双击 `index.html` 直开（file:// 降级路径，功能不缺，
  进度自动存 localStorage）
- **参与开发**：`npm install`（只装开发期 lint 工具链），
  然后 `npm test` 跑全量单测 + 冒烟，`npm run lint` 过规范守门

## 开发

```bash
npm install     # 只装开发期 lint 工具链
npm test        # 全部单测 + boot 全链冒烟 + 规范守门
npm run lint    # ESLint(google 基线) + Stylelint + htmlhint
```

技术栈：原生 JavaScript + Three.js r128，经典 `<script>` 多文件共享词法环境，
**无构建步骤**；网格构建走 Web Worker。模块划分、命名与工程约定见
[docs/conventions.md](docs/conventions.md) 与 [GLOSSARY.md](GLOSSARY.md)。

## 许可证

- 代码：[MIT](LICENSE)
- `assets/audio` 音频素材：全部 CC0 公有领域，逐条溯源见
  [assets/audio/CREDITS.md](assets/audio/CREDITS.md)
- 内置 `lib/three.min.js`：Three.js 官方 MIT 构建，保留原许可头

本项目与 Mojang / Microsoft 的 Minecraft 无官方关联，仅作个人家庭教育用途。
