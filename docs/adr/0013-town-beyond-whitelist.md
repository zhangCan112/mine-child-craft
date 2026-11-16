# ADR 0013: 镇域越界白名单——TOWN_MAP.beyond 显式域与「⊆ core ∪ beyond」判据

日期：2026-11-16 · 状态：**草案**（随 T0 判据票落，T4 收口终稿）

## 背景

「布局条目 ⊆ core（核心区）」是 docs/town-map-design.md 立图以来的布局不变量，由守门测试三组断言执法：⑤脚印/锚点 ⊆ 核心区、⑧地表条目 ⊆ 核心区、⑩散布点 ⊆ 核心区（test/town-map-core.test.js）。②镇侧对称门楼 + ③边缘防坠墙圈（设计定稿 [town-side-gate-and-edge-fence-spec.md](../design/town-side-gate-and-edge-fence-spec.md)）引入首批**正当越界件**：门楼+基座桥锚落 z128..131、越 core 南界（z2=127）1..4 格；墙圈南缘/西缘/东缘/裙板翼四段沿核心区四缘贴界布置（z128 行与 x31/x128 列、裙板 z29..31 带）。把关记录（.scratch/town-east-boundary/gate-review-town-side.md）把关注记为 **N5**：白名单域显式常量、不散写字面量，防第二份几何。若不动判据，这批件将被既有守门整体拒绝——判据面变更为布局纪律的放宽，须先立档再施工（几何消费方 T1a/T2 未上时 beyond 段先行落地空转，本票即此判据先行票）。

## 决策

1. **TOWN_MAP 顶层新常量段 `beyond`——显式越界域白名单，五段一次立全**（js/town-map-core.js，与 core/plaza 同级）：`gate-south`（75,128..81,131 门楼+基座桥域）/ `rim-south`（32,128..127,128 南缘墙线）/ `rim-west`（31,32..31,128 西缘墙线）/ `rim-east`（128,32..128,128 东缘墙线）/ `rim-skirt`（16,29..143,31 裙板翼墙+端头墩域）。闭区间整数坐标，town-map-core.js 单一权威，段 id 顺序与坐标 pin 由 test/town-map-core.test.js ②b 组钉死。
2. **守门判据语义扩为「⊆ core ∪ beyond」**：判据 helper `inCoreOrBeyond` **单份**落测试侧（②b 组），⑤脚印/⑤锚点/⑧地表（town-rim 逐 seg）三处消费；⑩散布维持 ⊆core 严判不扩（开放通道不设白名单）。生产码只加数据段，判据逻辑不进生产码。
3. **「beyond 不是通行证」三准入语义**：每段必须对应一件有正当语义的越界件——②门楼+基座桥=**缓冲带服务面**（回程缓冲带）/ 南门=**回程判据服务面** / ③墙圈=**防坠功能件**。段域=该件外接闭盒（含全部几何：门楼含檐口出挑 x75/x81、桥 z128..131）。
4. **加段判据**：新段须先过判据票（本 ADR 为准入依据），且通过 ②b 组两道自检——⊆ 世界界（160×160）、贴 core 界越界（与 core 交集非空的闭域离散读法，防「域飞出」）；不许「core 内改名」（越界域非空自检）。

## 挡回的替代方案

- **散写字面量**（守门测试里直接写越界域坐标）：判据面出现第二份几何，正是 N5 要防的形态——挡回；白名单落 TOWN_MAP 常量段，测试只消费单源。
- **zone 扩带 / 新开 gate-south zone**：动六带设计权威（docs/town-map-design.md §4.1，south 带 z94..127 是「南彩蛋带」权威域，回程判据注释「南彩蛋带整段在线北零误触」引用此域），扩带或加带都牵动权威面——挡回；town-gate 维持 `zone: 'south'` + 分区断言注记豁免（锚=南带界外服务面的自然延伸）。
- **与 far-north 豁免合并**：far-north（zone 语义豁免，山域件整带）与 beyond（显式域豁免）并存互不吞并，helper 两分支分开写——挡回「二合一」；两豁免的语义域不同（分区 vs 域清单），合并即失真。

## 后果

- 正面：布局纪律的放宽通道立档且由白名单收口，N5（防第二份几何）兑现；判据语义由 ②b 组测试钉死，后续加段有既定通道与门槛。
- 不可逆性：高——布局纪律放宽通道已立档不可逆，废白名单须先经需求线废本 ADR，不以「加个域」为由绕行；判据面坐标 pin（②b 组）意味着动 beyond 坐标必须连判据面一起过票。
- 待办（不阻塞本票）：消费方互证断言——gate-south ⊇ town-gate 脚印（T1a 落行后）、rim-* ⊇ town-rim 各 seg（T2 落条目后）随各自票补，构成「白名单 ⊇ 实际几何」的第二份防御。

## 证据与关联

- 架构方案：.scratch/town-east-boundary/arch-town-side-gate-and-edge-fence.md §2（白名单判据方案=N5 兑现）/ §4（票图 T0 判据先行）/ §5（ADR 建议）——工作区留档，未随 git（0012 同款引用形态）。
- 把关记录：.scratch/town-east-boundary/gate-review-town-side.md N5（白名单域显式常量，不散写字面量）。
- 设计定稿：[docs/design/town-side-gate-and-edge-fence-spec.md](../design/town-side-gate-and-edge-fence-spec.md) §2.6（town-gate zone 归属 south）/ §3.3（五段坐标终稿）。
- 测试：test/town-map-core.test.js ②b 组（beyond 自检：五段 pin/⊆ 世界界/贴界越界；判据面：inCoreOrBeyond 采样）。
