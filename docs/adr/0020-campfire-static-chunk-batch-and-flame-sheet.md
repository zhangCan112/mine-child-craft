# ADR 0020 · 篝火渲染架构: 静态部件驻 chunk 批 + 焰片共享 sheet

日期:2026-11-22 · 状态:已采纳(篝火 T-C13-R2 架构落锚票, 方案 `.scratch/campfire/tc13r-arch/tc13r-arch.md` §7 拍板随票入册; 设计权威 docs/design/campfire-visual-spec.md v1.10 §4)

## Context

v1.10 媒介转向(spec §4.1): PO 复验否决贴图拼接(「画出来的火焰永远是假的」), B 区世界外观改真几何建模: 4 根织席原木+中央炭堆(主盒+错位小盒)+交叉动画面片火焰, 部件口径 7/座(静态件 6+焰片组 1, spec §4.4 计数口径)。几何落位后必须裁定渲染产权: 静态部件放哪、焰片放哪、拾取走哪、生命周期跟谁——这四问互相咬合且不可逆(动了就是渲染管线换血), 落 ADR 存档。

约束: 50 火 dc 增量 ≤100、每座 ≤2 mesh(spec §4.1 红线数值); 拾取现有唯一路径是体素 DDA(`raycastVoxel`, Amanatides-Woo 逐格, 全仓无 THREE.Raycaster 应用调用); 两态切换走既有「id 互换一笔编辑」链(edits 重放+区块重建); 焰片要逐火 UV 翻页+错相(cellSeed 派生), 与 chunk 静态批天然不同拍。

## Considered Options

- **静态部件: 驻 chunk 图集通道(采纳)**: `pushCampfireBox` 升 `pushCampfireParts` 多部件发射, 部件布局表 CF_PARTS 全确定性, 随区块网格生灭——专属 mesh **0/座**, 免费拿 chunk 级视锥剔除/生命周期/顶点光; 两态切换与今日贴图路径同一次区块重建、同成本同拍。
- **静态部件: 每座独立 Group(否决)**: 50 火 dc 增量 +100 恰顶格零余量; 新增 50×2 mesh 产权与生命周期挂钩(clearWorld/跨图需自证零孤儿), 「熄灭态重建成燃态」类 bug 面扩大。spec §4.1「每座一个 Group」句是实现自由度提示非硬性指令, 本裁定在其范围内选更优解(预算三项全优, 观感判据零偏离)。
- **焰片: InstancedMesh(否决)**: 仓库有先例(mobs 关节槽), 但 r128 InstancedMesh 只带 instanceMatrix/instanceColor, 逐火 UV 翻帧需自定义 instanced 属性+改 shader, 引新管线语言。
- **焰片: 全场景共享单 mesh sheet(采纳)**: 每 campfireField 场一份, membership 只吃 fx open 格, `MeshBasic{map: atlasMat.map, alphaTest:0.5, DoubleSide, vertexColors}`(65/67 alpha 真透管线先例); 单 mesh 恒绘 `frustumCulled=false`(三角量 200 可忽略), dc 增量 ≈+1。归 R-4 执行。

## Consequences

- **拾取政策**: 方块交互恒走体素 DDA, 渲染部件/焰片零参与拾取(无 non-pickable 配置面, 它们不在格数据里, DDA 结构性看不见)。配套不变量「全部件 ⊆ 自有格 [0,1)³」由几何断言守门(texture-atlas.test.js 篝火几何不变量段)——防未来有人把部件/焰片伸出格顶后邻格拾取被遮; 面片拾取穿透是结构性质不是补丁。
- **z-fight 静态免疫**: 几何不变量「任意两部件无共面重叠面」由测试守门(面片对面非共面判定)——半搭互穿(织席上层悬于下层)与错位沉入(小盒沉入主盒)的观感语言在「互穿不共面」内展开, 围框案(spec §4.1 否决存档)的角部共面风险被结构性排除。
- **焰片生命周期归属**: 跟台账重放走(fx 句柄 open/clear 既有缝, settle 重放点燃即重挂), **不跟 chunk 网格重建走**。结构性禁令两条: ①禁止扫任意 campfire id(81∪82)建焰片——会把熄态点着; ②禁止挂区块重建事件建焰片——把渲染恢复跟错权威源。「熄灭态重建成燃态」整类 bug 被禁令排除; open=false 格永不贡献 plane 由测试守门(R-4 落)。
- **图集接线与存档纪律延续**: 68~76 v1.10 九格接线(layout.tiles[81]/[82] 部件表形状)与 62~67 存档格零删并存; 存档六测(texture-atlas.test.js 62/63 逐字符+64~67 逐像素)全程保持绿, 是「存档不删」政策的在职证明。
- **静态件零独立产权**: chunk 网格托管, 无新增生命周期所有者; 未来若改「每座 Group」须回本 ADR 重裁(牵动 dc 预算与产权面, 不是实现细节微调)。
