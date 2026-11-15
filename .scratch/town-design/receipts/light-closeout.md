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

