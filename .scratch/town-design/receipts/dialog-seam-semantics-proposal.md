# 设计提案·城镇会话面板「距离/失焦自动撤销缝」语义（villager-wave2 · PO 验收案卷①）

> 派令:统筹线(工程线在等语义实装,PO 验收案卷①,24h 优先) · 产出日期:2026-11-15
> 产出方:ui-designer · **性质:提案(PO 评审拍板后才落权威——本文不改 docs/design/ 权威正文、js/、css/、test/、index.html)**
> 事实底座(已由工程线/设计线源码实证,本文只消费不重推导):
> - close 触发面仅两处:`js/town-ui.js` 面板内出口链(ghost defer 分发 :807、选项 end/continue-explore :792)＋离镇弃机链(:976-980 会话中离镇=defer 语义)。
> - 状态机权威映射 `js/town-dialog-core.js`:DIALOG_INTENTS 已含 `'blur'`(:40-43),DIALOG_TRANSITIONS 仅 bubble 态消费 blur→idle(:93);会话七态(greet/guide/seek/help/respond/praise/complete)无任何 blur/距离出口(:94-109)。close 三值路由在 handle 的 next==='idle' 分支(:350-359)。
> - 距离常量 `js/town-ui-core.js` TOWN_UI_PARAMS(:37):`HL_AIM_MAX_DIST: 24`(:65,T-UI-03 命中/标记展示最大距离)、`P_D1_NEARBY: 12`(:61)、「近/远」`P_D2_NEAR: 40`(:62)。装配层 rAF 250ms 节流对账可挂(`js/town-ui.js` start :1098-1105→sync :1025)。
> - 四 kind `landmark|npc|prop|task`(js/town-interact-core.js :36)+会话五值 `greet|tour|seek|help|care`(:37);在册清单 TOWN_INTERACTS(:44-59)中 seek 类任务条目(task:find-bread→market 锚、task:visit-stash→stash 锚)的**会话锚点=目标锚点**。全模式通用(js/modes/showroom.js 复用场景,缝必须模式无关)。
> 设计权威(引用面,只增补不推翻):docs/design/town-ui-dialog-spec.md §1.4/§5.2/§5.4/§6.2/§6.3/§10/§11 · docs/design/town-ui-dialog-prebuild.md §2.2/§2.3/§5.2/§5.3/§6/§8/§9 · GLOSSARY「会话状态机纯核心(TownDialogCore)」词条(:268-269)。

---

## 一、结论速览表

| # | 议题 | 推荐结论(一句话) | 关键依据 |
|---|---|---|---|
| 1 | 距离阈值 | **统一 24 格(=HL_AIM_MAX_DIST 对齐),不豁免不造新数**;防抖用「连续 8 tick(≈2s)超阈才关」宽限窗 | 可点半径=会话有效半径,儿童心智一致;seek 张力由「锚点即目标的在册事实+宽限窗+无损重入」三重兜底 |
| 2 | 超限行为 | **成立**:走面板内「稍后」同路径(result='deferred'),complete 态走「继续看看」同路径(result='continue');**任务会话不豁免** | leaveTown :976-980 已有「位置变化→deferred 收场」同构先例;deferred 任务状态不动(prebuild §2.3),关了再点=无损 |
| 3 | 失焦维度 | 会话态**有意裁剪指针失焦**(鼠标移出面板/窗口零动作);「失焦撤销」只保留 bubble 态既有静默 blur→idle | 面板是屏幕空间控件,儿童指针游走是常态;blur 的 handle 特殊分支(:332-335 零事件静默)不可复用于需发 close 的会话态 |
| 4 | 状态机实装 | **新意图 `distance-exceed`**(DIALOG_INTENTS 十一→十二词)+会话七态转移边+close 路由一行分支;新增 core 纯函数 `dialogSeamTick(prev, dist, opts)` 承载防抖裁决 | 距离几何归装配层(core 零几何不变),收场语义归 core(纯核心可断言);复用 blur 会污染其零事件静默语义+既有测试 :173 |
| 5 | 玩家感知 | **静默收场**:200ms 标准淡出+TTS 掐尾(speech.cancel,与 leaveTown :985 同构),不播任何收场句 | 禁「你离开了」类负面句(零惩罚口径);走远后播报=无人接收的抢话;手动「稍后」句播完/自动缝掐尾的区分=在场/不在场 |
| 6 | spec 落点 | spec §5.2 图+§5.4+§6.2(±§10 新增 B9/B10);prebuild §2.2/§2.3/§5.2/§5.3(12-20 条)/§9-3 收口;GLOSSARY 词条随实现票同步 | 节号逐一核对过(见 §四);prebuild §9-3「Seek 收起」歧义被本缝自然收口 |
| 7 | 守门断言面 | **9 条**(派令最低 6 条),core 面为主、装配面为辅,衔接 prebuild §5.3 编号 12-20 | 见 §五 |
| 8 | 开放问题 | **5 条**(均不阻塞实装,参数化或留观察点) | 见 §六 |

---

## 二、四问逐项:候选 / 推荐 / 理由

### 问 1:距离阈值取多少?

**候选:**

| 派 | 值 | 出处 | 一句话评价 |
|---|---|---|---|
| A. HL_AIM_MAX_DIST 对齐派 | 24 | `js/town-ui-core.js` :65(T-UI-03 命中/标记展示最大距离) | 与「玩家可点对象」世界半径合一 |
| B. P_D1_NEARBY 对齐派 | 12 | `js/town-ui-core.js` :61(「就在附近」文案分档) | 语义错位:提示档不是交互半径;seek 必反复误关 |
| C. 折中值派 | 16~20 | 无出处 | 违反本仓「锁表即规格、参数必有出处节号」纪律(TOWN_UI_PARAMS/DIALOG_OPTS 均有注释溯源+单测逐键断言) |

**推荐:A(24)+宽限窗防抖(hysteresis)。**

**理由:**

1. **24 是本世界唯一被验证的「有效交互半径」语义**:玩家↔任何可点对象 ≤24 格才可点(T-UI-03 命中门,town-ui-core.js :65/:292)。会话对象离玩家 >24 时,NPC 本体已不可点、表情已不可辨,面板成了唯一残留——这正是 PO 实屏验收抓到的「挂卡走人」伤害形态(挡下半屏+A 侧收敛档 L1/L2 暂隐不恢复,prebuild §3.1)。取 24 使「会话有效」与「对象可点」两条半径合一:儿童心智模型一致——「我离得远,东西点不到,卡片也就收了」。
2. **12 派的语义错位**:P_D1_NEARBY 是 HUD「就在附近」的**文案分档**(供 A 侧提示措辞),不是交互裁缝线;12 格在广场尺度不到半屏,玩家轻微探索(回头看看四周)即误关,且与可点半径(24)脱节——「还点得到对象却被判远离」体感矛盾。P_D2_NEAR=40 更不行(远超可点半径,挂卡伤害照旧)。
3. **折中派无锚**:16/18 是无来源新魔法数,后续调参无出处可引;本仓参数哲学是每值有权威节号(prebuild §6 总表先例),造数即欠债。

**seek 张力的三重缓解(派令必答题):**

- **缓解一(几何事实,当前在册清单)**:TOWN_INTERACTS 在册 seek 条目(task:find-bread→market 锚、task:visit-stash→stash 锚)的**会话锚点=目标锚点本身**——玩家「找到它,点一点」的动作对象就是会话对象(onEntryClick target-found 分支 :667-669 亦要求点中同 entry),距离门天然恒满足,**不存在走离问题**。
- **缓解二(宽限窗)**:波次二 NPC 发起 seek(V06 类「跟她说上话才知道找什么」)的走离场景,由「连续 8 tick(≈2s @250ms 节流)超阈才关、回到阈内计数清零」覆盖「找目标途中短暂绕行/徘徊」;瞬时穿越(路过阈值边缘)不触发。
- **缓解三(无损重入兜底)**:即便真走远被关——deferred 任务状态不动(prebuild §2.3)、重点 NPC→重新听一遍引导句(B4 每步自动播报一次,是既定重入体验,prebuild §5.3-11 会话可重入干净)→继续找。误关代价=一次轻量重入;对比「挂卡走人」的持续性伤害(视线遮挡+HUD 收敛不恢复),孰轻孰重明确。
- **实装后观察点**:若 V06 类 seek 实屏实测「找目标途中误关频繁」,升级路径是**给 seek 态加宽宽限参数**(autoCloseStreakTicks 按 state 差异化)或**距离参考点切换目标锚**,均为参数/装配层调整,不改缝结构(登记开放问题 3)。

### 问 2:超限行为=自动走「稍后」同路径?任务会话豁免?

**推荐:成立——自动 close 与面板内「稍后」完全同路径;任务会话(taskRef 存在)不豁免,一视同仁。**

**理由(同路径成立):**

1. **协议零新增**:defer→close{result:'deferred'} 是既有零负面通道(prebuild §2.3 第一行);装配层 CLOSE 闭环已完整(onDlgEvent :864-872:A 恢复→清 confirm/dwell 泵→dlgCtx 清→refreshDlg 200ms 淡出)。距离缝只是**检出器不同**(距离 tick vs 按钮点击),语义通道零分叉。
2. **仓库已有同构先例**:离镇弃机链(:976-980)——「会话中离镇=defer 语义收会话(A 收 deferred 恢复卡态,零负面)」。距离缝本质是把「世界位置变化→deferred 收场」从离镇边界延伸到镇内距离域,**一致性天然成立**,无新模式。
3. **「关了再点=无损」链路逐环核验**:deferred 时任务状态不动(prebuild §2.3,A 侧仅恢复 HUD)→ 世界侧 affordance 标记照常在(iconkey-decision:💬/💗 常驻可点)→ 重点 NPC → click-npc→greet→route → 引导句自动重播(B4)→ stepN/badges 干净重开(既有可重入断言,test :300/:321 面全绿)。唯一「损失」=重听一句引导,这恰是 B4 既定设计而非惩罚。
4. **不弹确认**:dialog-spec §6.2「无强制确认」既定(不弹「确定要离开吗」);自动关闭弹确认只会更违背——玩家人都走远了,还拦他。

**理由(任务会话不豁免,支持统筹线倾向):**

1. **豁免=伤害最大的会话反而永生**:任务会话恰是 Panel 最重、A 侧收敛最深的形态(L1 任务提示暂隐、A 播报抑制,prebuild §3.1 收敛矩阵)——「挂卡走人」跨场景残留复发的主场景正是它,豁免即放行 PO 验收抓到的问题本体。
2. **deferred 对任务零伤害是设计价值不是漏洞**:map-design §6「可完成可跳过可重来」——「跳过」的既有语义就是 deferred;自动缝只是把「点稍后」这个跳过动作自动化了。
3. **豁免破坏模式无关与可测性**:缝语义必须模式无关(showroom 复用硬要求);豁免=引入「taskRef→不关」条件分支,kind×state 组合测试面爆炸,且「任务挂卡走人」与「轻问候挂卡走人」行为分裂,儿童不可预期。

### 问 3:边界情形五项裁定

**(a) 四 kind 一致性——一致,无需例外表。**
距离缝消费的是「玩家↔会话锚点距离」,锚点来自 registry 统一派生(anchorId 必在 TOWN_MAP.anchors 在册,town-interact-core.js :94-98 校验强制),与 kind 正交;会话态由 sessionKind route 而来,缝挂在**会话态**不挂 kind。landmark/prop 条目无 sessionKind(onEntryClick :661 直接不开会话)——它们根本不进会话态,缝对其无消费点(回归既有行为,零变化)。npc/task(含未来 11 条 NPC 条目)开会话后行为完全一致。**结论:天然一致,零例外。**

**(b) 重进距离不自动重开——维持统筹线倾向,裁定成立。**
- 自动重开=世界自动弹 UI(非玩家发起),违背「点选是唯一必要操作」(dialog-spec §6.3;MISSION 纯鼠标点选)——剥夺玩家控制权;
- 儿童走动路径不可预测,即便有防抖,远离后折返仍会触发「自动弹卡+自动播报」=世界抢话(TTS 打断玩家自选动作);
- 重开路径已存在且轻:affordance 标记常驻可点,点一下即重开会话。零惩罚口径下「不自动重开」零损失。
- 装配层注记:close 后距离对账对 idle 态无消费点(streak 归零、不发 focus),机制上天然不重开——这条裁定**零代码成本**。

**(c) 阈值边界来回走动防闪烁——单阈值+连续计数清零,不设第二阈值。**
关条件=「连续 8 tick 超阈」;任一 tick 回到阈内→计数清零。阈值边缘徘徊(超 3 tick→回阈→再超 3 tick→回阈……)永不累积到 8,不触发。**开-关不对称天然成立**:重开是显式点选不是距离条件,故无需「关阈 26/开阈 22」双值磁滞——机制更简,防抖判据量化:抖动穿越周期(2×抖动幅度÷玩家速度,幅度 ~2 格、速度 ~4 格/s → 周期 ~1s)< 2s 宽限窗 → 不触发。

**(d) 锚点丢失/无锚点兜底——缝静默跳过,不触发自动关闭。**
会话对象被拆解(PO 案卷④另行查修,本票不背):距离对账取 dlgCtx 记忆的 entry.anchor(click-npc 时定格,town-dialog-core.js :340-341);锚点不可得(条目被拆/坐标缺失)时装配层跳过喂距离或喂 null,`dialogSeamTick` 对 null 返回 `{streak:0, fire:false}`(按阈内处理)。**兜底方向取保守(少动作)**:缝的职责是防挂卡,不是惩罚拆解;面板仍可经面板内「稍后」/离镇弃机关闭,行为确定性最好,不可预期消失比常驻更伤儿童预期。

**(e) 自动关闭时玩家感知——静默收场+TTS 掐尾。**
- **不播任何收场句**:禁「你离开了」类负面句(零惩罚口径,派令明示);「下次再来呀」类温和句也不播——玩家走远后注意力已离开 NPC,TTS 突然出声=无人接收的抢话,还可能与 A 侧恢复的播报撞车(prebuild §3.1 A 播报在 close 后解除抑制)。
- **TTS 掐尾**:装配层 close 链补 `speech.cancel()`(与 leaveTown :985「提示句不残声」同构)——面板已收,句不残声。与手动「稍后」的区分:**手动收场=玩家在场,当前句播完(既有行为,ghost defer 分发 :807 不 cancel);自动收场=玩家不在场,掐尾**。在场/不在场的感知逻辑自洽。
- **视觉**:200ms 标准退出淡出(--town-dlg-anim-out,prebuild §1.2 动效 token),与「稍后」同感知,零新增动效。

**(f) 追加裁定:指针/窗口失焦不关会话(「失焦」维度的语义收口)。**
- 会话态**不消费 blur**:面板是屏幕空间控件,鼠标移出面板≠离开会话(儿童鼠标乱晃是常态);A 侧 interactBlur 事件在会话期间到达时,blur 非会话态转移边→handle 零惩罚拒绝(:325),既有行为恰好正确,**零代码**。
- 不复用 blur 扩展会话态的硬理由:`handle` 对 focus/blur 有特殊分支(:332-335 **零 dialog 事件静默切态**),而距离缝在会话态必须发 CLOSE 事件(A 恢复收敛档)——复用 blur 需按 state 分叉特殊分支语义,搅浑 bubble 态「局部提示零事件」契约(prebuild §2.2 矩阵 bubble 行+test :173),污染面大于收益。
- 「失焦自动撤销」的完整语义=**bubble 态既有 blur→idle 静默收(:93)+会话态指针失焦有意裁剪+距离是会话态唯一自动收场条件**。窗口失焦(切标签页)不设收场(开放问题 4)。

### 问 4:状态机纯函数面——新意图还是扩展 blur?

**推荐:新意图 `distance-exceed`(DIALOG_INTENTS 十一→十二词),不走扩展 blur(理由见问 3(f))。**

**TRANSITIONS 增边草案(逐态,与 spec §5.2 图逐边对应,prebuild §5.3-1 完整性哲学):**

```text
// js/town-dialog-core.js DIALOG_TRANSITIONS 增边(七态各一条, 全部 →'idle'):
greet:    { ..., 'distance-exceed': 'idle' }
guide:    { ..., 'distance-exceed': 'idle' }
seek:     { ..., 'distance-exceed': 'idle' }
help:     { ..., 'distance-exceed': 'idle' }
respond:  { ..., 'distance-exceed': 'idle' }
praise:   { ..., 'distance-exceed': 'idle' }
complete: { ..., 'distance-exceed': 'idle' }
// idle/bubble 不加边: 无会话则缝无消费点; distance-exceed 在 idle/bubble
// =非法意图→零惩罚拒绝(:325, 与既有图外组合同口径)
```

**close 三值路由增支(handle :354-355 就地一行,复用既有三值结构零扩展):**

```js
const result = type === 'distance-exceed' ?
  (state === 'complete' ? 'continue' : 'deferred') :   // 增支: 缝的两态路由
  (type === 'defer' ? 'deferred' :
    (type === 'end' && state === 'complete' ? 'done' : 'continue'));
```
- complete 态走 continue 的语义:玩家已完成本步、面板停在「继续看看/再见」,走远=用脚投票「继续探索」——continue(「会话关、探索继续」,prebuild §2.3)完美匹配,**且天然满足守门⑥「自动 close 不发 done」**(done 只属 complete+end 玩家显式「再见」)。
- 会话六态走 deferred:与「稍后」同值同 payload 形状(closePayload taskRef 复位前透传,既有 :302-306)。

**新增 core 纯函数(防抖裁决,距离几何不入 core):**

```text
// js/town-dialog-core.js 新增纯函数(零墙钟: tick 节奏归装配层 rAF 250ms 对账)
dialogSeamTick(prev, dist, opts) → {streak, fire}
  prev = 上一 tick 计数(装配层持有, core 零状态)
  dist = 玩家↔会话锚点欧氏距离(装配层几何; null=锚点不可得→保守跳过)
  opts = {autoCloseDist: 24, autoCloseStreakTicks: 8}  (DIALOG_OPTS 消费)
  dist==null 或 dist≤autoCloseDist → {streak: 0, fire: false}  // 阈内即清零
  dist>autoCloseDist → streak=prev+1;
    streak≥autoCloseStreakTicks → {streak: 0, fire: true}      // 恰一次后归零
    否则                        → {streak, fire: false}
```

**参数落点(DIALOG_OPTS N 系追加,冻结表+单测逐键断言):**

```text
autoCloseDist: 24,        /* 距离缝阈值=T-UI-03 可点半径(HL_AIM_MAX_DIST 对齐) */
autoCloseStreakTicks: 8,  /* 连续超阈 tick 数(250ms 节流→≈2s), 防边界抖动 */
```
- 命名核查:两键均不含禁词根(timeout/countdown/fail/penalty 族,town-dialog-core.js :46-47 禁词锁定),过守门。
- **跨表对账断言**(防 24 双写漂移):test 侧同时 require town-dialog-core+town-ui-core,断言 `DIALOG_OPTS.autoCloseDist === TOWN_UI_PARAMS.HL_AIM_MAX_DIST`(测试装具允许跨模块,运行时零依赖不破)。

**装配层接线草案(js/town-ui.js,全在既有 tick 对账内):**

```text
sync() 250ms 对账段内(会话非 idle 且 root 可见时):
  dist = 玩家位姿 ↔ dlgCtx.anchor 欧氏距离(锚点不可得→dist=null)
  {streak, fire} = dialogSeamTick(seamStreak, dist, DIALOG_CORE.DIALOG_OPTS)
  seamStreak = streak                       // 装配层持有的计数(进镇/离镇清零)
  if (fire) dlg.handle({type: 'distance-exceed'})   // 恰一次(streak 已归零)
onDlgEvent CLOSE 链追加: speech.cancel()    // 自动缝掐尾; 手动稍后不掐(在场)
                                            // → 需区分来源: close payload 加
                                            // auto:true(见 §四 prebuild §2.3 增补)
```

**payload 增项(payload 键仅在有值时写入的既有纪律内):**
closePayload 对 distance-exceed 追加 `auto: true`——A 侧与装配层可区分自动/手动收场(掐尾只对 auto)。这是 close payload 的**可选键新增,不碰三值结构冻结面**(deferred/done/continue 值域不变)。

**事件序列草案(自动收场瞬间全链):**

```text
1. sync tick: dist>24 连续第 8 tick → dialogSeamTick fire=true(恰一次)
2. handle({type:'distance-exceed'}) → 转移表 [state] 边 → next='idle'
3. close 路由: result = state==='complete' ? 'continue' : 'deferred'
4. fire CLOSE {result, taskRef?, auto:true} → resetSession()(badges/stepN 清零)
5. onDlgEvent CLOSE: dialogEvent(A 恢复 HUD/解除收敛+播报抑制, 先于会话层收敛)
   → 清 confirm/dwell 泵(既有 :866-869, 瞬态无僵尸泵)→ dlgCtx=null
   → refreshDlg()(面板 200ms 淡出, data-state=idle 可观测钩子)
6. 装配层: speech.cancel()(句不残声, leaveTown :985 同构)
7. 后续: streak 已归零; 玩家重回距离内→零自动行为(裁定 3b 不自动重开);
   重开唯一路径=点 affordance 标记→click-npc(既有链)
并发安全注记: 离镇链与距离缝同 tick 竞态——先落地者收场, 后到意图在 idle 态
   被零惩罚拒绝(:325), 幂等无双 close; respond/praise 瞬态被缝关闭时其 confirm/
   dwell 泵随 CLOSE 链清除(既有), 无悬挂。
```

**触碰冻结面清单(实装票工作量账):**
DIALOG_INTENTS +1 词 · DIALOG_TRANSITIONS +7 边 · close 路由 +1 分支 · closePayload +auto 可选键 · DIALOG_OPTS +2 键 · 新纯函数 dialogSeamTick · GLOSSARY「TownDialogCore」词条(「冻结十一意图」→「冻结十二意图」+interface 补 dialogSeamTick,随实现票同步)· 既有 test :54 常量冻结断言(十一→十二词)与 :109 转移表逐边断言(补 7 边)更新。**协议冻结面(close 三值结构、Panel/Bubble/Chip 关系、DIALOG_EVENTS 三事件名)零触碰。**

---

## 三、四 kind 行为表(裁定 3a 的落地速查)

| kind | 会话开?(既有) | 缝行为 | 注 |
|---|---|---|---|
| landmark | 否(无 sessionKind,:661) | 不涉及(纯 A 侧结算零变) | 回归既有断言 |
| prop | 否(同上;market/stash 本体) | 不涉及 | task 条目借其锚,见下行 |
| task | 是(tour/seek 等会话) | 同统一缝:超阈→deferred;complete→continue | seek 类条目锚点=目标锚点,距离门天然恒满足(问 1 缓解一) |
| npc | 是(波次二 11 条接入后) | 同统一缝 | 游走实装后参考点问题见开放问题 2 |

---

## 四、spec 增补文本草案(可直接粘贴;PO 拍板后由需求线并进权威,本文不代落)

### 4.1 town-ui-dialog-spec.md §5.2(状态图增边+语义说明段)

状态图 mermaid 内逐会话态追加(图内命名跟随既有 PascalCase):

```mermaid
  %% —— 距离自动收场缝(增补, 裁定见提案 dialog-seam-semantics-proposal)——
  Greet --> [*]: 距离超限·自动稍后
  Guide --> [*]: 距离超限·自动稍后
  Seek --> [*]: 距离超限·自动稍后
  Help --> [*]: 距离超限·自动稍后
  Respond --> [*]: 距离超限·自动稍后
  Praise --> [*]: 距离超限·自动稍后
  Complete --> [*]: 距离超限·自动继续看看
```

状态语义说明段末尾追加:

> - **距离超限(自动收场缝)**:会话期间玩家与会话锚点距离连续超过 `autoCloseDist`(24 格,=T-UI-03 可点半径 `HL_AIM_MAX_DIST` 对齐)持续 `autoCloseStreakTicks`(8 tick ≈2s,250ms 节流对账)时,自动收场:会话六态走「稍后」同路径(`deferred`,零惩罚零确认零播报,静默 200ms 淡出+TTS 掐尾),complete 态走「继续看看」同路径(`continue`)。**不自动重开**:重新进入距离不弹卡,重开唯一路径=重新点选可交互标记。零惩罚口径:任务状态不动(prebuild §2.3),重点 NPC 即无损续玩。指针失焦(移出面板/窗口)不触发任何自动关闭——会话态零指针 hover 绑定;「失焦撤销」仅 bubble 态既有静默收场(§5.2 图 BubbleHint→Idle 边)。

### 4.2 town-ui-dialog-spec.md §5.4(退出行增补)

> - **距离超限自动退出**:与「稍后」同路径同感知——200ms 淡出,deferred(complete 态 continue),无负面提示;宽限窗(连续 8 tick 超阈,回阈即清零)防边界抖动,无闪烁;TTS 掐尾(玩家不在场不残声),不播收场句(禁「你离开了」类负面句,§1.4 零惩罚基调)。

### 4.3 town-ui-dialog-spec.md §6.2(关闭语义段增补)

> - **自动关闭(距离缝)**:面板内「稍后」之外唯一自动收场通道,与「稍后」同语义同感知;不弹确认(本节既有);不自动重开(重进距离不弹卡);指针移出面板/窗口不触发关闭(§4.5 儿童指针游走常态,会话态不绑定 hover)。

### 4.4 town-ui-dialog-spec.md §10(待 PO 确认点追加,建议 B9/B10)

| # | 待确认点 | 默认建议(可直接推进) | 影响 |
|---|---|---|---|
| B9 | 距离缝阈值与宽限窗 | **24 格(=HL_AIM_MAX_DIST)+连续 8 tick(≈2s)**;统一不豁免不差异化 | 会话生命周期/防抖参数 |
| B10 | 自动收场玩家感知 | **静默+掐尾,不播收场句;不自动重开** | TTS 通道/重开路径 |

### 4.5 town-ui-dialog-prebuild.md §2.2(意图词表+矩阵行修订)

意图词表(:148)追加一词:

> `distance-exceed`(距离超限自动收场;装配层 250ms 对账检出,core 只裁语义路由;close 路由:会话六态→deferred、complete→continue;payload 携 `auto:true`)

矩阵各会话态行「退出(去向)」列追加、发射列注记(以 seek 行为例,greet/guide/help/respond/praise 行同构):

> 退出列追加:`distance-exceed→close(deferred)`;发射列注记:`close 携 auto:true 时装配层掐尾(speech.cancel),感知同稍后`

complete 行追加:

> 退出列追加:`distance-exceed→close(continue)`(走远=用脚投票继续探索;**不发 done**——done 只属玩家显式「再见」)

### 4.6 town-ui-dialog-prebuild.md §2.3(deferred 行触发列增补)

> deferred 行「触发」列追加:「任意态点『稍后』/关闭/**距离超限自动收场(距离缝,§2.2 distance-exceed)**」;表下注记追加:「自动收场(deferred/continue)与手动同语义,close payload 差异仅 `auto:true`(供掐尾区分);任务状态不动语义不变」。

### 4.7 town-ui-dialog-prebuild.md §5.2(函数面增补)

DIALOG_INTENTS 注释更新为冻结十二意图;新增签名与事件序列照本文 §二问 4 的 `dialogSeamTick` 签名草案、close 路由分支、事件序列草案原文粘入(文本已按 §5.2 节体例写就,可直接粘贴)。

### 4.8 town-ui-dialog-prebuild.md §5.3(断言面 12-20,见 §五编号)+ §9 歧义 3 收口建议

§9 歧义 3(「Seek 期间 Panel 常驻还是收起」)建议**收口**:

> **收口裁定建议**:歧义 3 裁为「Panel 常驻+距离缝自动收场」——近距离走动不收(常驻+半透明,§4.3 无遮挡原则不变);走远(>24 格持续 ≈2s)自动收场(deferred),目标提示回落到 affordance 标记+重点重开承载。原歧义后半句「届时会话以 continue 语义挂起还是保持打开待定」随之**裁掉**:不存在「挂起保持打开」形态——收场即 deferred 关闭、重开即重新点选(不自动重开),两态清晰。原预留的「收起后目标提示由 Bubble-M 承载」在距离缝方案下**降级为远期增强项**(近距离常驻面板已承载目标缩略图 B6,无需 Bubble-M 顶替),不进首版。
> 收口依据:本提案 §二问 1/问 2;统筹线「不豁免不挂起」口径;零惩罚重入链(prebuild §2.3)。

### 4.9 权威同步随实现票(非本文范围,登记账)

- GLOSSARY「TownDialogCore」词条(:268-269):「冻结十一意图」→「冻结十二意图」;interface 补 `dialogSeamTick`;close 三值描述补「distance-exceed 两态路由(auto:true)」。
- 既有测试同步:test/town-dialog-core.test.js 常量冻结(:54)与转移表逐边(:109)断言扩面(见 §五-9)。

---

## 五、工程守门断言面(9 条;衔接 prebuild §5.3 编号 12-20;对齐 conventions §7 测试装具纪律+GLOSSARY「有同名单测」口径)

> 注:派令指针「conventions §7.6」现存 conventions §7 实至 §7.5(§7.1 vm 装载/§7.2 假 DOM/§7.3 Windows 纪律/§7.4 红因分类/§7.5 MDN 自检)——对话域守门面按 GLOSSARY 词条「有同名单测(test/town-dialog-core.test.js)」+prebuild §5.3 消费,§7.6 指针偏差登记开放问题 5。

| # | 断言(prebuild §5.3 编号) | 层 | 断言内容 |
|---|---|---|---|
| 1 | **12 超阈自动 close(deferred)** | core | 会话六态(greet/guide/seek/help/respond/praise)各喂 `{type:'distance-exceed'}` → `{changed:true}`;events 恰一条 `close{result:'deferred', taskRef?透传, auto:true}`;终态 idle;resetSession 干净(badges/stepN/taskRef 全 null/空) |
| 2 | **13 阈内不误关+宽限不足不关** | core | `dialogSeamTick`:dist≤24 恒 `{streak:0,fire:false}`(含 streak 已累积态→清零);连续超阈 1~7 tick 恒 fire=false;恰第 8 tick fire=true 且恰一次(fire 后 streak=0 不重复 fire);dist=null 恒 `{streak:0,fire:false}` |
| 3 | **14 四 kind/五 sessionKind 覆盖** | core | route 五 sessionKind(greet/tour/seek/help/care)开会话后 distance-exceed 全收 deferred(care 走既有 route 兜底 guide 态不破);landmark/prop 无 sessionKind 不开会话(回归既有 :661 行为,缝无消费点) |
| 4 | **15 宽限窗边界抖动不误关** | core | tick 序列断言:超阈×3→阈内(清零)→超阈×3→阈内→…循环任意长度恒 fire=false;仅连续 8 超阈触发;「徘徊频率<宽限窗周期不触发」性质由该序列穷举承载 |
| 5 | **16 关闭后重进距离不自动重开** | core+装配 | close 后(idle)继续喂距离 tick(含回到阈内/再次超阈)→ 恒零 dialog 事件、态恒 idle;重开唯一路径=click-npc(回归既有断言);装配面:refreshDlg 不因距离/锚点变化弹面板(data-state 恒 idle) |
| 6 | **17 自动 close 不发 done** | core | 全会话态 distance-exceed 断言 events 无 `close{result:'done'}`;complete 态显式断言 `close{result:'continue'}`;`done` 仅 complete+end(既有 :253 断言不破)——A 侧落完成链(done+taskRef)不被缝触发 |
| 7 | **18 complete 拒 defer 收 distance-exceed 的对账** | core | complete 态 `{type:'defer'}` 零惩罚拒绝(既有 :321 不破)而 `{type:'distance-exceed'}` 正常收 continue——两意图边界不混淆 |
| 8 | **19 参数冻结+跨表对账** | test | `DIALOG_OPTS.autoCloseDist===24` 且 `=== TOWN_UI_PARAMS.HL_AIM_MAX_DIST`(双 require 对账,防 24 双写漂移);`autoCloseStreakTicks===8` 正值冻结;两键名不含禁词根(既有禁词守门扩面) |
| 9 | **20 词表/转移表冻结面同步** | core | DIALOG_INTENTS 恰十二词(含 distance-exceed);转移表逐边断言(:109 既有)补 7 条新边;idle/bubble 态 distance-exceed 被零惩罚拒绝(图外组合不可寻);确定性/零突变/可重入(既有 :322-324 性质断言)对新边照跑不破 |

装配层(非编号断言面,实现票冒烟项):close payload `auto:true` 时 speech.cancel 被调、手动 defer 不调;离镇链与缝同 tick 竞态幂等(无双 close);respond/praise 被缝关闭后 confirm/dwell 泵无悬挂(既有 :866-869 链覆盖)。

---

## 六、开放问题清单(5 条,均不阻塞实装)

| # | 问题 | 默认处置 |
|---|---|---|
| 1 | 宽限窗 8 tick(≈2s)是设计默认值,未经实屏校准 | 参数化(DIALOG_OPTS),PO 实屏验收可调;调参不改结构 |
| 2 | 距离参考点当前=注册锚点定格坐标;村民游走实装(T-NPC 线)后是否改跟随实体实时位置 | 留 T-NPC 线对齐;当前锚点静态、行为确定,游走前无差异 |
| 3 | V06 类 NPC 发起 seek(波次二)实屏观察点:找目标途中误关频率 | 观察项;若频繁,升级=seek 态加宽宽限参数或参考点切目标锚(参数/装配层调整) |
| 4 | 窗口失焦(切标签页)不设自动收场 | 默认裁定不设(单标签页游戏,回来场景无损);PO 可翻案 |
| 5 | 指针勘误两笔:派令「conventions §7.6」实至 §7.5;派令行号「:816 面板内出口链」实为 :807(ghost defer)/:792(选项出口)一带(:816 是 replayDlgSentence) | 不阻塞;建议派令方/需求线下批勘误登记(prebuild §9 有先例) |

---

## 七、引用指针(逐节核对,防漂移)

| 引用 | 精确落点 |
|---|---|
| 体验基调零惩罚 | town-ui-dialog-spec.md §1.4(:31-34) |
| 状态图/退出行/关闭语义 | 同上 §5.2(:140-173)/§5.4(:185-189)/§6.2(:201-205)/§6.3(:207-210) |
| B 系待确认点 | 同上 §10(:260-271,B1-B8);本文建议追加 B9/B10 |
| 状态机矩阵/三值/函数面/断言面/歧义 3 | town-ui-dialog-prebuild.md §2.2(:146-165)/§2.3(:167-173)/§5.2(:281-310)/§5.3(:312-324)/§9 歧义 3(:196;§9 章 :387-407) |
| 意图词表/转移表/close 路由/blur 特殊分支 | js/town-dialog-core.js :40-43/:91-110/:350-359/:332-335 |
| 出口链/离镇 defer/CLOSE 闭环/rAF 对账/speech.cancel 先例 | js/town-ui.js :792/:807/:976-980/:864-872/:1098-1105/:985 |
| 距离常量 | js/town-ui-core.js :61(P_D1)/:62(P_D2)/:65(HL_AIM_MAX_DIST,消费点 :292) |
| 四 kind/五 sessionKind/registry 校验/在册清单 | js/town-interact-core.js :36/:37/:67-106/:44-59 |
| 既有测试锚点 | test/town-dialog-core.test.js :54(常量)/:109(逐边)/:173(bubble 零事件)/:253(三值)/:321(零惩罚) |
| GLOSSARY 词条 | 「会话状态机纯核心(TownDialogCore)」GLOSSARY.md :268-269 |
| iconKey/affordance 常驻 | .scratch/town-design/receipts/iconkey-decision.md §一/§三 |

---

**提案结束**(PO 拍板前不落权威;拍板后增补文本照 §四粘贴,实装票按 §五断言面施工)
