# ADR 0021 · 光挡光谓词 thin 例外: 光挡光与视线遮挡刻意分叉

日期:2026-11-23 · 状态:已采纳(篝火 T-C13-R7 黑区修复票, H2 裁量全文 `.scratch/campfire/tc13r-arch/r7-disposition.md` §1/§5; 归因链 `.scratch/campfire/tc13r-review/black-region-attribution.md` §2)

## Context

熄态篝火脚下黑框病灶: 篝火两态(81 燃/82 熄)与门额牌 80 是全表仅有的 solid∧thin 组合(config.js:527/:544-545, thin 0.4375/0.15 且 solid:true; 其余 thin 族一律 solid:false, config.js:310 纪律注记)。光引擎挡光判定旧为 `opaque = solid ∧ ¬glass`(light-core.js mkPolicy), 把这三格判成挡光格 → 熄态篝火格双通道恒 0: skyCompute 列直灌遇 opaque 即 break 不写(light-core.js skyCompute), bfsIncrease 邻格 opaque 即 skip。mesh-core 面光采样取「面朝向邻格」, 沙壁朝篝火格的整格侧面采样到 0/0 → 渲染纯黑(黑框形状=燃态光晕同一形状); 燃态同缺口被自身 light 15 掩盖, 燃→熄切换瞬间同批面从亮翻黑(「光晕翻黑框」闪变)。

三层背景: ①头注教义自述「玻璃/水/薄块/十字片全透光不衰减」(light-core.js:11-12), 现行代码在 solid∧thin 组合上违背自述——本决策是代码向教义归位; ②ADR 0012 T4 先例已判「挡光格自身格恒 0」是黑面病根(门额牌从自身格采样返工到面邻格采样), 本决策在谓词面归位而非再开采样豁免, 与 T4 同向不冲突; ③黑区归因链逐环定位见 black-region-attribution.md §2。

## Considered Options

- **H2: 单谓词双通道加 ¬thin(采纳)**: mkPolicy 一处改为 `opaque = solid ∧ ¬glass ∧ ¬thin`, sky/block 两通道共用同一 policy 对象自动同改(world.js 唯一装配点 LIGHT_POLICY, computeAll 与 updateEdit 同一实例)。装配点唯一 = 「增量===全量」不变量零重验(light-core.test.js 随机 50 步对账共用谓词); 熄态格全时跟随环境光(sky 直灌 15 + block 随 BFS 传导), 白天黑夜均无暗差接缝。
- **H 草案: 仅 sky 通道豁免(design-lead 原案, 否决升格为 H2)**: 熄态格 block 仍恒 0, 夜间近火把时邻格 block≥1 而熄态格 0 → 采熄态格的面(邻墙/火下地面)在夜间以暗差形式残留黑框(判据的夜间变体); 且单通道豁免意味着谓词拆双轨, 每调用点分轨加不变量面双倍重验——光引擎最重测试区无谓 churn。design-lead 对 block 通道的语义期待未在开工前回示, 按 H2 施工(偏离声明见 disposition §1.2)。
- **C: 面光采样对 thin 邻格改取自身格(否决)**: 修不动病灶——自身格(沙墙/横梁/地面)同为 solid 挡光格恒 0, 把采样从一个 0 格挪到另一个 0 格, 黑框原样; 且波及所有 thin 邻格面, 植物/火把族(solid:false∧thin)的格子非挡光有真实光值(火把格 block 14), 改取自身格后贴面全黑 = ADR 0012 T4 病根(挡光格恒 0)反向铺开全表。

## Consequences

- **受影响块全集 = {80, 81, 82}**: 谓词只认 solid∧thin 组合, 数据驱动——新增此类块自动继承, 无需改谓词。全表登记锁由 test/light-core.test.js「全表 solid∧thin 恰此三 id」断言守门, 越界扩张必红。
- **视线/拾取不分叉**: voxel.js isOpaque 维持 `solid ∧ ¬glass` 原判——solid∧thin 物理实心(docs/campfire-spec.md §3.4 半格实体可碰撞可站立), 挡视线/拾取照旧(相机防穿墙 camera-rig.js、怪物 LOS adventure.js/adventure-core.js)。光域分叉不外溢到物理域。
- **文档级分叉镜像三处同步**(断言零改): light-core.js 头注(挡光规则句 + mkPolicy 分叉声明)、voxel.js isOpaque 注记(分叉另一侧声明)、world-integrity.test.js 扫光判据注记(红方票内刷新)。
- **光场连带效应**(对账面 disposition §1.4 全表): 修复面=熄态邻墙面/火下地面/门额牌横梁朝下面点亮; 光场变化面=熄格 sky 0→15、block 0→环境 BFS 值, 燃态格 sky 0→15(部件面采样邻格口径不变, 观感无差), block BFS 可经篝火格传导(方向性变亮, 正确向); 玩法面=adventure.js advNightRead 夜刷怪落点 eligibility 微收紧(篝火旁更不刷怪, MC 同惯, 票内申报 PO 走查项); 存档/重放零波及(光场纯派生不落盘, voxel.js 装场归零重算)。
- **不可逆性论证**: 技术面可逆(光场纯派生可全量重算); 但「熄态格透光」进入 PO 走查记忆与后续设计引用后, 回退=熄态黑框观感回归 + 头注教义再分叉, 属不可逆档故入册。
- **次要(不升 ADR)**: campfire-fx-core.js 浇熄格回收门扩展(quench 置 quenchAt 时间戳, 回收门与 cellsList 过滤改认 closedAt=burnoutAt 缺省 quenchAt)是生命周期语义补全——浇熄格旧径永不回收(≈37 mesh/位址滞留)的真 bug 修复, 无跨模块契约变更, 票内注记即可。
- **交叉指针**: js/light-core.js 头注(谓词面声明)、js/voxel.js isOpaque 注记(视线面声明)、.scratch/campfire/tc13r-review/black-region-attribution.md(归因报告全文)、.scratch/campfire/tc13r-arch/r7-disposition.md(裁量回执, 连带效应 §1.4)、docs/adr/0012-gate-sign-t4-light-neighbor-sampling.md(T4 先例)。
