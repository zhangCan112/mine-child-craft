# T-G04 探险装配·合并回执（红+绿同票交付）

- 工单：docs/glider-tickets.md T-G04「探险装配」
- 红方：tdd-engineer（本岗）｜绿方：implement-engineer（派绿会话，前台阻塞）
- 基线：分支 glider，起步 HEAD=deecefb（GP03 v1.2 已合入：`Avatar.setWings('hidden'|'spread')`
  目标态 + `forceWingsHidden()` 对账兜底）；施工中 PO 压令并 main → **effdce1**（零冲突，
  并入 3f6a96d+82b22b6，代码面 daily-budget.js/focus.js 与本票文件面零交集）
- 日期：2026-11-16

## 一、红清单（19 测试 → 17 红 + 2 守门绿）

定向自证（PowerShell 管道丢行，全程 cmd 字节级重定向）：

```
cmd /c "node --test --test-reporter=tap --test-name-pattern=T-G04 test/adventure-mode.test.js > .scratch\glider\receipts\T-G04-red-final.tap 2>&1"
```

汇总：`# tests 19 | # pass 2 | # fail 17 | # skipped 0`
（全文件 213 tests / 196 pass / 17 fail / 0 skip——fail 全数在 T-G04 段）

红 17 条（=票面验收块行为面，转绿目标）：

| # | 测试 | 红因（组） |
|---|------|-----------|
| 1 | 装备位接线：穿上/卸下/读档对账全路径同步引擎装备位 | adventure.js 未消费 setGliderEquipped |
| 2 | 自动展翼(≥4 格高台跳)：setWings(spread)+wing_open+金描边 on | 迁移点未接 Avatar.setWings |
| 3 | 走崖自动展翼 + 平地连跳 10 次零误展（阈值自洽锚） | 同上（链式前置红） |
| 4 | 落地自动收翼：wing_close+setWings(hidden)+金描边 off | 收翼触发未接 |
| 5 | 水面软着陆：触水收翼+溅水+入水零伤害（收翼四触发之二） | 同上 |
| 6 | 主动取消闩锁三段：取消收翼+闩锁→再点再展→落地清闩锁 | 取消/闩锁状态机未落 |
| 7 | 滑翔中卸翼 A6：装备页口照常生效+立即收翼+无翼坠落扣血 | 卸翼路径未接（有意设计） |
| 9 | 滑翔水平转向跟手：yaw 同源操控（spec §3.4 R1-02） | 双通道意图入口未并流 |
| 10 | 金描边与滑翔态严格一致：边沿单次 class 切换 | 金描边驱动未落 |
| 11 | 金描边 CSS 参数：#e9b115 + 1.0↔0.55 + 1.6s ease-in-out | css/style.css 无该块 |
| 12 | HUD 槽滑翔中抑制：点第五槽零副作用，落地解锁 | 槽抑制未落 |
| 13 | 滑翔中动作暂停：挖/攻/吃/放四类无效，落地恢复 | 动作闸未落 |
| 14 | 按住挖到一半进入滑翔：清蓄力，滑翔中不续挖 | 蓄力清理未落 |
| 15 | 相机路径 B·FOV 微扩：+6°~8° 0.3s 匀速，落地恢复 | FOV 消费未落 |
| 16 | 切模式清场：装备位 off+观感复位+引擎态可收，重进零误播 | cleanup 收口未落 |
| 17 | 死亡重生：滑翔态清零+装备保留+无翼残影 | 死亡收口未落 |
| 19 | 体验馆同口径(§3.8)：showroom 壳零覆写同内核 | showroom 静态守门 |

守门绿 2 条（现状已绿，绿方须保持）：

| # | 测试 | 说明 |
|---|------|------|
| 8 | 全态兜底·未装备零参与：无翼高坠零滑翔面 | v1.2 解耦语义现状绿（setArmor 不驱动翼） |
| 18 | spec §7 U-01 行已回填：路径结论+理由一句 | 本岗回填后转绿（票面硬性交付） |

## 二、红自证过程记录

- 第一轮：213/194/19——全组红，含守门型 glideGoldOn 误红（空槽 `armorbar-slot off`
  被误判金边）；修正判定为「装备态且 className!=='armorbar-slot'」。
- 第二轮：213/196/17——fail 数与预期一致；但 PowerShell 管道显示丢行（可见 not ok 仅
  15 行），改 cmd 字节级重定向 + node 按 UTF-8 解析核实：17 红 = 14 可见 + 3 丢行
  （195/196/209），算术闭合，无「红中带绿」矛盾。
- 终局（定向 + 字节级 tap）：19/2/17，即上表。证据：T-G04-red-final.tap。

## 三、裁决记录（本岗，测试争议逐条裁定）

1. **相机 U-01 = 路径 B（第一人称退化）**：路径 A（自动第三人称）需扩引擎 CameraRig
   （setMode/滑翔中视角锁/滑翔专用距离）与 input.js V/C 挂起两处票外文件，且引入
   「落地恢复滑翔前视角」保存/恢复竞态，代价偏高；B 全落模式层所有权内。已回填
   spec §7 U-01 行（本票唯一 docs 改动）。
2. **测试驱动方式 = vm 真物理帧**（G.physics→AdventureMode.update，与 main.js
   384→396 主循环同序），不 stub isGliding——唯一能测出 stale gliding 消费时序的方式。
3. **装具中立性**：假 Avatar 桩把 forceWingsHidden() 与 setWings('hidden') 同键记录
   （['setWings','hidden']）——锁「复位 hidden」语义，不钉绿方 API 选型。
4. **A6 滑翔中卸翼**：按无翼坠落扣血是有意设计，断言锁「不得修掉」。
5. **绿方 13 红异议全数裁定成立（红方剧本缺陷，非实现问题）**，证据链：
   - **共同根因（8 红 + 3 前置）**：glideAirborne「跳+单帧 W」物理不可达——引擎水平
     速度逐帧赋值（voxel.js:310，松键即清零），单帧 W 净位移≈0.08 格跨不出柱心 0.5 格；
     纯垂直跳高 1.494 < 展翼阈值 2（voxel.js:333 gHeight>deployHeight）。纯引擎复现
     repro-jump-glide.js：剧本 A gliding=false/位移 0.000；剧本 B（持续 W 走崖）10 帧
     展翼。本岗亲自复跑复现脚本核验。修法：装具改走崖法（与 test 3 同款物理路径）。
   - **test 7**：同步断言 G.gliding===false 违反引擎契约（voxel.js:243-245「physics
     帧级判定」注释背书）——改 glideFrame(1) 后断言，时序对齐非弱化。
   - **test 13 五处剧本缺陷**：wearAll(inv, []) 空列表漏穿翼（红方笔误，注释写「翼另穿」
     却传空）；塔 (20,20) 在西界引导带（advEdgeHintAt x≤22）误收话术，挪 (80,80)；
     放置 hit 指玩家脚下被 collidesAtPlayer 拒，布独立踏板；落地段手持/饥饿（hp）前置
     断裂补齐。断言本体逐字未动。
   - **test 16 重进语义裁决**：高空+装备保留重进 → 引擎「离地>2 规则一元」自动展翼
     属**真沿非误播**；「重进零误播」断言前提=玩家贴地场景。装具摆贴地（等效档 pos
     落地）后断言，语义不变。
   - 浮点窗三处（test 4 跑动 10→15 帧、test 5 触水 30→60 帧、test 9 转向 12→15 帧）：
     引擎速度模型下的窗口不足，断言阈值逐字未动。
6. **全量级联二次裁决（本岗验收期发现）**：定向 19/19 绿但全量 2194 跑 test 15/16 红——
   老段装具 aimDownAt/clearAim 运行时覆盖/删除 globalThis.camera（6 处），全量跑序下
   T-G04 段相机桩基值被污染（fov undefined）。修法：freshInit 公共入口统一复位相机桩
   （glideCamStub，单一事实源）；test 15 复原后其 cleanup 正常执行，test 16 级联自愈。
   此为测试装具跨段隔离缺陷，红方所有权内修复。
7. 链式前置红可接受（整链未接线时前置失败即第一红点，红因按组记）。

## 四、spec §7 U-01 回填前后对照

- 前：`两路径验收已备齐（§3.6）；**定稿后唯一遗留回填点（不阻塞拆票/施工）——实现票评估代价后回填本行**`
- 后：`**已回填（T-G04，2026-11-16）：路径 B 第一人称退化**——自动第三人称需扩引擎 CameraRig（setMode/滑翔中视角锁/滑翔专用距离）与 input.js V/C 挂起两处票外文件，且引入「落地恢复滑翔前视角」的保存/恢复竞态，代价偏高；退化路径全部落在模式层（FOV 微扩 +6°~8°/0.3s 匀速+准星常显+金描边状态信号，§3.6 路径 B 三验收全过）`
- 决策规则列原文保留（实现线评估→结论回填本行）。

## 五、转绿轨迹

### 绿方实现改动（js/modes/adventure.js +210 行、js/config.js、css/style.css）

| 文件 | 改动 |
|------|------|
| js/modes/adventure.js | 滑翔消费面全量：迁移点 setWings('spread'/'hidden')、advSyncArmor 全路径 forceWingsHidden() 对账、HUD 槽抑制、动作闸、蓄力清理、FOV 消费、切模式/死亡收口；两处实现侧修正——①模式层展/收翼音效防抖删除（吞 16 帧真沿，防抖归 SFX 注册表 effects.js coolMs:300）；②onMouse 闸从顶部一刀切收窄为四类五处落点短路（spec §3.4 R1-18「禁列以四项为准」，一刀切曾误拦引擎残留窗口的穿翼——诊断暴露的实现真缺陷） |
| js/config.js | GLIDE 块追加 fovKick/fovTime（相机路径 B：FOV 相对偏移 +6°~8°/0.3s） |
| css/style.css | .armorbar-slot.glide-glow 金描边呼吸：#e9b115、border-color alpha 1.0↔55%、1.6s ease-in-out（不用 opacity 防图标同闪；参数被测试静态断言锁死） |

### 红→绿过程

- 绿方诊断镜像（.scratch/glider/tg04-diagnostic.test.js，只补装具机械、本体断言逐字）：
  v3 14/5 → v4 16/3 → v5 17/2 → v9 **19/19 全绿**（diag-v9.tap）。
- 绿方交付时原文件 6 绿/13 红（13 红即 §三.5 异议清单），本岗裁决后**由红方**将镜像
  v9 改动移植回原文件（剔除 3 处诊断 console.log + 路径还原，tg04-merge-diag.js
  脚本化移植，残余 diff 逐字核验仅剩路径与打印差异）。
- 本岗追加相机桩复位（§三.6）后：定向 19/19 全绿。

## 六、验收与门禁（cmd 字节级证据落盘 .scratch/glider/receipts/）

| 项 | 结果 | 证据 |
|----|------|------|
| 定向 T-G04（最终树） | 19 tests / 19 pass / 0 fail | tg04-acceptance-final.tap |
| 全量 npm test | **2194 tests / 2193 pass / 0 fail / 1 skipped**（=经理定目标） | tg04-full-test-final.log |
| npm run lint | 整树零错误（eslint+stylelint+htmlhint） | tg04-full-lint3.log |
| 规范守门 | conventions 12/12 绿（含全量内） | 同全量 |

## 七、票外发现（报备不扩票）

1. T-G05 票外发现草稿注释曾现 adventure.js（来历不明 M，stash 时自行消失=并行会话动过
   本 worktree）；处置：不追踪不还原，提交只 add 所有权文件。
2. PowerShell 管道对 node --test 输出不可信（GBK 解码丢行/乱码/覆盖回执文件亦受波及）；
   本票全程 cmd 字节级重定向 + node 按 UTF-8 解析。建议后续票沿用（conventions §7 候选）。
3. 老段装具对 globalThis.camera 的运行时覆盖/删除是跨段隔离隐患（本票 §三.6 已在
   freshInit 复位收口）；其它全局（CameraRig 等）如有同类风险建议工程线排查。
4. 绿方施工期自行 merge main（effdce1）——后经经理通报定性为 PO 压令先并再施工，非越权。
5. docs/glider-tickets.md 工作树另有他线未提交 M，本票不 add 不触碰。

## 八、文件清单与提交

add（所有权文件六件）：
- js/modes/adventure.js（滑翔消费面）
- js/config.js（GLIDE 块 fovKick/fovTime）
- css/style.css（金描边）
- docs/glider-spec.md（仅 §7 U-01 行）
- test/adventure-mode.test.js（T-G04 段 19 测试+装具）
- .scratch/glider/receipts/T-G04-receipt.md（本回执）

提交信息：`T-G04 探险装配合入: 滑翔接线/迁移点消费(四态机v1.2)/金描边/HUD槽抑制/动作暂停/相机U-01+spec§7回填（红转绿+守门绿）`

提交哈希：随完工返回上报派令方（哈希在提交后方存在，不入本提交）
