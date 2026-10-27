# dev 模式能力面设计 — `?dev=1`

2026-10-28 · 配套词条:GLOSSARY「dev 模式(DEV)」· 可见性先例:showroom-design.md §2 D1

## 1. 需求与拍板

`?dev=1` 此前只做一件事:解锁 dev 向模式卡(体验馆)。本票强化为**开发模式能力面**:

1. dev 下时间限制取消——儿童时限与训练营每日限额对开发者失效,所有项目无限游玩;
2. dev 下所有训练项目/关卡全开——方便查看、debug、验收任意一关。

两项用户拍板(2026-10-28):

| 决策点 | 拍板 | 理由 |
|---|---|---|
| 写档口径 | **照常写档** | 验收时结算/落账/星级/图章全链路保真;dev 设备的档就是测试档;sync 按设备走,孩子设备档不受影响 |
| 每日体检/魔鬼特训的每日一次 | **放开,可重复进** | 验收这两个项目不等明天 |

红线不变:无参数路径行为零变化——dev 只旁路**读侧判定**(锁不锁/开不开),
任何写档逻辑(落账/推进/图章)不动。

## 2. 设计点 D1 · DEV 旗标收口 config.js

`?touch=1` 同款防御式读取(`IS_TOUCH` 先例),`config.js` 顶层:

```js
const DEV = (()=>{ try { return (location.search || '').includes('dev=1'); } catch (e) { return false; } })();
```

config.js 是全库最先加载的应用层模块,所有消费方(含最后加载的 main.js 与
运行期才执行的模式 init)都能读。原 main.js 内联的 `?dev=1` 读取拆除,
body.dev-on 接线改为 `if (DEV)` 消费旗标——参数读取单一出口,与
touch=1/IS_TOUCH 同构。测试断言同步迁移(mode-registry.test.js 对
config.js 断言读取、main.js 断言接线)。

## 3. 设计点 D2 · 预算全开(daily-budget 的 dev 选项)

三本账(play/focus/math)的**唯一闸门是 `blocked()`**,全部消费方
(卡片拦截 `playBlocked`、到量踢出 `onExhausted`、今日页锁定
camp-kit `locked()`)都从它派生——所以旁路做在核心一处,消费方零改动:

```js
mkDailyBudgets({dev: true, ...})
  → view.blocked() 恒 false
  → checkEvents 直接 return(warn/exhausted 回调永不触发)
```

- **blocked 恒 false**:卡片不拦、今日页不锁、无限游玩,一处覆盖三本账;
- **checkEvents 短路**:不出"还剩 1 分钟"toast、不触发 playTimeUp 踢出;
- **accrue/count 照常记账**(拍板"照常写档"的自然推论):训练营图章的
  当日序号取 `spentCount()`(mathSettleSave/focus 落账),家长面板聚合
  也读同一本账——断了记账就断了这些链路,而验收恰恰要测它们。

**已知影响**(拍板接受):dev 设备当天玩掉的时长/关数照常入账,同设备
再以无参数进入会被正常拦住——dev 设备的档即测试档,想还原用预算 reset
或清 `daily_budget_save`。

## 4. 设计点 D3 · 训练项目全开

| 项目 | 原判定 | dev 旁路 |
|---|---|---|
| 数学岛 120 关 | `mathLevelUnlocked = i <= mathFrontier(save)`(stars 派生) | 判定短路恒 true → 地图全亮可点;frontier 高亮/自动续程照旧 |
| 专注训练营 100 关 | 线性推进,今日页只有"第 N 关 ▶",**无关卡选择 UI** | 今日页加 dev 跳关行(输入 1..100 钳制,回车/按钮直达 `startFocusLevel(i)`),通关照常落账推进 |
| 每日体检 | `focusCheckEntry`:当日做过入口消失 | `DEV \|\|` 常显,可重复进 |
| 魔鬼特训 | `devilEntry`:当日已训→done;余额<2→quota | DEV 下视为 `{open:true}` 可重复开训;等级进退/落账照常 |

判定旁路一律放**模式层消费点**(math.js/focus.js 读全局 DEV),
纯核心(math-levels/focus-levels/devilEntry 等)零改动——零全局依赖是
`-core` 契约,DEV 旗标经注入或消费侧短路,不进纯核心。

## 5. 落点清单

| 文件 | 改动 |
|---|---|
| js/config.js | DEV 旗标(IS_TOUCH 同款 IIFE + try/catch) |
| js/daily-budget.js | `dev` 选项:blocked 恒 false + checkEvents 短路;记账照常 |
| js/main.js | setupBudgets 传 `dev: DEV`;body.dev-on 改读旗标(拆除内联 ?dev=1) |
| js/modes/math.js | mathLevelUnlocked 加 DEV 短路 |
| js/modes/focus.js | 今日页 dev 跳关行;体检/魔鬼特训入口 DEV 常显可重复 |
| css/focus.css | `.f-dev-jump` 跳关行样式 |
| test/daily-budget.test.js | dev 三件:blocked 恒 false / 回调不触发 / 记账照常 |
| test/mode-registry.test.js | dev 读取断言迁移(config.js 读 + main.js 接线) |
| GLOSSARY.md | 「dev 模式(DEV)」词条 |
| README.md | 模式表体验馆行补 dev 能力面一句 |

## 6. 显式推迟(免得日后当成漏)

- **探险地图门解锁链/任务链全开**:验收探险用体验馆(冒险全开实验室,
  showroom-design.md §7)——那是它的定位,不在本票重复造。
- **dev 专属存档隔离**(dev 档键前缀):拍板"照常写档"已排除;若日后
  dev 设备与孩子共用一台浏览器,再开此票(动作面:背包/训练营档/sync)。
- **每日体检基线/checks 落账的 dev 语义**:照常写(同一台设备反复体检
  只刷新当日 acc,基线窗口不含今天,无污染放大)。
