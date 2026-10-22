# 怪物谱系 · 实现设计定稿

> 需求定稿见 `docs/monster-taxonomy-plan.md`（D1~D8 已拍板，全部按推荐方案）。
> 本文是第 ② 步产出：实施落点。首期实施 = 分期①（数据层+面板）+ 分期②（技能模板化）；
> 分期③（5 类新原型 + 特化补满）后续拆多次，不在本次范围。
>
> **修订记录（2026-10-22 二审，用户反馈两条，均已改）**：
> ① **族按物种，不按地域/机制**——撤"下界帮"（地域）与"不倒翁家族"（机制）：猪灵/蛮兵/僵尸猪灵归猪猪一家；**新增疣猪兽一家**（疣猪兽+僵尸疣猪兽，家传·蛮冲：直线冲刺撞飞第一个敌人）；幻翼/凋灵/烈焰人/恶魂/潜影贝并入独行侠（无物种近亲）；僵尸血统作副族保留在僵尸猪灵/僵尸疣猪兽身上（物种×物种双族）。展示分组 = 9 物种族 + 独行侠共 10 桶。
> ② **面板 UI 改内联簇式**——组头不再整行断组（37 怪 10 族会"每行短、整体长"）：组头+组员成一个 `div.famGroup` 内联簇（浅底色轻描族界），簇随行流动；竞技场 .mobBtns 视窗 132px→266px（132 是五怪时代的高度）。
>
> **修订记录（2026-10-22 三审，用户定调"种族=长相接近"并给三个归组示例，四个开放点经确认全按推荐）**：
> ① **种族=长相接近的血统组**，另允许职责组（守卫组：不长相近但都是"守卫"）；
> ② 疣猪兽并入猪猪一家（人形猪+野兽猪共 5 只），家传统一为**蛮冲**（猪突猛进，原"战吼"撤）；
> ③ **新增鬼一族**（恶魂/幻翼/烈焰人/凋灵/末影人+恼鬼，家传·**阴风**：被鬼打中的敌人短时减速——结算在 damageMob 的 src 判定）；末影一家解散，末影人进鬼一族（**颤栗瞬移降为其个体特化**），末影龙与末影人非同种族 → 末影龙进独行侠；
> ④ 守卫者/远古守卫者并入**守卫组**（与铁傀儡/监守者同组，家传·**磐石**：血量<40% 进入 3s 坚守受伤减半，冷却 12s）；**蓄力激光降为守卫者系的个体特化**（MOB_QUIRKS 的 laser 声明型）。
> 展示分组 = 僵尸一家/骷髅一家/虫虫族/猪猪一家/鬼一族/守卫组/灾厄帮/软软族 + 独行侠（苦力怕/嘎枝/末影龙/潜影贝）共 9 桶。
>
> **修订记录（2026-10-22 四审，用户定调"末影龙是龙族、潜影贝是海族、撤独行侠"）**：
> ① **末影龙单独立龙族**（单员族，龙息即本体特化，家传留待第二只龙）；**潜影贝归海族**（单员族，追踪弹特化三期补）；
> ② **独行侠兜底族撤销**——每怪必归种族：苦力怕+嘎枝合并**草木族**（植物身子，家传三期补"扎根/再生"方向）；
> ③ `Mobs.families()` 改桶驱动+注册表排序：未注册键兜底键名不再静默丢桶（lone 从 FAMILIES 移除后的防御）。
> 展示分组 = 11 个种族：僵尸一家/骷髅一家/虫虫族/猪猪一家/鬼一族/守卫组/灾厄帮/软软族/草木族/龙族/海族。

## 0. 一句话架构

**谱系是数据（config.js 的 `family`/`proto` 字段 + `FAMILIES` 注册表），分组查询归怪物库（`Mobs.families()`），家传技能表归竞技场模式层（`FAMILY_SKILLS`），个体豁免归特化表（`MOB_QUIRKS`）。**

```
config.js          MOB_TYPES 每行 + family:['主族','副族'…] + proto:'模板'
                   FAMILIES 注册表(展示名·顺序) + PROTOS 合法值表
js/mobs.js         Mobs.families() 面板分组查询(镜像 spawnable 的地位)
                   自检扩展: family 键/proto 值合法 · mix 不带谱系
js/modes/arena.js  FAMILY_SKILLS 家传技能表(8 族) — 战斗节拍型技能的分发处
                   MOB_QUIRKS 个体特化表 — 现阶段承载"家传豁免"声明
js/modes/tank-range.js / 竞技场面板  按 families() 分组渲染
```

## 1. 数据形状（config.js）

- `family`: **有序字符串数组**，首位 = 主族（面板归组 + 家传技能发放单位，D6）；空数组合法（独行侠）；一怪多族合法（僵尸猪灵 `['piglin_line','undead','nether']`，研究 §1.6 先例）。
- `proto`: 单值字符串，8 个合法值（charger/archer/bomber/ambusher/diver/turret/splitter/skirmisher）。**本期只做数据位**——战斗 AI 分发仍走现有 move* 函数（proto 消费者是分期③的原型化改造），先落表让新怪有章可循。
- `FAMILIES`: 展示注册表 `{key:{name:'孩子叫法', order}}`，含伪族 `lone`（独行侠——无 family 怪的展示归组，怪物行**不引用**它，`families()` 合成）。
- 归族数据 = plan §4.4 表（37 怪逐怪），主族决定面板归组：僵尸一家 4 · 骷髅一家 4 · 虫虫族 4 · 猪猪一家 3 · 灾厄帮 5 · 软软族 2 · 守卫一家 2 · 末影一家 3（enderman/shulker/dragon）· 不倒翁家族 2（phantom/wither）· 下界帮 3（hoglin/blaze/ghast）· 独行侠 5（creeper/golem/vex/creaking/warden）= 37。

## 2. 怪物库接口（js/mobs.js）

- `Mobs.families() → [{key, name, members:[typeKey…]}]`：按 FAMILIES.order 排序、成员按主族归组、空族跳过、无族怪落 `lone`。面板唯一分组入口（竞技场/演习场共用，镜像 spawnable 的地位）。FAMILIES 未定义（测试桩环境）时退化为单桶——引擎容忍缺省。
- 自检扩展（现有 `MOB_TYPES↔MOB_RIG` 自检旁）：family 引用未注册键 / proto 不在 PROTOS / mix 带谱系 → console.warn。加载期即发现配错，与 RIG 自检同一道理。

## 3. 家传技能表（js/modes/arena.js · 分期②）

`m.mfam` 在 spawnMob 预计算：`= MOB_QUIRKS[type].familySkill===false ? null : family[0]`（个体豁免优先于主族——"族给默认值、个体可覆盖"，研究 §1.2 特化豁免）。`FAMILY_SKILLS[m.mfam]` 为空即无家传（undead/nether 纯分组族天然无技能，D4）。

| 族 | 技能 | 触发 | 实现 |
| --- | --- | --- | --- |
| zombie_line | 狂暴（现有，推广成族技） | 血量 <50%（精英 70%） | 现 `tryZombieRage` 改族门：`m.mfam` 判定；群体冲锋同伴判定同步改主族；王者冲击波保留 |
| skeleton_line | 强力箭节奏（收编+加密，D7） | 射击节拍 | 通用节奏保留（%3/精英%2）；族版基础即 %2。近战族员（凋灵骷髅）转**节奏重斩**：每 3 击（精英每 2 击）一次 1.6× 伤害+大击退 |
| arthropod | 疾爬突进（新） | 距目标 3~10 格 | `burstT=1.1s` 速度 ×1.8，冷却 6s（精英 4.5s）；mobSpeed 加系数 |
| piglin_line | 战吼（新） | 血量首次 <70% | 吼一声（sfx+Fx.pop），半径 8 内同族同阵营获 `warcryT=4s`：攻击冷却流逝 ×1.35（精英 5s） |
| illager | 袭击协同（新） | 被动 | 0.4s 节奏重数 10 格内同族同阵营数 n，`dmgMult = TIER_MULT[level].dmg × (1+0.06×min(4,n-1))`（每帧重算，晋升赋值下一拍自愈） |
| slime_line | 分裂（新） | 死亡瞬间 | 非小只（`splitChild` 标记+血量门槛）且场上 <600 只时，原地生 2 只 hpMult 0.3 · 体型 0.6 的小只，小只不再分裂 |
| guardian_line | 蓄力激光（新） | 攻击就绪 | 0.7s 蓄力（白闪渐强，锁定转向）→ `Fx.beam` 直线命中（cfg.dmg×1.5），替代箭矢；目标脱程则放空 |
| ender | 颤栗瞬移（新） | 距目标 >8 格 | 闪现到目标旁 2.5~3.5 格（setPos+settle 贴地，clamp 场内），两端 Fx.pop 紫云，冷却 5s（精英 3.5s） |

`MOB_QUIRKS`（现阶段承载豁免声明；扑袭/震地/龙息是**移动一体型特化**，留在各自原型分支，不强行表驱动——表驱动只收"战斗节拍型"技能）：

```js
const MOB_QUIRKS = {
  dragon:  {familySkill:false},   // 特化=龙息毒云(自带), 不叠末影家传
  shulker: {familySkill:false},   // 特化位三期补(追踪弹)
};
```

**挂点（对现有代码的最小侵入）**：updateMobs 的 `tryZombieRage(m,gp)` 调用点改为 `familyTick(m,gp,dt)`（rage 轮询/突进/战吼/协同重数/蓄力/瞬移全在这里）；damageMob 的 freshDead 处加 `familyOnDead(m)`（分裂）；rangedVolley/moveMelee 挥击处读族节奏；mobSpeed 加 burst/warcry 系数。

## 4. 面板与编队（分期①的 UI 面）

- 竞技场 `buildPanel` / 演习场 `buildPicker`：按 `Mobs.families()` 分组渲染，组头 `span.famHead`（flex-basis:100% 换行，CSS 一条）；竞技场 mix 伪类型按钮仍排最前（编队功能位，不归族）。
- 竞技场混合编队改**按族等权抽样**：先均匀抽主族、再在族内均匀抽成员（原先成员均匀——僵尸一家 4 只挤占下界帮 3 只的名额，配平更公平）。`MIX_POOL` 先按主族分桶。
- index.html 图鉴文案行补一句"按家族分组"（mode-registry 测试只断言 id，不碰文案）。

## 5. GLOSSARY / 文档随代码落地

- 新词条 **怪物谱系（Mob Taxonomy）**（plan §6 草案原文）。
- **怪物库（Mobs）** 词条 interface 清单补 `families`。
- **竞技场（Arena）** 词条补一句"家传技能按族发放（FAMILY_SKILLS）"。

## 6. 测试策略（TDD 缝）

1. **先红后绿**：`test/mob-taxonomy.test.js`（vm 共享环境加载 config.js + mobs.js，镜像 boot/mobs 两测试的惯例）：
   - 完整性：37 个可部署怪 proto 合法 · family 键全注册 · mix 不带谱系；
   - 语义钉：僵尸猪灵主族=猪灵系（双族先例）· 苦力怕/铁傀儡无族（无族合法）· 末影龙不带家传（豁免在模式表，这里钉数据面的归组）；
   - `Mobs.families()`：11 桶全在场（lone 合成）· 37 怪恰好各归一桶 · 顺序按 FAMILIES.order。
2. 模式层（tank-mode 现有 fake）：fake Mobs 补 `families()`，选怪面板分组断言更新。
3. 竞技场技能：无既有测试缝（与现有 4 技能同待遇——mode 层无 harness），靠 boot 链冒烟 + 全量回归 + 真机试玩调数值（手感数字全部集中在 FAMILY_SKILLS 表头，改表即改数值）。

## 7. 已知取舍（评审时可能被问的）

- **proto 本期不接管 AI 分发**：move* 五函数已是事实上的原型分发器，强行改名是搬家不换房；分期③原型化时 proto 才成为分发键。数据先到位，新怪加行时就必须声明原型——章法从数据开始。
- ** undead/nether 零技能**：纯分组族（D4 机制后置）。"下界帮火焰亲和"等机制挂钩等坦克演习场真需要爆炸减伤时再接（那时才有第二个消费者）。
- **袭击协同每帧重算 dmgMult**：晋升时 levelUp 直写 dmgMult 会被下一拍（≤0.4s）重算覆盖为相同值——语义一致，无漂移。
- **分裂可能推高团战人数**：600 只门槛 + 小不再裂双保险；劣势方 comebackMult 有 clamp，经济不炸。分裂走延迟队列（pendingSplits，下一帧 flush）——damageMob 的调用方可能正迭代 mobs 数组（aoeDamage 爆炸环），且同帧落地会被同一爆炸打死新生儿。
- **坦克出发配置页怪物行不分组**：那是 sceneCard 卡片流（横排滚看），组头会打断卡片网格；游戏内 👾 面板与竞技场面板已分组——谱系"可讲"的场所在这两处。

---

*实现设计定稿 v1 · 2026-10-22 · 基于需求定稿 docs/monster-taxonomy-plan.md（D1~D8 全拍板）*
