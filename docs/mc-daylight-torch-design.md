# 昼夜循环与火把光照 · 实现设计

> 需求合同：`docs/mc-daylight-torch-research.md` §5 + 2026-10-25 五项拍板：
> ①**落点**＝引擎层实现、探险模式首发（下界恒红光、训练营不受影响、其余模式恒白天，后续一行配置可开）；
> ②**节奏**＝照 MC 原版一天 20 分钟（24000 tick），配「床」跳夜；
> ③**夜的亮度**＝照 MC 深蓝夜（渲染亮度 ≈17%）；
> ④**夜间怪物**＝夜怪 + 火把防刷怪（上限 12 只、24 格出生保护圈、黎明日出温和清场）；
> ⑤**手持火把不发光**（vanilla 口径），**新增原创道具「灯笼」**：可合成、手持发光、消耗耐久。
> MC 数值依据：`docs/mc-daylight-torch-research.md`（一手取证 + 补证终态，2026-10-25）。
> 基线：分支 `mc-daylight-torch-research` @ `8664ab7`（master `dff786f` + 调研两笔），970 测试全绿。
> 本稿定稿全部数值与数据形状；伴生机制清账见 §1（conventions §1.12）；实现按 §11 工单切分，逐单 TDD。

> **实施状态注记（2026-10-26）**：D1~D7 已全量落地于 daylight-impl 分支——1049 测试全绿（基线 970 → +79），lint 三工具（ESLint/Stylelint/htmlhint）零错，GLOSSARY 增「昼夜核心（DaylightCore）/光照核心（LightCore）」词条并修订「探险模式」（_Avoid_ 撤「没有昼夜」表述）。实施口径偏差逐单登记（各单实现者已报备，出处均标在代码注释）：
>
> **D1** sleepWindow 用精确 tick 界 `SLEEP_A/SLEEP_B=12542/23460`（线性折线在 12542 处 dim≈3.39 取不到 4，派生口径会偏约 45 秒——已回填 §2.1 常量表两键）；日月贴图 world.js 引擎本地绘制（图标工坊属应用层且加载序在后，引擎不得反向依赖）；暂停（菜单/未锁定）不推进时间（MC 单机口径）。
> **D2** 光场注入形状=直接传 Uint8Array 读写一体（撤光必须读旧值，write 命名不副实）；天空区域重算改两趟扫描（单趟会读未处理列顶，开发期压测抓出并修复）；撤光触发=旧光>0 且（新格挡光或旧格是光源），透光互换零更新。
> **D3** GLSL 替换点=meshlambert_vert 的 `#include <lights_lambert_vertex>`（×π 抵消 BRDF_RECIPROCAL_PI）；回退=替换点缺失时保持 stock 着色器、不注入不炸（非 §4.2 字面的「uDim 乘 vertexColor」——场景灯已同曲线衰减，再乘会双重变暗，深夜 ≈2% 过黑；已登记 §9 #14 脚注）；uGlowPos 逐帧跟随收在 applyDaylight（当前唯一消费方探险必开 dayCycle）；test/world-vertexlight.test.js 沿 §1.9 专题命名惯例、头注释注明对应模块。
> **D4** 级联光照挂点=setBlockLit（setBlockRaw+updateEdit+脏盒记账）作为 write 回调传入 cascade-core 三入口（级联条目不回环 editBlock、落格旧值事后拿不到——单点全覆盖移除/放置/移动）。
> **D5** 清夜怪归一为 advSweepNightMobs（D6 已入库命名）；语义取「尸体一并收」（§6.2 口径）；入夜 TTS「天黑了」与首夜引导「放个火把照亮周围吧」并作单句（SpeechKit cancel-then-speak 会截断前句，机制约束下并句、语义等价；首夜标志随任务档一次性落盘，后续夜仅播「天黑了」）。
> **D6** 床边 8 格含等号（≤8，advNearStation 同口径）；passive 牧场动物不拦睡；出生点走 ADV.spawn 账本（床被挖不回退世界出生点——规格未列持久化，登记为已知边界）；床渲染分色已由 D3 兑现（pushThin 消费 faceColor）。
> **D7** items-core 新增 durOf(id) 纯函数（可耗损物单一判据，五消费点归一）；damageTool/deserialize 守卫 isTool→durOf（顺带修「灯笼耐久不随存档往返」漏洞）；advWearHeld 模式侧补 isTool 门（防挥击/挖掘双重磨损）；advChestWithdraw 同改 durOf（防箱子取出重铸满耐久）；燃尽当帧仍亮次帧熄灭；耗秒借 5s 节流随存世界档防硬关窗丢耐久。

---

## 0. 现状资产盘点（全部复用，不重造）

| 现有资产 | 位置 | 本设计的用法 |
| --- | --- | --- |
| 火把方块 `B_TORCH=48`（thin:0.5、顶面放置、失撑脱落） | config.js / adventure-core `advPlaceCheck` / cascade-core | **零改动**——放置/掉落/任务 q10 已在生产，只补 `light:14` 字段 |
| 火把配方（煤/木炭任选 + 木棍 → 4 支，手搓级） | craft-core RECIPES 第 36 行 | 零改动 |
| 顶点色通道 + 确定性明暗抖动 tint | mesh-core.js（solid/glass 每顶点写色） | 在同循环追加 `aSky/aBlock` 光照属性（§4） |
| 区块级脏队列 `markDirty/pumpRemesh` | world.js | 光照变化 → 走同一条脏队列，零新管线 |
| `packChunkData` 跨线程契约（含邻块边界圈） | voxel.js | 打包载荷追加 `sky/block` 光照圈（§3.4） |
| 下界 `applySky` 换天色先例（背景/雾/日光强度/光斑显隐） | modes/nether.js | 昼夜场景驱动复用同款手法（§2.3） |
| 巢穴刷怪节律纯函数 `advNestStep` + 壳层 `advNestTick` | adventure-core / adventure.js | 夜怪节律同构新增 `advNightStep`（§6） |
| 背包耐久管线（damageTool、耐久归零消失+TTS 安抚 D4/D9） | inventory-core / adventure.js | 灯笼耐久直接复用（§8） |
| `#fade` 全屏遮罩 / SpeechKit / showToast | index.html / speech-kit | 睡觉转场与入夜/黎明播报（§6/§7） |
| 薄块扁盒渲染 `pushThin` + 顶/侧/底分色 `faceColor` | mesh-core / config | 床=半高薄块，零新几何（§7） |
| 像素图标工坊 + 按钮像素图标工坊 | icons.js / button-icons.js | 灯笼物品图标、太阳/月亮按钮/HUD 图标（§8/§2.4） |
| 存档 `adventure_world_save`（edits 重放） | modes/adventure.js | 床经 edits 自然持久化；新增 `dayTime` 字段（§2.5） |

**引擎/应用分层红线**：时间推进、双通道光照、光照烘焙渲染、`uDim` 材质暗化全是引擎层机制；何时入夜刷怪、床的睡觉政策、灯笼耐久政策、话术与 TTS 全在模式层。

---

## 1. 伴生机制清账（conventions §1.12）

移植「昼夜 + 光照」必须连状态伴生机制一起清点，逐条决定：

| # | 伴生机制 | MC 行为 | 本设计 | 处置 |
| --- | --- | --- | --- | --- |
| 1 | 光源放置 → 增光传播 | flood fill 增量 | `LightCore` 增光 BFS + 脏区块重网格 | **移植**（§3.2） |
| 2 | 光源移除/失撑 → 撤光传播 | 撤光后重照（两趟 BFS） | 撤光 BFS；火把失撑脱落（cascade thin 已有）→ 经编辑 choke point 连带撤光 | **移植**（§3.2/§5） |
| 3 | 遮挡变化 → 阴影/透光 | 增删方块改变 sky/block 场 | 放置实心块=挡光、挖开=进光，区域重算 | **移植**（§3.3） |
| 4 | 时间推进 | dayTime 每刻 +1 | `dayTime += dt*20`，全局单份，落探险存档 | **移植**（§2.1/§2.5） |
| 5 | 天色/雾/天体随之变化 | lightmap + 天空色 | `uDim` 材质暗化 + 天色/雾插值 + 日月 Sprite 轨道 | **移植**（§2.3/§4） |
| 6 | 昼夜 ↔ 刷怪联动 | 1.18+：block light=0 且 internal sky ≤7 | 同口径一条表达式（§6.2） | **移植** |
| 7 | 昼夜 ↔ 阳光燃烧 | 骷髅僵尸日出燃烧 | 黎明清场=原地冒烟消失（不燃烧，温和口径） | **不移植**（差异 #10） |
| 8 | 床跳夜 + 出生点 | 睡 101 tick 跳 tick 0 | 转场 5s 跳 `dayTime=0`，出生点设床边，夜怪连带清场 | **移植+放宽**（§7） |
| 9 | 光源耐久/燃尽 | 火把永不灭（vanilla） | 火把不灭照抄；**灯笼**=原创消耗品（耐久秒） | **原创**（§8） |
| 10 | 天气对天空光衰减 | 雨 −3 / 雷暴 −5 | 无天气系统 | **不移植**（差异 #11） |
| 11 | 月相/幻翼/潮汐 | 月相 8 周期等 | 无 | **不移植**（差异 #11） |
| 12 | 融雪融冰（光 ≥12） | 雪层/冰融化 | 无雪/冰方块 | **不适用** |
| 13 | 作物光 ≥9 门槛 | 光照不足停长 | 麦/树苗维持纯时间生长 | **不移植**（差异 #13） |
| 14 | 光照随编辑持久化 | 光场派生不落盘 | 同——光照永远从方块场派生，存档只存 `dayTime` | **对齐** |

---

## 2. 昼夜核心（daylight-core）与场景驱动

### 2.1 新文件 `js/daylight-core.js`（引擎层纯核心，零 THREE·零 DOM，有单测）

```js
const DAYLIGHT = {
  TICKS: 24000,            // 一天 = 24000 tick = 20 分钟（20 tick/秒，dt 秒 × 20）
  NIGHT_A: 13000,          // 夜晚开始（简化口径，MC 精确值 13188/22812——差异 #15）
  NIGHT_B: 23000,          // 夜晚结束
  SLEEP_A: 12542,          // 睡觉窗口起（精确 tick 界，research §1.6 裁决——sleepWindow 不经 skyDim 派生）
  SLEEP_B: 23460,          // 睡觉窗口止（23460 起不可睡；23459 是最后一刻可睡）
  DIM_KEYS: [[0,0],[12040,0],[13670,11],[22330,11],[23961,0]], // skyDim 折线（research §1.4 internal 表反推：dim = 15 − internal）
};
// interface（全纯函数）:
//   advance(dayTime, dt) → 新 dayTime（(dayTime + dt*20) % 24000）
//   skyDim(dayTime) → 0..11      分段线性插值（正午 0 → 夜 11）
//   isNight(dayTime) → bool      dayTime ∈ [13000, 23000)
//   internalSky(skyLevel, dayTime) → max(0, skyLevel − skyDim)
//   renderBright(level) → 0.05 + 0.93 * (level/15)^1.6   // 三锚点拟合：0→5%、4→17%、15→98%（wiki 无公式，锚点见 research §2.4）
//   skyTint(dayTime) → [r,g,b]  // 白天 [1,1,1] → 夜 [0.60,0.66,1.00] 按 skyDim/11 插值（月光偏蓝）
//   skyColor(dayTime) → [r,g,b] // 天空/雾色：白日 #8fc7ff ↔ 夜 #0a1430 按 skyDim/11 插值（黄昏橙不做，差异 #16）
//   sleepWindow(dayTime) → bool // 晴天 [12542, 23459]（SLEEP_A/SLEEP_B 精确 tick 界——折线在 12542 处 dim≈3.39 取不到 4，skyDim ≥ 4 派生会偏约 45 秒；research §1.6 裁决）
```

- **tick 0 = 06:00、6000 = 正午、12000 = 日落开始、18000 = 午夜**——与 MC 完全同表（research TL;DR #1）。
- `renderBright` 的幂 1.6 是过三锚点的经验拟合：`(4/15)^1.6 ≈ 0.13 → 0.05+0.93×0.13 ≈ 17%` ✓。注释里写明「wiki 无显式公式（补证翻史定案），本曲线为锚点拟合」。

### 2.2 时间归属（引擎机制，模式给政策）

- `world.js` 顶层 `let dayTime = 0;`（跨文件可写 → `let` 规则）、`let dayCycleOn = false;`。
- `main.js` 主循环每帧：`dayCycleOn` 时 `dayTime = Daylight.advance(dayTime, dt)` 并调用 world 的 `applyDaylight()`；`dayCycleOn=false` 的模式渲染恒白天口径（§4.4 的 `uSkyFloor=15`）。
- 探险 init：`dayCycleOn = true` + 从存档恢复 `dayTime`；cleanup/switchMode 兜底：`dayCycleOn = false` + `applyDaylight` 复位白天观感（幂等）。
- 其余模式零改动即维持现状（竞技场/坦克演习场/建造/下界均不置位；下界自家用 `applySky`）。

### 2.3 场景驱动（world.js，nether `applySky` 同款手法扩展为时间函数）

每帧 `applyDaylight()`（值变化才写，颜色比较键=dayTime 量化到 50 tick）：

| 对象 | 白天 | 夜晚（skyDim=11） |
| --- | --- | --- |
| `scene.background` / `scene.fog.color` | `#8fc7ff`（现状值） | `skyColor()` 插值至 `#0a1430` |
| `AmbientLight.intensity` | 0.65（现状） | `0.65 × renderBright(15−dim)` ≈ 0.11（实体变暗：怪/Avatar/掉落物走 Lambert） |
| `sun`（DirectionalLight） | 0.75（现状） | `0.75 × (1 − dim/11)` → 0 |
| 日/月 Sprite（新增 2 个） | 太阳沿轨道 | 月亮在太阳对侧；轨道见 §2.4 |

### 2.4 日月天体（简版）

- 新增 `sunSprite` / `moonSprite` 各一：像素画贴图走按钮像素图标工坊管线（太阳=暖黄方块、月亮=灰白方块带缺口），`fog:false`、`depthWrite:false`、尺寸 ~14。
- 轨道：`a = (dayTime/24000) × 2π`；太阳位置 = 玩家 + `(cos a × 170, sin a × 170, 40)`，月亮 = 对侧（`a+π`）；`sin a < −0.15` 的一侧隐藏（地平线下）。tick 0 太阳在东方地平线、6000 当顶——与 MC 相位一致（research §1.1）。
- **不做**：星星、天球旋转、黄昏地平线橙晕（差异 #16）。
- HUD：探险 `hud()` 增加一行时段图标（太阳/月亮像素图 + 「白天/夜晚」），白天/夜晚两态，不加时分显示。

### 2.5 存档

`adventure_world_save` 增加 `dayTime` 字段（encode 直存数值、decode 缺省 0）：老档 = 从清晨开始，首个夜晚必然可经历（教学价值）。世界重进时间连续——否则孩子退出重进永远白天，火把与床失去意义。

---

## 3. 光照核心（light-core）：双通道体素光场

### 3.1 新文件 `js/light-core.js`（引擎层纯核心，零 THREE·零 DOM，有单测）

照抄 MC 双通道语义（research §2）：**方块光**（光源 BFS，曼哈顿每格 −1）+ **天空光**（heightmap 列顶 15、垂直下落不衰减、横向/向上每格 −1）。逻辑亮度 = `max(internalSky, blockLight)`。

```js
// interface（读写经注入，核心不碰全局——cascade-core 同款缝制）:
//   mkPolicy(BLOCKS) → {lightOf(id) → 0..15 发射等级, opaque(id) → bool 挡光}
//   computeAll(read, W, D, H, policy, writeSky, writeBlock)   // 全量：天空列直灌 + 横向 BFS；方块源 BFS
//   updateEdit(read, W, D, H, policy, x, y, z, oldId, writeSky, writeBlock) → 脏格包围盒
//     // 增量：方块通道增/撤两趟 BFS（半径 ≤15 盒子）；
//     //       天空通道对 x±14 × z±14 列带从列顶重灌 + 局部横向 BFS（区域重算，保不变量）
```

- **挡光规则**：`opaque(id)` = 实心且非玻璃（复用 `isOpaque` 现判）；玻璃/水/薄块/十字片全透光不衰减（MC 水有衰减——差异 #7 简化）。
- **增量正确性由不变量测试兜底**（§10）：随机编辑序列后 `updateEdit` 累计结果 === `computeAll` 重算结果（双通道逐格相等）。天空通道选「区域重算」而非增量传播，就是为了让这条不变量可证。

### 3.2 增/撤光两趟 BFS（本设计算法，非 wiki 抄录——research 附记 wiki 无算法一手描述）

- **增光**：源格写入 `max(旧值, 发射级)`，队列向外扩散：邻格 `新值 = 本值 − 1`，仅当 `新值 > 邻格旧值` 时写入并入队。
- **撤光**：把受影响的旧光值清零进撤队列，向邻格扩散「旧值 −1 ≥ 邻值」的格子一并清零；清完对边界存活光源重新增光（经典 increase/decrease 两趟，O(受影响体积)）。

### 3.3 存储与接线（voxel.js / world.js）

- `voxel.js`：`const lightSky = new Uint8Array(WORLD_W*WORLD_D*WORLD_H)`、`const lightBlock = 同尺寸`（各 786KB，与 worldCells 同址编号 `cellIdx`）；getter `lightSkyAt/lightBlockAt`（越界：sky 返 15、block 返 0）。
- **唯一 choke point = `world.js` 的 `editBlock/editBlockDirty`**（D3 纪律原样延伸）：`setBlockRaw` 之后、`applyCascade` 之前调 `LightCore.updateEdit`，返回的脏格包围盒 → `markDirty`（与既有编辑同一队列，编辑优先于距离环的既有纪律自然生效）。
- 级联连带：火把失撑脱落（thin 旗标）产生的移除条目逐格过 `updateEdit` 撤光——掉落物已有，撤光白送。

### 3.4 跨线程契约（packChunkData / mesh-worker）

`packChunkData` 载荷追加 `sky` / `block` 两片（与 cells 同形状、含同宽边界圈）——Worker 侧 `importScripts` 共读 voxel.js 自然获得取数函数，**布局即契约**（mesh-core 既有惯例零例外）。未注入光照的旧调用（理论不存在——装场必算）回落全亮，保 51 个既有测试零改动缺省兼容。

---

## 4. 网格与材质：顶点光烘焙 + Lambert 注入

### 4.1 mesh-core（纯核心，主线程/Worker 同份）

- solid/glass/tnt/atlas 四通道每顶点追加两个 `Float32` 属性：`aSky`、`aBlock`（值 = level/15）。
- 取样：普通面取**面朝向的邻格**光值（面剔除已经算邻格，同循环零额外读）；十字片/薄块（火把/草丛/床）取**自身格**——火把自身 block=14，夜间自亮 ✓。
- LOD 通道：仅加 `aSky`（按合并列的 heightmap 二值 0/15）、`aBlock=0`——远处夜色统一变暗、火把点光不进 LOD（远不可见，登记限制）；雾色随夜变化兜底观感。

### 4.2 材质注入（world.js，r128 `onBeforeCompile`）

`blockMat / atlasMat / tntMat / glassMat` 四材质统一注入：

- attributes：`aSky`、`aBlock`（vertex shader 前置声明 + varying 传递）；
- uniforms：`uDim`（当前 skyDim）、`uTorch`（火把暖色 `[1.0, 0.60, 0.37]` ≈ #f39a5e）、`uSkyFloor`（见 4.4）、`uGlowPos/uGlowR`（灯笼，§8）；
- 光照替换（r128 Lambert chunk `#include <lights_lambert_vertex>` 处替换）：

```
float lvl = max(max(aSky*15.0 − uDim, uSkyFloor), aBlock*15.0 + glowTerm);   // glowTerm = 灯笼顶点衰减项（§8.3）
vec3 lit = skyTint * bright(lvl) 当天空主导，或 uTorch * bright(aBlock*15.0 + glow) 当方块光主导
outgoing = albedo × ( skyTint·bright(skyPart) + uTorch·bright(blockPart) )
```

（实现层用两通道**叠加**而非取 max 后单 tint——天空白/蓝 × 火把暖在同格共存，观感即 MC lightmap；`bright(x) = 0.05 + 0.93·pow(x/15, 1.6)` 内联为常量多项式。）

- **回退**：若注入在目标浏览器异常（chunk 名随版本变动风险），回退方案=材质仅全局暗化（`uDim` 乘 vertexColor），火把无暖光、夜无层次——boot 冒烟 + 手测清单覆盖，回退口径登记差异表脚注。

### 4.3 实体变暗（怪/Avatar/掉落物）

怪/Avatar 走 Lambert + 场景光（§2.3 的 ambient/sun 随时间衰减）——夜间自动变暗，白天照旧；怪不参与烘焙（登记限制：火把旁的怪不变亮，v1 接受）。Sprite 系（掉落物图标/特效）无光照概念，夜间偏亮——登记限制，后续可加全局 tint。

### 4.4 非 dayCycle 模式的向后兼容

`uSkyFloor`（天空光下限 uniform）：探险=0（真实洞穴/夜）；**其余全部模式=15**——天空通道恒 98% 亮度 ≈ 现状观感，光照引擎虽全场常开（装场 `computeAll` 一次），但只有探险看得见昼夜与洞穴明暗。建造模式白得静态阴影+火把暖光（uSkyFloor=15 时火把区叠加暖色，轻微美化，零风险）。

---

## 5. 发光方块表与火把生效

### 5.1 BLOCKS 新增 `light` 字段（config.js，数据驱动）

| 方块 | id | light | 出处 |
| --- | --- | --- | --- |
| 火把 | 48 | 14 | research TL;DR #7（照亮半径 13，曼哈顿菱形） |
| 灯块 | 19 | 15 | 同级光源（MC 灯笼/萤石 15 口径） |
| 发光岩 | 34 | 15 | MC 萤石 15 |
| 岩浆 | 25 | 15 | MC 岩浆 15 |

- `test/blocks-fields.test.js` 增断言：四条 `light` 值 + 火把 48 的全部既有字段不变。
- 火把**不会烧完、不能当熔炉燃料**（vanilla 口径，research TL;DR #7）：FUEL 从 `ITEMS.fuel` 派生、火把无 fuel 字段——管线天然正确，维持项挂账防手滑。

### 5.2 生效链路（全复用，零新模式）

放置火把 → `editBlock` → `updateEdit` 增光 BFS → 脏区块重网格 → 新顶点 `aBlock` → 材质暖光。挖掉/炸掉/失撑脱落同链撤光。**探险任务 q10「合成 4 支火把」零改动**——放置后的光亮是白送的教学回报。

---

## 6. 探险模式：夜怪、防刷怪圈、黎明清场

### 6.1 adventure-core 新增（纯函数，有单测）

```js
const ADV_NIGHT = {
  CAP: 12,                 // 夜怪上限（含巢穴怪在内的 Mobs 总量上限口径：夜怪配额 = CAP − 现存怪数）
  RING_LO: 24, RING_HI: 40,// 出生环带（MC 24 格内不刷——research TL;DR #5）
  TRY_MS: 2000,            // 每 2 秒一次刷怪尝试（夜间才跑）
  POOL: [['zombie', 2], ['creeper', 1], ['spider', 1]],  // 无骷髅：夜间无远程（差异 #9）
};
// advNightCanSpawn(skyAt, blockAt, dayTime) → bool
//   // 一条表达式，MC 1.18+ 语义：blockLight === 0 且 internalSky ≤ 7（research TL;DR #4）
// advNightStep(s, dt, dayTime, read, playerPos, rnd) → {spawn?: {type,x,z}}   // s = 节拍器状态，advNestStep 同构
// advDawnSweep(dayTime) → bool   // internalSky(15) ≥ 12（= skyDim ≤ 3）跨沿检测：True=清夜怪
```

### 6.2 壳层装配（adventure.js）

- 夜间 `advNightTick(dt)`：`advNightStep` 出 spawn → `Mobs.spawn(type, x, z)`，实体挂 `__nightMob` 私有字段（Mobs 既有许可）；落点取 `groundTop+1`（spawn 现成行为）+ `advNightCanSpawn` 复核目标格。
- **火把防刷怪**：出生格 `blockLight ≥ 1` 即拒绝——火把半径 13 的菱形内天然无夜怪，「放火把守家」成立。
- **黎明清场**：`advDawnSweep` 跨沿触发：全部 `__nightMob` 原地灰白烟粒子（Fx 碎屑色 0.9）+ `Mobs.remove` + TTS「天亮了，怪物回家啦」；巢穴怪不清（脚本怪与昼夜解耦）。
- **入夜播报**：进入夜晚跨沿（dayTime 过 13000）TTS「天黑了」+ 首夜加一句「放个火把照亮周围吧」（探险存档 `firstNight` 布尔，一次性）。

---

## 7. 床（两格 × 时钟拨盘自选时刻 + 出生点；2026-10-28 时钟改版 / 2026-10-29 两格床改版）

### 7.1 数据

```js
/* config.js */
B_BED = 53;       /* 床头(枕端, 带 drop) */
B_BED_FOOT = 69;  /* 床尾(无 drop, 防双掉——B_DOOR_TOP 同款) */
BLOCKS[B_BED] = {name:'床头', top:[0.90,0.30,0.30], all:[0.75,0.22,0.22], thin:0.55, solid:false, bed:true, bedHead:true, hard:0, tool:null, tier:0, drop:[['bed',1,0]]};
BLOCKS[B_BED_FOOT] = {name:'床尾', all:[0.75,0.22,0.22], thin:0.55, solid:false, bed:true, hard:0, tool:null, tier:0};
/* items-core.js */  bed: {name:'床', block:53}
/* craft-core.js */  {id:'bed', out:{item:'bed', n:1}, cost:{wool:3, planks:3}, station:'table'}
/* texture-atlas.js */  [B_BED]: {top: T_BED_TOP, side: T_BED_SIDE, bottom: T_BED_SIDE},
                        [B_BED_FOOT]: {top: T_BED_TOP_FOOT, side: T_BED_SIDE, bottom: T_BED_SIDE}
```

- 床=**2 格 × 0.55 半高薄块**（2026-10-29 两格床改版：差异 #1 撤销，形状回归 MC 正典；高度 0.55 vs MC 0.5625 差 1px 级）。床头 53 + 床尾 69 成对（门「结构即 id」同款）；`thin` 旗标白送：失撑脱落（cascade）。
- **取向不存档**（确定性重放红线）：配对用正典形「**床头恒在轴向较小坐标端**」从世界状态唯一重建——`advBedSiteOk` 按此形落格（轴向取玩家朝向主导轴），`advBedBreakPlan` 按此形认亲（两床并排同轴相接也拆不错邻床）；床头贴图枕向由 mesh 四邻扫床尾现算旋转（`pushBedBox` rot 参数），老档 lone 床头无邻 → 缺省枕朝北。
- **观感（2026-10-28 床观感票）**：`bed` 身份旗标驱动两处——世界内图集通道走**薄块扁盒+床贴图**（床头顶「白枕+红毯」/床尾顶「全毯」/侧「毯沿+木框」按 h 比例采样，跳底面）；手持走 `mkBlockDef` 床形装配（床垫+枕头+床头/床脚板）。
- **放置/破坏**（place-kit 门同款缝）：`bed` 物品拦截 → `advBedSiteOk`（两格空气+各自下方实心+玩家不入）；挖任一半 → `advBedBreakPlan` 清另一半，恰掉 1 张（挖床头=常规掷、挖床尾=计划补发）。TNT/级联拆半可留 lone 半（门同款已知边界；lone 床尾挖掉无掉落）。
- **老档迁移**：无——老档单格床(53)=lone 床头，可睡可挖（掉 1 张），自然过渡。
- 掉落走 `BLOCKS.drop` → 掉落物管线现成；羊毛来源=F4 牧场（羊掉羊毛）✓ 原料闭环。

### 7.2 睡觉政策（adventure-core 纯函数 + 壳层观感 + daylight-core 拨盘数学）

| 条件 | 判定 | 不满足时 |
| --- | --- | --- |
| 床边无怪 | 床 8 格（水平）内无 `Mobs.list()` 存活怪（MC 口径保留，research §1.6） | toast「附近有怪物，睡不着」 |

- **时钟改版（2026-10-28 用户拍板）**：夜窗条件**撤销**（原 `Daylight.sleepWindow` 判定下线，`sleepWindow` 函数保留供未来复用）——点床不再一键睡到天亮，而是开**「时钟拨盘」面板**自选醒来时刻（原神式时间跳跃观感）。白天点床=拨盘选时刻，怪圈判定保留。
- **拨盘数学在 daylight-core**（时间轴派生量归引擎）：`clockSnap`（吸附 500 tick=游戏内 30 分钟）· `clockDelta`（前进账：表盘语义「下一次到达该时刻」，同刻=睡满一整天）· `clockPhase`（白天/傍晚/夜晚/清晨四段，断点=DIM_KEYS 转折 tick）· `clockLabel`（MC tick 0=06:00 的 HH:MM 文案）。拨盘 UI（色环表盘+拨针拖拽+预设钮+实时天色读数）在壳 `modes/adventure.js`。
- **睡着流程**：点击床 → 怪圈判据过 → 开拨盘（缺省拨到清晨 tick 0=原 MC 一键跳夜的正典等价）→ 「😴 睡觉」确认 → `#fade` 渐黑 1.5s + TTS「呼——呼——」→ 停 2s → **唤醒沿**：`dayTime` 推进到拨盘时刻（`clockDelta` 现算——渐黑期世界时间照走）+ 醒在天亮段（`!isNight`）时夜怪清场（同黎明清场观感；醒在夜里不清，夜铺怪层自洽）+ 出生点设到床边（`ModeKit.spawn` 记忆，MC 口径）→ 渐亮 + 相位分档播报（白天/清晨「睡饱啦，天亮了！」，其余「现在是 XX 呀」）。总时长 ≈5s（MC 101 tick=5.05s 的观感等价，差异 #2 登记清怪放宽）。
- **重进世界**：`dayTime` 持久化（§2.5），睡觉效果自然延续；床本身经 edits 持久化。

---

## 8. 灯笼（原创手持光源，消耗耐久）

### 8.1 数据

```js
/* items-core.js */  lantern: {name:'灯笼', dur:300}      // 300 秒手持亮 ≈ 5 分钟（一夜 8 分 20 秒，省着用能撑大半夜）
/* craft-core.js */  {id:'lantern', out:{item:'lantern', n:1}, cost:{iron_ingot:2, torch:1}, station:'table'}
```

- **items-core 小扩展**：`dur` 字段=可耗损物——`stackMax` 返 1（不可堆叠）、`mkStack` 自带满耐久（工具同款管线）。`isTool` 语义不动（灯笼不挖不砍、无工具五元组）。
- 图标：ITEM_PIX 灯笼像素画（暖黄光芯+深色骨架，工坊守门自动覆盖）；手持 def 走 `mkPlateDef` 薄片缺省（v1 不做专属提梁造型，差异 #6 登记）。
- 配方口径：MC 灯笼=8 铁粒+火把（放置型光 15、无耐久）——**本道具为原创**，铁粒本游戏不存在，折算铁锭×2（差异 #6）。

### 8.2 政策（模式层 adventure.js update）

- **只有天黑才亮才耗**：`skyDim > 0` 且快捷栏选中灯笼且耐久 >0 → 点亮；白天手持不亮不耗（孩子不会白浪费）。
- 消耗：每持满 1 秒 `damageTool(slot, 1)`（dt 累计器）；耐久归零 → 消失 + TTS 安抚「灯笼用完了，我们再做一个吧」（D4/D9 话术惯例）。
- 快捷栏耐久条、数字键/点选切换全走 mkHotbar 现成管线。

### 8.3 光照呈现（双通道，与 §4.2 uniforms 合流）

- **方块侧**：`uGlowPos`（玩家坐标）+ `uGlowR=6`，注入项 `glowTerm = max(0, 1 − dist(顶点, uGlowPos)/6) × 9`（等效等级 ~9，半径 6 的暖光晕）——顶点级衰减，体素分辨率下足够平滑。
- **实体侧**：一个 `THREE.PointLight`（#f39a5e、intensity 1.1、distance 7）挂玩家位置，点亮时开、否则关——怪/Avatar 同步被照亮。
- 引擎只提供机制（uniform/灯的 setter `setPlayerGlow(on)`），政策（何时亮）全在模式层。

---

## 9. 与 MC 的差异清单（附录 B，改动即有意）

| # | 项 | MC | 本游戏 | 理由 |
| --- | --- | --- | --- | --- |
| 1 | 床的形状 | 2 格 × 0.5625 高 | **2 格 × 0.55**（2026-10-29 两格床改版回归正典形状；高度差 1px 级） | 床头 53+床尾 69 成对（门「结构即 id」同款）；取向不存档，配对用正典形「床头在轴向较小坐标端」重建 |
| 2 | 床跳夜清怪 | 夜怪留存 | 夜怪冒烟清场 + 出生点设床边（醒在夜里不清，夜铺怪层自洽） | 儿童宽容（research §5.4 建议即此） |
| 3 | 睡觉窗口 | 内部天空光 ≤11（受天气影响） | **已撤销**（2026-10-28 时钟改版：点床开时钟拨盘自选醒来时刻，白天也可拨；`sleepWindow` 函数保留备用） | 拨盘本身就是选时刻，夜窗失去意义 |
| 3a | 睡到指定时刻 | 无（床只跳清晨） | 时钟拨盘自选（吸附 30 分钟步长；表盘语义「下一次到达该时刻」，同刻=睡满一天；拨盘数学在 daylight-core clock 族） | 原神式时间跳跃观感，2026-10-28 用户拍板 |
| 4 | 火把放置面 | 顶面/侧面壁挂 | 仅顶面 | `pushCross` 十字片无倾斜变体；`advPlaceCheck` 现成 thin 路径 |
| 5 | 手持火把 | 不发光 | 不发光（一致） | 拍板 ⑤；放火把才亮的教学点 |
| 6 | 灯笼 | 放置型方块光 15、无耐久 | **原创手持道具**：发光半径 6/等效 9 级、耐久 300s、天黑才亮才耗、铁锭 2+火把 1 合成 | 拍板 ⑤ 新增；儿童夜间行动力 |
| 7 | 水的光衰减 | 衰减 | 透光不衰减 | 简化；玻璃两版本就全透 |
| 8 | 夜怪池 | 全主世界怪 | 僵尸/苦力怕/蜘蛛 2:1:1，**无骷髅**（无远程夜袭） | 儿童夜战难度 |
| 9 | 怪物上限 | Java 70 / Bedrock 200 | 12 | 拍板 ④（research §5.4） |
| 10 | 日出对夜怪 | 骷髅僵尸燃烧、余者留存 | 原地冒烟消失 | 温和口径（不燃烧不尸体） |
| 11 | 天气/月相/幻翼 | 有 | 无 | 明确不做（research §5.4） |
| 12 | 融雪融冰（光 ≥12） | 有 | 无雪/冰方块 | 不适用 |
| 13 | 作物光 ≥9 | 有 | 麦/树苗纯时间生长 | 简化；不做光门槛 |
| 14 | 渲染亮度曲线 | 源码 lightmap | `0.05+0.93·(l/15)^1.6` 锚点拟合¹ | wiki 无公式（补证翻史定案），5%/17%/98% 三锚点 |
| 15 | 夜窗口精确值 | 13188–22812 | 13000–23000 | 整千 tick 好记，边界差 <1 秒无感 |
| 16 | 黄昏橙晕/星星/天球 | 有 | 无（天色/雾/日月两态插值） | 简版天体；后续观感票可加 |
| 17 | 时钟物品 | 有（下界乱转） | HUD 太阳/月亮图标两态 | 零文字依赖；下界无昼夜无钟 |
| 18 | 掉落物/特效 Sprite 夜间 | 受光 | 不受光（偏亮） | SpriteMaterial 无光照；登记限制后续 tint |
| 19 | LOD 远景光照 | — | 仅天空二值通道，无火把点光 | 远处雾色兜底，性能取舍 |
| 20 | 光照计算范围 | 玩家周边 | 全图常开（128×128×48 静态场） | 世界有限，装场一次算清零心跳 |

注¹（#14 · D3 实施口径）：材质注入的回退=替换点缺失时保持 stock 着色器（不注入、不炸），非 §4.2 字面的「uDim 乘 vertexColor」——场景灯已随同曲线衰减，再乘 uDim 双重变暗、深夜 ≈2% 过黑（见头部实施状态注记 D3 条）。

---

## 10. 测试计划（node --test，零依赖）

| 文件 | 新增断言 |
| --- | --- |
| `test/daylight-core.test.js`（新） | advance 回绕 · skyDim 折线关键点值（0/12040/13670/22330/23961/半程插值）· isNight 边界 · internalSky · renderBright 三锚点（5%/17%/98% 容差 ±2%）· skyTint/skyColor 端点 · sleepWindow ⇔ [12542, 23459] |
| `test/light-core.test.js`（新） | 单火把菱形光场（曼哈顿 −1、半径 13）· 双源取 max · 遮挡投阴影 · 天空列直灌/洞口横向渗透/屋檐下暗 · 撤源归零 · updateEdit 增量 === computeAll 重算（随机编辑 50 步双通道逐格相等）· 玻璃/水/薄块透光 |
| `test/voxel.test.js` | lightSkyAt/lightBlockAt 越界口径（sky 15/block 0）· packChunkData 含光照圈 |
| `test/mesh-core.test.js` | 四通道 aSky/aBlock 属性值（面取邻格、十字片取自身）· 无光照载荷回落全亮 |
| `test/adventure-core.test.js` | advNightCanSpawn 三条件（光/夜/内部天空）· advNightStep 节拍/环带/上限/池权重 · advDawnSweep 跨沿 · 睡觉窗口与床边怪判定 · 灯笼耗秒政策（夜才耗、归零消失） |
| `test/blocks-fields.test.js` | light 字段四条 · B_BED=53 字段齐全（thin/solid:false/drop） |
| `test/items-core.test.js` | lantern dur：stackMax=1、mkStack 满耐久 · bed block=53 |
| `test/craft-core.test.js` | bed/lantern 配方 canCraft/craft（含铁锭+火把成本） |
| `test/world-integrity.test.js` | 编辑序列后：全部光源格 block 光=发射级 · heightmap 以上 sky=15 · 光场与 computeAll 全等 |
| `test/boot.test.js` | 新 script 行加载序（daylight-core/light-core 在 voxel/world 之前）自动覆盖 |
| 全量 | `npm test` 全绿（基线 970 → 预计 1020+）· `npm run lint` 零错 · 探险/竞技场/建造/下界手测清单（夜间观感/火把暖光/床跳夜/灯笼/其余模式恒白天回归） |

---

## 11. 工单切分（建议，逐单 TDD）

| 单 | 交付 | 规模 | 依赖 |
| --- | --- | --- | --- |
| D1 | daylight-core + world 昼夜驱动（天色/雾/光强/日月/光斑显隐/实体暗化）+ dayTime 存档 + HUD 时段行 | 中 | — |
| D2 | light-core + voxel 光场存储 + pack 光照圈 + 装场全量计算 | 中 | — |
| D3 | mesh-core 顶点光属性 + 材质 onBeforeCompile 注入（uDim/uTorch/uSkyFloor + 回退）+ LOD 天空二值 | 中 | D2 |
| D4 | BLOCKS.light 四条 + edit choke point 增量更新 + 不变量测试（增量===全量） | 中 | D2 |
| D5 | 探险夜怪（advNightStep/池/环带/上限）+ 防刷怪圈 + 黎明清场 + 入夜/首夜 TTS | 中 | D1, D2 |
| D6 | 床（方块 53/物品/配方/顶面放置/睡觉政策/出生点/转场观感） | 中 | D1 |
| D7 | 灯笼（items-core dur 扩展/配方/像素图标/耐久政策/setPlayerGlow 双通道光照） | 中 | D1, D3 |
| D8 | 收尾：GLOSSARY（探险模式「没有昼夜」改写 + 昼夜核心/光照核心词条）· 差异表逐条核对 · 全量回归/lint/手测 · 设计稿状态注记 | 小 | D1~D7 |

D1/D2 可并行；D3/D4 跟 D2；D5~D7 三单相互独立可并行。

## 维持项（防漂移清单）

火把不烧完/不能当燃料（FUEL 派生自 fuel 字段，火把无）· 火把光 14/半径 13（菱形）· q10 任务零改动 · 24 格出生保护圈 · 灯块/发光岩/岩浆光 15 · `advPlaceCheck` thin 顶面路径不动 · 探险存档既有四键不新增（dayTime 并入 `adventure_world_save`）· 儿童时限/预算账本零改动 · 其余模式观感恒白天（uSkyFloor=15）。
