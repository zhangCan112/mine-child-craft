【scrum-master 转达 · 2026-11-15】
定稿已裁（主仓库 commit 82b22b6，本文件为其 worktree 投递副本）。工程线按下方 §三 取值表 + §五 改法对齐条目数据；仅动数据行，协议冻结面不动。对定稿有异议回报 scrum-master，不自行改裁定。
跨线沟通：relay open_line 自带 group=villager-wave2 可直达 scrum（线名 scrum-vw2）。

--- 以下为 design-lead 定稿原文 ---

# T-NPC-10 会师条件 3 定稿:NPC 条目 iconKey 定源裁定

> 裁定方:design-lead(scrum-master 转派,PO 确认走票面原口径)
> 产出日期:2026-11-15
> 范围:仅裁 TOWN_INTERACTS 11 条 NPC 条目(V01~V10 + G01)的 `iconKey` 单字段取值来源;条目协议形状冻结面不动,零协议增项。
> 消费位与设计权威:town-ui.js marker/L1/pointer、town-dialog-core.js bubble/thumb、town-ui.js:663 open payload 直通;docs/design/town-ui-entry-hud-spec.md(UI-01/05)、docs/design/town-ui-dialog-spec.md(§7.2/§4.2)、docs/town-villagers-design.md(角色表)。

---

## 一、裁定

**混合方案:iconKey 走 UI-01 语义图标键(候选 B 语义),Speaker 头像走 `faceSrc:'facePixels'`(候选 A 通道)——iconKey 字段不背头像职责。**

- **V01~V10 十村民:`iconKey: 'help'`**(💬 对话语义 affordance;键已在 `TOWN_CARD_ICONS` 在册,town-ui.js:50)。
- **G01 铁守护·阿稳:`iconKey: 'care'`**(💗 关怀语义;需在 `TOWN_CARD_ICONS` 补一行 `care: '💗'`——emoji 占位映射数据行新增,非协议增项,随 T-NPC-10 接线一并落)。
- **对话内 Speaker 头像位:不经 iconKey**。走注册表快照既有 `faceSrc:'facePixels'`(town-npc-registry.js:168 快照行已带)+ `npcId → registry key → MobLookKit.facePixels(key)`(mob-look-kit.js:480,16×16 居中裁切,波次一已 shipped+golden 测试)——此为 T-NPC-11 票面 §2 预排的供数线,本裁定仅确认两条线互不借道。

## 二、理由

### 2.1 硬检验走查:16×16 头像在 marker 尺度无辨识增益(候选 A 出局的主因)

marker 渲染实锚:css/town.css:280-292 `.town-hl-mark { font-size: 26px }`,HUD 权威 §6.2 口径 20-28px。facePixels 是 16×16 网格,落 26px 即**每格 ≈1.6px**。本岗以 Node 沙盒实提 6 村民 + G01 的 facePixels 渲染 16×16 网格走查(证据见 §四),结论:

1. **十村民共用同一套五官语法**:眉行 `######`、眼行 `OEyyEO`/`EEyyEE`、鼻中缝 `,`、嘴行 `####` 在全部村民间逐格一致(同肤 #C89A6A/#B98558、同眼绿 #2F5D50)。村民间唯一差异 = 顶部 1-2 行头饰条(V02 草帽 `,###`、V06 花环 `pOVpOVpO`、V07 厨帽 `OOOO`、V10 蝴蝶结 `yyy`)。
2. **26px 下的头饰条 ≈ 1.6px 高的细 fringe**:远景、移动中、6 岁观察条件下,识别「哪个村民」需分辨一条 8 格宽 ~13px 的色条——静态近观勉强,玩法远景不可靠。**走查判定:糊成一团,不满足硬检验。**
3. **身份信息在 marker 位是冗余的**:NPC 3D 本体就站在标记正下方——职业造型(草帽/厨帽/花环/铁灰巨躯)在真实尺度下就是最强的身份载体,另有 label + TTS 播报名双通道。marker 的唯一增量信息是 **affordance(「可点我/点了会怎样」)**,不是身份。

### 2.2 管线现实:候选 A 无法经既有管线落 marker(零成本主张不成立)

iconKey 的全部消费位(本次全量 grep 核对)清一色是「语义键 → `TOWN_CARD_ICONS[iconKey] || '⭐'` emoji 映射」的 glyph 位:

| 消费位 | 位置 | 语义 |
|---|---|---|
| 世界 marker | town-ui.js:523(buildHlMarks) | 条目常驻可交互标 |
| L2 指针徽章 | town-ui.js:452-453(refreshPointer) | 活动目标 glyph |
| L1 卡 | settleFocus(:603-607)→ 卡状态机 | 点了什么回流 |
| World Bubble | town-dialog-core.js:226-227 | idle hover 身份气泡 |
| seek 缩略 | town-dialog-core.js:234 | **仅 seek 态**,「找什么」动作语义 |
| open payload 直通 | town-ui.js:663(dlgCtx.iconKey) | 喂上两处 |

若 iconKey 填 facePixels 键(如 `'town_v01'`),映射脱靶 → **11 条 marker 全落 ⭐ 兜底**。候选 A 要上 marker 必须新写像素网格渲染管线(canvas/ImageData),「零新资产零新代码」的前提即告不成立。候选 B 则是**纯数据行**:10 行 `'help'`(键已在册)+ 1 行 `'care'` + 映射表补 1 行,零新代码。

### 2.3 候选 B 的「既有素材」真相:town_ui_* SVG 族盘上不存在,真实落点=emoji 占位策略

全仓递归盘点(含未跟踪文件与 git ls-files):**`town_ui_*` 系列 SVG 零文件**;`.scratch/town-design/assets/ui/` 目录不存在(briefs/ 目录为空,gen/ 已随波次一清场);全仓仅 4 张 world-edge-design 概念 SVG,与 UI 无关。docs 引用(dialog-prebuild「可用」、T-NPC-11 票面指针)是**文档残留指针,非盘上资产**。

这不伤裁定,反而厘清落点:HUD 权威既定口径是「emoji 占位先行,UI-01 像素图标资产入库前策略」(town-ui.js:40-41 注释 + town-ui-hud-prebuild.md:352),波次一九条既有条目正是经 emoji 管线在 PO 实屏走查闭环的(git log 80d9ed2 收口回执「PO 实屏二连闭环」)——**emoji-at-26px 管线已是 PO 验证过的生产现实**。未来 town_ui_* 像素资产真入库时,`TOWN_CARD_ICONS` 的键原位升级为图标引用,iconKey 值一字不改。

### 2.4 G01 区分裁定:按交互性质区分(💗 care),不按个体身份区分

- **需要区分**:G01 的 `sessionKind:'care'` 与村民的 greet/help/seek/tour 是不同性质的交互——「关怀」是关系姿态,不是对话内容变体;dialog-spec §5.3 铁傀儡关怀行明确给爱心/花意象语义,villagers-design §7.3 献花即关怀母题。一个 💗 让 6 岁孩子读出「这个大家伙也能点,而且是温柔的事」,防「高大铁傀儡是否可点」的误读。
- **不需要 face 级区分**:G01 铁灰脸(#BFC5CB 色系 + 暗红眼缝)在走查中确实与村民暖棕脸天然相异,但身份识别同样由 3D 本体(2.7 格铁灰巨躯,全镇最易认实体)承载,marker 无需再补身份。
- **🌸 弃用理由**:献花意象虽贴母题,但 V06 朵朵(花匠)语义撞车——「花」会读成花匠/花园,💗 无此歧义。

### 2.5 村民不按 sessionKind 细分 marker(greet/help/seek/tour 各配图标)的理由

HUD 权威 §6.1 把 NPC 归为**单一 affordance 类**(「可回应/可对话」一种处置);§2.5 低认知负荷原则(一次一个主提示)。sessionKind 是会话内容语义,其表达位在会话内(面板选项/TTS/L1 卡),不在发现位。十村民统一 💬 = 最强 affordance 信号、最小视觉词表;marker 状态语言(§6.2 默认/悬停/按下/完成五态)已有色+形双通道,不再叠 4 种语义变体。seek 态缩略的「找什么」语义已有既有先例(task:find-bread 用 `find`/🔍 动作语义),NPC 发起的 seek(V06)thumb 显示 💬 与「跟她说上话才知道找什么」的会话语境自洽;若对话线日后要物件级缩略,经 taskRef 从任务条目取数即可(town-dialog-core.js:234 的 `ctx.targetIconId` 已是独立通道),**不动 iconKey 字段**。

## 三、11 条逐条 iconKey 取值表

| 条目 id | 角色(label/注册表 name) | sessionKind | iconKey 定稿 | glyph(现管线) | 区分依据 |
|---|---|---|---|---|---|
| npc:v01 | 阿面 | greet | `'help'` | 💬 | 村民统一 affordance |
| npc:v02 | 麦芽 | help | `'help'` | 💬 | 同上 |
| npc:v03 | 石匠阿砌 | help | `'help'` | 💬 | 同上 |
| npc:v04 | 图图 | tour | `'help'` | 💬 | 同上 |
| npc:v05 | 铁匠炉火 | help | `'help'` | 💬 | 同上 |
| npc:v06 | 朵朵 | seek | `'help'` | 💬 | 同上(seek 缩略语义见 §2.5) |
| npc:v07 | 小厨乐乐 | greet | `'help'` | 💬 | 同上 |
| npc:v08 | 钟叔 | greet | `'help'` | 💬 | 同上 |
| npc:v09 | 牧童豆豆 | help | `'help'` | 💬 | 同上 |
| npc:v10 | 跑跑妮妮 | greet | `'help'` | 💬 | 同上 |
| npc:g01 | 铁守护·阿稳 | care | `'care'` | 💗 | 交互性质区分(§2.4);emoji 映射需补 `care: '💗'` 一行 |

数据落地:条目行按冻结形状追加 `iconKey` 字面值(不搞条件派生,11 行照表写死);注册表↔条目↔锚点三表对账(T-NPC-10 验收 3)不含 iconKey,零漂移风险。

## 四、走查/证据

### 4.1 facePixels 16×16 实提渲染(Node 沙盒,2026-11-15)

装载序:`js/mob-look-kit.js` → `js/mob-look/town_*.js ×14` → `MobLookKit.facePixels(key)`;分桶图例 `.`=肤A `,`=肤B/帽棕 `#`=深棕描边 `E`=眼绿 `O`=眼高光 `w`=米白 `y`=麦黄 `p`=樱粉 `I/i`=铁灰 `V`=藤绿 `·`=居中留白(16×16 网对 8×8 脸区居中)。完整网格如下(节选 4 村民 + G01;V02/V08/V10 同构不赘):

**V01 阿面(无帽,基准形)**
```
················
················
················
····wwwwwwww····
····wwwwwwww····
····y######y····
····yOEyyEOy····
····yEEyyEEy····
····yyy,yyyy····
····yyy,yyyy····
····yyy,yyyy····
····y#y,yy#y····
····yy####yy····
················
················
················
```
**V06 朵朵(花环)** — 与 V01 仅顶部 2 行不同,五官逐格一致:
```
····pOVpOVpO····
····VOpOpOpV····
(第 5 行起与 V01 完全一致)
```
**V07 小厨乐乐(厨帽)** — 顶部 2 行 `OOOOOOOO`,其余与 V01 一致。**V02 麦芽(草帽)** — 顶部 2 行 `,,,,,,,,`+`########`,其余一致。**V10 妮妮(蝴蝶结)** — 顶部 2 行 `yyy..yyy`+`yyyyyyyy`,其余一致。

**G01 阿稳(铁傀儡)** — 铁灰色系,与村民暖棕脸天然相异;注:暗红眼缝 #C94A3A(lum≈110)落深桶显示为 `#`,实贴图为克制暗红,非渲染失真:
```
····wwwwwwww····
····IIIIIIII····
····IIIIIIII····
····IIIIIIII····
····IIIIIIII····
····IIIiIIIII···(近似;眼缝行 ###II### 为暗红眼缝桶积)
····iIIiIIIi····
```

**走查结论**:村民互辨 = 分辨顶部 1-2 行 × 8 格的色条;26px 下 ≈13px×2.6px 的 fringe,远景玩法条件(移动、低龄观察)不可靠;marker 位身份冗余(3D 本体+label+TTS 三通道在场)。判候选 A 在 marker 位不满足硬检验;其在对话面板 Speaker 位(~32-40px,每格 2-2.5px + 名字文本 + TTS 同源)可读,恰好归位 T-NPC-11 预排的 faceSrc 通道——**两候选各归其位,即混合方案**。

### 4.2 代码/权威引证清单

| # | 事实 | 出处 |
|---|---|---|
| 1 | marker 渲染 26px emoji textContent,未知键 ⭐ 兜底 | css/town.css:280-292;js/town-ui.js:523 |
| 2 | iconKey 六消费位全为语义键→emoji 映射,零像素渲染位 | town-ui.js:453/523/603-607/663;town-dialog-core.js:227/234 |
| 3 | `TOWN_CARD_ICONS` 现有 8 键,`help`:'💬' 已在册,`care` 缺 | town-ui.js:42-51 |
| 4 | 注册表快照行已带 `faceSrc:'facePixels'`(对话头像供数线) | js/town-npc-registry.js:168 |
| 5 | facePixels 16×16 居中裁切已 shipped | js/mob-look-kit.js:480-496 |
| 6 | seek 缩略仅 seek 态出现、语义=「找什么」动作 | js/town-dialog-core.js:234;dialog-spec B6 |
| 7 | NPC=单一 affordance 类,marker 20-28px | town-ui-entry-hud-spec.md §6.1/§6.2 |
| 8 | Speaker Strip=头像/职业符号+名字(对话位,非标记位) | town-ui-dialog-spec.md §4.2;T-NPC-11 §2 |
| 9 | 铁傀儡关怀=爱心/花语义,威胁归零 | town-ui-dialog-spec.md §5.3;town-villagers-design.md §7.3 |
| 10 | `town_ui_*` SVG 全仓零文件(文档指针≠盘上资产);emoji 占位先行是既定策略 | 全仓递归盘点 2026-11-15;town-ui-hud-prebuild.md:352 |
| 11 | 既有 9 条 emoji 管线经 PO 实屏走查闭环 | git log 80d9ed2(城镇翻新收口) |
| 12 | iconKey 无注册校验、不在三表对账断言面 | js/town-interact-core.js:67-106;T-NPC-10 §4 |

## 五、与候选 A 占位的改法(给 engineer-manager)

若条目数据已按候选 A 占位(iconKey 填 look 键如 `'town_v01'`/`'npc:v01'` 类),定稿不一致,改法**仅动数据行**:

1. **11 条条目行**:iconKey 值按 §三 取值表改写(`'help'` ×10、`'care'` ×1)。协议形状(id/anchorId/kind/label/sessionKind 五键)不动,不增字段。
2. **`TOWN_CARD_ICONS`(js/town-ui.js:42-51)补一行**:`care: '💗',`——emoji 占位映射数据行,非协议;`help` 键已在册勿动。
3. **不要为 marker 引入任何 facePixels 渲染代码**;对话 Speaker 头像位按 T-NPC-11 §2 原预排走 `faceSrc:'facePixels'` 供数线,与本裁定无耦合。
4. 若占位值恰好已是 `'help'`,则仅剩 G01 一行 + 映射一行。

## 六、边界与后续指针

- **本裁定不改**:条目协议冻结面、town-interact-core 校验逻辑、dialog-core 视图函数、任何测试断言面。
- **归 T-NPC-11 对话线(指针,非本票范围)**:Speaker Strip 头像渲染(faceSrc→facePixels→16×16 上板,建议 32-40px);seek 物件级缩略若要做,走 taskRef 通道取任务条目 iconKey,不经 NPC 条目 iconKey。
- **归资产票线(远景,不阻塞)**:town_ui_* 像素图标族真入库时,`TOWN_CARD_ICONS` 键值原位升级,iconKey 取值不变;届时可为 `help`/`care` 出 UI-01 风格像素变体(对话气泡/对勾语义参照 dialog-prebuild §4.1)。
- **G01 crack 状态与 iconKey 无涉**:裂纹档位是角色状态视觉(villagers §7.2),不进 marker 语义。

