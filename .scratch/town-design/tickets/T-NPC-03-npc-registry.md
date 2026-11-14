# T-NPC-03 14 实体模型注册表票（js/town-npc-registry.js 唯一权威）

> 波次：**一** ｜ blocking edges：**T-NPC-02**（键集对账转绿）；红测可随 T-NPC-01 先写
> 规范依据：conventions §1.2 `-registry`（清单唯一权威：纯数据+纯函数，必有**对消费端断言**的单测）· §1.10 升格判据（该清单已出现在 ≥3 处：mob-look 文件集 / 测试白名单 / 锚点表 / 未来交互条目——必须收口）
> 协议冻结消费：`js/town-interact-core.js` 的 `TOWN_SESSION_KINDS` 五值（greet|tour|seek|help|care）

## 1. 目标

新建 `js/town-npc-registry.js`，作为 14 实体（V01~V10 十村民 + G01 铁傀儡 + A01~A03 三氛围动物）模型清单的唯一权威：命名/贴图引用/几何血统/配色出处/锚点引用/交互协议形状预留，一处收口，消费方只派生不复制。

**架构裁决（README §5）**：14 实体**不进** `MOB_TYPES`——那是战斗数值/掉落注册表（hp/dmg/family/掉落反向守门），氛围 NPC 入册会拖垮掉落表与竞技场不变量；引擎渲染管线（mob-look-kit）共享，清单独立。

## 2. 文件域

- 增：`js/town-npc-registry.js`（新 -registry 模块）
- 增：`test/town-npc-registry.test.js`（同名单测，conventions 硬性要求）
- 改：`test/mob-look.test.js`（白名单 town 键改由注册表供源——消费端断言收口）
- **禁触**：index.html / js/town.js / js/mode-registry.js；不触 mob-look-kit.js 与 town look 文件。

## 3. 接口形状

### 3.1 数据表 TOWN_NPCS（14 行纯数据，字段定型）

```js
{
  id: 'V01',                 // 资产 ID（设计文档口径）
  key: 'town_v01',           // mob-look declare 键（=文件名）
  slug: 'amian',             // 资产命名 slug（town_chr_v01_amian 口径）
  name: '阿面',              // 中文名（TTS label 同源，PO 默认名冻结）
  role: '向导型村民 / 面包向导',
  category: 'villager',      // 冻结域：villager | golem | animal
  geometry: 'illager-base',  // 几何血统引用：illager-base | golem-town | a01/a02/a03（T-NPC-01 §5 尺寸表）
  tex: { w: 64, h: 64 },     // 贴图引用（基线口径，与 look 声明一致）
  anchorId: 'npc:v01',       // 站位锚引用（T-NPC-04 的 id 空间，npc: 前缀镜像 task: 先例）
  sessionKind: 'greet',      // 交互协议形状预留（∈ TOWN_SESSION_KINDS 五值）；动物无此字段（纯氛围非交互）
  expression: { frames: ['default','greet','focus','happy'], greet: 'browlift' }, // 帧元数据，切换实现后置
  accessory: 'basket',       // gen ACC 附件名（装饰追加骨，随 look 文件）
  postureNote: '挥手迎接',    // 姿态语义备忘（裁决二：不入本批，供动画层选型票）
  paletteRef: 'gen CAST v01', // 配色出处指针（可追溯 notes §1 / spec §5）
  devNotes: 'D5 面包 UV 手排', // D1-D10 差异登记引用（notes §3）
}
// G01 特有字段（数据预留，实现后置）：
//   crack: { states: ['ok','crack1','crack2','crack3'], firstVersion: ['ok','crack2'] }  // PO 首版 2 档
//   flower: { box: [4,4,4], pose: 'reserved' }
```

G01 sessionKind 建议值 `'care'`（B7 铁傀儡关怀轻交互，dialog-prebuild §6）；十村民按角色语义给 greet/tour/seek/help（V01 迎客 greet、V04 指路 tour、V02/V03/V05 工作 help、市集系 seek/greet——票面施工时按 §5 角色表逐一定值，值域守门由测试断）。

### 3.2 派生纯函数 townNpcRegistry(list = TOWN_NPCS)

镜像 `townInteractRegistry` 风格（校验+快照、同参同输出零副作用）：

- 校验即拼写域错误（违规值进消息，构造即抛）：id/key 唯一 · category ∈ 域 · sessionKind ∈ `TOWN_SESSION_KINDS`（有则必在域）· 动物必无 sessionKind · key 必有 look（`MobLookKit.has(key)`，调用期解析）· anchorId 必在 `TOWN_NPC_ANCHORS` 在册（T-NPC-04 数据，调用期解析）· tex 与 look 声明一致。
- 快照 = 源字段透传 + 派生 `label`（name）+ `faceSrc: 'facePixels'`（头像位供给话 UI Speaker Strip，dialog-prebuild §7.2 的角色头像来源，复用 kit 头像裁切零新资产）。

### 3.3 依赖与加载序

依赖（均经全局名，调用期解析）：`MobLookKit`（引擎层，应用可依赖引擎）· `TOWN_SESSION_KINDS`（town-interact-core）· `TOWN_NPC_ANCHORS`（town-npc-anchor-core）。加载序：mob-look-kit → mob-look/town_* → town-interact-core → town-npc-anchor-core → 本文件；index.html 挂载推迟到波次二接线票（本票 Node 测试经 CommonJS 导出守卫直测）。

## 4. 验收标准（红绿可测）

1. **三向键集对账**（消费端断言，本票核心红线）：`TOWN_NPCS` 键集 == `js/mob-look/town_*.js` 文件集 == `MobLookKit.keys()` 中 `town_` 前缀键集。T-NPC-02 铺满前此断言红，铺满后绿。
2. **白名单改源**（test/mob-look.test.js）：town 键 ∈ 注册表键集（私生 look 即红）；存量 MOB_TYPES∪{player} 反向守门保留（加怪漏档案仍红）。
3. **越域抛错**：id/key 重复、sessionKind 越五值域、动物带 sessionKind、key 无 look、anchorId 不在册——各给一条坏清单断言构造即抛。
4. **协议形状**：11 条交互实体（V+G）sessionKind ∈ 五值；3 条动物无 sessionKind；`townTargetOf` 六键形状不受影响（本票不改 town-interact-core.js）。
5. **可追溯性**：14 行逐行断言 tex 基线（64×64 ×10 / 64×80 / 32×32 ×2 / 48×48）与 anchorId 前缀 `npc:`。
6. 收尾：`npm test` 全绿 + `npm run lint` 零错；禁触三文件零改动。

## 5. 备注

- 本票是纯数据件，**不接线**：TOWN_INTERACTS 增加 NPC 条目、iconKey 定源（角色头像 vs UI-01 marker）归 T-NPC-10（会师条件登记在那里）。
- 命名/TTS 用 PO 冻结默认名（README §0）；若未来 PO 推翻命名，改 TOWN_NPCS 数据行 + gen slug 同步，接口形状不动。
