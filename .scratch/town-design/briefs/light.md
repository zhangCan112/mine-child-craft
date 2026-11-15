# Brief·light 光色师——城镇重制 F+H 层+走查官

> 派单人:town-design-lead · 2026-11-14
> 你是城镇视觉重制的**光色与 HUD 师**兼全程走查官。PO 已把城镇设计+实现权整体授予 ui-designer 岗。

## 第一步(必做,顺序固定)
1. `open_line`,name: `town-design-light`(唯一,冲突加后缀)
2. 读 `AGENTS.md`(开工图谱协议:build_or_update_graph_tool 显式传 worktree 路径+full_rebuild:true)
3. 读 `docs/design/town-visual-revamp-spec.md`(总纲:§3 F/H 两层+§2 字库色板)
4. 读 `js/adventure-dims-core.js` 的维度行段(约 L640 附近 town 行:sky 参字段+注释——
   「暗 sky 参/暖亮 sky 参」的对比机制)与 `js/daylight-core.js`(昼夜机制,只读不改)
5. 读 `css/town.css` 全文+`js/town-ui-core.js` 头注释(五态决策——只读,你不改 js)
6. 读 `docs/design/town-ui-entry-hud-spec.md`(HUD 信息架构权威——**你只打磨质感,不动 IA**)
7. 走查证据:`.scratch/town-design/shots/` 全部 13 机位+`.scratch/town-design/walkthrough-notes.md` §二表

## 你的文件权(独占,勿碰他人文件)
- `css/town.css`(HUD 质感)
- `js/adventure-dims-core.js` 的 **town 维度行 sky 参值**(只许改这一个字段的值,零机制扩展;
  该文件其余部分是入口缝大件,一行都别动)
- 相关测试若断言 sky 参/css:`test/adventure-mode.test.js`(sky 参断言)· stylelint 配置不动

## 任务明细

### F 光照层
- town 行 sky 参向「午后暖阳」微调:天空色暖移(青蓝→暖蓝/奶油天际线方向)。
  **小步试拍**:每改一档就重拍机位对比(方法见下),迭代到「暖而不昏、亮而不白」。
  昼夜机制/daylight-core 零改动;若 sky 参只有单值通道(无雾/无环境光分离),在报告里
  说明机制上限,别硬扩机制(ADR-0011 口径)。

### H HUD 层
- css/town.css:罗盘圈/左上文字栏/提示条/对话面板的质感统一——暖色半透明底
  (取字库暖木/奶油系,如 rgba(0.66,0.52,0.33,0.55) 一类)、圆角、细描边(深木色)、
  留白呼吸感;**信息架构/文案/交互零改动**(town-ui-entry-hud-spec 继续有效);
  色彩记法走现代语法 `rgb(0 0 0 / 35%)`(stylelint 会管);类名 kebab-case。

### 走查官职责(贯穿全程)
- arch/scene 师交第一版后,你跑全机位重拍(walk 脚本,PORT 用 **9227**,user-data-dir 加 `-light`),
  按 revamp-spec §6 验收口径逐层打分,意见 relay 给 lead(每条带机位截图路径)。
- 你的评审意见是 lead 合并终审的关键输入,标准就一句话:**一眼暖、二眼有戏、三眼有发现;
  不接受「素模感」残存**。

## 自查闭环
- 复制 `.scratch/town-design/walk.mjs` 为 `walk-light.mjs`(PORT 9227、user-data-dir 加 `-light`)。
- CSS 变更后 node server.js 已由 lead 在 8090 起着,你直接拍;若需自己的服务实例,起 8091。

## 工程门与交付
1. `npm test` 全绿 + `npm run lint` 零错(stylelint 对 css 零错;改 sky 参若有断言同步)
2. git commit(中文消息;Windows 勿走 Out-File 管道写消息)
3. `relay send` → `town-design-lead`:F/H 改动清单+试拍对比结论(几档 sky 各自观感)+
   评审意见(走查官部分)+commit hash
4. 机制上限/字库矛盾:relay 报 lead

## 红线(总纲 §5 全文有效)
- 不碰:town-npc* 族、入口缝机制、mode-registry、js 源码(dims-core 的 town 行 sky 值除外)、
  prefab-kit/town-assembly-core(arch 的)、town-map-core(scene 的)、config/texture-atlas(lead 的)
- 注释中文;任何时刻保持仓库可绿,小步提交
