# 像素管线引擎底座化裁决（pixel pipeline foundation）

> 架构治理候选 9（像素管线引擎底座）的裁决票——**拍板不做**。
> 评审入口：2026-10-25 架构评审（improve-codebase-architecture 流程）卡 9（Speculative：
> 把「16×16 画布 → 关平滑放大 → dataURL」收敛为引擎层底座模块）；
> 相关词条：GLOSSARY「像素图标工坊」「按钮像素图标工坊」（分地登记句随本票补入）；
> 体例照候选 8（docs/mob-registry-unification-design.md）之后。
> 日期：2026-10-25 · 状态：已裁决不做（随票落地两处零风险微修，见 §4）。

## 1 证据摘要（行号为评审快照 42687d0，微修①落地前）

管线同形实例实为 **5 份**（「16×16 小画布 → createElement 大画布 → 关平滑 drawImage 放大
→ toDataURL」的六行收尾）：

| # | 实例 | 位置 | 备注 |
|---|------|------|------|
| 1 | 宿主管线 `drawArt`/`pixToURL64` | icons.js:925-946 | 唯一带名字的管线本体 |
| 2 | tankIcon 内联放大尾 | icons.js:29-34 | 不用自家管线、无缓存（→ 微修①） |
| 3 | focus-icons `to96` | focus-icons.js:19-26 | **96×96 载荷尺寸**，非 64 |
| 4 | mobs.face 内联放大尾 | mobs.js:1233-1239 | 自带 mobFaceCache |
| 5 | tank.icon 内联放大尾 | tank.js:711-717 | 自带 iconCache |

- **真复用方唯一**：button-icons.js:663-664 调宿主的 `drawArt`/`pixToURL64`——除它之外
  没有任何消费方跨文件复用管线。
- 另有 **9 份 3 行 `px` lambda 复制**（icons.js:16、tank.js:678、focus-icons.js:33/170/
  193/221/287/361、mobs.js:903）——「每画一图自带一支画笔」的函数局部工具，不是管线。
- **唯一真重复绘制**：tankIcon 实调 2 次（icons.js:38 入口卡 IIFE + button-icons.js:642
  委托）同图二画——**已随本票微修①消灭**（模块级 memo）。其余实例各有缓存
  （ITEM_ICON_CACHE/BTN_ICON_CACHE/mobFaceCache/iconCache/mcIconCache），页生命周期内
  零重复绘制。

## 2 裁决：不做底座化（五条理由）

1. **收益撑不起成本**。可收敛的重复 ≈ 4 份六行放大尾 ≈ 24 行；新底座全套（文件 + `====`
   五要素头 + GLOSSARY 词条 + index.html script 行 + 同名单测）60-90 行起步，LOC 净增。
2. **缓存归一不可得也不该得**。各实例缓存键域不同（物品 id/按钮名/怪型/坦克型号/训练营
   刺激名），且「同题材不同画」是故意的——focus-icons 的 creeperFace 带方向瞳 ≠
   Mobs.face('creeper') 静脸（pigFace 同理），归一缓存反而制造串图风险。
3. **观感风险唯一可感知点在载荷尺寸**。focus-icons 是 96×96 载荷，底座必须带尺寸参数
   （新接口面）——参数化的「统一管线」比 6 行内联更宽，抽象负收益。
4. **mobs.face 拆分净负**（§1.4 三问完整论证存档见 §5）。
5. **现状是有文档的地界，不是失控散写**。icons.js:9-10 头注释分地声明（怪物头像在怪物
   库、坦克型号图标在载具、专注图标在 focus-icons.js）+ GLOSSARY 两工坊词条 + mobs/tank
   头注释自述同法——冻结的稳定代码，动它需要理由，本候选没给出足够理由。

## 3 明确不动

mobs.js / tank.js / focus-icons.js 的管线代码（button-icons 已复用宿主管线，亦不动）；
任何加载序。

## 4 随票微修登记（零风险两处）

- **微修①**：icons.js tankIcon 放大尾（快照 29-34 六行）改调自家 `pixToURL64`（函数声明
  提升，文件内先调后定义安全）；加模块级 memo `tankIconCache`——同图只画一次，消灭全
  清单唯一真重复绘制。button-icons.test.js 的 `btnIcon('tank') === tankIcon()` 同一性
  断言不破坏（memo 返回同一字符串引用）。
- **微修②**：三处过期注释刷新——icons.js 依赖声明的加载序行号（改为不含行号的稳定表述
  「先于本文件(见 index.html)」避免再漂）、test/button-icons.test.js:5 同款行号表述、
  js/focus-paradigms.js:98 陈述失真（写「icons.js 先于本文件加载」，实际 icons.js 晚于
  focus-paradigms 加载，靠运行期调用 + typeof 守卫成立——改为真实口径）。

## 5 存档：mobs.face 的 §1.4 三问分析（拆分净负的完整论证）

face()（mobs.js:898-1240）343 行中 ≈93% 是 42 个 `case` 的像素画数据——一张数据表穿着
命令式外衣。按 §1.3 三问逐问：

1. **一个责任**：能过——「按怪型出 16×16 头像像素图并缓存」一句说清，无需「和/以及」。
2. **一份 vocabulary**：信号在此相抵——face 是怪物库对外概念，与 MOB_TYPES/谱系同属
   怪物谱系防错网，vocabulary 信号支持独立；但 §1.4 的合并信号同时在场：拆开会割裂
   「face 像素数据与谱系自检同一张防错网」（读 mobs 必须翻 face 文件），并把「新怪改
   3 处」推成跨 2 文件。两信号相抵时，判给现状（不动冻结代码）。
3. **一个 interface**：能过——`Mobs.face(type)` 单入口藏住 42 case。

三问中两问能过，但第 2 问的信号分析指向合并而非拆分。§1.4 判据「责任是判据，行数不是」
在此的读法：face 的责任从未含糊，343 行是数据量不是复杂度——**拆分净负**。

## 6 重开条件（满足其一即重问，不由本票顺延）

- 出现**第 6 份**内联管线复制（新消费方手写放大尾）；
- mobs.js 因其他理由动刀时，face 作为数据段随迁并把管线尾一并收敛——届时按 §1.4 重问
  face 是否独立文件（不由本候选驱动）。
