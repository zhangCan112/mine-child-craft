# T-G05 无翼摔落伤害结算 · 施工回执（tdd 主人: 红方）

> 票面: docs/glider-tickets.md「T-G05 无翼摔落伤害结算」节（376 行起, 要求 1-5 与验收块）
> 规则权威: docs/adr/0014（规则形状+零 TTS 红线）· docs/glider-spec.md §3.5（落差口径/事件缝约束）/§3.9（参数初值）
> worktree: C:\Users\user\.local\share\opencode\worktree\1631a8\glider（分支 glider, 开工基线 HEAD=2b09379; 收尾时 tip 已被工程线簿记推进至 36b267f, 零文件重叠自然叠加）
> 状态: **绿已验收并按窗口令提交——6 红全绿 · 测试仅红方两处中立修订(§3 裁决 5/6) · 门禁三件全过（2026-11-15）**

## 1. 测试缝（先于写红确认）

单缝: **模式层行为面**——test/adventure-mode.test.js 追加 T-G05 组（6 test 块 + landEvt 注入 helper）。
装具事实: 测试 pos/vel 为假件（不跑引擎物理步）, 事件注入=直写 vm 域 `api.worldEvents` 真对象
（与 voxel.js:431-435 引擎置位同帧语义）, `AdventureMode.update(dt)` 消费。
引擎面事实（落差累计/滑翔重置/入水清零/跃迁沿）归 T-G02 谱系已测面（test/voxel.test.js 禁触未动）,
本票零引擎改动、零重复断言。

## 2. 红测试清单（验收块 ↔ 测试 ↔ 红因）

定向命令: `node --test --test-name-pattern "T-G05" test/adventure-mode.test.js`
红基线输出: `.scratch/glider/receipts/T-G05-red.log`（6 tests: 1 pass / 5 fail; **红因分类: AssertionError×5, 零装具炸**）

| # | 测试 | 票面验收块 | 红因（AssertionError 实读） |
|---|---|---|---|
| R1 | 摔落参数表: 3 格无伤 · 5 格扣 2 · 10 格扣 7 · 击退高度同式(规则一元) · 零 TTS | 验收① 参数表全链 + 要求 1 公式 + 要求 4 零 TTS | 「3 格事件被消费」true!==false（事件无人清回） |
| R2 | 滑翔零伤: 触地滑翔态任意落差零伤害 · 20 格滑到 2 格取消只摔 2 格账 | 验收①滑翔段不计案例 + 要求 1 gliding 零伤害 | 「滑翔触地事件同样消费即清」true!==false |
| R3 | 摔至血尽: 走现有死亡流程(重生满血+背包全保留) — 死亡安抚话术属存量非新增 | 验收② 血尽死亡链 | 「存量死亡安抚话术」actual false（landFall=99 未结算→未死→无话术） |
| R4 | 落水零伤(有翼无翼任意高度) + 平地帧零结算 | 验收③ 落水/1.42 格锚 | 「无伤事件同样消费即清」true!==false |
| R5 | 传送免疫(观察项 2): 死亡/传送(spawn)后首个 land 事件零结算, 后续真实摔落照常 | 观察项路由(派令) | 「幻影事件被吞(消费即清)」true!==false |
| G1 | 他模式零参与: build/arena 不订阅 land(静态守门) | 验收③ 他模式零参与 + 要求 3 | 恒绿护栏（红因=不适用; 负向静态守门, 「不订阅即天然不参与」的可证形状） |

单一根因: 模式层无 worldEvents.land 消费代码。既有测试零误伤（全量无回归, §6）。

## 3. 裁决记录（红方）

1. **消费缝=模式 update 读 worldEvents**（非 main.js 分发同缝）。理由: ① main.js 不在本票所有权
   清单; ② 流体环境伤（drownTick/lavaTick, adventure.js:4880-4887）就是模式 update 读 worldEvents
   结算 HP 的同构先例——摔落同属环境伤漏斗（spec §3.5）, 同缝消费语义一致; ③ splash/voidFall 走
   main 分发因多模式共享（音效/死亡政策）, land 伤害仅探险消费（要求 3）, 无分发必要。落位:
   update 内流体环境伤块紧后（adventure.js:4914 起）。
2. **取整口径=Math.floor（向下取整=儿童友好档, spec §3.9 括注）**, 测试以 1.42 格平地跳锚证
   （floor(1.42)−3<0 恒无伤）。
3. **观察项 2（T-G02 评审观察项 2）可达性结论: 可达, 模式层最小修已同票修**。
   验证链: kitSpawn（mode-kit.js:76-84）置 pos/vel 且 onGround=false, 但 fallPeakY 写面钉死
   voxel.js physics（:206 注释）——spawn 无重置缝 → 死亡/传送后首物理步 `!wasGround` 跃迁沿置位
   land, landFall=残留峰值−落点y=幻影大额。「高台摔死→重生→幻影再死」为本票自身无限循环雷;
   同会话切模式重进（建造 fallPeakY 残留→探险档落位）同路径。修法=adventure.js 内 advTeleport
   包装（ModeKit.spawn+免疫旗）收口全部 7 处传送落位（死亡/回家/睡醒/切界×2/切图/init 有档无档
   单点）, 消费缝吞传送后首个 land 事件（该事件本就是 vel=0 落位伪事件, 不吞真实摔落）。引擎面
   根治（spawn 重置 fallPeakY / 事件携带传送标记）超所有权未做——见 §7 票外发现 1。
4. **零 TTS 可测形状**: mkHurtAlarm.hit 无条件 `speak((r&&r.line)||默认)`（combat-kit.js:63）,
   空话术不可经 r.line 传递——静音路径必须收在 adventure.js（advEnvHurt 第三参 opts.mute: 观感
   三件 sfx('hurt')/Avatar.flash(0.4)/Fx.kick(0.35) 与 mkHurtAlarm.hit 非话术段逐字节同款, 话术
   豁免, 不进 hit——顺带不消耗受击话术 3s 节流窗）。测试断言: 非致死扣血帧 spoken 空+零 toast,
   sfx('hurt') 照走（spec「环境伤观感与战斗同源」, ADR 只豁免话术）。死亡路径话术为存量
   （advPlayerDied 的 T14 安抚）, 非本票新增, 不消不改（ADR「不得补齐话术」禁令的对称面: 也不删）。
5. **测试 R3 解绑裁决（红方修测试, 绿方零参与）**: R3 初版「freshInit 后直接注入 landFall=99」
   把 init 落位伪事件当真实摔落测, 过度绑定实现（排除 init 免疫的合法形状）。已加前置消费帧
   （landEvt(0)+update 先吞 init 伪事件再注入 99）——测试只验证「真实摔落至血尽走现有流程」,
   不钉实现取舍。修订后当前实现两态兼容复验 6 pass。
6. **inPlace 死亡分支不置免疫旗（绿方取舍, 红方核准确认）**: 空中被打死原地复活后下落是真实
   摔落（landFall 含击飞高度=票面要求 5「按击飞高度计」明文）, 置旗反吞真摔落; 且该分支
   resetFighter 不动位置、摔死帧已贴地无跃迁沿, 天然无幻影。
7. **无伤事件只消费不结算**（绿方取舍, 红方接受）: advDmg=0 不走 advEnvHurt——无伤不播受击
   音/闪红（无伤却挨打观感是错的）; 事件仍清回（消费即清契约不欠账）。

## 4. 转绿轨迹

- 开工红: 5 fail + 1 pass（§2）。
- 绿方第一轮: 消费缝+公式+mute 路径+advTeleport 6 传送口 → 定向 6 pass; eslint 零错误; 全量
  2175/2174 pass/0 fail/1 skip。票外发现 1（init 落位未包免疫）报回。
- 红方裁决 5（测试解绑）落地后, 续令绿方补丁轮: init 落位并入 advTeleport（有档/无档单点
  advSpawnAt 汇流, 一处改两态全挂）+收口判据注释 → 定向复跑 6 pass; eslint 零错误; 全量同数字。
- 红方终验: 亲读实现 diff（消费顺序=读数先取→清→免疫吞/滑翔零伤/公式→advEnvHurt(mute); 公式
  `max(0, floor(landFall)−GLIDE.safeFall)×GLIDE.fallHp`; 守门合规零玩家六绑定直写）; 亲跑定向
  6 pass + 全量 + lint（§6）。
- 证据: `.scratch/glider/receipts/T-G05-red.log`（红基线+红因分类段）/ `T-G05-green.log`
  （绿方两轮定向输出）/ `T-G05-full-test.log` / `T-G05-lint.log`（工作区留档, 未随票提交——
  验证日志入库归工程线簿记线, 36b267f 先例）。

## 5. 文件清单（全部提交面）

| 文件 | 改动 |
|---|---|
| test/adventure-mode.test.js | +T-G05 组 6 test 块+landEvt helper（红方）; 装具 api 提取清单补 GLIDE（中性支持, 红断言零涉）; R3 前置消费帧（§3 裁决 5） |
| js/modes/adventure.js | 消费缝（update 内流体块后）: 读数→清→免疫吞/滑翔零伤/公式→advEnvHurt(dmg,null,{mute:true}) · advEnvHurt 第三参 opts.mute 静音路径 · advTeleport+advLandImmuneNext 收口 7 处传送落位 · inPlace 分支不置旗 |
| js/config.js | GLIDE 块 +safeFall:3（无伤阈值）/+fallHp:1（每格扣血）, 块注释消费方收口 |
| .scratch/glider/receipts/T-G05-receipt.md | 本回执 |

零接触: js/voxel.js / js/main.js / js/mode-kit.js / js/combat-kit.js / test/voxel.test.js /
test/conventions.test.js / T-G03 已入库面 / docs/glider-tickets.md（状态列归经理）。

## 6. 门禁窗口记录（随令窗口, 先写后提交）

- 定向: `node --test --test-name-pattern "T-G05" test/adventure-mode.test.js` → **6 pass / 0 fail**（红方亲跑复核）。
- 全量 `npm test`: **tests 2175 / pass 2174 / fail 0 / skipped 1**（exit 0, duration≈157s,
  T-G05-full-test.log）——基线 2169 + 本票 6 新测试 = 2175, skipped 1 为基线固有。
- `npm run lint`: **exit 0 零错误**（eslint+stylelint+htmlhint, T-G05-lint.log）。
  注: 绿方施工期 conventions 玩家六绑定守门曾对注释内 `onGround=` 字样按行正则报违规,
  已改注释措辞「清离地标记(onGround 归引擎口径)」——守门口径合规, 非改测试。
- 提交哈希: 即本提交自身（自引; 以 git log/完工回报为准）。
- 期间上游: 工程线簿记 36b267f（UI spec v1.1+T-G03 日志）推进 tip, 与本票文件零重叠。

## 7. 票外发现（交派令方）

1. **引擎面根治缺口（T-G02 谱系路由建议）**: spawn 不重置 fallPeakY 的模式层补丁（免疫吞首
   事件）覆盖了本模式全部传送口, 但「事件携带传送标记/物理缝重置峰值」的引擎面根治仍缺——
   未来任何新模式消费 land 事件都会重踩幻影坑。建议开票归引擎线裁。
2. **mkHurtAlarm 零话术无参数化路径**（combat-kit 深接口观察）: r.line 空串/undefined 会 fallback
   默认话术, 「合法零话术」经漏斗不可表达——本票在 adventure.js 本地静音收口（合规但复制了观感
   三件）。若后续第二消费方需要零话术, 值得给 kit 加显式静音位（归 kit 所有权线, 本票未动）。
3. **摔落不消耗受击话术 3s 节流窗**（mute 路径副作用, 正面）: 摔后 3 秒内被怪打照说受击话术。
   登记备查非缺陷。

## 8. 评审补测窗口（2026-11-16, 解冻追令落地）

> 评审通过零阻塞项; 经理裁定两条可选补测落防回归网 + 一条注释措辞修正。
> 中途经历暂停令/摘除令（T-G04 并行施工同文件让位, 本人 hunk 整体还原零残留）,
> T-G04 合入（4a00290）后树净解冻重落。基线 HEAD=6d54554。

### 三件 ↔ 评审缺口映射

| 件 | 落点 | 堵的回归网眼 |
|---|---|---|
| 块 A inPlace 血尽变体 | test 尾追加（T-G04 块后, 零触碰其块） | 后人误在 inPlace 分支置传送/免疫旗 → 空中复活真摔落被吞无人报警 |
| 块 B 传送单点收口 | 同上 | 新增传送口绕过 advTeleport 直调 ModeKit.spawn → 幻影防护链漏口 |
| advTeleport 注释修正 | js/modes/adventure.js 仅注释 | 「不吞真实摔落」对空中档位过度声明 → 按实际行为改准确（地面锚定落位不吞; 空中续档首落点落差账随首事件吞免, 漏结一次为已知儿童友好向局限, 引擎面根治登记 §7.1） |

### 块 A 装具事实（经理已认可的等效方案）

追令原意动态切 inPlace（freshInit 后换 profile 注入致死摔落）在本装具不可达:
advProfile 是 adventure.js（CJS require）模块作用域 let, 运行时换装走 showroom
门面的 vm 共享词法（test/showroom-mode.test.js:371-383 专用装具先例）, 本文件
无动态切换缝且纪律禁扩接口面。inPlace 死亡链行为面（满血+夜怪清场+原地复活）
已由 showroom 装具覆盖（:1388）。等效静态切片守门: inPlace 分支体（首个 return
前 ≤600 字符窗）零 advTeleport / 零 advLandImmuneNext / 零 advInv——任何形式的
误置位/误触背包都被切片抓住, 网眼等效闭合。

### 门禁（窗口随令）

- 定向: `node --test --test-name-pattern "T-G05" test/adventure-mode.test.js` →
  **8 pass / 0 fail**（原 6 + 新 2）
- `npx eslint test/adventure-mode.test.js js/modes/adventure.js` → 零错误
- 全量 `npm test`: **tests 2196 / pass 2195 / fail 0 / skipped 1**（exit 0,
  duration≈176s, T-G05-patch-full-test.log）——与追令预期逐项一致
  （基线 2194/2193 + 新 2）
- `npm run lint`: **exit 0 整树零错误**（T-G05-patch-lint.log）
- 提交哈希: 即本提交自身（自引; 以 git log 为准）
