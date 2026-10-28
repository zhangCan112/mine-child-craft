# 第一人称手持视图（HandView）· 施工票图

> 生命周期：施工中（2026-10-28 开工）— 完工后本文件标「已完工」并在 docs/README.md 登记后继。
> 规格权威：[first-person-hand-design.md](first-person-hand-design.md)（D1–D6 + 附录 B 差异表）。
> 正典依据：[mc-first-person-hand-research.md](mc-first-person-hand-research.md)（关键数值清单）·
> [mc-held-item-render-research.md](mc-held-item-render-research.md)（姐妹调研）。
> 任务图（箭头=阻塞）：**T1 → T2a → {T2b ∥ T3} → T4**。每票独立绿（票尾全量 `npm test` 必绿）。

## T1 HeldItems：fp 姿态数据 + swingView 纯函数 + swap 生命周期收口

- **范围**（全部在 js/held-item.js + test/held-item.test.js，保持 Node 可测、顶层零 THREE 不破）：
  1. 两族 fp 常量：`FP_BLOCK`（MC block/block.json 第一人称 `[0,45,0]`/scale 0.40 折算）与
     `FP_HANDHELD`（MC handheld/generated/bow 统一 `[0,-90,25]+[1.13,3.2,1.13]/16+0.68` 折算；
     translation 单位 1/16 格 → 本仓库格）；数值=观感折算起点（design D6，调参不判红）。
  2. defs 全条目嵌入 `fp: {pos, rot, scale}`：工厂（mkToolDef/mkBlockDef/mkPlateDef/mkRodDef）
     从族常量展开，手工条目（hoe/sword/bow_item）按族嵌入；bow 归手持物族（正典 display 继承）。
  3. `defFor` 兜底：产物缺 fp 时回落手持物族（未来手滑不炸）。
  4. `HeldItems.swingView(p, def)` 纯函数 → 第一人称挥击偏移 `{px,py,pz,rx,ry}`：曲线形状照
     正典 sin(π√p)/sin(2π√p)/sin(πp) 家族（调研 Q3），幅度随 def.swing.amp 归一（基线 1.3）。
  5. `HeldItems.swap(oldGroup, def)`：释放旧网格（traverse dispose geometry+material）+ mount 新
     def → 返回新 Group|null；空 def=null（空手）。**本票只交付+直测，消费方接线在 T2a/T3。**
- **验收**（test/held-item.test.js 新增）：
  - 全族 fp 形状：defFor 全路径（16 工具/锄/剑/弓/方块两形/薄片/棒）产物含 fp 且 rot/pos/scale 三键齐；
  - 族正确：方块族 defs 的 fp=方块族值（y 45° 方向），工具/锄/剑/弓/薄片/棒=手持物族值；
  - swingView 不变量：p=0 与 p=1 全零；0<p<1 时 px<0（前送）；p 钳制越界安全；
  - swap：旧组几何/材质被 dispose（spy 断言）· 新组部件数=def.parts · def=null 返 null。

## T2a HandView 模块：静态通道（blocked by T1）

- **范围**：新文件 js/hand-view.js（引擎层 adapter，====五要素横幅；THREE 顶层装配，boot 冒烟
  覆盖不直测）+ index.html 装载序（held-item → hand-view → avatar）。
  1. 自建 handScene（固定环境光+方向光，design D4）+ handCam；
  2. 裸臂建模：盒子小臂（肤+蓝衫袖口对齐玩家身份色），正典裸臂姿态折算（调研 Q2：基座
     ≈(0.64,−0.6,−0.72)、rotZ120→rotX200→rotY−135）；
  3. 持物槽：`HeldItems.swap` 装配，按 `def.fp`（T1 产物）施加视图空间姿态；空手=仅裸臂；
  4. 可见性：`CameraRig.mode===0 && !CameraRig.mounted` 自判（**mounted getter 本票先按
     `typeof CameraRig.mounted` 守卫读取，getter 本体在 T3 落地**——T2a 单独绿不依赖 T3）；
  5. `render(renderer, camera)`：可见时 `autoClear=false → clearDepth() → render → 恢复`，
     投影每帧同步主相机 fov/aspect/near/far；不可见 no-op。
- **验收**：boot 冒烟绿 + conventions 横幅契约绿；main.js 接线**不在本票**（T3），本票允许临时
  不上屏——静态观感验收在 T3 合入后统一直观确认。

## T2b HandView 动态四件（blocked by T2a）

- **范围**（只改 js/hand-view.js）：
  1. equip：沉 0.6 → 沉底 `HeldItems.swap` 换网格 → 抬起；半程 0.14s（与 Avatar EQUIP_HALF
     同拍，design D6）；隐藏帧照常推进（Avatar「隐藏期间也走完」同纪律）；
  2. swing：`HeldItems.swingView` 施加于手部组，dur 沿 def.swing.dur；连触发=连挥；
  3. 走路 bob：步频相位（vel/onGround 自读）小幅平移椭圆；幅度常数模块本地；
  4. 鼠标滞后：视角角与平滑角差 ×0.1 施加（正典 xBob/yBob 机制）。
- **验收**：boot 冒烟绿；曲线端点归零（复用 T1 swingView 不变量，模块层只施加不改造）。

## T3 接线：镜像 + mounted + 主循环两行（blocked by T2a；与 T2b 并行，文件不相交）

- **范围**：
  1. avatar.js：setItem/swing 体内各一行镜像转发 HandView 同名入口（唯一漏斗，10+ 调用点
     零改动）；mountItem 改用 `HeldItems.swap`（等价重构，~8 行→3 行）；头注释依赖增补；
  2. camera-rig.js：返回对象加只读 `get mounted()`（mountFn 现状态的一行暴露）；
  3. main.js：`Avatar.update` 后 `HandView.update(dt)`；`renderer.render` 后
     `HandView.render(renderer, camera)`；头注释增补。
- **验收**：三处伪造 Avatar 的既有测试（adventure-mode/combat-kit/mode-kit）**零改动全绿**；
  boot 全链绿。

## T4 文档收口 + 全量门禁（blocked by T2b + T3）

- **范围**：GLOSSARY 新词条「第一人称手持视图（HandView）」+ Avatar/HeldItems 词条 interface
  增补（镜像转发/fp 姿态/swingView/swap 各一句）；词条格式纪律（≤800 字符）；
  docs/README.md 无需再动（design 已登记，完工后本文件标已完工）。
- **验收**：`npm test` 全绿（含 conventions 文档死链断言）+ `npm run lint` 零错误。

## 状态

| 票 | 状态 | 备注 |
|---|---|---|
| T1 | 待开工 | 前沿 |
| T2a | 待开工 | blocked by T1 |
| T2b | 待开工 | blocked by T2a |
| T3 | 待开工 | blocked by T2a，可与 T2b 并行（文件不相交） |
| T4 | 待开工 | blocked by T2b+T3 |
