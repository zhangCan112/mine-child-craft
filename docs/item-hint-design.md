# 物品提示（点到什么读什么）— 设计定稿

> 需求来源：用户（2026-10-25）——「物品越来越多，小朋友不认识了。当我们点选物品时，
> 希望有语音和文字提示该物品是什么」。MISSION 约束「零文字依赖（图标+中文 TTS 语音）」
> 决定主通道是语音，文字是辅助通道。本文是设计定稿与实现映射；无独立调研稿
> （交互范式均为本仓既有能力的组合，无外部来源需要查证）。

## 1. 问题

物品系统已扩到 61 条注册（材料/放置型/食物/工具四类）+ 调色板 20 种方块，6 岁玩家
不认识图标也不识字。现状缺口：

- 快捷栏换选**全静默**——唯一例外是探险模式换手持**工具**时的 toast「X 在手！」
  （`advHeldChanged`，仅工具、仅文字、仅探险）；
- 面板（背包/熔炉/宝箱）里 27 格物品点击只执行搬运/放入，**没有任何"这是什么"通道**；
- 灰配方卡（缺料/未解锁站点）点击**无任何反馈**，孩子不知道为什么点不动。

## 2. 方案总览（模块与缝）

```
item-hint-registry.js ──话术数据+解析──┐
（应用层 · 清单注册表）                 │ 调用期解析(typeof 守卫)
                                       ▼
mode-kit.js  mkHotbar.select / 三面板格子点击 / 灰卡点击
（装配缝：点到什么读什么）──hint 对象──► kitHint(h, doc)
                                        ├─ 气泡：单例 div.hint-bubble 挂 body，3.2s 淡出
                                        └─ 语音：SpeechKit.speak(tts)（typeof 守卫）
```

两个模块，各答一问（codebase-design 口径：小 interface 藏大行为 = 深）：

| 模块 | interface | 藏住的 implementation |
|---|---|---|
| **ItemHintRegistry**（新文件 `js/item-hint-registry.js`） | `hintForItem(id)` · `hintForSlot(slot)` → `{name, desc, tts} \| null`；数据表 `ITEM_HINTS`/`BLOCK_HINTS` | 三型槽描述符分支、空槽判空（item 型 `cnt()≤0`）、名字从 ITEMS/BLOCKS 取、tts 拼装口径（`名字+'，'+说明`）、未收录回落名字-only |
| **mode-kit 的 kitHint**（内部函数，不进 ModeKit interface） | 内部一口 `kitHint(h, doc)` | 气泡元素生命周期（单例、按 doc 换建、淡出计时）、SpeechKit 守卫 |

**深度检验（deletion test）**：删掉注册表，61 条话术与三型槽解析会散回 mode-kit 的
每一个触发点；删掉 kitHint，气泡/淡出/语音守卫会复制到 hotbar+三面板四个调用方。
两件都挣得自己的文件/段位。

**调用方零学习**：模式层（arena/build/adventure/nether）interface 零变化——提示是
mkHotbar/mkCraftPanel/mkFurnacePanel/mkChestPanel 既有行为之上的免费增量，四个模式
不接线、不感知。

## 3. 触发面（点到什么读什么）

| # | 触发点 | 行为 | 说明 |
|---|---|---|---|
| 1 | 快捷栏点选 / 数字键 / 滚轮（`mkHotbar.select`，全模式统一漏斗） | 语音 + 气泡 | 空槽（item 型 `cnt()≤0`）静默；同格重点=再读一遍（孩子主动问"这是什么"的天然手势） |
| 2 | 背包书面板格子点击（`mkCraftPanel.cellClick`：起手/放下/搬运） | 语音 + 气泡 | 读**被点的物品**；搬运读搬走的那摞 |
| 3 | 熔炉面板：背包格点击（onPut）+ 炉三槽点击（onSlot） | 语音 + 气泡 | 读点击瞬间格里的物品（炉槽内容经 setSlots 记忆） |
| 4 | 宝箱面板：箱子格（onTake）+ 背包格（onPut） | 语音 + 气泡 | 同上 |
| 5 | **灰配方卡**点击（单击合成失败：缺料或站点未解锁） | 语音 + 气泡 | 读产物提示 + 尾句「现在还做不了哦」——原先是静默无反馈，纯增益；亮卡不抢话（合成成功自有模式层表扬 TTS「X做好啦」） |

不触发的面（有意保持安静）：拾取自动换槽（`advSyncHotbar` 走 render/refresh，非 select
——拾取自有收集播报）、模式进场初始选中、整理背包（`sortInv` 重排不是孩子的点选）。

## 4. 话术口径

- **结构**：`名字，一句儿童说明`（tts）；气泡=名字金色大字 + 说明白色小字。
- **说明句 ≤16 字**，只讲"它是什么/干什么用"，不念数值（tier/耐久/回血量不进话术——
  6 岁无感，数值归 HUD）；生肉→「烧熟了更好吃」、熟肉→「香香的」、矿物→「烧一烧变 X /
  能做工具」、站点件→「站在旁边能做什么」。
- **工具 16 条**按 阶位(木→石→铁→钻) × 品类(镐/斧/剑/锹) 成句，镐讲"能挖到什么"
  （挖矿门槛是任务链卡点），斧/锹讲"更快"，剑讲"打怪"。
- **权威分工**：名字唯一权威在 ITEMS（物品核心）与 BLOCKS（config 方块表），本表只补
  说明句——改名字不碰话术表；tts 拼装口径唯一权威在注册表。
- **收编雏形**：探险 `advHeldChanged` 的工具「在手」toast 撤除（统一提示接管全部槽型）。

## 5. 分层与加载序

- 注册表是**应用层**（儿童话术=政策，不进引擎层的 items-core/config）；零 THREE 零 DOM，
  `-registry` 契约（纯数据+纯函数+对消费端断言的单测，conventions §1.2）。
- `index.html` 加载序：`items-core.js → … → item-hint-registry.js`（插在 craft-core.js
  之后，物品数据一家挨着）→ … → `speech.js` → … → `mode-kit.js`。mode-kit 经全局名
  **调用期解析** + `typeof` 守卫（先例：math-world 的 SpeechKit 守卫、adventure 的
  `Input.refreshMain` 守卫——旧 `refreshTouchMain` 过渡别名已收口撤销）——精简装载的
  Node 单测不加载注册表也不炸，静默无提示。
- 气泡不进 index.html（mode-kit 惰性创建挂 body，同 mkp-mask 口径）；样式进
  css/style.css（`.hint-bubble`，z-index 45 高于面板遮罩 mkp-mask 的 40，面板开着也
  可见；位于 hotbar 与 #toast 上方不遮挡）。**与 #toast 两条通道互不抢占**：toast 承载
  系统消息（背包满/任务完成），气泡承载物品认知。

## 6. 测试

- **test/item-hint-registry.test.js**（新，vm 依序装 config + items-core + 注册表，
  镜像 drops.test.js 惯例）：
  - 全覆盖断言：`ITEMS` 全键 ⊆ `ITEM_HINTS`（新增物品忘写提示即红）、说明非空且 ≤24 字、
    反向无死键（ITEM_HINTS ⊆ ITEMS）；
  - `BLOCK_HINTS` 键 ⊆ BLOCKS、**覆盖两调色板全部数字方块号段 1~19**
    （对消费端断言：BUILD_PALETTE 与竞技场 HOTBAR 的数字 id ⊆ 1~19，此处以号段断言
    收口，避免为断言装载模式文件）；
  - 解析行为：hintForItem 已知/未注册/空串；hintForSlot 三型 + 空槽判空 + icon 型
    名字-only；tts 拼装（有说明=名字+逗号+说明，无说明=名字）。
- **test/mode-kit.test.js** 增补：globalThis 桩 `hintForSlot`/`hintForItem`（默认 null，
  既有测试零扰动）+ 三条行为断言（hotbar 点选出气泡、背包格点击出气泡、灰卡点击出
  气泡且不合成）；气泡计时走 t.mock.timers。
- boot 冒烟自动覆盖真实加载序；`npm run lint` 全绿收尾。

## 7. 不做的事（边界）

- 不做 hover 提示（桌面才有，主用户是触屏+点选）；
- 不做逐物品.ogg 录音（SpeechKit TTS 已是全游戏语音通道，零素材成本）;
- 不在拾取/整理/自动换槽时播报（防刷屏，见 §3 安静面）；
- 怪物/按钮图标不进本表（各有自己的词条与工坊）；
- 话术不进 items-core 引擎层（分层红线，见 §5）。

## 8. 实现清单

| 文件 | 动作 |
|---|---|
| `js/item-hint-registry.js` | 新增：ITEM_HINTS(61) + BLOCK_HINTS(19) + hintForItem/hintForSlot |
| `js/mode-kit.js` | 增 kitHint 段（解析守卫+气泡+语音）；select/面板五处触发点接线；头注释依赖表更新 |
| `js/modes/adventure.js` | 撤「在手」toast 三行（统一提示接管） |
| `index.html` | 加一行 script（craft-core 之后） |
| `css/style.css` | `.hint-bubble` 样式 |
| `test/item-hint-registry.test.js` | 新增（§6） |
| `test/mode-kit.test.js` | 桩 + 三条断言 |
| `GLOSSARY.md` | 词条「物品提示（ItemHint）」 |
