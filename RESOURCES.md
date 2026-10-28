# 专注训练营（儿童注意力训练游戏）Resources

主题：为 6 岁孩子构建基于实证范式的注意力训练游戏（本项目 MISSION.md）。
知识优先取自本表与仓库自有调研文档，不凭记忆编造数值。

## Knowledge

### 仓库自有权威文档（一手，最优先）

- [MISSION.md](MISSION.md) — 项目使命/成功标准/约束（零文字依赖、无构建步骤、反馈哲学）。
- [docs/conventions.md](docs/conventions.md) — 工程规范正文；改任何代码前必读。
- [docs/focus-revamp-design.md](docs/focus-revamp-design.md) — 训练营 2.0 设计定稿（2026-10-23）：
  难度再平衡参数表 + 战利品回路 + 测试计划。
- [docs/item-crafting-design.md](docs/item-crafting-design.md) — 物品与合成系统设计（新素材的数值与接口出处）。
- [docs/adr/0002-focus-loot-integration.md](docs/adr/0002-focus-loot-integration.md) — 专注接入物品系统的决策记录。
- [GLOSSARY.md](GLOSSARY.md) — 模块术语表（找模块先查这里）。

### 科学文献（范式与口径依据；代码 focus-levels.js 头注释同源）

- Diamond, A. (2013). *Executive Functions*. Annual Review of Psychology, 64.
  doi:10.1146/annurev-psych-113011-143750 — 五维范式归类（抑制/工作记忆/认知灵活性）的总纲。
- Davidson, Amso, Anderson & Diamond (2006). PNAS 103(31) — 儿童认知控制发展；
  「2 规则可、更多规则崩」的年龄上限出处（switch 维持 3 规则顶格的依据）。
- Cepeda, N. et al. (2006). *Distributed practice in verbal recall tasks*. Psychological Bulletin
  — 间隔效应；100 关螺旋编排的依据之一。
- Mueller & Dweck (1998). *Praise for intelligence can undermine children's motivation and
  performance*. Psychological Science 9(1) — 过程性表扬（夸努力不夸聪明）话术依据。
- Melby-Lervåg & Hulme (2016) — 工作记忆远迁移证据不足；家长面板免责声明的依据。
- K-CPT / KiTAP（儿童 CPT 商用量表）与 Corsi 方块儿童常模 — 范式参数的参照系（商业量表，无公开全文）。
- EndeavorRx（FDA 2020 首个游戏化数字疗法上市授权，fda.gov 可检索公告）— 70~85% 自适应
  训练带与游戏化奖励回路的工程参照。

### 儿童真实数据（本机一手）

- `data/progress-dv-muth1jkh16olit.json` — 孩子训练存档（12 天 72 局基线，2026-10-23 分析，
  见 learning-records/0001）。**难度调参前必读**；再平衡后两周复测对照。

### 参照游戏设计（脑锻炼系，训练营 2.0 结构层的参照系）

**用户指定的参照版本是《5 分钟鬼训练》（3DS 2012）**，初代只是外壳层的历史来源。

- [日文维基：ものすごく脳を鍛える5分間の鬼トレーニング](https://ja.wikipedia.org/wiki/%E3%82%82%E3%81%AE%E3%81%99%E3%81%94%E3%81%8F%E8%84%B3%E3%82%92%E9%8D%9B%E3%81%88%E3%82%8B5%E5%88%86%E9%96%93%E3%81%AE%E9%AC%BC%E3%83%88%E3%83%AC%E3%83%BC%E3%83%8B%E3%83%B3%E3%82%B0)
  — 鬼训练机制最全一手细节：八种鬼训一览与机制（鬼計算 n-back/鬼ブロック 反组块/鬼カップ
  追踪/鬼耳算语音版）；**85%↑·66~84%→·≤65%↓ 双阈阶梯**；5 分钟强制结束+逐日锁定+
  "过训可能反伤大脑"的官方封顶理由；**儿童本就是该作目标用户**。
- [Wikipedia: *Brain Age: Concentration Training*](https://en.wikipedia.org/wiki/Brain_Age:_Concentration_Training)
  — 欧美版条目（2012 日 / 2013 美）。
- [Nintendo World Report 评测](http://www.nintendoworldreport.com/review/33253/brain-age-concentration-training-nintendo-3ds)
  — 八个练习、5 分钟一块、专攻工作记忆的第三方印证。
- [川岛隆太 Miiverse 帖（r/3DS 存档）](https://www.reddit.com/r/3DS/comments/9cyzvc/dr_kawashimas_miiverse_posts_about_brain_age)
  — 川岛亲口确认鬼計算采用 N-back 标准——**MISSION <8 岁排除条款的直接依据**。
- [任天堂官方：鬼训练收录训练介绍页](https://www.nintendo.co.jp/3ds/asrj/training/index.html)
  — 各鬼训官方说明。
- [Wikipedia: *Brain Age: Train Your Brain in Minutes a Day!*](https://en.wikipedia.org/wiki/Brain_Age:_Train_Your_Brain_in_Minutes_a_Day!)
  — 初代（2005）图章机制一手细节：每日首训得章、当日 3 项大图章、集章解锁新训练/难度/
  自定义图章、每日首训才计入曲线图（防刷原则）；说明书对"脑年龄"的官方免责声明原文。
- [机核：《从"知育玩具"到千万级销量怪物》](https://www.gcores.com/articles/119890)
  — 系列设计史：川岛隆太与「学习疗法」（10~20 分钟/日）、主持人格的市场验证
  （PSP 版无川岛形象"没那个味道"）、科学界对其依据的批评（久保田競）。
- [任天堂官网：脑锻炼 NS 介绍](https://www.nintendo.com.cn/topics/055b656d-f7b2-4242-b42d-c40fc32184b5)
  — "每天数分钟、持之以恒"的官方定位口径。

## Wisdom (Communities)

- 尚未选定。候选方向（未来补充）：儿童认知训练研究社区、Cognitive Control Society、
  Minecraft 教育版开发者社区。用户未表态，勿主动推销。

## Gaps

- Klimovich 2025（focus-levels.js 引用的间隔+交错综述）未独立核对原文——引用前先查证。
- 6 岁 Corsi 方块常模的一手文献未直接核对（代码注释口径 3~5），如需改 corsi 参数先补证。
