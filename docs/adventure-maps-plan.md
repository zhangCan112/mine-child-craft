# 冒险模式生态地图 · 计划稿（adventure-maps-plan）

> 调研底座：[minecraft-biome-research.md](minecraft-biome-research.md) ·
> [map-transition-research.md](map-transition-research.md)。
> 设计定稿：[adventure-maps-design.md](adventure-maps-design.md)（五问已拍板：三图全上 ·
> 远征死亡回家 · 解锁账进任务档 · 雪球一期 · 畜牧留 home；**§2.4 家园地图重设计**——
> 同心圈层布局，2026-10-27 用户两次追加拍板）。
> 实测锚点：切图同步成本 ≈12-25ms（建场 4-11ms + 光场 7-14ms）——遮罩是仪式感不是遮羞布。

## 阶段拆解

| # | 阶段 | 内容 | 验收 |
|---|---|---|---|
| P0 | 文档 | 设计稿拍板记录 + 本计划 | 两份落盘 |
| P1 | 数据层 | config.js 新方块 id 54+（B_SNOW 雪块 · B_SNOWY_GRASS 雪覆草 · B_ICE 冰 · B_CACTUS 仙人掌 · B_SANDSTONE 砂岩 · B_DEAD_BUSH 枯灌木 · B_ORCHID 兰花 · B_FLOWER_Y 蒲公英 · B_FLOWER_W 雏菊——hard/tool/tier/drop 旗标表配齐）；items-core 新物品（snow/snowball/cactus/sandstone/orchid/flower 两款）；item-hint-registry 儿童提示；icons.js ITEM_PIX 像素图；texture-atlas.js 图集格位（layout 是 UV 契约） | 键集守门测试全绿（ITEMS↔ITEM_HINTS 漏写即红）；未入集方块纯色兜底可跑 |
| P2 | 核心参数化 | adventure-core.js：ADV_NESTS/ADV_NIGHT.POOL 从模块常量改为「home 行缺省数据」，消费接口不变（advNestStep/advNightStep 纯函数签名零改动，池经参数传入） | 既有 test/adventure-core.test.js / adventure-mode.test.js 全绿——home 池行为不变是本阶段红线（P4 才动布局） |
| P3 | 地图纯核心 | js/scene-kit.js 加确定性高度场纯函数（16×16 控制格 hash + 双线性插值 + 整格阶梯 + 压平区遮罩）；新增 js/adventure-maps-core.js（应用层纯核心，零 THREE 零 DOM）：ADV_MAPS 注册表（每图一行：id/名/调色板/建场函数/巢穴池/夜怪池/门位/回程门位/HUD 名）+ 沙漠/雪原/沼泽建场函数族（确定性，高度场轻用：沙丘/雪堆）+ 政策纯函数（解锁判定 · 站桩步进 · 落点 · 死亡回家计划）+ 替换语义数据；index.html 加 script（adventure-core 之后、modes/adventure.js 之前）；新增 test/adventure-maps-core.test.js | 单测：每图建场两次逐字节一致 · 地表抽样断言（沙漠九成列是沙/雪原全雪覆）· 替换语义（沙漠夜池无 zombie、雪原夜池无 skeleton）· 高度场压平区/坡度 ≤1 断言 · 注册表完整性；boot 冒烟全链过 |
| P4 | 家园重设计 | adventure-core.js home 建场族重做（§2.4 同心圈层）：湖挪 (36,58)/煤坑 (100,52)/铁坑 (24,44)/山洞口 (62,10)/三巢梯度重排（近僵尸 44,60 · 中蜘蛛 96,36 · 远苦力怕 20,16）+ 高度场接入（圈层越远丘越高）+ 门阵广场压平区（东）/初始农田（屋南 4×3 耕地+熟麦）/畜牧围栏（屋西）/花丛草场/圆石小径；**小屋与家园核心圈坐标/压平 y24 不动**（老档出生语义）；单测形状断言随新坐标更新 + 新增圈层断言（距离梯度单调） | 单测更新全绿；真机：湖 30 秒内可达、山坡可登、动线成环、危险随距离递增的读图感成立 |
| P5 | 存档分桶 + 壳切图 | adventure.js：advWorldSlot 五键扩展（edits/furnaces/livestock 按 mapId 分桶 + map 当前图键；老档 decode 补 home 桶零迁移）+ 切图清场清单（Mobs/Drops/箭矢/flyMode/站点重扫/树苗重挂/节拍器复位）+ applyMapPalette（天/雾/水色，nether applySky 同款缝）+ HUD 图名行 | 单测/壳断言：分桶 encode/decode 往返一致 · 老档迁移 · **切走再切回世界逐字节一致**（分桶账本红线）· 重进幂等 |
| P6 | 传送门与遮罩 | home 门阵建场（每图一扇 6×7 门，nether buildPortalFrame 口径，P4 广场已压平）+ 目标图回程门常驻 + 站桩状态机（2s，可反悔，portalAt 坐标区间触发 + 0.8s 冷却）+ 遮罩观感（CSS vignette 紫白渐晕 400ms 双段 + audio 两段音效 + TTS 到达播报）+ 切图全链装配（站满→遮罩→loadScene+换装账本→spawn 回程门内→遮罩收） | 真机：走进门站 2s 全屏渐晕→从回程门走出面朝新图；中途走出归零；传送后 0.8s 内不回弹；全程 ≤5s 红线 |
| P7 | 任务与解锁 | ADV_QUESTS 扩表（每图 2-3 条 + home 圈层引导 1-2 条：认识农田/牧场）+ 解锁链（home 任务点亮沙漠门 → 沙漠任务点亮雪原门 → 雪原点亮沼泽门，线性）+ advQuestSlot counts 加键 + 未解锁门熄灭/锁定 TTS 提示 + 点亮仪式（Fx.portalBeam + sfx + TTS） | 任务档往返；门状态随任务进度点亮；HUD 任务行照常走字 |
| P8 | 雪球 | combat-kit mkArrows 第二实例（雪球弹种：零伤害+击退，重力大初速低）+ 雪球获取（挖雪块掉 4 雪球，4 雪球合成雪块）+ audio-registry 新音效条目（synth 回退）+ 手持/入包照常走 items 通道 | 真机：雪原捡雪球、掷出、命中怪物被击退不扣血；sfx 字面量守门绿 |
| P9 | 收尾 | GLOSSARY 两词条（冒险地图/传送门阵）+ 全量 `npm test` + `npm run lint` 零错误 + 真机手玩验收清单 | 全绿 + 手玩清单逐项勾 |

## 依赖序

P1 → P2 → P3 → P4 → P5 → P6 →（P7、P8 可并行，都只要 P6 的门与切图）→ P9。
P4 依赖 P3 的高度场与注册表；P5 依赖 P4（切图契约以重排后的 home 为基准）；P6 广场建在
P4 压平区。

## 风险登记

- **adventure.js 体量（97KB）**：改动段集中在存档段/init/切图/门 tick 四处，逐段小步提交；
  既有壳断言（adventure-mode.test）不可破。
- **home 布局变更是有意为之**：P2 的「行为不变红线」只保参数化那一步；P4 是设计决定的行为
  变更，形状断言随新坐标成批更新——更新本身要过评审（断言跟设计稿 §2.4 表对齐）。
- **老档兼容（P4/P5 双重）**：P4 挪结构后老档 edits 可能在新地形上错位（世界卫生清扫治愈
  浮空违例兜底）；小屋/核心圈不动保出生点。P5 分桶迁移在 decode 一次完成。
- **替换语义落点**：夜怪池在 advNightStep 核心常量里——参数化时纯函数签名不动（池经入参），
  避免破坏「快照进、纯数据出」的口径。
- **遮罩观感是 DOM/CSS**：新样式进 css/ 对应端文件（conventions §1.5），Stylelint 零错误。
- **boot 冒烟加载序**：maps-core 在 index.html 的位置必须在 adventure-core 之后（消费其全局
  函数的加载期引用），boot.test 会自动覆盖新 script——先加行再写壳消费。
- **雪球双实例**：combat-kit「一实例一弹种」——箭与雪球并存走两个 mkArrows 实例，确认壳层
  update 两实例都 tick、清理都收口。

## 手玩验收清单（P9 真机）

1. home 读图感：门阵广场在屋东、农田在屋南、围栏牧场在屋西；花丛草场；湖步行 30 秒可达。
2. home 圈层：近处遇僵尸巢、远处遇苦力怕巢；山洞在北边缘深处有钻石；山坡每步可登。
3. home 门阵三扇门：两扇熄灭（锁定 TTS）、一扇随任务点亮（仪式播报）。
4. 进沙漠门：渐晕 → 从回程门走出，看到沙丘+仙人掌+神殿轮廓；夜间只遇尸壳不遇白僵尸。
5. 神殿「可疑地板」踩塌滑入宝箱室，拿宝箱阶梯奖励，楼梯走上不困人。
6. 进雪原门：雪覆地表+云杉+雪屋；挖雪得雪球，掷雪球击退苦力怕。
7. 进沼泽门：灰绿水+垂藤+女巫小屋；小屋女巫常驻；夜间水边史莱姆。
8. 每图挖/放几处 → 切图再切回：改动精确保留；重进游戏（关页重开）仍保留。
9. 远征图死亡：满血回家门口，话术温和；回小屋冷却不受干扰。
10. 全程切图体感 ≤3s，遮罩无纯黑帧；连续快速切图（含站桩中途反悔 ×5）无残留状态。
