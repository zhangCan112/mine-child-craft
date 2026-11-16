# ADR 0017: 门额牌 T4 光照修法——顶点光取面朝向邻格（pushPane 同口径）

日期：2026-11-15 · 状态：**已采纳**（票史三拍落地：e752ce9 红测 → 9c8b68f 返工 → be9f79a 收尾）

## 背景

v2 野心版把 home 图东带边界收口为镇门楼（[spec v2](../design/town-east-boundary-landscape-spec-v2.md) §3），门额中央悬镇徽牌（块 id 80 `B_GATE_SIGN`，`thin:0.15 solid:true`）。两条前置拍板构成本决策的约束场：

- **solid:true**（spec §2 S2）：「solid 取 true（实心薄板）以入在保判据常规体」——§8.1 x156 门额带 yb+4..+9 的保护判据按常规实心体吃；施工派令 N3 同口径（竖板 solid:true thin:0.15 需 mesh-core 朝向变体，床族路径是水平扁盒）。
- **渲染走 mesh-core 既有专用小盒路径族**（spec §9 Mesh 批次行）：火把 pushTorch/床 pushBedBox 双先例拼合，无新 draw call 通道；降级 fallback=石英+灯块门额灯室（spec §2 S2），裁定权在设计线。

F1 在制品首版（b94d635 转正承接）`pushGateSign` 顶点光取**自身格**标量（lvSky/lvBlk）。病灶：`solid:true` → LightCore opaque 判挡光 → 牌格自身 sky/block 双通道恒 0 → 六面全采样自身格=**牌面全黑**（voxBright(0)=0.05，白天口径下昼夜刺眼）——「门楼上亮着灯、门额是视觉焦点」的设计期待不成立。T4 返工票由此立（裁定引注见 test/texture-atlas.test.js T4 段红测注释「架构师 §1.4a 裁定」；ambition 线票图漏列该票、经移交由 town-boundary 线补落，复盘登记见「证据与关联」）。

## 决策

1. **顶点光=面朝向邻格采样（pushPane 同口径）**：`pushGateSign` 六面循环内每面取面朝向邻格 `(nx,ny,nz)` 的 `lsky/lblk`，每面四顶点共用 fSky/fBlk；签名按 pushPane 惯例注入 lx/lz/lget/lsky/lblk（lget 随采样器注入；越界兜底走 lsky/lblk 既有口径 sky15/block0）。实测口径：白天西邻格露天天光 13 → 西面 13/15 全亮；夜间壁灯语义西邻格 block=14 → 西面顶点跟随（壁灯光照上牌面，夜间灯火链成员语义成立）。
2. **块字段零动（solid:true 维持）**：光照口径在 mesh 采样侧解决，不碰块字段语义——门额牌保持「实心薄板入在保判据常规体」的 spec §2 S2/§8.1 拍板。
3. **fallback 边界=仅当动 meshChunk 主体/光场语义时触发且须转 design-lead**：修法若需动 meshChunk 主体（solid/atlas 通道装配主干）或光场语义（LightCore 传播/opaque 判据），即越出实现线裁量，转 design-lead 裁定降级案。**实际未触发**——修法圈死在 pushGateSign 函数签名+调用点，+10/−6 落地（9c8b68f，单文件 js/mesh-core.js；几何/UV/faceTile/底面剔除零动）。

## 挡回的替代方案

- **solid:false（自体格入光场）**：把牌格改为透光格使自身格携带光值，采样侧不动。挡回：① 违 spec §2 S2 拍板——solid:true 是入在保判据常规体的前提，solid:false 即退出常规体判据族；② solid:false 在薄板路径是门族开态语义旗标（「开态由 solid:false 派生」，见 pushPane 注释），门额牌挂它混入门/板族判据；③ 因果倒置——为渲染细节改块字段语义，光照传播面/保护判据面/判据族归属三处连带，修一处动三处。
- **假发光（牌面恒亮）**：写死亮值或强制 fSky/fBlk 满值让牌「看起来亮」。挡回：① 断光场一致性——牌面不再跟随昼夜与壁灯（红测第二断言「西面 block 跟随邻格 14」钉死的正是夜间壁灯照牌语义，恒亮即废）；② 夜间恒亮牌读作发光件，伪造「灯火边界线」灯语——灯语义只归 light 15 灯块族（spec §3 夜间观感/§9 光照行口径）；③ 逐件特例背离专用小盒路径族共享采样纪律，mesh 路径族分叉。

## 后果

- 正面：门额牌昼夜观感成立（白天全亮、夜间接壁灯入灯火链）；S2 直译素材零降级落地（对照装具 check-s2-tile.js 直译 diff=0）；修法 +10/−6 单文件，meshChunk 主体与光场语义零触碰，fallback 边界自证清晰。
- 代价：pushGateSign 签名较首版多注入参（lx/lz/lget/lsky/lblk——pushPane 同惯例，调用点一处同步传参）。
- 不可逆性：中高——采样口径由 test/texture-atlas.test.js T4 段两断言钉死；块字段口径（solid:true+thin:0.15）被 spec §2 S2/§8.1 与 blocks-fields 台账（79/80 行）多重锁定。后续改稿若要回到自身格采样或假发光，须先经需求线废本 ADR，不以「观感微调」为由绕行。

## 证据与关联

- 设计权威：[docs/design/town-east-boundary-landscape-spec-v2.md](../design/town-east-boundary-landscape-spec-v2.md) §2 S2（solid 拍板与降级案）/ §3 门楼块级表（门额牌 z74/75 yb+5）/ §8.1（x156 在保判据）/ §9（Mesh 批次=专用小盒路径族，fallback 边界依据）。
- 实现：js/mesh-core.js `pushGateSign`（头注「顶点光取面朝向邻格（pushPane 同口径，T4 返工…）」段即本决策留痕）· js/config.js id80 行（thin:0.15 solid:true gateSign:true，无 hard 零 drop）。
- 测试：test/texture-atlas.test.js「门额牌竖板顶点光取面朝向邻格」段（白天西邻 13/壁灯 block 14 两断言）与「门额牌竖板路径」段（贴西缘/分面 UV/垫块剔底面）。
- 票史：b94d635（F1 在制品转正，首版自身格光）→ e752ce9（T4 红测先行，红因 AssertionError x1）→ 9c8b68f（返工 +10/−6）→ be9f79a（收尾：红测注释排版修正+S2 对照装具入库）→ 62800e6（F1 并入）。
- 复盘登记：.scratch/handoffs/2026-11-15-f1-dispatch-retro.md（主仓库工作区留档，未随 git——T4 漏票根因=ambition 线判型未派 architect 交叉验证，本 ADR 兼为该教训的决策面留痕）。
- 素材证据链：.scratch/town-east-boundary/assets/gate-sign/（tile/preview/pixel-spec）+ .scratch/town-east-boundary/check-s2-tile.js（直译 diff=0）。
