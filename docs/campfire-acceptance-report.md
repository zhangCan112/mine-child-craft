# 篝火特性 · 验收走查汇总报告（T-C12 票尾件）

> 票：[campfire-tickets.md §T-C12](campfire-tickets.md)（GLOSSARY + README 核账 + 验收走查汇总 + 全量回归）
> 日期：2026-11-17｜工作区：`campfire-ui2` worktree / 分支 `tc12`（基 3010ad8，含 12 主票+2 补丁全量）
> 体例先例：[glider-acceptance-report.md](glider-acceptance-report.md)
> 红线声明：本票**零产品代码改动**（js/css/index.html 与测试族零触碰）；新增件仅
> GLOSSARY 词条、docs/README 篝火行、本报告，走查装具全部在 `.scratch/campfire/`
> （一次性证据件，不入库——引用为指针，仓库不留装具）。

## 0. 收口台账（7 项全销）

| # | 项 | 结论 | 证据 |
|---|---|---|---|
| 1 | GLOSSARY 词条 8 条落盘（spec §8 清单） | ✅ 篝火（含 camp-core 撞车警示句）/热气流/气流源/乘流/燃尽/熄灭态/烫伤/篝火账，正文含实现细节与权威链 | GLOSSARY.md（本次 diff +40 行）；conventions 守门绿 |
| 2 | 词条计数与 js 文件数双向对齐（updraft-core/campfire-kit 两新文件） | ✅ CampfireKit 补立词条（热气流/气流源/篝火账已在 8 条内）；一览↔正文双向守门绿 | 大分块 69→73、游戏模式 47→52；conventions.test.js 全绿 |
| 3 | AudioRegistry advSfx 纳罩（T-C11 扫描扩面收尾） | ✅ 词条 _Avoid_ 扫描面注：守门正则扩罩 `advSfx('…')`，扫面 62→104 处，漏登记即红口径不变 | GLOSSARY.md AudioRegistry 词条 |
| 4 | docs/README 篝火行完工口径零死链 | ✅ 已完工行：spec/票据（12 主票+2 补丁全 ☑）/调研/走查报告/GLOSSARY/UI 定稿 v1.6/ADR 0017–0019；全部链接目标在档 | docs/README.md 篝火行；链接逐一对档核实 |
| 5 | 验收走查汇总报告落盘 | ✅ 本文件（含逐票表+走查记录+手玩锚结论+票外发现） | docs/campfire-acceptance-report.md |
| 6 | `npm test` 全绿（含规范守门） | ✅ tests 2472 / pass 2471 / **fail 0** / skipped 1（286.9s） | §6 门禁结果 |
| 7 | `npm run lint` 零错误 + `node server.js` 冒烟 | ✅ eslint+stylelint+htmlhint 零错误；server /ping 200 | §6 门禁结果 |

## 1. 验收基础锚

**验收锚画面（spec §1「家门口的起飞器」）**：孩子在家门口用木棍、原木和一块煤炭合出
篝火，放下就燃（不用点火），火光很大、烟柱升起来；穿着滑翔翼站到火边一跳——「噗」
地展开翅膀，顺着热气一路升过山头；约 5 分钟后火烧完，地面干干净净什么都不剩。

脚本驱动走查（§4）对锚画面逐段核对：合成 ×2（§4 步1）→ 放置即燃（步2）→ 乘流起飞
9.05 格/1.5s、峰 34.36 < 柱顶 45（步3）→ 燃尽干净消失（步4）→ 全链畅通。燃烧时长
300s 面走「余量直写 40 刻」替代点快进（申报见 §4），自然走表节奏由 kit 刻账单测
（campfire-kit.test）与 20tps 泵保证。

**整体验收口径（spec §1 五门）对照**：

| 门 | 口径 | 结果 |
|---|---|---|
| ① | §3 各功能块验收标准全过 | ✅ 逐票双轴评审全 PASS（§2），T-C1~T-C11+两补丁合并收口 |
| ② | 设计定稿走查项全过 | ✅ §5.10 十一项：脚本可测面已核，纯观感面留 PO 手玩（§5 组B，如实申报） |
| ③ | `npm test` 全绿（含规范守门） | ✅ 2472/2471/0/1 |
| ④ | `npm run lint` 零错误 | ✅ 三门零错 |
| ⑤ | `node server.js` 手工走查验收锚画面 | ✅ 冒烟 + 脚本驱动走查（§4）；观感面 PO 手玩（§5） |

## 2. 逐票验收记录（12 主票 + 2 补丁）

数据源：[campfire-tickets.md](campfire-tickets.md) 总览表（评审唯一权威口径，本表转录；
各票票面细节/双轴评审记录见该文件对应小节）。T-C12 自身状态行归管理线，本报告不碰。

| 票 | 内容 | 依赖 | 验收结论 | 合并号 |
|---|---|---|---|---|
| T-C1 | tracer 弹链：合成、放置即燃、燃烧消失 | — | ☑ 已合并（实现+评审双 PASS；SPEC-1 小修：shapeCost 提示面） | f8b133b+5f634b2 |
| T-C2 | 气流机制：updraft-core+注册+展翼豁免+遮挡截断+多柱 max | T-C1 | ☑ 已合并（评审 FAIL→修复后 PASS） | 708e9d0+90c6193+ababee5 |
| T-C3 | 熄灭与重燃：水浇转熄灭态+空手重燃+熄灭态交互组 | T-C1 | ☑ 已合并（评审 FAIL→修复后 PASS） | ac5c253+cc3dcb1+7bb4123 |
| T-C4 | 烫伤：节拍结算+玩家同拍+fireTick 事件 | T-C1 | ☑ 已合并（合并 4e8943b；minor 修 3c3d3f8，SPEC-1 备注探针） | 34c28c7+4a61a64 |
| T-C5 | 存档闭环：campfires 侧账+重放对账+跨图同烧+体验馆 dev | T-C1, T-C3 | ☑ 已合并（合并 8f142ea；双轴 PASS+SPEC-1 小修） | 7b6902a+f4a8b42+8b15782+e702853+c8d77af |
| T-C6 | 基准与准星：50 火实测（无 BFS+柱查询+采样口径回填） | T-C2 | ☑ 已合并（合并 4ae92de；双轴 PASS；基准结论回填 §3.9） | 79f77c1+3022fde |
| T-C7 | UI A 区：物品与合成（图集+配方面板篝火） | T-C1 | ☑ 已合并（合并 693ddac；双轴评审零发现+design-lead 视觉走查） | b8b6efb |
| T-C8 | UI B 区：方块两态贴图与图集 | T-C1 | ☑ 已合并（合并 9806477；双轴 PASS+视觉走查 PASS；遗留挤压归 T-C8b） | 6788aa9 |
| T-C8b | 补丁：两态挤压取整矩细节（可见性+STD-1 注） | T-C8, T-C1 | ☑ 已合并（合并 050be81；双轴 PASS+design-lead 逐线对板 PASS） | 39261ce |
| T-C9 | UI C 区：篝火世界特效 | T-C2 | ☑ 已合并（合并 36246ad；评审 FAIL→修复后 PASS） | f025ae9+05894cb+2b52aef+d1f872b/4300e5e |
| T-C10 | UI D 区：HUD 与背包栏 | T-C1 | ☑ 已合并（合并 3df8a5c；双轴 PASS；通用化遗留归 T-C10b） | 00c6aa2+34363c4 |
| T-C10b | 补丁：篝火失败回环通用化（气泡+TTS） | T-C10 | ☑ 已合并（合并 09f7659；双轴 PASS） | 7f7bb96+aeeba89+84ce8fd |
| T-C11 | UI E 区：声效登记与音效 | T-C1 | ☑ 已合并（合并 ff5eef6；双轴 PASS+端到端 PASS；音色听感面留 PO 复听） | 3b802ab+bb8a23c+fde4bb8 |
| T-C12 | 收口：GLOSSARY+README 核账+验收走查汇总+全量回归 | 全部 | ◐ 本票（本文件即其走查汇总件） | 票尾收口（管理线对账） |

## 3. BotW 对照终检（spec §10 正名条款）

spec §10 十一行对照表按拍板冻结，本票终检**只核现状与拍板一致，不触发任何数值回头改**
（「偏离项不得以对齐 BotW 名义回头改拍板」——调研 §7-7）。走查终轮实测 vs 拍板：

| 拍板项 | 拍板值 | 走查实测 | 判定 |
|---|---|---|---|
| 燃尽时长 | 6000 刻=300s，自然燃尽干净消失 | 台账 left=6000 满时长建条；40 刻快进后干净消失无掉落（步4） | 一致 |
| 气流门槛 | 单火即出完整气流 | 放置 1 座→UPDRAFT_SIM.count()=1，柱内乘流起飞（步2/3） | 一致 |
| 柱高/柱宽 | 20 格 / 3×3（Chebyshev 半径 1） | query {lift:3, top:45}（=25+20）；柱顶合规断言过（步3） | 一致 |
| 升速 | +3.0 格/s（调参不判变更） | glide 柱内 vel.y=+3.000，1.5s 升 8.05~9.47 格 | 一致 |
| 点燃 | 放置即燃（零点燃步骤） | onMouse 放置即 81/台账+1/特效+sfx 同拍（步2） | 一致 |
| 熄灭/重燃 | 水浇熄灭（无天气），点击重燃满时长重置 | 浇熄 82（步5）；重燃 81、left 5988≈满（步6） | 一致 |
| 多火叠加 | max 语义不叠加 | updraft-core 单测（多柱 max/遮挡截断）收口在 T-C2 | 一致 |
| 烫伤 | 每满 1s 扣 1 血，玩家+怪物同规则 | 踩火起飞豁免面：步3 hpUnchanged ✓（接触<1 拍天然豁免）；计息器单测收口在 T-C4 | 一致 |
| 照明 | light 15 | config CAMPFIRE 终检核对（开工项），方块行 light 15/0 | 一致 |

## 4. 脚本驱动八步走查（全链记录）

**口径**：headless Chrome（SwiftShader）+ `node server.js` + 真 `AdventureMode`（非
体验馆——存档往返走真 SyncDB 档）；「headless 不可行的手玩面用脚本驱动替代并如实
申报」（C6 harness 先例）。**替代点申报**（生产 handler 原样，替代仅在输入面）：

| 步 | 生产缝 | 替代点（申报） |
|---|---|---|
| 1 合成 | 真背包+craft-core 两步制（fillGrid+gridCraft） | 不经合成面板 DOM 点按 |
| 2 放置 | 真 PlaceKit 使用链 `AdventureMode.onMouse(2, hit)` 显式 hit | 不经准星射线（无需 fake CameraRig） |
| 3 乘流 | 真引擎物理（voxel.js 滑翔分支，主循环真 rAF 喂帧） | pos.set 传送火顶 + `keys['Space']` 置位 |
| 4 燃尽 | 真计划刻泵（kit tick 20tps） | 台账余量直写 40 刻（代替等 300s） |
| 5 浇熄 | 真 editBlock 放水+真 tick 浇熄几何 | — |
| 6 重燃 | 真空手点击链（onMouse(2)） | — |
| 7 挖掘 | 真破坏结算 advBreakBlock | time:0 代替蓄力等待 |
| 8 存档 | 真 pagehide 同步写+真 switchMode 往返+真读档重放 | entry.left=5500 中段直写 |

**终轮结果：8/8 全绿，字段级实质全过**（2026-11-17，干净 profile，hp=30 首玩态）：

| 步 | 关键字段（终轮实测） |
|---|---|
| 1 合成 | 产 ×2、leftover 0、campfireInInv=2 ✓ |
| 2 放置即燃 | blockId 81、台账 1、气流 1、包 2→1、flame 5/smoke 2/vortex 16、budget full、sfxLit ✓ |
| 3 乘流起飞 | rose 8.05 格（pass>2）、peak 34.36<47、hp 不变（踩火起飞豁免）、柱顶合规 ✓ |
| 4 燃尽干净消失 | 块 0、台账 0、气流 0、fx 0、残粒 0、零掉落、sfxOut ✓ |
| 5 浇熄 | 块 82（熄灭态）、台账 0、气流 0、火焰残粒 0 ✓ |
| 6 点击重燃 | relit 81、600ms 后仍 81、五格水几何全 0、台账 1、left 5988（=6000−12 刻，20tps 分毫不差）、气流 1、flame 2 渐起、话术气泡 ✓、空手零消耗 ✓ |
| 7 挖掘回收 | campfireGone ✓、包 +1 回收、台账/气流随挖清零 ✓ |
| 8 存档往返 | 放置即燃 ✓、存 5500→重进读 5399（续燃走表）、块 81 恢复、台账 1、气流 1、flame 4/smoke 7 三发射器在位 ✓ |

### 归因记录（三轮走查的三处红因，全部装具侧，零产品缺陷）

1. **乘流冻结（首轮 rose=0）**：headless Chrome 将 rAF 连发成 ~0ms 突发，主循环
   `FRAME_MIN=16.4ms` 节流门把亚 16ms 突发帧整帧拒绝（main.js:377 提前 return）——
   装具按 rAF 计数等帧，数到的全是被节流拒绝的空帧，物理零推进。**仪表实锤**（diag2
   干净 profile）：冻结窗 30 个 rAF 仅 ~1ms、physics 计数钉在 176、主循环时间戳钉在
   4861；`sleep(2500)` 后 physics 176→326（≈60fps 节奏）、pos 26.060→33.585
   （+7.5 = 150 帧×dt0.017×lift3 分毫不差）。**产品代码完全正确**（节流为 60Hz 锁帧
   设计），门控/预算/NET_DEAD/可见性全部排除。装具修正：counted-frame 等待改为
   「先睡 18ms 再等 rAF」真时间节拍。转绿：rose 0→8.05/9.47。
2. **重燃秒掐（次轮 stillLit=false）**：步 5 浇熄的水经流体泵扩散成环，装具单清一格
   被环水回灌，重燃后首刻被水几何（五格判据，adventure-core advCampfireQuenchHit）
   合法再浇熄——kit 水浇语义正确，装具自造场景污染断言。修正：撤整片水+加五格读数
   留证。转绿：left 5988/气流 1/特效渐起。
3. **放置被拒（次轮 placedLit=false）**：步 7 把玩家挪到火格正上，物理落地后身体与
   目标格 AABB 自交，生产端「不能放进自己」拒放——生产语义正确。修正：装具先挪开。
   转绿：placedLit=true 且步 8 全链绿。
   （另有跨轮污染一轮：共享 Chrome profile 的 localStorage 把上轮 hp/存档带进下轮
   ——走查改每轮全新 profile 后消解，见 §7 票外②。）

## 5. 手玩锚两组

### 组A · spec §1 验收锚画面（家门口的起飞器）

- **脚本可核对面（已核）**：合成 ×2 → 放置即燃（火光方块+粒子三件+音效同拍）→
  乘流起飞（展翼 wing_open、柱内升力、hp 豁免）→ 燃尽干净消失（§4 八步全绿）。
  滑翔翼装备/展开的观感面在 T-G06 已验收（glider 报告），本期复用不重验。
- **PO 手玩面（留验，脚本不可代）**：火光「很大」的观感、烟柱远距轮廓、升空体感
  「一路升过山头」的爽感、5 分钟等待节奏的体感。

### 组B · UI 定稿 §5.10 十一项（C 区走查项，v1.6）

| # | 判据 | 核对方式与结论 |
|---|---|---|
| 1 | 烟柱 40 格外可见 | 脚本面：烟柱发射器满额常驻（smoke 2→7）；**视觉辨认可读性=PO 手玩** |
| 2 | 气柱 3 格外可读、旋涡逆时针 | 脚本面：vortex 粒子 16/budget full；**旋向与可读性=PO 手玩** |
| 3 | 柱高观感=判定柱满高 20 | ✅ 脚本：query top=45（25+20）、peak 34.36 柱顶合规（遮挡穿模=定稿 §5.4 已知边界不重验） |
| 4 | 烟暖白 vs 风冷白温差 | **同屏对比=PO 手玩**（两族粒子分色在 fx-core 单测与参数表锚定） |
| 5 | 点燃 pop 0.35s+渐起 0.5s，无震屏无碎块 | ✅ 脚本：sfxLit 同拍、块直翻无 debris、无震屏消费；pop 观感 PO |
| 6 | 燃尽 ≤2s 粒子全清、地面干净 | ✅ 脚本：residualParticles 0、fxActive 0、块 0 无残渣（步4） |
| 7 | 浇熄白汽即刻、无残帧 | ✅ 脚本：flameResidual 0、steamTransients 0（白汽 0.8s 过渡过采样窗）、块 82 |
| 8 | 渐弱期火苗降档、气柱不衰减、无 UI 倒计时 | ✅ 脚本面：setLeft 喂档在 fx-core 单测（T-C9）、气柱判定不随余量衰减（步3 与步4 同柱语义）；**渐弱观感=PO 手玩** |
| 9 | 低核档判据全部成立 | lowcore 参数注入在 fx-core 单测；**headless 未专测低核档观感=PO 手玩（申报）** |
| 10 | 切模式 Fx.clear 零残留；读档三发射器即刻在位 | ✅ 脚本：步8 真切模式往返后 flame 4/smoke 7 即刻在位、台账/气流重挂；清场收口在 fx 句柄纪律单测 |
| 11 | 探险+体验馆两模式同观感 | 共享同一 place-kit 实例（同缝装配）；本走查走探险真模式；**体验馆观感=PO 手玩（申报）** |

## 6. 门禁结果

```
npm test        # tests 2472 / suites 0 / pass 2471 / fail 0 / cancelled 0
                # skipped 1 / todo 0 / duration 286934ms   —— 含规范守门（GLOSSARY
                #  一览↔正文双向、装具假 DOM 守门、boot 全链冒烟）
npm run lint    # eslint(google 基线) + stylelint + htmlhint 零错误
node server.js  # 冒烟 /ping 200；八步走查即经 server.js 全程跑通
```

## 7. 已知缺口 / 票外发现

- **票外①（装具纪律，非产品）**：headless Chrome rAF 突发 × 主循环 FRAME_MIN 节流
  的交互——rAF 计数不等于物理帧数，counted-frame 等待必须真时间节拍。产品代码正确
  不动；此教训登记给后续一切 headless 装具（tc6/tc10 同族装具若有帧等待可对照）。
- **票外②（装具纪律，非产品）**：复用 Chrome profile 的 localStorage 会把上轮的
  每日预算/世界存档/hp 带进下轮（本轮实踩：hp=30→23、世界带伤重进）。走查/诊断
  装具一律每轮全新 `user-data-dir`。
- **票外③**：走查三轮所有红因均归装具侧（帧节拍/水环自污染/站位自交/跨轮污染），
  **产品线零缺陷零改动**——红线「零产品代码改动」全程保持。
- **已知边界（非本票缺口）**：气柱遮挡穿模=UI 定稿 §5.4 已知边界；音色听感复听与
  体验馆观感面=PO 手玩项（§5）；数值微调（升速/时长/烫伤）按 U-3 归实现期调参，
  不判需求变更。

## 8. 归档与登记

- **GLOSSARY.md**：+9 词条（篝火/热气流/气流源/乘流/燃尽/熄灭态/烫伤/篝火账/篝火
  kit）+AudioRegistry 扫描面扩罩注；计数一览 69→73、47→52，守门绿。行为权威自此
  归词条（spec §8 先例），spec 降级为路标。
- **docs/README.md**：篝火行完工口径（历史工件表）。
- **本报告**：docs/campfire-acceptance-report.md（命名照 conventions kebab-case；
  glider 先例骨架）。
- **图谱**：票尾 `git merge feat/campfire` 对齐后重建增量（worktree 全量建，收尾项）。
