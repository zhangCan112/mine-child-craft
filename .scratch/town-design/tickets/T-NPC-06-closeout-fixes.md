# T-NPC-06 收口修票（标准轴收口评审 F1~F4 合并修）

> 波次：**一收尾** ｜ blocking edges：无（01~05 已全清）｜ 性质：文档回写 + 代码小修 + 断言补强
> 来源：集成分支整体收口评审·标准轴（2026-11-14，HEAD 84b5064）；规格轴同轮通过无保留。

## 1. 修复项（四件）

### F1 [硬·文档回写] conventions.md §1.1 与 GLOSSARY「造型档案」词条未随白名单改源更新
- 现状：conventions.md L28 仍写 `js/mob-look/ 文件名=declare 键 ∈ MOB_TYPES∪{player}`；但 test/mob-look.test.js 白名单已改为「存量键集 ⊆ keys + 非 MOB_TYPES 键必 `town_` 前缀」（T-NPC-01 §6.5 / 03 §4.2 两轮授权改源），14 个 town_* 键明确不入 MOB_TYPES（js/town-npc-registry.js L36-118）。
- 修法：§1.1 mob-look 行补「∪ town_*（键集=镇民注册表 town-npc-registry）」口径 + 变更记录行登记本次回写；GLOSSARY「造型档案」词条同步（MOB_TYPES 表述改为「战斗注册表 ∪ town_ 镇民注册表双域」）。**这是回写现状，不是新约定**——守门测试已是权威事实。

### F2 [文档] GLOSSARY 新模块词条零收录
- 现状：`TownNpc`/`town-npc`/`TOWN_NPCS` 全 0 hit；TOWN_NPCS 被 5 文件引用（registry/adapter/mob-look.test/两 town 测试），满足 §1.8 判据 1（≥2 文件）。先例：GLOSSARY L253 town-map-core、L257 town-interact-core 词条形态。
- 修法：按先例形态补三词条（town-npc-registry 注册表 / town-npc-anchor-core 锚点表 / town-npc 适配器；词条按 interface 收词，含「找模块先查这里」的跳转价值）。

### F3 [代码·红绿可测] 删 mob-look-kit.js textureBuffer 的 `size: w` 兼容字段
- 现状：全仓读者已全部改 w/h（mob-look.test.js 三循环 T-NPC-02 改源即证），`size:w` 已零读者；且对 64×80 的 G01 该字段是**错误行距**（w 冒充整幅宽），未来读者信它是坑。
- 修法：textureBuffer 返回形状删 size 字段（红测：断言返回键集恰 {w,h,buf}——先写红）；grep 全仓确认无 `.size` 残留读者后再删；存量 49 方形造型 + 14 town 造型全量回归零漂移（npm test 既有断言全绿即证）。**注意**：若有测试断言了 size 字段存在，随红测一并修正期望（属本票授权）。

### F4 [测试补强] greet 表情帧双源补 join 对账断言
- 现状：look 文件 `greet:` 元数据（02，town_v01.js 等）与注册表 `expression.greet`（03，registry L39）各被独立真源断言钉死（town-npc-look.test:401 / registry GREET_FRAME），但无一条 join 断言——两源漂移不会被抓住。
- 修法：在 test/town-npc-registry.test.js（或 town-npc-look.test.js，按依赖方向选不引入环的一侧）补一条：十村民逐 id，look 声明的 greet 帧 === 注册表 expression.greet。倾向**对账断言**（最小改动）；若主人裁定改注册表派生（消费时读 look），须先改票面登记再动——二选一，票面记录裁决。

## 2. 文件域

- 改：docs/conventions.md、GLOSSARY.md（F1/F2 文档回写）
- 改：js/mob-look-kit.js、test/mob-look.test.js 或相关测试（F3）
- 改：test/town-npc-registry.test.js 或 test/town-npc-look.test.js（F4，择一）
- **禁触**：index.html / js/town.js / js/mode-registry.js；14 个 look 文件与 registry/anchor-core/town-npc.js 实现面（F4 若择 registry.test 侧则 registry 实现零动）。

## 3. 验收标准

1. F3 红→绿：红测先行（返回形状断言），转绿后全量回归零漂移；
2. F4 join 断言对 14 实体全量生效（10 村民有 greet 对账，G01/动物无 greet 字段跳过）；
3. F1/F2：文档内容与代码现状一致（可对照 test/mob-look.test.js 白名单断言逐句核对）；conventions.test.js 规范守门全绿；
4. 收尾：npm test 全绿 + npm run lint 零错；禁触零沾。

## 4. 备注

- 标准轴 F5（测试装具重复/装载序多处编码）**递延 T-NPC-10**：仓库先例（测试独立成文无共享 helper）压制，届时挂载后按 conventions.test.js:189-198 hand-view 先例扩链序断言并考虑共享 loader——已登记至 T-NPC-10 票面备忘。
- 规格轴备注级观察（face→yaw `up` 词表波次二对口）同递延 T-NPC-10。
