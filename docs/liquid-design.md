# 液体系统 · 设计定稿（liquid-design）

> 调研：[mc-liquid-research.md](mc-liquid-research.md)（下称「研究稿」，S1–S17）。
> 计划：[liquid-plan.md](liquid-plan.md)。结构决策 ADR：[adr/0004-parallel-fluid-level-plane.md](adr/0004-parallel-fluid-level-plane.md)。
> 本文是设计权威：与 MC 的全部差异登记在附录 B（§1.12 移植守则）。

## D1 · 目标与范围

引擎能力优先（共识 Q1）：水+岩浆的流动/水位/混合成为世界底层事实，探险湖与建造塘的
既有水面零改动自然激活；玩法消费（治水任务、桶与物品链、农田灌溉）列后续票，不进本期。

## D2 · 数据模型（并行水位面）

- 方块 id 不变：水恒 `B_WATER=24`、岩浆恒 `B_LAVA=25`（config BLOCKS 增 `fluid:'water'|'lava'` 旗标）。
- 新增并行平面 `fluidLv: Uint8Array(WORLD_W*WORLD_D*WORLD_H)`（voxel.js，与 worldCells 同布局同下标），编码沿用 MC liquid_depth（研究稿 §2.2）：

| lv | 含义 | amount（水量） |
|---|---|---|
| 0 | 源（source） | 8 |
| 1–7 | 流动，越远越空 | 8−lv |
| 8 | 下落柱（falling） | 8 |
| 9+ | 保留未用 | — |

- 不变量：非流体格 lv 必为 0（写纪律，setFluidLv 守卫）；`amount(lv) = lv===8 ? 8 : 8-lv`；
  渲染高度 `h = amount/9`（源 8/9≈0.889），正上方有同流体 → 整格 1.0（研究稿 §2.3，26.4 官方模型背书）。
- `world.clear()` 连带清 fluidLv；`groundTop` 不受影响（流体也占格，语义不变）。

## D3 · 参数表（config，MISSION 参数表驱动风格）

```js
FLUIDS = {
  water: {id: B_WATER, ticks: 5,  dropOff: 1, maxEmpty: 7, slopeSteps: 4, regen: true },
  lava:  {id: B_LAVA,  ticks: 30, dropOff: 2, maxEmpty: 6, slopeSteps: 2, regen: false},
};
FLUID = {budgetCells: 128, settleCap: 200000, tickHz: 20, pushSpeed: 1.39,
  swimMult: 0.55, sinkSpeed: 1.6, swimUp: 3.2, lavaMult: 0.5, lavaVert: 0.8,
  airMaxS: 15, drownDps: 2, lavaDps: 4, lavaTickS: 0.5, renderDiv: 9};
```

岩浆全球一套主世界参数（共识 Q12；下界加速不移植，附录 B）。源再生只水开（MC gamerule 默认口径）。

## D4 · 流体核心（js/fluid-core.js，引擎层纯核心）

cascade-core 同款契约：read/readLv/write/writeLv 全注入、零 THREE 零 DOM、加载零副作用、必配同名单测。
interface：

```
mkSim({read, write, readLv, writeLv, policy, params}) → sim
  · sim.notifyEdit(x,y,z)     编辑挂点：本格与六邻的流体入列（MC neighbor-changed 面）
  · sim.activate(w,h,d)       全场激活：全部流体格入列（装场期一次）
  · sim.step(nowTick, budget) 推进：出队 due≤nowTick 的条目（按 (due,入队序) 定序），
                               返回事件清单（见 D6），budget 格封顶
  · sim.pending()             队列余量（性能/测试观察口）
mkPolicy(BLOCKS) → {kindOf(id), flowable(id), washable(id)}   身份旗标派生（world.js 与单测共用）
```

### D4.1 队列与刻

- 条目 {x,y,z,due,seq}；同格去重（再排程覆盖 due，不重复入列——MC scheduled tick 语义）。
- 定序键 `(due, seq)`：排程序驱动、零墙钟——确定性重放红线（共识 Q15）。
- 节奏：水 5 ticks（0.25s/格）、岩浆 30 ticks（1.5s/格）；由 world.js 的 20tps 累积游戏刻驱动。

### D4.2 单格步进（研究稿 §3.4 伪代码的落地形态）

```
tick(cell):
  非流体(被掏空/被替换) → 丢弃条目
  lv>0 → 重算水位 recalc():
      上方同流体           → 8（下落柱）
      水平同流体邻居供水   → min(邻居amount) − dropOff，>0 才有效
      （供水的下落邻居须已落地：其脚下不可流入）
      无任何供水           → 置空气（事件 dry），六邻流体入列，return
      新lv ≠ 旧lv          → 写入（事件 flow），本格再入列
  传播：脚下可流入（空气/thin/异流体） → 向下流入(lv=8)
        否则                               → 侧铺 sides()
sides():
  坡向 slopeDirection()：四方向权重各 1000，可流入方向递归找洞
    （洞=目标脚下可流入；水 4 步/岩浆 2 步，取最短；并列最低全取）
  找到洞 → 只朝洞方向铺；没洞 → 四方向铺
  每方向：amount − dropOff ≥ 1 → 流入邻格（lv = 8−新amount）
```

「≥3 水平源同刻侧铺」的代码级规则不移植（附录 B）：悬空源先成柱、脚下被占后再侧铺，观感等价。

### D4.3 流入目标结算（spreadInto）

1. 目标是异流体 → 混合表（D4.4），事件 mix。
2. 目标是 thin 依附块 → 冲毁（事件 wash，掉落归装配层），写入流体。
3. 目标是空气 → 源再生判定（水 only，D4.5）后写入（事件 flow）。
4. 目标实心 → 无事。

流动可替换面 = `flowable(id)`：空气、thin 族（BLOCKS `thin != null`）；实心/玻璃/门面等一律不可。

### D4.4 水岩混合表（MC 规则 1–3，共识 Q11）

| 动作者 | 目标 | 结果（目标格） |
|---|---|---|
| 水 | 岩浆源 | 黑曜石(31) |
| 水 | 流动岩浆 | 圆石(4) |
| 岩浆（自正上方向下） | 水 | 石头(3) |
| 岩浆（侧向/下向） | 水 | 圆石(4) |

动作者不落格（水/岩浆都停在原位），产物为实心、lv 清 0、邻域流体入列。玄武岩/脆冰不移植（附录 B）。

### D4.5 源再生（无限水，共识 Q7；研究稿 §4 两规则）

水流入空气格时判定：①水平 ≥2 个源邻居 且 脚下不可流入 → 成源；②水平 1 个源 + 正上方源 → 成源。
岩浆不再生（regen:false）。流动块重算时不再二次判源（只在流入瞬间判，与 MC spreadTo 同构）。

## D5 · 装配（world.js）

- `const FLUID_SIM = FluidCore.mkSim({...getBlock, setBlockRaw, getFluidLv, setFluidLv...})`，
  写通道经 world.js 包装：写格/写水位后 markDirty + journal（D8）。
- `editBlock/editBlockDirty` 在级联结算后调 `FLUID_SIM.notifyEdit(x,y,z)`——与方块级联同一挂点
  （block-lifecycle D3 纪律：新破坏路径必须走两入口，流体自动跟随）。
- `pumpFluids(dt)`：主循环每帧调；dt 累积成游戏刻（FLUID.tickHz），每刻调 step(nowTick, FLUID.budgetCells)，
  空队列零成本；事件分发：flow/dry → markDirty；mix → sfx('lava_hiss')；wash → 掉落物 + 碎屑观感。
- `activateFluids()`：loadScene 收尾（rebuildAll 前）同步跑 step 循环到队列空或 settleCap 上限——
  共识 Q4(a) 全场激活的落地：进场即终态、零流动噪声、确定性（既有三场景是稳定源阵，实测 no-op）。
- 放置流体（建造调色板）：editBlock 放 B_WATER/B_LAVA 时置 lv=0（源），notifyEdit 自然触发传播。

## D6 · 事件清单（核心 → 装配，纯数据）

`{type:'flow', x,y,z, id, lv}` · `{type:'dry', x,y,z, id}` · `{type:'mix', x,y,z, from, to}` · `{type:'wash', x,y,z, id}`。
装配层职责：markDirty（含跨区块边界）、音效、掉落、journal。引擎只报事件（与方块级联清单同哲学）。

## D7 · 渲染（mesh-core + world.js）

- pack 契约扩一维：`packChunkData` 输出加 `levels:Uint8Array`（与 cells 同布局）；mesh-worker 协议同步扩（transferable 多一段）。
- 流体几何：顶面 y=h（amount/9；上方同流体=1）；侧面自 0..h，同流体邻接剔面、不透明实心邻接剔面（玻璃相邻**保留**——水族箱观感）；底面仅下方非实心非同流体时绘制。水入 glass 通道（透渲不变）、岩浆入 solid 通道（不透明、颜色不变）。
- 侧面部分高度的邻接匹配（邻格水面低 1/9 的露缝）不追求像素级吻合：侧面按本格 h 画满，接受 ≤1/9 视觉台阶（MC 同款近似，附录 B）。
- 水面动画二期（附录 B）；顶面用现行纯色（图集入集二期可接）。

## D8 · 存档与确定性重放（共识 Q15）

- edits 账本值形状：`number | {id, lv}`——非流体保持 number（旧档零迁移），流体格带 lv。
  旧档数字 24/25 兼容读：按源（lv 0）解释。
- 流体写格经 world.js 的 `setFluidEditSink(fn)` seam 入模式账本（Tank 模式钩子先例：引擎出缝、应用接线）：
  探险 init 注册 → 写 advEdits；建造注册 → 写 buildEdits[当前场景]；其余模式不接（会话内流动、不落盘）。
- 重放：两模式重放循环写双通道（id + lv），不走排程；随后 activateFluids 结算到不动点。
- 流体写**不计**任务计数/站点缓存（advRescanStations 只认站点方块 id；任务计数挂 editBlock 调用方，流体走自己的写通道）。
- 存档竞态：账本是 Map（同格最后写赢），进场结算后的新写自然覆盖——重进两次世界逐块一致。

## D9 · 玩家物理（voxel.js physics 新增流体分支，共识 Q5/Q19）

- 采样：身体=脚上 0.3 格所在格、头部=眼点所在格，各判 BLOCKS[id].fluid。
- 水内：水平速度 ×swimMult；重力减、缓沉（sinkSpeed 封顶）；跳跃键=上浮（swimUp）；入水瞬间大幅衰减垂直速度（=入水免摔伤：模式层摔伤读落地速度，水内永不达阈值）；贴水面（身在水中头在外）跳跃=跃出小跳。
- 岩浆内：水平 ×lavaMult、垂直速度 ×lavaVert 阻尼缓沉；跳跃键弱上浮。
- 水流推力：身在流动水（lv∈1..7）时按四邻水位梯度合成水平向量，pushSpeed 封顶加进位移（源/下落柱无横向推力）。
- 溺水（危险意识，共识 Q5）：头部没水累计 `playerAirS`（15s，头出水即刻回满）；耗尽 → 每秒发 `worldEvents.drownTick`（模式层扣 2 HP，探险/下界；建造无 HP 账本自然免伤=MC 创造口径）。
- 岩浆接触：身在岩浆每 0.5s 发 `worldEvents.lavaTick`（模式层扣 4 HP）；离火续燃不移植（附录 B）。
- 触屏复用既有跳跃键；游泳姿态/1×1 钻洞/冲刺游/水下挖掘减速不移植（附录 B）。

## D10 · HUD 与音效（共识 Q16/Q21）

- `mkBubbleBar`（mode-kit）：10 泡像素条挂快捷栏上方，像素图标工坊自绘（禁 emoji）；`update(airFrac)`；
  剩 3 泡 TTS 一次性提醒（「要抬头换气啦」节流自持，每次下潜至多一次）；仅 HP 模式挂载。
- audio-registry：复活死键 `splash`（入水水花，synth 回退）+ 新增 `lava_hiss`（混合嘶嘶，synth）——各一行数据，MC 持续流水白噪声不移植。
- 视觉反馈（共识 Q20）：头没水 → scene.fog 颜色/远近切水下蓝，出水复原；头入岩浆 → 橙红浓雾。FOV 变化不移植。

## D11 · 测试面

- `test/fluid-core.test.js`：传播距离/菱形、坡向收束、下落重置、断供消退、源再生两规则、混合三规则、冲毁 thin、确定性（同编辑序 → 逐格同终态）。
- `test/world-integrity.test.js` 扩流体不变量：任意编辑+结算后，全图无非源孤儿（每流动块必有供水链）、lv 编码合法、非流体格 lv=0。
- mesh 契约：water 顶面 8/9 断言更新（行为变更即设计，Q9）；pack levels 通道往返。
- boot 冒烟：fluid-core.js 进 index.html（cascade-core 之后、world.js 之前），共享词法环境顶层重名由冒烟守。

## D12 · GLOSSARY

新词条「流体核心」：引擎层纯核心，计划刻排程序 + 水位重算/坡向/混合/源再生；_Avoid_ 流水系统/水物理（散称）。
水位面/计划刻作为该词条内部术语，不单列（单文件 vocabulary，不满足 §1.8 收录判据 1）。

---

## 附录 B · 移植差异登记表（§1.12）

研究稿 §12 的 32 条伴生机制 + 本设计其余偏差，逐条拍板。「不移植」= 本仓世界不会呈现 MC 不会有的状态（缺的是 MC 有、我们没有的机制，且我们的方块集不触发它们）。

| # | 机制 | 拍板 | 依据/后果 |
|---|---|---|---|
| 1 | 挖掘触发流动 | **移植** | D5 notifyEdit，级联同挂点 |
| 2 | 放置阻挡/替换 | **移植** | 源格可被实心替换（editBlock 原语义）；放置阻断流向由重算自然改向 |
| 3 | 冲毁非固体 | **部分移植** | 只冲 thin 族（本仓无红石/地毯/雪层）；掉落照发（儿童拾取乐趣） |
| 4 | 水灭火 | 不移植 | 本仓无火方块 |
| 5 | 源再生 | **移植（水）** | D4.5 两规则；岩浆不再生（MC 默认） |
| 6 | 断供消退 | **移植** | D4.2 recalc 无供水置空气 |
| 7 | 水岩混合 | **部分移植** | 圆石/石头/黑曜石三条（D4.4）；玄武岩/脆冰无对应方块 |
| 8–10 | 冰冻/冰融/破冰成水 | 不移植 | 本仓无冰系统 |
| 11 | 农田灌溉 | 一期不移植 | 后续探险票（与农田链衔接的价值已记入研究稿） |
| 12–13 | 甘蔗需水/水生植物 | 不移植 | 无对应方块 |
| 14 | 混凝土粉固化 | 不移植 | 无对应方块 |
| 15 | 水下挖掘减速 | 不移植 | 共识 Q19（儿童操作弱，不叠加惩罚） |
| 16 | 溺水转化僵尸 | 不移植 | 怪物转化不在范围 |
| 17 | 吸水伤害特殊生物 | 不移植 | 末影人/烈焰人水伤不实现 |
| 18 | 掉落物浮运 | 二期 | 共识 Q10（一期实体物理只做玩家） |
| 19 | 摔伤重置 | **移植** | 入水衰减垂直速度（D9），等效免摔伤 |
| 20 | 推动实体 | **部分移植** | 只推玩家（共识 Q10）；推力 1.39 格/秒照抄 |
| 21 | 爆炸吸收 | 不移植 | 共识 Q22：水下爆炸照常 |
| 22 | 光照衰减 | 不移植 | 本仓无光照系统 |
| 23–25 | 海绵/滴水石/气泡柱 | 不移植 | 无对应方块与系统 |
| 26 | waterlogging | 不移植 | 无整块/非整块区分需求 |
| 27 | 红石反应 | 不移植 | 无红石 |
| 28 | 依附块脱落（水冲） | **移植** | 与 #3 同机制（thin 冲毁） |
| 29 | 下界蒸发 | 不移植 | 桶未做；岩浆全球参数 |
| 30 | 感官状态 | **部分移植** | 雾色切换（D10）；FOV −10 不移植 |
| 31 | 滑翔翼 | 不移植 | 无滑翔翼 |
| 32 | 游泳姿态/冲刺游 | 不移植 | 共识 Q19 |
| 33 | 岩浆下界加速（10 ticks/7 格） | 不移植 | 共识 Q12：全球主世界参数（慢岩浆给儿童反应时间） |
| 34 | 岩浆离火续燃 15s | 不移植 | 无火焰系统（共识 Q13） |
| 35 | ≥3 源同刻侧铺（代码级规则） | 不移植 | 悬空源先成柱再侧铺，观感等价（D4.2） |
| 36 | 水面纹理动画（still/flowing 分面帧动画） | 二期 | 共识 Q9：部分高度先行，动画后补 |
| 37 | 流水持续白噪声 | 不移植 | 共识 Q21 |
| 38 | 侧面高度邻接逐角匹配 | 不移植 | 侧面按本格 h 画满，接受 ≤1/9 台阶（MC 同款近似） |
