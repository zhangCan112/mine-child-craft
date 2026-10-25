# 熔炉玩法与物品体系二期 · 实现设计

> 需求合同：`docs/furnace-plan.md`（2026-10-24 四项拍板：①每炉独立+持久化 ②金苹果 ③世界火焰+燃料余量条 ④被动动物拉进本期）。
> MC 数值依据：`docs/minecraft-furnace-research.md` + `docs/minecraft-item-crafting-research.md`（一期研究稿）。
> 基线：master `514b736`（战斗壳 C6 已并入——探险玩家战斗已收 CombatKit，挥击击杀管线对动物天然可用），855 测试全绿。
> 本稿定稿全部数值与数据形状；实现按 §8 工单切分，逐单走 TDD。

> **实施状态注记（2026-10-25）**：F1~F4 已全量落地于 adventure-furnace 分支——880 测试全绿（基线 855 → +25），lint 三工具零错，GLOSSARY 增「牧场」词条并修订「探险模式/怪物谱系」。实施口径偏差四处（均在代码注释标明出处）：①advEatPolicy 收编 full 旗标（F3——政策收进纯函数 seam，消费方只透传）；②炉口火焰在无渲染环境值为 null（F2——惰性创建先例的自然延伸，逻辑集照记）；③死畜记账并进既有 onDeath 掉落回调（F4——不另注册第二个回调，保 deathCs 断言）；④鸡建模走四足生成器参数缩放 + 新增 comb 冠髯参数（F4——侵入最小，未加骨架条目）。

---

## 0. 现状资产盘点（全部复用，不重造）

| 现有资产 | 位置 | 本设计的用法 |
| --- | --- | --- |
| `advSmeltStep(s,dt)` / `advFurnaceRefund` | adventure-core.js | **零改动**——纯函数本就无状态，容器换成 Map 即多炉 |
| `advNearStation` / `advRescanStations` / `advStations` | adventure-core / adventure.js | 站点缓存已按位置键——多炉天然支持；加「消失炉退料」diff |
| `mkFurnacePanel`（setSlots/setProgress/autoPlan） | mode-kit.js | 加 `setFuel(r)` 喂口；其余不动 |
| 世界档 Map 序列化惯例 | adventure.js `advWorldSlot`（encode `[...map.entries()]` / decode `new Map(sv.x||[])`） | `furnaces` / `livestock` 字段同款 |
| CombatKit 六件套 | combat-kit.js | 动物受击（mkHurtAlarm 不挂——动物不打人）/击杀观感 `killBurst(verb:'收获')` / 挥击命中（mkMelee 锥内最近怪，动物是 Mobs 实体天然在列） |
| Mobs 实体库 | mobs.js | 动物=新 MOB_TYPES 条目：四足生成器建模、游荡本能、`move/steer` 意图 API（恐惧游荡用）、onDeath 掉落管线 |
| `MOB_DROPS` / `rollDrops` | config.js / drops.js | 加 4 条目，掷骰管线零改动 |
| `SMELTS` / `RECIPES` / `ITEMS` | craft-core / items-core | 加数据行 |
| 贴图图集 / ITEM_PIX | texture-atlas.js / icons.js | 羊毛方块一格 + 12 张物品像素画（守门测试自动覆盖） |
| 钻石首获仪式先例 | adventure.js `advDiamondRite` + 音册 `gem` 琶音 | 金苹果首获同款轻量仪式 |
| `SyncDB.slot` defaults 补缺 | sync.js | 老档无新字段=空值，天然向后兼容 |

**引擎/应用分层红线**：MOB_TYPES 条目、掉落表、SMELTS、ITEMS、方块 52 是引擎层数据；散布位置、恐惧游荡政策、退料/存档时机、仪式话术全在模式层。

---

## 1. F1 每炉独立 + 持久化

### 1.1 数据形状

```js
/* adventure.js 模式层（替换原全局单对象 advFurnace） */
let advFurnaces = new Map();   /* posKey 'x,y,z' → {input, fuel, out, heat, prog}（五元组形状不变） */
let advFurnaceAt = null;       /* 当前面板绑定的炉 posKey（面板开着时非 null） */
```

- posKey 与 `advStations` 缓存同口径（`'x,y,z'` 字符串，`advRescanStations` 已产此键）。
- 空炉条目（三槽全 null 且 heat=0）：**save 前清扫**，防长期游玩存档膨胀。

### 1.2 存档（`adventure_world_save`）

```js
defaults: {edits: [], pos: null, hp: null, furnaces: [], livestock: {dead: []}},
encode:  (st) => ({..., furnaces: [...st.furnaces.entries()], livestock: st.livestock}),
decode:  (sv) => ({..., furnaces: new Map(sv.furnaces || []), livestock: sv.livestock || {dead: []}}),
```

- decode 后防御性修形：单炉 state 非法（缺字段/数量越界）→ 该炉整条丢弃（材料已随损坏档损失，不炸模式；mkSaveSlot 损坏回落大档先例）。
- mkSaveSlot `_v` 递增（+1）；老档 decode 补空 = 「无炉无死畜」，行为等同旧版退料口径的一次性收尾。

### 1.3 生命周期

| 时点 | 行为 |
| --- | --- |
| init | decode 恢复 Map；`advRescanStations()` 不变；烧炼节律常开 |
| update 每帧 | `advFurnaceTick(dt)`：遍历 Map 逐炉 `advSmeltStep`（炉数个位数，成本可忽略）；`smelt_*` 记账逐炉累计（谓词/账本零改动）；TTS 完成播报**只报 `advFurnaceAt` 绑定的炉**（多炉不合唱，3s 节流沿用） |
| 点击熔炉 | `advUseStation` 由 hit 坐标拼 posKey → `advFurnaceAt = posKey` → 面板绑定该炉回显；面板 DOM 刷新按绑定炉的槽签名（per-posKey sig，变化才喂） |
| 挖掉熔炉 | `advFurnaceDrop(posKey)`：三笔全额入包、满包余量 `Drops.spawn` 脚下（`advFurnaceRefund` 复用）→ `Map.delete` → 若面板正绑定该炉则顺带关闭 |
| TNT 掀炉 | 爆炸结算后统一 `advStationsSync()`：重扫站点缓存，对「旧缓存有、新缓存无」的炉位逐一 `advFurnaceDrop`（挖掘破坏也并进此口，单一权威） |
| 死亡 | 炉内容不动（持久化自然推论；背包保留口径不变） |
| 退出模式 | **只 save 不退料**——原「退出全额退料」政策退役；`advFurnaceZero` 保留为 init 防御性复位 |

### 1.4 与 MC 对照

MC 熔炉 block entity 保存物品+burn time+cook time（研究稿 §2）——本设计全量保存（含 heat/prog），重进世界**继续烧**，口径对齐。

---

## 2. F2 点燃观感

### 2.1 世界火焰（模式层，不进方块数据/存档）

- **燃烧判定**：`heat > 0 && input`（与 `advSmeltStep` 推进条件一致——无料有热不算烧）。
- **渲染**：`advFlames = Map<posKey, THREE.Sprite>`，`advFurnaceTick` 尾部做差异增删：
  - 贴图：火焰像素画 16×16（button-icons 的 flame 字符画数据源复用，CanvasTexture 管线同 tankIcon→texture 先例）；
  - 参数表：位置炉顶略偏前 `(x+0.5, y+1.05, z+0.5)`；尺寸 `0.38 ± 0.07` 正弦脉动（周期 0.9s）；additive blending + 暖色（0xffa040）；renderOrder 高于方块。
- **明确不采用**「燃烧换方块 id（lit furnace）」：会污染 edits 账本（烧炼频繁起止=存档膨胀）、连带改掉落表/站点判定/图集布局——成本高收益同（plan 决策 7）。

### 2.2 面板燃料余量条

- `mkFurnacePanel` 火焰图标升级为「火焰 + 余量条」复合件，新喂口 `setFuel(r)`（0..1，越界钳制）：
  - `r = heat / fuelUnits(炉内燃料单件热值)`——「当前这件燃料还剩几分之几」（MC 口径火焰随燃烧值衰减，研究稿 §1）；
  - 无 heat 且无燃料 → 熄灭灰显（提示「要放燃料哦」的既有引导不变）；
  - 模式层在 setSlots 同时机喂（槽签名变化必伴随热值变化，同一刷新节拍）。

---

## 3. F3 金苹果

| 项 | 值 | 出处 |
| --- | --- | --- |
| ITEMS | `golden_apple: {name:'金苹果', icon:'🍎', food:30, full:true}` | food 名义值=30（=maxHp 锚点）；`full:true` 旗标=吃了回满 |
| 食物政策 | 模式层 `advTryEat`：`it.full` → `hp = maxHp`，否则 `hp += food`（钳 maxHp） | 本游戏无饥饿系统——MC 金苹果的饥饿+吸收+再生折算成一次回满 |
| RECIPES | `{id:'golden_apple', out:{item:'golden_apple', n:1}, cost:{gold_ingot:8, apple:1}, station:'table'}` | MC 正典 8 金锭+1 苹果（研究稿 §5；一期设计稿 §3.5 兑现） |
| 图标 | ITEM_PIX 金苹果（苹果字符画换金红双色板） | 守门测试自动覆盖 |
| 首获仪式 | `advGoldRite`：金光冲击波 + `gem` 琶音 + TTS「金灿灿的苹果！挖到的金子变成宝贝啦！」 | 对齐钻石首获先例；挂 `advOnCraft` 合成入包侧首获（钻石在挖掘侧，口径各归其位） |
| 任务链 | 不加步（自由玩出口） | plan 决策 9 |

---

## 4. F4 被动动物 + 熟食链

### 4.1 MOB_TYPES 四条（config.js）

| 键 | name | hp | dmg | speed | h | hitR | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `cow` | 牛 | 15 | 0 | 1.4 | 1.3 | 0.7 | hp=MC 10×1.5 折算惯例 |
| `pig` | 猪 | 15 | 0 | 1.3 | 0.9 | 0.6 | |
| `sheep` | 羊 | 12 | 0 | 1.2 | 1.2 | 0.65 | MC 8×1.5 |
| `chicken` | 鸡 | 6 | 0 | 1.5 | 0.7 | 0.35 | MC 4×1.5 |

- 公共字段：`range: 0, cd: 0`（不攻击）、`proto: 'grazer'`、`family: ['farm_line']`、`passive: true`。
- `PROTOS` 注册表加 `'grazer'`（「无战斗」的原型占位——游荡归 Mobs 通用本能，竞技场族技能表无 farm_line 条目即不发技能）。
- 体色锚（建模票内微调）：牛棕 `[0.55,0.40,0.30]` · 猪粉 `[0.90,0.62,0.66]` · 羊白 `[0.92,0.92,0.92]` · 鸡米黄 `[0.95,0.90,0.75]`+红髯。建模走四足参数化生成器（鸡=小体型贴地短腿变体，骨架票内定）。

### 4.2 `spawnable()` 过滤口径升级（引擎侧一处小改）

```js
function spawnable() { /* 可部署=战斗怪: 排除 mix 伪类型与 passive 牧场动物 */
  return Object.keys(MOB_TYPES).filter((k) => k !== 'mix' && !MOB_TYPES[k].passive);
}
```

- 语义从「全部真怪」收窄为「可战斗部署」；竞技场 MIX_POOL 与坦克演习场 RANGE_MOB_KEYS **零改动**自然排除农场一家（两队消费方现读 spawnable）。
- `families()` 基于 spawnable——farm_line 无桶，竞技场面板零影响。
- 谱系测试「每怪必归种族」遍历 MOB_TYPES——四新条目带 family 即过。

### 4.3 恐惧游荡（模式层 `advHerdTick`，零引擎改动）

- 玩家距离 ≤2.5 格 → 缓步让开（`Mobs.move` 意图 API，speed×0.8，方向=背离玩家）；
- 受击存活 → 3 秒逃窜（speed×2.2 背向玩家；踉跄闪白复用 Mobs.hit 通用反馈）；
- 不反击、不追击、不索敌；出逃不设界（草原无墙，游荡半径自然收敛——超出渲染距离环由 Mobs 巡航态兜底）。

### 4.4 草原散布（`advBuildWorld` 构件「牧场」+ 存活记账）

- 确定性清单 `advLivestockPlan()`（SceneKit.rand 同种子口径，重进完全复现）：
  - 2 群共 10 只：牛×2+羊×2（群位 A）、猪×3+鸡×3（群位 B）；
  - 群位约束：离出生点 ≥15 格、避湖半径、平地贴地；清单条目 `{idx, type, x, y, z}`。
- 存活记账：世界档 `livestock = {dead: [idx…]}`（**只存已杀索引**——初始清单可推导，存档最小）；击杀 `onDeath` 按实体挂的 `__livestockIdx` 落账（Mobs「模式可在实体上挂私有字段」的既有许可）。
- **不重生**（MC 口径动物也不刷，研究稿 §5；牧场会空是「保护动物」的隐性教育，设计复核通过）。
- 动物游荡位置**不存档**：重进按清单原位重建（简化；MC 存实体位——差异清单记账）。

### 4.5 掉落表（MOB_DROPS 四条，儿童配平「保底 1 + 50% +1」沿用）

| 键 | rolls |
| --- | --- |
| `cow` | `[['raw_beef',1,1], ['leather',1,1]]` |
| `pig` | `[['raw_porkchop',1,1]]` |
| `chicken` | `[['raw_chicken',1,1], ['feather',1,1]]` |
| `sheep` | `[['wool',1,1], ['raw_mutton',1,1]]` |

- 击杀观感走 `CombatKit.killBurst(m, count, {verb:'收获'})`（温和口径替代「击杀」）；掉落掷骰/真空拾取/TTS 播报全走既有管线。

### 4.6 新物品 11 件 + SMELTS 4 条

| 物品 | name | food | 出处 |
| --- | --- | --- | --- |
| `raw_beef` / `cooked_beef` | 生牛肉 / 牛排 | 3 / 8 | 镜像 MC 饥饿值（研究稿 §5） |
| `raw_porkchop` / `cooked_porkchop` | 生猪排 / 熟猪排 | 3 / 8 | 同 |
| `raw_chicken` / `cooked_chicken` | 生鸡肉 / 熟鸡肉 | 2 / 6 | 同（MC 生鸡中毒 debuff→儿童版无） |
| `raw_mutton` / `cooked_mutton` | 生羊肉 / 熟羊肉 | 2 / 6 | 同 |
| `leather` | 皮革 | — | 收集品（出口三期护甲，Out of Scope） |
| `feather` | 羽毛 | — | 收集品（出口三期箭，Out of Scope） |
| `wool` | 羊毛 | — | 放置型 `block:52` |

- 现有食物锚点对照：腐肉 2 · 苹果 4 · 面包 8——熟肉 6~8 落在「比生肉好得多」档。
- `SMELTS` 增 4 条：`raw_beef→cooked_beef` 等（烧炼时长/燃料与矿物同套——MC 全配方同速，口径自洽）。
- 生肉可直接吃（回少量血）——「没有炉子也能活、有炉子活得更好」的软引导。

### 4.7 羊毛方块 52

```js
BLOCKS[52] = {name:'羊毛', all:[0.92,0.92,0.92], hard:0.8, tool:null, tier:0, drop:[['wool',1,0]]};
```

- 徒手可挖、掉自身（零惩罚）；贴图图集加一格（绒毛噪点纹理；atlas 布局测试断言 36~51 → 36~52）；
- 蓝/红羊毛（15/16）维持创造专属——「羊掉毛转入采集」只开白羊毛（染料 Out of Scope）。

---

## 5. 维持项（防漂移清单）

烧炼 2.5s/件 · 燃料热值 MC 原值（煤/木炭 8 · 木质 1.5 · 棍 0.5）· 燃料按件计费不预扣不空烧 · 断火暂停不倒退 · 自动放料最省序 · 产物开关面板自动收取 · 走近 4 格解锁 · 熔炉 8 圆石合成 · 任务链 15 步+终章零改动 · 死亡零惩罚（背包保留回出生点满血）· 儿童时限共享预算不新增账本。

## 6. 与 MC 的差异清单（附录 B 风格，改动即有意）

| 项 | MC | 本游戏 | 理由 |
| --- | --- | --- | --- |
| 烧炼耗时 | 10s/件 | 2.5s/件 | 一期拍板维持（儿童耐心） |
| 燃料预扣 | 整件预扣、空烧不退 | 按件计费、断档不白烧 | 优于 MC（研究稿 §6 建议即此） |
| 断火 | 进度 2×倒退归零 | 暂停保留 | 零惩罚 |
| 动物位置存档 | 存 | 不存，重进回散布原位 | 简化；儿童无感 |
| 动物繁殖/小麦喂 | 有 | 无 | 三期农田联动 |
| 羊毛染色 | 16 色 | 只白羊毛 | 染料不在范围 |
| 金苹果 | 饥饿 4+吸收+再生 | 吃了回满血 | 无饥饿系统的一次性折算 |
| 生鸡肉中毒 | 30% 饥饿 debuff | 无 debuff（回 2 血） | 儿童无饥饿系统 |
| 农场一家进战斗面板 | —（无此概念） | 不进竞技场/演习场 | spawnable 收窄为「可战斗部署」 |

## 7. 测试计划（node --test，零依赖）

| 文件 | 新增断言 |
| --- | --- |
| `test/adventure-core.test.js` | 多炉互不串扰（两炉异料并烧各产各的）· 炉状态存档往返（含半程 prog/heat）· 空炉条目清扫 · `advLivestockPlan` 确定性（同 seed 同清单、群位约束成立）· 恐惧游荡纯函数段（若提纯） |
| `test/adventure-mode.test.js` | 多炉面板绑定行为链 · 挖炉退料+面板连带关闭 · TNT 掀炉退料（advStationsSync diff）· 退世界不退料回归（旧断言反转）· 击杀动物掉落拾取 · 死畜记账+重进不复活 |
| `test/items-core.test.js` | 12 新物品形状（食物 food 合法、wool block=52、full 旗标） |
| `test/craft-core.test.js` | SMELTS 4 新映射 · 金苹果配方 canCraft/craft |
| `test/drops.test.js` | MOB_DROPS 4 新条目（ITEMS 交叉校验自动守门） |
| `test/blocks-fields.test.js` | 方块 52 字段齐全、atlas 布局 36~52 |
| `test/icons.test.js` | ITEM_PIX 全量覆盖（自动守门） |
| 竞技场/演习场回归 | spawnable 排除 passive 断言 · MIX_POOL/RANGE_MOB_KEYS 不含农场四键 |
| 全量 | `npm test` 全绿 · `npm run lint` 零错 · boot 冒烟（新 script 行无需——零新文件除 combat 侧无改动；若 F4 建模参数入 config 则无新行） |

## 8. 工单切分（建议，逐单 TDD）

| 单 | 交付 | 规模 | 依赖 |
| --- | --- | --- | --- |
| F1 | 多炉 Map + 世界档 furnaces 字段 + advStationsSync 退料 + 面板绑定 + TTS 绑定炉 | 中 | — |
| F2 | 火焰 Sprite 差异增删 + setFuel 余量条 | 小 | F1 |
| F3 | 金苹果（物品/配方/图标/食物政策/首获仪式） | 小 | — |
| F4 | 动物四条目+grazer+farm_line · spawnable 过滤 · 建模参数 · 散布+存活记账 · 掉落 · 11 物品 · SMELTS · 方块 52+图集 | 大 | — |
| F5 | 回归收尾：全量测试/lint/server 冒烟 · GLOSSARY（熔炉词条更新/农场一家/金苹果）· 设计稿状态注记 | 小 | F1~F4 |

F3/F4 可与 F1 并行；F4 内部可再拆「引擎数据件」与「模式装配件」两步走。
