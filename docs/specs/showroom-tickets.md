# Tickets · 体验馆（showroom）— 任务图谱

- Spec：docs/specs/showroom-spec.md（ready-for-agent）
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

状态：`open` · 前置：T2 · 分支/提交：—

**做什么**（复用探险同源件，不造第二份烧炼实现）：
- 装场中心预置熔炉方块，出生点落在 4 格解锁圈内；advNearStation 同款判定
- mkFurnacePanel 面板开合：走近点击开、close 统一出口；面板开着时 update 喂 setSlots/setProgress/setFuel
- update(dt) 逐炉 advSmeltStep 推进（炉态内存 Map，posKey→状态）
- 面板"自动放入" plan 回调 → 模式层经背包核心扣加执行
- 退出/关面板 advFurnaceRefund 退料入包；cleanup 清炉态 Map（世界清场归主循环兜底清机与 clearWorld）

**验收**：烧炼 2.5s/件、产物槽异 id 占满停炉待取、断档进度保留不白烧、退炉三笔回包、退出模式干净收场；全量测试与 linter 绿。

---

## T4 · 共享熔炉 kit 抽取（spec 升级触发器已燃）

状态：`open` · 来源：spec「实现决策·升级触发器」——若熔炉接线与探险的镜像超约 80 行、或炉行为改动需要两处同步，立即开票。

**触发事实**：T3 落地后 `js/modes/showroom.js` 熔炉段与 `js/modes/adventure.js` 熔炉段的镜像接线约 134 代码行（T3 段函数体，不含 mkMode 钩子/测试挂点），超约 80 行阈值。烧炼状态机本身已同源（adventure-core 纯函数），重复的是模式层装配（面板开合/取产物/自动放料/逐炉推进喂显/退炉）。

**做什么**：两个真实消费者（adventure/showroom）共同塑形接口，把装配段抽成共享熔炉 kit（归 mode-kit 或独立 -kit 文件，按 conventions §1.10 升格判据定）；行为零变化——两边既有测试（adventure-mode.test / showroom-mode.test）与 adventure-core.test 全程守门。

**验收**：两模式熔炉行为测试零改动全绿；镜像重复段归零；接口注释（==== 五要素）落在 kit 侧。

---

## 完工（非票据）

- code-review skill 过集成分支，问题一次性修复
- 全部落灰后本文件三状态改 done
