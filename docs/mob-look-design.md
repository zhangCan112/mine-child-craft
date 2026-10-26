# 造型档案（MobLook）· 实现设计定稿

> 2026-10-26 拍板：Q1 一怪一文件+基类生成器 / Q2 参考 MC / Q3 人物按需求 / Q4 上贴图 / Q5 像素单位 /
> Q6 人物一并做；D1 接受 index.html 逐怪 script 标签 / D2 目录声明模块类型+测试断言键集 /
> D3 贴图三档 32/64/128（票②启用大怪档）/ D4 玩家保留小探险家身份、比例改官方 8/12/12px /
> D5 三票分期。调研底座：`docs/mc-mob-models-research.md`（Mojang bedrock-samples 逐文件核对）。

## 1. 深模块与缝

**造型档案（MobLook）是一个深模块**：interface 小（一怪一份声明 + 消费方三四个查询），
implementation 大（五种官方基座 · px→世界换算与 z 镜像 · 六面 UV 铺展 · 程序贴图管线 · 头像裁切）。

```
js/mob-look/<type>.js ──declare(type, def)──┐
                                            ▼
                        js/mob-look-kit.js（MobLookKit · 缝所在）
                            │ rig(type)→槽位(世界单位,+Z)      → mobs.js 合批渲染/步态（不改接口）
                            │ puppet(type)→骨组(−Z 原生)       → avatar.js 玩家傀儡
                            │ regions/textureBuffer/facePixels → 贴图/头像/测试
                            └ debrisOf(type)                   → 击杀碎块色
```

- **缝的位置**：mobs.js 的 `MOB_RIG[type]` 查找点收窄为 `rigOf(type) = MobLookKit.rig(t) || MOB_RIG[t]`
  ——已迁移怪走造型档案，未迁移怪回落内联骨架（三票过渡期的双轨）。`Mobs` 对模式的 interface 零变化。
- **删除检验**：删掉 kit，42 份声明无处消费、贴图/UV/镜像换算散回每怪文件——复杂度在缝后集中，成立。
- **两个真实 adapter**：mobs（+Z 镜像、合批实例）与 avatar（−Z 原生、Group 傀儡）同一份 rig 数据，
  证明 z 镜像缝是真的，不是假缝。

## 2. 声明 DSL（一怪一文件的全部内容）

```js
MobLookKit.declare('zombie', {
  base: ['humanoid'],            // 基座生成器 + 参数（票①: humanoid / skeleton / quad；蜘蛛苦力怕自绘骨）
  armStyle: 'zombie',            // 步态风格（mobs.js gait 既有词汇，原样透传）
  weaponArm: 'armL',             // 挥击手=持械手（可选）
  debris: 0x5e9440,              // 击杀碎块色（回落 mobs.js MOB_DEBRIS）
  scale: 1,                      // 整体缩放（凋灵骷髅 1.2 / 洞穴蜘蛛 0.7，票②用）
  tex: {size: 64, paint: (g, R) => {...}},  // 自绘贴图：画师 g + 区域表 R
  bones: {                       // 基座追加/新建骨（可选，官方 px，脸朝 −Z）
    armL: {add: [{origin: [4.5, 2, -0.5], size: [1, 11, 1], uv: [56, 0]}]},   // 例：骷髅弓
  },
});
```

- **单位**：全部几何字段是模型像素（1px = 1/16 格 = 0.0625），官方数据可直填，研究笔记即验收表（Q5）。
- **骨槽名**沿用引擎词法（root/legL/legR/armL/armR/head/wingL/wingR）——gait/render/hasSlot 零改动。
- **贴图画师 g**（texture-atlas 同惯例）：`g.fill(R, c) · g.noise(R, c, amp) · g.px(x,y,c) · g.mul(R,f) · g.rng`
  ——纯数据 RGBA 缓冲 + 种子化随机（同 type 同图），画布惰性；`R = regions(type)` 给每骨每立方体的
  六面矩形（`R.head.front` 等），画师只按语义名取区域，不抄坐标。
- **UV 铺展**（kit 头注释声明，非 MC 换皮兼容）：
  `front=[u+d,v+d,w,h] · back=[u+2d+w,v+d,w,h] · left=[u,v+d,d,h] · right=[u+d+w,v+d,d,h] ·
  top=[u+d,v,w,d] · bottom=[u+d+w,v,w,d]`，六面均按「自立方体外部看」定向；
  怪物路径 z 镜像后几何 +Z 面 ← front（官方北面=脸）。

## 3. 换算与渲染适配

- **怪（+Z）**：`pivot→[x·s, y·s, −z·s]`，盒心 `cz=(pz−(oz+d/2))·s`，`rx` 取负；`s=scale/16`。
  槽位形状与旧 MOB_RIG 同构（joint/axis/boxes），`slot.cubes` 附加 px 原始数据供几何/贴图用。
- **玩家（−Z 原生）**：不镜像，逐骨 Group（头/双臂/双腿/身），avatar 挂手持物与动画。
- **几何**：逐立方体 `BoxGeometry(尺寸+2·inflate·s)` → 按法线+位置算 as-seen UV → 合并
  pos/nor/uv/index（惰性 THREE）；**inflate 是 DSL 一等字段**（外套 0.25 / 羊毛 1.75 / 高压苦力怕 2.0）。
- **材质**：每型一份 `MeshLambertMaterial({map})`，NearestFilter + 关 mipmap（像素画风 + 防邻区串色）；
  instanceColor 着色/闪白与贴图相乘，既有 tint 管线不废。批次仍 (type×bone) InstancedMesh。
- **四足基座**：官方「竖模 bind_pose 90°」预躺平成水平盒直填（推导注释引研究笔记）；羊的羊毛 overlay
  = 身/头同盒 + inflate（1.75/0.6），是 overlay 语言的票①代表。

## 4. 票①验收清单（本票）

| 物 | 内容 |
| --- | --- |
| js/mob-look-kit.js | 基座三种 + 换算 + UV + 贴图 + 头像裁切 + 傀儡（THREE/DOM 全惰性） |
| js/mob-look/player.js | 玩家 64×64 皮肤（小探险家身份：橙帽/背包/蓝衫画进贴图），比例 8/12/12px |
| js/mob-look/{zombie,skeleton,creeper,spider,sheep}.js | 五怪（人形/细骨/自定义×2/四足+overlay 全基座覆盖） |
| js/mobs.js | rigOf 双轨 + 批次材质 per-rig + face 贴图裁切 + debris 优先（interface 不变） |
| js/avatar.js | 建模段换傀儡（官方等比+贴图），动画/装备/挥击/闪红逻辑原样 |
| index.html | mob-look-kit + 6 造型文件 script（mob-registry 之后、mobs.js 之前；boot 动态冒烟自动覆盖） |
| test/mob-look.test.js | 换算/UV/贴图覆盖/确定性/头像/键集白名单 |
| 文档 | GLOSSARY「造型档案」词条 · conventions §1.1 目录行 |

票②：按族铺完 42 怪（白名单断言翻转为全覆盖）+ 大怪 128 档 + scale 变体；
票③：拆旧（删 mobs.js MOB_RIG/face 内联 ~700 行、hum/quad 生成器）、Avatar 老建模清理。

## 5. 测试策略

- 纯逻辑单测（Node 直测）：基座→槽位换算（joint/盒心/镜像符号）、UV 矩形公式、
  区域表 **布局合法性**（不出界 + 无部分重叠，整份共享合法）、**贴图全覆盖**（每个用到的区域 alpha=255）、
  同 type 两次绘制逐字节一致、facePixels 居中裁切。
- 注册表断言：`js/mob-look/*.js 文件名 === declare 键`；键 ⊆ MOB_TYPES ∪ {player}；
  票①白名单 = 六键（票②翻转为 MOB_TYPES 全覆盖，漏迁即红）。
- 既有回归：mobs.test.js（无 MobLookKit 环境——所有引用 typeof 惰性回落）、avatar 行为面
  （nether/adventure 既有断言）、boot 全链冒烟（新 script 自动进链）。
- 视觉验收：同框截图对比（shared-monsters 同标准），玩家等比 vs 旧 Q 版。
