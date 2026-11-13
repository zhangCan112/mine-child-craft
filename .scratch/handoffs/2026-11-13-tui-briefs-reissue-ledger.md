# T-UI brief 重发台账（2026-11-13 PO 变更 · 工程线）

> 执行：engineer-manager · 2026-11-14（变更注记统一「2026-11-13 PO 变更」，跨天不换标签）
> 依据：`.scratch/handoffs/2026-11-13-tui-briefs-impact-list.md`（受损度与处置）+ `docs/adr/0011-town-dimension-seam-and-entry-transit.md` + `docs/town-architecture-design.md` §13（T-SEAM-01..05）。
> 口径：本台账只登记 **brief 文书重发（派单就绪态）**，不派施工——实现派工（每票一个 tdd-engineer 主）属后续节拍，PO 验收本步交付后启动。

## 逐票处置

| 票 | 受损度 | 本次处置 | brief 文件 |
|---|---|---|---|
| T-UI-00 | 重 | **不重发**（已收口 d412cff，价值由 entry-tokens 受损盘点 + town-entry-transition-visual-spec 接力）；沿旧缝的「入口卡实现接线」类衍生票一律停发（停工令覆盖） | 2026-11-12-T-UI-00-dispatch-brief.md（未动） |
| T-UI-01 | 轻 | 头部加重发注记：依赖改锚 T-SEAM-01/T-SEAM-04；旧 T-MAP 接缝句作废；HUD 挂点=adventure 壳维度态 chrome；T-SEAM-04 落地解阻 | 2026-11-13-T-UI-01-dispatch-brief.md（已注记） |
| T-UI-02 | 轻 | 头部加重发注记：旧接缝句作废；宿主终裁=壳层 town 分支（ADR-0011 决策 6a）；目标协议消费不变（mkTownTargets core 零改动） | 2026-11-13-T-UI-02-dispatch-brief.md（已注记） |
| T-UI-03 | 轻 | 头部加重发注记：建场接缝句作废（T-SEAM-01 build 闭包消费 townAssemblyOps，T-MAP-03 保留+转用途）；§6.1 出口语义=回程边缘白闪预案 | 2026-11-13-T-UI-03-dispatch-brief.md（已注记） |
| T-UI-04 | 无 | **零动作**（dialog-prebuild 注记已落盘，brief 零改版） | 2026-11-13-T-UI-04-dispatch-brief.md（未动） |
| T-UI-05 | 中 | **实质改写**：走查首步=「进入（冒险 home 图）→沿主路到尽头→白闪进镇→识别地标→获得提示→点选交互/对话」；U1-U3 核对项替换（visual spec §A.4/§A.6/§A.7/§B.3）；新增过场窗禁焦虑清单核对项 | 2026-11-13-T-UI-05-dispatch-brief.md（已改写） |

## 解阻与派工映射（供后续节拍）

- T-SEAM-04（交互机宿主挂载）落地 → 解阻 T-UI-01..03 派工；T-UI-04 在 T-UI-01..03 之后链上解阻。
- T-SEAM-05（收尾原子节拍：撤卡+装配件迁移+TownMode 词条改写同提交）落地 → T-UI-05 联调走查在终态缝上执行。
- 派工红线（承 ADR-0011/§13）：①恒开放——任何施工票冒条件开放变体（任务解锁/时段窗/渐进解锁）直接按拍板挡回；②两项必需件（ADV_EDGE_DIR_MAP east:'town' 键 + ADV_HOME_EDGE_GATES east 锚）缺一回程落错南锚，验收锚=从镇内越线回 home 落 east 锚（约 (154.5,75) 面西）；③T-SEAM-02/03 同文件（js/modes/adventure.js 壳段）可并行，合并序由 engineer-manager 派工时对齐；④撤卡只在 T-SEAM-05 原子收口，任何中间态不出现「无入口可进镇」。
