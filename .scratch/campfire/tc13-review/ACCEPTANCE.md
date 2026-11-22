# T-C13 视觉复验记录（design-lead 管线 · §4.4 真管线独立复核 + §4.5 五项 + 五锚实机走查）

- 复验对象：T-C13 合并 e1a5a6b（产品面 5 文件：texture-atlas 四画师+分面接线+count 68 /
  mesh-core 逐面 atlasTileOf / config thin 0.4375 / 两 test 翻新）
- 日期：2026-11-22 · 结论：**PASS**（附 PO 复验观察项三条，均非缺陷）
- 材料基线：.scratch/campfire/tc13-verify/（probe.json+acceptance.md 等）——本复验不转抄其数值，
  全部独立复算后对撞

## 一、代码面核对

- config：两态 thin 0.5→**0.4375**，注释如实化（thin 不参与物理仅渲染形状，7/16 正典
  UI 定稿 §4.1 v1.9，T-C13 核实落地）✓
- mesh-core：pushCampfireBox 由全脸同图（FACES[3].dir 一行取格）改**逐面 atlasTileOf(face.dir)**，
  分面条目 {top,side,bottom} 三键齐兜底、底面不绘不被查询；T-C8b 取光语义零触碰 ✓
- texture-atlas：四画师 CF_TOP64/SIDE65/OUT_TOP/OUT_SIDE 逐字照 §4.2/§4.3（与文档双源对撞
  6/6 同款画稿）；旧 62/63 作废存档不接线+存档测试守着；layout tiles[81]={top:64,side:65,
  bottom:65} / [82]={66,67,67}；count=**68** ✓
- 运行时形状（shape-check.js）：count 68 / tiles 分面形状 / BLOCKS 两态 thin 0.4375 全核实

## 二、§4.4 真管线判据（verify-atlas.js，真 paintAll 含 rng 笔触+alpha 位）

| 判据 | 定稿 | 真管线复验 | 结果 |
|---|---|---|---|
| 燃态焰四档合计 | ≥80（静态 94=灶44+侧50） | **94 = 44+50 精确命中** | ✅ |
| 白芯/亮黄 | ≥36（静态 46） | **46** | ✅ |
| 余烬红 | 8（灶面双弧） | **8**（灶 8+侧 0） | ✅ |
| 熄态焰色/余烬 | 双零 | 0+0 / 0+0 | ✅ |
| 熄态最高亮度 | =灰烬灰 a #b9b4a8 | tile66 [185,180,168]（alpha≥128 像素内） | ✅ |
| alpha 六格 | 65/67 真透 | 65=122/256、67=90/256；alpha=0 计 134/166（画稿透明位 135/172 − 散斑补撒 1/6，自洽） | ✅ 与 probe.json 逐值对撞 |

- 噪声笔触不影响焰色计数的预测成立（噪声只抖 C 地 ±6%、不碰固定焰像素）——静态面与
  真管线同值，命题「施工实现=定稿」双口径闭合。

## 三、§4.5 五项

1. 焰簇可辨：§4.4 复验（上表）+ 真管线放大图 atlas-tile64~67-64.png ✅
2. 夜间光语义：mesh 顶点光机器 T-C8b 已复验且本票零触碰（燃烧自身格 15/熄灭面朝向邻格）；
   texture-atlas.test.js 40/40 含两态顶点光断言 ✅
3. 确定性：paintAll 两次逐字节一致（shape-check.js）✅
4. 相邻走查：真管线 LOD 8px/格 + 贴身 64px 图（adjacency-*.png）——61 门额牌亮木 vs
   暗灶面族区分清晰，62/63 存档格仍在图集不串色；接缝亮度差 62|63=0.2（暗-暗同族）、
   64~67 侧边为透明边不适用 ✅
5. 施工期断言：texture-atlas.test.js **40/40**（翻新后；char art 四稿行宽+分面接线+焰色判据
   程序面）+ adventure-mode.test.js **0 fail**（含 T-C13 接线翻新）✅

## 四、五锚实机走查（probe-close.js 近景探针——本管线补位材料）

**原三截图缺陷**：tc13-verify 三张 PNG 为玩家默认远景视角，篝火在画面中不可辨（评审无图像
输入未目验，如实声明）——不足以支撑五锚目验。本管线出 `probe-close.js`（复用骨架，改
**独立相机近景**，绕开游戏循环 rig 竞态），两态 × 侧视/顶视四张近景+数值复跑：

- **数值独立复跑与 probe.json 对撞**：lit/out maxYrel=**0.4375**、石块对照 **1.0**（测量法自证）、
  alphaStats 六格逐值一致——施工线探针数据可信 ✓
- **五锚目验**（close-litSide/litTop/outSide/outTop.png）：
  - ① 矮半格不占满：程序面 0.4375+近景「矮灶台」视觉双证 ✅
  - ② 木框底座木质主视觉：侧脸原木横梁+灶面木框双环 ✅
  - ③ 火焰只从中心：灶面焰团内环+侧脸窄柱火舌；**真透看穿实机成立**（侧脸上方透出后方
    地面，非 C 暗底回退）✅
  - ④ 顶面灰烬+炭心：lit 四角 a 斑+焰团；out 灰烬坑+菱形炭心，读「烧透的炭埋在灰里」 ✅
  - ⑤ 木头主体火焰点缀：侧脸木区主导（焰色 50/256=19.5%） ✅

## 五、PO 复验观察项（三条，均非缺陷、不阻塞 PASS）

1. **熄态侧视漂浮感**：67 真透可见率仅 35.2%，45° 侧视读感偏「悬浮黑板」——「矮块+真透」
   设计的自然结果（燃态有火舌填充读感连贯）。PO 手玩若读「烧完的灶台」成立→过；若读感
   不对→§4.3 设计微调小票（如熄态侧脸透明区铺淡暗底）。
2. **顶板悬挑观感**：顶面满幅灶面 vs 侧面木框缩进（tile 内 '..' 边）→近景侧视顶板似「桌面板」
   微悬挑——定稿 §4.1 满幅口径的设计意图内，PO 终审。
3. **probe 近景无粒子特效**：探针走 editBlock+plant 直挂账、绕过 onPlaced 特效链——截图无
   烟粒属探针路径特性；「燃烧活感」PO 实机自见（8090 正常放置链）。

## 六、产物清单（本目录）

probe-close.js（近景探针，可复跑：server 8092/CDP 9224 自清场）/ probe-close.json /
close-litSide.png、close-litTop.png、close-outSide.png、close-outTop.png（近景四图）/
shape-check.js（运行时形状）/ verify-atlas.js + verify-atlas.log（§4.4 真管线判据）/
atlas-tile64~67-64.png（真管线放大图）/ adjacency-lod-56x8.png、adjacency-touch-448x64.png（相邻走查）
