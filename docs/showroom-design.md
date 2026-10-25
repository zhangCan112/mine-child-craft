# 体验馆设计（showroom）— dev-only 调试模式

2026-10-25 · 配套词条：GLOSSARY「体验馆」· 共识出自 grill 会话（13 问全落）

## 1. 是什么

真游戏场景去掉跑图与挖掘：平地空场 + 预置熔炉 + 满材料背包。做出来的东西
在这里上手玩一遍找 bug——开发者亲手玩，不是自动化测试管线。v1 展品：熔炉。

红线（词条已锁）：不计儿童时限（gated:false）；不读不写任何存档键（含共享
背包 inventory_save——ADR 0002）；炉态纯内存，退出即清。

## 2. 设计点 D1 · dev 可见性

**模块**：ModeRegistry 的 dev 面。**接口**：行上一个 `dev:true` 数据字段——
仅此而已，不新增派生函数。**缝**：注册表（唯一权威）→ HTML 卡 class /
CSS 规则 / main.js 解锁，三方都是派生产物，测试对着派生端断言（三重命名
同款守门路径，§1.10 升格判据的迷你应用）。

三个候选接口：

| 方案 | 形态 | 否决理由 |
|---|---|---|
| A **选定** | 卡带 `dev` class + CSS 默认藏 + `body.dev-on` 解锁 | — |
| B | main.js 运行时藏（refreshPlayCards 同款 toggle） | defer 脚本弱网下首帧闪现；显隐逻辑进 JS |
| C | 独立 lab.html | Q7 已否决：重复主循环基建、boot 冒烟不守 script 序 |

A 的分工各一层：HTML 声明身份（`class="mode-card showroom dev"`）、CSS 拥有
默认隐藏（`.mode-card.dev{display:none}` + `body.dev-on .mode-card.dev` 还原）、
main.js 只做解锁（读 `?dev=1`，config.js `?touch=1` 同款 try/catch 惯例 →
`body.classList.add('dev-on')`）。注册表 dev 事实在 HTML class 里的那份影子
由测试守门，防漂移。

深度论证：后来者加一个 dev 模式 = 注册表一行 + 卡一片（带 dev 类），
CSS/main.js/测试零改动——接口一个布尔字段，杠杆全在派生端。

## 3. 设计点 D2 · 熔炉复用

缝已经存在且是真的：adventure-core 的烧炼纯函数族（`advSmeltStep`/
`advFurnaceRefund`）+ ModeKit `mkFurnacePanel`（纯显示+意图出口：
setSlots/setProgress/setFuel 喂显示、onAutoFill 只出 plan 不动背包）。
探险的炉与体验馆的炉是同一缝上的两个 adapter——这正是"two adapters
means a real seam"。

三个候选策略：

| 方案 | 形态 | 否决理由 |
|---|---|---|
| A **选定** | 体验馆薄接线：自持炉态 Map，update 里 advSmeltStep 推进，面板照探险同源件装配 | — |
| B | 现在就抽 mkFurnaceKit，探险+体验馆双消费 | 第二个 adapter 刚出生；两侧持久化语义不同（探险落世界档/体验馆纯内存），一个半消费者时拍接口容易拍歪；还要动探险（回归风险） |
| C | 体验馆自写简化烧炼 | 第二份烧炼实现——体验馆测的就不是探险那只炉了，违立馆目的 |

**升级触发器（显式登记，不默默欠债）**：v1 落地时若接线镜像 >80 行，或炉
行为改动需要两处同步改，立即开票抽 mkFurnaceKit（mode-kit 或独立 kit，
届时接口由两个真实消费者共同塑形）。

## 4. 模块接口与装配（js/modes/showroom.js）

**interface（对 main.js）**：`ShowroomMode = mkMode({id:'showroom', ...})`
标准模式接口 + main.js MODES 表一行；无菜单页（page:false，卡点击直进——
focus/math 同款先例，main.js:155-160 通用接线天然支持）。

**interface（对维护者）**：顶部 `SHOWROOM_STOCK` 数据表（`{id, n}[]`）——
加材料=加一行，别处零改动。初始清单从 SMELTS/FUEL 派生：烧炼全原料
（iron_ore/gold_ore/log/cobble/sand/clay_ball/四种生肉）+ 代表燃料
（煤/木板/木棍）+ 各产物一样（观感对照），总数 ≤27 槽。

**implementation（藏起来的）**：
- 装场：loadScene + SceneKit 平地草场，中心预置熔炉方块，出生点距炉 2~3 格
  （进场即在 4 格解锁圈内，advNearStation 同款判定）；
- 背包：InventoryCore.mkInventory() 内存实例 + 塞 SHOWROOM_STOCK +
  ModeKit.mkHotbar（数字键/滚轮/点选照常）；
- 熔炉：走近点击开面板（4 格门槛，探险同款 UX）；update(dt) 逐炉
  advSmeltStep，面板开时喂 setSlots/setProgress/setFuel；onAutoFill 的
  plan 由模式层经背包核心扣加执行；关面板/退模式 advFurnaceRefund 退料；
- HUD：坐标 + FPS 行（tank-range:450 先例，bug 报告口径）；
- cleanup：面板收、炉 Map 清（世界清场归 main.js switchMode 统一）。

**不变量**：文件内零 localStorage、零任何 `_save` 键字面量；不接指针锁定
（与探险同 UX）→ 无需 conventions §6 登记；挖掘/放置 v1 不接（需要时说一声，接线很薄）。

## 5. 落点清单

| 文件 | 改动 |
|---|---|
| js/mode-registry.js | 加行 `{id:'showroom', name:'体验馆', gated:false, page:false, dev:true, mood:'none'}` |
| index.html | #modeCards 末尾加 `cardShowroom` 卡（class 含 dev）；模式 script 段末尾（adventure.js 后、mode-registry.js 前）加 `js/modes/showroom.js` defer |
| css/style.css | `.mode-card.dev` 默认隐藏 + `body.dev-on` 还原两条规则 |
| js/main.js | MODES 表加 `showroom: ShowroomMode`；启动处读 `?dev=1` → body.dev-on |
| js/modes/showroom.js | 新建（==== 五要素头注释照 §1.7） |
| test/mode-registry.test.js | ① 每 dev 行断言卡在场且带 dev 类；② gated:false 清单 `['focus','math','showroom']`；③ playModeIds 五个不变（既有断言自动守） |
| test/showroom-mode.test.js | 新建（adventure-mode.test.js 先例）：注册行形状、main.js 接线正则、无 localStorage/save 键字面量（数据隔离守门，audio-registry 键扫同款）、SHOWROOM_STOCK 全 id ∈ ITEMS |
| GLOSSARY.md | 已立（体验馆） |

## 6. 显式推迟（免得日后当成漏）

- **展陈缝**：全方块/全怪物陈列是 v2 方向。v1 只有一个展品类型（熔炉），
  不建"展品框架"——一个 adapter 的缝是假缝；第二个展品类型出现时再塑形。
- **mkFurnaceKit 抽取**：见 D2 升级触发器。
- **任意发物品面板**：v2（SHOWROOM_STOCK 表先顶着）。
