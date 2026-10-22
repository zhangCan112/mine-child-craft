# 区块流式加载与地形 LOD · 调研报告

> 调研问题：地图变大后"全量 rebuildAll() + 全量渲染"扛不住，想要行业通用的"近处实时计算、远处静态/低成本表示"方案。
> 所有事实性论断附来源 URL 与来源性质；抓取失败或只有二手证据的地方明确标注。
> 本仓库现状以源码为准（voxel.js / world.js / config.js / main.js，读于本次调研）。
>
> **修订记录（2026-10-22）**：项目所有者明确**以 http 服务（server.js 局域网服务器）为正式访问方式、性能最优优先，file:// 双击直开不再是必须路径**。原报告以 file:// 为硬约束，多处结论已修订：Web Worker 从"被否决"翻转为**主路径**（§5.4/§7②b/§8），时间分片降为 file:// 降级路径（§5.5）。项目现状与此自洽：server.js 本就是正式入口，sync.js 已按 `location.protocol==='http'` 做协议感知降级。

## 0. 结论先行

行业标准做法是一个四层模型，从数据到画面逐层"越远越便宜"：

1. **数据层 · 惰性生成 + 按需持久化**：世界不是一个固定大数组，而是"seed 决定、走到哪生成到哪、生成过的落盘"（Minecraft 的 Anvil region 文件按 chunk 读写，空 section 不占内存不占盘）。
2. **模拟层 · 距离分级**：离玩家近的 chunk 全量 tick（实体+方块），远一圈只跑方块 tick（"lazy chunk"），再远只保持"已加载可访问"（border），最外面彻底不管——render distance 与 simulation distance 是**两个独立旋钮**，模拟比渲染更贵，所以模拟半径通常更小。
3. **渲染层 · LOD + 雾边界**：近处全细节 chunk 网格，远处用逐级降采样的粗网格代替（Distant Horizons 的规则：LOD 宽度 = 2^detailLevel，每升一层分辨率减半）；最远端用雾+远裁剪面兜底——雾就是"远处不需要真数据"的最廉价声明，Minecraft 官方把 render distance 直接别名叫 "fog"。
4. **时间层 · 重建永远不卡主帧**：网格重建/生成放后台线程（Minecraft 1.18+ 的 Chunk Builder 默认 Threaded；DH 全程多线程）。本项目经 http 服务访问时 Worker 同源合法（§5.4），可上真线程；file:// 直开时退化为每帧预算式时间分片——与 sync.js 的协议感知降级同构。

**本项目的现状对照**：第 4 层已有雏形且方向正确（编辑管线的 `remeshQueue` + `pumpRemesh(2)`，见 world.js:294-327、main.js:182；http 下该队列可升级为 Worker 消费者，见 §5.4/§7②b）；第 3 层有一半（每 chunk 独立网格 → 视锥剔除自动生效；雾已有 fog(90,230)），缺**距离分级与 LOD**，且 `rebuildAll()` 启动全量建、从不卸载；第 1、2 层完全缺失——`worldCells` 是启动即分配的固定 128×128×48 平面数组（voxel.js:27），没有惰性生成，也没有按距离的模拟分级。**要害排序：先补第 3 层的"距离环懒构建+卸载"与雾/far plane 对齐（小改、立刻让地图能变大），再谈第 1 层的按需生成（大改、无限世界的前提）。**

---

## 1. Minecraft 本体的区块机制

### 1.1 render distance 与 simulation distance 的分离

- **render distance**：控制可见 chunk 数量；"The most distant terrain is faded into the sky color as if by fog, to avoid a sharp edge to the visible world; therefore, this option is also known as **'fog'**"（即官方承认：渲染边界=雾）。最大 32 chunks（内存充足时），Fast/Fancy 默认 8/16。（来源：minecraft.wiki [Options](https://minecraft.wiki/w/Options)，官方社区 wiki；本文经其 API 原文抓取）
- **simulation distance**：单独的设置，控制"实体更新 + 方块/流体 tick"的范围；JE 默认 12、最小 5，BE 默认 4。官方明确建议**小于** render distance，因为"updating all entities within the simulation distance is more taxing on performance than the equivalent level of render distance"。（来源：minecraft.wiki [Simulation_distance](https://minecraft.wiki/w/Simulation_distance)，同上抓取）
- JE 里 simulation distance 定义一个以玩家为中心的方形区域：距离 6 时实体在 13×13 chunk 内正常运动，再外一圈 1 chunk 厚的框里红石/流体/作物仍运行，再外"nothing moves or changes"。（同上来源）
- 历史脉络：1.18 开发版 21w37a render distance 改为圆柱加载，21w38a 加入 simulation distance；1.18 起 chunk 网格重建改为多线程（视频设置里的 "Chunk Builder"：Threaded / Semi Blocking / Fully Blocking，Fully Blocking 才是 1.18 之前的立即重编译行为）。（来源：minecraft.wiki Chunk / Options 页 History 与设置描述，已抓取）

### 1.2 区块按距玩家分等级处理（ticket 系统，Java 1.14+）

一手机制（来源：minecraft.wiki [Chunk](https://minecraft.wiki/w/Chunk) § Java Edition chunk loading，经 API 抓取原文；下述数值另经 Drovolon 的 1.14.4 实测文档交叉验证，见后）：

- 每个被加载 chunk 的加载源于一个 **ticket**（票），ticket 有三属性：类型、**load level**、剩余 tick 数。level 22–44，常规游戏只有 22–33 有意义；**level 越低加载越深**，一个 chunk 取它所有票中最低的 level。
- 四档 load type（**这就是"按距离分等级"的官方实现**）：

| Load type | Level | 性质 |
| --- | --- | --- |
| Entity Ticking | ≤31 | 全部游戏机制可用（实体生成/寻路/掉落） |
| Block Ticking | 32 | 方块 tick/红石/流体运行，但实体不处理（俗称 "lazy chunks"） |
| Border | 33 | 无任何游戏机制，但实体与方块**仍可被读写**（渲染挂这档） |
| Inaccessible | ≥34 | 未加载；**world generation 在此层发生** |

- **level 传播**：从票的中心 chunk 向邻格 flood fill，每走一步 level+1，直到 44。所以玩家周围天然形成"实体圈 → 方块圈 → 边界圈"的同心环——模拟半径就是这么"分级"出来的。
- JE 单机的 tick 范围公式：实体 tick 方形边长 `l = min(2s+1, 63)`（s=simulation distance），方块 tick 再加一圈 `min(2s+3, 65)`。
- 票的类型（玩家 level 31、世界出生点 22、传送门 30、`/forceload` 31、龙战 24 等）与超时/持久化规则，在 Drovolon 的实测文档里有完整经验性描述（来源：<https://gist.github.com/Drovolon/24bfaae00d57e7a8ca64b792e14fa7c6>，社区经验文档，2019，基于 1.14.4 逐项实测；与 wiki 机制描述一致）。
- 版本变更：wiki History 仅记 1.14 "The method of chunk loading has changed"（ticket 系统即此次引入）。**Mojang 官方 changelog 未找到描述 ticket 内部机制的条目**（minecraft.net 的 1.14.4 pre-release 文章本次抓取超时，未验证；不引用其内容）。

### 1.3 region 文件格式（Anvil）与按需持久化

- 现代 JE 存档 = Anvil 格式：底层仍是 **region 文件**（`r.x.z.mca`），每个文件装 **32×32=1024 个 chunk**；文件按 4KiB 扇区组织，header 两张 1024 项表记录每个 chunk 的偏移/长度与更新时间戳，chunk 写入时才分配扇区、追加到文件尾。（来源：minecraft.wiki [Region_file_format](https://minecraft.wiki/w/Region_file_format)、[Anvil_file_format](https://minecraft.wiki/w/Anvil_file_format)，API 抓取）
- Anvil 相对旧格式的关键改动：**空 section 不载入内存也不写盘**；chunk 内部按 16×16×16 section 组织（YZX 排序利压缩）；压缩默认 zlib（24w04a 起可选 LZ4）。（同上来源）
- 这就是"数据层按需持久化"的原型：**盘上是懒加载的单位（region→chunk→section 三级），内存只保留活动 chunk**。

### 1.4 对本项目的适用性

- 本项目世界仅 128×128×48（config.js: NCX=8, NCZ=8），**模拟层分级暂时不是瓶颈**（没有红石/作物；怪物 tick 由 mobs.js 管，量小）；真正缺的是渲染层的分级。
- 但"render/simulation 分离"的**思想**直接适用：将来做无限世界时，"网格构建半径"（贵：顶点生成）应大于"可交互半径"（挖/放/碰撞），小于"可见半径"（LOD 或雾）。
- Anvil 的启示是数据结构层面的：如果走无限世界，`worldCells` 平面数组要拆成 per-chunk 存储 + 脏 chunk 落盘（本项目已有 save-slot.js 做存档，格式上可以沿用 blockKey 思路，不必照抄 NBT）。

---

## 2. Distant Horizons（LOD 分层的行业范本）

来源性质说明：DH 官方仓库与发布页（GitLab / Modrinth）+ 官方 API Javadoc（GitLab Pages，随源码发布）。官方 wiki 的多个页面直抓 404/空响应，未能引用；下述结论均来自可抓取的官方渠道。

### 2.1 LOD 分层规则：宽度 = 2^detailLevel

官方 API 文档 `EDhApiDetailLevel` 原文：

> "Detail levels in Distant Horizons represent how large a LOD is, with the smallest being 0 (1 block wide). **The width of a detail level can be calculated by putting the detail level to the power of 2.** Example for the chunk detail level (4): 2^4 = 16 blocks wide"

- 锚点常量：BLOCK = level 0（宽 1 格）、CHUNK = level 4（宽 16 格）、REGION = level 9（宽 512 格）；1–255 层都合法。
- 即：**每升一层，LOD 单元的边宽 ×2、分辨率减半**；level 4 时一个 chunk 压成一个数据点。配置项 `EDhApiMaxHorizontalResolution.BLOCK` 的注释是 "render 256 LODs for each chunk"（16×16=256，即 level 0 每 chunk 256 个采样）。
- （来源：<https://distant-horizons-team.gitlab.io/distant-horizons/com/seibel/distanthorizons/api/enums/EDhApiDetailLevel.html> 及 index 页，官方 Javadoc，已抓取）

### 2.2 远处区块如何被低分辨率数据代替

- 官方项目自述："renders **simplified chunks outside of the normal render distance** allowing for an increased render distance without harming performance"（来源：<https://gitlab.com/distant-horizons-team/distant-horizons>，官方仓库，已抓取）。
- 数据管线（官方 API 枚举佐证，均抓自 Javadoc）：
  - `EDhApiWorldGenerationStep` 含 **DOWN_SAMPLED**——真实 chunk 转 LOD 即"降采样"步骤；
  - `EDhApiDistantGeneratorMode`：`PRE_EXISTING_ONLY / SURFACE / FEATURES / FULL`（注释："In order of fastest to slowest"）——**远处可以让 DH 用自己的世界生成器按目标精度直接生成**，不必先造真实 chunk；
  - `EDhApiGeneratorPlan`：`SURFACE_THEN_CHUNK / SURFACE_ONLY / CHUNK_ONLY / DISABLED`——先用粗表面生成铺满视野、再逐步细化。
- **generation vs real 的区别**（官方 FAQ，Modrinth 发布页）：
  - 仅客户端装 DH：LOD 由玩家**实际到访过的真实 chunk** 降采样而来，"LODs will be saved between sessions, although you have to explore the world to load them"；
  - 服务器+客户端都装：开启 `Distant Generation` 后服务器直接把（自生成的）LOD 推给客户端。
  - （来源：<https://modrinth.com/project/uCdwusMi>，官方发布页 FAQ，已抓取）
- **磁盘缓存**：官方确认 LOD 跨会话保存（同上）；存为每世界一个数据库文件（社区文档记载为 SQLite `.sqlite`，如 MCME 服务器共享 LOD 包的做法——**二手来源，未能直接抓取验证文件格式**，仅作方向性参考）。

### 2.3 对本项目的适用性

- DH 的三层结构可以按比例缩小搬过来：**真实 chunk 网格（level 0）→ 4×4 降采样粗网格（类比 level 2）→ 雾**。本世界高只有 48，纵向两层足够。
- DH 的"先粗后细填充"（SURFACE_THEN_CHUNK）对启动体验有直接借鉴：进场先用 level-2 粗网格把整张地图铺出来（64 chunk → 每块 4×4 采样，构建成本约 1/16），再按距离环把近处逐个升级成全细节。
- DH 全程多线程生成——本项目 http 服务下 Worker 可用（见 §5.4），多线程路线已解禁；时间分片保留为 file:// 降级路径。

---

## 3. 地形 LOD 经典技术

三篇都是 heightmap 地形渲染的经典，核心思想与一手来源如下（正文均实际抓取）：

| 技术 | 作者/出处 | 核心思想 | 与体素世界的差异 |
| --- | --- | --- | --- |
| **GeoMipmapping** | Willem H. de Boer, flipcode 2000-10-31（常被引作 2000/2001） | 把地形切成 tile，每 tile 预生成几档细节级别（"GeoMipMaps"，类比纹理 mipmap），按误差切档 | 切档思想通用；"按屏幕误差选档"体素下可简化为"按距离选档" |
| **Chunked LOD** | Thatcher Ulrich, SIGGRAPH 02 课程 "Super-size it!" | 四叉树每个节点是一块**预计算好的静态几何 chunk**，按屏幕误差阈值决定展开/收起；chunk 间裂缝用 skirt（裙边）填；顶点 morphing 消跳变 | "静态 chunk + 四叉树 + 磁盘分页"与 DH 同源；体素世界天生成 chunk 化，四叉树可直接借用 |
| **CDLOD** | Filip Strugar, JCGT 14(4):57-74, 2009/2010 | 规则网格四叉树；**LOD 函数全场统一、只依赖观察者到地形的精确 3D 距离**；层间用顶点 morphing 平滑过渡，不需要缝边缝合 | "距离→细节等级"的纯距离函数最干净、最好预测；morphing 对体素不适用（离散格子无需插值），但距离分环思想完全适用 |

一手来源：

- **CDLOD**：作者仓库 README 收录论文摘要——"structured around a **quadtree of regular grids**… the LOD function is the same across the whole rendered mesh and is based on the **precise three-dimensional distance** between the observer and the terrain… smooth and accurate results… **no need for stitching meshes**"（来源：<https://github.com/fstrugar/CDLOD>，作者本人仓库，已抓取；论文 PDF 同仓库 `cdlod_paper_latest.pdf`，工具不支持抓 PDF，未读原文，摘要经 README 核对）。另 vterrain 索引页对三篇的独立摘要：<http://vterrain.org/LOD/Papers>（已抓取）。
- **GeoMipmapping**：flipcode 归档页确认作者与日期（Willem，"31 October 2000"），原文 PDF 在该页链接 `article_geomipmaps.pdf`（PDF 抓取被内容类型拒绝，未读原文）（来源：<https://flipcode.com/archives/Fast_Terrain_Rendering_Using_Geometrical_MipMapping.shtml>，已抓取）。"按屏幕空间误差切档、切档瞬间 vertex popping"的机制描述出自 DTU 技术报告对它的综述（<http://www.imm.dtu.dk/pubdb/views/edoc_download.php/1425/pdf/imm1425.pdf>，**该 PDF 未直接抓取**，经搜索摘要核对，标注为二手）。
- **Chunked LOD**：作者页面（一手）——"Since summertime of 2001, I've been doing some personal research into hardware-friendly continuous LOD… It renders CLOD, with **geomorphs, using batched primitives**. It's very friendly to **texture LOD and paging data off disk**. The downsides include a **long preprocessing phase**, and some size overhead… the data isn't in a convenient form for doing height/collision queries"（来源：<http://tulrich.com/geekstuff/chunklod.html>，作者本人页面，已抓取；课程笔记 PDF `sig-notes.pdf` 同站，PDF 未读）。vterrain 摘要补充：四叉树 chunks + skirts 填裂缝、"Data set must be static"（已抓取，同 vterrain 链接）。

**对体素世界的适用性总结**：这三篇解决的是 heightmap（连续、可插值）的多边形预算问题；体素是离散网格，**不需要顶点 morphing/裙边这类连续性手术**——不同分辨率的体素网格之间本来就允许阶梯状误差（DH 也是这么干的：远处就是大块）。真正通用、值得搬走的是三条：① **"距离 → 细节档位"的函数化分环**（CDLOD）；② **chunk 作为 LOD 的原子单位、静态预计算、可分页**（Chunked LOD）；③ **"越远分辨率越低"的 mipmap 式金字塔**（GeoMipmapping / DH）。

---

## 4. Three.js r128 可用能力（对照本地发布库验证）

本项目 `lib/three.min.js` 就是实际运行的一手来源：文件头 `const e="128"`（REVISION），以下符号均在本地构建中检索确认存在。

### 4.1 THREE.LOD —— r128 已有，可用但不必须

- r128 源码（官方 tag）：`class LOD extends Object3D`，`addLevel(object, distance = 0)` 按 distance 升序插入 `levels`；`update(camera)` 每帧算相机与本体的距离（除以 `camera.zoom`），逐档切换子对象 `visible`。（来源：<https://raw.githubusercontent.com/mrdoob/three.js/r128/src/objects/LOD.js>，官方源码 r128 tag，已抓取；本地构建含 `LOD/addLevel/getCurrentLevel`，已验证）
- 注意：`update` 需要每帧被调用（挂在渲染循环或 `autoUpdate` 走 WebGLRenderer 的内部遍历）；LOD 切换的是**同一 Object3D 的多个子档**。
- **评估**：对"每个区块按距离换档"可用，但本项目已有 `chunkMeshes` Map 管理，直接在距离环逻辑里挂/摘 mesh 更贴合现状（LOD 对象更适合"一个模型多档精度"的场合，如 Avatar/坦克）。**不否决，列为可选工具。**

### 4.2 Frustum culling：逐对象、默认开启

- r128 `Object3D` 构造器：`this.frustumCulled = true;`（来源：<https://raw.githubusercontent.com/mrdoob/three.js/r128/src/core/Object3D.js>，已抓取）。本地构建含 `Frustum` / `intersectsObject` / `frustumCulled`（已验证）。
- 结论：**本项目每个 chunk 的三通道 mesh（solid/glass/tnt）已经是独立 Mesh，逐对象视锥剔除默认生效**，视野外的 chunk 网格不产生 draw call；想关掉单个对象可设 `mesh.frustumCulled = false`。视锥剔除解决的是"画多少"，解决不了"建多少/存多少"——后者要靠距离环。

### 4.3 BufferGeometry 直接操作顶点（Greedy Meshing 可行性）

- 本项目 `buildChunkGeometries` 已经在拼裸数组 → `Float32BufferAttribute`（world.js:152-243），这正是 0fps greedy mesher 需要的全部能力（见 §5.1），r128 无任何障碍。
- 一个坑：**本地 lib 只有核心库，不带 examples 的 `BufferGeometryUtils`**——`mergeBufferGeometries` 字符串在本地构建里仅出现在 `BufferGeometry.merge()` 的警告文案中，不是可用 API。合并几何请继续手拼数组（现状做法）。

### 4.4 fog 与 far plane 的配合

- 本地构建含 `Fog`；项目已在用：`scene.fog = new THREE.Fog(sky, 90, 230)` 而 `camera.far = 1000`（world.js:23/25）。
- **far plane（1000）远大于雾终点（230）**：雾尽头之外的地形仍在视锥/深度范围内参与顶点变换。把 far 收到 ~240 是零风险的净赚（Minecraft 官方语义同款：render distance 即 fog，见 §1.1）。

---

## 5. 体素专属优化

### 5.1 Greedy Meshing（合并共面方块，减三角形）

一手来源：Mikola Lysenko, "Meshing in a Minecraft Game", 0fps.net, **2012-06-30**（<https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/>，作者本人博客，已抓取全文）。核心事实：

- 三种方法的谱系与实测（8×8×8 实心立方体）：
  - **Stupid**（每体素 6 面）：3072 quads；
  - **Culling**（剔除实心邻面，即本项目现状）：384 quads，面数 ∝ 表面积（O(n²) vs O(n³)），16×16×16 chunk 预期约省 16 倍；
  - **Greedy**（按字典序贪心合并共面同类面）：6 quads（此例最优）。
- 理论保证："Optimal ≤ Greedy ≤ Culled ≤ Stupid"，且 **greedy 的面数 ≤ 最优解的 8 倍**（论文定理）。
- 复杂度仍线性于体素数，只是常数更大（多趟扫描）。
- 作者在评论区给出的两个工程约束（对本项目直接相关）：
  - 多方块类型/多朝向：mask 里编码类型与朝向，**只合并同类型同朝向的面**；
  - 光照不同的面不能合并（"you would only merge two quads if the lighting values at their vertices are the same"）。
- 另有社区考据称 Minecraft 本体只做 naive culling 不做 greedy（博文评论区，**二手**）。

**对本项目的评估**：可行但有明确折扣——本项目的色彩是 per-block 哈希 tint（world.js:213 `0.92 + hashRand(...)*0.12`），逐块不同；按 0fps 的合并条件，**要么放弃近处 tint 改为按合并块取色，要么只合并同 id 且 tint 量化相同的长条**。TNT 通道（贴图 UV）不参与合并，玻璃/薄块维持现状。收益预估：平整地形（大地面/墙体）收益最大，竞技场柱林、随机散布场景收益打折；对 128 地图属于"锦上添花"，对放大后的地图+近环属于"正餐"。

### 5.2 面剔除（已有）

本项目 `buildChunkGeometries` 已按"实心邻居挡住则剔面"生成（world.js:199-211），玻璃/薄块有专门规则——即 0fps 谱系里的 Culling 档，无需动作，仅记录：这是所有后续 LOD 工作的地基。

### 5.3 按需生成（seeded noise 惰性生成）

- Minecraft 官方语义："Chunks generate **with the help of the map seed**… As players wander around the world, **new chunks generate as needed**"（来源：minecraft.wiki Chunk 页 Description，已抓取）。即：**世界数据 = seed + 生成函数，访问触发计算，而不是预存在数组里**。
- 本项目已有全部原料：`hashRand(x,z)` 确定性哈希（voxel.js:13）+ SceneKit 的确定性散布。缺的只是把"建场脚本一次性填 `worldCells`"改成"`getBlock` 未命中时按 (seed, 坐标) 现算 + 缓存"。这是无限世界的必要条件。

### 5.4 后台生成不卡主线程：Web Worker（2026-10-22 约束变更后转为主路径）

> 修订记录：初版以"双击 index.html 即玩（file://）"为硬约束否决了 Worker；项目所有者当日明确以 http 服务为正式访问方式、性能最优优先。本节结论已翻转，原 file:// 分析保留为降级路径参考。

**http 服务下 Worker 合法（一手）**：

- MDN `Worker()` 构造器：worker 脚本 URL "**must be same-origin with the caller's document, or a `blob:` or `data:` URL**"。（<https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker>）页面与 worker 脚本同出 `http://<ip>:<port>` 即满足同源，**与是否 secure context 无关**——局域网 `http://192.168.x.x:8080`（server.js 的实际形态）下同样合法，且这是规范行为而非浏览器特定实现。
- **复用体素模型零成本**：`voxel.js` 头注释自述"**零 THREE · 零 DOM · 加载零副作用** → Node 可直接加载单测"（voxel.js:6，本地源码）。这个为单测设计的约束恰好是 Worker 的入场券——Worker 内 `importScripts('js/config.js', 'js/voxel.js')` 即得到完整体素模型，"无构建多文件经典 script"的架构不受影响。
- **数据传递用 transferable，不要指望 SharedArrayBuffer**：MDN SharedArrayBuffer 安全要求原文："To use shared memory your document must be in a **secure context** and **cross-origin isolated**"，否则构造器在全局被隐藏、postMessage 抛错（<https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer>，修订时抓取）。局域网 IP 的 http **不是 secure context**（需 https 或 localhost），给平板场景上自签证书成本过高——因此**不把 SAB 当前提**。正解是 postMessage + transferable（`ArrayBuffer` 按值转移所有权，零拷贝）：主线程发 chunk 数据切片（Uint8Array，一次拷贝开销可忽略），Worker 回传顶点裸数组（transferable 零拷贝），主线程挂 `Float32BufferAttribute`（现有 buildChunkGeometries 拼裸数组的方式正好无缝对接）。
- **协同改造点**：`buildChunkGeometries` 目前直接读写主线程的 `worldCells` 与邻 chunk 数据；Worker 化需把"数据读取"与"顶点生成"拆开——输入为 chunk 数据 + 边界一圈邻 chunk 数据（跨 chunk 剔面必需，否则 Worker 内缺邻界信息），输出为 position/normal/color/uv 裸数组。

**file:// 降级路径（原约束分析，保留参考）**：

- 规范层面（一手，已抓取）：MDN 同源策略页——"Modern browsers usually treat the origin of files loaded using the `file:///` scheme as **opaque origins**"（<https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy>）；Fetch 规范把 file 列为 fetch scheme、行为留给实现（<https://fetch.spec.whatwg.org/>）。推论：`file://` 下 `new Worker('worker.js')` 成败**无规范保证**，Chrome 实践中阻止（二手佐证，见 §9）。
- `blob:` worker 是标准内绕法（blob URL 继承文档 origin，同 MDN Worker 页），但 file:// 下（origin=null，`blob:null/...`）跨浏览器兼容性**未找到一手验证**（Chromium issue 366055344 为方向性二手证据）。**降级实现：try/catch 构造 Worker，失败静默走 pumpRemesh 分片——两条路径共享同一 remeshQueue，只是消费者不同。**

**收益上限（为什么值得）**：主线程只剩"收顶点数组 + 挂 mesh"，建场/重建/惰性生成的 CPU 尖峰不再与渲染帧竞争——这正是 Minecraft 1.18+ Chunk Builder 默认 Threaded、DH 全程多线程的原因（§1.1、§2）。对目标设备（触屏平板，CPU 最弱）价值最大。

### 5.5 时间分片（file:// 降级路径；官方同款档位）

- 0fps 原文即建议："when we have some idle cycles (or alternatively in another thread) we can run the better mesher on them at some later point"——先快速网格顶住、闲时换高质量网格（已抓取）。
- Minecraft 的 Chunk Builder 选项（Threaded / **Semi Blocking** / Fully Blocking）证明 Worker 线程与分帧预算本就是**同一旋钮的两档**（§1.1 来源）。
- 本项目 `pumpRemesh(2)`（main.js:182，每帧最多重建 2 个区块）+ 脏区块队列 + 溢出自动收口（world.js:313-327）就是同一模式，已用于编辑/爆炸。**缺的只是把"启动全量构建"也接到这条队列上**——`loadScene` 的 `rebuildAll()` 改为"全部入队 + 近处优先出队"，即得分帧建场。此队列与 Worker 消费者天然兼容（§5.4）：**队列本身不用改，改的只是谁在消费它**。

---

## 6. "远处静态化"手段清单

| 手段 | 原理 | 一手依据 | 对本项目适用性 |
| --- | --- | --- | --- |
| **低分辨率网格**（每 2^k 格合并采样） | 远处 chunk 用降采样数据构粗网格，构建与绘制成本按 k² 下降 | DH `EDhApiDetailLevel`（§2.1）；GeoMipmapping 的 mip 金字塔（§3） | **推荐主路径**。本地图对角线 ~181 格 < 雾终点 230，一层 4×4 降采样环即可覆盖"雾前过渡带" |
| **烘焙不可变 mesh + 按需挂/卸**（dispose GPU、保留数据） | 远环网格一次构建长期复用；显存压力大的对象从 scene 摘除并 `geometry.dispose()`，体素数据仍在 `worldCells` | Chunked LOD："Data set must be static"+预计算（§3）；THREE 侧 dispose 语义（本地代码现状：`disposeChunkArr` 已这么做） | 与距离环天然配套；卸载=回收 GPU 资源，数据层不动 |
| **冒名顶替者 / billboard（远山剪影）** | 远处场景用面向相机的贴片/剪影代替几何 | 未找到针对体素世界的一手文献（ heightmap 世界有 impostor 论著，超出本次范围，**未验证**） | **当前不推荐**：世界只有 128×128，雾已覆盖边界，剪影无信息量；等无限世界后再议 |
| **雾 + far plane 收紧** | 雾尽头之外无需任何真数据；far plane 收紧减少顶点变换与深度精度浪费 | Minecraft 官方：render distance 别名 "fog"（§1.1）；本项目 fog(90,230) vs far 1000（§4.4） | **立即可做**，一行改动，零风险 |

---

## 7. 对本项目的落地建议（按改动成本从小到大）

### ① 雾 / far plane 对齐（成本：一行）

- 改动：world.js `camera.far` 1000 → ~240（雾终点 230 + 余量）；可顺带把雾起点/终点收成 config 参数。
- 文件：`js/world.js`（+`js/config.js` 加参数）。
- 风险：≈0。far < 雾终点会裁出空洞，只要 far > fog.end 即安全。

### ② 距离环懒构建 + 按需卸载（成本：小，不动数据结构）

- 改动：`loadScene` 不再 `rebuildAll()`，改为把全部 chunk 入 `remeshQueue`；`pumpRemesh` 出队顺序按"距玩家 chunk 距离"排序（近处优先）；每帧检查已建 chunk 距离，超出 `RENDER_CHUNKS` 半径的 `disposeChunkArr`（GPU 释放、数据保留、走远重建）。玩家跨界时增量入队新环。
- 文件：`js/world.js`（队列排序与卸载）、`js/config.js`（RENDER_CHUNKS / LOD 参数表）、`js/main.js`（泵调用不变，每帧预算可调）。
- 收益：建场从"一次 64 chunk 全建"变成"进场先建脚下 3×3，其余分帧"；GPU 对象数随半径² 封顶——**这是把地图从 128×128 放大到 512×512 的前提**。
- 风险：低。注意 rebuildAll 的"收尾纪律"语义变化（GLOSSARY 的场景装填 seam 要同步改文档）；卸载后重进要保证重建（队列已有去重，够用）。

### ②b 网格构建 Worker 化（成本：小-中；与 ② 共用队列，建议 ② 落地后做）

- 改动：新增 `js/mesh-worker.js`（Worker 入口，`importScripts('config.js','voxel.js')` 复用体素模型——voxel.js"零 THREE · 零 DOM"特性为此而生，§5.4）；`buildChunkGeometries` 拆成"主线程收集 chunk+邻界数据"与"Worker 内顶点生成"两段，主线程只保留"收裸数组 → BufferGeometry → 挂 scene"。消息协议：发 `{cx, cz, cells, neighbors}`（Uint8Array，transferable），回 `{cx, cz, solid/glass/tnt 顶点裸数组}`（transferable）。Worker 构造包 try/catch，失败静默回落 `pumpRemesh` 分片——**两条路径共享同一 remeshQueue**。
- 文件：新增 `js/mesh-worker.js`；`js/world.js`（buildChunkGeometries 拆分）、`js/main.js`（Worker 生命周期）。
- 收益：建场/重建/爆炸重网格完全不占主帧——目标设备（触屏平板）帧率稳定性的根本改善；② 的距离环再激进也不会卡顿。这正是 Minecraft 1.18+ Chunk Builder 默认 Threaded 的形态（§1.1）。
- 风险：中。跨 chunk 剔面需要邻 chunk 数据随消息发送（边界多一圈）；TNT UV/图集与 per-block tint 逻辑要确认纯数据可迁移；编辑后 Worker 内旧数据靠现有 dirty 队列语义失效即可。**依赖 ② 先落地**（距离环是骨架，Worker 只是换消费者）。

### ③ 分层 LOD 网格（Distant Horizons 思路）（成本：中）

- 改动：在 ② 的距离环外再加一环"降采样环"：每 chunk 用 4×4 列采样（取每列 groundTop + 顶面颜色均值）构建只有顶面+侧裙的粗网格，材质复用 `blockMat`；近环 = 现有全细节，远环 = 粗网格，再外 = 雾。DH 的"先粗后细"（SURFACE_THEN_CHUNK）用于进场：先全图粗网格铺底，再逐 chunk 升级。
- 文件：`js/world.js`（新增 buildChunkLodGeometries + 环切换）、`js/config.js`（环半径表）。
- 风险：中。粗网格的色彩/tint 规则要拍板（建议：按列顶面色，不做 tint）；玻璃/TNT/薄块在远环一律按实心顶面处理；两环切换处会有视觉跳变，可接受（体素风本就允许阶梯误差，见 §3 结论）。

### ④ Greedy Meshing（成本：中，收益依内容物打折）

- 改动：`buildChunkGeometries` 的面循环改为 0fps 的三向 mask 扫描；同 id + 同朝向 + 同 tint（量化后）才合并；TNT 通道不参与。
- 文件：`js/world.js`（仅 buildChunkGeometries 及其调用约定）。
- 风险：中。per-block tint 会大幅降低合并率（0fps 作者明示光照不同不并，§5.1）——需要拍板"近环保留 tint 不合并 / 远环放弃 tint 换合并"；引线/压力板等 thin 块的例外路径要保持。
- 建议排在 ②③ 之后：对当前 128 地图收益有限，对放大后的近环（玩家贴脸看大片地面/墙体）才显著。

### ⑤ 数据层按需生成 + 无限世界（成本：大）

- 改动：`voxel.js` 的 `worldCells` 平面数组改为 per-chunk 存储（Map<chunkKey, Uint8Array(16×16×48)> 或 LRU 环），`getBlock` 未命中时按 `(seed, x, z)` 惰性生成列数据并缓存；模式建场脚本（modes/*.js 经 SceneKit）改为"只在出生环内铺玩法内容，其余交给生成器"；save-slot 序列化改按脏 chunk 增量存。
- 文件：`js/voxel.js`（核心）、`js/config.js`（NCX/NCZ 改动态）、`js/world.js`（越界语义）、`js/modes/*.js`（建场假设）、`js/save-slot.js`（存档）、`test/`（回归）。
- 风险：高。`getBlock` 是全游戏最热路径（voxel.js 头注释），任何加层都会伤物理/射线/怪物落地；越界返回 0 的语义、`groundTop` 高度缓存、跨 chunk 面剔除都要重新核对。**必须配 ②③（渲染分级）先行，否则数据层放开后渲染层先爆。** 生成与网格均可进 Worker 后台化（http 下合法，§5.4；voxel.js 零 DOM 可被 importScripts 复用）——这是无限世界不卡主帧的前提；file:// 降级时用队列分片（§5.5）。

---

## 8. 被否决 / 受限的方案

1. **`new Worker('worker.js')` —— 初版否决，2026-10-22 约束变更后解禁（http 主路径 + file:// 降级）**：
   - 初版否决依据（file:// 为硬约束时）：file:// 文档 origin 是 opaque/implementation-dependent（MDN，§5.4），Chrome 实践中阻止（二手佐证未直接抓取），正确性不能建立在浏览器特定行为上。
   - 约束变更后（项目所有者确认 http 服务为正式访问方式）：同源 http 下 Worker **规范保证合法**（§5.4），否决撤销，Worker 升级为 ②b 主路径；原分析保留为降级依据——降级实现即"try/catch 构造 Worker，失败走 pumpRemesh 分片"（该模式项目已验证，pad 真机开炮顿挫就是这么治的，world.js:294 注释）。
   - 附带澄清：**SharedArrayBuffer 维持否决**——需 secure context + cross-origin isolated（MDN，§5.4），局域网 IP 的 http 不满足且上 https 成本高；transferable 传递已够用。
2. **THREE.LOD 直接套在区块上 —— 不推荐（非否决）**：r128 有完整 LOD（§4.1），但它切换的是"一个 Object3D 的子档"，且每帧 update 要挂主循环；本项目已有 chunkMeshes 距离环管理（②），用 LOD 反而多一层对象树。留给"单模型多档"场景（远处的坦克/怪人剪影）备用。
3. **远山 billboard / impostor —— 当前否决**：世界 128×128，雾终点 230 已在视野边界之外，剪影无信息量也无省头；无限世界落地后再评估（且体素世界的 impostor **未找到一手文献**，§6）。
4. **heightmap 式顶点 morphing / 裙边抗裂 —— 不适用**：CDLOD/Chunked LOD 的这些机制服务于连续高度场；体素离散网格允许不同分辨率间的阶梯误差（DH 远处就是大块），不需要 morphing（§3 结论）。"按距离降档"的函数思想保留，手术部分丢弃。
5. **Mojang 官方 changelog 作为 1.14 ticket 系统一手来源 —— 未果**：官方 changelog 层面未找到机制性描述（minecraft.net 文章抓取超时）；以 minecraft.wiki Chunk 页 History（注明 1.14 加载方式变更）+ Drovolon 实测文档替代（§1.2）。

---

## 9. 未验证 / 查证失败清单

| 项 | 状态 | 说明 |
| --- | --- | --- |
| DH 官方 wiki（GitLab wikis 各页） | 抓取失败 | home 页返回空、FAQ 路径 404；改用官方 Modrinth/GitLab 项目页/官方 Javadoc 达成全部论点 |
| DH LOD 数据库为 SQLite 的文件级细节 | 二手 | MCME/Craft Down Under 社区文档（搜索摘要），未直接抓取 |
| Mojang 官方 1.14.4 changelog 原文 | 抓取超时 | minecraft.net 文章未取得，未引用其内容 |
| CDLOD / GeoMipmapping / Chunked LOD 论文 PDF 原文 | 未读原文 | webfetch 拒收 application/pdf；以作者仓库 README 摘要、作者页面、flipcode 归档页、vterrain 索引（均已抓取）替代；GeoMipmapping"屏幕空间误差切档"细节引 DTU 综述（二手） |
| Chrome 阻止 file:// 外部脚本 worker 的官方公告 | 二手 | StackOverflow 403、Chromium issues 需 JS；以 MDN 规范性描述（同源要求 + opaque file origin）为主据。**注：2026-10-22 约束变更后仅关乎 file:// 降级路径** |
| blob: worker 在 file:// 下的跨浏览器实测 | 未验证 | 未找到一手来源；Chromium issue 366055344（blob:null 资源被拒）为方向性二手证据。同上，仅降级路径相关 |
| 体素世界 billboard/impostor 一手文献 | 未找到 | §6 表中已标注 |
| minecraft.wiki 页面直抓 | 失败，已绕过 | 页面 HTML 拒抓，改走 `api.php?action=parse` 拿 wikitext 原文（Chunk / Simulation_distance / Options / Anvil / Region 均成功） |

---

## 附：来源索引（本次实际抓取过内容的一手/权威页面）

- minecraft.wiki（官方社区 wiki，经 api.php 抓 wikitext）：[Chunk](https://minecraft.wiki/w/Chunk) · [Simulation_distance](https://minecraft.wiki/w/Simulation_distance) · [Options](https://minecraft.wiki/w/Options) · [Anvil_file_format](https://minecraft.wiki/w/Anvil_file_format) · [Region_file_format](https://minecraft.wiki/w/Region_file_format)
- Distant Horizons 官方：[GitLab 仓库](https://gitlab.com/distant-horizons-team/distant-horizons) · [Modrinth 发布页（FAQ）](https://modrinth.com/project/uCdwusMi) · [API Javadoc：EDhApiDetailLevel](https://distant-horizons-team.gitlab.io/distant-horizons/com/seibel/distanthorizons/api/enums/EDhApiDetailLevel.html) · [worldGeneration 枚举](https://distant-horizons-team.gitlab.io/distant-horizons/com/seibel/distanthorizons/api/enums/worldGeneration/package-summary.html) · [Javadoc 索引](https://distant-horizons-team.gitlab.io/distant-horizons/index-all.html)
- 论文/作者一手：[fstrugar/CDLOD（README 含论文摘要）](https://github.com/fstrugar/CDLOD) · [Thatcher Ulrich Chunked LOD 页](http://tulrich.com/geekstuff/chunklod.html) · [flipcode GeoMipmapping 归档页](https://flipcode.com/archives/Fast_Terrain_Rendering_Using_Geometrical_MipMapping.shtml) · [vterrain 地形 LOD 论文索引](http://vterrain.org/LOD/Papers) · [0fps "Meshing in a Minecraft Game"（2012-06-30）](https://0fps.net/2012/06/30/meshing-in-a-minecraft-game/)
- MDN（规范性文档）：[Worker() 构造器](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) · [Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) · [Fetch 标准](https://fetch.spec.whatwg.org/) · [SharedArrayBuffer（安全要求：secure context + cross-origin isolated；2026-10-22 修订时抓取）](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- three.js r128（官方源码 + 本地发布库）：[r128/src/objects/LOD.js](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/objects/LOD.js) · [r128/src/core/Object3D.js](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/core/Object3D.js) · `lib/three.min.js`（本地，REVISION=128，符号检索验证）
- 社区经验（已抓取）：[Drovolon：1.14.x chunk loading 实测](https://gist.github.com/Drovolon/24bfaae00d57e7a8ca64b792e14fa7c6) · [Technical Minecraft Wiki：chunk loading](https://techmcdocs.github.io/pages/GameMechanics/ChunkLoading)
