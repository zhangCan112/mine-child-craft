# 坦克(第一期)· 实现设计(定稿)

> 依据定稿方案 `docs/tank-plan.md`;经 pinpoint 批注流程评审,全文确认,开放问题已全部落定。
> 术语按 codebase-design:模块 / 接口 / 实现 / 深 / 缝 / 适配器。

## 0. 范围

只设计第一期闭环:**坦克模型 + 靠近提示(图标+语音)+ E/触屏上下车 + 差速转向 + 惯性 + 上台阶 + 车尾第三人称相机**。开炮、演习场靶子、驾驶触屏摇杆、履带动画是二期——文末只留缝,不实现。

## 1. 现状盘点:可以直接复用的深模块

| 现有事实 | 位置 | 复用方式 |
| --- | --- | --- |
| `mkMode(cfg)`:模式深接口(onKey/hud/touch/onVoidFall/KeyB 暂停全内置) | js/mode-kit.js | 新模式只声明差异,样板零复制 |
| `setTouchActions([{label, act}])`:触屏动作按钮 | js/input.js | "上车"大按钮一行声明,零新建 UI |
| `keys` / `touchMove` 全局输入,`physics()` 已在读 | js/voxel.js | 坦克物理按同一约定读,输入层零改动 |
| `CameraRig.apply()` 返回轨道距离,`Avatar` 据此显隐(`camDist > CAM.hideDist`) | js/camera-rig.js / avatar.js | 驾驶时让 apply 返回 0 → 玩家自动隐藏,**Avatar 零改动** |
| `raycastVoxel` 只查体素世界,打不到渲染网格 | js/voxel.js | 坦克是 THREE 网格不是方块 → 相机防穿墙**无需排除坦克自身**(方案稿第 9 节的担忧自动消解) |
| 方块配色已有 `装甲`(军绿)/`履带`(深灰) | js/config.js | 坦克体素配色直接取色,美术一致 |
| `PLAY_LIMIT_MODES = ['arena','tnt','build']` 计费表 | js/main.js | 加 `'tank'` 一行,即完成"计入儿童时限" |
| `SpeechKit.speak(text)` | js/speech.js | 靠近提示的语音 |
| `SceneKit`(填充/种树/散布) | js/scene-kit.js | 演习场地面、围栏、坡道 |
| `mkSpeech(synthesis, ...)` 依赖注入风格 | js/speech.js | 新模块的测试照此注 fake |

## 2. 模块图与接缝

```
引擎层(零玩法知识)                组合根                应用层
┌──────────────────────┐      ┌────────────────┐   ┌──────────────────────┐
│ tank-core.js 坦克驾驶核心│      │ main.js         │   │ modes/tank-range.js  │
│ (纯:零THREE零DOM,Node测)│ ◀── │  物理分支        │ ─▶│ 坦克演习场(TankRange │
│ tank.js 载具Tank        │      │  MODES 注册      │   │ Mode):提示文案/语音/ │
│ (建模+状态机+场景接入)  │      │  PLAY_LIMIT     │   │ 触屏按钮/计费         │
│ camera-rig.js +mount() │      │  菜单卡          │   └──────────────────────┘
└──────────────────────┘      └────────────────┘
```

新文件 3 个:`js/tank-core.js`、`js/tank.js`、`js/modes/tank-range.js`。
改 4 处:`camera-rig.js`(+1 方法)、`main.js`(组合根装配)、`index.html`+`css/style.css`(第五张菜单卡)、`config.js`(TANK 参数表,沿用参数表驱动惯例)。

## 3. 关键接缝:三次设计

### 缝 A:载具视角怎么接进相机

| 方案 | 做法 | 判词 |
| --- | --- | --- |
| 1. 锚点欺骗 | 驾驶时把全局 `pos/yaw` 锁成舱内值,CameraRig 无感知 | 零改动,但语义脏:玩家物理还得停、Avatar 显隐要特判、aim() 从舱内出发——复杂度没消失,散进主循环 |
| 2. 独立 TankCamera | 驾驶时主循环改调坦克相机 | 违反 GLOSSARY"CameraRig 是玩家视角的唯一入口";主循环长出 if/else;浅 |
| 3. **CameraRig.mount(tank|null)**(选) | 接口 +1 方法;`apply/aim` 内部把锚源从玩家换成坦克,轨道参数换 `CAM_TANK` | **深**:1 个方法背后换掉整个视角行为;主循环零改动;`apply` 返回 0 → 复用既有显隐契约,Avatar 零改动 |

选 3。`mount` 语义:挂载后 `cycle()` 锁定并 toast"驾驶中视角锁定";防穿墙射线从炮塔顶(抬高约 1.8 格)出发,轨道距离 6.5,收拢逻辑复用。

### 缝 B:驾驶物理放哪

| 方案 | 判词 |
| --- | --- |
| 1. 扩展现有 `physics()` | 体素模型要知道坦克——破坏"VoxelModel 不含玩法";玩家/坦克物理纠缠在一个函数 |
| 2. 塞进演习场模式的 update | 物理跟模式走,二期投放竞技场/建造就得复制 |
| 3. **tank-core.js 纯核心**(选) | 镜像 voxel.js 的既有分层("数据与规则纯核心,渲染是 adapter");零 THREE 零 DOM,Node 直测 |

### 缝 C:驾驶时玩家物理挂起点

`physics()` 内部查 Tank = 纯核心反向依赖上层,否决。**主循环分支**(组合根装配):

```js
if(Tank.driving()) Tank.update(dt); else physics(dt);
```

`Tank.update` 每帧都调(近距提示、履带待机都在里面),只是驾驶时替代 `physics`;模式 `onMenu`/`cleanup`/切模式调 `Tank.exitAll()` 保底,防"人在车里菜单关了"。

## 4. 模块接口规格

### 4.1 `tank-core.js` — 坦克驾驶核心(纯)

头注释照抄 voxel.js 风格:零 THREE · 零 DOM · 加载零副作用 → Node 可直接加载单测。

```js
TankCore.step(T, input, dt) → T        // 就地修改并返回 T
// T     = { x, y, z, yaw, vel, onGround }   vel 是车体前向标量速度(可为负=倒车)
// input = { forward: -1..1, steer: -1..1, aimYaw }
```

**单一权威方向**:`aimYaw` 是唯一的车头目标(桌面=鼠标 yaw;触屏=摇杆推的方向;A/D=以固定速率持续改写 aimYaw)。车体 `yaw` 以 `turnRate` 平滑追踪 `aimYaw`。键盘、鼠标、摇杆三个写入源不打架——这是 6 岁孩子操作的关键不变量。

行为规格(即测试断言):

- 差速转向:按 A/D 或摇杆转向原地即可转(不需要车速);`|d(yaw)/dt| ≤ TANK.turnRate`
- 惯性:`vel` 以 `accel` 逼近 `forward × TANK.speed`(倒车上限 `reverse`);松手按 `friction` 滑行衰减——重量感
- 爬台阶:前进受阻且"前方 +1 格、坦克盒内"净空 → 抬升 1 格(履带);净空不足则停住
- 碰撞:自带参数化 `boxCollides(px,py,pz, hw, hh)`(不动 `voxel.collides`,那是玩家尺寸写死的);轴向子步进 ≤0.25 格,同 physics 惯例
- 世界边缘隐形墙、极端挤压弹出兜底:同 physics 惯例
- 重力同 `PLAYER.gravity`,贴地即 `onGround=true`

`TANK` 参数表(config.js,参数表驱动):`hw:0.95, height:1.4, speed:7, reverse:3.5, accel:6, friction:4, turnRate:1.6, stepUp:1.0, promptR:2.5, enterR:3.0` + `CAM_TANK:{dist:6.5, lift:1.6, eye:1.8}`。

### 4.2 `js/tank.js` — 载具(Tank),引擎层

Avatar 的同位模块(建模 + 场景接入 + 一个小而深的接口):

```js
Tank.place(x, y, z, o)   // 放一辆(可多辆);o.yaw 初始朝向
Tank.update(dt)          // 每帧:idle 静默;driving 读输入 → TankCore.step → 同步网格与相机锚
Tank.toggle()            // 靠近则上车,驾驶中则下车;返回 'entered'|'exited'|'far'
Tank.driving()           // bool;主循环分支与 CameraRig 锚源都问它
Tank.nearby()            // 最近坦克距离 | null;提示与上车判定共用
Tank.exitAll()           // Esc/切模式/预算到点保底
Tank.clear()             // cleanup:移除全部网格,卸载相机
```

`toggle()` 一个方法背后:状态机 idle↔driving、`CameraRig.mount/unmount`、Avatar 隐(经 mount 后 apply 返回 0)、玩家 `vel` 清零与物理挂起、下车四侧找空位(`boxCollides` 以玩家尺寸探测,找不到原地弹出)。

建模:体素拼装,车体装甲绿 + 履带深灰 + 炮塔独立 `THREE.Group`(旋转枢轴一期就建好,二期开炮直接转,零返工)。

### 4.3 `modes/tank-range.js` — 坦克演习场(应用层)

`mkMode` 只声明差异;呈现与政策全在这一层(引擎不知道"提示"和"语音"):

```js
TankRangeMode = mkMode({
  id:'tank',
  init:      SceneKit 平地 + 围栏 + 一条坡道(二期才加靶子);Tank.place(...);spawn 玩家在坦克旁;
  onKey:     KeyE → Tank.toggle(),按返回值 SpeechKit("开坦克喽!"/"下车喽!")+toast
  hud:       nearby 且未驾驶 → '🚙 按 E 开坦克 · 点按钮上车'(文本给家长;孩子听语音)
  touch:     [{label:'🚙', act:()=>Tank.toggle()}]   // 触屏硬需求,一期交付
  onMenu:    Tank.exitAll()                           // Esc 保底下车
  onVoidFall: 默认回出生点(mkMode 内置)
})
```

靠近语音节流:同一辆车 10 秒最多说一次"要开坦克吗?按 E!"——防吵。

### 4.4 组合根与资源改动(main.js / index.html / css)

- `MODES.tank = TankRangeMode`;`PLAY_LIMIT_MODES` 加 `'tank'`(计费、超时锁卡、`refreshPlayCards` 自动生效)
- 主循环:`Tank.driving() ? Tank.update(dt) : physics(dt)`(缝 C);`Tank.update` 仅驾驶时被调——idle 网格静态,place 时已同步一次
- index.html `#modeCards` 第五张卡(🚙 坦克演习场 · 开坦克 炸靶子)+ `buildMenu` onclick + `updateLimitText` 文案加坦克

## 5. 深度自检(deletion test)

- 删 `tank-core` → 差速/惯性/台阶/碰撞在"模式层+渲染层"重写两份,Node 测试全灭——复杂度在 N 处重现,深度真实
- 删 `Tank.toggle` → 状态机+相机挂载+显隐+物理切换+下车寻位散回模式与主循环——1 个方法换 5 件事,杠杆最高点
- `mount` vs 独立相机:接口 1 个方法 vs 主循环分支+显隐特判两处特判——局部性立判
- 反面自检:提示文案/语音若放进 tank.js 就浅了(呈现属应用层)——已排除在 4.3

## 6. 测试计划(接口即测试面,replace-don't-layer)

| 文件 | 测什么 | 怎么测 |
| --- | --- | --- |
| `test/tank-core.test.js` | 加速/滑行/转向速率上限/A·D 改写 aimYaw/爬 1 格台阶/撞墙停/倒车/边缘墙 | 直载纯核心 + 真 `world`/`setBlockRaw`(照 voxel.test.js 惯例) |
| `test/tank-mode.test.js` | KeyE 路由到 toggle、hud 文案切换、`PLAY_LIMIT_MODES` 含 'tank'、触屏按钮声明 | mkMode cfg + **注入 fake Tank**(测模式不测引擎) |

不测:tank.js 渲染壳与 CameraRig.mount 的视觉效果(Node 无 THREE)——壳保持薄,风险收敛为接口笔误,靠一期手测清单兜底(上车/下车/坡道/Esc/超时锁/触屏按钮/双人……清单随实现给出)。

## 7. 命名与 GLOSSARY

- 引擎纯核心 `TankCore`、载具 `Tank`、模式 `TankRangeMode`(文件 tank-range.js,避免与引擎 tank.js 混淆)
- GLOSSARY 词条草稿——**载具(Tank)**:"可驾驶实体的引擎层模块:建模、驾驶状态机、相机锚源。接口:place/update/toggle/driving/nearby/clear。驾驶物理在 TankCore(纯核心),提示文案与政策在模式层。*Avoid*:坦克实体、载具系统"
- MISSION.md 不动(其成功标准是专注训练营;坦克是新游玩模式)

## 8. 二期接缝(只留缝,不实现)

- `TankCore.step` **现在不加** `turretYaw`——加了没人用是假缝;二期加字段 + `aim()` 改从炮口 + `onMouse` 开炮 + `Fx` 爆炸 + `sfx('boom')` + 炸地形走 TNT 的 `setBlockRaw` 破坏管线
- 炮塔 Group 旋转枢轴一期建好(渲染结构预留,零成本)
- 演习场"退出还原":模式 `init` 每次重建场景(`switchMode` 已调 `clearWorld`,天然还原),不存档

## 9. 开放问题(已全部落定)

1. ✅ 上下车用 **E 键**(现无占用;V/C 视角、B 暂停不冲突)。将来若做通用交互键再统一迁移。
2. ✅ 菜单第五张卡**点卡直接进演习场**——最少步数,适合孩子;TNT/建造的二级说明页模式不沿用。
3. ✅ 触屏摇杆松开回中后 **aimYaw 保持最后方向**(车走直线)——按此实现,一期真机试玩复核手感。
4. ✅ 坦克宽 1.9 格过不了 2 格宽窄门——**演习场不设窄门**;将来投放到其他模式时再复核通道宽度。
