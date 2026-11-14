# 收口回执 · 村民全量进镇波次一(渲染实体件)

> 岗位: engineer-manager|日期: 2026-11-14|派令来源: scrum-master(PO 2026-11-13 拍板全量铺开+另开线并行)
> 集成分支: town-design @ 25efa0c|npm test 1951/1950/0/1skip(存量 env 门控)|lint 三段零错|禁触面零沾

## 交付(六票全链闭环,每票施工→验收→两轴评审)

| 票 | 交付物 | commit |
|---|---|---|
| T-NPC-04 | js/town-npc-anchor-core.js:14 站位+G01 巡逻环,anchorOf 纯取数器(航点量化),8 条对齐硬约束 | ef0af80/4b615bb/39a09f2 |
| T-NPC-01 | mob-look-kit 非方形两态(存量零漂移)+gen→look 导出器+town_v01 试点+golden 像素锁 | 15f54c7 |
| T-NPC-02 | 14 look 文件全量落库(golden fixture 9672 行,复跑导出器零 diff) | 645017a/15e301e/7b3d2ac/bb3b294 |
| T-NPC-03 | js/town-npc-registry.js 唯一权威(三向键集对账,sessionKind 十一定值) | f75e82f/51c26e8/240be1b |
| T-NPC-05 | js/town-npc.js:mkTownNpcPuppet+placeTownNpc(THREE 桩直测,face→yaw 双源登记) | 4cc96ad/dfa0953/84b5064 |
| T-NPC-06 | 收口修票:conventions/GLOSSARY 回写+删 size 死字段+greet join 断言 | 07261d2/5b6215a/9f1744e/25efa0c |

## 三裁决(architect 按 PO 已拍板框架落地)

1. 管线=复跑 gen 导出+golden 像素锁(像素=已批产 SVG,否决 PNG 第二套管线);
2. 姿态帧不入批(§9 明文归动画层选型),只留 expression/crack/flower 数据字段;
3. 锚点=anchorOf 到站跳变(非插值非纯静态),消费侧重发归 T-NPC-12,标「待入口缝 ADR 会师」——T-MAP-04 PO-pending 的销号载体。

## PO 走查记录(2026-11-14)

- PO 起服务走查→8080 被 Steam 占用(steamwebhelper)→换 8090 重起→PO 确认「一个都没看到村民」→经解释(纯数据件未接线,节奏如此)→**PO 拍板「维持原节奏,等接线」**:波次一交付接受,无修复要求;波次二挂起待会师获背书。服务已关。

## 波次二(挂起,票面齐备)

- T-NPC-10/11/12 立票在 .scratch/town-design/tickets/(blocked-by 入口缝 ADR+03+04,ADR-0011 d0d17ee 已裁定宿主=adventure 壳 town 分支)。
- **解锁条件**:入口缝线(T-SEAM 链)施工代码上分支、宿主物理形态稳定→engineer-manager 修订 T-NPC-10 文件域(现预算面含 town.js 撤除前形态,须按撤卡节拍核对)→派发。
- T-NPC-10 票面已带三笔递延备忘:装载序链断言(F5)/face→yaw up 词表对口/boot 冒烟覆盖债。

## 环境债(retro)

.opencode/power-luna/feedback/2026-11-14-town-villagers-wave1-retro.md——5 笔:追令 sessionID 自检/vm 沙盒规约文档化/票文模板补导出器再生成面/PowerShell 字符与 GBK 两坑模板化/守门改源须同步回写规范正文。

## 遗留零项

本波无未结修复项;A03 耳内红 1 纹素映射与托盘 6×2×4 尺寸均为评审裁定授权内,PO 走查时可随时低成本调整。
