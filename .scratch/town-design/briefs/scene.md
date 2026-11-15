# Brief·scene 场景师——城镇重制 A+B+E 层

> 派单人:town-design-lead · 2026-11-14
> 你是城镇视觉重制的**场景与氛围师**。PO 已把城镇设计+实现权整体授予 ui-designer 岗,lead 总协调。

## 第一步(必做,顺序固定)
1. `open_line`,name: `town-design-scene`(唯一,冲突加后缀)
2. 读 `AGENTS.md`(开工图谱协议:build_or_update_graph_tool 显式传 worktree 路径+full_rebuild:true)
3. 读 `docs/design/town-visual-revamp-spec.md`(**任务书总纲:§2 字库契约+§3 A/B/E 三层+§5 红线**)
4. 读 `js/town-map-core.js` 全文(你负责的唯一权威文件)+ `test/town-map-core.test.js`(14 test=可执行规格)
5. 读 `js/town-assembly-core.js` 头注释(op 词表:{fill,tree,scrub,recolor,place}——你的清单会被它派生消费)
6. 读 `docs/conventions.md` + `docs/town-map-design.md`(布局权威 §3-§4)
7. 走查证据:`.scratch/town-design/shots/`(重点 10/12/15/17/18/22:空广场/灰山/补丁农田/断头路/白十字风车)

## 你的文件权(独占,勿碰他人文件)
- `js/town-map-core.js`(TOWN_MAP 九段清单:backdrop/ground/roads/prefab/scatter/zones)
- `test/town-map-core.test.js`(同步断言)
- 唯一例外:`anchors` 段的坐标与 id 你**不增不删不移**(锚点被 dims-core/导航消费,契约稳定);
  你可以在 anchors 附近放导览物件,但锚点本体冻结。

## 任务明细(总纲 §3 A/B/E 三层的落地)

### A 氛围层
- 摊位 prefab 3→6(stall-canopy 实例,+3:广场角与主路口;theme/size/face 变化,避让钟塔
  视线走廊 x±1 的 spawn→钟塔通道——蓝图脚印合法性测试会验)
- 广场角小樱花 2 棵(scatter kind: sakura)
- 旗阵:钟塔脚 4 旗(新 kind,见下「新 kind 协议」)
- 灯柱 2→10(广场环+主路沿线),路标/花坛/木桶/南瓜陈设按总纲 §3 A 落点

### B 远景层(backdrop 清单改造)
- mountain-arch 弧形山脊:现清单是单矩形域+topY 44。把它拆成多段(或加分段字段)表达
  「中心高 ~44 两侧渐降」的弧形轮廓;装配侧的落地语法见「新 kind 协议」——你只声明
  几何意图(分段域+各段 topY),lead 在 assembly 侧落地。
- 崖顶房屋 2 栋:坐标已列(cliff-home-a/b)但现状画面不可见——你重新拍板落位(脊线上,
  可见性优先)+造型字段(白墙 52/17+橙顶 9+19 灯点,同走 assembly 落地)。
- 山脚过渡带:山体域南缘的 scrub/pine 散布+苔石点清单。

### E 地表层
- 农田田垄:ground 的 farm 段升级为「田垄结构声明」(41 耕地+42-45 麦行栽相位混排+
  5 原木围栏桩+58 田埂)——具体字段形态你来定,lead 在 assembly 侧落地。
- 路缘:roads 每段加缘石字段或独立缘石清单(13 石砖主路缘);断头路端点(支路尽头)
  加「圆石小终驿站」(4/13 小坪+灯柱或花坛)。
- 草地散布:全域确定性草丛 40+花 61/62(kind: tuft/flower-y/flower-w),密度约每 8×8 一件,
  逐点避让建筑脚印/路面/广场/农田(测试有避让断言口径,遵循现状判据扩展)。

### 构图层·lead 设计意图(你落地)
- **进镇门廊**:spawn(79,24,112) 面北的前方 z≈100-104 主路两侧各 1 樱花树+1 灯柱
  (x≈76-77 与 81-82 对位),形成「穿过樱花拱门望钟塔」的前景框式构图——这是出生第一眼
  的画面骨架,坐标精度你拍板。

### 新 kind 协议(重要)
你的清单可以引入新 kind(tuft/flower-y/flag/banner-row/farm-rows/curb/grove 等),
**但 town-assembly-core.js 的 op 词表归 lead**:每引入一个 kind,在交付报告里列
「kind 名+语义+需要的色 id」,lead 在 assembly 侧同步落地( 词表封闭 {fill,tree,scrub,
recolor,place} 的扩展由 lead 拍板——可能复用现有 op 组合,不必新词)。在那之前,
新 kind 条目落清单后建场会「未知 op」炸——**所以你的交付节奏:先交「只用现有 kind」的
第一版(可绿),新 kind 清单作为第二版单独交**(报告里列明),lead 落地 assembly 后你
再切第二版。两版都各自 npm test 全绿。

## 自查闭环
- 复制 `.scratch/town-design/walk.mjs` 为 `walk-scene.mjs`(PORT 9226、user-data-dir 加 `-scene`),
  跑机位重拍自看。重点:10(出生门廊)/18(农田)/22(全景山体)/12(塔北远景)。

## 工程门与交付
1. `npm test` 全绿 + `npm run lint` 零错(清单变更必同步 test/town-map-core.test.js——
   14 test 是可执行规格:脚印避让/锚点/闭域断言全在里面)
2. git commit(中文消息;Windows 勿走 Out-File 管道写消息)
3. `relay send` → `town-design-lead`:第一版改动清单+设计说明+新 kind 需求表+自查截图+commit hash
4. 字库不够/契约矛盾:relay 报 lead,勿自行加方块 id 或改 assembly

## 红线(总纲 §5 全文有效)
- 不碰:town-npc* 族、入口缝机制、mode-registry、prefab-kit.js/town-assembly-core.js(arch 师的)、
  config.js/texture-atlas.js(lead 的)、anchors 段坐标
- 注释中文;任何时刻保持仓库可绿,小步提交
