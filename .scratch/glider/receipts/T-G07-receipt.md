# T-G07 回执 — PO 调参合入: 滑翔缓降 −3.0 → −1.5(浮空翻倍)

- 工单: glider-tickets.md T-G07(微票·spec §3.9 实现期可调参数面, 不判需求变更)
- 执行岗: tdd(红方主人)·工作树: worktree/1631a8/glider·基于 glider@1b668c6
- 日期: 2026-11-16
- 形态说明: 微票红绿同体——既有 sink 断言(voxel.test.js GLIDE_SINK 常量族 + adventure-mode.test.js :5654 动态读)即参数的可执行规格, 本票更新常量/值即完成规格更新与实现转绿, 不走严格红→绿循环(票文纪律明示)。

## 1. 改值点清单(逐点核实后执行)

| # | 文件:行 | 改动 | 核实记录 |
| - | -------- | ------ | ---------- |
| 1 | js/config.js:82 | `sink: -3.0` → `-1.5`, 注释同步「PO 实机调参 2026-11-16『浮空更久』: −3.0→−1.5(T-G07; spec §3.9 实现期可调不判需求变更)」 | GLIDE 块唯一 sink 键; 同文件 sinkSpeed(游泳)/sink.crop/sink.sapling(农业)为无关同名前缀, 未触 |
| 2 | test/voxel.test.js:349 | `GLIDE_SINK = -3.0` → `-1.5`, 注释改「PO 实机调参值 2026-11-16(config GLIDE.sink 镜像); spec §3.9 初值 −3.0 已由调参令取代」; 块头注释「参数断言取 spec §3.9 初值」句同步改口径 | T1/T3/收翼转坠/再展等 5 处断言引用该常量自动跟平, 断言语义与阈值逐字未动 |
| 3 | test/adventure-mode.test.js:5654 | **零改** | `assert.strictEqual(G.vel.y, api.GLIDE.sink, ...)` 动态读 config, 自适应生效 |
| 4 | GLOSSARY.md:482 | 「滑翔状态」词条参数表 `sink 缓降 −3.0` → `sink 缓降 −1.5(PO 实机调参 2026-11-16「浮空更久」, 原 spec §3.9 初值 −3.0, 实现期可调不判需求变更)` | 词条结构/七值计数未动; 同词条 `floor(落差)−3`(safeFall)与离地/落差数值为别参数, 未误伤 |
| 5 | docs/glider-acceptance-report.md | **零改** | grep `3.0|−3|sink` 零匹配——报告 54 处「滑翔」皆为文字描述与 fovKick 等他参数, 无缓降数值引用, 无历史登记区需括注 |
| 6 | spec §3.9 | **未触** | 正式记账归需求线(scrum 在办), 本票不动 docs/glider-spec.md |

水平操控 `speed: 5.0` 未动(PO 只点名下降; scrum 明令勿自行改)——voxel.test.js:350 GLIDE_SPEED 及全部操控断言原样。

## 2. 定帧窗口放宽点清单(3+1 处, 只动窗口数, 断言语义与阈值逐字不动)

缓降减半 → 同窗位移减半, 滞空翻倍; 逐测试核算后仅 4 处不够/贴边, 均加「T-G07 调参窗口放宽: 滞空翻倍」注释:

| # | 文件:行 | 窗口 | 核算 |
| - | -------- | ------ | ------ |
| 1 | test/voxel.test.js:416「高度单调不增+滑翔触地」 | 300 → 720 帧 | 9 格滑降 @−1.5/s×DT(1/60)=360 帧 > 原 300, 必超 |
| 2 | test/voxel.test.js:528「滑翔段不计落差」滑降循环 | 200 → 400 帧 | 4.9 格 @−1.5/s=196 帧, 原 200 余量仅 4 帧过贴边, 放宽取稳 |
| 3 | test/voxel.test.js:568「触水软着陆」(T11 同族) | 600 → 1200 帧 | 14 格滑降=560 帧 + 游泳沉底≈136 帧 ≈696 > 原 600, 必超 |
| 4 | test/adventure-mode.test.js:5740「水面软着陆」触水窗 | 60 → 160 帧 | 既有诊断 patch 注释账「3/s 需 40 帧」→ 1.5/s 需 80 帧 > 60; 注释同步改写(30→60→160 谱系) |

核算后确认**不需要**放宽的同族窗(留痕备查): voxel.test.js :482/:589 滑到离地≈3 的 200 帧窗(3.9 格=156 帧, 余量 44); 8 处 400 帧落地窗(adventure 走崖塔 6 格滑降=240 帧, 余量 160); voxel 各 600 帧无翼落地窗(与 sink 无关); adventure 60 帧展翼窗(展翼判定在离地沿, 非落地窗)、120 帧蓄力观察窗、18 帧 FOV 窗、15 帧位移窗(速率无关或新速率下更宽松)。T11 滑翔触水即 voxel.test.js :560 测试(「触水面软着陆」), 其窗口即上表 #3。

## 3. 耦合核查结论(scrum 点名第 6 点: 落差累计/摔落伤害)

**零耦合, 实证全绿。** T-G05 面(adventure-mode.test.js :5355-5496)全部经 `landEvt(fall, gliding)` 直写 vm 域 worldEvents 真对象注入事件, **不跑引擎物理步**; 伤害 = `max(0, floor(landFall)−3)` 按「峰值−落点」计量(voxel.js fallPeakY 累计器), 与下降速率无关。定向跑 T-G04/T-G05 段 27/27 全绿(含 20 格滑到 2 格取消只摔 2 格账、3/5/10 格阶梯、击退同式、传送免疫)。未核出任何「帧数×速率推落差」式耦合, 无需报经理的伤害断言改动。

## 4. 门禁数字

| 门禁 | 结果 | 基线 |
| ------ | ------ | ------ |
| 定向 voxel.test.js 全文件 | 42/42 pass, 0 fail(改值后与注释换行后各跑一遍) | — |
| 定向 adventure-mode.test.js T-G04/T-G05 段 | 27/27 pass, 0 fail | — |
| 全量 npm test | **2196 tests / 2195 pass / 0 fail / 1 skipped** = 基线一致(复跑 4 遍稳定) | 2196/2195/0/1 |
| npm run lint | 零错误(首跑抓到 voxel.test.js 行尾注释超长 142>120, 注释挪独立行后复过) | 零错误 |

提交: 见 git log(哈希见完工返回)。

## 5. 票外发现(不擅自扩票, 如实上报)

1. **js/voxel.js:403 注释数值过时**: splash 判据注释写「滑翔触水缓降(−3.0)同样过不了高速门」。新值 −1.5 下机制描述依然成立(−1.5 同样 > −4 门), 仅括号数值过时。voxel.js 属禁触面(票文: 其他任何 js/css), 未改, 请经理定夺是否随下票顺手平注释。
   **【GP07 微补丁落地 2026-11-16】经理裁准顺手平: voxel.js:403 注释数值化更新「滑翔触水缓降(−1.5, T-G07 调参后; 初值 −3.0 同理)」, 机制描述不变、零行为(eslint 零错误+voxel 42/42 自证), 随微补丁提交入账。
2. **全量首跑偶发红未复现**: 改值后第一次全量出现一次 ERR_ASSERTION(operator `==`, actual false/expected true, 自定义消息), **未复现**——同一代码状态连跑 4 遍全量全部命中基线 2196/2195/0/1。代码在红绿两次运行间零改动, 判定与本票无因果, 属时序敏感型偶发(仓库有同族「浮点边界诊断 patch」先例, 如 :5711 落地跑动窗 10→15 帧)。未定位到具体测试名(首跑输出未留全), 若经理需要可后续专票蹲点。
3. docs/focus-interaction-research.md:286、docs/mc-mutant-creeper-research.md:15 的 `-3.0` 字样为无关主题误配, 未触。

## 6. 纪律自查

- 禁触面零触碰: docs/glider-tickets.md(工作区有其改动, 系经理在办, 未 add)、docs/glider-spec.md、docs/design/glider-ui-spec.md、其他 js/css 未动。
- 未改任何断言语义与阈值; 窗口放宽仅动帧数; 未写票外测试。
- add 所有权文件: js/config.js、test/voxel.test.js、test/adventure-mode.test.js、GLOSSARY.md、本回执(glider-acceptance-report.md 零改无差异可 add)。
