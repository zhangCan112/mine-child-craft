# 九宫格工作台改造设计稿（crafting-grid）

> 依据：[mc-crafting-grid-research.md](./mc-crafting-grid-research.md)（2026-10-26，
> minecraft.wiki 一手查证，下称「研究稿」）。本稿是它的工程落地方案。

## 1. 背景与目标

现行合成是「配方书自动合成」：点配方卡选中 → 底部「合成」钮确认 → `craft()`
按 cost 计费直接扣背包（`docs/item-crafting-design.md` 一期口径）。本次改造成
MC 本家玩法：**摆放台 + 按图案摆材料**——

- 背包面板自带 **2×2 随身摆放格**（hand 级配方）；
- 走近工作台解锁 **3×3 摆放台**（table 级配方）；
- 材料按配方图案摆进格子，摆对 → 产出槽亮起 → 点产出槽合成。

成功判据：孩子能看着配方卡把材料「摆」出来（空间图案认知训练，贴合项目
注意力训练使命），且 MC 玩法口径零妥协（平移/镜像/任选全正典）。

## 2. 拍板记录（2026-10-26 用户）

| # | 拍板 | 口径 |
| --- | --- | --- |
| ① | hand 级也改摆放台 | 完全对齐 MC：随身 2×2 格，无需求近方块 |
| ② | 石砖/红砖块/剪刀/骨粉 4 条迁回 hand | 正典图案 ≤2×2（研究稿 §1.3），站点偏离清零 |
| ③ | 配方书 BE 口径：一键摆入 | 点卡=把背包材料自动摆进格子（缺的空着）；JE 预览轮换不做 |
| ④ | 连做放产出槽 | 点产出槽=合成一发；长按 0.4s 连做 0.3s/发（现有按压状态机平移） |
| ⑤ | 铁粒引入，灯笼回正典 | 用户指示「缺失物品搬过来」：ITEMS 加 iron_nugget + `1 铁锭→9 铁粒` 配方；灯笼改 `8 铁粒+1 火把`（研究稿 §4，旧差异 #6 闭环） |

防误合（2026-10-26 两步制拍板）由九宫格天然承担：**摆错图案不产出**，
确认钮退役；灰卡点击反馈通道（dimCardHint）保留到卡片上。

## 3. 数据规格：RECIPES 增 `shape` 字段

`cost` 字段退役（消除双份记账），材料计数由 shape 派生（§4 `shapeCost`）。
条目形状（研究稿 §7.1，贴 craft-core 现有风格）：

```js
/* 有序：rows = 行数组（元素 = 格子规约 | null）。格子规约 = 'id' 或候选数组 */
{id: 'pick_wood', out: {item: 'pick_wood', n: 1}, station: 'table',
 shape: {rows: [['planks', 'planks', 'planks'], [null, 'stick', null], [null, 'stick', null]]}},
{id: 'torch', out: {item: 'torch', n: 4}, station: 'hand',
 shape: {rows: [[['coal', 'charcoal']], ['stick']]}},          // 行宽可不等(裁剪语义), 候选=煤或木炭
/* 无序：any = [格子规约, ...]（多重集合恰好相等） */
{id: 'bone_meal', out: {item: 'bone_meal', n: 3}, station: 'hand',
 shape: {any: ['bone']}},
```

- rows 内部行宽允许不等长（存储按图案最小包围盒写，最直观）；匹配前统一
  补齐成矩形再裁剪外圈。
- 33 条图案数据全部从研究稿 §3 表逐条抄录（32 条现有 + 铁粒 1 条新增）。
- 站点归属：迁 4 条（②）后 **hand ⇔ 图案 ≤2×2 完全等价**，`station` 字段
  语义与现值不动（'hand' 8 条含铁粒 / 'table' 25 条）。

## 4. 匹配引擎（craft-core 纯函数，研究稿 §2 口径）

| 函数 | 语义 |
| --- | --- |
| `shapeCost(recipe)` | shape → 派生 cost 表（候选用 `[['coal','charcoal'], n]` 任选形状）；供配方卡亮灰（canCraft 沿用）与一键摆入预检 |
| `matchGrid(cells, recipe)` | cells = 长度 4（2×2）或 9（3×3）的槽堆数组（`{id,n,dur}|null`）。`any`：非空格多重集恰好相等；`rows`：双方裁剪全空外圈 → 行列数相等 + 逐格规约满足（id∈候选），不中则**每行逆序重试一次**（水平镜像，研究稿 §2.2）。图案外多余物品即不匹配（裁剪后尺寸对不上自然失败） |
| `gridCraft(cells, inv, stationOk)` | 按 RECIPES 数组序找首个 `matchGrid` 命中（§2.6 工程兜底）+ 站点门禁 → **每个占用格 n−1**（扣空清 null）→ `add(inv, out)` 入包 → 返回 `{ok, out, leftover}`；不中返回 `{ok:false}` |
| `fillGrid(inv, recipe, cells)` | BE 一键摆入（③）：先把格内现有材料退回背包（`add`，放不下的留格）→ 逐规约格从背包取 1 件放入（经 `take`/`remove` 原语，候选按序）；缺料格留空。**重复点卡=再备一套**（连做备料）。返回 `{placed, missing}` 供提示 |

背包操作全部经 inventory-core 接口（`count/take/add/remove`），
craft-core 只做编排——与现行 `craft()` 同口径，不做第二份扣料实现。

工具/可耗损物（`durOf>0`）不允许进格（UI 层拒绝 + 提示「工具不用放进
格子哦」）：图案永不引用它们，且规避开「add 经 mkStack 重铸满耐久」的
坑（箱子面板同款问题用整槽搬绕开，这里直接不收）。

## 5. 面板交互规格（mode-kit `mkCraftPanel` 改造）

布局（背包网格下方、配方卡上方插入「摆放台」行）：

```
[ 3×3 摆放格 ]  →  [ 产出槽 ]      （不在站点：外圈 5 格锁定灰显+锁图标）
```

观感对齐 MC 工作台（2026-10-26 用户验收意见）：整条摆放台行坐木质台面
（工作台方块色板 + 板条纹 + 凹凸边），摆入格/产出槽用 MC 槽口内嵌观感
（上左暗/下右亮），格间箭头为 clip-path 像素粗箭头（摆中点亮金色）；
站点外台面压暗 + 左上 2×2 金色圆角框圈出激活区。格子步进用 CSS 变量
`--mkp-cell/--mkp-bgap`（触屏档 touch.css 覆写，金框尺寸随变量派生）。

- **摆放格**：3×3 常驻渲染；`station()` 为 false 时仅左上 2×2 激活
  （锁定格点击 → TTS「走近工作台就能摆大配方啦」）。2×2 内图案平移
  照常由 matchGrid 处理。
- **点选搬运扩展**（拍板② 无拖拽口径不变）：起手源可为背包格或摆放格。
  背包格→摆放格 = 整摞入格（同 id 并堆至 64，异种拒绝收手不散）；
  摆放格→背包格 = 整摞退回（走 `add`；持有耐久物品进不了格，无重铸问题）；
  摆放格→摆放格 = 复用 moveSlot 语义。
- **产出槽**：matchGrid 命中 → 亮起显示产物预览（icon ×n）；未命中灰显。
  点击=合成一发（`gridCraft` → `onCraft({item,n,leftover})`，签名不变，
  adventure 侧 advOnCraft 零改动）；长按 0.4s 进连做 0.3s/发至材料尽
  （按压状态机从「合成」钮平移）。
- **配方卡**：点击= `fillGrid` 一键摆入（③）+ ItemHint 读产物（灰卡加
  「现在还做不了哦」尾句保留）；亮灰仍由 `canCraft(inv, recipe, stationOk)`
  驱动（canCraft 内部改吃 `shapeCost` 派生表，missing 三形状契约不变）。
  卡片页签/隐藏表（bread/bone_meal/bow_item 二期不点亮）不动。
- **关面板退料**：close 时格内材料退回背包（研究稿 §6.1 工作台口径），
  放不下的余量经 `onReturnLeft([{id,n}...])` 报模式层转掉落物
  （adventure 接 Drops.spawn，零惩罚口径；MC 2×2 格「保留摆放」不跟随，
  统一退料更简单）。

## 6. 模块改动清单

| 文件 | 改动 |
| --- | --- |
| `js/items-core.js` | +`iron_nugget` 行（纯数据：name/icon，无 block 无 fuel） |
| `js/craft-core.js` | RECIPES 全表 shape 化 + 4 条迁 hand + 灯笼回正典 + 铁粒配方；`canCraft` 改吃派生 cost；`craft()` 退役删除；新增 `shapeCost/matchGrid/gridCraft/fillGrid` |
| `js/mode-kit.js` | mkCraftPanel 改造（§5）：摆放台/产出槽/卡片一键摆入/退料；头注释五要素同步 |
| `js/modes/adventure.js` | 接线 `onReturnLeft`；头注释提及的两步制口径更新 |
| `css/style.css` · `css/touch.css` | 摆放台/产出槽/锁定格样式（沿用 .mkp-* 语言） |
| `test/craft-core.test.js` | 重写：33 条 shape 断言 + 匹配引擎全套（平移/镜像/候选/无序/负例）+ gridCraft/fillGrid |
| `test/mode-kit.test.js` | 重写 mkCraftPanel 段：摆入/合成/连做/退料/锁定格 |
| `test/items-core.test.js` · `test/adventure-mode.test.js` | 铁粒行断言；import 名单去 `craft` |
| `GLOSSARY.md` | craft-core/items-core 词条 interface 更新；「工作台级」表述随 ② 迁移更新 |

无新文件、无加载序变化（boot 冒烟不受影响）。

## 7. 任务链与文案巡查

- QUESTS（adventure-core）任务文案与 ItemHint 若有「走近工作台做 X」
  话术，对 4 条迁移配方（石砖/红砖块/剪刀/骨粉）需改为随身口径；
  骨粉/弓/面包仍二期不点亮，只查不亮。
- 灯笼 ItemHint 材料描述「2 铁锭」→「8 铁粒+火把」。
- 铁粒新增 ItemHint 词条（材料口径）。

## 8. 测试计划

纯核心（vm 直测）：shape 数据逐条断言（33 条：图案形状/产物/站点/
候选组）；matchGrid 正例（每工具模板平移+镜像、火把煤/木炭、无序骨粉、
2×2 台摆 1×2 竖排）与负例（图案外多余物、异种材料、3 宽图案进 2×2 台、
垂直翻转不匹配）；gridCraft（每占用格扣 1、连做扣空清格、leftover、
站点门禁、RECIPES 序兜底）；fillGrid（整套装入、缺料留空、重复点备两套、
格内先退回）。

面板（mode-kit.test.js 现有 DOM 桩口径）：摆放格渲染/锁定态、点卡摆入、
产出槽单击与长按连做（计时器桩）、关面板退料回调、 Esc 出口不回归。

收尾：`npm test` 全绿 + `npm run lint` 零错误（AGENTS.md 收尾门槛）。

## 9. 偏离登记影响

- 站点归属 4 条偏离 → 迁移后**清零**（conventions.md §6 如有登记则销项）。
- 灯笼「2 铁锭折算」差异 #6 → 铁粒引入后**闭环**，注释与设计稿同步。
- 新增已知名差异：MC 2×2 格关背包保留摆放 vs 我们统一退料（§5）；
  JE 点卡预览/轮换 vs 我们 BE 一键摆入——两条均为儿童简化，登记 §6。
