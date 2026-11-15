# light 线收口回执(F 光照层 + H HUD 层 + 走查官首轮)

> 线: town-design-light(ui-designer 岗) · 日期: 2026-11-15 · commit: **664f5ca**
> ⚠️ 交付通道变更: relay 线工具(open_line/send)对本会话硬性禁用(两次重试均报
> 「child session - line tools are primary-only」, 非重名问题)——town-design-light 线
> **无法注册**, 与 lead 的点对点走线不可达。本回执落盘 + 父会话最终报告为替代通道。

## 1. F 光照层: town sky 参午后暖阳定稿

文件: js/adventure-dims-core.js town 行 sky 字段(仅此一字段, 零机制扩展)

| 档 | color | fogNear/Far | sunI | 观感结论 |
|----|-------|-------------|------|----------|
| f0 基线 | 0x7ec8e3 | 90/230 | 0.85 | 纯青蓝, 冷, 山硬 |
| f1 | 0x8cc9e6 | 90/230 | 0.85 | 肉眼不可辨——单独小步无意义, 步距需 R+30 起 |
| f2 | 0x9cc9e0 | 90/230 | 0.85 | 可辨柔化但暖意不足, 山仍生硬 |
| **f3 定稿** | **0xa8cbe0** | **75/200** | **0.92** | **粉蓝暖天+灰山入雾奶油化, 暖而不昏亮而不白** |
| f4 上限探针 | 0xb2cee2 | 72/195 | 0.92 | 天空开始灰白化, 蓝的明快性流失——越「亮而不白」界, 回退 |

试拍证据: `.scratch/town-design/shots-light/f0-*.png` ~ `f4-*.png`(三机位/档)。
机制口径(报告项): 行参面只有 color(天穹+雾**同值单值通道**)/fogNear/fogFar/sunI(方向光强度);
「环境光暖移/太阳色温/渐变天际线」无行参面——按 ADR-0011 不扩机制, 奶油天际线效果
经「雾色=天色」单值通道实现(收雾距让远山进雾)。sunI 0.92 已比 home(0.75)亮, 再升有
石英/雪白块过曝风险。walk-light.mjs 每拍直读 scene.background/fog/sun 验证参数落地(防假拍)。

## 2. H HUD 层: 质感统一 + 六值裁决落地

文件: css/town.css(信息架构/文案/交互零改动, town-ui-entry-hud-spec 继续有效)

- 全族底面语言: 暖纸半透明底 Bread Cream #F4D9A6 @ 0.94(--town-hud-surface 新 token,
  与 B 侧 --town-dlg-panel-bg 同值同语言) + 深木细描边 3px→2px + 坐影
  --town-hud-shadow: 0 2px 6px rgb(90 70 54 / 25%)——罗盘圈从「白圈悬浮」变「坐进画面」。
- 六值裁决落地: ①panel 宽 clamp(360px, 42vw, 600px) ②距底 28px(--town-dlg-panel-bottom)
  ③panel-bg rgb(244 217 166 / 94%) ④chip 间距 16px ⑤圆角 panel 20/chip 14
  ⑥praise pop-in scale 0.6→1.0 / 200ms cubic-bezier(0.34,1.56,0.64,1)(easeOutBack),
  bubble 同步改用 panel-bg token(dlg-prebuild §1.2「Panel/Bubble 主底」同源)。
- 六值全部落在 css/town.css, js/town-ui*.js 无内联越权值(grep 核过, 仅 hl 投影 left/top)。
- CSS 守门(town-ui-core.test.js 色板 token 钉值/town-ui.test.js dlg token 段/双蓝澄清)
  全绿; 既有钉值 token 一字未动, 仅新增 token。
- 备注: 对话面板/bubble/chip 的 live 视觉未入截图(走查 harness 未开对话), 由 token
  守门+CSS 确定性覆盖; 建议下轮走查加对话开启机位。

## 3. 工程门

- npm run lint 零错(exit 0, logs: .scratch/logs/light-lint2.log)。
- 全量 npm test: 7 红全部归属 town-design-scene 线 town-map-core.js 在途几何改动
  (+45/-6 未提交, 走廊/散布/樱花/山体断言, 测试未同步完)——§7.4 红因分类留痕
  (logs: .scratch/logs/light-final-npmtest.log, AssertionError ×7=断言红, 非装具炸)。
  我的基线(f06c221 树上, 我改动前)npm test exit=0 全绿(light-baseline-npmtest.log);
  我的面(dims sky 断言/CSS 守门/conventions)定向全绿(light-targeted2.log)。
- 提交: 664f5ca, 精确 add 三件(css/town.css + js/adventure-dims-core.js +
  test/adventure-dims-core.test.js), 未触碰 scene 的 town-map-core.js 与他人任何文件。
- walk-light.mjs/shots-light/ 本回执按 walk.mjs 前例(harness 专用不入库)留在 scratch。

## 4. 走查官首轮评审(v1 全机位, 树=664f5ca+scene 在途)

机位: `.scratch/town-design/shots-light/v1-*.png`(13+1 张); 对照基线 `shots/*.png`。

按 revamp-spec §6 最低交付线逐条:

| 验收项 | 现状 | 判定 |
|--------|------|------|
| 材质三段式 | 摊位/灯柱有柱+顶结构, 建筑仍素板盒(arch 未落地) | ✗ 等 arch |
| 屋顶阶梯形 | 全场仍平板顶 | ✗ 等 arch |
| 广场市集密度 | 摊位 6+灯柱带+坐凳已可见(v1-10/v1-13), 较基线显著改善 | ◐ 接近 |
| 樱花是粉的 | 仍大红方块(78 粉羊毛已备, assembly 未消费) | ✗ 等 arch/scene |
| 山有层次 | F 层雾软化已让山「入雾奶油化」(v1-22 对比基线 22 显著), 但几何仍单色梯形墙(v1-17); scene 山体三段分色测试红着=在途 | ◐ 一半(光色已到位, 几何等 scene) |
| 出生第一眼不被自己挡 | 仍被背影挡死中轴(v1-10)——C 层 spawn 锚微调未落地 | ✗ 提醒 lead(C 层归你) |

意见清单(每条带机位):
1. 【F 层效果确认】暖阳+收雾对「远景一坨灰山」的软化立竿见影, 建议终审保留定稿档(v1-22 vs shots/22)。
2. 【给 scene】山体几何折线感仍重(v1-17 上缘锯齿); 三段分色+弧形化落地后请@我重拍山位机位复评光色配合。
3. 【给 arch】风车叶片仍白十字(v1-17), 塔顶装饰已现雏形(v1-13 石基座+金饰)——G 层落地后全场观感将跳档, 我在。
4. 【给 lead】C 层 spawn x 79→82 未落地, 出生构图仍是重制前最大减分项之一(v1-10)。
5. 【给 lead·机制上限】若终审仍觉「暖度不够」, 下一档自由度在环境光/太阳色温——需机制扩展, ADR-0011 口径内我不再动, 请裁。

## 5. 待办(本线)

- arch/scene 首版全落地+仓库回绿后: 终审全机位重拍(v2)+逐层终评分, 回执续本文件。
- 对话开启机位补拍(H 层 live 视觉验证)。
- relay 线如由 lead 代开, 我改走线送信。

---

# v2 终审续篇(pin 同步 + 全机位终评分)

> 日期: 2026-11-15 · commit: **e6c958e**(单件 test/adventure-dims-core.test.js, +54/-48)
> 树: 3ececc5(docs 4.2 民居体量 7)+ 我的 e6c958e; arch/scene 全入库。

## 6. 终轮 pin 统一同步(lead 派单四步)

1. **三挂起红同步**(广场铺装/塔基/樱花立地 58→17/13): 按探针实测改。
2. **全文件 palette 波及字面一次到位**(25/25 绿):
   - 钟塔随 G 层几何重pin: 塔基石砖 13/塔身石英 17/金钟 19(2×2×2 @y34-35)/檐角旗+顶旗 78/玻璃板 68。
   - 店: 招牌橙底 76+石英点缀 17+框柱 5/橱窗 68+暖光 19/遮檐布幔 15/前廊柱 5(新蓝图无门洞)。
   - 风车: 轴 76(橙金)/十字框叶(石英框 17+木叶 6)/石英墙 17/**南脸门洞保留**(探针 y25/26 实测 0, 推翻先验笔记「新蓝图无门」)/基座 13。
   - 双民居: 门叶 64/65、烟囱 4; 樱花覆写 scanPair 16→78(palette tree.sakuraLeaf 单源)。
   - 灯柱随 M 层三笔造型重pin: 石英座 17(y25)+深木柱 5(y26-28)+灯头 19(y29), 总高 5——新增 lampBase 槽位。
   - 刻意保留: 花摊顶 16(蓝图字面, palette stall-canopy 行无顶棚槽); 灌木 scanPair (16,7) 只数 7。
3. **他人文件过期 pin 清单: 空**(全量绿即证)。
4. **工程门**: 全量 npm test **2077/2077 绿 exit 0** + lint 零错。派单预期 2078 差 1 归 arch
   测试重写收并(00359fa prefab-kit.test.js 重写 692 行), 全绿非红因, 如实报备。
   日志: light-pin-audit1-5.log / light-full-run.log / light-lint.log。

## 7. v2 终审全机位走查(revamp-spec §6 六线终评分)

机位: shots-light/v2-*.png(15 张=13 全机位+spawn 默认+对话 live); walk-light.mjs 已升级
含对话机位段(抄 walk.mjs)。sky 直读 `{bg:a8cbe0, fog:75/200, sunI:0.92}` = F 层 f3 定稿落地真值。

| 验收线 | v1 基线 | **v2 终审** | 证据机位 |
|--------|---------|-------------|----------|
| 材质三段式可见 | ✗ | **✓** | 石英广场大面/石砖路/草三段清晰(11/13/16); 建筑木墙+陶红顶+石英脸面多材质(13/19) |
| 屋顶有阶梯形 | ✗ | **✓** | 钟塔红砖阶梯顶+塔尖旗(10/11/22); 民居陶橙坡顶(10/22); 摊位棚顶成列 |
| 广场有市集密度 | ◐ | **✓** | 蓝顶大摊×2+白棚摊+红座摊+货品金点箱+灯柱/路标成景(12/13/16/22) |
| 樱花是粉的 | ✗ | **✓** | 樱粉 78 饱和粉团, 门廊角×4+田园(12/13/16/22 多机位) |
| 山有层次 | ◐ | **✓** | 阶梯拱形轮廓完整+崖屋点景(17/22); 注: 山材质仍单色石阶, 层次属轮廓级——PO 若要材质分层属新票 |
| 出生第一眼不被自己挡住 | ✗ | **✓** | v2-10: 玩家偏下不挡中轴, 钟塔全景+塔尖旗完整, 南门石英灯柱框景 |

**六线全过最低交付线。** 附达: 对话 live(v2-30)面板六值落地(距底/圆角/半透明暖纸底/说话人+正文/
头顶气泡), hotbar 避让收敛; H 层补遗二闭环。

## 8. 走查官终审意见清单

1. 【给 lead】v2 六线全过, 建议 PO 检阅按 v2-10(出生)/v2-22(全景)/v2-30(对话)三张主打。
2. 【可选新票·非本轮】山体材质单色阶(轮廓层次已达标的上一层): 若 PO 嫌素, 分色/纹理归 scene 线新票。
3. 【机制上限备案】F 层暖度若终审仍嫌不足, 环境光/太阳色温需机制扩展(ADR-0011 口径外), 由 lead 裁。
4. 【观察】风车十字叶姿态随蓝图 X 形旋转(v2-17), 与钟塔樱粉旗呼应, 无需改。

---

# 城镇翻新 TIDEA 波次一·light 批(TIDEA-12/13)

> 日期: 2026-11-15 · commit: **b4989a4**(js/modes/adventure.js +25 / js/town-ui.js +5 / css/style.css +25)
> 设计权威: revamp-spec H 层补遗三(0f003f4 lead 已入库)·PO 拍板 TIDEA-12 全套+TIDEA-13 淡档
> 提案底稿: hud-ideas.md U-01/U-02 · 技能纪律: game-ui-ux(event-driven)/threejs(state wiring)

## 9. TIDEA-12 镇内安静模式(全套)

- **门控**: 壳层 `advSyncTownChrome()`——`advDimRow(advDim) === ADV_TOWN_DIM_ROW` 行身份
  比对派生 `body.adv-dim-town`, 三挂点各跑一次(init 复位对齐/advSetDim 换维/cleanup 退场),
  零每帧轮询; Node 单测无 DOM 安全守卫。
- **隐藏面**: `#crosshair` display:none; 状态行经 `advHudLines` 行身份分支只留镇名牌横幅——
  生命/位置/手上/家图任务/注视键位五行不进镇(镇内任务语义归 L1 提示卡, T-MAP-04 另票)。
  「饥饿」行现行 HUD 无此行(lead 清单含它系底片描述口径), 分支已全覆盖。
- **守门红线案例**: 首版用 `advDim === 'town'` 字面, dims-core「三条全局判据零新分支」
  源文本守门(:289)当场红——改为行身份比对(T-SEAM-04 先例口径)后转绿。守门测试执法成功,
  不变量「维度政策住 ADV_DIMS 行不进壳层」保持。
- **`.keys` 块考据**: index.html 六处 `.keys` 全在菜单页容器内(游戏内不可见), 不属游戏内
  chrome; 镇内键位语义经状态行分支已去除(背包 Tab/注视 B 菜单), 菜单键位提示保留=镇外
  像素零变化红线。index.html 零改动。

## 10. TIDEA-13 hotbar 三态分层(补遗二避让提前落地)

- **权威序列全实测命中**(walk-tidea.mjs 五态 computed 直读+底片, shots-light/t13-*.png):

| 态 | hotbar | 准星 | 气泡条 | HUD 行数 | 战斗语义 | body class |
|----|--------|------|--------|----------|----------|------------|
| 镇外基线 | 1 | block | 1 | 8 | 有 | 无 |
| 进镇漫步 | **0.35** | none | 0.35 | **1(镇名牌)** | 无 | adv-dim-town |
| 会话开 | **0** | none | 0 | 1 | 无 | +town-dialog-open |
| 会话关 | **0.35** | none | 0.35 | 1 | 无 | 摘 dialog |
| 出镇 | **1** | block | 1 | 8 | 有 | 全摘 |

- **会话档**: town-ui.js dialogEvent open/close 增减 `body.town-dialog-open`(doc 判法同
  高亮层 284 行先例); CSS 叠加选择器优先级=全隐>淡档, 补遗二契约原样, T-UI-04 剩余面
  不变(对话本体装配)。会话开闸直接走回程线的极端序由离镇兜底摘档覆盖。
- **过渡**: 180ms ease-out(补遗二拍长, 补遗三 §实现纪律)。
- **气泡条**: .bubblebar 随 hotbar 同态(补遗三「溺气泡条随 hotbar 同态」)。

## 11. 工程门与红因分类

- 定向: dims-core+town-ui+town-ui-core+adventure-mode+conventions **288/288 绿**。
- scoped lint(eslint 我两 js + stylelint 两 css)零错。
- 全量 **2077 pass / 3 fail**, 三红全部归属 arch 两份**未提交**在途改动(js/prefab-kit.js
  +js/town-assembly-core.js, 他们那 4 处 assembly 同步正在写): prefab-kit.test.js:380 源文
  本守门 / town-assembly-core.test.js:138+198 palette 深度——断言主题直读该两文件, 与我
  三件零装载关系; §7.4 双证齐(基线 7d56ac1 收口 2079 绿+scoped 定向绿)。
- 全量 lint 6 错同归属 arch 在途(prefab-kit.js block-spacing ×2 + town-assembly-core.js
  quote-props ×4, scarecrow/clothesline/woodpile/hencoop 新行引号不一致)——arch 提交前
  自会过门, 我未代修(勿碰纪律)。
- 走查证据: shots-light/t13-00/10/20/30/40(五态); walk-tidea.mjs harness 不入库(walk 系前例)。

## 12. 波次二接口备忘

- T-UI-04 剩余面=对话本体装配(本票已代偿其 hotbar 避让半边, 届时勿重复实现)。
- 补遗二「已知伪影豁免项」(对话 live 机位 hotbar 相撞)随本票关闭(revamp-spec :140 改注)。

---

# 城镇翻新 TIDEA 波次二收尾(light 岗, TIDEA-14/15/16/17/19 呈现层五件)

提交 `9bca4ac`(5 files, +502/-39)。触碰面: js/town-ui.js · js/modes/adventure.js ·
css/town.css · test/town-ui.test.js · test/adventure-mode.test.js; town-ui-core /
index.html / town-ui-core.test 零改动(契约面未破)。

## 13. TIDEA-14 世界气泡锚定(U-03)

- 实现: refreshDlg 拆「内容照旧签名门控 + 锚位写门外」——签名(state|npcId|
  praise|bubbleText)不变零 DOM, 位置每拍跟帧(相机转动签名不变, 位置必须重投影)。
  positionBubbleAtSpeaker: townHlProject 投影说话人锚(装具契约同 refreshHl:
  hit 用 origin+dir, 投影用 yaw/pitch/fovDeg/aspect/vw/vh), 16px 安全区夹紧
  (offsetWidth 实测半宽), transform translate(-50%,-100%) 中心底对齐, 底边悬距
  TOWN_BUBBLE_GAP=12。
- 回落拍板(呈现层授权内): 投影缺席/出视野→摘 is-anchored+清内联位→CSS 基础款
  底部固定位(inset-block-end calc(28px+120px))兜底——保底可用性优先, 不在锚定
  档内造第二形态。
- 走查新发现并已修真 bug: hover 丢失回隐藏时, 原实现只摘 hidden 不清锚定类/内联
  位→下次气泡以底部固定位形态显示会带着残留内联位错位(内联优先级高于 CSS inset)。
  修=refreshDlg 隐藏分支统一摘类清内联(contains 守卫纪律同族), 单测+走查双证。
- 产线缝发现(重要): 生产自动实例 `TownUi=mkTownUi({})` 的 camRef 缺省 null——
  **相机源缝在产线未接线**, T-UI-03 高亮层(命中/标记/锚定档)整体休眠。当前产线
  气泡视觉=底部固定位(恰为拍板的回落形态, 视觉不破); 锚定档待缝激活后自然生效,
  无需回归。接线属 T-UI-03 相机源票(fovDeg/aspect 源归引擎), 不属本批「纯呈现层/
  最小 diff」授权, 只报告不代接。
- 单测: 锚定几何(hover→is-anchored+内联位 50/41=投影-GAP 精断)、背转 cam→sync→
  回落档气泡仍显+类摘+内联清。
- 走查: 探针实例 Ui2(合成 camRef 瞄锚模式)取证——anchored:true+left:781px(=标记
  位)+top:461px(=473-12 GAP 恰合)+transform matrix(-47,-60)=-50%/-100% 生效+
  暖纸底; 探针教训: 瞄锚 dir 须对裸锚点(+2.5 头高偏置在 8.7 格距离出 16°>8° 锥,
  townHlHit 按裸锚算角度)。

## 14. TIDEA-15 到达镇名时刻卡(U-04)

- 实现: advTownArriveCard() 挂在 advVeilArrive town 分支(advToast 同款媒体缝位,
  直改 DOM 先例), 文案 `🏘️ 小镇 · Midport Village` 与 dims-core town 行 banner
  译名对齐; css 新 .adv-town-arrive-card: 暖纸底(--town-hud-surface 同源)、18vh
  顶部居中、adv-town-arrive-pop 2.8s(入 0.4+驻留 1.6+出 0.8), JS 2.9s 自摘节点
  零残留; z-index 16 高于 #fade 白闪 15(卡在退白上浮)低于面板 40;
  prefers-reduced-motion 瞬显即隐(JS 摘兜底 forwards 停末帧)。
- Node 沙盒守卫: typeof document 早退(T-SEAM-02/03 到达链在 Node 直跑零炸)。
- 单测走源切片(CJS require 导出面收窄, 裸名不可达——adventure-mode.test L402
  先例), 行为面由到达链 e2e 承担; quotes 规则口径=转义单引号合法、双引号即错。
- 走查: 真链路 advVeilFire({to:'town',kind:'edge'}) 进镇, 六 computed 值直读
  (anim/bg/radius/top=134.28px/z=16/text)全合, 3.2s 后 arriveOn:false 自摘实证;
  底片 t2-00/01。
- harness 坑与解: headless 主循环暂停(main.js L383 `locked||touchPlaying` 门,
  旧 harness 全直调未暴露)→evalJs 置 `touchPlaying=true` 开真循环; 无
  awaitPromise:true 时页内 Promise 串行化成 `{}` 假象——别当结果读。

## 15. TIDEA-16 回望钟塔回礼(U-05)

- 实现: checkTowerSeen() 挂 sync 幂等分支(refreshPointer 同拍, 零新增循环),
  townPointerHeading 同族纯函数判定; armed=先观察到非正前再回正前(防出生直视
  即烧, 保「回望」仪式感——单测钉死); 触发=seen-pulse 类 1.6s 一次性柔光脉冲
  (呼吸光语言同族), timer 注入摘类; 冷却 TOWN_TOWER_SEEN_COOLDOWN_MS=30s 防刷;
  钟塔锚复用 bellTowerAnchor()。纯视觉不占 L3 夸奖通道, 钟鸣配对不做归波次三
  音频批。
- 单测: 出生直视不烧→回望烧→1.6s 摘→冷却 30s 挡→离镇清臂清句柄零跨轮(双实例)。
- 走查: 背对 armed(pulseOn:false)→回正前 pulseOn:true, 底片 t2-02。

## 16. TIDEA-17 缓冲带回程预告(U-06)

- 实现: advTownReturnTick 缓冲带段前置——`线南 6 格(z≥126)`一次性
  `🌼 再往前就回家啦！`(7 字判据合规, 不碰 ADR-0011 决策 3 home 侧话术锁/决策 4
  白闪触发线); 迟滞=撤臂后退到线南 12 格(z≤120)才重臂(线边徘徊零重刷);
  armed 随 advSetDim 进镇置位/出镇清零(维度行身份比对=壳层回程门先例口径,
  零 town 字面量, dims :289 守门复核过); ADV_TOWN_RETURN_Z=132 注释窗(§6.3.5)
  未触碰。
- 单测: 进带恰一次→徘徊零重刷→退距重臂再进恰再加一次→z132 越线照常发令
  (portalCd+dim 迁移双证=触发线语义零变化)。
- 走查未单列(纯 toast 文案面, e2e 单测已锁四拍), 以单测绿为口径。

## 17. TIDEA-19 首访轻引导(U-08)

- 实现: 会话态三旗(townEnteredOnce/townGreetDone/firstVisitHintOn)——首进探索态
  卡拦截为 `村民们在等你呢！👋`(≤10 字, 不完成零压力); dialogEvent close
  result='done'(取值域 deferred|done|continue, town-dialog-core L354 实读确认)
  →记账+**即时摘**(本会话不再提示), 标签回落由 feed 的 applyState 落卡;
  enteredOnce 不随离镇复位(仅本会话首次进镇有效), 离镇/换机清零串轮。
- 单测: 首进邀请句→continue/deferred 保持→done 回落🚶→离镇再进零提示。
- 走查: close done 后 hintLabel=随便逛逛/hintIcon=🚶 实证, 底片 t2-05。

## 18. 波次二验收账

- 测试: 我面六套(town-ui/town-ui-core/adventure-mode/town-dialog/town-interact/
  conventions)313/313 绿; scoped eslint(eslint google 基线)+stylelint 双清;
  dims 源守门(:289 正则)与 return-z 注释窗(§6.3.5)自查过。
- 共享 worktree 现状: 他线 TIDEA-01 风车 spinner 在途(prefab-kit/town-assembly/
  spinner-core/dims-core mkSpinnerMesh 面), T-SEAM-05 拼格两红归属该在途面,
  与本批零交联(未触碰, 共享纪律不代修); 本批提交精确 add 五文件与他线在途隔离。
- 走查证据: shots-light/t2-00..05 六底片; walk-tidea2.mjs harness 不入库
  (walk 系前例); 探针文件 probe-*.mjs 均一次性设计工具。

## 19. 波次二接口备忘

- camRef 产线接线=待开票(T-UI-03 相机源票): fovDeg(当前 70 合成值仅探针用)/
  aspect/origin/dir 源归引擎链, 接线后 T-UI-03 高亮层+气泡锚定档整体自然激活,
  零适配层改动。
- TIDEA-16 钟鸣(音频配对)归波次三音频批; U-07 说书人摊位未在本批(提案源
  hud-ideas.md U-07 留档)。
- 波次一在册事项继续有效: T-UI-04 对话本体装配、伪影豁免项关闭状态见 §12。

---

# 城镇翻新 TIDEA 波次三·light 线(专项一/专项二/音频批)

> 日期: 2026-11-15 · commit: **beea384**(town-ui.js/modes/adventure.js/audio-registry.js/两测试文件, +385/-9)
> 授权: lead 波次三派单(专项一 lead 扩权 camRef 缝; 专项二血条缺口修复; 音频批 TIDEA-02/11/18)

## 20. 波次三交付账

### 20.1 专项一: bubbleCamRef 最薄接线(锚定档产线点亮)

- **camRef 单缝死锁发现(报告披露项)**: 产线自动实例 camRef=null——T-UI-03
  命中判定(townHlHit 吃 camRef 位姿)+hover 气泡+点选结算全链死锁, NPC 对话
  不可达; 只接「锚定投影」不喂「判定链」=空转。故 bubbleCamRef 新缝同喂
  hover 判定+锚定投影两消费面(同源自洽), **点选结算(onEntryClick)随 hover
  连带激活**——非扩权越界, 是对话可达的前提, 特此登记。
- **授权边界(精确)**: T-UI-03 标记视觉档(refreshHl)仍吃 camRef 保持休眠
  ——标记档零视觉溢出(产线实证 9 标记全 hidden, w3-10 底片); camRef 单测
  在册(camRef=null→attach→hover 活+锚定+标记仍 hidden+点选连带+attach(null)
  回休眠)。
- **app 层 advTownBubbleCam**: world.js 顶层 const camera 词法直读(零引擎
  改动, 授权内), getWorldDirection 反算视角+fov/aspect 直读+origin=相机位;
  Node/沙盒 camera/THREE 缺席早退 null(与 mkTownUi camRef 缺省同守卫形)。
  advTownInteractBoot 进镇建机同拍注入(幂等)。
- **产线实证(walk-light-w3)**: anchored:true+内联位 776×429+真相机读数
  (fov72/origin(79.55,26.8,97.2)/dir(0,0,-1))+9 标记全 hidden。
- **走查坑登记**: HL_AIM_MAX_DIST=24 瞄准距离门(town-ui-core)——钟塔
  spawn 机位 39.3 格角度锥内(4.16°<8°)仍 miss 的真因; 试射机位=钟塔正前
  ~18 格(z=94, 且在樱花带外防 amb_birds 归因污染)。

### 20.2 专项二: 镇内血条真缺口修复

- **定性(t2-00 底片)**: THREE Sprite 世界血条漏出 body.adv-dim-town DOM
  门控之外——真覆盖缺口, 非表现瑕疵。
- **修法**: mkHpBar visible 政策缝(深接口预留位)+ADV_TOWN_DIM_ROW 行身份
  比对收口(同 TIDEA-12 口径); 挂 update 既有每帧触点零新增轮询。
- **产线实证**: w3-20 底片镇内无血条(与 rr-r2 终态一致)。

### 20.3 音频批: TIDEA-02/11/18 全绿

- **registry 9 新键**(全带 synth 回退): bell_town/amb_windmill/amb_rooster/
  amb_market/amb_birds/bubble_pop(纯合成)/chip_pop(纯合成)/praise_jingle/
  dlg_flip。
- **TIDEA-02 迎宾钟三响**: 白闪落定同拍+500ms 节律, 回程不响;
  advTownBellTimers 真墙钟句柄登记, advSetDim 开头+cleanup 双清(防回程迟到
  响跨场)。
- **TIDEA-11 景区四声**: 权威坐标划区+进区播+置位一次性 flag+离区(r+2 迟滞)
  重臂+advSessionResets 清(会话态); ADR-0011 禁定点循环口径。
- **TIDEA-18 反馈五槽**: 气泡冒出/面板开合/选项轻点/表扬浮现/回望钟鸣配对;
  翻转沿检测放 refreshDlg 尾部对账(三状态变量), 同态重入零重响, enterTown
  清; 音频进 town-ui 走 deps.sfx 注入(null 静默可测), adventure.js 走 advSfx。
- **产线 fired 证据**: portal_travel+bell_town×3(真链路踩线), 四景区音归因
  全对(rooster/windmill/market/birds), 回望脉冲 false→true(徽章 seen-pulse
  class 视觉取证)。
- **测量盲区登记**: town-ui 槽音效走全局 sfx 直通不进 advProfile 包装——
  产线五槽/TIDEA-16 钟只能靠 Network 样本请求(.m4a 键)或视觉 class 取证;
  advProfile 插桩只覆盖 advSfx 面。单测已锁全链音序。

### 20.4 测试与守门账

- town-ui 52 / adventure-mode 182 / audio-registry 11 / conventions 12 全绿;
  scoped eslint 零错(含 --fix 后复跑); conventions「零直写玩家六绑定」守门
  连注释扫——advTownBubbleCam 局部命名 dirYaw/dirPitch 避字面(判例登记)。
- TIDEA-11 二进镇断言口径: freshInit 清桩=本轮口径(再响即归零证据), 非累计。

---

# PO 反馈返工单(lead 转达, 2026-11-15 同会话接单)

> PO 亲反馈三项不要: ①左上任务状态卡(「比如找面包什么的」太丑且与现 UI
> 风格不一致) ②一进小镇的到达提醒(时刻卡) ③「随便逛逛」提醒。①③=同一
> 元素(左上状态卡三态), ②=TIDEA-15。要求全去掉, 机制层 headless 保留。

## 21. 返工交付账(A/B/C/D 逐项)

### 21.A 左上状态卡整体移除

- **删**: 卡壳 mount 装配(card/iconEl/labelEl/ttsBtn 三件)+applyState 卡段
  (三态文案/图标/类切换+L1 显隐)+root.appendChild(card)+feed 的 tts-hint
  分支(卡话术 TTS 随卡死)+TIDEA-19 首访三变量(townEnteredOnce/greetDone/
  firstVisitHintOn——lead 令: 无其他消费面全删)+dialog close 的 greet done
  记账段。
- **留(机制 headless)**: 核心态 cur 步进(feed/townHudCardState 全链)/
  prevCardState(feed 事件载荷=机制层)/TOWN_CARD_ICONS(对话缩略图 L701+
  标记图标 L523 消费)/greet done 事件 feed 链(payload.result/taskRef 玩法
  侧消费)/L3 表扬槽(praise-show 独立在册)/L2 罗盘徽章/L4 回菜单钮。
- **C 项裁决①**: toast「🏘️ 到小镇啦!」保留——ADR-0011 seam 到达播报语义,
  非 PO 反馈对象(风格=既有 toast 系); 代码注释已标注裁决出处。
- **C 项裁决②**: TIDEA-16 L2 徽章脉冲保留——底片实证 L2 徽章(顶部罗盘)
  与左上状态卡**独立元素**(rr-r2: 徽章在卡亡); 非同壳, 脉冲不随卡死。

### 21.B 到达时刻卡(TIDEA-15)整体移除

- 删 advTownArriveCard 函数+到达分支调用+css/town.css 两块(675/725 段+
  头注释), 回到 9bca4ac 之前形态; 装配测撤除(源切片测试随函数亡)。

### 21.测试删改账

- town-ui.test: 卡 label/ttsBtn/自动朗读断言删; 重播钮测试整删(§3 撤除注);
  TIDEA-19 首访三态测试整删(L2021 段+撤除注); 会话避让 L1 断言改 L2/L4
  (卡亡后避让语义塌缩); 意图冻结对照断言载体 speech→praise-show(tts 载体
  随卡撤, 冻结解除语义由表扬承担); 挂载测试改「三槽+卡不复活」反断言。
- adventure-mode.test: TIDEA-15 装配测撤除(+撤除注)。
- **数账**: town-ui 52→50(-重播钮-TIDEA-19), adventure-mode 182→181(-TIDEA-15
  装配), 全绿(50/181/11/12)+scoped eslint+stylelint 零错。

### 21.D 镇名牌横幅(ADV_DIMS hud.banner)去向说明(报告素材)

- **独立挂点保留**: 横幅=顶部 #hud 状态行(ModeKit MK.hud innerHTML,
  advHudLines 行构造), 与左上状态卡(#townHud L1 槽)完全不同挂点——**不随
  卡亡**。终态读数: bannerLine="🏘️ 小镇 · Midport Village" 在册(TIDEA-12
  安静模式镇内唯一状态行)。
- **左上区域终态(rr-r2 底片)**: 状态卡原位置(safe 区卡壳)**空了**; 左上角
  顶部仅剩镇名牌横幅文字(状态行首行位)。即: 卡没了, 横幅还在(不同高度层)。

### 21.产线终态取证(walk-light-rework.mjs, rr- 底片)

- rr-r1 到达窗口: arriveCard:false+toast「🏘️ 到小镇啦!」在(白闪退散中段)。
- rr-r2 终态: hudCardEl/ttsBtnEl/arriveCardEl 全 false+badgeMounted:true
  (is-fallback is-front band-near)+homeBtnMounted:true+bannerLine 在。
- rr-r3 机制活证: hover 气泡显(hidden:false)+点选面板开(open:true)——
  机制 headless 保留实证(任务/会话交互链零删除)。
- 任务三态不再出现: 载体 DOM 已亡(hudCardEl:false 恒真), 三态文案
  (随便逛逛/村民们在等你呢/任务标签)产线零出口。

### 21.TIDEA-15/19 否决登记(不再回捞除非 PO 翻案)

- **TIDEA-15 到达时刻卡**: PO 否决(2026-11-15)。提案源 hud-ideas U-04,
  波次二交付(9bca4ac)。撤销形态=完整回退(函数+调用+css+测试)。
- **TIDEA-19 首访轻引导**: PO 否决(2026-11-15, ①③同元素三态之一)。
  提案源 hud-ideas U-08, 波次二交付(9bca4ac)。撤销形态=卡文案面全删+
  记账变量全删+测试撤; greet done 事件机制层保留(玩法侧不受影响)。
- 波次一/二其余交付(TIDEA-12/13/14/16/17)PO 未点名, 维持在册。



