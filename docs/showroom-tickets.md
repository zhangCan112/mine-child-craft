# Tickets · 体验馆（showroom）— 任务图谱

> 生命周期：已完工 — 施工期工件，仅作历史依据；行为权威见 [showroom-design.md](showroom-design.md) 与 [adr/0005-unified-adventure-shell-dev-profile.md](adr/0005-unified-adventure-shell-dev-profile.md)

- Spec：docs/showroom-spec.md（ready-for-agent）
- 设计：docs/showroom-design.md · 术语：GLOSSARY「体验馆」
- 集成分支：`showroom` · 关单=把状态改为 `done` 并注明分支/提交

## 任务图谱（阻塞关系）

```
T1 骨架贯通+dev可见性 ──▶ T2 材料台+守门测试 ──▶ T3 熔炉展品
```

前端唯一：T1（T2、T3 依次解锁；三者都改 showroom.js，不可并行）。

---

## T1 · 骨架贯通 + dev 可见性机制

状态：`done` · 分支/提交：`showroom-t1` @ `8314977ad5d4e437180a09ebc45fdf70848fcb11`

**做什么**：体验馆从"URL 参数"到"能进一个平地空场"的最小贯通：
- 模式注册表加行 `{id:'showroom', name:'体验馆', gated:false, page:false, dev:true, mood:'none'}`（dev 为新字段）
- 主菜单容器末尾加卡（`cardShowroom`，class 含 `mode-card showroom dev`，图标🧪文案"体验馆"）；模式 script 段末尾（adventure.js 之后、mode-registry.js 之前）加 showroom.js
- 样式表两条规则：`.mode-card.dev` 默认隐藏（构造性防闪现）+ `body.dev-on` 还原（还原值与 .mode-card 常规显示模型一致）
- 主循环：MODES 表加 `showroom: ShowroomMode,`（两空格缩进、行尾逗号——新影子清单断言锁格式）；启动处读 `?dev=1`（config.js 读 `?touch=1` 的 try/catch 同款惯例）→ body 加 `dev-on`
- showroom.js 最小壳：mkMode 标准壳 + loadScene/SceneKit 平地草场 + 出生点 + HUD 坐标与 FPS 行（坦克演习场先例）
- mode-registry.test 扩展：每 dev 行断言卡在场且带 dev 类、样式表含默认隐藏与还原规则；gated:false 清单更新为 `['focus','math','showroom']`；游玩模式五员断言不动

**验收**：`?dev=1` 见卡→点击直进平地空场；不带参数时卡不可见且不闪现；boot 动态探针（每模式 init 可调、switchMode 全 id 不抛）过；npm test 全绿 + 三 linter 全 0。

**红线**：showroom.js 零 localStorage、零存档键字面量；不锁指针；中文注释 + ==== 五要素头注释。

---

## T2 · 材料台 + 守门测试

状态：`done` · 前置：T1 · 分支/提交：`showroom-t2` @ `fcbac2baceca3f75211daff9f31ff6411cb6d032`

**做什么**：
- showroom.js 顶部 `SHOWROOM_STOCK` 数据表（行形状 `{id, n}`）：初始清单=SMELTS 全原料+代表燃料（煤/木板/木棍）+各产物对照样，总数 ≤27
- 背包核心 mkInventory 内存实例进场装满（不用背包壳、不碰共享背包）
- 模式面板 kit 的 mkHotbar 接快捷栏（数字键/滚轮/点选）
- 新守门测试 test/showroom-mode.test.js（adventure-mode.test 先例）：模式文件可 require、注册行形状断言、main.js 接线正则、**数据隔离键扫**（无 localStorage/存档键字面量，audio-registry 键扫同款手法）、SHOWROOM_STOCK 全 id ∈ ITEMS

**验收**：进场 27 槽预装材料、数字键/滚轮切换顺手；守门测试红转绿后全量绿。

---

## T3 · 熔炉展品

状态：`done` · 前置：T2 · 分支/提交：`showroom-t3` @ `e81522715ddca2860005d07d9ef1c5a64d0fca5f`

**做什么**（复用探险同源件，不造第二份烧炼实现）：
- 装场中心预置熔炉方块，出生点落在 4 格解锁圈内；advNearStation 同款判定
- mkFurnacePanel 面板开合：走近点击开、close 统一出口；面板开着时 update 喂 setSlots/setProgress/setFuel
- update(dt) 逐炉 advSmeltStep 推进（炉态内存 Map，posKey→状态）
- 面板"自动放入" plan 回调 → 模式层经背包核心扣加执行
- 退出/关面板 advFurnaceRefund 退料入包；cleanup 清炉态 Map（世界清场归主循环兜底清机与 clearWorld）

**验收**：烧炼 2.5s/件、产物槽异 id 占满停炉待取、断档进度保留不白烧、退炉三笔回包、退出模式干净收场；全量测试与 linter 绿。

---

## T4 · 共享熔炉 kit 抽取（spec 升级触发器已燃）

状态：`done` · 分支/提交：`t4-furnace-kit` @ 见合并后 master（2026-10-25 完工）

**触发事实**：T3 落地后 `js/modes/showroom.js` 熔炉段与 `js/modes/adventure.js` 熔炉段的镜像接线约 134 代码行（T3 段函数体，不含 mkMode 钩子/测试挂点），超约 80 行阈值。烧炼状态机本身已同源（adventure-core 纯函数），重复的是模式层装配（面板开合/取产物/自动放料/逐炉推进喂显/退炉）。

**做什么**：两个真实消费者（adventure/showroom）共同塑形接口，把装配段抽成共享熔炉 kit（归 mode-kit 或独立 -kit 文件，按 conventions §1.10 升格判据定）；行为零变化——两边既有测试（adventure-mode.test / showroom-mode.test）与 adventure-core.test 全程守门。

**附记（code-review 修复期 2026-10-25 落）**：
- **adventure 侧产物槽喂显错位（既有行为，未越界改）**：`js/modes/adventure.js` 把核心炉态直喂 `setSlots(f)`（产物字段 `out`），而 mkFurnacePanel 契约读 `s.output`（mode-kit.test 锁形状）——产物槽有锭也不显示。showroom 侧已在模式层桥接（`showroomFurnSlots`，out→output）；kit 抽取时应把桥接收进 kit（或面板改读 `out`），adventure 侧随抽取一并消化并补断言。
- **showroomFuelR 显示层小镜像归本票**：镜像探险 `advFurnaceFuelR` 的纯显示计算（热值余量比），kit 抽取时一并上收，不单开票。

**验收**：两模式熔炉行为测试零改动全绿；镜像重复段归零；接口注释（==== 五要素）落在 kit 侧。

**落地记录（2026-10-25）**：`js/furnace-kit.js`（mkFurnaceStation 一工厂，消费方政策全走回调缝）+ 契约单测 `test/furnace-kit.test.js`（13 条，含产物槽桥接回归锁/adventure 历史错位随抽取修复）；adventure.js 与 showroom.js 熔炉装配段归零为薄委托 + 政策回调（两模式既有行为断言零改动，仅各自引导段加一行 FurnaceKit 全局铺装——与浏览器 script 序同义）。落点取舍：独立 `-kit` 文件而非并入 mode-kit（mode-kit 不引探险核心、面板显示件与交互装配分离，§1.2 后缀语义本位）。

---

## 后续票池（只登记不抽码，不入本 spec 关单范围）

- **fakeEl 测试桩已 6 份拷贝**：adventure-mode / focus-paradigms / mode-kit / nether-mode / showroom-mode / tank-mode 各持一份同构假 DOM 桩——test-kit 共享候选，攒到过 conventions §1.10 升格判据再动，本票不动测试基建。
- **showroomFuelR 显示层小镜像**：已随 T4 上收为共享熔炉 kit 的 furnaceFuelR（2026-10-25 完工）。
- **`includes('dev=1')` 宽匹配**：main.js 解锁参数用子串匹配（理论上命中 `?xdev=1` 之类），与 config.js `?touch=1` 的防御式读取惯例同款口径一致——仅记录不改；要收紧就两个参数一起过 §1.10，单改一处反而不一致。

---

## 完工（非票据）

- code-review skill 过集成分支，问题一次性修复
- 全部落灰后本文件三状态改 done
