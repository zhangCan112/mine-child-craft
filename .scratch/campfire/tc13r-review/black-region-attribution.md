# T-C13-R 复验 · 熄态脚下黑区归因报告（design-lead 管线复验，2026-11-23）

## 0. 一句话结论

**熄态篝火脚下黑框 = 篝火特有稳定态渲染 bug（非撤光中间态、非探针产物）**——
`solid:true ∧ thin:0.4375` 组合触发「thin 豁免剔面」×「挡光格自身格恒 0」两条通用语义的
乘积缺口：沙壁朝篝火格的整格侧面照绘，面光采样到熄态篝火格（0/0）→ 渲染纯黑。
燃态同缺口被自身 light 15 掩盖。**T-C13-R 管线复验不 PASS，打回修黑区**（其余复验面全绿，见 §4）。

## 1. 现象定性（证据：tc13r-review/ 四组截图 + probe-light.json）

| 状态 | 脚下区域 | 截图 |
|---|---|---|
| 燃态（81） | 暖光晕（light 15 照亮），无黑区 | light-lit.png |
| 熄态（82） | **黑框：篝火四周整格高侧壁纯黑，2.4s 不收敛（稳定态）** | light-out.png |
| 石头对照 | 无黑区（solid 满格，邻面被剔除） | light-stone.png |
| 火把对照 | 无黑区（solid:false 不挡光，邻面采样火把格 sky 正常） | light-torch.png / light-torchRemoved.png |

- 黑区形状=围绕篝火格的方框带角延伸，**就是燃态光晕的同一形状**（lit 图暖光区 ↔ out 图黑区重合）。
- 撤光中间态假说排除：quench 后 2.4s（BFS 收敛余量 12 倍）黑区不变。
- 通用撤光路径排除：火把放置→移除对照撤光干净（torchRemoved 地面 sky=1/blk=0，sky0=0）。

## 2. 归因链（逐环带 文件:行）

1. **块定义**：`BLOCKS[B_CAMPFIRE/B_CAMPFIRE_OUT]` = `thin: 0.4375 + solid: true`
   （config.js:544-545；L532 注记「半格实体可碰撞可站立」= spec §3.4 物理裁定）。
   **全表 solid∧thin 组合仅篝火两态与门额牌（config.js:527）**；其余 thin 块一律 solid:false
   （config.js:310 旧纪律注记）。门额牌挂横梁下无实心邻居环抱 → 无此现象。
   **篝火是唯一「solid+thin 且坐在实心地面」的块**。
2. **剔面豁免**：实心/图集/TNT/流体四通道同一判据
   `if (nb && !nb.glass && !nb.thin && !nb.pane) continue;`
   （mesh-core.js:634/575/605/493）——**thin 邻居不剔面**（为十字面片/火把/床保留邻格面的
   正确通用语义）。沙壁朝篝火格的侧面照绘，且是**整格高**（顶点 `y+cor[1]` 0~1 全格），
   而篝火部件只占下半 0.34 → 上段 0.5625 的侧壁「悬空可见」。
3. **面光采样**：`fSky = lsky(nx,ny,nz)/15; fBlk = lblk(...)`（mesh-core.js:639 同族）——
   取**面朝向邻格** = 篝火格。
4. **挡光格语义**：篝火格 solid 挡光，熄灭态自身格 sky/block 恒 0
   （mesh-core.js:143 注记，ADR 0012 T4 同构；config.js:545 `light: 0`）。
   → 沙壁侧面顶点光 = sky 0 / blk 0。
5. **渲染**：`outgoing = albedo × (skyTint·bright(max(aSky·15 − uDim, uSkyFloor)) + uTorch·bright(aBlock·15 + glowTerm))`
   （world.js:306-307/342）→ sky 0 ∧ blk 0 ∧ uSkyFloor≈0（白天明亮场景）→ **纯黑**。
6. **燃态为何不黑**：同侧面采样燃态篝火格 block 15 → 暖亮，与光晕融为一体（light-lit.png）。
   **燃熄切换瞬间**：撤 block 光后同一批面从「亮」翻「黑」——黑框形状=旧光晕形状的成因。

### 表证矛盾的解释（探针数据面 vs 渲染面）

首轮光探针读 `y=30±0.02` 水平面：熄态 272 顶点中仅 4 个 0/0（坐标 (61,60)(62,60)(61,59)(62,59)
= 篝火格四条竖棱底点=黑侧壁底缘与地面顶面的共享角），其余全亮——**黑侧壁是竖直面
（y∈[30,31]），主体不在 y=30 平面上**，平面探针逮不到。「地面顶点数据亮但渲染黑」的矛盾由此解除：
黑的是侧壁（竖直面），不是地面顶面（水平面，数据确实亮）。

## 3. 修复方向（归 architect/engineer 裁量；设计线只锁观感判据）

| 方向 | 内容 | 影响面 | 设计线评估 |
|---|---|---|---|
| **H：挡光表豁免（推荐评估）** | sky 挡光判定对 campfire 格豁免——「半格不挡天光」；block 通道照旧（燃 15/熄 0） | 光引擎（voxel.js 挡光表）+ ADR 0012 T4「挡光格自身格恒 0」语义对篝火的例外 | 语义最物理（半格高，天光从上段过）；邻面取篝火格 sky=15 → 亮；部件面光取邻格不受影响；夜晚 sky 0 无差。风险：光场派生重算的存档重放影响需 engineer 核 |
| **C：采样改自身格** | 四通道面光采样对 `nb.thin` 邻格改取**自身格**光（thin 邻格不满格，面曝露于自身格环境） | mesh-core 四通道+流体 5 处同改；波及所有 thin 豁免面（火把贴墙/床/门额牌——顺带修复门额牌横梁朝下面的同款潜在黑面） | 通用判据改动需回归走查；「篝火特例」不进块定义，进采样语义 |
| 不可行备案 | 剔面特殊化（篝火格按满格遮挡剔面）→ 上半段悬空透视穿帮（篝火格背后格的朝面同判据被剔，视线穿透到远景）；out 态 solid:false → 动 spec §3.4 碰撞/站立物理裁定，玩法面越权 | — | 排除理由已核（判据逐面看 nb，无法只剔「紧邻面」） |

**设计观感判据（修复验收）**：熄态篝火=同结构转灰坐在地面，四周地面接缝自然无黑框；
燃→熄切换不出现「光晕形状翻黑框」的闪变；石头/火把/床/门额牌既有观感零回归。

## 4. 复验其余面（全绿，与本 bug 无关）

- 几何断言七项全绿（verify-geometry.log）：部件口径 6+焰片组=7≤7 / 织席 2×2 轴向交错 /
  炭堆顶 0.34≤0.35 / 全部件 ⊆[0,1]³ / **两态 emit 128 顶点 positions/normals 逐值全同**
  / tile 分派 68/69·70↔72·71↔73 / 非共面 0。
- probe-close 三次复跑与 R-5 json 逐值对撞一致：maxYrel 0.34 两态 / verts 144 /
  sheetStat 恒 1 张（lit fires=1→out fires=0）/ alpha 十五格逐值同（62~76）。
- 焰帧三连拍两两不同（flick0/1/2.png，间隔 0.22s≈1.47 帧步）：翻页「火在动」观感实证。
- 五锚近景目验：织席 4 根可数 / 炭堆顶灰烬裹炭杂色非黑板 / 交叉焰片动画 / 烟照旧 / 熄态同构转灰。

## 5. 票外登记（与黑区无关，单独移交工程线）

probe-light mesh 清点发现 **n:143 顶点的 MeshBasicMaterial mesh 在状态切换后 1→5 个**
（lit 时 1 个；quench/stone/torch 后恒 5 个；bbox 悬在篝火格附近 r≈1）——疑似 fx 句柄
泄漏（每次状态切换残留）。与黑区无关（stone/torch 有它们却无黑区），来源待工程线查
（体验馆自带装饰 or campfire fx 残留）。另 21 个 n:24 小 mesh 恒在且状态无关，初判体验馆
装饰，不追。

## 6. 证据文件清单（.scratch/campfire/tc13r-review/）

- probe-light.js / probe-light.json —— 三态+火把对照光探针（含缺光属性 mesh 清点）
- light-lit/out/stone/torch/torchRemoved.png —— 决定性对照图组
- verify-geometry.js / verify-geometry.log —— 几何七断言（vm 注入导出+真跑 emit）
- flame-flicker.js / flick0/1/2.png —— 焰帧三连拍（make-flicker.js=node patch 范式）
- close-litSide/litTop/outSide/outTop.png —— R-5 探针复跑四图（数值对撞基线）
