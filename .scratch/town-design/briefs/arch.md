# Brief·arch 建筑师——城镇重制 M+G 层

> 派单人:town-design-lead · 2026-11-14
> 你是城镇视觉重制的**建筑与几何师**。PO 已把城镇设计+实现权整体授予 ui-designer 岗,lead 总协调。

## 第一步(必做,顺序固定)
1. `open_line`,name: `town-design-arch`(唯一,冲突加后缀)
2. 读 `AGENTS.md`(开工图谱协议:build_or_update_graph_tool 显式传 worktree 路径+full_rebuild:true)
3. 读 `docs/design/town-visual-revamp-spec.md`(**你的任务书总纲:§2 字库契约+§3 M/G 两层+§5 红线**)
4. 读 `docs/design/town-prefab-specs.md`(件库契约:蓝图名/脚印/v 变种面——**契约不变,几何内升级**)
5. 读 `js/prefab-kit.js`(现状七蓝图 kernel 全文精读)+ `js/town-assembly-core.js`(TOWN_PALETTE 现状)
6. 读 `docs/conventions.md`(一文件一模块/头注释契约/工程门)+ `docs/design/town-buildings-visual-spec.md`(§4 色盘 §5 体量——观感目标)
7. 走查证据:`.scratch/town-design/shots/`(13 机位现状截图,重点 12/13/17/19/22)

## 你的文件权(独占,勿碰他人文件)
- `js/prefab-kit.js`(七蓝图 kernel:TOWER-BELFRY/SHOP-AWNING/WINDMILL-TOWER/COTTAGE-GABLE/HOUSE-LOFT/STASH-HUT/STALL-CANOPY + under-room 不动)
- `js/town-assembly-core.js`(TOWN_PALETTE v2 重映射)
- 配套测试:`test/prefab-kit.test.js` · `test/town-assembly-core.test.js`

## 任务明细(总纲 §3 M/G 两层的落地)

### M 材质层:TOWN_PALETTE v2
- 建筑三段式立面:石基座(4 圆石/13 石砖)+墙(6 木板为主,17 石英抹灰混搭)+5 深木描边;
  屋顶 9 红砖+檐口 5;**樱粉一律用 78(粉羊毛,lead 已入库),16 红羊毛只用于旗/喜庆点缀**;
  广场铺装 ground.plaza: 58 砂岩 → **17 石英**(58 降为边带);road.main 58→13 石砖,lane 4 圆石保留,
  路缘语义新增(可与 scene 师的路缘清单联动,由你在 palette 侧给色)。
- palette 键集**只加不删**(契约);新增键在头注释登记一行。
- T-PREFAB-09 材质安全基线测试同步(town 行零危险旗标/零显式错用断言)。

### G 几何层:七蓝图 kernel 重造型
造型要求见总纲 §3 G;通用手法:阶梯式体素屋顶(每层收 1 格,檐口 5 深木一圈)、
收分塔身(基宽上窄分段)、窗洞用 68 玻璃板+17 石英框、门 64/65(两格)、
布幔双层色(主色+17 奶油滚边)、发光点缀 19 灯块(克制成点,不刷屏)。
**footprint(footOf 脚印盒)语义不变**——超件越界=测试红;高度可增(世界顶 47,groundY 24,
可用余量 23 格,钟塔做到 ~16)。
- stall-canopy 的 v 变种键(size/theme)保持兼容:theme 可新增枚举(PF_ENUMS 同步)。

## 自查闭环(改完自己看效果,不要盲交)
- `node .scratch/town-design/walk.mjs` 会重拍 13 机位到 `.scratch/town-design/shots/`。
  **先复制**成 `walk-arch.mjs` 并把 PORT 改 9225、user-data-dir 加 `-arch` 后缀(并行防撞),再跑。
- 机位重点:12(塔北)/13(塔特写)/17(风车)/19(鸡店)/22(全景)。

## 工程门与交付
1. `npm test` 全绿 + `npm run lint` 零错(改蓝图必同步同名单测——脚印盒/材质黑名单断言)
2. git commit(中文消息;Windows 下勿走 Out-File 管道写提交消息,GBK 会炸;含 ~ # em-dash 的消息别用)
3. `relay send` → `town-design-lead`:改动清单(文件+要点)+设计说明(每个蓝图 2-3 句造型意图)+
   自查截图路径+commit hash。若有未决设计权衡,列出来等 lead 裁决。
4. 中途发现契约矛盾/字库不够用:**不要自行加方块 id**(那是 lead 的文件权),relay 报 lead。

## 红线(总纲 §5 全文有效)
- 不碰:town-npc* 族、入口缝机制(ADR-0011 件)、mode-registry、under-room 蓝图、
  town-map-core.js(scene 师的)、config.js/texture-atlas.js(lead 的)
- 注释中文;新文件走 conventions §1 决策树
- 任何时刻保持仓库可绿:小步提交,勿攒大招
