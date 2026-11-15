# 收口回执·城镇视觉全面优化(lead 终审)

> 派令:PO 全权授权(设计+实现权整体移交 ui-designer 岗,唯一硬约束品质) · 2026-11-15 收口
> 协同:lead(town-design-lead) + 三协作设计师(arch/scene/light,subagent 会话+落盘回执双通道)
> 走查底座:headless Chrome+CDP 管道(`.scratch/town-design/walk.mjs`,13+1 机位,不入库)
> **终审结论:通过。v1 十项差距九✓一◐(阴影机制边界),总纲 §6 最低线全过+深化层全落。**

## 一、工程门(收口实测)

- 全仓 `npm test` **2079 pass / 0 fail**(1 skipped 既有惯例)
- `npm run lint` 零错(eslint+stylelint+htmlhint)
- 服务 8090 运行中(8080 被 Steam 占用,PO 检阅入口)

## 二、交付清单(commit 链)

| commit | 线 | 内容 |
|---|---|---|
| f06c221 | lead | 粉羊毛 B_PINK_WOOL=78 公共件(贴图 59 格)+走查笔记+重制总稿 |
| 664f5ca | light | F+H 层:town 天空午后暖阳档3(0xa8cbe0/75/200/0.92)+HUD 暖纸质感+六值裁决落地 |
| d64c9f5 | lead | spec C 层消歧+H 层补遗二(hotbar 避让契约) |
| aa21d7f | scene | A 层一:摊位6/灯柱11/路标4 |
| 28941a1 | scene | A 层二+B:樱花6(门廊对位)+崖屋脊线复位 |
| d31b6cb | light | 崖屋格 pin 同步 |
| e582d86 | arch | M 层:全局配色 v2+灯柱三笔造型 |
| f8a7213 | arch | G 层:钟塔+风车塔几何 v2 |
| 00359fa | arch | C 层:三蓝图 v2(shop/cottage/loft)+钟塔石英主导重平衡 |
| 3ececc5 | lead | docs:map-design §4.2 cottage 高 6→7 |
| e6c958e | light | dims 实拼格位 pin 全量更新(palette v2) |
| 91704ae | arch | Step D:招牌鸡剪影立板+stash 升格+stall 双层阶梯顶(含 Uint8Array id≤255 回卷修复) |
| f840649 | lead | docs:map-design §4.2 摊位高 4-5 |
| e749405 | arch | v2 op 派生:需求表 10 项全落地(词表零扩展,字段门控) |
| 656a2fe | scene | v2 清单九项:田垄/小坪/缘石/山缘丛/旗阵/花坛桶南瓜/草花 138 点 |
| 9ea581b | scene | 山体五段分色+崖屋白墙橙顶重皮 |
| 3ce5b90 | light | dims v2 pin 收官 |
| 2572564 | arch | assembly v2 pin 收官(全仓 2079 绿) |

## 三、设计决策登记(终审追认全录)

1. 樱粉=粉羊毛 78 一键配平——全片观感最大单点收益(走查差距 #1/#4 根因修复)。
2. sky 档3 定稿+机制边界:环境光/色温无行参面,零机制扩展(ADR-0011),暖度由材质/场景层补。
3. 钟塔石英主导重平衡(撤腰线)——远读不再似旧木墙,终审实拍追认。
4. shop 招牌:76 橙底+16 红冠+白身块状鸡剪影,可读性终审通过(差距 #10 清账)。
5. stall 双层阶梯顶奶油×樱粉对偶+six theme(含 fish/pumpkin 新档)。
6. 山体五段弧形+三段分色(54/3/14/1 草坡过渡)+崖屋 v2(52 墙/17 角柱/18 窗/9 双层顶/19 灯×2)。
7. 农田 farm-rows(41 沟+42-45 轮转+58 埂+5 桩)/路缘/断头小坪/草花 138 点/旗阵四色/花坛桶南瓜。
8. H 层六值(panel 42vw600/28px/0.94/16px/20-14/56px+pop-in)+话术追认维持+增量句判据。
9. 技术发现:worldCells=Uint8Array,id 硬上限 255,测试注入号段须 ≤255(STALL_IDS 250..259 回卷事故→220..229,教训入 arch 回执 §7.3-7)。

## 四、流程事件备案

1. **「PO1115 裁决」勘误**:arch 会话内 ask_user 直达终端用户(绕过 lead 终审与枢纽对账),定性修正为「会话内用户选样,lead 终审追认」;改动本身实拍终审通过。00359fa commit 消息标注失实与否悬置 PO 口径(枢纽简报查询中),arch 回执 §3.8a 勘误段随身,交付时落笔。
2. **协同纪律(即日生效,收口载笔)**:三师会话内禁 ask_user 直达用户;多方案抉择列权衡清单落回执由 lead 裁;PO 层裁决经 lead 转呈枢纽。
3. **relay line 对 subagent child session 硬性禁用**(child session - line tools are primary-only)——三师协同走落盘回执+subagent 会话报告双通道,枢纽已采信备案。

## 五、遗留与后续票(不拦检阅)

1. **hotbar 会话避让**:revamp-spec「H 层补遗二」契约已定(会话开→hotbar 淡出下沉),实现归 T-UI-04 对话本体票;接线前对话 live 机位相撞为已知伪影豁免。
2. stash 桶堆内嵌墙格弱可读(arch 观察)——定稿几何不改,强化可开小票。
3. 山体材质分层(远山像素颗粒)/F 层暖度上限(环境光/色温)——均属 ADR-0011 外机制扩展,PO 嫌不足再开票。
4. 村民波次二(T-NPC-10/11/12):PO 递延不变,本任务未接线未销号。
5. 走查 harness 各师副本(walk-arch/scene/light.mjs)与探针脚本(*-probe*.js/*-v2-seg.txt)留 .scratch 不入库,可清理。

## 六、检阅指引

- 入口:http://localhost:8090(服务运行中)→ 主菜单「探险模式」→ 出发页「出发探险」→ home 图主路尽头进镇(维度过场)。
- PO 重点机位(lead 终审同款):出生第一眼(进镇直走)、广场全景(樱粉树丛+市集簇)、钟塔近观(门/窗/钟面/旗)、风车与农田(田垄围栏)、鸡店招牌(橙底鸡剪影)、北望山体(雪顶/崖屋剪影)。
- 会话体验:点村民开启对话(暖纸半透明面板;hotbar 相撞为已知豁免项)。
- 完整机位底片:`.scratch/town-design/shots/`(lead 终态)+各师 shots-*/shots-scene-v2/。
