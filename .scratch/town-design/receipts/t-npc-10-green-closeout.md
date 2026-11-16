# T-NPC-10 接线票绿方收口回执(interact-wiring 转绿)

> 线: town-design-villager-wave2 T-NPC-10(implement-engineer 岗) · 日期: 2026-11-15
> 分支: `t-npc-10-wiring` · 红基线: `76cec93`(五面 13 红) · 交付 commit: **`b9800bd`**(4 文件, +144/−14)
> 树净, 未合并进任何集成线(谱系与合并就绪度见 §6, 裁决归派令方)。

## 1. 红→绿轨迹

全量 `node --test`(TAP): **2133 测 / 2129 过 / 3 红**(基线 13 红收敛至 3, 10 处转绿)。
余 3 红全部定性为**红测自身机械缺陷或跨票陈旧计数**, 非实现缺口, 逐条见 §5。

转绿的执法面(票面施工五条全落地):

| 面 | 内容 |
|----|------|
| conventions 装载序 gate | 镇民链 17 文件挂载序过门(kit→town_*×14→interact-core→anchor-core→registry→town-npc.js) |
| boot 建机/摆放 | `advTownInteractBoot` 建机 + `advTownPuppetsPlace` 摆放 + 弃机清场, 全绿 |
| wiring 锚升格 | 14 条 npc 锚并入 `TOWN_MAP.anchors`(npc:v01..v10+g01+a01..a03), 七导览锚零漂移, 三表对账/零漂移/建机语义全绿 |
| wiring 条目入册 | `TOWN_INTERACTS` 11 条六键 npc 条目(值=TOWN_NPCS 定值, 撰写期取值), 注册校验/机器 20 态/target 载荷全绿 |
| adventure-mode 最小 harness | 傀儡宿主双账(纯标量快照+root 另账)、四符号 typeof 容差守卫, 自动跳过机制未误伤, 全绿 |

## 2. 改动文件(全部在票面文件域内)

- `js/town-map-core.js` — anchors 尾部 +14 条 npc 锚+节注释; 静态锚取首航点、G01 取 leg0, 与 anchor-core 双表一致性由对账测试锁。
- `js/town-interact-core.js` — `TOWN_INTERACTS` 尾部 +11 条六键条目(v01..v10+g01; 动物纯氛围零条目), 头注释更新。
- `index.html` — :368 后插 T-NPC-10 挂载链块(带注释), 删原 interact-core 单挂(防双挂重复顶层声明)。
- `js/modes/adventure.js` — 傀儡宿主段(`advTownPuppets`/`advTownPuppetRoots` 双账+Place/Leave)、弃机步扩清场、进镇步独立摆放语句、`advTownState` 扩 `puppets`。
- `js/town-npc.js` — **未动**(消名挂起, §5.4)。

## 3. 施工中自伤两处, 均已修回(转绿 8+1)

1. **adventure.js 建机调用步被改写**: 我把基线单行 `if (drow === ADV_TOWN_DIM_ROW) advTownInteractBoot();` 重构进多行块, 破坏 town-ui 接线守门的逐字 `includes` 断言(:321)→恢复基线逐字原文, 傀儡摆放改其后独立同闸语句。
2. **index.html 注释携带 `js/town-ui.js` 字面量**: town-ui 两守门用裸 `html.indexOf('js/town-ui.js')` 探针, 注释散文提法被当成挂载点, `atUi` 被顶到最前→四点序/ dialog 序双红, 且五个 vm 装具测试按 `indexOf` 排序装载导致 town-ui.js 先于其依赖执行, `TOWN_UI_CORE` 落 null 分支进镇 feed 即炸(TypeError×5)。改注释措辞避开全部 `js/….js` 路径字面量→8 红一并转绿。
   经验已写进挂载注释: 「守门用裸 indexOf 探文件名, 本注释不写任何 js/ 路径字面量以免污染探针」。

## 4. 两项临时实验(取证后均回滚, 零残留)

1. **快照带 anchorId**: 临时给 `townInteractRegistry` 快照透传 anchorId → wiring 文件 8 测 7 过 1 红, 红点从 :172(TypeError, reading 'x')精确挪到 :181(diff 显示 `+anchorId` 为唯一多余键)→证实 :172 与 :181 互斥、我的锚 id/坐标/anchorOf 站位数据全对。已回滚。
2. **消名**(派令第 5 条): 删 `town-npc.js` 自带 `townNpcYawOfFace`、改消费 dims-core 权威 `townYawOfFace` → town-npc.test.js 8 测 5 过 **3 红, 全为 `townYawOfFace is not defined`**(ReferenceError)→「零测试改动」golden 被证伪(该测试适配器上下文不装 adventure-dims-core)。已回滚(`git checkout`, `townNpcYawOfFace` 三处回归)。

## 5. 待裁决清单(4 项, 均带硬证据)

1. **boot.test.js 挂载覆盖前缀缺陷**(红测机械缺陷): 扫描清单收集原始 src 值(带 `js/` 前缀), 期望值不带(`mob-look/town_a01.js`), `Array.includes` 精确匹配永不命中; 期望写法与 conventions gate 要求的 `src="js/…"` 互斥, 红测自身无法满足。
2. **town-npc-wiring.test.js :172 vs :181 同测自相矛盾**: :172 要快照带 `anchorId`(否则 TypeError), :181 冻结 v01 七键字面又禁 `anchorId`; 且 bridge() 的 JSON 往返封死非枚举属性逃逸。**不存在可满足双方的生产形状**(§4.1 实验证实)。注释 :179 「npc:v01 快照全键(六键+sessionKind…)」提示字面可能撰写于 anchorId 决议前。
3. **town-ui.test.js :1094 计数守门钉死 9**: 票面红测(1976/555)明文要求注册表 20 条, 本守门钉死 `TOWN_INTERACTS` 9 条, 两个生产期望互斥。属 T-UI-03 时代陈旧计数, 归 T-UI-11 对话消费节拍裁决; town-ui.js 不在本票文件域, 我不擅动。
4. **消名 golden 不成立**(派令第 5 条): 见 §4.2。若裁决执行消名, 须同步放宽 golden 允许 town-npc.test.js 装载清单加 `js/adventure-dims-core.js`(红方改), 或改为挂载序集成面断言。

## 6. 谱系与合并就绪度(交派令方裁定, 我未合并)

- 红基线 `76cec93` 与集成线 tip `villager-wave2=66af3b7` 为**兄弟**(共同祖先 `80d9ed2`); 票的红测试只在红基线线上, 重置对齐会弃红方落盘, 故不动。
- 试合并侦察(一次性 worktree, 已清理): `b9800bd` × `66af3b7` **零冲突**(对方仅动 town-dialog-core/其测试/town-ui.test.js +27 行/票文档, 与我四文件不相交); 合并树全量 **2139 测 / 2135 过 / 3 红**——与单线完全相同的 3 个裁决项, T-NPC-11 六新测并肩全绿。**合并就绪**。

## 7. 验证结果汇总

- 单线全量: 2133/2129/3(§1)。
- 五面卫生组(消名回滚后复跑): 220/218/2(=§5.1+§5.2, town-npc.test.js 消名实验区归绿)。
- `npm run lint`: 施工四文件**零错**; 全仓 11 错**全部落在红方两个测试文件**(town-npc-anchor-core.test.js 2 + town-npc-wiring.test.js 9, 基线自带欠债, 不属本岗文件域)。
- 红线全守: legIndex 推进未触(站位恒 leg0, 归 T-NPC-12)、town.js 残留未撤、村民未入 MOB_TYPES、未加票外文件、未动任何测试与 dialog-core/docs/GLOSSARY。
