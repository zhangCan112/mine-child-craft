# T-NPC-01 贴图管线票（gen→look 导出管线 + kit 非方形扩展 + V01 试点 + box 几何尺寸表）

> 波次：**一（立即可施工）** ｜ blocking edges：无 ｜ 粒度：一票端到端打通管线并用 V01 试点自证
> 上游权威：`docs/town-assets-requirements.md` §6（贴图基线）· `docs/design/town-villagers-visual-spec.md` §5/§6（比例与三视图）· `.scratch/town-design/gen/`（生成器唯一真源）· `notes-villagers-rollout.md`（14 件映射与 D1-D10 差异登记）
> 管线选型裁决与论证：见本目录 `README.md` §3.1（复跑 gen 导出，否决 PNG 落盘）

## 1. 目标

打通「已批产 SVG（gen 字符行像素数据）→ 游戏运行贴图」管线，并用 V01 一个实体端到端红绿自证：

1. `js/mob-look-kit.js` 扩展**非方形贴图画布**（G01 64×80 基线的前提），存量 49 造型零漂移；
2. 新增一次性导出器 `gen-export-look.js`：复跑 gen 模块，产出 mob-look 声明文件 + golden 像素摘要 fixture；
3. 落库试点 `js/mob-look/town_v01.js`（V01 阿面，村民基座 + 附件追加骨 + golden 对账）；
4. 交付 **14 实体 box 几何尺寸表**（§5，本票的规格交付物，T-NPC-02/03 直接消费）。

## 2. 文件域

| 动作 | 文件 | 说明 |
|---|---|---|
| 改 | `js/mob-look-kit.js` | 非方形画布扩展（§3.1），唯一共享引擎件改动 |
| 增 | `js/mob-look/town_v01.js` | V01 试点声明（==== 五要素头注释 + 中文注释） |
| 增 | `test/town-npc-look.test.js` | 管线红绿测试（非方形/golden 对账/导出确定性） |
| 改 | `test/mob-look.test.js` | 白名单断言改为「存量键集 ⊆ keys + 非 MOB_TYPES 键必 `town_` 前缀」（§6.4） |
| 增 | `test/fixtures/town-npc-golden.json` | 逐实体逐面像素内容摘要（导出器同步产出） |
| 增 | `.scratch/town-design/gen/gen-export-look.js` | 导出器（**不 commit**，理由见 README §5） |

**禁触**：index.html / js/town.js / js/mode-registry.js（并行线正在改）。

## 3. 接口形状

### 3.1 kit 非方形扩展（向后兼容）

- 声明兼容两态：`tex: {size: 64}`（方形，存量 48 怪 + player 零改动）与 `tex: {w: 64, h: 80}`（非方形，G01 用）。
- 内部语义：`mkSheet` 收 (w, h)；缓冲 w*h*4；`put/each/mul` 边界按轴；`textureBuffer` 返回 `{w, h, buf}`（`size` 字段保留为 `w` 兼容读或删除——以存量测试最小改动为准，票面不锁）；`material()` 画布 w×h；`slotGeo` UV 归一化按轴（`u/texW, 1 - v/texH`）；`facePixels` 行距用 w。
- **存量零漂移守门**：扩展前后既有 49 造型的 textureBuffer 必须逐字节不变（像素级既有测试全绿即证，另加一条方形声明路径回归断言）。

### 3.2 town look 声明形状（与既有 48 怪同构）

```js
MobLookKit.declare('town_v01', {
  base: ['illager'],                    // 村民血统基座（头 8×10×8+鼻+袍+overlay，见 README §5）
  debris: 0x??,                         // 碎块色（服装主色，逐角色取 §3.1 色盘）
  bones: { armL: { add: [/* 附件盒：面包篮 4×3×3 等，挂点随 gen ACC 表 */] } },
  tex: { w: 64, h: 64, paint: (g, R) => { /* 字符行图 blit 语义等价移植 */ } },
});
```

- 命名：look 键 = `town_<id 小写>`（town_v01…town_v10 / town_g01 / town_a01…town_a03）。`js/mob-look/` 文件名=declare 键带下划线已有偏离登记（conventions §6 #9），无需新增豁免。
- 附件映射规则：gen 的 ACC 附件（篮/麦束/锤/卷轴筒/钳/花束/托盘/铃铛/饲料袋/挎包）= **独立追加骨**（装饰盒，挂臂/腰/背骨），尺寸与挂点随 gen ACC 表（`gen-rollout-villagers.js`），UV 区由导出器按 kit `faceRects` 公式重排。
- **golden 对账按「每面内容」不按整幅坐标**：look 文件的 UV 布局按 kit `regions()` 公式落位，与 gen 手排坐标不同；对账单位 = 每立方体每面的像素内容摘要（逐纹素等值）。
- 表情帧：本批只画 default 帧；greet/focus/happy 帧元数据（greetMode: browlift/eyesmile）入 T-NPC-03 注册表，帧切换实现后置（README §3.2 裁决二）。

### 3.3 导出器（gen-export-look.js）

- 输入：`require('./gen-rollout-{common,villagers,golem,mobs}.js')`（复跑批产路径）。
- 输出：`js/mob-look/town_*.js`（本票只落 town_v01；其余 13 键在 T-NPC-02 铺）+ `test/fixtures/town-npc-golden.json`。
- 确定性：两次运行输出逐字节相同（复跑自证的机械保证）；导出命令写入 look 文件头注释。

## 4. 贴图基线（PO 已采纳冻结，勿改）

| 实体 | 画布 | gen 证据 |
|---|---|---|
| town_v01…town_v10 | 64×64 | `gen-rollout-villagers.js` `L.check(0,0,63,63)` |
| town_g01 | **64×80** | `gen-rollout-golem.js` `L.check(0,0,63,79)` |
| town_a01 / town_a02 | 32×32 | `gen-rollout-mobs.js` cfg.uvW/H |
| town_a03 | 48×48 | 同上（体盒 40 宽超 32，N1 已登记） |

## 5. 交付物：14 实体 box 几何尺寸表（1px = 1/16 格）

### 5.1 村民 V01~V10（共用 illager 基座，官方等比）

| 部件 | 尺寸 px | 备注 |
|---|---|---|
| 头 | 8×10×8 | pivot y24 |
| 鼻 | 2×4×2 | 前突 2px（特征点，必须保留） |
| 袍体（root） | 8×12×6 | |
| 长袍 overlay（root2） | 8×12×6 inflate 0.5 | 下摆收 y6（引擎步态可见先例） |
| 臂 ×2 | 4×12×4 | |
| 腿 ×2 | 4×12×4 | 袍摆视觉连体 |
| 整体高 | 32px = 2.0 格 | villagers 设计 §5.1 |

角色差异 = 调色板 remap（CAST pal）+ 帽饰（UV 头区表达）+ 附件追加骨。**D2 惯例**：草帽不建独立帽盒（帽冠 UV 头区 + 视图层出檐）。附件盒尺寸表随 gen ACC 表（如面包篮 4×3×3、托盘 6×1×4），导出器输出中带越界断言自证。

### 5.2 铁傀儡 G01（自有骨，无基座；对齐 town 规格，**非**官方 golem.js 的 18×12×11 身）

| 部件 | 尺寸 px | 位置 |
|---|---|---|
| 头 | 8×10×8 | y33~43，躯干顶中央 |
| 鼻 | 2×4×2 | 【打样后补已采纳】 |
| 躯干 | 14×12×8 | y21~33 |
| 髋盒 | 10×5×7 | y16~21（衔接躯干底与腿顶） |
| 臂 ×2 | 4×30×6 | 肩接 y31，下垂至 y≈1~3（长臂过膝） |
| 腿 ×2 | 6×16×5 | 间距 2px |
| 献花盒（预留） | 4×4×4 | 附件骨，显隐后置 |
| 整体高 | 43px ≈ 2.7 格 | villagers 设计 §6.7 |

### 5.3 氛围动物 ×3（自建箱式，尺寸取 gen-rollout-mobs.js boxUV 实参）

| 实体 | 部件（w×h×d） |
|---|---|
| A01 小花鸡 | 头 4×5×4 · 冠 2×1×2 · 喙 2×1×2 · 身 6×6×8 · 尾 2×2×1 · 腿 1×3×1 ×2 |
| A02 咪喵 | 头 5×5×5 · 耳 1×2×1 ×2 · 身 5×8×6 · 腿 1×5×1 ×4 · 尾 1×5×1（bind 即坐姿，gen 坐姿结构） |
| A03 小褐驼 | 身 8×7×12 · 颈 3×7×3 · 头 4×4×6 · 腿 2×9×2 ×4 · 耳 1×1×1 ×2 |

动物正面眼口径（A01/A03 正面 1×2）为 PO 已采纳的动物例外豁免，勿「修正」。

## 6. 验收标准（红绿可测）

1. **kit 非方形**：红 = 旧 kit 对 `tex:{w:64,h:80}` 无支持（测试先行断言 textureBuffer 返回 w/h）；绿 = 扩展后 `{w:64,h:80}` 画布、六面区按 w/h 出界检查、存量 49 造型全量回归绿（像素覆盖/UV 落点/黑缝/确定性测试零改动通过）+ 方形声明路径回归断言。
2. **town_v01 试点**：`MobLookKit.has('town_v01')`；自动并入 mob-look.test.js 全键循环（贴图全覆盖 alpha=255 / 六面不出界 / 几何 UV 逐顶点落已涂纹素 / 同 type 两次绘制逐字节一致）；`rig('town_v01')` 头盒 h=10/16、头槽 cubes=2（头+鼻）、身高 32/16=2.0 格；`facePixels('town_v01')` 中心像素为肤色系（g>r>b 族断言）；面包篮追加骨存在且尺寸 4×3×3。
3. **golden 对账**：`test/town-npc-look.test.js` 用 town_v01 声明数据过 kit 画布，逐面内容摘要 == `test/fixtures/town-npc-golden.json`；**手改任何贴图数据即红**（锁死「游戏贴图=已批产 SVG 像素」）。
4. **导出确定性**：导出器连跑两次，产物 diff 为空。
5. **白名单断言改源**（test/mob-look.test.js）：`MobLookKit.keys()` ⊇ MOB_TYPES∪{player}（反向守门保留：加怪漏档案仍红）；非 MOB_TYPES 键必 `town_` 前缀（防私生怪）；T-NPC-03 落地后进一步改为「town 键 ∈ 注册表键集」（消费端断言）。
6. **禁触面回归**：`npm test` 全绿 + `npm run lint` 零错；`git status` 不出现 index.html / js/town.js / js/mode-registry.js。

## 7. 会师与后继

- 产出几何尺寸表（§5）与 look 键命名（§3.2）是 T-NPC-02/03 的接口契约；若施工中被迫偏离（如 kit 兼容性），偏离回 architect 评审后同步改三票。
- V01 试点像素与打样 `sample-c-v01-mian.svg` 的逐 rect 全等已在 gen 层证毕（notes §6），本票 golden 机制是工程侧的持续等值守门。
