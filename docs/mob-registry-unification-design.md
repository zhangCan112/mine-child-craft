# 怪物注册表拆分与死键清偿设计定稿（mob-registry unification）

> 架构治理候选 8（config 拆怪物注册表 + 死键清偿）的拍板记录与交付清单。
> 评审入口：2026-10-24 架构评审（improve-codebase-architecture 流程，HTML 报告）卡 8；
> 相关词条：GLOSSARY「怪物库（Mobs）」「怪物谱系（Mob Taxonomy）」（数据归属句随 T1 改指
> js/mob-registry.js）、「竞技场核心（ArenaCore）」（依赖段 config/mob-registry 分列）、
> 「掉落物实体库」（rollDrops 归属句随本票终态核对修正）；
> 前序挂账：候选 4（模式切换收口，docs/mode-switch-unification-design.md）与候选 7（玩家状态
> seam，docs/player-state-seam-design.md）已就位，本文档体例照其后；
> 实现票 C8-T1（a4e1923）已合入，C8-T2 为本收尾票（拍板记录 + GLOSSARY 终态核对）。
> 日期：2026-10-25 · 状态：已交付。

## 背景与证据

**一、config.js 447 行混装：MOB 四表 + TANK 三表 ≈ 半文件是别家清单。**
255a57c 快照的 config.js 头注释自称「配置与方块注册表」，实际混装着两簇与「方块」无关的清单
（行号为该快照）：**MOB 四表段 144-298 共 155 行 ≈ 34.7%**（MOB_TYPES 数值表 42 键 = 37 战斗怪
+ F4 农场四怪 + mix 伪类型 · FAMILIES/PROTOS 谱系两维（12 族/9 原型）· MOB_DROPS 掉落表
9 键 = 一期战斗五怪 + F4 农场四条）与 **TANK 三表段 72-142 共 71 行 ≈ 15.9%**
（TANK 物理参数 + CAM_TANK 相机参数 + TANK_MODELS 型号注册表）——合计 226 行 ≈ 50.6%，
config 一半篇幅在替别人保管清单。§1.2 的 `-registry` 后缀语义（「某类清单的唯一权威……必有
对着消费端断言的单测」）与 mode-registry/audio-registry 先例早已给这类清单留了位置。

**防错网早已存在，唯独名不副实。** test/mob-taxonomy.test.js 对着四表做完整性（每怪 proto
合法/family 全注册/无兜底族）、语义钉（僵尸猪灵一身两族）、分组查询（11 桶 37 怪）、掉落表
结构与逐格断言——但清单本体住在 config，测试名叫 mob-taxonomy，文件名与内容不同名，登记在
§1.9 存量命名偏差清单（world-rings、nether-mode、tank-mode、mob-taxonomy 四条）。「注册表与
测试早该同名」：加怪的人被指路到 config，守四表的人守在 mob-taxonomy——两份指路各自漂移的
温床，正是评审卡 8 指认的治理对象。

**二、死键成因考古：c69177c TNT 下线，消费方同灭、定义滞留。**
c69177c 下线 TNT 密室时删 modes/tnt.js + tnt-levels.js（−1262 行），id 20~29 方块定义「保留为
创意资产」。其中三家找回新消费方：B_TNT 被探险 tnt 物品放置与点燃链消费、B_WATER 是探险湖、
B_LAVA 是下界岩浆湖；但 B_CRACK/B_SWITCH/B_PLATE/B_DOOR/B_SUPPORT/B_WEIGHT 六键的消费方就是
被删的模式本身，零复活；下界段 B_SOUL_SAND 则从未有过消费者（docs/mining-gap-analysis.md:89
先行记账「全项目无生成引用」）。附带 soft 死旗标——TNT 密室爆炸口径
`[5,6,8,9].forEach((id)=> BLOCKS[id].soft = true)`——运行时零读者。

**三、逐键证据：七死键 grep 恰 2 命中，全在 config。**
对全仓 js+html+test 逐键 grep（255a57c 快照行号）：B_CRACK(:329/:334) · B_SWITCH(:329/:335) ·
B_PLATE(:330/:338) · B_DOOR(:330/:339) · B_SUPPORT(:330/:340) · B_WEIGHT(:330/:341) ·
B_SOUL_SAND(:344/:348)——每键命中恰 2 处 = config 的 const 声明 + BLOCKS 定义成对，零其他
消费者；且全仓无一处绕过别名直读数字 id 22/23/26/27/28/29/32（零数字 id 直读已证）。

**四、B_FUSE 的两面性：运行时死、测试活。**
运行时全仓 js 零读（adventure-core.js:462 仅注释提及），但 test/voxel.test.js 与
test/mesh-core.test.js 拿它当 thin 块 fixture——删定义即红两文件的非关联断言。它是 c69177c
同批保留的创意资产，不是死键。

## 拍板决策

**① 方案 A：MOB 四表先行拆出，TANK 三表缓行。**

- **vocabulary 名实**：MOB 四表是一份 vocabulary（§1.3 判据 2：「一只怪是什么」——种类数值 +
  谱系两维 + 击杀掉落，42 键全部围绕同一概念），是 `-registry` 的标准形；TANK 三表是三样东西
  ——TANK 是物理参数表（碰撞/极速/转向，喂坦克驾驶核心）、CAM_TANK 是相机参数（喂
  camera-rig）、只有 TANK_MODELS 接近清单（型号注册表）。按「一文件一模块 ⇔ 一份 vocabulary」
  拆，MOB 四表自然成文件；TANK 三表硬凑进一个 tank-registry 会造出第二个混装文件。
- **TANK 是物理参数非清单**：TANK_MODELS.perf 缺键回落 TANK 基线由 TankCore 逐键解析——
  基线与回落是跨表契约，拆走即把这对契约撕到两个文件。
- **触碰面**：MOB 四表的消费方（mobs.js 加载期硬读 :1272 types 出口 · arena.js MIX_POOL ·
  arena-core.js familyMain 调用期折算 · drops.js rollDrops）全部是单向只读，无表间回落语义；
  TANK 三表内部回落契约缠在一起。合一票则论证面翻倍、回滚粒度粗。
  拍板：本票只动 MOB 四表；TANK 三表登记为未来独立 tank-registry 候选（含 CAM_TANK），
  届时按同款 `-registry` 契约拆分。

**② 测试随迁 git mv 改名收编（mob-taxonomy → mob-registry），否决双文件保守案。**
保守案是保留 mob-taxonomy.test.js 原名、另建 mob-registry.test.js——但两文件断言面重叠：都在
钉同一张 MOB_TYPES/FAMILIES/PROTOS/MOB_DROPS，未来加怪要改两处，漏一处即断言面漂移（正是
注册表治理要消灭的影子清单形态）。且 §1.2「`-registry` 必配同名单测」由 test/conventions.test.js
守门——mob-registry.js 落地而同名测试缺席即红，双文件案走不通，改名收编是唯一自洽路径。
§1.9 存量偏差清单随之消名（mob-taxonomy 行删，余 world-rings/nether-mode/tank-mode 三条），
变更记录补行——这是偏差清单首次「消名」先例（此前只进不出），证明清单是活文档。

**③ 死键连 const 声明与 BLOCKS 定义成对删；B_FUSE 创意资产保留；soft 死旗标同批删。**

- 逐键 grep 恰 2 命中（const + 定义成对）且零数字 id 直读 → 删除零消费方损失；若只删 const 不删
  定义，BLOCKS[22] 等成为无名尸体，后人补消费方时只能直读数字——反而复活应被消灭的直读形态。
- B_FUSE 保留并在 config 内加两行登记注释（「运行时死/测试活——若复活须先找回消费方」）：
  与七死键的区别是它有活测试读者（thin 块 fixture），删除的破坏面大于保留的滞留面。
- soft 死旗标 forEach 删除：运行时零读者，唯一断言读者 blocks-fields.test.js:205 的随迁口径
  一并删（该断言钉的是死旗标口径本身，旗标既删、断言无物可钉）。

**④ §1.11 勘误：加载序增一行 script 可逆，不需 ADR。**
交接文案曾说「加载序变更走 ADR §1.11」——勘误：§1.11 是「文档三段式 + ADR」的规则本身，不是
加载序规则所在；加载序规则在 §1.1 目录宪法（「index.html 唯一入口；经典 `<script defer>` 按
依赖顺序加载全部 js」）与 §2.1 共享词法环境（加载序即依赖序）。本票的加载序变更全部内容 =
index.html:228 在 config 之后紧邻插一行 `<script src="js/mob-registry.js" defer>`（既有 script
相对顺序不变，mobs.js 加载期硬读点与 arena.js MIX_POOL 均在其后）——可逆（删行即回滚），无
不可逆决策面，不写 ADR。本文件即 §1.11 三段式的 -design.md 段。

**⑤ 恒等验证方法：git show blob 对账，不靠肉眼。**
迁移 155 行的最大危险是「顺手改」——手滑改一个数值（如 F4 农场四怪的 hp），单测逐格断言未必
覆盖到每一格。方法：以 `git show 255a57c:js/config.js` 的 blob 为基线（先验证 HEAD 未再动过
config、工作树与该 blob 逐字节一致），node vm 双侧 eval（基线侧 eval 基线 config、现状侧 eval
新 mob-registry），四表分别 JSON.stringify 对账：**MOB_TYPES IDENTICAL（5843 JSON 字符，
42 键）· FAMILIES IDENTICAL（433）· PROTOS IDENTICAL（90）· MOB_DROPS IDENTICAL（422，
9 键）**；另做 F4 四怪与 mix 伪类型逐键在位抽查（防按旧快照丢行）。JSON 序列化抹平注释与排版
差异、只比语义内容——「逐字恒等迁移」由此是机器可证的口径，不是修辞。

## 交付清单

- **C8-T1**（a4e1923，实现票）：js/mob-registry.js 新建 178 行（§1.7 五要素头注释 + 尾部
  CommonJS 导出守卫，mode-registry/audio-registry 同款）；config.js **447 → 295 行**（四表段留
  四行指路注 :147-150；头注释与共享注册表名单段 :48-52 同步——「引擎真正的共享注册表」句划掉
  MOB 四表）；index.html:228 插入 mob-registry.js（config 之后紧邻）；七死键 const+定义成对删
  （config:178-183 死键段注释记账）+ soft 死旗标删 + B_FUSE「运行时死/测试活」登记注释两行；
  git mv test/mob-taxonomy.test.js → test/mob-registry.test.js（沿革头注释 + 新增恒等锚
  Mobs.types === MOB_TYPES）；blocks-fields.test.js 的 MOB_DROPS 段（3 test）整段随迁、装载器删
  MOB_DROPS/MOB_TYPES 导出并瘦身（256 → 202 行，收窄为只剩方块段）；测试装载器跟改 5 处
  （drops.test / arena-core.test / adventure-mode.test / adventure-core.test 四处补行——末者为
  票面清单遗漏的间接消费方，全链首跑红后定位：advDeathDrops 经 drops.js 运行时读 MOB_DROPS；
  blocks-fields.test 瘦身）；文本级跟改防陈旧指路（mobs.js:7/:1264 告警文案 · arena.js:22 ·
  drops.js:6/:19 依赖段拆 mob-registry 与 config 两句 · items-core.js:17 · tank-range.js:29 ·
  arena-core.js:41 依赖声明/:60 历史出处补现居 · adventure-mode.test.js:209 ·
  arena-core.test.js:68 测试名 · conventions.md §1.9 偏差清单删行 + 变更记录补行 · GLOSSARY
  「怪物库」「怪物谱系」「竞技场核心」三词条归属句）。测试 966 → **967**（恒等锚 +1，断言面
  不增不减）。
- **C8-T2**（本票）：本文档 + GLOSSARY 终态核对（全量 grep 残留旧归属，恰一处：**「掉落物实体
  库」词条 rollDrops 归属句「读 config 的 MOB_DROPS」→「读 mob-registry 的 MOB_DROPS」**——T1
  票面未列的漏网陈旧归属；「怪物库」「怪物谱系」「竞技场核心」三词条复核与 js/mob-registry.js
  实况一致，仍居 config 的归属句（TANK_MODELS/VIEW/BLOCKS 等）无混淆）+
  docs/mining-gap-analysis.md:89 灵魂沙记账行补「(2026-10 已随死键清偿删除)」。

## 行为面影响登记（诚实口径）

零可感知差异，逐条登记：

1. **四表逐字恒等**：blob JSON 对账四表全 IDENTICAL（拍板⑤），运行时值零变化；消费方经共享
   词法环境读全局名，四个全局名（MOB_TYPES/FAMILIES/PROTOS/MOB_DROPS）不变，消费点零改动。
2. **死键零消费**：七键删除前逐键 grep 全仓零消费者（命中恰 2 处全在 config 内部，const+定义
   成对）——删除的只是无人读的声明；soft 旗标同理（forEach 全仓零读者）。
3. **加载序只增不重排**：mob-registry.js 插在 config 之后、全部消费方之前，既有 script 的
   相对顺序不变。

## 测试与守门

- **基线**：npm test **967 pass / 0 fail**（966 → 967：恒等锚 +1；MOB_DROPS 3 test 自
  blocks-fields.test.js 平移非新增，断言面不增不减）；ESLint / Stylelint / htmlhint 三 lint
  零错。
- **恒等锚**：test/mob-registry.test.js 首测断言 Mobs.types === MOB_TYPES（mobs.js:1272 的
  暴露口）——壳经共享词法环境直读注册表，未来若冒出影子拷贝（壳自建一份表）当场红。
- **conventions 自动强制同名单测**：§1.2「`-registry` 必配对着消费端断言的单测」由
  test/conventions.test.js 守门——mob-registry.js 落地即自动要求 test/mob-registry.test.js
  在场，这是拍板②「双文件保守案走不通」的硬约束来源，也是后续新 `-registry` 文件的默认安全网。
- **间接消费方的首跑红教训**：adventure-core.test 的装载器补行票面未列——advDeathDrops 经
  drops.js 运行时读 MOB_DROPS，缺装载即 ReferenceError，全链跑通后定位补上。教训登记：装载器
  补行清单应按「运行时读哪些全局名」全量 grep 生成，不能只按票面消费方清单。

## 遗留与后续钩子

- **tank-registry 候选**（拍板①）：TANK 三表（TANK 物理参数/CAM_TANK 相机/TANK_MODELS 型号
  注册表，今居 config.js:75-145）本候选不动——未来独立 tank-registry 候选，届时按同款
  `-registry` 契约拆分；须一并处理 TANK_MODELS.perf 缺键回落 TANK 基线的跨表契约（「基线+
  回落」两表要么同文件、要么契约成文）。
- **B_FUSE 创意资产**（拍板③）：config 内已登记「运行时死/测试活」。若引线玩法复活，先找回
  运行时消费方再摘帽；若确认永不复活，可在 thin 块 fixture 改用同为 thin 块的草丛
  （B_GRASS_TUFT）后按死键清偿口径删除。
- **mining-gap-analysis.md 灵魂沙记账行**：:89 已随本票补「(2026-10 已随死键清偿删除)」——
  该表「下界系 6 个」组现况应读作 5 个存活（下界岩/黑曜石/下界砖/发光岩/传送门面），表的覆盖
  缺失定性与二期口径不受影响。
