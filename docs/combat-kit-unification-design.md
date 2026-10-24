# 玩家战斗壳归一设计定稿（combat-kit unification）

> 架构评审候选 6（玩家战斗壳归一）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）；
> 相关词条：GLOSSARY「玩家战斗 kit」「战斗核心」「头顶血条」。
> 切票 C6-T1~T4 已交付。

## 背景

nether ↔ adventure 约 350 行玩家战斗壳同形（实体构造/受击提醒/近战/箭矢管线/死亡
处置五段逐字级，击杀观感三份含 tank-range），弹道步进积分循环在 arena 还有第三份
（combat-core 只收了 leadAim/tickCadence/hitBody 三个无状态函数）；mkHpBar（S2）
只归一了血条渲染。取证见评审：六段同形 + 差异面枚举（准星锥/武器分派/伤害源/
耐久磨损）+ AI 骨架五维策略差异（激怒/归巢/飞行怪/伤害封顶/供怪节律）。

## 拍板（grilling 两轮 Q1~Q9）

| # | 决策 | 结论 |
|---|---|---|
| Q1 | 归属与命名 | 新文件 `js/combat-kit.js`，术语「玩家战斗 kit（CombatKit）」——战斗是与 mode-kit UI/chrome 服务不同族的 vocabulary |
| Q2 | 收编范围 | 受击/近战/箭矢/死亡复位/击杀观感五段收；**弹道步进数学下沉 combat-core**（arena 第三份同消解）；**怪物 AI 骨架不收**（五维策略差异，收了即宽 interface 浅模块） |
| Q3 | 玩家实体工厂 | mkFighter 收编（政策数值注入），留模式即下一个复制点 |
| Q4 | tank-range | 只消费击杀观感件（它没有玩家战斗） |
| Q5 | 测试策略 | 模式测试（nether 19 / adventure 85）原样存活即安全网；kit 补契约测试 |
| Q6 | mkHpBar | 随迁 combat-kit（与模式切换**同票原子落地**——中途票边界必须全绿） |
| Q7 | 节拍状态 | kit 自持（mkMelee/mkHurtAlarm 返回 {动作, tick(dt)}；箭矢数组/geo 缓存同理，clear() 收口） |
| Q8 | 导出 | 命名空间 `CombatKit`（ModeKit/Mobs 先例），GLOSSARY 收词 |
| Q9 | 切票 | T1 combat-core.stepShot → T2 kit 落地 → T3 三模式切换+迁件 → T4 文档 |

## 交付

- **C6-T1**（944081c）：CombatCore.stepShot（非变更式弹道步进，getBlock 注入保零全局，
  hitBlock 单列保竞技场巨石口径）；arena 第三份手写步进切换消费。
- **C6-T2**（6d066b4）：combat-kit.js 六件套落地 + 契约测试 8 例。
- **C6-T3**（021e342）：nether/adventure/tank-range 切换消费；mkHpBar 自 mode-kit
  原子迁入；模式测试**零断言改动**全绿（装载器各补一行真模块）；净减约 140 行。
- **C6-T4**（本文件）：GLOSSARY 新词「玩家战斗 kit」+ 修订「战斗核心」「头顶血条」。

## 关键口径

- **弓的冷却轨道**：nether 剑/弓共享一条冷却（换武器不躲冷却）——kit 以
  `swingAction(p, {cooldown, act})` 承载（占冷却 + 挥臂 + 自定义动作，不扫近战目标）。
- **swingOnMiss 二分**：nether 无目标也出手占冷却（观感即反馈）；adventure 锥内
  无怪不出手不占冷却（点击落挖掘/放置，T12 语义）——同一 interface 两种口径。
- **aim 单独导出**：adventure「锥内有怪也占住点击不落挖」的占位判定需要只读扫描。
- **箭矢一实例一弹种**：nether 两实例（玩家箭 hitMobs / 怪火球 sphere 不 lookAt
  hitPlayer）、adventure 一实例（骷髅箭 hitPlayer）——mesh/lookAt/targets/回调分开配。
- **复活五字段不变量**（resetFighter）与阵亡去向政策（回家 vs 回出生小屋+清炉+落盘）分离。

## 范围外（明确不做）

怪物 AI 骨架归一（策略差异留模式层，见 Q2）· 竞技场弹道 mesh 装配（观感留模式）·
arena 剥核（评审候选 3，另一张票）。
