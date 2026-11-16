# 篝火 UI/观感设计需求单（design brief · feature: campfire）

- 签发：analyst-manager（relay 线名 `analyst-mgr-campfire`，group `campfire`）· 日期：2026-11-16
- 接单：campfire 设计线 design-lead（scrum-master 裁决 ①+② 组合，本单为设计线唯一输入包）
- 流程位置：需求线（grill 已收口 19 项拍板）→ **设计线（本单，并行）** → spec 中间确认 → 拆票（UI 五区=设计阻塞票）→ 用户验收 → 施工线
- 接单动作：回填本文件头部「已接单 + 你的线名」；对齐与进度走 relay 群 `group: "campfire"`（`@ analyst-mgr-campfire`）。

---

## 0. 任务一句话

「篝火」道具的 UI/观感需求评审与具体设计，产出统一设计定稿落盘 `docs/design/campfire-visual-spec.md`。本单只出设计纸面，**不写任何产品代码**（js 实现归后续施工线）。

## 1. 项目与必读

- 项目：my-craft-demo——给 6 岁孩子的 MC 风格体素注意力训练游戏。原生 JS + Three.js r128，多文件经典 `<script>` 共享词法环境，无构建步骤。目标用户 6 岁：图标+中文 TTS、零文字依赖。
- worktree（产物落盘这里）：`C:\Users\user\.local\share\opencode\worktree\1631a8\campfire`
- 必读（按序）：
  1. `AGENTS.md`（硬规则与图谱 MCP 用法）、`docs/conventions.md`（工程规范）
  2. `GLOSSARY.md`——词条：贴图图集 / Fx / 声音清单注册表（AudioRegistry）/ 物品提示（ItemHint）/ 模式面板 kit（ModeKit）/ 放置链 kit（PlaceKit）
  3. `docs/design/glider-ui-spec.md`——滑翔翼 UI 定稿，**体例与风格基准**
  4. `docs/botw-campfire-research.md` §3.4–3.5 与 §5——烟/火焰/气流表现的 BotW 视觉语言取证（灰白烟柱=远距信号、白色旋涡=气流可读性）
  5. `.scratch/campfire/interview.md`——grill 拍板权威（含术语候选段）
  6. `docs/adr/0017`（乘流例外）/ `0018`（生命周期）/ `0019`（烫伤）——机制背景

## 2. 功能意图（需求已 grill 收口，PO 全部拍板）

探险模式（+体验馆同口径）可合成消耗品道具「篝火」：放置即燃、照明（方块光 light 15）、冒烟、产生 3×3 截面×约 20 格高向上热气流；滑翔翼玩家柱内乘流起飞（柱内跳跃=立即展翼，ADR 0017）。燃尽约 5 分钟=干净消失无掉落（ADR 0018）；水浇=熄灭态方块（点击重燃+重置时长）；任意态挖掘=回收道具；踩燃烧中篝火烫伤（每满 1 秒 1 血，ADR 0019）。配方：木棍×3+原木×3+煤/木炭×1 → 产出×2（工作台）。

## 3. PO 已拍板的设计相关约束（不得违背）

1. ItemHint 基础说明**不剧透乘流玩法**（PO 知悉「可能没人发现」风险并自担）——文案只说照明等基础用途，气流玩法靠自然发现。
2. 无事件 TTS（点燃/燃尽不播报）；点燃+燃尽各 1 声音效；**无循环燃烧声**（项目无环境循环音基建）。
3. 纯玩具零任务零剧透——观感不得暗示任务用途。
4. 气柱 20 格高、3×3 截面、燃尽约 5 分钟——观感规格按此量级。
5. 儿童可读性：远处能靠烟柱发现篝火（BotW 视觉语言：灰白烟柱=远距信号）；气流柱要能读出「这里有风可乘」（BotW：白色旋涡粒子）；熄灭态与燃烧态一眼可辨（熄灭态可重燃）。

## 4. 下游票结构决议（scrum-master 已裁决，与你的定稿联动）

- UI 五区（下节 A–E）将落成**独立施工票，每票以你的设计定稿为 blocking edge**（blocked-by `docs/design/campfire-visual-spec.md`）；定稿落盘即解除阻塞。
- 因此定稿精度标准=**施工票可照抄执行**：像素给可绘制的案样或逐像素规格、粒子给参数、文案给全文、音效给参数表。

## 5. 设计分区（互不重叠，逐区交付+验收标准）

**A. 道具像素图标 + 配方卡观感**
篝火道具 icon（物品栏/hotbar 16px 级可辨）+ craft 合成面板配方卡观感（材料 chip：木棍×3+原木×3+煤或木炭×1 → 产出×2）；对齐像素图标工坊/ITEM_PIX 既有惯例。

**B. 方块两态贴图**
燃烧态/熄灭态 16×16 手绘像素（texture-atlas 新格位，MC 观感语言，不撞现有格位 56/71/72/73/74 等已占用号）；两态差异一眼可辨。

**C. 世界内特效观感**
火焰+烟柱（灰白、远距可辨）、气流柱可视化（白色旋涡上升粒子、20 格柱）、点燃/燃尽过渡瞬间；挂靠 effects.js/Fx 既有语言，给可施工的参数级规格（颜色/速率/粒子量级/高度曲线），不写实现。

**D. 文案话术**
ItemHint 全文（不剧透红线内）、放置失败话术（TTS 口径+儿童语言，参考 interview.md A3 的「篝火要放在结实的东西上面哦」方向；触发时机由 business-analyst 的 spec 定，你只定文案与语气）；无事件 TTS——不留 TTS 项。

**E. 音效参数**
点燃 1 声 + 燃尽 1 声的 audio-registry 条目规格（kind 命名 / file 或 synth 回退 / g 双端增益 / prio / coolMs；「永不哑」互锁纪律——样本缺失自动落 synth）。

## 6. 交付物与验收

- 统一设计定稿落盘：`docs/design/campfire-visual-spec.md`（体例先例 `design/glider-ui-spec.md`；如需分区子文档/token 文档自裁，但 spec 引用的主路径必须唯一）。
- 每区附验收标准（可检查判据，如「两态 3 格外可辨」「烟柱 40 格外可见」「图标 16px 可辨」——判据自定，落到可走查）。
- 回执口径：群内（group `campfire`）`@ analyst-mgr-campfire` 定稿落盘路径 + 分区覆盖结论（A–E 全覆盖与否）+ 验收标准清单 + 遗留风险/待 PO 项。

## 7. 边界与纪律

- 只定观感规格，不 reverse-engineer 机制数值、不写 js；机制数值归 business-analyst 的 spec（并行撰写中，落 `docs/campfire-spec.md`）。
- 观感与既有风格一致：glider-ui-spec / texture-atlas / AudioRegistry 既有纪律为准；零外部素材，像素全部自绘。
- ui-designer / asset-artist 内部分派由你自裁；美学多方案抉择可直接 relay `ask_user` 批量问 PO（一次一批；`open_line` 子会话可能无权——群内沟通经 scrum-master 或本岗转达亦可）。
