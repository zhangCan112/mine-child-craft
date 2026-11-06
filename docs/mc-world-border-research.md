# MC 世界边界与群系过渡的官方观感语言 · 调研报告

> 调研问题（[docs/world-edge-tickets.md](world-edge-tickets.md) T1）：为 home 图四边过渡带（北雪原/南沙漠/西沼泽/东小镇观感）的四位 designer 提供事实底座——①MC 世界边界（world border）的墙/警告/越界行为；②群系过渡（biome blending）的宽度量级与颜色插值方式；③「远方暗示」手法（雾即渲染边界、远处剪影/天际线）；④6 岁友好口径评估（哪些照搬/简化）。
> 所有事实性论断附来源 URL 与来源性质；抓取日期：**2026-11-06**。主体来源为 minecraft.wiki（社区主笔的技术性 wiki，Minecraft 机制事实上的标准参考；其自述"非官方 Minecraft 网站"），全部条目均为当日抓取原文。二手来源、【推算】【建议】均显式标注；AFK 票的保守口径登记见 §6，证据局限见 §7。

## 0. 结论先行（TL;DR）

1. **「默认红墙」是误解**：MC 世界边界墙平时是**半透明水蓝色**（#20A0FF）的窄斜纹动画（条纹从内侧视角缓慢向右上漂移）；颜色随边界状态变化——**扩张=绿（#40FF80）、收缩=红（#FF3030）、不动=蓝**。红是"危险状态色"，不是墙的常态（[World border](https://minecraft.wiki/w/World_border)）。
2. **MC 的警告来得极晚且是"惩罚式"的**：默认只剩 **5 格**时屏幕才出现红色 vignette（边框警告），越过 5 格缓冲带后每秒每格扣 0.2 血，**无任何音效记载**——对 6 岁孩子这套"贴脸+掉血+红屏"应借其形（状态色语言）不借其罚（伤害/惊吓），且要把预警距离大幅前置（见 §4）。
3. **群系渐变的本质是"小尺度混匀"而非"宽过渡带"**：biome 以 **4×4×4 格**的粗粒度存储（[Chunk format](https://minecraft.wiki/w/Chunk_format)），植被/水色在每个方块处取周围 **3×3~5×5 格**（默认档位）内群系颜色的**平均值**（[Options](https://minecraft.wiki/w/Options) Biome Blend + [Biome §Transition](https://minecraft.wiki/w/Biome)），天/雾色按相机所在 **5×5×5** 方块内群系色做**高斯模糊**——插值窗口比本项目的过渡带（24~40 格）小一个数量级，"渐变感"是粗粒度群系交错镶嵌涌现出来的。
4. **「远方暗示」的官方口径就是"雾=渲染边界"**：渲染距离设置的官方描述原文——最远的地形"渐隐进天空色，就像被雾遮住，以避免可见世界的锐利边缘；因此该选项也被称为 fog"（[Options](https://minecraft.wiki/w/Options) Render Distance）；穿雾地标有官方先例——**信标光柱**（1.21.5 起）渲染到渲染距离且"随距离变粗以保持可见"（[Beacon](https://minecraft.wiki/w/Beacon) 更新日志）；**MC 没有专门的"远景剪影/天际线"系统**——村庄等结构就是普通几何体在渲染距离内自然可见。

---

## 1. 研究问题①：世界边界的视觉呈现

来源性质：本节全部抓取自 minecraft.wiki 的 [World border](https://minecraft.wiki/w/World_border) 与 [Commands/worldborder](https://minecraft.wiki/w/Commands/worldborder) 两页原文（前者最后编辑 2026-10-20，后者 2026-10-11），属社区事实性 wiki，为 Minecraft 机制标准参考。

### 1.1 墙体本身

- **先说清楚是哪一版**：world border（可定制边界）是 **Java 版独占**功能（World border 页首标注 "This feature is exclusive to Java Edition"）；基岩版世界只是"结束"（旧世界用隐形基岩围边，见同页 See also）。我们调研的是 Java 版这套观感语言。
- **几何**：边界由四个矩形面组成，默认距世界原点各 **29,999,984 格**（直径 59,999,968）；垂直方向上低于 Y=-2048、高于 Y=2048 **不再绘制**（但边界仍生效），且 1.17（20w48a）起边界会跟随玩家垂直移动（后调整，仍正确显示在世界高度范围之外）。
- **材质与动画**：四个面上是**窄的斜向条纹**，从内侧视角看**缓慢向右上方漂移**（"animated with narrow, diagonal stripes that slowly shift up and to the right from the perspective of the inside"）。条纹贴图出自 Ryan Holtz 之手，Dinnerbone 2014-04-24 的推文称其为"shimmery"（微光闪烁）质感（World border 页 History 一节，附[原推文链接](https://twitter.com/Dinnerbone/status/459327931492605952)，一手）。
- **颜色=状态语言**：条纹颜色按边界状态着色——
  - **不动：半透明水蓝 #20A0FF（默认态）**；
  - **扩张：绿 #40FF80**；
  - **收缩：红 #FF3030**。
  - 【建议】这套"同一图案、三态换色"的语汇对本项目直接可用：屏障未解锁=冷静色、任务完成/通道开启=绿、危险/禁入=红，孩子读得懂。
- **其他渲染细节**：边界**不受雾影响**（Fog 页明确记载它用自己的绘制距离算法，甚至在水下/岩浆/黑暗效果里依然可见——[Fog § Objects unaffected by fog](https://minecraft.wiki/w/Fog)）；边界动画在游戏暂停时也持续播放（worldborder 命令页）；mipmap 对它不生效、1.26.3 修复了透明度与像素网格对齐问题（World border 页 History 待补条目，标注为该页自述）。
- **冷知识（对设计有启发）**：默认边界故意放在距世界硬边 1 chunk（16 格）处——Dinnerbone 的理由是避免玩家从世界边缘"突然跌落"（Trivia 一节，引 [MC-53390 评论](https://mojira.dev/MC-53390#comment-155580)，一手 bug tracker）。

### 1.2 靠近边界的警告表现

- **警告通道只有"视觉红晕"，没有音效**：玩家距边界 **warning distance（默认 5 格）**以内时，**屏幕被染红**（"Causes the screen to be tinted red when the player is within the specified number of blocks from the world border"，[Commands/worldborder](https://minecraft.wiki/w/Commands/worldborder)）；两页正文均**未记载任何警告音效**（保守口径：不写"确证无音效"，写"wiki 未记载"，见 §6）。
- **红晕是"后置"的**：14w19a 更新日志原文——"A red-colored warning aura is seen when within a certain distance of the world border"（World border 页 History）；默认 5 格意味着警告出现时几乎已经贴脸。历史上一度想给得更早，但数值上从未超过默认 5 格+5 格缓冲的量级。
- **红晕依赖画质档**：Fast 图形下警告 tint **不显示**（worldborder 命令页原文）；Options 页把"world border red warning vignette"列为 Fancy 预设启用的效果之一（[Options § Quality & Performance](https://minecraft.wiki/w/Options)）。
- **收缩边界的独立警告**：另一个参数 warning time（默认 15 秒）——当正在收缩的边界将在该时间内压到玩家时同样红屏。1.21.11（25w43a）起插值改为按 game tick 驱动，暂停时边界不再移动。
- 【对照】本仓库已有先例（docs/map-transition-research.md §1.1）：下界传送门的"遮罩"是站桩+紫色扭曲+双段音效；世界边界的"警告"是纯视觉红晕+持续掉血。**两套语言都成立，但边界这套没有仪式感，只有威胁感。**

### 1.3 玩家视角在边界外的行为

- **越界即持续受伤**：只有**玩家**越界受伤（14w31a 起其他实体豁免）；默认伤害 **0.2/秒/格**，距边界 5 格缓冲带（damage buffer）之外才生效；创造/旁观模式豁免（World border 页）。
- **视角上**：越界后**红 vignette 覆盖屏幕**（World border 图册截图原注："There are no hitboxes outside of the world border and a red vignette appears on the screen"）；1.20 之前死于边界伤害的死亡消息是"suffocated in a wall"，1.20-pre1 起改为"\<player\> left the confines of this world"（"离开了这个世界的边界"——官方把死亡叙事从物理事故改成了"越界"语义）。
- **边界外没有碰撞**：边界外无 hitbox，方块无法交互、生物与物品悬空漂浮（图册）；液体可以从界内流向界外；投掷物 1.21.2（24w34a）起撞边界会弹回。
- **潜行边缘的特殊宽容**：贴着边界潜行时，"防走落""减速"等潜行效果被部分取消——官方给贴墙行走开了小灶（World border 页 On entities 一节，部分条目带 verify 标签）。

---

## 2. 研究问题②：群系过渡怎么渐变

来源性质：本节抓取自 minecraft.wiki 的 [Biome](https://minecraft.wiki/w/Biome)（§Tint/§Transition/§Environment）、[Chunk format](https://minecraft.wiki/w/Chunk_format)、[World generation](https://minecraft.wiki/w/World_generation)、[Options](https://minecraft.wiki/w/Options) 四页原文（2026-11-06 抓取）。其中 Chunk format 的 4×4×4 存储粒度另有 [Java Edition protocol/Chunk format](https://minecraft.wiki/w/Java_Edition_protocol/Chunk_format) 互证。

### 2.1 数据底座：biome 是 4×4×4 格的「粗粒度场」

- **存储粒度**：Java 版（至 26.4 前）biome 以 **4×4×4 方块为一个 cell** 存储，每个 16³ section 只存 64 个条目；"方块级的 biome 由这些 cell 平滑而来"（[Chunk format](https://minecraft.wiki/w/Chunk_format) 原文："Biomes in a world are stored in cells of 4×4×4 blocks… Biomes at the block level are smoothed based on the cells"；协议页同口径）。**26.4 起（已公告）改为逐方块存储**（同页 Upcoming 条目）。
- **量级含义**【推算】：两群系的边界不是一条线，而是 **4 格粒度的交错镶嵌**——地表块、树、水各自按所在 cell 的群系配置生成，宏观上看就是"你一patch我一patch"的混铺。本项目的过渡带按 24~40 格设计（T2 前提），相当于 6~10 个 MC biome cell 宽，作为"自定义宽度带"完全在 MC 母语的表现力范围内（MC 自己不画这么宽的带，但没有语言冲突）。
- **群系本身由 6 维噪声决定**（temperature/humidity/continentalness/erosion/weirdness/depth，多噪声插值出平滑的参数场；[World generation § Biomes](https://minecraft.wiki/w/World_generation)）——群系切换在参数空间里是连续的，落到地表才被 4 格 cell 量化。

### 2.2 颜色插值：植被/水「方均」，天/雾「高斯模糊」

- **官方起点**：1.1（12w01a）更新日志——"Smoothed color transitions between biomes – swampland grass, foliage and water smoothly transition into other biomes"（[Biome § History](https://minecraft.wiki/w/Biome)）；1.17（20w46a）——"Biome-specific sky colors now blend more smoothly"。官方管这叫 **smoothed color transitions**，从沼泽草色开始做，说明"难看的接缝"最早就是在草色/水色上暴露的。
- **植被/水的逐方块插值**：交界处的植物或水，颜色受**同一 Y 层周围方块的群系**影响——Java 版取"以该方块为中心、边长为 biome blend radius 的正方形"内各群系的植被/水色，**求平均值**作为该方块最终颜色（[Biome § Transition](https://minecraft.wiki/w/Biome) 原文）。
- **窗口默认多大**：视频设置 **Biome Blend** 项，官方描述"Sets the distance of color transitions between biomes"，默认档位 **Fast=3×3、Normal(Fancy)=5×5**（[Options § Quality & Performance](https://minecraft.wiki/w/Options)）——即**默认插值窗口只有 3~5 格见方**。
- **天色/雾色的插值**：取**相机所在方块的 5×5×5 范围**内各群系的天/雾色做**高斯模糊**（Gaussian blur，Biome § Transition 原文）——比植被的方均更柔和，且是以玩家为中心实时算的。
- **水色**：Java 版水的表面色在原版 data pack 里按群系定义（基岩版在 client biome JSON），水下雾色 Java 默认 #050533、个别群系例外（Biome § Environment）；沼泽水另有深灰 tint（History 条目），基岩版沼泽/暖洋水面还有专属不透明度（65%/55%）。

### 2.3 colormap：grass/foliage 的取色方式

- **三张 256×256 色图**：`grass.png`（草方块、短/高草、蕨、甘蔗等）、`foliage.png`（藤蔓与橡木/丛林/金合欢/黑橡木/红树的树叶）、`dry_foliage.png`（落叶层），在原版资源包 `textures/colormap/` 下（[Biome § Plants](https://minecraft.wiki/w/Biome)）。
- **取色坐标**：以色图**右下角为原点**，**温度沿 X 轴、降水量沿 Y 轴**各增到 1.0；只用左下半张图，超出就取最近边缘色。
- **硬编码例外**（同页 § Special plant tints）：
  - **沼泽/红树林沼泽**：草色由 **XZ 平面噪声**决定——噪声 < -0.1 用 #4c763c，否则 #6a7039（**逐方块噪声拼色**，这正是"混铺"语言的官方实例，对本项目西向沼泽边有直接参考价值）；
  - 黑森林：colormap 色与 #fefefe 按位与再与 #28340a 取平均（原版即 #507a32）；
  - 恶地三兄弟固定 #90814d/#9e814d，樱花丘固定 #b6db61，苍白花园一套去饱和色；
  - **云杉叶恒 #619961、桦叶恒 #80a755**——树冠色**不随群系渐变**（树是"自带色"，只有被 colormap 管的树才渐变）。
- **天色公式**：昼间天空色由群系基础温度算出——`T = clamp(温度/3, -1, 1)`，天色 = `(0.62222224-0.05T, 0.5+0.1T, 1)`（Biome § Environment）——**温度越高天越暖**，这给了本项目"接近雪原天变冷白、接近沙漠天变暖黄"一个 MC 同构的数学口径。

### 2.4 地表块与植被密度：没有专门的「渐变带」

- **地表块不渐变**：地表规则（surface rule）按群系逐方块替换（草/沙/泥等，[World generation § Surface](https://minecraft.wiki/w/World_generation)），两种群系的地表块交界就是 4 格 cell 量化出的镶嵌边缘，**MC 没有专门的"块渐变序列"机制**。
- **植被/水体密度也不渐变**：树的密度是**群系级**配置（如疏林丛林"tree density lower than other forest biomes"，[Biome](https://minecraft.wiki/w/Biome) 各条目），交界处没有独立的密度过渡带。【推算/观察】玩家感受到的"密度渐变"，是两组群系各自配置在 4 格镶嵌带上叠加出来的——**想做出密度渐变，得自己排过渡带内的块序列**（这正是 T2~T5 designer 的活），MC 母语里没有现成机制可抄，但也没有语言禁忌。

---

## 3. 研究问题③：「远方暗示」的手法

来源性质：[Fog](https://minecraft.wiki/w/Fog) 与 [Options](https://minecraft.wiki/w/Options)（2026-11-06 抓取原文）；[Beacon](https://minecraft.wiki/w/Beacon)（含更新日志原文）。

### 3.1 雾即渲染边界（官方口径原文）

- **渲染距离的官方定义就是"雾"**：Options 页 Render Distance 条目原文——"The most distant terrain is **faded into the sky color as if by fog, to avoid a sharp edge to the visible world**; therefore, this option is also known as '**fog**'."（最远地形渐隐进天色、像被雾遮住，以避免可见世界的锐边——因此这个选项也被叫做 fog）。
- **Fog 页的定义口径**："Fog is a rendering feature intended for **obscuring the player's view distance**… or for **seamlessly occluding sharp boundaries such as unloaded chunks**"（雾是用来遮挡视距、无缝遮蔽未加载 chunk 这类锐利边界的渲染特性）——**雾的第一官方职责就是"把世界的尽头画成大气"**。
- **可抄的参数**：主世界空气雾在**渲染距离的 92%** 处开始出现，呈**圆柱形**（天空物不衰减）；基础色 Java 主世界 **#c0d8ff**，颜色主要由相机所在群系决定，渲染距离越小越向天空色靠拢；午夜恒为暗蓝，日出日落朝太阳方向渐变橙色（Fog § Render distance fog）。基岩版另有天气雾（23% 起雾、70% 全遮，#666666）。
- **环境雾（Java 独有）**：远处 chunk 内随距离增强的环境雾，**不随渲染距离变化**——把"远处的东西变淡变灰"作为常态氛围（Fog § Environmental fog）。

### 3.2 穿雾地标：信标光柱（官方「远方地标」手法）

- **信标光柱被官方明确定位为地标**：Beacon 页 Usage 一节原文——"A **landmark beam** reaching into the sky which is **visible from far away**"。光柱高 **2048 格**，水平方向"从任何已加载 chunk 都可见"。
- **可见距离被官方持续加码**（Beacon § History，一手更新日志）：
  - 1.17（21w07a）：可见距离从 256 格提到 **1343 格**；
  - **1.21.5（25w05a）**：光柱渲染突破 16 chunk 限制、**直至玩家的渲染距离**，并且**"随距离变粗以保持可见"**（"Beacon beams now appear thicker when further away so that they remain visible"），高度也从 1024 提到 2048。
- **末地折跃门/信标光束不受雾的正常衰减**（Fog § Objects unaffected by fog：光束用旧式平面雾边界，因此格外容易被远距离看见）。
- 【建议】"**随距离加粗的高亮地标**"是 MC 官方沉淀的远方暗示手法，东向小镇的"剪影道具"若做成一两个**穿雾可见的轮廓/光点**，就是在讲 MC 的母语。

### 3.3 剪影/天际线：官方没有专门系统

- **保守结论**：两页正文与更新日志均**未记载**任何"远景剪影/天际线暗示"专用机制——村庄、掠夺者前哨等结构就是普通几何体，在渲染距离内被雾自然淡化，走近才变清晰（对照 Biome/Wiki 各结构页的描述方式，属"未见记载"而非"确证不存在"，见 §6）。
- **MC 的实际做法**因此是：**雾管"世界尽头"，光柱管"远方目标"，中间地带交给结构几何体自然显影**。本项目东向"小镇轮廓剪影道具"属于超出 MC 母语的扩展手法（可行，但 designer 应知道它不是官方语言，观感上建议向"雾中显影+近处实物化"靠）。

---

## 4. 研究问题④：6 岁友好口径

来源性质：本节是本报告基于 §1–§3 事实的评估，全部为【建议】；所引机制事实见前文出处。

- **MC 边界警告的「吓人度」评估：中等偏高，慎用**。吓点拆解：①红 vignette 是全屏红色（红色+全屏=威胁信号）；②伴随**持续掉血**（0.2/秒/格），孩子会把它读成"我在被惩罚"；③**警告只有 5 格前置**，出现即贴脸，没有"慢慢变红"的渐入缓冲；④死亡文案"离开了这个世界"对低龄偏抽象恐怖。**照搬**：边界"活着"的斜纹动画与三态色语言（蓝=安宁、绿=开放、红=禁行）——这套语汇可预期、无惩罚感，孩子能学会读。**简化/替换**：把"红屏+掉血"换成"渐变的天/雾色+屏障造型+话术引导"（T6/T8 已有此方向），红只在"绝对过不去"的语义上用一点点。
- **群系渐变对 6 岁是加分项**：混铺渐变没有任何惊吓元素，且"大地在慢慢变成雪原"本身就是叙事素材（配合话术「这片大地还在生长中」，与 T6 候选 A 同频）。colormap 的"温度→天色"公式说明**官方也在用"天色先变、地形后变"的次序**——过渡带设计应让**天/雾色渐变早于脚下块变化出现**，孩子会先"感觉到要到了"。
- **远方暗示**：雾化尽头（不出现裸断面）是拍板 2"任何方向都不出现裸露空气墙"的 MC 官方同构做法；信标光柱的"随距离加粗"提示我们：**远景元素要"傻大黑粗"才在雾里读得出**，细杆子在雾中会消失——东向小镇剪影若用，件要大、色要深。
- **值得整体照搬的手法清单**【建议】：①条纹动画边界墙（可预期、可编程成"屏障感"）；②三态色语言；③3~5 格窗口的逐块颜色混匀（过渡带内的草/水色用窄窗口插值即可，勿一步到位换色）；④天/雾色以玩家为中心渐变（高斯模糊口径=别硬切）；⑤"随距离加粗"的远方地标。**必须简化的**：任何掉血/红屏全屏惩罚/抽象死亡文案。

---

## 5. 给四位 designer 的参数锚点速查【建议】

| 维度 | MC 官方值 | 本项目参考口径 |
|------|-----------|----------------|
| 颜色插值窗口 | Biome Blend 默认 3×3（Fast）/5×5（Normal）逐块平均 | 过渡带内植被/水色按 3~5 格窗口混匀，避免硬切 |
| biome 存储粒度 | 4×4×4 格 cell（26.4 起逐方块） | 地表块混铺以 ~4 格 patch 为单位交错，24~40 格带 ≈ 6~10 patch |
| 天/雾渐变 | 相机 5×5×5 范围群系色高斯模糊 | 天/雾色按玩家到边距离连续 lerp（T7「Not yet specified」升格的官方依据） |
| 天色-温度公式 | `(0.622-0.05T, 0.5+0.1T, 1)`，T=clamp(温度/3) | 雪边天色取低 T（偏亮蓝白）、沙边取高 T（偏暖），与 T2/T3 的 palette 端点同构 |
| 边界墙观感 | 半透明斜纹动画；蓝 #20A0FF/绿 #40FF80/红 #FF3030 | 未解锁屏障=中性冷色+缓慢动画；解锁=转绿一瞬间；红只留给禁入语义 |
| 警告前置 | 默认 5 格红 vignette（贴脸） | **反着来**：把可读预警前置到 1/2~1/3 带宽处（天色先行），红晕只在贴屏障 ≤3~5 格时出现 |
| 越界惩罚 | 0.2 血/秒/格 + 全屏红 | 不照搬：话术+挡回，零伤害 |
| 远方地标 | 信标光柱：2048 高、渲染至视距、随距离加粗 | 东向小镇远景元素要大件/深色/高对比，才有"雾中显影"效果 |

---

## 6. AFK 保守口径登记

- **"边界警告无音效"**：World border 与 Commands/worldborder 两页正文与更新日志均未记载任何警告音效，本报告按"wiki 未记载"表述，未写"确证无音效"（实现层面若需引用请以游戏实测为准）。
- **"无专门剪影系统"**：按"未见记载"表述并给出对照证据（结构与光柱的记载方式），未断言"不存在"。
- **Biome Blend 窗口的精确映射**：Options 页只给默认档位 3×3/5×5；更大档位（如 7×7、9×9…）的具体序列该页未列，本报告未引入未证实数字。
- **信标光柱可见距离**：Beacon 页正文（"up to 512 blocks in Java Edition"）与其更新日志（1343 格、渲染至视距）存在滞后不一致，本报告采用**更新日志口径**（一手 changelog 优先），并在此登记矛盾。
- **4×4×4 粒度**已按 Chunk format 页标注"until JE 26.4"；26.4 正式发布后口径会变为逐方块存储，designer 引用时注明版本即可。
- **Bedrock 差异**（基岩无 world border、颜色在 JSON、天气雾等）仅在必要处带过，未展开；本项目参照对象是 Java 观感。

## 7. 证据局限（诚实声明）

- 全部机制事实来自 minecraft.wiki（社区主笔、非 Mojang 官方），属**高信度二手技术参考**而非官方文档；其中带 `verify`/`more information needed` 标签的条目（如边界垂直绘制范围、潜行宽容细节）本报告已回避或注明。
- Dinnerbone 推文（shimmery 贴图作者、"1 chunk 余量"理由）是**一手开发者自述**，但经由 wiki 转引抓取，未逐条核推文原链有效性。
- §2.4 的"密度渐变不存在"、§4 的 6 岁友好评估、§5 的全部"本项目参考口径"为**推算/建议**，非 MC 官方论断；设计定稿仍以 T2~T5 与用户的实机走查为准。
- 本报告未运行游戏实测任何视觉表现；wiki 截图（红 vignette 等）仅作文字佐证。
- 抓取窗口为 2026-11-06 单日，wiki 后续编辑（尤其 26.x 版本条目仍在补全）可能使个别条目过期。
