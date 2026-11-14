# T-NPC-05 渲染适配件票（js/town-npc.js —— registry+kit → 可摆放傀儡）

> 波次：**一（可选降风险件）** ｜ blocking edges：**T-NPC-03**（注册表可查后开工；像素可只用 V01 试点先行开发）
> 性质：给波次二接线票一个**已测的装配缝**——本票不挂 index.html、不进模式壳，纯模块 + THREE 桩直测（先例：mob-look.test.js stubThree）。若并行线 ADR 落地后宿主形态要求不同签名，本票接口按注入式设计可低成本调整。

## 1. 目标

把「注册表条目 + 造型档案」收口为一个可摆放的渲染实体工厂：

- `mkTownNpcPuppet(id)`：按注册表查 key → `MobLookKit.puppet(key)`（既有傀儡路径：逐骨 Group+Mesh、−Z 原生、材质 NearestFilter）+ 头顶锚高度（气泡/名牌挂点：村民 2.0 格、G01 2.7 格，供话 UI World Bubble 锚定，dialog-prebuild §1.3）。
- `placeTownNpc(puppet, anchor)`：站位摆放纯装配——root.position = (x, y+1, z)（站立面 y+1，先例 `townSpawnIntent`）+ face→yaw 朝向 + 返回装配结果；不触场景/模式态。

## 2. 文件域

- 增：`js/town-npc.js`（无后缀 adapter：THREE/DOM 允许在此层，conventions §1.2）
- 增：`test/town-npc.test.js`（THREE 桩直测）
- **禁触**：index.html / js/town.js / js/mode-registry.js；不改 mob-look-kit.js / 注册表 / 锚点表。

## 3. 接口形状

```js
mkTownNpcPuppet(id /* 'V01'… */, opts?) → {
  root: THREE.Group,     // 整体位姿组（未摆放）
  bones: {...},          // 逐骨组（MobLookKit.puppet 口径，root 骨改名 body 的惯例保留）
  look: 'town_v01',      // look 键（回查注册表）
  anchorHeight: 2.0,     // 头顶锚（格）：村民 2.0 / G01 2.7 / 动物随几何
}
placeTownNpc(puppet, anchor /* anchorOf 产物 {x,y,z,face} */) → { x, y, z, yaw }
// root.position 置 (x, y+1, z)；yaw 由 face 映射
```

**face→yaw 双源消解**：朝向映射语义与 `js/modes/town.js` 的 `townYawOfFace`（seam brief §③ 列为可迁移纯装配件）一致，但 town.js 是禁触文件且其归宿待 ADR——本票**自带 face→yaw 纯映射**并在头注释登记「双源，待宿主会师后改为消费迁移后的权威函数消名」（T-NPC-10 会师条件之一）。测试用三角断言（南北互为 ±π、东西互为 ±π/2）锁语义不锁实现。

**显隐预留**：G01 花盒骨（flower）与裂纹层本票只暴露 `bones` 透传（骨已随 T-NPC-02 建好），显隐/切换逻辑归动画层选型票——不预造 API。

## 4. 验收标准（红绿可测）

1. 14 id 全部可建（T-NPC-02 后；开发期可用 town_v01 先行红绿）；`anchorHeight` 断言：V 系 2.0、G01 2.7。
2. `placeTownNpc`：位置 = (x, y+1, z)；五朝向 yaw 断言；返回值不含内部引用（零突变）。
3. 未知 id 抛拼写域错（错误消息含 id 与合法域提示）。
4. 零场景依赖：模块加载零副作用（不 new THREE 顶层对象），Node 桩下全链可测。
5. 收尾：`npm test` 全绿 + `npm run lint` 零错；禁触三文件零改动。

## 5. 备注

- 本票**可选**：若波次一排期紧张，可并入 T-NPC-10 接线票首段施工；独立成票的价值是把「傀儡装配正确性」的红绿从接线票（依赖 ADR 宿主）里剥出来提前锁住。
- 不做拾取/点击/名牌/HUD——全部归波次二（T-NPC-10/11）。
