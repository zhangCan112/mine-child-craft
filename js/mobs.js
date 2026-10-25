'use strict';
/* ============================================================
   怪物库 (Mobs, 术语见 GLOSSARY.md) — 引擎层
   ------------------------------------------------------------
   全游戏唯一的怪物实体模块(竞技场与坦克演习场共用):
   · 建模: MOB_RIG 骨架注册表 → (类型×关节槽) InstancedMesh 合批渲染
   · 数值: config.js 的 MOB_TYPES(血量/速度/身高/碰撞半径/旗标)
   · 本能: 血量/受击(闪白·踉跄·击退)/死亡(倒地沉没; 存活→死亡瞬间逐
     onDeath 回调报事件, 引擎不解释死因不做掉落)/游荡(wander 可关)
   interface: spawn / update / render / hit / near / clear / onDeath /
              list / face / hasSlot / gait / stagger / pulseTint / scaleTo /
               debrisColor / spawnable /
               move / shift / setPos / steer / heal / setMaxHp / remove / settle
   玩法(战斗AI/阵营/晋升/表扬话术)在模式层; 模式可在 spawn 返回的
   mob 上挂私有字段(tierNode/tierGeos 等挂件, dispose 时若存在一并回收)。
   模式可写引擎字段的白名单(除此之外引擎字段对模式只读):
   · tintBase    持久色(狂暴红晕, 本模块 update 每帧消费)
   · labelScale  名牌整体放大(本模块 update 每帧套用)
   · attackCd / attackT / target  战斗节拍与索敌(引擎 spawn 置零/置空,
     模式读写 — 曾有模式漏初始化 attackCd 致怪物永不攻击, 初始化已收归引擎)
   · pose 等关节角 经 gait() 写入(战斗覆盖在其返回值之上叠加)
     · pos.y       垂直特技(跃起砸地/悬浮压制)直写; 水平位移一律走意图 API
     · 瞬时效果与结构变更一律走意图 API: pulseTint(引信白闪) / stagger(硬直) /
       scaleTo(引信膨胀·阶级放大) / move·shift·setPos(水平位移) / steer(面向) /
       heal·setMaxHp(生命) / remove(立即移除) / settle(贴地回巡航) —
       不直写 tr/tg/tb/staggerT/drawScale/pos.x/pos.z/yaw/hp/maxHp/gone,
     免得正确性依赖"Mobs.update → 模式 → Mobs.render"的帧序。
   实例数组归本模块私有: list() 返回内部引用(只读约定),
   clear() 原地清空并冲刷批次, 引用保持稳定(竞技场的 mobs 别名长期有效)。
   THREE/DOM 全部惰性创建: 引导桩与 Node 测试环境可安全加载本文件。
   ============================================================ */
const Mobs = (() => {
  const mobList = [];
  let mobId = 0;
  const LABEL_CULL_D = 64; // 名牌相机距离剔除(格): 远处名牌本就小到难读
  const LABEL_CULL_D2 = LABEL_CULL_D * LABEL_CULL_D;
  const LABEL_W = 160; const LABEL_H = 40; // 名牌画布(血条坐标按此布局, 两处共用)
  const LABEL_BASE_W = 2.6; const LABEL_BASE_H = 0.65; // 名牌世界尺寸(× labelScale)
  /* 死亡时序(秒): 倒地 → 收名牌并下沉 → 隐藏绘制 → 回收, 互相关联故提常量 */
  const DEAD_FADE_T = 0.8; const DEAD_SINK_DUR = 1.4; const DEAD_SINK_DEPTH = 1.3;
  const DEAD_HIDE_T = 2.2; const DEAD_RECYCLE_T = 2.4;

  /* ---------- 建模: 骨架注册表 ----------
     slot = {joint:[枢轴], axis:'x'|'z', boxes:[部件]}
     部件 = box(宽,高,深, 颜色hex, x,y,z 偏移, 可选绕X预旋)
     —— 尺寸/偏移/枢轴与竞技场旧 build* 函数逐字一致, 视觉不变 */
  function box(w, h, d, hex, x, y, z, rx) {
    return {w, h, d, hex, x, y, z, rx};
  }
  const MOB_RIG = (()=>{
    const SKIN=0x5e9440; const SHIRT=0x2e7a70; const PANTS=0x4a3f70; const DARKZ=0x1c2b16;
    const BONE=0xd8d8d2; const BONE2=0xb8b8b0; const DARKS=0x1a1a1a; const WOOD=0x6b4a2a;
    const GREEN=0x4fae4f; const GREEN2=0x3d8f3d; const DARKC=0x101510;
    const IRON=0xcdd0d8; const IRON2=0xaab0bb; const DARKG=0x555a63; const EYEG=0xff2a1a;
    const BODY=0x16161f; const DARKD=0x262633; const MEMB=0x3a2055; const EYED=0xd06bff;

    /* ---- 参数化骨架生成器(新怪共用, 尺寸基准=僵尸五槽) ----
       hum: 人形(亡灵/灾厄村民/猪灵/嘎枝…) — tall 高个系数 · held 左手持物
            (→ rig 声明 weaponArm, gait 挥持械手) · eye 眼色 · ears 猪灵耳 ·
            hat 尖帽(女巫) · chest 胸前饰块(监守者光纹)
       quad: 四足(蜘蛛/疣猪兽/劫掠兽/农场动物) — 体+前伸头(带眼/獠牙)+
             对角腿(八足可选); comb 家禽肉冠(鸡: 头顶冠+颌下红髯, F4) */
    function hum(o) {
      const t = o.tall || 1;
      const armBoxes = [box(0.2, 0.72, 0.2, o.skin, 0, -0.34, 0)];
      if (o.held) {
        armBoxes.push(box(o.held.w, o.held.h, o.held.d, o.held.hex,
            0, -0.34-o.held.h/2, (o.held.z||0.1)));
      } // 持物垂在手下方
      const headBoxes = [box(0.5, 0.5, 0.5, o.skin, 0, 0.25, 0)];
      if (o.eye) {
        headBoxes.push(box(0.1, 0.08, 0.04, o.eye, -0.12, 0.3, 0.26),
            box(0.1, 0.08, 0.04, o.eye, 0.12, 0.3, 0.26));
      }
      if (o.ears) {
        headBoxes.push(box(0.08, 0.14, 0.1, o.ears, -0.3, 0.42, 0),
            box(0.08, 0.14, 0.1, o.ears, 0.3, 0.42, 0));
      }
      if (o.hat) {
        headBoxes.push(box(0.56, 0.12, 0.56, o.hat, 0, 0.54, 0),
            box(0.34, 0.26, 0.34, o.hat, 0, 0.72, 0),
            box(0.16, 0.26, 0.16, o.hat, 0, 0.96, 0));
      } // 三叠尖帽
      const rootBoxes = [box(0.5, 0.75, 0.26, o.shirt, 0, 1.12*t, 0)];
      if (o.chest) {
        o.chest.forEach((c)=> rootBoxes.push(
            box(c.w, c.h, c.d, c.hex, c.x, 1.12*t+c.y, 0.14)));
      } // 胸前饰(发光纹等)
      return {slots: {
        root: {joint: [0, 0, 0], boxes: rootBoxes},
        legL: {joint: [-0.13, 0.75*t, 0], boxes: [box(0.24, 0.75*t, 0.24, o.pants, 0, -0.375*t, 0)]},
        legR: {joint: [0.13, 0.75*t, 0], boxes: [box(0.24, 0.75*t, 0.24, o.pants, 0, -0.375*t, 0)]},
        armL: {joint: [-0.37, 1.42*t, 0], boxes: armBoxes},
        armR: {joint: [0.37, 1.42*t, 0], boxes: [box(0.2, 0.72, 0.2, o.skin, 0, -0.34, 0)]},
        head: {joint: [0, 1.5*t, 0], boxes: headBoxes},
      }, armStyle: o.arm, // arm: 步态风格('zombie' 前伸手), gait 解读
      weaponArm: o.held ? 'armL' : undefined}; // 挥击手=持械手: 武器挂哪只臂, gait 战斗就挥哪只
    }
    function quad(o) {
      const legOffs = o.legs8 ? // 八足:每槽4条(左槽左列)
        [[-0.44, 0.42], [-0.44, -0.42], [-0.1, 0.48], [-0.1, -0.48]] :
        [[-0.34, 0.35], [-0.34, -0.35]]; // 四足:对角腿对(苦力怕式)
      const legBoxes = (side) => (side ? legOffs : legOffs.map(([x, z])=>[-x, z]))
          .map(([sx, sz])=> box(o.legW, o.legH, o.legD, o.legHex, sx, -o.legH/2, sz));
      const headBoxes = [box(o.headS, o.headS, o.headS, o.headHex, 0, o.headY, o.headZ)];
      if (o.eye) {
        headBoxes.push(box(0.1, 0.07, 0.04, o.eye, -0.11, o.headY+0.1, o.headZ+o.headS/2),
            box(0.1, 0.07, 0.04, o.eye, 0.11, o.headY+0.1, o.headZ+o.headS/2));
      }
      if (o.tusk) {
        headBoxes.push(box(0.06, 0.18, 0.06, o.tusk, -0.18, o.headY-0.12, o.headZ+o.headS/2),
            box(0.06, 0.18, 0.06, o.tusk, 0.18, o.headY-0.12, o.headZ+o.headS/2));
      }
      /* F4 家禽冠髯: 头顶肉冠+颌下肉髯(鸡的辨识件, 偏移随 headY 同口径) */
      if (o.comb) {
        headBoxes.push(box(0.08, 0.1, 0.2, o.comb, 0, o.headY+o.headS/2+0.05, o.headZ-0.02));
        headBoxes.push(box(0.08, 0.14, 0.05, o.comb, 0, o.headY-o.headS/2+0.04, o.headZ+o.headS/2));
      }
      const rootBoxes = [box(o.w, o.h, o.d, o.hex, 0, o.bodyY, 0)];
      if (o.saddle) rootBoxes.push(box(o.w*0.8, 0.18, o.d*0.7, o.saddle, 0, o.bodyY+o.h/2+0.09, -0.1));
      return {slots: {
        root: {joint: [0, 0, 0], boxes: rootBoxes},
        legL: {joint: [0, o.legY, 0], boxes: legBoxes(true)},
        legR: {joint: [0, o.legY, 0], boxes: legBoxes(false)},
        head: {joint: [0, o.headY, 0], boxes: headBoxes},
      }};
    }
    return {
      zombie: hum({skin: SKIN, shirt: SHIRT, pants: PANTS, eye: DARKZ, arm: 'zombie'}),
      skeleton: {slots: {
        root: {joint: [0, 0, 0], boxes: [box(0.5, 0.72, 0.24, BONE, 0, 1.11, 0)]},
        legL: {joint: [-0.1, 0.75, 0], boxes: [box(0.16, 0.75, 0.16, BONE2, 0, -0.375, 0)]},
        legR: {joint: [0.1, 0.75, 0], boxes: [box(0.16, 0.75, 0.16, BONE2, 0, -0.375, 0)]},
        armL: {joint: [-0.34, 1.4, 0], boxes: [box(0.16, 0.72, 0.16, BONE, 0, -0.34, 0),
          box(0.07, 0.6, 0.09, WOOD, 0, -0.72, 0.1)]}, // 弓
        armR: {joint: [0.34, 1.4, 0], boxes: [box(0.16, 0.72, 0.16, BONE, 0, -0.34, 0)]},
        head: {joint: [0, 1.47, 0], boxes: [
          box(0.5, 0.5, 0.5, BONE, 0, 0.25, 0),
          box(0.12, 0.1, 0.04, DARKS, -0.12, 0.3, 0.26), box(0.12, 0.1, 0.04, DARKS, 0.12, 0.3, 0.26),
          box(0.08, 0.08, 0.04, DARKS, 0, 0.18, 0.26)]},
      }, armStyle: 'archer'}, // 弓手: 持弓臂前伸(gait 解读)
      creeper: {slots: {
        root: {joint: [0, 0, 0], boxes: [box(0.44, 0.9, 0.3, GREEN, 0, 0.85, 0)]},
        legL: {joint: [0, 0.42, 0], boxes: [ // 对角腿对
          box(0.26, 0.42, 0.28, GREEN2, -0.14, -0.21, 0.18), box(0.26, 0.42, 0.28, GREEN2, 0.14, -0.21, -0.18)]},
        legR: {joint: [0, 0.42, 0], boxes: [
          box(0.26, 0.42, 0.28, GREEN2, 0.14, -0.21, 0.18), box(0.26, 0.42, 0.28, GREEN2, -0.14, -0.21, -0.18)]},
        head: {joint: [0, 1.28, 0], boxes: [
          box(0.5, 0.5, 0.5, GREEN, 0, 0.25, 0),
          box(0.12, 0.12, 0.05, DARKC, -0.13, 0.32, 0.26), box(0.12, 0.12, 0.05, DARKC, 0.13, 0.32, 0.26),
          box(0.26, 0.1, 0.05, DARKC, 0, 0.13, 0.26), box(0.1, 0.16, 0.05, DARKC, 0, 0.05, 0.26)]},
      }},
      golem: {slots: {
        root: {joint: [0, 0, 0], boxes: [box(1.35, 1.5, 0.85, IRON, 0, 1.6, 0)]},
        legL: {joint: [-0.34, 0.85, 0], boxes: [box(0.5, 0.85, 0.5, IRON2, 0, -0.425, 0)]},
        legR: {joint: [0.34, 0.85, 0], boxes: [box(0.5, 0.85, 0.5, IRON2, 0, -0.425, 0)]},
        armL: {joint: [-0.87, 2.28, 0], boxes: [box(0.45, 1.55, 0.45, IRON, 0, -0.775, 0)]},
        armR: {joint: [0.87, 2.28, 0], boxes: [box(0.45, 1.55, 0.45, IRON, 0, -0.775, 0)]},
        head: {joint: [0, 2.35, 0], boxes: [
          box(0.72, 0.66, 0.72, IRON, 0, 0.35, 0),
          box(0.16, 0.34, 0.16, DARKG, 0, 0.28, 0.42),
          box(0.13, 0.09, 0.05, EYEG, -0.17, 0.44, 0.37), box(0.13, 0.09, 0.05, EYEG, 0.17, 0.44, 0.37)]},
      }},
      dragon: {slots: {
        root: {joint: [0, 0, 0], boxes: [ // 躯干+腹板+颈(预旋)+尾三节+后腿
          box(1.7, 1.3, 3.4, BODY, 0, 1.15, 0), box(1.5, 0.35, 3.0, DARKD, 0, 0.45, 0),
          box(0.75, 0.75, 1.7, BODY, 0, 1.5, 2.3, 0.25),
          box(0.95, 0.85, 1.5, BODY, 0, 1.15, -2.3), box(0.7, 0.6, 1.4, DARKD, 0, 1.2, -3.5),
          box(0.45, 0.4, 1.3, DARKD, 0, 1.25, -4.6),
          box(0.32, 1.0, 0.45, DARKD, -0.55, 0.25, -1.1), box(0.32, 1.0, 0.45, DARKD, 0.55, 0.25, -1.1)]},
        head: {joint: [0, 1.85, 3.3], boxes: [
          box(0.95, 0.85, 1.2, BODY, 0, 0, 0), box(0.6, 0.45, 0.7, DARKD, 0, -0.12, 0.9),
          box(0.14, 0.12, 0.1, EYED, -0.32, 0.18, 0.35), box(0.14, 0.12, 0.1, EYED, 0.32, 0.18, 0.35),
          box(0.16, 0.55, 0.16, DARKD, -0.3, 0.6, -0.35), box(0.16, 0.55, 0.16, DARKD, 0.3, 0.6, -0.35)]},
        wingL: {joint: [-0.85, 1.75, 0.2], axis: 'z', boxes: [
          box(3.2, 0.12, 2.2, MEMB, -1.6, 0, 0), box(1.8, 0.1, 1.4, MEMB, -3.9, -0.05, -0.2)]},
        wingR: {joint: [0.85, 1.75, 0.2], axis: 'z', boxes: [
          box(3.2, 0.12, 2.2, MEMB, 1.6, 0, 0), box(1.8, 0.1, 1.4, MEMB, 3.9, -0.05, -0.2)]},
      }},
      /* ---- 主世界杂兵 ---- */
      spider: quad({w: 0.9, h: 0.42, d: 1.05, hex: 0x2a2226, bodyY: 0.62,
        legs8: true, legW: 0.09, legH: 0.55, legD: 0.09, legHex: 0x1c171a, legY: 0.58,
        headS: 0.55, headHex: 0x2a2226, headY: 0.6, headZ: 0.72,
        eye: 0xd83a2a, tusk: null}),
      cave_spider: quad({w: 0.6, h: 0.3, d: 0.7, hex: 0x1a3a4a, bodyY: 0.4,
        legs8: true, legW: 0.07, legH: 0.36, legD: 0.07, legHex: 0x122833, legY: 0.38,
        headS: 0.4, headHex: 0x1a3a4a, headY: 0.38, headZ: 0.5,
        eye: 0xd83a2a}),
      silverfish: {slots: { // 石缝小蠹虫: 分节体+尾须
        root: {joint: [0, 0, 0], boxes: [
          box(0.34, 0.2, 0.5, 0x9a9a8a, 0, 0.14, 0),
          box(0.24, 0.15, 0.34, 0x8a8a7a, 0, 0.13, -0.4),
          box(0.14, 0.1, 0.22, 0x7a7a6a, 0, 0.12, -0.66)]},
        legL: {joint: [-0.12, 0.12, 0.1], boxes: [box(0.2, 0.05, 0.06, 0x6a6a5a, -0.13, -0.04, 0),
          box(0.2, 0.05, 0.06, 0x6a6a5a, -0.13, -0.04, -0.3)]},
        legR: {joint: [0.12, 0.12, 0.1], boxes: [box(0.2, 0.05, 0.06, 0x6a6a5a, 0.13, -0.04, 0),
          box(0.2, 0.05, 0.06, 0x6a6a5a, 0.13, -0.04, -0.3)]},
        head: {joint: [0, 0.14, 0.3], boxes: [box(0.3, 0.18, 0.26, 0x9a9a8a, 0, 0, 0.14),
          box(0.06, 0.06, 0.04, 0x2a2a22, -0.08, 0.02, 0.28), box(0.06, 0.06, 0.04, 0x2a2a22, 0.08, 0.02, 0.28)]},
      }},
      endermite: {slots: { // 紫色小螨: 同蠹虫骨架换色
        root: {joint: [0, 0, 0], boxes: [
          box(0.34, 0.2, 0.5, 0x8a5ab8, 0, 0.14, 0),
          box(0.24, 0.15, 0.34, 0x7a4aa5, 0, 0.13, -0.4),
          box(0.14, 0.1, 0.22, 0x6a3a95, 0, 0.12, -0.66)]},
        legL: {joint: [-0.12, 0.12, 0.1], boxes: [box(0.2, 0.05, 0.06, 0x5a3a7a, -0.13, -0.04, 0),
          box(0.2, 0.05, 0.06, 0x5a3a7a, -0.13, -0.04, -0.3)]},
        legR: {joint: [0.12, 0.12, 0.1], boxes: [box(0.2, 0.05, 0.06, 0x5a3a7a, 0.13, -0.04, 0),
          box(0.2, 0.05, 0.06, 0x5a3a7a, 0.13, -0.04, -0.3)]},
        head: {joint: [0, 0.14, 0.3], boxes: [box(0.3, 0.18, 0.26, 0x8a5ab8, 0, 0, 0.14),
          box(0.06, 0.06, 0.04, 0xd06bff, -0.08, 0.02, 0.28), box(0.06, 0.06, 0.04, 0xd06bff, 0.08, 0.02, 0.28)]},
      }},
      slime: {slots: { // 半透明做不了→实色壳+暗核+脸
        root: {joint: [0, 0, 0], boxes: [
          box(1.25, 1.25, 1.25, 0x5ac85a, 0, 0.63, 0),
          box(0.6, 0.6, 0.6, 0x3a8a3a, 0, 0.63, 0)]},
        head: {joint: [0, 0.63, 0.64], boxes: [
          box(0.16, 0.2, 0.05, 0x143a14, -0.2, 0.12, 0), box(0.16, 0.2, 0.05, 0x143a14, 0.2, 0.12, 0),
          box(0.3, 0.1, 0.05, 0x143a14, 0, -0.22, 0)]},
      }},
      magma_cube: {slots: { // 黑壳+岩浆核+炽眼
        root: {joint: [0, 0, 0], boxes: [
          box(1.25, 1.25, 1.25, 0x3a2a24, 0, 0.63, 0),
          box(0.65, 0.65, 0.65, 0xe8641a, 0, 0.63, 0)]},
        head: {joint: [0, 0.63, 0.64], boxes: [
          box(0.18, 0.16, 0.05, 0xffd23c, -0.2, 0.14, 0), box(0.18, 0.16, 0.05, 0xffd23c, 0.2, 0.14, 0)]},
      }},
      enderman: {slots: { // 高瘦黑影+横紫瞳
        root: {joint: [0, 0, 0], boxes: [box(0.4, 0.9, 0.24, 0x101018, 0, 1.85, 0)]},
        legL: {joint: [-0.11, 1.4, 0], boxes: [box(0.13, 1.4, 0.13, 0x0a0a12, 0, -0.7, 0)]},
        legR: {joint: [0.11, 1.4, 0], boxes: [box(0.13, 1.4, 0.13, 0x0a0a12, 0, -0.7, 0)]},
        armL: {joint: [-0.3, 2.28, 0], boxes: [box(0.11, 1.25, 0.11, 0x101018, 0, -0.62, 0)]},
        armR: {joint: [0.3, 2.28, 0], boxes: [box(0.11, 1.25, 0.11, 0x101018, 0, -0.62, 0)]},
        head: {joint: [0, 2.32, 0], boxes: [
          box(0.42, 0.42, 0.42, 0x101018, 0, 0.2, 0),
          box(0.32, 0.08, 0.05, 0xd06bff, 0, 0.24, 0.22)]},
      }},
      witch: hum({skin: 0x9a8a9a, shirt: 0x5a3a6a, pants: 0x4a2f58, hat: 0x2a1c30,
        held: {w: 0.16, h: 0.24, d: 0.16, hex: 0x8ad84a}}), // 手持毒药瓶
      husk: hum({skin: 0xb0a068, shirt: 0x8a7a4a, pants: 0x6a5a3a, eye: 0x3a3220}),
      drowned: hum({skin: 0x4a8a7a, shirt: 0x2a5a5a, pants: 0x3a4a4a, eye: 0x0a2a28,
        held: {w: 0.06, h: 1.05, d: 0.06, hex: 0x3a6a8a}}), // 三叉戟
      stray: hum({skin: 0xd8dee4, shirt: 0x7a9ab0, pants: 0x5a7a90, eye: 0x1a2a38,
        held: {w: 0.07, h: 0.6, d: 0.09, hex: WOOD}}), // 白袍弓手
      bogged: hum({skin: 0xb8c0a0, shirt: 0x7a8a5a, pants: 0x5a6a40, eye: 0x2a3820,
        held: {w: 0.07, h: 0.6, d: 0.09, hex: WOOD}}), // 苔藓骷髅弓手
      phantom: {slots: { // 蝠鲼形: 体+双翼+尾
        root: {joint: [0, 0, 0], boxes: [
          box(0.55, 0.24, 1.0, 0x3a5a7a, 0, 0.5, 0),
          box(0.3, 0.16, 0.5, 0x2c4460, 0, 0.5, -0.7)]},
        head: {joint: [0, 0.5, 0.5], boxes: [
          box(0.4, 0.3, 0.4, 0x3a5a7a, 0, 0, 0.18),
          box(0.1, 0.08, 0.05, 0x9ad83c, -0.1, 0.04, 0.4), box(0.1, 0.08, 0.05, 0x9ad83c, 0.1, 0.04, 0.4)]},
        wingL: {joint: [-0.3, 0.56, 0], axis: 'z', boxes: [
          box(1.3, 0.07, 0.7, 0x2c4460, -0.65, 0, 0)]},
        wingR: {joint: [0.3, 0.56, 0], axis: 'z', boxes: [
          box(1.3, 0.07, 0.7, 0x2c4460, 0.65, 0, 0)]},
      }},
      vex: {slots: { // 小飞灵: 淡蓝体+小剑+双翅
        root: {joint: [0, 0, 0], boxes: [box(0.3, 0.42, 0.2, 0x9ab8d8, 0, 0.55, 0)]},
        armL: {joint: [-0.2, 0.72, 0], boxes: [box(0.1, 0.36, 0.1, 0x9ab8d8, 0, -0.16, 0),
          box(0.06, 0.4, 0.12, 0xd8b028, 0, -0.5, 0.06)]},
        armR: {joint: [0.2, 0.72, 0], boxes: [box(0.1, 0.36, 0.1, 0x9ab8d8, 0, -0.16, 0)]},
        head: {joint: [0, 0.8, 0], boxes: [
          box(0.34, 0.34, 0.34, 0xb8cfe8, 0, 0.16, 0),
          box(0.09, 0.07, 0.04, 0xd83a2a, -0.08, 0.2, 0.18), box(0.09, 0.07, 0.04, 0xd83a2a, 0.08, 0.2, 0.18)]},
        wingL: {joint: [-0.16, 0.68, 0], axis: 'z', boxes: [box(0.5, 0.05, 0.3, 0xe8f2ff, -0.25, 0, 0)]},
        wingR: {joint: [0.16, 0.68, 0], axis: 'z', boxes: [box(0.5, 0.05, 0.3, 0xe8f2ff, 0.25, 0, 0)]},
      }, weaponArm: 'armL'}, // 小剑挂左臂: 挥击手=持械手
      creaking: hum({skin: 0x54402e, shirt: 0x64503a, pants: 0x483824,
        eye: 0xff8a2a, tall: 0.95}), // 木纹身+橙光眼
      /* ---- 下界 ---- */
      zombified_piglin: hum({skin: 0xd88a8a, shirt: 0xd88a8a, pants: 0x8a6a3a,
        eye: 0x2a1a1a, ears: 0xd88a8a,
        held: {w: 0.09, h: 0.85, d: 0.14, hex: 0xd8b028}}), // 金剑
      piglin: hum({skin: 0xe8a08a, shirt: 0xe8a08a, pants: 0x3a2a2a,
        eye: 0x2a1a1a, ears: 0xe8a08a,
        held: {w: 0.09, h: 0.85, d: 0.14, hex: 0xd8b028}}),
      piglin_brute: hum({skin: 0xe8a08a, shirt: 0xe8a08a, pants: 0x2a2a3a,
        eye: 0x2a1a1a, ears: 0xe8a08a, tall: 1.1,
        held: {w: 0.1, h: 0.95, d: 0.5, hex: 0xd8b028}}), // 金斧(宽刃)
      hoglin: quad({w: 0.85, h: 0.8, d: 1.3, hex: 0xa86a4a, bodyY: 0.85,
        legW: 0.2, legH: 0.45, legD: 0.2, legHex: 0x8a563a, legY: 0.45,
        headS: 0.55, headHex: 0xa86a4a, headY: 0.85, headZ: 0.85,
        tusk: 0xf0e8d8}),
      zoglin: quad({w: 0.85, h: 0.8, d: 1.3, hex: 0x7a8a5a, bodyY: 0.85,
        legW: 0.2, legH: 0.45, legD: 0.2, legHex: 0x5a6a40, legY: 0.45,
        headS: 0.55, headHex: 0x7a8a5a, headY: 0.85, headZ: 0.85,
        tusk: 0xf0e8d8}),
      wither_skeleton: hum({skin: 0x242424, shirt: 0x1a1a1a, pants: 0x1a1a1a,
        eye: 0x9a9a9a, tall: 1.25,
        held: {w: 0.09, h: 1.0, d: 0.16, hex: 0x8a8f98}}), // 高个黑骨+石剑
      blaze: {slots: { // 金核+烟雾杆(臂槽=旋转烟杆)
        root: {joint: [0, 0, 0], boxes: [
          box(0.4, 0.55, 0.4, 0xd8a81a, 0, 1.05, 0),
          box(0.26, 0.3, 0.26, 0xffd23c, 0, 1.35, 0)]},
        head: {joint: [0, 1.55, 0], boxes: [
          box(0.42, 0.42, 0.42, 0xe8c02a, 0, 0.2, 0),
          box(0.1, 0.09, 0.04, 0x3a2a10, -0.11, 0.24, 0.22), box(0.1, 0.09, 0.04, 0x3a2a10, 0.11, 0.24, 0.22)]},
        armL: {joint: [-0.42, 1.2, 0], boxes: [
          box(0.12, 0.85, 0.12, 0x3a342a, 0, -0.42, 0),
          box(0.12, 0.85, 0.12, 0x2c2822, -0.18, -0.3, 0.15)]},
        armR: {joint: [0.42, 1.2, 0], boxes: [
          box(0.12, 0.85, 0.12, 0x3a342a, 0, -0.42, 0),
          box(0.12, 0.85, 0.12, 0x2c2822, 0.18, -0.3, 0.15)]},
      }},
      ghast: {slots: { // 白立方+垂泪眼+9触手(腿槽)
        root: {joint: [0, 0, 0], boxes: [box(2.6, 2.6, 2.6, 0xe8e8e8, 0, 1.9, 0)]},
        head: {joint: [0, 2.3, 1.32], boxes: [ // 正面哭脸
          box(0.3, 0.34, 0.05, 0x1a1a1a, -0.45, 0, 0), box(0.3, 0.34, 0.05, 0x1a1a1a, 0.45, 0, 0),
          box(0.5, 0.2, 0.05, 0x1a1a1a, 0, -0.62, 0)]},
        legL: {joint: [-0.62, 0.62, 0], boxes: [
          box(0.16, 1.0, 0.16, 0xd8d8d4, -0.35, -0.5, 0.42), box(0.16, 0.85, 0.16, 0xd8d8d4, -0.4, -0.45, -0.5),
          box(0.16, 1.15, 0.16, 0xd8d8d4, 0.05, -0.58, 0.05)]},
        legR: {joint: [0.62, 0.62, 0], boxes: [
          box(0.16, 0.85, 0.16, 0xd8d8d4, 0.35, -0.45, 0.42), box(0.16, 1.0, 0.16, 0xd8d8d4, 0.4, -0.5, -0.5),
          box(0.16, 0.95, 0.16, 0xd8d8d4, -0.05, -0.48, -0.05)]},
      }},
      /* ---- 海洋与末地 ---- */
      guardian: {slots: { // 梭形鱼身+独眼+侧刺+摆尾
        root: {joint: [0, 0, 0], boxes: [
          box(0.85, 0.5, 0.9, 0x5a8a6a, 0, 0.48, 0),
          box(0.5, 0.3, 0.4, 0x4a7a5a, 0, 0.48, 0.6)]},
        head: {joint: [0, 0.48, 0.5], boxes: [
          box(0.34, 0.34, 0.05, 0xd8d8d0, 0, 0, 0.42),
          box(0.18, 0.18, 0.06, 0xd82a2a, 0, 0, 0.45)]}, // 独眼(白底红瞳)
        armL: {joint: [-0.46, 0.48, 0], boxes: [box(0.4, 0.09, 0.09, 0x8a6a4a, -0.22, 0, 0)]},
        armR: {joint: [0.46, 0.48, 0], boxes: [box(0.4, 0.09, 0.09, 0x8a6a4a, 0.22, 0, 0)]},
        legL: {joint: [-0.1, 0.48, -0.5], boxes: [box(0.14, 0.14, 0.55, 0x4a7a5a, 0, 0, -0.28)]},
        legR: {joint: [0.1, 0.48, -0.5], boxes: [box(0.14, 0.14, 0.55, 0x4a7a5a, 0, 0, -0.28)]},
      }},
      elder_guardian: (()=>{ // 守卫者放大×2.2+灰紫+多刺
        const g = [0.6, 0.48, 0.5, 0.3].map((v)=>v*2.2);
        return {slots: {
          root: {joint: [0, 0, 0], boxes: [
            box(0.85*2.2, 0.5*2.2, 0.9*2.2, 0x8a8a9a, 0, g[1], 0),
            box(0.5*2.2, 0.3*2.2, 0.4*2.2, 0x7a7a8a, 0, g[1], g[2])]},
          head: {joint: [0, g[1], g[2]], boxes: [
            box(0.34*2.2, 0.34*2.2, 0.08, 0xd8d8d0, 0, 0, 0.9),
            box(0.18*2.2, 0.18*2.2, 0.1, 0xd82a2a, 0, 0, 0.95)]},
          armL: {joint: [-0.46*2.2, g[1], 0], boxes: [box(1.0, 0.2, 0.2, 0x6a6a7a, -0.5, 0, 0),
            box(0.3, 0.14, 0.14, 0x6a6a7a, -1.05, 0.08, 0.3)]},
          armR: {joint: [0.46*2.2, g[1], 0], boxes: [box(1.0, 0.2, 0.2, 0x6a6a7a, 0.5, 0, 0),
            box(0.3, 0.14, 0.14, 0x6a6a7a, 1.05, 0.08, 0.3)]},
          legL: {joint: [-0.1, g[1], -0.5*2.2], boxes: [box(0.14*2.2, 0.14*2.2, 0.55*2.2, 0x7a7a8a, 0, 0, -0.6)]},
          legR: {joint: [0.1, g[1], -0.5*2.2], boxes: [box(0.14*2.2, 0.14*2.2, 0.55*2.2, 0x7a7a8a, 0, 0, -0.6)]},
        }};
      })(),
      shulker: {slots: { // 紫壳盒: head=上壳(攻击开合)
        root: {joint: [0, 0, 0], boxes: [
          box(1.0, 0.52, 1.0, 0x8a5a9a, 0, 0.26, 0),
          box(0.55, 0.3, 0.55, 0xd8b0ff, 0, 0.5, 0)]}, // 内芯
        head: {joint: [0, 0.5, 0], boxes: [
          box(0.95, 0.4, 0.95, 0x6a3f7a, 0, 0.22, 0),
          box(0.2, 0.1, 0.05, 0x2a1a30, -0.15, 0.3, 0.48), box(0.2, 0.1, 0.05, 0x2a1a30, 0.15, 0.3, 0.48)]},
      }},
      /* ---- 灾厄村民 ---- */
      vindicator: hum({skin: 0xb0b09a, shirt: 0x3a5a3a, pants: 0x2a3a2a, eye: 0x2a2a22,
        held: {w: 0.08, h: 0.9, d: 0.5, hex: 0x8a8f98}}), // 铁斧
      evoker: hum({skin: 0xb0b09a, shirt: 0xd8d8c8, pants: 0xc8c8b4, eye: 0x3a3a30,
        hat: 0xd8d8c8}),
      pillager: hum({skin: 0xb0b09a, shirt: 0x5a5a4a, pants: 0x4a4a3a, eye: 0x2a2a22,
        hat: 0x3a3a30,
        held: {w: 0.42, h: 0.12, d: 0.12, hex: 0x4a3a28, y: 0}}), // 弩(横臂)
      ravager: quad({w: 1.35, h: 1.0, d: 1.95, hex: 0x4a4a52, bodyY: 1.2,
        saddle: 0x2c2c33,
        legW: 0.32, legH: 0.7, legD: 0.34, legHex: 0x3a3a42, legY: 0.7,
        headS: 0.85, headHex: 0x54545e, headY: 1.2, headZ: 1.15,
        eye: 0xd8b028, tusk: 0xf0e8d8}),
      /* ---- 农场一家(F4 被动动物, 二期设计稿 §4.1): 体色锚 牛棕/猪粉/羊白/鸡米黄+红髯 ----
         尺寸随 MOB_TYPES.h 配平(hoglin 四足先例): legY=legH 贴地 · 头盒中心=2×headY
         (生成器既有口径) · 鸡=小体型贴地短腿变体(参数缩放, 无需特殊骨架条目) */
      cow: quad({w: 0.85, h: 0.65, d: 1.25, hex: 0x8c664d, bodyY: 0.85,
        legW: 0.2, legH: 0.5, legD: 0.2, legHex: 0x6b4f3a, legY: 0.5,
        headS: 0.55, headHex: 0x8c664d, headY: 0.7, headZ: 0.8,
        eye: 0x1c1410, tusk: 0xf0e8d8}), // 白色小弯角(借 tusk 槽位, 观感同件)
      pig: quad({w: 0.6, h: 0.5, d: 0.95, hex: 0xe69ea8, bodyY: 0.65,
        legW: 0.16, legH: 0.35, legD: 0.16, legHex: 0xd48a94, legY: 0.35,
        headS: 0.45, headHex: 0xe69ea8, headY: 0.5, headZ: 0.6,
        eye: 0x2a1a1a}),
      sheep: quad({w: 0.8, h: 0.65, d: 1.15, hex: 0xebebeb, bodyY: 0.85,
        legW: 0.18, legH: 0.5, legD: 0.18, legHex: 0xd8d4cc, legY: 0.5,
        headS: 0.5, headHex: 0xe8e0d0, headY: 0.68, headZ: 0.72,
        eye: 0x2a1a1a}), // 绒白身+浅奶油脸(羊毛团观感)
      chicken: quad({w: 0.4, h: 0.4, d: 0.55, hex: 0xf2e5bf, bodyY: 0.5,
        legW: 0.06, legH: 0.3, legD: 0.06, legHex: 0xd8a04a, legY: 0.3,
        headS: 0.34, headHex: 0xf2e5bf, headY: 0.4, headZ: 0.32,
        eye: 0x2a1a1a, comb: 0xd82a2a}), // 小体型短腿+橙脚+红冠髯
      /* ---- Boss ---- */
      wither: {slots: { // 脊柱肋骨+三骷髅头(臂槽=肩双头)
        root: {joint: [0, 0, 0], boxes: [
          box(0.28, 1.15, 0.28, 0x1c1c1c, 0, 1.05, 0),
          box(0.6, 0.1, 0.2, 0xd8d8d2, 0, 1.5, 0), box(0.6, 0.1, 0.2, 0xd8d8d2, 0, 1.2, 0),
          box(0.6, 0.1, 0.2, 0xd8d8d2, 0, 0.9, 0)]},
        head: {joint: [0, 2.0, 0], boxes: [
          box(0.55, 0.55, 0.55, 0x1c1c1c, 0, 0.26, 0),
          box(0.13, 0.11, 0.05, 0xd8d8d2, -0.14, 0.32, 0.29), box(0.13, 0.11, 0.05, 0xd8d8d2, 0.14, 0.32, 0.29),
          box(0.1, 0.09, 0.05, 0xd8d8d2, 0, 0.14, 0.29)]},
        armL: {joint: [-0.5, 1.95, 0], boxes: [
          box(0.42, 0.42, 0.42, 0x1c1c1c, 0, 0.2, 0),
          box(0.1, 0.09, 0.05, 0xd8d8d2, -0.1, 0.25, 0.22), box(0.1, 0.09, 0.05, 0xd8d8d2, 0.1, 0.25, 0.22)]},
        armR: {joint: [0.5, 1.95, 0], boxes: [
          box(0.42, 0.42, 0.42, 0x1c1c1c, 0, 0.2, 0),
          box(0.1, 0.09, 0.05, 0xd8d8d2, -0.1, 0.25, 0.22), box(0.1, 0.09, 0.05, 0xd8d8d2, 0.1, 0.25, 0.22)]},
      }},
      warden: {slots: { // 巨胸sculk+胸口光纹+触角
        root: {joint: [0, 0, 0], boxes: [
          box(1.05, 1.05, 0.65, 0x182a3a, 0, 1.55, 0),
          box(0.3, 0.5, 0.06, 0x4ae0c8, -0.22, 1.55, 0.36), box(0.3, 0.5, 0.06, 0x4ae0c8, 0.22, 1.55, 0.36)]},
        legL: {joint: [-0.26, 1.0, 0], boxes: [box(0.34, 1.0, 0.36, 0x122430, 0, -0.5, 0)]},
        legR: {joint: [0.26, 1.0, 0], boxes: [box(0.34, 1.0, 0.36, 0x122430, 0, -0.5, 0)]},
        armL: {joint: [-0.66, 2.05, 0], boxes: [box(0.34, 1.35, 0.36, 0x18324a, 0, -0.65, 0),
          box(0.3, 0.2, 0.34, 0x0d1a26, 0, -1.25, 0)]},
        armR: {joint: [0.66, 2.05, 0], boxes: [box(0.34, 1.35, 0.36, 0x18324a, 0, -0.65, 0),
          box(0.3, 0.2, 0.34, 0x0d1a26, 0, -1.25, 0)]},
        head: {joint: [0, 2.12, 0], boxes: [
          box(0.68, 0.62, 0.6, 0x18324a, 0, 0.3, 0),
          box(0.1, 0.3, 0.1, 0x4ae0c8, -0.18, 0.72, 0.1), box(0.1, 0.3, 0.1, 0x4ae0c8, 0.18, 0.72, 0.1),
          box(0.1, 0.24, 0.1, 0x4ae0c8, -0.18, 0.7, -0.22), box(0.1, 0.24, 0.1, 0x4ae0c8, 0.18, 0.7, -0.22)]},
      }},
    };
  })();

  /* 槽部件盒子合并为一份带顶点色的几何(逐槽一份, 全类型共享材质) */
  function buildRigGeo(boxes) {
    const positions=[]; const normals=[]; const colors=[]; const indices=[];
    let n = 0;
    for (const b of boxes) {
      const g = new THREE.BoxGeometry(b.w, b.h, b.d);
      if (b.rx) g.rotateX(b.rx);
      g.translate(b.x, b.y, b.z);
      const pos = g.attributes.position; const nor = g.attributes.normal; const idx = g.index;
      const c = new THREE.Color(b.hex); // hex → 线性 [r,g,b](与旧 setHex 同口径, r128 无色彩管理)
      for (let i=0; i<pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
        colors.push(c.r, c.g, c.b);
      }
      for (let i=0; i<idx.count; i++) indices.push(idx.getX(i)+n);
      n += pos.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    return geo;
  }

  /* ---------- 批次管理: (类型×槽) → InstancedMesh, 容量按需翻倍(矩阵每帧
     全量重写, 扩容无需搬运); 空批次 count=0 不产生绘制 ---------- */
  let mobMat = null; // 惰性创建: 引导桩环境不建材质
  const mobBatches = [];
  function getMobBatch(slot) {
    let b = slot.batch;
    if (b) return b;
    if (!mobMat) mobMat = new THREE.MeshLambertMaterial({vertexColors: true});
    if (!slot.geo) slot.geo = buildRigGeo(slot.boxes);
    const mesh = new THREE.InstancedMesh(slot.geo, mobMat, 16);
    mesh.frustumCulled = false; // 实例散布全场, 按几何包围球剔除会误裁
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _tintCol.setRGB(1, 1, 1)); // 预建 instanceColor, 避免首次着色才编译变体
    scene.add(mesh);
    b = {mesh, cap: 16, n: 0};
    slot.batch = b;
    mobBatches.push(b);
    return b;
  }
  function growMobBatch(b, need) {
    let cap = b.cap;
    while (cap < need) cap *= 2;
    scene.remove(b.mesh);
    if (b.mesh.dispose) b.mesh.dispose(); // 几何/材质共享不在此动
    const mesh = new THREE.InstancedMesh(b.mesh.geometry, mobMat, cap);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, _tintCol.setRGB(1, 1, 1));
    scene.add(mesh);
    b.mesh = mesh; b.cap = cap;
  }

  /* 每帧把存活怪的各槽实例矩阵/颜色写入批次(密集重排, 无空闲表):
     位姿 = 位置(yaw/tilt) × 关节角(pose) × 体型(drawScale), 着色 = tint */
  const _wm=new THREE.Matrix4(); const _jm=new THREE.Matrix4(); const _im=new THREE.Matrix4();
  const _wq=new THREE.Quaternion(); const _jq=new THREE.Quaternion(); const _we=new THREE.Euler();
  const _wp=new THREE.Vector3(); const _jp=new THREE.Vector3(); const _ws=new THREE.Vector3();
  const _one=new THREE.Vector3(1, 1, 1);
  const _axisX=new THREE.Vector3(1, 0, 0); const _axisZ=new THREE.Vector3(0, 0, 1);
  const _tintCol=new THREE.Color();

  function render() {
    for (const b of mobBatches) b.n = 0; // 也覆盖清场后: count 归零, 残余实例不再绘制
    for (const m of mobList) {
      if (m.gone) continue;
      if (m.dead && m.deadT > DEAD_HIDE_T) { // 原 visible=false 的隐藏期
        if (m.tierNode) m.tierNode.visible = false; // 挂件随尸体一起隐去
        continue;
      }
      const rig = MOB_RIG[m.type];
      const s = m.drawScale;
      const sink = (m.dead && m.deadT > DEAD_FADE_T) ?
        Math.min(1, (m.deadT-DEAD_FADE_T)/DEAD_SINK_DUR)*DEAD_SINK_DEPTH : 0; // 原"透明淡出"的实例化等价: 下沉入地
      _we.set(0, m.yaw, m.deadTilt); // Euler(0,yaw,tilt) 默认序 = Ry·Rz, 与旧 group 一致
      _wq.setFromEuler(_we);
      _wm.compose(_wp.set(m.pos.x, m.pos.y - sink, m.pos.z), _wq, _ws.set(s, s, s));
      for (const name of Object.keys(rig.slots)) {
        const slot = rig.slots[name];
        const b = getMobBatch(slot);
        if (b.n >= b.cap) growMobBatch(b, b.n+1);
        _jq.setFromAxisAngle(slot.axis==='z' ? _axisZ : _axisX, name==='root' ? 0 : (m.pose[name]||0));
        _jm.compose(_jp.fromArray(slot.joint), _jq, _one);
        _im.multiplyMatrices(_wm, _jm);
        b.mesh.setMatrixAt(b.n, _im);
        b.mesh.setColorAt(b.n, _tintCol.setRGB(m.tr, m.tg, m.tb));
        b.n++;
      }
      if (m.tierNode) { // 阶级挂件(稀有, 普通 mesh)对齐实例位姿
        m.tierNode.visible = true;
        m.tierNode.position.set(m.pos.x, m.pos.y - sink, m.pos.z);
        m.tierNode.rotation.set(0, m.yaw, m.deadTilt);
        m.tierNode.scale.setScalar(s);
      }
    }
    for (const b of mobBatches) {
      b.mesh.count = b.n;
      if (b.n > 0) {
        b.mesh.instanceMatrix.needsUpdate = true;
        if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /* ---------- 名牌: 阵营前缀/颜色由调用方给(竞技场红蓝, 演习场无前缀) ----------
     labelCfg 可选 suffix(m)/hot(m): 名字后追加的文案(如晋升星级)与
     金色高亮开关 — 星级语义归模式层, 引擎只画调用方给的字符串 */
  function drawLabel(m) {
    const g = m.labelCanvas.getContext('2d');
    g.clearRect(0, 0, LABEL_W, LABEL_H);
    g.font='bold 15px sans-serif';
    g.shadowColor='#000'; g.shadowBlur=4;
    const cfg = m.labelCfg || {};
    const pre = cfg.prefix || '';
    const col = cfg.color || '#ffd44d';
    const suffix = (cfg.suffix && cfg.suffix(m)) || '';
    const hot = !!(cfg.hot && cfg.hot(m));
    const full = pre + m.cfg.name + suffix;
    if (m.dead) {
      g.textAlign='center'; g.fillStyle='#9a9a9a'; g.fillText(full, 80, 15);
    } else if (hot) {
      const wPre = g.measureText(pre).width; const wFull = g.measureText(full).width;
      const x0 = 80 - wFull/2;
      g.textAlign='left';
      g.fillStyle = col; // 前缀保持调用方色
      g.fillText(pre, x0, 15);
      g.fillStyle = '#ffd44d'; // 高亮金光(晋升)
      g.shadowColor='#ffb018'; g.shadowBlur=8;
      g.fillText(full.slice(pre.length), x0+wPre, 15);
    } else {
      g.textAlign='center'; g.fillStyle = col;
      g.fillText(full, 80, 15);
    }
    g.shadowBlur = 0;
    g.fillStyle='rgba(0,0,0,.65)'; g.fillRect(30, 22, 100, 10);
    const r = Math.max(0, m.hp/m.maxHp);
    g.fillStyle = r>0.5 ? '#48d848' : (r>0.25 ? '#e8c030' : '#e04030');
    g.fillRect(32, 24, 96*r, 6);
    m.labelTex.needsUpdate = true;
  }

  function dispose(m) {
    if (m.label) {
      scene.remove(m.label);
      m.label.material.map.dispose(); m.label.material.dispose();
    }
    if (m.tierNode) scene.remove(m.tierNode); // 模式挂件(竞技场阶级光环等, 稀有物)
    if (m.tierGeos) m.tierGeos.forEach((g)=>g.dispose());
    if (m.tierMats) m.tierMats.forEach((mt)=>mt.dispose());
  }

  /* ---------- 生命周期 ---------- */
  function spawn(type, x, z, opts) {
    opts = opts || {};
    const cfg = MOB_TYPES[type];
    const gy = groundTop(Math.floor(x), Math.floor(z)) + 1;
    const y0 = cfg.fly ? (opts.flyY !== undefined ? opts.flyY : gy + 6) : gy; // 巡航高度(游荡飞行被震落后回这里)
    const m = {
      id: mobId++, type, cfg,
      labelCfg: opts.label || null,
      pose: {legL: 0, legR: 0, armL: 0, armR: 0, head: 0, wingL: 0, wingR: 0}, // 关节角(弧度), render 组实例矩阵
      drawScale: 1, deadTilt: 0, // 体型(挂件缩放/引信膨胀) 与 倒地角
      tr: 1, tg: 1, tb: 1, tintBase: [1, 1, 1], // instanceColor 着色(闪白/狂暴等持久色)
      pos: (typeof THREE !== 'undefined') ?
      new THREE.Vector3(x, y0, z) :
      {x, y: y0, z},
      yaw: opts.yaw || 0,
      hp: cfg.hp, maxHp: cfg.hp, dead: false, deadT: 0, gone: false,
      /* 战斗节拍(攻击冷却/挥击动画计时/索敌目标): 引擎初始化, 模式可写可读 —
         下界模式曾因模式层漏初始化 attackCd(undefined<=0 恒 false)导致怪物
         永不攻击且零报错, 故收归引擎置零 */
      attackCd: 0, attackT: 0, target: null,
      flashT: 0, staggerT: 0,
      walkPhase: Math.random()*6, speedNow: 0, flyPhase: Math.random()*6, flyHome: y0,
      wander: opts.wander || null, // 游荡配置(栅栏), 无则站立/由模式驱动
      wanderT: 0, wanderDir: Math.random()*Math.PI*2,
      clamp: opts.clamp || null, // 飞行单位击退后的边界约束(竞技场圆形)
      labelScale: 1, // 名牌放大倍率(模式可写, 白名单字段)
      tierNode: null, tierGeos: [], tierMats: [], // 模式挂件位(dispose 一并回收)
      lastLabelHp: -1, lastLabelDead: false, labelT: 0,
    };
    if (opts.hpMult) {
      m.hp = m.maxHp = Math.round(cfg.hp * opts.hpMult);
    }
    if (typeof document !== 'undefined' && typeof THREE !== 'undefined') {
      const lc = document.createElement('canvas'); lc.width=LABEL_W; lc.height=LABEL_H;
      const ltex = new THREE.CanvasTexture(lc);
      m.label = new THREE.Sprite(new THREE.SpriteMaterial({map: ltex, transparent: true, depthTest: false}));
      m.labelCanvas = lc; m.labelTex = ltex;
      applyLabelScale(m);
      scene.add(m.label);
      drawLabel(m);
    }
    mobList.push(m);
    return m;
  }

  /* 通用本能(每帧, 模式战斗逻辑之前调):
     名牌剔除/跟随 · 血条节流重绘 · 受击闪白与踉跄计时 · 着色
     死亡动画(倒地/坠落/下沉) · 游荡移动(配置了 wander 的怪)
     尸体与残骸回收(gone 或 deadT>2.4) */
  function update(dt) {
    for (const m of mobList) {
      if (m.gone) continue;
      const gp = m.pos;
      if (m.label) {
        const ldx = gp.x - camera.position.x; const ldz = gp.z - camera.position.z;
        m.label.visible = (ldx*ldx + ldz*ldz) < LABEL_CULL_D2;
        if (m.label.visible) {
          m.label.position.set(gp.x, gp.y + m.cfg.h + 0.55, gp.z);
          applyLabelScale(m); // labelScale(模式白名单字段)每帧套用
        }
      }
      if (m.dead) {
        m.deadT += dt;
        if (m.cfg.fly) { // 飞行单位死亡坠落
          const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
          if (gp.y > gy) gp.y = Math.max(gy, gp.y - 16*dt);
        }
        m.deadTilt = Math.min(Math.PI/2, m.deadT*3); // 倒地角(render 组矩阵)
        if (m.deadT > DEAD_FADE_T && m.label) m.label.visible = false; // 尸体淡出即收牌
        if (!m.lastLabelDead && m.labelCanvas) {
          drawLabel(m); m.lastLabelDead = true;
        }
        continue;
      }
      if (m.label && m.lastLabelHp !== m.hp) { // 大兵团时血条节流重绘
        m.labelT -= dt;
        if (m.labelT <= 0) {
          drawLabel(m); m.lastLabelHp = m.hp; m.labelT = 0.3;
        }
      }
      const t = MobCore.tintFlash(m); // 受击闪白 > 持久色(模式写入 tintBase)
      m.tr = t[0]; m.tg = t[1]; m.tb = t[2];
      if (m.flashT > 0) m.flashT -= dt;
      if (m.staggerT > 0) m.staggerT -= dt;
      if (m.cfg.fly && m.staggerT > 0) { // 被震落的飞行单位下沉
        const gy = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
        if (gp.y > gy) gp.y = Math.max(gy, gp.y - 10*dt);
      }
      if (m.wander) wanderStep(m, dt);
    }
    for (let i=mobList.length-1; i>=0; i--) {
      const m = mobList[i];
      if (m.gone || (m.dead && m.deadT > DEAD_RECYCLE_T)) {
        dispose(m);
        mobList.splice(i, 1);
      }
    }
  }

  /* 名牌尺寸 = 基准 × labelScale(spawn 初始与 update 每帧共用一条式) */
  function applyLabelScale(m) {
    const ls = m.labelScale || 1;
    m.label.scale.set(LABEL_BASE_W*ls, LABEL_BASE_H*ls, 1);
  }

  /* 游荡(演习场靶怪): 随机换向 · 栅栏/撞墙回头 · 贴地爬坡 · 步态关节 */
  function wanderStep(m, dt) {
    const gp = m.pos; const f = m.wander;
    m.wanderT -= dt;
    if (m.wanderT <= 0) {
      m.wanderDir = Math.random()*Math.PI*2;
      m.wanderT = 1 + Math.random()*2;
    }
    const sp = 1.1;
    const nx = gp.x + Math.cos(m.wanderDir)*sp*dt; const nz = gp.z + Math.sin(m.wanderDir)*sp*dt;
    if ((f && (nx < f.x0 || nx > f.x1 || nz < f.z0 || nz > f.z1)) ||
       isSolid(getBlock(Math.floor(nx), Math.floor(gp.y + 1), Math.floor(nz)))) {
      m.wanderT = 0; // 撞墙/出界 → 原地换向
      return;
    }
    m.yaw = Math.atan2(Math.cos(m.wanderDir), Math.sin(m.wanderDir)); // 模型面朝 +Z
    MobCore.stepMove(m, nx-gp.x, nz-gp.z, groundTop);
    settle(m, dt);
    m.speedNow = sp;
    gait(m, dt, sp);
  }

  /* 步态(引擎/模式共用): 走路摆腿 · 飞行扇翅 · 按骨架表 armStyle 摆臂。
     返回摆幅 sw — 模式的攻击挥臂等战斗姿态在 gait 写入的 pose 之上覆盖叠加。
     第 4 参 atkDur(可缺省)= attackT 满时长 → 通用战斗姿态一并收在此:
     有臂挥臂(僵尸式下劈/弓手举持/通用人形抡臂 — 挥击手=持械手: 骨架表
     weaponArm 声明持械臂, 缺省抡右拳), 无臂有头则头部前扑 —
     骨架知识本就住在引擎, 模式不再各自手抄 sin 公式(竞技场曾硬编码
     /0.45, attackT 超时长时相位为负; 此处钳制到 [0,1]) */
  function gait(m, dt, sp, atkDur) {
    m.walkPhase += sp*dt*3.4;
    const sw = Math.sin(m.walkPhase)*0.5*Math.min(1, sp/2.2);
    const J = m.pose;
    const rig = MOB_RIG[m.type];
    if (rig.slots.legL) {
      J.legL = sw; J.legR = -sw;
    }
    if (rig.slots.wingL) { // 通用飞行扇翅(末影龙/幻翼/恼鬼)
      m.flyPhase += dt*6;
      const wf = Math.sin(m.flyPhase)*0.5;
      J.wingL = wf + 0.15;
      J.wingR = -(wf + 0.15);
    }
    if (rig.armStyle === 'zombie') { // 僵尸前伸手
      J.armL = -1.45; J.armR = -1.45;
    } else if (rig.armStyle === 'archer') { // 骷髅弓手(持弓臂前伸)
      J.armL = -0.15 + sw*0.3; J.armR = -sw*0.5;
    } else if (rig.slots.armL) { // 通用摆臂(人形怪/守卫者侧刺/凋灵肩头)
      J.armL = sw*0.5; J.armR = -sw*0.5;
    }
    if (atkDur) { // 战斗姿态叠加(每帧幂等: 攻/不攻都写, 无残留)
      const s = m.attackT > 0 ?
        Math.sin(Math.max(0, Math.min(1, 1 - m.attackT/atkDur)) * Math.PI) : 0;
      if (rig.armStyle === 'zombie') { // 僵尸式: 平举前臂下劈
        J.armR = m.attackT > 0 ? -1.45 - s*0.9 : -1.45;
      } else if (rig.armStyle === 'archer') { // 弓手式: 攻击中持弓臂定住瞄准
        J.armR = m.attackT > 0 ? -1.3 : -sw*0.5;
      } else if (rig.slots.armL) { // 通用: 抡臂挥击 — 持械臂抡(缺省右拳), 另一臂反向平衡
        J.armL = -sw*0.5; J.armR = sw*0.5; // 两臂步态基线(相位互补)
        if (m.attackT > 0) J[rig.weaponArm || 'armR'] = -s*1.9; // 挥击手=持械手
      } else if (rig.slots.head) { // 四足/恶魂式: 头部前扑
        J.head = m.attackT > 0 ? -0.55 : 0;
      }
    }
    return sw;
  }

  /* ---------- 模式层的意图 API(替代直写引擎字段, 帧序契约收在此) ---------- */
  function pulseTint(m, r, g, b) {
    m.tr = r; m.tg = g; m.tb = b;
  } // 帧内瞬时着色(下一帧 update 的着色管线接管)
  function stagger(m, t) {
    m.staggerT = Math.max(m.staggerT||0, t);
  } // 踉跄/硬直(取大, 不缩短更长的既有硬直)
  function scaleTo(m, s) {
    m.drawScale = s;
  } // 体型(引信膨胀/阶级放大)
  /* 位移族: 战斗 AI 不再直写 pos/yaw —
     move   地面步进(x/z 分轴走台阶规则, 爬坡/拦高墙)
     shift  无碰撞平移(飞行单位的巡航/盘旋)
     setPos 几何回弹的绝对落位(边界约束把单位拉回场内) */
  function move(m, dx, dz) {
    MobCore.stepMove(m, dx, 0, groundTop);
    MobCore.stepMove(m, 0, dz, groundTop);
  }
  function shift(m, dx, dz) {
    m.pos.x += dx; m.pos.z += dz;
  }
  function setPos(m, x, z) {
    m.pos.x = x; m.pos.z = z;
  }
  function steer(m, yaw) {
    m.yaw = yaw;
  } // 面向(render 消费)
  /* 生命族: heal 回血(封顶 maxHp) · setMaxHp 晋升改上限(现血超出即截断) */
  function heal(m, hp) {
    m.hp = Math.min(m.maxHp, m.hp + hp);
  }
  function setMaxHp(m, maxHp) {
    m.maxHp = maxHp; if (m.hp > maxHp) m.hp = maxHp;
  }
  /* 立即移除(下帧走引擎回收管线: 自爆残留/清场单只) */
  function remove(m) {
    m.gone = true;
  }
  /* 贴地/回巡航高度(游荡本能的同一条式, 战斗 AI 收尾复用) */
  function settle(m, dt) {
    const gp = m.pos;
    if (!m.cfg.fly) {
      const ty = groundTop(Math.floor(gp.x), Math.floor(gp.z)) + 1;
      gp.y += (ty-gp.y)*Math.min(1, dt*10); // 爬坡下坎自然贴地
    } else if (gp.y !== m.flyHome) {
      gp.y += (m.flyHome-gp.y)*Math.min(1, dt*2); // 被震落后缓慢回到巡航高度(不贴地怪飞)
    }
  }

  /* 逐怪种碎块配色(击杀碎块观感, 竞技场/演习场共用), 缺省灰 */
  const MOB_DEBRIS = {
    zombie: 0x5e9440, skeleton: 0xd8d8d2, creeper: 0x4fae4f, golem: 0xcdd0d8, dragon: 0x3a2055,
    spider: 0x2a2226, cave_spider: 0x1a3a4a, silverfish: 0x9a9a8a, endermite: 0x8a5ab8,
    slime: 0x5ac85a, enderman: 0x101018, witch: 0x5a3a6a, husk: 0xb0a068, drowned: 0x4a8a7a,
    stray: 0xd8dee4, bogged: 0xb8c0a0, phantom: 0x3a5a7a, vex: 0x9ab8d8, creaking: 0x54402e,
    zombified_piglin: 0xd88a8a, piglin: 0xe8a08a, piglin_brute: 0xe8a08a,
    hoglin: 0xa86a4a, zoglin: 0x7a8a5a, wither_skeleton: 0x242424,
    blaze: 0xe8c02a, ghast: 0xe8e8e8, magma_cube: 0xe8641a,
    guardian: 0x5a8a6a, elder_guardian: 0x8a8a9a, shulker: 0x8a5a9a,
    vindicator: 0x3a5a3a, evoker: 0xd8d8c8, pillager: 0x5a5a4a, ravager: 0x4a4a52,
    wither: 0x1c1c1c, warden: 0x182a3a,
    cow: 0x8c664d, pig: 0xe69ea8, sheep: 0xebebeb, chicken: 0xf2e5bf, /* F4 农场一家(体色锚) */
  };
  function debrisColor(type) {
    return MOB_DEBRIS[type] || 0x8a8f98;
  }

  /* 受击: 扣血/闪白/踉跄(MobCore) + 击退(地面走台阶规则, 飞行直线+clamp)
     血量归零进入死亡流程并播死亡音; freshDead 供调用方只结算一次 */
  function hit(m, dmg, kdx, kdz, kpow) {
    kpow = kpow || 0;
    const r = MobCore.hitState(m, dmg);
    const l = Math.hypot(kdx, kdz) || 1;
    if (m.cfg.fly) {
      m.pos.x += kdx/l*0.9*kpow;
      m.pos.z += kdz/l*0.9*kpow;
      if (m.clamp) m.clamp(m);
    } else {
      MobCore.stepMove(m, kdx/l*0.9*kpow, 0, groundTop);
      MobCore.stepMove(m, 0, kdz/l*0.9*kpow, groundTop);
    }
    if (r.freshDead) {
      sfx('death');
      for (const cb of deathCbs) cb(m);
    } // 存活→死亡瞬间: 击杀事件只报实体, 死因解释/掉落掷骰归消费方
    return r;
  }

  /* ---------- 击杀事件(引擎只报不解释): onDeath(cb) 可注册多个回调,
     hit() 判定存活→死亡的瞬间每个回调恰调一次(参数=怪物实体 m —
     此时 m.dead 已置位, 位置/类型等字段仍可读); 死因/掉落归模式层
     (巢穴掉落掷骰走 drops.rollDrops, 引擎不掺和); clear() 清场一并
     解除注册(切模式页时旧模式的闭包不残留到新场景) ---------- */
  const deathCbs = [];
  function onDeath(cb) {
    deathCbs.push(cb);
  }

  /* 圆域查询: 爆炸波及/坦克碾压共用; y+maxDy 给高度差过滤(可选) */
  function near(x, z, r, y, maxDy) {
    const out = [];
    for (const m of mobList) {
      if (m.dead || m.gone) continue;
      if (Math.hypot(m.pos.x-x, m.pos.z-z) > r) continue;
      if (y !== undefined && maxDy !== undefined && Math.abs(m.pos.y - y) > maxDy) continue;
      out.push(m);
    }
    return out;
  }

  /* 可部署清单=可战斗部署(排除 mix 伪类型与 passive 牧场动物, F4 二期设计稿 §4.2):
     竞技场 MIX_POOL 与坦克演习场 RANGE_MOB_KEYS 都读本清单——农场一家零改动自然排除;
     "什么算可战斗部署"的过滤归引擎, 调用方不再各自判 */
  function spawnable() {
    return Object.keys(MOB_TYPES).filter((k) => k !== 'mix' && !MOB_TYPES[k].passive);
  }

  /* 谱系分组查询: 面板分组渲染的唯一入口(竞技场/演习场共用, 与 spawnable 同地位)。
     按主族(family 首位)归组 — 一怪只归一桶(多族怪的展示位由主族决定);
     无兜底族(独行侠已撤, 每怪必归种族): 真出现无 family 怪时以键名兜底不静默丢桶;
     空桶跳过; 顺序按 FAMILIES.order, 未注册键排最后 */
  function families() {
    const buckets = {};
    for (const k of spawnable()) {
      const fam = (MOB_TYPES[k].family || [])[0] || 'other';
      (buckets[fam] = buckets[fam] || []).push(k);
    }
    const meta = (f) => (typeof FAMILIES !== 'undefined' && FAMILIES[f]) || {name: f, order: 99};
    return Object.keys(buckets)
        .map((f) => ({key: f, name: meta(f).name, members: buckets[f]}))
        .sort((a, b) => meta(a.key).order - meta(b.key).order);
  }

  /* 清场: 回收全部(含挂件与名牌)并冲刷批次(菜单/切模式页可用);
     死亡回调一并解除(与实例数组同生命周期, 旧模式闭包不残留) */
  function clear() {
    for (const m of mobList) dispose(m);
    mobList.length = 0;
    deathCbs.length = 0;
    render();
  }

  /* ---------- 怪物像素头像 (16×16 手绘 → 64×64 dataURL, 面板按钮用) ---------- */
  const mobFaceCache = {};
  function face(type) {
    if (mobFaceCache[type]) return mobFaceCache[type];
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    const px = (x, y, w, h, col)=>{
      g.fillStyle = col; g.fillRect(x, y, w, h, col);
    };
    const mottle = (col, pts)=>pts.forEach(([x, y])=>px(x, y, 1, 1, col));
    /* 标准怪脸: 底色+斑驳+黑眼+嘴(僵尸/骷髅系换色复用, 特征可随后补画) */
    const stdFace = (bg, mot, eye, mouth) => {
      px(0, 0, 16, 16, bg);
      mottle(mot, [[2, 1], [6, 3], [11, 2], [14, 5], [3, 9], [8, 8], [12, 12], [5, 14], [1, 12], [9, 14], [13, 8]]);
      px(3, 5, 3, 3, eye); px(10, 5, 3, 3, eye);
      if (mouth) px(5, 12, 6, 2, mouth);
    };
    switch (type) {
      case 'zombie': {
        px(0, 0, 16, 16, '#5e9440');
        mottle('#4a7a33', [[2, 1], [6, 3], [11, 2], [14, 5], [3, 9], [8, 8],
          [12, 12], [5, 14], [1, 12], [9, 14], [13, 8]]);
        px(3, 5, 3, 3, '#14200f'); px(10, 5, 3, 3, '#14200f'); // 黑眼窝
        px(7, 8, 2, 2, '#3d6b2e'); // 鼻影
        px(5, 12, 6, 2, '#1c2b16'); // 嘴
        break;
      }
      case 'skeleton': {
        px(0, 0, 16, 16, '#d8d8d2');
        mottle('#b8b8b0', [[3, 1], [9, 2], [13, 4], [1, 7], [6, 6], [11, 9], [4, 14], [13, 12], [8, 15]]);
        px(3, 5, 3, 3, '#1a1a1a'); px(10, 5, 3, 3, '#1a1a1a'); // 深眼窝
        px(7, 8, 2, 2, '#8a8a84'); // 鼻孔
        px(4, 11, 8, 3, '#b8b8b0'); // 牙床
        for (let x=5; x<=11; x+=2) px(x, 11, 1, 3, '#1a1a1a'); // 牙缝
        break;
      }
      case 'creeper': {
        px(0, 0, 16, 16, '#4fae4f');
        mottle('#3d8f3d', [[1, 2], [5, 1], [9, 3], [13, 2], [3, 7], [11, 6],
          [2, 12], [7, 14], [12, 11], [14, 14], [6, 9]]);
        px(3, 5, 3, 3, '#101510'); px(10, 5, 3, 3, '#101510'); // 眼
        px(6, 9, 4, 2, '#101510'); // 嘴(上)
        px(5, 11, 2, 3, '#101510'); px(9, 11, 2, 3, '#101510'); // 嘴(垂腿)
        break;
      }
      case 'golem': {
        px(0, 0, 16, 16, '#cdd0d8');
        mottle('#aab0bb', [[2, 2], [7, 1], [12, 3], [1, 9], [13, 10], [4, 13], [10, 14], [14, 2]]);
        px(2, 1, 2, 2, '#3d8f3d'); px(3, 1, 1, 1, '#5e9440'); // 蔓藤
        px(3, 5, 3, 2, '#2a2e36'); px(10, 5, 3, 2, '#2a2e36'); // 眼窝
        px(4, 5, 1, 2, '#ff2a1a'); px(11, 5, 1, 2, '#ff2a1a'); // 红瞳
        px(7, 6, 2, 5, '#555a63'); // 长鼻
        px(5, 13, 6, 1, '#555a63'); // 嘴
        break;
      }
      case 'dragon': {
        px(0, 0, 16, 16, '#16161f');
        mottle('#262633', [[2, 3], [6, 2], [10, 4], [13, 7], [1, 10], [5, 12], [9, 13], [14, 11]]);
        px(2, 0, 2, 3, '#3a2055'); px(12, 0, 2, 3, '#3a2055'); // 双角
        px(7, 0, 2, 2, '#3a2055');
        px(3, 5, 3, 2, '#d06bff'); px(10, 5, 3, 2, '#d06bff'); // 紫瞳
        px(4, 5, 1, 2, '#e8a4ff'); px(11, 5, 1, 2, '#e8a4ff');
        px(5, 9, 6, 3, '#262633'); // 吻部
        px(6, 10, 1, 1, '#0a0a10'); px(9, 10, 1, 1, '#0a0a10'); // 鼻孔
        px(5, 12, 6, 1, '#0a0a10'); // 颚线
        break;
      }
      case 'mix': { // 四象限:僵尸/骷髅/苦力怕/铁傀儡(竞技场编队按钮)
        px(0, 0, 8, 8, '#5e9440'); px(1, 3, 2, 2, '#14200f'); px(5, 3, 2, 2, '#14200f');
        px(8, 0, 8, 8, '#d8d8d2'); px(9, 3, 2, 2, '#1a1a1a'); px(13, 3, 2, 2, '#1a1a1a');
        px(0, 8, 8, 8, '#4fae4f'); px(1, 10, 2, 2, '#101510'); px(5, 10, 2, 2, '#101510'); px(3, 12, 2, 2, '#101510');
        px(8, 8, 8, 8, '#cdd0d8'); px(9, 11, 2, 1, '#ff2a1a'); px(13, 11, 2, 1, '#ff2a1a'); px(11, 12, 1, 2, '#555a63');
        break;
      }
      /* ---- 主世界杂兵 ---- */
      case 'spider': {
        stdFace('#2a2226', '#1c171a', null, null);
        px(2, 4, 2, 2, '#d83a2a'); px(7, 3, 2, 2, '#d83a2a'); px(12, 4, 2, 2, '#d83a2a'); // 多眼
        px(4, 7, 2, 2, '#8a1e12'); px(10, 7, 2, 2, '#8a1e12');
        px(5, 12, 6, 1, '#1c171a'); // 螯牙
        px(6, 13, 1, 2, '#d8d8d2'); px(9, 13, 1, 2, '#d8d8d2');
        break;
      }
      case 'cave_spider': {
        stdFace('#1a3a4a', '#122833', null, null);
        px(3, 4, 3, 2, '#d83a2a'); px(10, 4, 3, 2, '#d83a2a');
        px(4, 7, 2, 2, '#8a1e12'); px(10, 7, 2, 2, '#8a1e12');
        px(5, 12, 6, 1, '#122833');
        break;
      }
      case 'silverfish': {
        stdFace('#9a9a8a', '#7a7a6a', null, null);
        px(3, 5, 2, 2, '#2a2a22'); px(11, 5, 2, 2, '#2a2a22');
        px(6, 8, 4, 3, '#8a8a7a'); // 头盾
        px(2, 2, 2, 1, '#6a6a5a'); px(13, 2, 2, 1, '#6a6a5a'); // 触须
        break;
      }
      case 'endermite': {
        stdFace('#8a5ab8', '#6a3a95', null, null);
        px(3, 5, 2, 2, '#d06bff'); px(11, 5, 2, 2, '#d06bff');
        px(6, 9, 4, 3, '#7a4aa5');
        break;
      }
      case 'slime': {
        px(0, 0, 16, 16, '#5ac85a');
        mottle('#4ab04a', [[2, 2], [6, 1], [11, 3], [13, 6], [3, 13], [8, 14]]);
        px(3, 5, 3, 3, '#143a14'); px(10, 5, 3, 3, '#143a14');
        px(5, 11, 6, 2, '#143a14'); // 嘴
        break;
      }
      case 'magma_cube': {
        px(0, 0, 16, 16, '#3a2a24');
        mottle('#2a1e18', [[2, 2], [6, 1], [11, 3], [13, 6], [3, 13], [8, 14]]);
        mottle('#e8641a', [[5, 4], [10, 9], [7, 12], [12, 13]]); // 岩浆裂纹
        px(3, 5, 3, 3, '#ffd23c'); px(10, 5, 3, 3, '#ffd23c'); // 炽眼
        break;
      }
      case 'enderman': {
        px(0, 0, 16, 16, '#101018');
        mottle('#0a0a12', [[2, 1], [6, 3], [11, 2], [14, 5], [3, 9], [8, 8], [12, 12], [5, 14]]);
        px(2, 6, 12, 2, '#d06bff'); // 横紫瞳
        px(4, 6, 2, 2, '#f0c8ff'); px(10, 6, 2, 2, '#f0c8ff');
        break;
      }
      case 'witch': {
        px(0, 0, 16, 16, '#8a7a8a');
        px(0, 0, 16, 4, '#2a1c30'); px(4, 4, 8, 2, '#2a1c30'); // 尖帽
        px(5, 0, 6, 2, '#3a2a44');
        px(3, 6, 3, 2, '#d84a4a'); px(10, 6, 3, 2, '#d84a4a'); // 红眼
        px(6, 9, 4, 3, '#6a9a4a'); // 绿鼻
        px(4, 13, 8, 1, '#4a3a50');
        break;
      }
      case 'husk': {
        stdFace('#b0a068', '#96874f', '#3a3220', '#4a3f28');
        px(5, 12, 6, 2, '#6a5a3a');
        break;
      }
      case 'drowned': {
        stdFace('#4a8a7a', '#3a6a5e', '#0a2a28', '#2a4a44');
        px(2, 2, 3, 1, '#7ab8aa'); px(11, 2, 3, 1, '#7ab8aa'); // 额头海草
        break;
      }
      case 'stray': {
        stdFace('#d8dee4', '#b8c2cc', '#1a2a38', null);
        for (let x=5; x<=11; x+=2) px(x, 11, 1, 3, '#8a9aa8'); // 牙
        px(2, 2, 3, 2, '#eef4f8'); px(11, 2, 3, 2, '#eef4f8'); // 兜帽白边
        break;
      }
      case 'bogged': {
        stdFace('#b8c0a0', '#8a9a6a', '#2a3820', null);
        mottle('#6a8a4a', [[1, 3], [14, 4], [6, 13]]); // 苔藓
        for (let x=5; x<=11; x+=2) px(x, 11, 1, 3, '#5a6a40');
        break;
      }
      case 'phantom': {
        px(0, 0, 16, 16, '#3a5a7a');
        mottle('#2c4460', [[2, 2], [6, 4], [11, 2], [13, 8], [4, 12], [9, 13]]);
        px(3, 5, 3, 2, '#9ad83c'); px(10, 5, 3, 2, '#9ad83c'); // 黄绿眼
        px(6, 10, 4, 2, '#2c4460'); // 吻
        px(7, 11, 1, 1, '#141e2c'); px(9, 11, 1, 1, '#141e2c');
        break;
      }
      case 'vex': {
        px(0, 0, 16, 16, '#b8cfe8');
        mottle('#9ab8d8', [[2, 1], [7, 3], [12, 2], [4, 9], [10, 12]]);
        px(3, 5, 3, 2, '#d83a2a'); px(10, 5, 3, 2, '#d83a2a');
        px(6, 10, 4, 1, '#7a98b8');
        break;
      }
      case 'creaking': {
        stdFace('#54402e', '#483824', '#ff8a2a', null);
        mottle('#64503a', [[3, 3], [12, 4], [7, 8], [5, 13]]); // 木纹节
        px(6, 11, 4, 1, '#2a1f12');
        break;
      }
      /* ---- 下界 ---- */
      case 'zombified_piglin': {
        stdFace('#d88a8a', '#b86a6a', '#2a1a1a', null);
        for (let x=4; x<=12; x+=2) px(x, 12, 1, 2, '#f0e8d8'); // 龇牙
        px(6, 8, 4, 2, '#a85a5a'); // 猪鼻
        break;
      }
      case 'piglin': {
        stdFace('#e8a08a', '#cc8068', '#2a1a1a', null);
        px(6, 8, 4, 2, '#c87860');
        mottle('#d8b028', [[1, 13], [14, 13]]); // 金饰
        break;
      }
      case 'piglin_brute': {
        stdFace('#e8a08a', '#cc8068', '#2a1a1a', null);
        px(2, 3, 4, 1, '#5a3a2a'); px(10, 3, 4, 1, '#5a3a2a'); // 怒眉
        px(6, 8, 4, 2, '#c87860');
        px(3, 12, 2, 2, '#f0e8d8'); px(11, 12, 2, 2, '#f0e8d8'); // 龇牙
        break;
      }
      case 'hoglin': {
        stdFace('#a86a4a', '#8a563a', '#2a1a14', null);
        px(4, 12, 2, 3, '#f0e8d8'); px(10, 12, 2, 3, '#f0e8d8'); // 獠牙
        px(6, 9, 4, 3, '#8a563a'); // 猪吻
        px(7, 10, 1, 1, '#3a2418'); px(9, 10, 1, 1, '#3a2418');
        break;
      }
      case 'zoglin': {
        stdFace('#7a8a5a', '#5a6a40', '#2a3220', null);
        px(4, 12, 2, 3, '#f0e8d8'); px(10, 12, 2, 3, '#f0e8d8');
        px(6, 9, 4, 3, '#5a6a40');
        mottle('#4a5a34', [[1, 2], [14, 2], [8, 3]]); // 腐斑
        break;
      }
      case 'wither_skeleton': {
        stdFace('#242424', '#1a1a1a', '#9a9a9a', null);
        px(4, 11, 8, 3, '#1a1a1a');
        for (let x=5; x<=11; x+=2) px(x, 11, 1, 3, '#9a9a9a'); // 白牙
        break;
      }
      case 'blaze': {
        px(0, 0, 16, 16, '#e8c02a');
        mottle('#d8a81a', [[2, 1], [6, 3], [11, 2], [14, 5], [3, 9], [8, 8], [12, 12], [5, 14]]);
        px(3, 5, 3, 3, '#3a2a10'); px(10, 5, 3, 3, '#3a2a10'); // 烟眼
        mottle('#ffd23c', [[7, 8], [8, 9], [7, 10]]); // 火纹
        break;
      }
      case 'ghast': {
        px(0, 0, 16, 16, '#e8e8e8');
        mottle('#d8d8d4', [[2, 2], [6, 1], [11, 3], [13, 8], [4, 13], [9, 14]]);
        px(2, 4, 3, 4, '#1a1a1a'); px(11, 4, 3, 4, '#1a1a1a'); // 垂泪眼
        px(5, 11, 6, 3, '#1a1a1a'); // 张嘴
        break;
      }
      /* ---- 海洋与末地 ---- */
      case 'guardian': {
        px(0, 0, 16, 16, '#5a8a6a');
        mottle('#4a7a5a', [[2, 1], [6, 3], [11, 2], [14, 6], [3, 12], [9, 13]]);
        px(4, 5, 8, 6, '#d8d8d0'); // 独眼白底
        px(6, 7, 4, 3, '#d82a2a'); // 红瞳
        px(1, 8, 2, 1, '#8a6a4a'); px(13, 8, 2, 1, '#8a6a4a'); // 侧刺
        break;
      }
      case 'elder_guardian': {
        px(0, 0, 16, 16, '#8a8a9a');
        mottle('#6a6a7a', [[2, 1], [6, 3], [11, 2], [14, 6], [3, 12], [9, 13]]);
        px(4, 5, 8, 6, '#d8d8d0');
        px(6, 7, 4, 3, '#d82a2a');
        px(0, 8, 3, 1, '#5a5a6a'); px(13, 8, 3, 1, '#5a5a6a');
        px(7, 1, 2, 2, '#5a5a6a'); // 头顶刺
        break;
      }
      case 'shulker': {
        px(0, 0, 16, 16, '#8a5a9a');
        mottle('#6a3f7a', [[2, 1], [6, 2], [11, 1], [13, 5], [3, 8], [8, 6]]);
        px(2, 10, 12, 6, '#6a3f7a'); // 下壳深色
        px(5, 9, 6, 3, '#d8b0ff'); // 内芯
        px(5, 10, 1, 1, '#2a1a30'); px(10, 10, 1, 1, '#2a1a30');
        break;
      }
      /* ---- 灾厄村民 ---- */
      case 'vindicator': {
        stdFace('#9aa08a', '#7a8068', '#2a2a22', null);
        px(6, 7, 4, 4, '#7a8068'); // 长鼻
        px(5, 13, 6, 1, '#3a3a30');
        px(1, 0, 3, 2, '#3a3a30'); px(12, 0, 3, 2, '#3a3a30'); // 怒眉
        break;
      }
      case 'evoker': {
        stdFace('#9aa08a', '#7a8068', '#3a3a30', null);
        px(4, 0, 8, 3, '#d8d8c8'); // 白帽
        px(6, 7, 4, 3, '#7a8068');
        mottle('#ffd23c', [[0, 4], [15, 4]]); // 金饰眉心
        break;
      }
      case 'pillager': {
        stdFace('#9aa08a', '#7a8068', '#2a2a22', null);
        px(0, 0, 16, 4, '#3a3a30'); px(3, 4, 10, 2, '#3a3a30'); // 头巾
        px(6, 7, 4, 4, '#7a8068');
        px(5, 13, 6, 1, '#3a3a30');
        break;
      }
      case 'ravager': {
        stdFace('#4a4a52', '#3a3a42', '#d8b028', null);
        px(2, 3, 4, 1, '#2c2c33'); px(10, 3, 4, 1, '#2c2c33'); // 怒眉
        px(5, 9, 6, 4, '#3a3a42'); // 方颚
        px(4, 12, 2, 3, '#f0e8d8'); px(10, 12, 2, 3, '#f0e8d8'); // 獠牙
        break;
      }
      /* ---- 农场一家(F4): 温和无害脸(牛角/猪鼻/羊绒/鸡冠各带一个辨识件) ---- */
      case 'cow': {
        stdFace('#8c664d', '#6b4f3a', '#1c1410', null);
        px(3, 1, 2, 2, '#f0e8d8'); px(11, 1, 2, 2, '#f0e8d8'); // 小弯角
        px(5, 9, 6, 4, '#e8dcc8'); // 白鼻梁
        px(6, 10, 1, 2, '#3a2a20'); px(9, 10, 1, 2, '#3a2a20'); // 鼻孔
        break;
      }
      case 'pig': {
        stdFace('#e69ea8', '#d48a94', '#2a1a1a', null);
        px(5, 9, 6, 4, '#d97b88'); // 猪鼻
        px(6, 10, 1, 2, '#8a4a56'); px(9, 10, 1, 2, '#8a4a56'); // 鼻孔
        break;
      }
      case 'sheep': {
        stdFace('#ece7db', '#d8d2c4', '#2a1a1a', null);
        px(0, 0, 16, 3, '#faf8f4'); // 绒毛刘海
        px(6, 9, 4, 3, '#d8b8a8'); // 粉鼻
        break;
      }
      case 'chicken': {
        stdFace('#f2e5bf', '#e0d0a0', '#2a1a1a', null);
        px(0, 0, 16, 3, '#d82a2a'); // 鸡冠
        px(6, 9, 4, 3, '#e8a030'); // 黄喙
        px(6, 12, 4, 2, '#d82a2a'); // 红髯
        break;
      }
      /* ---- Boss ---- */
      case 'wither': {
        px(0, 0, 16, 16, '#1c1c1c');
        mottle('#2a2a2a', [[2, 1], [6, 3], [11, 2], [14, 5], [3, 9], [8, 8], [12, 12], [5, 14]]);
        px(3, 5, 3, 2, '#d8d8d2'); px(10, 5, 3, 2, '#d8d8d2'); // 白眼
        px(6, 8, 4, 3, '#d8d8d2'); // 骨脸纹
        px(5, 11, 6, 1, '#0d0d0d');
        break;
      }
      case 'warden': {
        px(0, 0, 16, 16, '#182a3a');
        mottle('#0f1d29', [[2, 1], [6, 3], [11, 2], [14, 5], [3, 9], [12, 12], [5, 14]]);
        px(4, 10, 2, 5, '#4ae0c8'); px(10, 10, 2, 5, '#4ae0c8'); // 胸口光纹(无眼)
        px(5, 2, 2, 3, '#4ae0c8'); px(9, 2, 2, 3, '#4ae0c8'); // 头顶触角光
        px(7, 7, 2, 4, '#0f1d29'); // 心口暗纹
        break;
      }
      default: { // 未画头像的怪种: 显眼问号 — 新增怪漏配 face 不再静默空白
        px(0, 0, 16, 16, '#4a4f58');
        px(3, 2, 10, 2, '#e8ecf2'); px(3, 5, 10, 2, '#e8ecf2'); px(3, 8, 6, 2, '#e8ecf2');
        px(7, 10, 2, 3, '#e8ecf2'); px(7, 14, 2, 2, '#ff5a30');
        break;
      }
    }
    const big = document.createElement('canvas');
    big.width = big.height = 64;
    const bg = big.getContext('2d');
    bg.imageSmoothingEnabled = false;
    bg.drawImage(c, 0, 0, 64, 64);
    mobFaceCache[type] = big.toDataURL();
    return mobFaceCache[type];
  }

  function hasSlot(type, name) {
    return !!MOB_RIG[type].slots[name];
  }

  /* 注册表一致性自检: MOB_TYPES(非伪类型) ↔ MOB_RIG — 漏配 RIG 的怪 render 会
     崩帧, 在加载期就把漏配喊出来(新增怪"改 3 处"里的静默失败变即时报错;
     漏配 face 则由 default 分支画显眼问号兜底) */
  (function() {
    if (typeof MOB_TYPES === 'undefined' || typeof console === 'undefined') return;
    const missing = Object.keys(MOB_TYPES).filter((k) => k!=='mix' && !MOB_RIG[k]);
    if (missing.length) console.warn('[Mobs] MOB_TYPES 有而 MOB_RIG 缺(渲染会崩):', missing.join(','));
    /* 谱系自检: family 引用未注册键 / proto 不在合法值表 / mix 带谱系 —
       新怪加行时漏声明或拼错键在这里即报(与 RIG 自检同一道理) */
    if (typeof FAMILIES === 'undefined' || typeof PROTOS === 'undefined') return;
    const famKeys = Object.keys(FAMILIES);
    for (const k of Object.keys(MOB_TYPES)) {
      const def = MOB_TYPES[k];
      if (k === 'mix') {
        if (def.family || def.proto) console.warn('[Mobs] mix 伪类型不应带谱系字段');
        continue;
      }
      if (!PROTOS.includes(def.proto)) {
        console.warn('[Mobs] ' + k + ' 的 proto 非法(合法值见 config.js PROTOS):', def.proto);
      }
      for (const f of (def.family || [])) {
        if (!famKeys.includes(f)) console.warn('[Mobs] ' + k + ' 引用未注册族:', f);
      }
    }
  })();

  return {types: MOB_TYPES, spawn, update, render, hit, near, clear, onDeath,
    list: ()=>mobList, face, hasSlot, gait, stagger, pulseTint, scaleTo,
    debrisColor, spawnable, families,
    move, shift, setPos, steer, heal, setMaxHp, remove, settle};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Mobs;
