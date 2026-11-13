# Midport Village 素材件库就绪规格（Town Prefab Specs）

> 文档状态：**设计权威（城镇素材件库就绪规格）**  
> 产出日期：2026-11-12  
> 工程口径：**库就绪**（照着能直接写蓝图），**不含代码**。  
> 框架唯一权威：[`GLOSSARY.md`](../../GLOSSARY.md)「蓝图件库（PrefabKit）」与「SceneKit」；接口/行为以 [`js/prefab-kit.js`](../../js/prefab-kit.js)（`place`/`footOf`、行表自持、按形命名、变种 `v` 显式覆写、材质 id 注入、拼写域 `throw`、越界逐格不写）与 [`test/prefab-kit.test.js`](../../test/prefab-kit.test.js) 为准；树家族以 [`js/scene-kit.js`](../../js/scene-kit.js) 为准。  
> 视觉细化对照：[`docs/design/town-buildings-visual-spec.md`](town-buildings-visual-spec.md)（建筑/地标/环境）· [`docs/design/town-villagers-visual-spec.md`](town-villagers-visual-spec.md)（角色，本文仅作分工边界说明，不入 PrefabKit）。  
> 地图/资产归位：[`docs/town-map-design.md`](../town-map-design.md) · [`docs/town-assets-requirements.md`](../town-assets-requirements.md)

## 1. 目的、范围与标注口径

- **目的**：将城镇所需建筑、地标、关键场景件与植被件逐项落为 PrefabKit/SceneKit 可直接承接的规格（蓝图名、几何内核、脚印、变种面、材质注入、复用关系），作为后续蓝图实现与场景装填的唯一素材件契约输入。
- **范围**：覆盖 `town-map-design.md` / `town-assets-requirements.md` 中的建筑与关键场景件、植被件；角色/NPC/生物与 UI/音效不入本文蓝图几何范围（见 §6 分工）。
- **标注口径（逐件保留）**：
  - **【电影原样】**：电影/官方联动可确认或强指向的母题、命名地标与气质锚点（事实底座见 [`docs/minecraft-movie-town-research.md`](../minecraft-movie-town-research.md)）。
  - **【建议为游戏性调整】**：为 6 岁可读性、体素实现成本与“祥和无威胁”所做的转译；材质/尺寸在蓝图 `v` 轴上可调，默认可执行、PO 可覆盖。
- **冲突裁决**：本文与既有四件套/视觉规格冲突处，**以 PrefabKit/SceneKit 框架契约为准**改写文档侧描述（材质 id 注入不焊死、按形命名、`v` 显式覆写、几何与落位政策分线、越界不写）。

## 2. 框架契约摘录（实现必须遵守）

### 2.1 PrefabKit（`js/prefab-kit.js`）
- **接口**：`PrefabKit.place(id, x, y, z, v?) → {x1,y1,z1,x2,y2,z2}`（闭区间整数，世界脚印盒）；`PrefabKit.footOf(id, x, y, z, v?)` 同参同盒、零写纯查询。
- **命名**：按形命名，不按图命名（现有 `stilt-hut` / `under-room` / `mound` 同纪律）。
- **朝向基准**：`face ∈ {south,west,north,east}`，行内 `facing0` 为几何内核的现朝向；旋转序 = `(face − facing0)` 的 90° 倍数；`mirror` 先翻 `dx` 后旋转。缺省 `face=facing0` 恒等。局部系原点 = 锚点 `(x,y,z)`。
- **变种与材质**：`v` 键集 = 行 `defaults` 键集（未知键 `throw`）；材质/方块 id 经 `v.ids` / `v.mat` 等槽注入，不焊死 config 常量。必传轴（`require`）缺失 `throw`。
- **错误/守卫**：拼写域（未知 id / 未知 v 键 / 非法枚举 / 必传缺）→ `throw`；几何数值域 → 钳。越界逐格静默不写（`x/z/y` 三界）。
- **脚印**：`footOf` 为形常数投影，与内核同参；“写出格 ⊆ footOf 盒”是测试口径（未来 flats/blocked 接线缝，本期不接线）。

### 2.2 SceneKit（`js/scene-kit.js`）
- **树家族（几何唯一权威）**：`tree(x, baseY, z, salt?)` 圆冠（缺省 `hashRand` 干高口径，可选盐）· `pine(x, baseY, z, salt)` 锥冠 · `pineSnowy(x, baseY, z, salt, snowLeafId)` 覆雪锥冠（`snowLeafId` 由调用方注入）· `scrub(x, top, z, salt)` 矮丛（`top` = 脚下表面格）。
- **成员纪律**：按形命名不按图命名；**几何与落位政策分线**——立面包门禁、雪根座、散布密度/选点留调用方；越界守卫在家族内核（界外不写）。
- **材质现状（实现约束）**：`tree`/`pine`/`scrub` 内核当前写固定原木/树叶 id（5/7）；`pineSnowy` 的雪叶 id 可注入。若城镇需异色叶（如樱花冠），属“调用方覆写层/后续蓝图扩展点”，本文在件规格中显式标注，不在文档里写散装树几何。

### 2.3 现有蓝图基底（可复用）

> 行表清单唯一权威 = `js/prefab-kit.js` `PF_ROWS`（T-PREFAB-01..07 全量 ingest 后十行实现；§4.8 `board-pool` 经 PO 2026-11-13 裁决推迟未实现，spec 保留待收口再议）。缺省材质经 T-PREFAB-09 逐槽实义核真（危险/错义 id 不作缺省，§5.2 行内安全缺省）。

| id（按形） | 形态 | `facing0` | 关键 `v` 面（摘要） | 材质注入槽 | 典型复用指向 |
|---|---|---|---|---|---|
| `stilt-hut` | 高脚木屋（桩脚+地板+墙环+门洞+顶/帽+家具+台阶） | `south` | `size{hx,back,front}` · `piles(fixed/terrain)` · `ground` · `door` · `roof(flat/stepped)` · `chest` · `torch(wall/rim/none)` · `steps` · `mirror` · `face` | `ids{log,plank,chest,torch}` | 小体量高脚/木构小屋基底（需较大形变时建议新增件而非硬套） |
| `under-room` | 三明治埋室（地板/腔/顶+竖井+可疑地板+出路） | `east` | `mat`(必传) · `half` · `cavH` · `floorDy` · `shaft` · `trap` · `torches(solo/pair)` · `chest` · `exit{steps,width,capSwap,landing}` · `mirror` · `face` | `ids{chest,torch,cap,land}` + `mat` | 地下储藏/埋室类场景件基底（`cache-cellar` §4.9） |
| `mound` | r2 圆底三层土丘+南向洞口+点缀掷点 | `south` | `top`(必传) · `rock`(必传) · `salt` · `mirror` · `face` | `top`/`rock` | 丘体/小土包/彩蛋地形件基底（`hill-mound` §4.10，材质注入即改观感） |
| `tower-belfry` | 钟塔（地基+收分塔身+开敞钟室+阶梯顶饰） | `south` | `heightTier(14-16 钳)` · `openBelfry` · `hasDoorNiche` · `flags` · `mirror` · `face` | `ids{base,wall,pillar,trim,roof,bell,window,flag}` | 竖向地标基底 |
| `shop-awning` | 临街铺面（店身+前廊遮檐+招牌层） | `south` | `doorOpen` · `windowGlow(warm/none)` · `signVariant(icon/blank)` · `mirror` · `face` | `ids{base,wall,roof,trim,awning,signBg,signAccent,glow,window}` | 店面/带招牌铺面基底 |
| `stash-hut` | 秘密储藏小屋（中石基座+墙环+双层小巧顶） | `south` | `roofPitch(low/mid)` · `door` · `mirror` · `face` | `ids{base,wall,roof,trim,door,metalAccent}` | 小体量储藏/点缀小屋基底 |
| `windmill-tower` | 风车塔（收分塔身+锥顶+静态四臂叶轮） | `south` | `sailStatic` · `bladeSpan(3-4 钳)` · `mirror` · `face` | `ids{base,wall,roof,trim,blade,axle}` | 竖向天际线地标基底 |
| `cottage-gable` | 民居 A（单层人字/阶梯顶小屋） | `south` | `hasChimney` · `windowLit`(预留缝) · `mirror` · `face` | `ids{base,wall,roof,trim,window,door,chimney}` | 单层民居模块基底 |
| `house-loft` | 民居 B（双层错顶+挑窗阳台） | `south` | `balcony` · `awningAccent` · `mirror` · `face` | `ids{base,wallA,wallB,roof,trim,window,door,balcony}` | 双层街区民居基底 |
| `stall-canopy` | 市集摊位（木架+顶棚布幔+台面货品） | `south` | `size(sm/md)` · `theme(bread/flower/fruit/generic)` · `mirror` · `face` | `ids{frame,canopy,counter,goods}` | 开放摊位基底 |

> **mirror 盒口径两式并存**（T-PREFAB-09 评估挂账）：偶宽域统一 put 通道 −dx 先翻后旋=脚印盒平移一格（shop-awning/stash-hut/house-loft/stall-canopy）vs cottage-gable kernel 自管 cgO 域内镜像盒不动——同 kit 两种行为，跨行统一属行为变更（四张已清票的既有测试钉死现口径），挂架构线单独票议；本表按行如实登记。`board-pool`（§4.8）状态：PO 2026-11-13 裁决推迟——未实现、不排期，收口时再议。

## 3. 城镇素材件总览与映射

> 图例：**复用现有** = 直接 `place` 现有行（可带 `v`）；**基底派生（需新增件）** = 以现有蓝图形态为参考但几何/参数面超出现有行，须新增行；**SceneKit** = 树形几何走家族；**场景拼装/地表模块** = 不宜入 PrefabKit 行表（见 §5）。

| Prefab/场景件 ID（建议，按形命名） | 类别 | 映射结论 | 复用/引用 | 视觉规格指针 |
|---|---|---|---|---|
| `tower-belfry` | 建筑地标（P0） | **需新增素材件**（竖向塔式，非 stilt-hut/under-room/mound 形） | — | [buildings §7.1](town-buildings-visual-spec.md#71-p0-01-中心广场钟塔bell-tower占地-66高-15) |
| `shop-awning` | 建筑地标（P0） | **需新增素材件**（店身+前廊+招牌层） | — | [buildings §7.2](town-buildings-visual-spec.md#72-p0-02-steves-lava-chicken占地-108高-7) |
| `stash-hut` | 建筑（P1） | **需新增素材件**（小屋）；形态邻近可参考 `stilt-hut` 体量语言但**不可直接复用**（无桩脚/尺度不同） | 参考 `stilt-hut` 墙顶体素语言 | [buildings §5.2 P1-01](town-buildings-visual-spec.md#52-p1氛围与功能扩展) |
| `windmill-tower` | 建筑地标（P1） | **需新增素材件**（阶梯收分塔身+锥顶+静态叶片组件） | — | [buildings §7.5](town-buildings-visual-spec.md#75-p1-02-风车windmill占地-66高-13) |
| `cottage-gable` | 建筑模块（P1） | **需新增素材件**（单层人字/阶梯顶小屋） | 参考 `stilt-hut` 开口/顶语义 | [buildings §7.3](town-buildings-visual-spec.md#73-p1-04-民居-a单层小屋占地-87高-6) |
| `house-loft` | 建筑模块（P1） | **需新增素材件**（双层错落） | — | [buildings §7.4](town-buildings-visual-spec.md#74-p1-05-民居-b双层联排感占地-108高-9) |
| `stall-canopy` | 场景件（P0/P2） | **需新增素材件**（小摊位，可多主题 `v`） | — | [buildings §6.1/§5.3](town-buildings-visual-spec.md#61-中心广场与市集摊位) |
| `board-pool` | 彩蛋场景件（P2） | **需新增素材件**（跳板+小池静态组合件，去危险化） | — | [buildings §5.3 P2-01](town-buildings-visual-spec.md#53-p2可选彩蛋范围允许再加入) |
| `cache-cellar` | 场景件（可选） | **可复用现有蓝图：`under-room`**（埋室/储藏语义） | `under-room`（覆写 `mat/half/cavH/floorDy/shaft/trap/torches/exit/ids` 贴合“秘密小屋储藏”氛围） | [buildings §5.2 P1-01](town-buildings-visual-spec.md#52-p1氛围与功能扩展) · [prefab-kit 现有行](../../js/prefab-kit.js) |
| `hill-mound` | 地形/彩蛋件 | **可复用现有蓝图：`mound`**（材质注入即改观感） | `mound`（覆写 `top/rock/salt/face`） | [buildings §6.5](town-buildings-visual-spec.md#65-远景剪影建议可达性标注)（近景小丘语义时） |
| 樱花树（落位点位） | 植被件 | **SceneKit `tree`**（圆冠几何） | `SceneKit.tree(x,baseY,z,salt?)`；粉冠材质属调用方覆写层（见 T-V01） | [buildings §6.4](town-buildings-visual-spec.md#64-樱花与绿植点缀) |
| 绿植/灌木丛 | 植被件 | **SceneKit `scrub`（优先）/ `tree`（小乔木）** | `SceneKit.scrub` / `SceneKit.tree` | [buildings §6.4](town-buildings-visual-spec.md#64-樱花与绿植点缀) |
| 远景山体/崖屋/神庙 | 远景剪影 | **场景拼装/地表模块（不入 PrefabKit）** | `SceneKit.fill`/heightAt 等场景工具 + 专用拼装函数 | [buildings §6.5](town-buildings-visual-spec.md#65-远景剪影建议可达性标注) |
| 农田/田埂/道路铺装 | 地表与场景组块 | **场景拼装/地表模块（不入 PrefabKit）** | `SceneKit.fill`/分层铺装；道路/田垄属连续地表系统 | [buildings §6.2](town-buildings-visual-spec.md#62-道路与铺装) · [map §4.3](../town-map-design.md#43-路网与可读性规则) |
| 灯柱/桶箱/围栏/布幔等小道具 | 环境道具 | **场景拼装/道具散布（不入 PrefabKit 行表）**（单件可另立小蓝图，本期先分类） | 调用方按点位散布；可选后续拆为微型蓝图 | [buildings §6.3](town-buildings-visual-spec.md#63-灯火与装饰儿童友好) |

## 4. PrefabKit 素材件规格（逐件，库就绪）

> 通用字段说明：  
> - **蓝图名**：建议行表 `id`（按形命名）。  
> - **朝向基準 `face0` 与局部轴**：`+y` 向上；局部 `(dx,dy,dz)` 以锚 `(x,y,z)` 为原点；`face0` 指明“正面/功能朝向”在局部系的 `+dz`/`+dx` 等既定向（与现有行一致：`stilt-hut`/`mound` `facing0=south`=门/洞口朝 `+dz`；`under-room` `facing0=east`=出路朝 `+dx`）。`face` 旋转与 `mirror` 语义同 §2.1。  
> - **脚印声明（`footOf`）**：语义期望 = 该件所有写入格的轴对齐包围盒（闭区间），且与 `place` 同参同盒零写；可达性/碰撞接线不在本期。  
> - **材质注入**：以 `ids{...}` / `mat` / `top`/`rock` 等槽承载方块 id；文档给语义槽与建议默认，**实现不得焊死**。  
> - **几何内核规格**：给体素分解与层序（写序即覆写优先级，参照现有行“后写者赢”纪律）。

### 4.1 `tower-belfry`（钟塔，需新增）

- **【电影原样】** 风车与钟塔是 Midport Village 竖向地标母题；钟室可见、广场视线焦点。  
- **【建议为游戏性调整】** 体素方塔分层收分，开敞钟室四面可读，夜态灯火默认不做；内部是否可进由实现定（默认外观锚点）。
- **蓝图名**：`tower-belfry`（塔+钟室形，非地名命名）
- **复用/引用**：无直接可复用现有行；可借鉴 `stilt-hut` 的“墙环/开口/顶层”写序纪律。
- **朝向基準**：`face0 = south`（塔前立面朝局部 `+dz`，面向广场）；局部轴 `dx` 横向、`dz` 前后、`dy` 竖向。
- **几何内核规格（体素分解，按 `dy` 层）**（对照 [buildings §7.1](town-buildings-visual-spec.md#71-p0-01-中心广场钟塔bell-tower占地-66高-15)）：
  - `dy=0` 地基：`6×6` 外廓（`dx∈[-2,3]` 或以锚居中约定，建议锚=塔心投影，`dx,dz∈[-2,3]` 等价外扩）浅石基座层；实现可用台阶缘表达收边。
  - `dy=1..7` 塔身（高 7）：`5×5` 主体（内缩 1 圈）暖木墙体，四角立柱材质槽可区分；四面中线可选竖缝装饰（写序后于墙体）。
  - `dy=8..10` 钟室（高 3）：外扩至 `6×6` 开敞亭式，四面开口（柱脚保留）；檐层围合；室内中心偏上悬挂钟体占位 `2×2×2`（材质 `ids.bell`）。
  - `dy=11..14` 顶饰（高 4）：阶梯收分小屋顶（陶橙/暖褐）+ 顶尖饰件（暖金）。
  - 开口/装饰：前立面 `dy=1..3` 装饰门洞视觉（浅色内衬或实心可配）；侧面 `dy=4..6` 小窗位；钟室 `dy=8..10` 四面开敞。
- **脚印声明**：`footOf` 期望覆盖 `dx,dz` 外廓最大 `6×6` 与 `dy=0..14` 全高（含檐/顶饰）；装饰旗面若出挑须计入盒或明确裁剪策略（建议计入）。
- **变种参数面 `v`（建议 defaults/约束）**：
  | 键 | 类型 | 默认 | 约束/说明 |
  |---|---|---|---|
  | `face` | enum | `south` | `north/east/south/west` |
  | `mirror` | bool | `false` | 先翻 `dx` 后旋转 |
  | `heightTier` | enum/number | `15` | 总高档 `{14,15,16}`（钳域），影响顶饰/钟室比例 |
  | `openBelfry` | bool | `true` | 钟室四面开敞（儿童可读） |
  | `hasDoorNiche` | bool | `true` | 前立面装饰门洞视觉 |
  | `flags` | enum/bool | `true` | 檐下小旗装饰（樱粉/天蓝点缀，面积小） |
  | `ids` | object | 见下 | 子键白名单：`base,wall,pillar,trim,roof,bell,window,flag` |
- **材质注入口径**（`ids` 槽，语义→建议默认色块/方块 id 由实现映射，**不焊死**）：`base` 浅石、`wall` 暖木-浅、`pillar` 暖木-中、`trim` 暖木-深、`roof` 陶橙/暖褐、`bell` 暖金、`window` 奶油框/浅色内衬、`flag` 樱粉或天蓝。
- **对应视觉规格章节**：[buildings-visual-spec.md §7.1](town-buildings-visual-spec.md#71-p0-01-中心广场钟塔bell-tower占地-66高-15)（三视图/层表/开口装饰为本件几何准绳）。

### 4.2 `shop-awning`（Lava Chicken 店铺，需新增）

- **【电影原样】** 命名地标 Steve's Lava Chicken!。  
- **【建议为游戏性调整】** “熔岩”仅作暖橙装饰光/玻璃意象，**禁止**真实熔岩、明火、烟雾与烫伤暗示；招牌图标化，文案定稿归 UI/贴图层。
- **蓝图名**：`shop-awning`（店身+前廊遮檐形）
- **复用/引用**：无直接可复用现有行。
- **朝向基準**：`face0 = south`（店面朝 `+dz` 面向广场）；锚建议为店身地面中心投影。
- **几何内核规格**（对照 [buildings §7.2](town-buildings-visual-spec.md#72-p0-02-steves-lava-chicken占地-108高-7)、§8 去威胁化）：
  - `dy=0` 地台：`10×8` 外廓，前廊向 `+dz` 外延 1 格。
  - `dy=1..4` 店身：暖木墙体；前立面中门洞 `2w×3h`，两侧各展示窗区（窗内暖橙装饰块意象，非流体/火）。
  - `dy=5..6` 屋顶：陶橙阶梯顶，前檐突出。
  - `dy=7` 招牌层：横向招牌板（宽 6-7）居中；挂钩/图形区分层（图形贴图归纹理/后续资产，几何预留板体）。
  - 侧/后：小窗与桶箱装饰位（可选，低细节）。
- **脚印声明**：覆盖 `10×8` 地台+前廊外延与招牌挑出（`dy` 至 7）。
- **变种参数面 `v`**：
  | 键 | 类型 | 默认 | 约束/说明 |
  |---|---|---|---|
  | `face` | enum | `south` | — |
  | `mirror` | bool | `false` | — |
  | `doorOpen` | bool | `true` | 白天友好敞开感（浅色内衬） |
  | `windowGlow` | enum | `warm` | `warm/none`；`warm` 仅橙色暖光装饰块意象 |
  | `signVariant` | enum | `icon` | `icon/blank`（图标化鸡+餐盘+暖橙光；文字不硬编码几何） |
  | `ids` | object | — | `base,wall,roof,trim,awning,signBg,signAccent,glow,window` |
- **材质注入口径**：`wall` 暖木、`roof/trim` 陶橙与暖木-深、`awning` 奶油布幔、`signBg` 天蓝、`signAccent/glow` 暖金与暖橙（装饰光意象，**禁**熔岩/火方块语义）。
- **对应视觉规格章节**：[buildings-visual-spec.md §7.2](town-buildings-visual-spec.md#72-p0-02-steves-lava-chicken占地-108高-7) · [§8](town-buildings-visual-spec.md#8-steves-lava-chicken-儿童化与去威胁处理)。

### 4.3 `stash-hut`（秘密储藏小屋，需新增）

- **【电影原样】** 命名地标 Steve's Secret Stash!（小而隐蔽）。  
- **【建议为游戏性调整】** 友好可达、无阴暗压迫；可与地下储藏语义搭配 `under-room`（见 4.9）。
- **蓝图名**：`stash-hut`（小储藏屋形）
- **复用/引用**：**不可直接复用** `stilt-hut`（该行含桩脚/台阶/特定盒型）；可参考其门洞与顶写序纪律。地下储藏功能可选**复用** `under-room` 作为独立件组合（非同一蓝图）。
- **朝向基準**：`face0 = south`。
- **几何内核规格**（[buildings §5.2 P1-01](town-buildings-visual-spec.md#52-p1氛围与功能扩展)）：占地 `6×6`，高 `5-6`；单层小屋+小巧屋顶；门侧箱/桶堆叠为**外部道具散布**或可选子部件（建议几何主体不强绑，避免与道具清单耦合）。
- **脚印声明**：`6×6` 底 × 高至 `5-6`。
- **变种参数面 `v`**：`face, mirror, roofPitch(low/mid), door(bool), ids{base,wall,roof,trim,door}`。
- **材质注入口径**：暖木-中/深墙檐、中石基座、铁灰小配件点缀（`ids.metalAccent` 可选）。
- **对应视觉规格章节**：[buildings-visual-spec.md §5.2](town-buildings-visual-spec.md#52-p1氛围与功能扩展)。

### 4.4 `windmill-tower`（风车，需新增）

- **【电影原样】** 风车天际线地标。  
- **【建议为游戏性调整】** 叶片**默认静态造型**（动态旋转属实现/动画选型，规格不绑定；资产可分件预留）。
- **蓝图名**：`windmill-tower`（风车塔形）
- **复用/引用**：无直接可复用现有行。
- **朝向基準**：`face0 = south`（叶片面朝向可经 `face` 旋转以适配视线）。
- **几何内核规格**（[buildings §7.5](town-buildings-visual-spec.md#75-p1-02-风车windmill占地-66高-13)）：基座 `6×6`；塔身 `dy=1..7` 近圆阶梯收分（`5×5→4×4` 近似）；`dy=8..9` 暖褐锥顶；叶片组件以轴心层（约 `dy=7-8`）向四向伸展（单叶约 `1厚×2宽×4长` 体素近似），轴心 `ids.axle`；门窗小而友好。
- **脚印声明**：须包含叶片外伸（四向半径 ~4）后的包围盒与总高 `~13`；`footOf` 需按 `face`/叶片展向给出保守盒。
- **变种参数面 `v`**：`face, mirror, sailStatic(bool, 默认 true), bladeSpan(3-4 档), ids{base,wall,roof,blade,axle,trim}`。
- **材质注入口径**：塔身暖木-浅、顶暖褐、叶片奶油/浅木、轴心铁灰。
- **对应视觉规格章节**：[buildings-visual-spec.md §7.5](town-buildings-visual-spec.md#75-p1-02-风车windmill占地-66高-13)。

### 4.5 `cottage-gable`（民居 A，需新增）

- **【电影原样】** 村庄建筑群母题。  
- **【建议为游戏性调整】** 模块化、门窗大而明亮、无烟火烟囱。
- **蓝图名**：`cottage-gable`（单层坡顶小屋形）
- **朝向基準**：`face0 = south`（门窗立面朝 `+dz`）。
- **几何内核规格**（[buildings §7.3](town-buildings-visual-spec.md#73-p1-04-民居-a单层小屋占地-87高-6)）：`8×7` 基座；`dy=1..3` 墙体+前门 `1×2`+前窗 `2×2`+侧窗；`dy=4..5` 陶橙阶梯顶；后侧装饰烟囱（无烟）可选。
- **脚印声明**：`8×7` × 高 `6`（含檐出挑策略需与 foot 一致）。
- **变种参数面 `v`**：`face, mirror, hasChimney(bool, 默认 true 但无烟), windowLit(bool, 默认 false), ids{base,wall,roof,trim,window,door,chimney}`。
- **材质注入口径**：暖木墙、陶橙顶、浅石基座、奶油窗框。
- **对应视觉规格章节**：[buildings-visual-spec.md §7.3](town-buildings-visual-spec.md#73-p1-04-民居-a单层小屋占地-87高-6)。

### 4.6 `house-loft`（民居 B，需新增）

- **【电影原样】** 村庄建筑群母题。  
- **【建议为游戏性调整】** 双层错落丰富轮廓，与 A 组合成街区。
- **蓝图名**：`house-loft`（双层挑窗/错顶形）
- **朝向基準**：`face0 = south`。
- **几何内核规格**（[buildings §7.4](town-buildings-visual-spec.md#74-p1-05-民居-b双层联排感占地-108高-9)）：`10×8` 基座；`dy=1..3` 一层门窗；`dy=4..6` 二层略内缩/挑窗与小阳台装饰；`dy=7..8` 错高双坡顶。
- **脚印声明**：`10×8` × 高 `9`（错顶最高点计入）。
- **变种参数面 `v`**：`face, mirror, balcony(bool), awningAccent(bool), ids{base,wallA,wallB,roof,trim,window,door,balcony}`。
- **材质注入口径**：暖木-浅/中混搭、陶橙错落顶、布幔点缀色可选。
- **对应视觉规格章节**：[buildings-visual-spec.md §7.4](town-buildings-visual-spec.md#74-p1-05-民居-b双层联排感占地-108高-9)。

### 4.7 `stall-canopy`（市集摊位，需新增）

- **【电影原样】** 开放市集/广场摊位热闹感。  
- **【建议为游戏性调整】** 低高度不遮挡钟塔视线，沿广场边缘成组布置（布置政策属调用方）。
- **蓝图名**：`stall-canopy`（棚架摊位形）
- **朝向基準**：`face0 = south`（摊面朝向顾客侧）。
- **几何内核规格**（[buildings §6.1](town-buildings-visual-spec.md#61-中心广场与市集摊位)、[§5.3 P2-02](town-buildings-visual-spec.md#53-p2可选彩蛋范围允许再加入)）：占地 `3×2 ~ 4×3`，高 `3-4`；木架 + 顶棚布幔 + 台面色块；道具抽象色块可由 `ids.goods`/分层体素表达或留给道具散布（建议主体含台面与棚，细碎货品可选子层）。
- **脚印声明**：随 `size` 变体的外包围盒。
- **变种参数面 `v`**：`face, mirror, size(enum: sm/md), theme(enum: bread/flower/fruit/generic), ids{frame,canopy,counter,goods}`。
- **材质注入口径**：木架暖木、布幔奶油/樱粉/天蓝（`canopy` 按 `theme` 注入）、台面暖木-中。
- **对应视觉规格章节**：[buildings-visual-spec.md §6.1](town-buildings-visual-spec.md#61-中心广场与市集摊位) · [§5.3](town-buildings-visual-spec.md#53-p2可选彩蛋范围允许再加入)。

### 4.8 `board-pool`（高跳板与小水池彩蛋，需新增，P2）

- **【电影原样】** 高跳板与小水池趣味元素。  
- **【建议为游戏性调整】** **静态观赏、无危险高度叙事**；水面为静态装饰色块/意象，不绑定流体模拟。
- **蓝图名**：`board-pool`（跳板+池组合形）
- **朝向基準**：`face0 = south`（跳板指向池的方向）。
- **几何内核规格**（[buildings §5.3 P2-01](town-buildings-visual-spec.md#53-p2可选彩蛋范围允许再加入)）：跳板长 `6-8` 高 `4-5`（阶梯/斜坡体素近似）；池 `2×2~3×3` 浅池沿+静态水色填充；整体安全可达观赏。
- **脚印声明**：跳板与池联合包围盒。
- **变种参数面 `v`**：`face, mirror, boardLen(6-8), poolSize(2-3), ids{board,poolEdge,water}`。
- **材质注入口径**：跳板暖木、池沿浅石、`water` 建议静态水色方块 id（由实现选型，不在本文绑定流体系统）。
- **对应视觉规格章节**：[buildings-visual-spec.md §5.3](town-buildings-visual-spec.md#53-p2可选彩蛋范围允许再加入)。

### 4.9 `cache-cellar`（地下储藏室，复用现有 `under-room`）

- **【电影原样】** “秘密储藏”地标的探索感锚点（建筑名层面）。  
- **【建议为游戏性调整】** 地上小屋与地下室可分件组合；地下室几何直接复用 `under-room`，地上入口/小屋另由 `stash-hut` 或场景拼装承担。
- **蓝图名（复用）**：`PrefabKit.place('under-room', x, y, z, v)`
- **朝向基準**：`facing0 = east`（出路朝 `+dx`；按需 `face/mirror` 调整出口朝向）。
- **几何内核规格**：同 `js/prefab-kit.js` `under-room` 行（三明治埋室、竖井/陷阱可选、宝箱火把、东侧出路与平台）——**以实现行为为准**。
- **脚印声明**：`PrefabKit.footOf('under-room', ...)` 同参同盒零写。
- **变种参数面 `v`（覆写项）**：`mat`(必传) · `half` · `cavH` · `floorDy` · `shaft` · `trap` · `torches(solo/pair)` · `chest` · `exit{steps,width,capSwap,landing}` · `face` · `mirror` · `ids{chest,torch,cap,land}`。
- **材质注入口径**：`mat` 为室体/垫脚主材（如暖石/砂岩/雪材质 id）；`ids.cap/land` 依地表材质注入。
- **城镇建议覆写示例（语义，非代码）**：小体量友好储藏可用 `half=2,cavH=3,floorDy=-6,shaft=0,trap=null,torches='solo',chest=true,exit.steps 4-6,exit.width 1`，材质按周边地表注入。
- **对应视觉规格章节**：[buildings-visual-spec.md §5.2](town-buildings-visual-spec.md#52-p1氛围与功能扩展)（地上观感）+ PrefabKit 现有契约。

### 4.10 `hill-mound`（小丘体，复用现有 `mound`）

- **【电影原样】** 无直接一一对应建筑；可服务彩蛋/地形起伏母题。  
- **【建议为游戏性调整】** 仅作柔和地形点缀或彩蛋基座，不制造压迫/危险高度。
- **蓝图名（复用）**：`PrefabKit.place('mound', x, y, z, v)`
- **朝向基準**：`facing0 = south`（洞口朝 `+dz`；可 `face/mirror`）。
- **几何内核规格**：同现有 `mound`（r2 圆底三层、`top/rock` 点缀掷点、南向 2 高洞口）。
- **脚印声明**：`footOf('mound',...)` 同参同盒。
- **变种参数面 `v`**：`top`(必传) · `rock`(必传) · `salt` · `face` · `mirror`。
- **材质注入口径**：`top/rock` 注入草/土/石等 id；`salt` 控制点缀纹理确定性。
- **对应视觉规格章节**：[buildings-visual-spec.md §6.5](town-buildings-visual-spec.md#65-远景剪影建议可达性标注)（近景地形过渡时参考）。

## 5. SceneKit 植被件规格与场景拼装分类

### 5.1 植被件（挂 SceneKit 树家族；落位政策属调用方）

| 件（场景语义） | SceneKit 成员 | 几何规格（实现权威） | 材质/注入口径 | 落位政策（调用方，不入几何） | 视觉指针 |
|---|---|---|---|---|---|
| 樱花树 `veg-sakura-tree` | `SceneKit.tree` | 圆冠橡树：干 4~5(缺省) + 两层 rad2 冠(削角让位)+顶层 rad1+顶帽；冠叶仅落空气；越界不写 | **现状**：内核写固定干/叶 id（5/7）。樱花粉冠【建议为游戏性调整】需调用方在落位后覆写叶层材质或后续扩展带材质轴的树形件；本文不写散装树几何 | 广场核心 1 棵必备、可选民居/风车旁点缀；间距与不遮挡门窗招牌由调用方控制 | [buildings §6.4](town-buildings-visual-spec.md#64-樱花与绿植点缀) |
| 普通乔木/绿树 | `SceneKit.tree` 或 `SceneKit.pine` | `tree` 圆冠；`pine` 锥冠（盐必传） | 同现状固定 id；材质差异由调用方覆写/选型承接 | 田园与边缘点缀，避让道路与视线 | [buildings §6.4](town-buildings-visual-spec.md#64-樱花与绿植点缀) |
| 覆雪针叶（若后续扩展边界带） | `SceneKit.pineSnowy` | 锥冠+冠顶/冠肩雪叶置换 | `snowLeafId` **由调用方注入**（契约已支持） | 雪原/边界带政策属调用方 | （城镇默认白天暖阳态通常不用） |
| 灌木/花丛体量替代 | `SceneKit.scrub` | 矮干 1-2 + 3×3 缺角扁冠+顶心；`top`=脚下表面格 | 固定 id（5/7）现状；花色点缀建议用小道具/地表色块补充 | 门前/路口低矮点缀，不挡视线 | [buildings §6.4](town-buildings-visual-spec.md#64-樱花与绿植点缀) |

### 5.2 不宜入 PrefabKit 行表的件（明确分类）

| 类别 | 包含内容 | 推荐处理方式 | 理由（契约对齐） |
|---|---|---|---|
| 地表/道路系统 | 主路/支路/广场铺装（E-01/E-02）、田垄与农田成组（B-P1-03/E 类） | `SceneKit.fill`/分层铺装 + 地形高度场/路径生成逻辑（调用方或场景装配层） | 连续、跨大范围、强依赖布局与可达性政策，非单锚定体积蓝图 |
| 远景剪影 | 拱形山体 B-R-01、崖顶房屋 B-R-02、神庙 B-R-03 | 场景拼装专用构建（大体量低细节 fill/阶梯体） | 不可达、尺度超常规单体蓝图、复用价值低于专用拼装 |
| 离散小道具散布 | 灯柱/桶箱/栅栏段/旗帜布幔/花坛盆栽/路标色块（E-04~E-10） | 调用方按点位散布；批量重复项可后续拆为微型 Prefab 行 | 多为 1-2 格尺度或强依赖摆放策略；当前优先保证建筑主件与树家族契约 |
| 角色与 UI/音效资产 | 村民/傀儡/动物、交互图标、UI 底板、音效 | 各自管线（角色/渲染/音频/UI），不入 PrefabKit/SceneKit | PrefabKit 是体素几何蓝图件库；角色/2D/UI/音频属不同资产域 |
| 流体/发光行为 | Lava Chicken 暖光意象、水池静态水色表现 | 几何用装饰块占位 + 材质/渲染层表达 | 框架红线：去威胁化；不绑定真实熔岩/危险流体行为 |

## 6. 与 UI / 其他工种的分工与路标

- **UI 具体视觉与交互设计**：见 [`town-ui-entry-hud-spec.md`](town-ui-entry-hud-spec.md)（分区 A：入口卡/HUD/任务提示/方位指引/交互高亮）· [`town-ui-dialog-spec.md`](town-ui-dialog-spec.md)（分区 B：村民对话框/气泡/会话与选项）。
- **角色视觉权威**：[`docs/design/town-villagers-visual-spec.md`](town-villagers-visual-spec.md)（与本文分工：角色不入 PrefabKit 几何行表）。
- **建筑/环境视觉权威**：[`docs/design/town-buildings-visual-spec.md`](town-buildings-visual-spec.md)（本文将其体量/分层转译为蓝图几何规格，材质色以注入槽承接）。

## 7. 一致性核对摘要（对齐四件套与资产清单）

- `town-map-design.md` §4 建筑/地标清单（P0/P1/P2/R）均在 §3 总览与 §4/§5 中给出映射：新增 Prefab 件 / 复用 `under-room`/`mound` / SceneKit 树 / 场景拼装分类。
- `town-assets-requirements.md` §4/§5 建筑与环境项与本文 **一件不落互查**：见该文档“Prefab/SceneKit 映射”列与路标。
- 树/植被描述统一改挂 **SceneKit 树家族**（`tree`/`pine`/`pineSnowy`/`scrub`），并保留“落位政策属调用方”的契约声明；散装树几何描述已移除。
- 复原程度口径维持：**【电影原样】** 地标母题与命名锚点保留；**【建议为游戏性调整】** 体素化、去威胁化与参数化落入 `v`/材质注入。
