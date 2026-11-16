# F 批野心版转派令归档（engmgr-ambition 开场交接文 · 2026-11-15）

> 补交接文落盘（原为会话内嵌文本，未归档，见复盘文症状 3）。此为 engmgr-ambition 会话开场收到的转派令全文，施工权威口径。

---

转派施工·野心版（PO 已裁 U1/U2，本派令为施工权威口径）：东带「已开放」边界野心版落地，worktree 同场 C:\Users\user\.local\share\opencode\worktree\1631a8\town-boundary（基床三 commit 保留：c1154f9/433aed6/1f8252c）。

【设计权威】docs\design\town-east-boundary-landscape-spec-v2.md（现行为；v1 已头部注记留档）+ docs\world-edge-design\east-spec.md 野心版再改稿 + .scratch\town-east-boundary\design-notes-ambition.md。注意：v2 §7 的 U1 待裁项**以本令为准**——U1=2 格高（fallback 启用，PO 要保留翻越小挑战）；U2=不可挖（S1/S2 声明式不可破坏路径，不走 hard fallback）；U3 不做（列 §7 备查即可）。design-lead 正同步回写 v2，文档与本令有出入处以本令为准。

【票面 F1~F5（测试锚点清单已写死 v2 §8.2，逐票照单）】
- F1 镇门楼重建+门额牌面【推翻 E1 件 A；config id80/texture-atlas/mesh-core/adventure-core/test】。依赖 S2 素材（asset-artist 制作中，design-lead 核验后经群组流转）；S2 未到可先开 F2~F5，F1 到时按 S2 落；若 S2 超预算走 fallback（石英+灯块门额灯室，N3 口径：竖板 solid:true thin:0.15 需 mesh-core 朝向变体，床族路径是水平扁盒）。**PO 重点期待：「高墙+通往村子的漂亮大门」——门楼观感是本线灵魂，施工精度从优。**
- F2 镇界中段矮墙+门框柱换装【推翻 E1 件 B 中段；新增 ADV_TOWN_WALL_ZONE】——墙高按 U1 裁决=2 格。注 N2：墙头花/端帽（y0+1）不在 §8.1 保护范围（只保 y0 墙基），票面写明「花/帽不在保」防顺手全保。
- F3 前街重排【钟塔正面化+房×4 门脸+石板+迎宾灯；config id79】
- F4 引道花径+灯柱【收编 v1 E3/E5；盐 8404】。注 N1：南列两丛（x149/151,z76）落 v1 土斑 patch 面上，F4 断言「脚下草皮判据」措辞按「实感地面」写防假红。
- F5 文档收口【east-spec 速览/GLOSSARY 括注（增量补丁逐字附 v2 §12）/README】

【硬红线仍锁】行为面锁定清单零改动：触发线 x≥157∧z74~75 / 回家锚 (154.5,75) 面西 / 翻越彩蛋语义 / 白闪语义 / 话术三句 / ProtectedZone east 恒 false。新块 id 79/80 已由设计线核实空闲；盐 8404 无撞。验收门=npm test 全绿+lint 零错。

【走查预告】完工实机走查项：W1~W3 校准点/夜间灯火链/翻越彩蛋回归（2 格高挑战感）/回程回望门楼——清单随完工回执列全给我，我请 PO 走查。

【通信】group=town-east-boundary 入群（design-lead/asset-artist 在线）；判读分歧群内回 design-lead；完工票清回执给我。

---

> 交接背景（同一转派文本的 project one-liner 与 current state 节要点）：多 agent 流水线 scrum-master→design-lead/ui-designer→engineer-manager→tdd-engineer；v1（E1/E2）施工完被 PO 观感翻案，仅作基床不收线；行为面锁定清单冻结（触发线 x≥157∧z74~75／回家锚 (154.5,75) 面西／翻越彩蛋／白闪／话术三句／ProtectedZone east 恒 false）任何改动必须经 scrum-master 升级 PO；PO 把设计决策整体授权设计线；提交纪律沿上轮惯例：施工主禁各自 commit，时机与分批由 engineer-manager 统一安排；判读分歧群内回 design-lead 线内消化，各岗不得直接打扰 PO；GLOSSARY 词条计数守门测试防漂移红；worktree 进场第一件事读 docs/worktree-pitfalls.md + 全量建图谱。
