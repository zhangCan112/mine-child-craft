# T-G02 完工回执 — 引擎层：滑翔物理状态机 + land 事件缝 + 落差累计

- 票：docs/glider-tickets.md「T-G02 引擎层」节（唯一任务书）
- 岗：tdd 主（红方主人，一票一主）· 绿方：implement-engineer（本岗派发，会话 ID 见 §5）
- worktree：`C:\Users\user\.local\share\opencode\worktree\1631a8\glider`（分支 `glider`，基线 9ee82e7）
- 图谱：开工就绪检查 status=ok（6306 nodes，锚 9ee82e7 与 HEAD 一致，未做 full_rebuild）

## 1. 红测试清单（票面验收块逐项对应）

装具扩展（验收块①）：`test/voxel.test.js` loadVoxel 桥接三件 —— `get setGliderEquipped` /
`get isGliding`（惰性 getter：红阶段既有 29 条零波及，新测试红因=干净的 API 缺失红）+
`get gliding`（内部旗标只读桥）。既有 29 条测试一字未动。

| # | 测试名（test/voxel.test.js） | 对应票面验收/要求 | 红因（红基线实测） |
|---|---|---|---|
| T1 | 滑翔: 装备位 on + 离地>2 自动展翼(vel.y=缓降恒值); 恰 2 格不展(整格比较锚) | 验收① 展翼+缓降恒值；要求 2（不分起因：走落情境无跳跃） | ReferenceError: setGliderEquipped is not defined |
| T2 | 滑翔: 平地跳跃不误展(阈值 2 > 跳高 1.42 自洽锚); 落地 land 落差≈1.42 | 验收① 平地跳不误展；要求 6（平地跳 1.42 恒无伤的计量锚） | 同上（API 缺失红） |
| T3 | 滑翔: 高度单调不增; 滑翔触地 land 携带滑翔态=true | 验收① 高度单调不增；要求 5（land 携带触地时滑翔态 → T-G05 零伤害旗标） | 同上 |
| T4 | 滑翔: yaw 同源水平操控 5.0 格/秒, 不享受疾跑, 方向随 yaw 旋转 | 验收① yaw 操控生效；要求 2（水平=yaw 同源、不享受疾跑） | 同上 |
| T5 | 滑翔: 滑翔中按 Space 主动取消 — 立即收翼+闩锁(高处经过不重展, 按住不振荡) | 验收② 取消→收翼+闩锁+不重展；ADR 0016 闩锁语义 | 同上 |
| T6 | 滑翔: 闩锁态空中再点 Space = 解除闩锁+主动再展翼 | 验收② 闩锁中再点 Space 再展 | 同上 |
| T7 | 滑翔: 落地闩锁无条件清除 — 再从高处腾空恢复自动展翼; 落差自收翼点重计 | 验收② 落地清闩锁恢复自动展翼 | 同上 |
| T8 | 滑翔: land 事件 — 10 格无翼坠落落差≈10、触地滑翔态=false | 验收③ land 事件第一断言 | 同上 |
| T9 | 滑翔: 滑翔段不计落差 — 滑到离地约 2 格取消再坠 2 格落地, land 落差≈2 | 验收③ 落差≈2（滑翔段不计入，单测断言） | 同上 |
| T10 | 滑翔: 无翼落入深水 — splash 置位、水下触底零 land 参与、落差累计清零 | 验收③ 入水触发 splash 且落差累计清零 | **AssertionError: 高速入水 splash(既有语义)（断言红，见 §3 票外发现 A）** |
| T11 | 滑翔: 触水面软着陆 — 收翼+溅水+入水转游泳, 零 land 参与, 落差清零 | 验收④ 滑翔触水面收翼转游泳+落差清零；spec §3.4 水面软着陆（收翼+溅水+入水转游泳） | 同上（API 缺失红） |
| T12 | 滑翔: 滑翔中装备位置 off — 立即收翼按无翼坠落, 落差自收翼点重计 | 验收⑤ 装备位 off（含滑翔中置 off） | 同上 |
| T13 | 滑翔: flyMode 优先 — 飞行中装备位 on 不判滑翔(引擎分支边界) | 要求 2 边界「flyMode 优先（飞行中不判滑翔）」 | 同上 |

### 红基线自证输出（2026-11-15，`node --test test/voxel.test.js`）

```
tests 42 · pass 29 · fail 13
红因分类（§7.4 口径，实读输出）：
- 12 × ReferenceError: setGliderEquipped is not defined —— API 缺失红（新意图 API 未实现，
  惰性 getter 桥接保证既有 29 条零波及）
- 1  × AssertionError（T10「高速入水 splash(既有语义)」）—— 断言红：现引擎 splash 门不可达（§3-A）
既有 29 条 voxel 测试全绿零回归；test/conventions.test.js 12 条全绿（守门正则预置不红）。
```

## 2. 裁决记录（红方主人裁决，随票留痕）

1. **意图 API 命名**（票面要求 1「命名归实现线」——红测试即契约，命名由本岗钉死）：
   - 入口 `setGliderEquipped(on)`：语义=「玩家背着滑翔翼」（装备判断归模式层，引擎只收
     boolean 结果）。先例 `setFly`（voxel.js:226）的 set+旗标命名式。
   - 出口 `isGliding()`：滑翔态可读查询（票面允许 getter 或迁移标志；函数查询无裸写面，
     与「其余写者一律走意图入口」白名单哲学一致）。T-G04 在展/收翼迁移点消费。
2. **内部绑定名**：`gliding`（滑翔旗标）/ `glideLatch`（取消闩锁）/ `fallPeakY`（落差累计
   峰值）——名字随本裁决钉死，理由：① `gliding` 与 flyMode 同待遇进 conventions.test.js
   守门正则与装具只读桥，名字必须一致才守得住；② 白名单登记（voxel.js 玩家段头注释）
   需要稳定名。写面=physics 自身 + `setGliderEquipped` 意图入口，其余零裸写。
3. **land 事件形状**（票面要求 5「照 voidFall/splash 置位惯例 + 携带落差与触地时滑翔态」）：
   `worldEvents.land`（布尔置位，消费方自清）+ `worldEvents.landFall`（本次落差，格数，
   number）+ `worldEvents.landGliding`（触地时滑翔态，boolean）。数据字段与置位同帧写入；
   消费方只在 `land===true` 时读（置回 false 后残留值无消费方）。
4. **离地列探实现路径**（票面要求 3，归实现线裁决的落点已由本岗锁定方向）：
   引擎内用 `raycastVoxel({pos}, {0,-1,0}, WORLD_H, isSolid)` 向下列探，离地高度 =
   `pos.y − (hit.y + 1)`（脚到地表顶面）；穿水直达水底（isSolid 滤水），与 spec §3.4
   「列探到水底」口径一致；探测落空（脚下全空直至界外）按可展翼处理（void 方向语义由
   voidFall 兜底不变）。**严禁引用 mobs.js `groundUnderAt`（红线 2，引擎→应用反向依赖）**。
5. **水面/水下零 land 事件**：入水（滑翔软着陆或无翼落水）一律不置 land——splash 是水
   的唯一事件，land 只属实地触地。依据：票面验收「滑翔触水面：收翼转游泳、零伤害参与」
   + spec §3.5「落水（无论有无翼、无论高度）零伤害」。实证补强：若水下触底照发 land，
   深水池底落差会计入大额账，T-G05 无论怎么过滤都要背水的特判——引擎侧一刀切最薄。
6. **滑翔触地 land 的落差值不钉死**：滑翔触地事件只断言 `landGliding === true`（T3）；
   落差值（峰值跟踪式 ≈0 或冻结展翼点式为大值）留给实现线——伤害安全性由
   `landGliding` 旗标兜底（T-G05 合同：「gliding=true 的触地事件零伤害」）。
7. **§1.10 升格裁决（票面要求 7）——结论：`gliding` 纳入 conventions.test.js 守门正则
   （与 flyMode 同待遇）；`glideLatch`/`fallPeakY` 不纳入，只做白名单登记。**
   理由：判据两条全中——清单多处出现（voxel.js 定义、conventions 正则、T-G04 即将消费、
   装具桥接）且手滑必炸在运行时（模式层直写 `gliding = true` 绕过意图 API，物理状态机
   与模式层表现立即分叉——正是 flyMode 当初入正则的同型风险）；闩锁/落差累计是纯内部态，
   模式层无合法用例（票面只要求滑翔态对外可读），不入正则（§1.10「≥3 处消费」不成立，
   只在 voxel.js 一处使用）。已实施：conventions.test.js 守门正则
   `(?<!\.)\b(yaw|pitch|onGround|flyMode|gliding)\s*=` + 注释与失败提示语同步；模式文件
   现状零命中，守门预置即绿。
8. **参数块落点**（票面要求 8）：config.js 滑翔专属参数块（落点风格照 PLAYER:60-73），
   三参数按 spec §3.9 初值：展翼高度阈值 2 / 缓降速率 −3.0 / 滑翔水平操控 5.0。
   **不落伤害两参数**（无伤阈值/每格扣血，T-G05 顺延）。红测试不绑 config 键名——
   断言绑行为值（spec §3.9 初值），键名属实现自由，落点写入 §4 文件清单。
9. **测试争议裁定**（绿方对 T10/T11 的打回请求）：绿方举证 `assertAccumCleared` 三处
   测试侧缺陷（贴地残留短路循环 / 落点 z 坐标出地板 / T11 装备位未卸）——逐条实证
   全部成立，裁定为**本岗测试缺陷，修测试**（断言语义零变更，实现零再改动）；这是
   「测试是本岗的产物，该修就修」的执行记录。绿方程序正确（只说明未改测试）。

## 3. 票外发现（如实记录，未擅自扩票）

- **A. 现引擎 splash 事件实际不可达（红基线 T10 断言红暴露）**：`voxel.js:341` 的
  splash 门 `vel.y < -4` 在游泳分支把 vel.y 钳到 `−FLUID.sinkSpeed(−1.6)` **之后**求值，
  任何入水路径到门时 vel.y 都 ≥ −1.6，门恒假（实证：20 格高坠入两格深水，入水帧
  vy=−22 → 钳制后 −1.6 → splash 恒 false，见调试轨迹：frame50 y=10.42/vy=−22.10 →
  frame60 y=10.16/vy=−1.60，全程 splash=false）。research §1「现状 splash 即 vy 清零」
  的 vy 截断为真，splash 事件部分与现状不符。**本票验收「入水触发 splash」因此是票内
  必改点**（让入水 splash 真实可达 + 滑翔软着陆溅水），实现按最小修正处理，不改 main.js
  分发（既有 sfx('splash') 通路原样受益）。
- B. 票面 T9 场景「滑翔至 5 格取消再坠 2 格落地 → 落差 ≈2」按 spec §3.5
  「滑到 5 格高取消→摔 5 格的账」对照解读为：**自离地 7 格滑翔下降 5 格（滑翔段不计账）
  至离地约 2 格处取消，再无翼坠 2 格落地 → 落差≈2**。与 spec §3.5「自收翼点重新累计」
  与 T-G05 案例「滑到 2 格取消→只摔 2 格账」同构，无矛盾。（测试按此解读落，T9。）

## 4. 文件清单（本票实际触碰）

| 文件 | 改动 |
|---|---|
| test/voxel.test.js | 装具桥接三件（惰性 getter）+ 新增滑翔测试节 13 条（票面验收逐项映射见 §1） |
| test/conventions.test.js | §1.10 裁决实施：玩家绑定守门正则加 `gliding` + 注释/提示语同步（裁决见 §2-7） |
| js/voxel.js | （绿方施工，见 §4b） |
| js/config.js | （绿方施工，见 §4b） |
| .scratch/glider/receipts/T-G02-receipt.md | 本回执 |

禁触清单（T-G01 并行票 / 模式文件 / UI / docs）全程零触碰：js/items-core.js、
js/item-hint-registry.js、js/icons.js、js/craft-core.js、js/equipment-core.js、
js/adventure-core.js、GLOSSARY.md、js/modes/ 全部、一切 UI 文件、docs/glider-tickets.md。

## 4b. 绿方施工文件清单（验收后回填）

| 文件 | 改动（一句话） |
|---|---|
| js/voxel.js | 新增滑翔绑定五 `let`（gliding/glideLatch/fallPeakY/gliderEquipped/prevSpace，玩家段头注释白名单已登记写面）+ 意图 API `setGliderEquipped`/`isGliding` + physics 滑翔状态机（raycastVoxel 列探展翼/触流体收翼/卸翼收翼/Space 边沿取消闩锁）+ 垂直恒缓降分支（yaw 同源水平操控不享疾跑）+ land 事件缝（hitY 跃迁沿置位、流体触底零参与、landGliding 收翼前置位）+ 落差累计器（贴地/滑翔/流体锚定，腾空取最高）+ splash 门修正（帧首 vyStart 快照）+ worldEvents 三新字段 |
| js/config.js | PLAYER 块后新增 `GLIDE` 参数块（deployHeight 2 / sink −3.0 / speed 5.0，中文注释，伤害两参数留白 T-G05 顺延） |
| .scratch/glider/probe-accum.js | 绿方争议实证探针（未跟踪 scratch 工件，非源码非测试，供复跑核验） |

git 复核：源码改动仅上述两文件；工作区其余改动文件（docs/glider-tickets.md、
test/adventure-mode/armor-overlay/craft-core/equipment-core/mode-kit.test.js）系 T-G01
并行票与工程经理的在途交付，本票零触碰。

## 5. 转绿轨迹（绿方派发与验收）

- 派发：前台阻塞派 implement-engineer（会话 `ses_e21026632ffe8CUV2O8c5jSYw7`），派令
  自足（票面/分支/红测试指针/钉死契约/文件权限/命令纪律），验收标准写死「红测试全绿
  且不得改测试」。
- 绿方轨迹：13 红一次转 11 绿；T6 首版红（同一 Space 边沿被「解闩再展」与「取消」双
  消费自相抵消）→ 改为帧首滑翔态单次分派（滑翔中=取消 XOR 闩锁中=解闩再展）转绿。
  T10/T11 余红，绿方举证为我方测试助手缺陷（见 §2-9 裁定）。
- 争议裁定（本岗裁决，绿方只说明未改测试——程序正确）：`assertAccumCleared` 三处
  测试侧缺陷成立——①入口被池底贴地残留 onGround=true 短路（下落循环零帧）②传送落点
  z=51.5 不在干地板 z∈[40,44] 上方（坠虚空）③T11 调助手前装备位仍 on（按 T1 合同
  离地 4 必自动再展、落差≈0）。修法：助手补 `v.onGround=false` 夹具腾空 + 落点 z 改
  42.5；T11 调助手前补 `setGliderEquipped(false)`。断言语义零变更，实现零再改动。
- 本岗终验复跑（绿方完工返回即验收请示，亲自复跑）：

```
node --test test/voxel.test.js      → tests 42 · pass 42 · fail 0（exit 0）
  = 既有 29 条零回归 + 红测试 13 条全绿
node --test test/conventions.test.js → tests 12 · pass 12 · fail 0（exit 0）
  = 玩家绑定守门(含 gliding 正则)绿；模式文件零改动零命中
node --test test/boot.test.js       → tests 8 · pass 8 · fail 0（exit 0）
  = boot 全链冒烟绿（共享词法环境加载无炸，游戏可跑性冒烟过）
```

- 验收复核（本岗亲自过 diff）：GLIDE 参数块三值=spec §3.9 初值；五绑定白名单登记于
  voxel.js 玩家段头注释（gliding 注明已入守门正则）；land 事件跃迁沿置位+数据同帧；
  landGliding 在收翼前置位（滑翔触地=true 旗标）；splash 修正=帧首 vyStart 快照+滑翔
  触流体显式置位（最小修正，main.js 零改动）；禁引 mobs 仅存于禁令注释；滑翔逻辑全在
  walk 分支内（flyMode 分支天然优先，T13 绿实证）；建造/竞技场无人调 setGliderEquipped
  →装备位恒 false→滑翔逻辑零参与（验收⑦）。

## 6. 验收结论

**T-G02 通过绿验收，待工程经理统一排全量门禁与提交窗口。**
- 红测试清单 §1（13 条，逐项对应票面验收块）→ 全绿；既有 29 条 voxel 测试零回归。
- 定向三套件全绿（voxel 42/42 · conventions 12/12 · boot 8/8，exit 0）。
- 全量 `npm test` / `npm run lint` 与 git commit 未跑未做（按共享 worktree 并行纪律③，
  留给工程经理两票合流后统一排窗口放行；会用 sessionID 追令）。
- 票外发现两项如实上账（§3-A splash 门既有不可达缺陷已按票内验收要求最小修正；
  §3-B 票面 T9 场景句的解读记录）；spec/票面/模式文件零改动，零扩票。

## 7. 合入窗口执行记录（2026-11-15，经理令：T-G01 已提交 41f187f，树串行窗口归本票）

1. **lint 清零（窗口令步骤①）**：GP01 全量 lint 实测报 test/voxel.test.js:497 共
   8 errors（brace-style×3 + block-spacing×5）——T7 测试的紧凑单行循环
   `for (…) { v.physics(DT); if (…) { …; break; } }` 单行块多语句踩规。修法：展开为
   多行（语句语义零变更，断言零变更）。复核：`npx eslint test/voxel.test.js` 0 错误
   exit 0。
2. **全量门禁（窗口令步骤②）**：
   - `npm test`：**tests 2154 · pass 2153 · fail 0 · skipped 1 · exit 0**。skipped 1
     为 adventure-core.test.js:2802 T7 性能钉测（env 门控 T7_PERF=1 才执行，既有设计，
     非本票文件非本票造成）。全量含本票定向已证口径：voxel 42/42、conventions 12/12、
     boot 8/8。
   - `npm run lint`：**整树零错误 exit 0**（eslint . + stylelint + htmlhint 三门全过）。
3. **提交（窗口令步骤④）**：只 add 所有权六文件（js/voxel.js · js/config.js ·
   test/voxel.test.js · test/conventions.test.js · 本回执 ·
   .scratch/glider/probe-accum.js），提交信息一行中文（经理令原文）。提交哈希：见本节
   末行（提交后补记——自引用不可能，哈希行不入首次提交）。
4. **纪律执行**：docs/glider-tickets.md（状态列归经理）与 T-G01 已入库文件零触碰零
   add；全程未跑 npm install、未切分支、无 junction。

- 提交哈希：（提交后补记——自引用不可能，哈希行不入首次提交）
