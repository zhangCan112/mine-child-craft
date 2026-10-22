'use strict';
/* ============================================================
   TNT 密室逃生 — 关卡数据 (10 关, 难度 6 岁 → 10 岁)

   约定:
   - 所有关卡居中于 (64,64), 出口一律朝北 (z1 侧), 玩家从南侧出发向北推进
   - 地板顶层 y10, 玩家与引线都在 y11 层活动
   - 水块放在 y11 (不挡人, 火花碰到会灭); 岩浆块放在 y11 (碰到就昏迷)
   - 每关只引入 1~2 个新概念
=========================================================== */

/* ---------- 搭建辅助(方块填充直接走引擎 SceneKit — SceneKit.fill 方言名已退役, 见 GLOSSARY Avoid 名单) ---------- */
function lineZ(x, z1, z2, id) {
  SceneKit.fill(x, 11, z1, x, 11, z2, id);
}
function lineX(z, x1, x2, id) {
  SceneKit.fill(x1, 11, z, x2, 11, z, id);
}
function pillar(x, z, y1, y2, id) {
  SceneKit.fill(x, y1, z, x, y2, z, id);
}

/* 标准密室外壳: 内部尺寸 iw×idh, 墙高 h, 返回边界 */
function mkRoom(cx, cz, iw, idh, h) {
  const x1=cx-(iw>>1)-1; const x2=cx+(iw>>1)+1;
  const z1=cz-(idh>>1)-1; const z2=cz+(idh>>1)+1;
  const top = 11+h;
  SceneKit.fill(x1, 8, z1, x2, 10, z2, 3); // 地板 (y8~10)
  SceneKit.fill(x1, 11, z1, x2, top, z1, 3); SceneKit.fill(x1, 11, z2, x2, top, z2, 3); // 南北墙
  SceneKit.fill(x1, 11, z1, x1, top, z2, 3); SceneKit.fill(x2, 11, z1, x2, top, z2, 3); // 东西墙
  SceneKit.fill(x1, top, z1, x2, top, z2, 3); // 天花板
  for (let x=x1+3; x<x2; x+=4) { // 顶灯
    for (let z=z1+3; z<z2; z+=4) setBlockRaw(x, top, z, 19);
  }
  pillar(x1+1, z1+1, 11, top-1, 13); pillar(x2-1, z1+1, 11, top-1, 13);
  pillar(x1+1, z2-1, 11, top-1, 13); pillar(x2-1, z2-1, 11, top-1, 13);
  return {x1, x2, z1, z2, top};
}

/* 北墙裂纹砖出口 + 出口小屋 (zone 即通关区域) */
function mkExit(b, cx, halfW) {
  const z1=b.z1; const top=b.top;
  SceneKit.fill(cx-halfW-1, 8, z1-4, cx+halfW+1, top, z1-1, 3); // 小屋外壳
  SceneKit.fill(cx-halfW, 11, z1-3, cx+halfW, top-1, z1-1, 0); // 掏空内部
  SceneKit.fill(cx-halfW, 11, z1, cx+halfW, 13, z1, B_CRACK); // 裂纹砖出口墙
  setBlockRaw(cx, top, z1-2, 19);
  return {x1: cx-halfW, y1: 11, z1: z1-3, x2: cx+halfW, y2: top-1, z2: z1-1};
}

/* 北墙铁门 + 门后走廊 (门 cells 由关卡数据登记给压力板联动) */
function mkDoorExit(b, cx, halfW) {
  const z1=b.z1; const top=b.top;
  SceneKit.fill(cx-halfW-1, 8, z1-4, cx+halfW+1, top, z1-1, 3);
  SceneKit.fill(cx-halfW, 11, z1-3, cx+halfW, top-1, z1-1, 0);
  SceneKit.fill(cx-halfW, 11, z1, cx+halfW, 13, z1, B_DOOR);
  setBlockRaw(cx, top, z1-2, 19);
  return {x1: cx-halfW, y1: 11, z1: z1-3, x2: cx+halfW, y2: top-1, z2: z1-1};
}
function doorCells(cx, halfW, z) {
  const cells=[];
  for (let x=cx-halfW; x<=cx+halfW; x++) {
    for (let y=11; y<=13; y++) cells.push({x, y, z});
  }
  return cells;
}

/* ============================================================
   关卡
============================================================ */
const TNT_LEVELS = [

  /* ---------- L1 小木屋 · 第一次爆炸 (6岁- 教学) ----------
   预放 TNT 贴出口墙, 捡 6 段引线铺直线, F 点火快跑。
   开场 1.2 秒自动演示: 东侧预铺引线自己烧过去引爆演示 TNT。 */
  {
    name: '第一次爆炸', par: 90,
    spawn: {x: 64, z: 67, yaw: 0},
    tnts: [{x: 64, y: 11, z: 60}, {x: 67, y: 11, z: 63, demo: true}],
    pickups: [{x: 60, y: 11, z: 67, kind: 'fuse', n: 4}, {x: 68, y: 11, z: 67, kind: 'fuse', n: 4}],
    demo: {t: 1.2, from: {x: 67, y: 11, z: 65}},
    build() {
      const b = mkRoom(64, 64, 9, 9, 5);
      this.exit = mkExit(b, 64, 2);
      pillar(62, 66, 11, 14, 5); pillar(66, 66, 11, 14, 5); // 木柱装饰
      SceneKit.fill(62, 11, 66, 62, 12, 66, 6); SceneKit.fill(66, 11, 66, 66, 12, 66, 6);
      lineZ(67, 64, 65, B_FUSE); // 演示引线
    },
  },

  /* ---------- L2 石头屋 · 绕点路 (6岁) ----------
   引线卷分散两个角落, 需绕房间收集; 铺 6 格直线。 */
  {
    name: '绕点路', par: 120,
    spawn: {x: 64, z: 68, yaw: 0},
    tnts: [{x: 64, y: 11, z: 59}],
    pickups: [{x: 59, y: 11, z: 68, kind: 'fuse', n: 3}, {x: 69, y: 11, z: 68, kind: 'fuse', n: 3}],
    build() {
      const b = mkRoom(64, 64, 11, 11, 5);
      this.exit = mkExit(b, 64, 2);
      pillar(59, 64, 11, 14, 14); pillar(69, 64, 11, 14, 14); // 苔石柱
      SceneKit.fill(60, 11, 62, 61, 12, 63, 6); SceneKit.fill(67, 11, 62, 68, 12, 63, 6); // 木箱堆 (可炸碎)
      SceneKit.fill(59, 11, 60, 60, 11, 61, 8); SceneKit.fill(68, 11, 60, 69, 11, 61, 8); // 沙堆
    },
  },

  /* ---------- L3 双室 · 两道门 (6-7岁) ----------
   内墙把房间一分为二, 每道裂纹门各配一个 TNT, 各连各的线。 */
  {
    name: '两道门', par: 150,
    spawn: {x: 64, z: 69, yaw: 0},
    tnts: [{x: 64, y: 11, z: 65}, {x: 64, y: 11, z: 58}],
    pickups: [
      {x: 58, y: 11, z: 69, kind: 'fuse', n: 3}, {x: 70, y: 11, z: 69, kind: 'fuse', n: 2},
      {x: 58, y: 11, z: 59, kind: 'fuse', n: 3}, {x: 70, y: 11, z: 59, kind: 'fuse', n: 2},
    ],
    build() {
      const b = mkRoom(64, 64, 15, 15, 5);
      this.exit = mkExit(b, 64, 2);
      SceneKit.fill(b.x1+1, 11, 64, b.x2-1, b.top-1, 64, 3); // 内墙
      SceneKit.fill(63, 11, 64, 65, 13, 64, B_CRACK); // 内墙裂纹门
      SceneKit.fill(59, 10, 67, 69, 10, 71, 16); // 南室红地毯
      SceneKit.fill(59, 10, 57, 69, 10, 63, 15); // 北室蓝地毯
    },
  },

  /* ---------- L4 矿井 · 岩浆与链爆 (7-8岁) ----------
   岩浆带横穿, 只能走红毯缺口; 两颗 TNT 相距 3 格, 点一颗链爆两颗。 */
  {
    name: '岩浆与链爆', par: 180,
    spawn: {x: 64, z: 69, yaw: 0},
    tnts: [{x: 64, y: 11, z: 60}, {x: 64, y: 11, z: 57}],
    pickups: [{x: 58, y: 11, z: 69, kind: 'fuse', n: 3}, {x: 70, y: 11, z: 69, kind: 'fuse', n: 3}],
    build() {
      const b = mkRoom(64, 64, 15, 15, 6);
      this.exit = mkExit(b, 64, 2);
      SceneKit.fill(57, 11, 64, 71, 11, 65, B_LAVA); // 岩浆带
      SceneKit.fill(63, 11, 64, 65, 11, 65, 0); // 红毯缺口 (3宽)
      SceneKit.fill(63, 10, 64, 65, 10, 65, 16);
      pillar(58, 62, 11, 15, 12); pillar(70, 62, 11, 15, 12); // 金属矿柱
      pillar(58, 68, 11, 15, 12); pillar(70, 68, 11, 15, 12);
    },
  },

  /* ---------- L5 深渊 · 独木桥 (7-8岁) ----------
   中央大深渊只有一条 2 宽石桥; 引线卷在对岸, 3 连链爆。 */
  {
    name: '独木桥', par: 180,
    spawn: {x: 64, z: 57, yaw: 0},
    tnts: [{x: 64, y: 11, z: 56}, {x: 64, y: 11, z: 59}, {x: 64, y: 11, z: 62}],
    pickups: [{x: 58, y: 11, z: 69, kind: 'fuse', n: 3}, {x: 70, y: 11, z: 69, kind: 'fuse', n: 3}],
    build() {
      const b = mkRoom(64, 64, 17, 17, 6);
      this.exit = mkExit(b, 64, 2);
      SceneKit.fill(58, 8, 59, 70, 10, 67, 0); // 深渊 (直通底部)
      SceneKit.fill(63, 10, 59, 64, 10, 67, 3); // 石桥
      SceneKit.fill(62, 10, 58, 65, 10, 58, 17); SceneKit.fill(62, 10, 68, 65, 10, 68, 17); // 桥头石英标记
    },
  },

  /* ---------- L6 转辙房 · 放对位置 (8岁) ----------
   转辙器决定火花走向西(奖励)还是东(出口); 玩家第一次自己摆 TNT,
   石英地砖标记唯一正确位置。 */
  {
    name: '放对位置', par: 240,
    spawn: {x: 64, z: 68, yaw: 0},
    tnts: [{x: 58, y: 11, z: 61}], // 奖励 TNT (预放)
    switches: [{x: 64, y: 11, z: 61, dir: 1}], // 初始朝西
    pickups: [
      {x: 58, y: 11, z: 68, kind: 'fuse', n: 3}, {x: 70, y: 11, z: 68, kind: 'fuse', n: 3},
      {x: 53, y: 11, z: 60, kind: 'fuse', n: 6}, {x: 53, y: 11, z: 62, kind: 'tnt', n: 2},
    ],
    build() {
      const b = mkRoom(64, 64, 17, 17, 6);
      this.exit = mkExit(b, 64, 2);
      setBlockRaw(64, 10, 56, 17); // TNT 摆位标记
      SceneKit.fill(64, 10, 62, 64, 10, 67, 16); // 红色铺线引导
      setBlockRaw(64, 11, 61, B_SWITCH); // 转辙器 (初始朝西)
      lineX(61, 65, 66, B_FUSE); lineZ(66, 57, 60, B_FUSE); // 东支: 出口方向
      SceneKit.fill(64, 11, 57, 65, 11, 57, B_FUSE);
      lineX(61, 59, 63, B_FUSE); // 西支: 奖励方向
      // 西墙奖励壁龛: 裂纹砖 + 补给
      SceneKit.fill(52, 8, 59, 55, b.top, 63, 3);
      SceneKit.fill(53, 11, 60, 54, b.top-1, 62, 0);
      SceneKit.fill(55, 11, 60, 55, 12, 62, B_CRACK); // 2 格高 (TNT 能够到)
      setBlockRaw(53, b.top, 61, 19);
    },
  },

  /* ---------- L7 缺线的地图 (8-9岁) ----------
   引线路径大部分预埋, 但有 3 处缺口; 两个转辙器初始都指向死路,
   观察箭头、补缺、扳对方向。 */
  {
    name: '缺线的地图', par: 240,
    spawn: {x: 64, z: 70, yaw: 0},
    tnts: [{x: 64, y: 11, z: 55}],
    switches: [{x: 64, y: 11, z: 61, dir: 2}, {x: 61, y: 11, z: 66, dir: 3}], // 初始都指向死路
    pickups: [{x: 57, y: 11, z: 71, kind: 'fuse', n: 2}, {x: 71, y: 11, z: 71, kind: 'fuse', n: 2}],
    build() {
      const b = mkRoom(64, 64, 19, 19, 6);
      this.exit = mkExit(b, 64, 2);
      setBlockRaw(64, 11, 61, B_SWITCH);
      setBlockRaw(61, 11, 66, B_SWITCH);
      lineZ(64, 56, 60, B_FUSE); // 北段主干
      lineZ(65, 61, 61, B_FUSE); lineZ(66, 61, 61, B_FUSE); // 死路岔1
      lineZ(64, 62, 62, B_FUSE); // 缺口 (64,11,63)
      lineZ(64, 64, 65, B_FUSE);
      lineX(66, 62, 64, B_FUSE); // 转向西
      lineZ(60, 66, 66, B_FUSE); lineZ(59, 66, 66, B_FUSE); // 死路岔2
      lineZ(61, 67, 70, B_FUSE); // 缺口 (61,11,71)(61,11,72)
      SceneKit.fill(61, 10, 67, 61, 10, 72, 16); // 红色引导
    },
  },

  /* ---------- L8 水渠 · 水火无情 (9岁) ----------
   快引线 (火花 4 格/秒); 水渠横穿, 只能走缺口过线;
   亲眼看火花被水浇灭 (西侧演示引线头)。 */
  {
    name: '水火无情', par: 300, fast: true,
    spawn: {x: 64, z: 70, yaw: 0},
    tnts: [{x: 64, y: 11, z: 55}],
    pickups: [{x: 57, y: 11, z: 69, kind: 'fuse', n: 2}, {x: 71, y: 11, z: 69, kind: 'fuse', n: 2}],
    build() {
      const b = mkRoom(64, 64, 19, 19, 6);
      this.exit = mkExit(b, 64, 2);
      SceneKit.fill(55, 11, 61, 72, 11, 62, B_WATER); // 水渠
      SceneKit.fill(63, 11, 61, 64, 11, 62, 0); // 缺口 (2宽)
      SceneKit.fill(63, 10, 61, 64, 10, 62, 15); // 蓝毯缺口
      lineZ(64, 56, 59, B_FUSE); // 缺口 (64,11,60)
      lineZ(64, 61, 63, B_FUSE); // 缺口 (64,11,64)
      lineZ(64, 65, 69, B_FUSE);
      setBlockRaw(62, 11, 63, B_FUSE); // 演示引线头 (对着水)
    },
  },

  /* ---------- L9 重力机关房 (9-10岁) ----------
   出口是铁门: 轰掉悬空支架 → 重物落下压住压力板 → 铁门开。
   玩家自己踩板门也会开, 但一走开就关 —— 必须用重物。
   快引线 + 水渠。 */
  {
    name: '重力机关', par: 360, fast: true,
    spawn: {x: 64, z: 70, yaw: 0},
    tnts: [],
    switches: [],
    doors: [{plates: [{x: 63, y: 11, z: 59}], cells: doorCells(64, 1, 53)}],
    weights: [{x: 63, y: 13, z: 59}],
    pickups: [{x: 57, y: 11, z: 70, kind: 'fuse', n: 2}, {x: 71, y: 11, z: 70, kind: 'tnt', n: 2}],
    build() {
      const b = mkRoom(64, 64, 21, 21, 7);
      this.exit = mkDoorExit(b, 64, 1);
      SceneKit.fill(55, 11, 66, 72, 11, 67, B_WATER); // 水渠
      SceneKit.fill(63, 11, 66, 65, 11, 67, 0); // 缺口 (3宽)
      SceneKit.fill(63, 10, 66, 65, 10, 67, 15);
      // 机关: 压力板 + 悬空支架 + 重物 + TNT 摆位标记
      setBlockRaw(63, 11, 59, B_PLATE);
      setBlockRaw(63, 12, 59, B_SUPPORT);
      setBlockRaw(63, 13, 59, B_WEIGHT);
      SceneKit.fill(62, 10, 58, 64, 10, 60, 17); // 石英机座
      setBlockRaw(62, 10, 59, 17); // TNT 摆位标记 (62,11,59)
      // 引线: 主干过水渠缺口, 西折终于 TNT 摆位旁
      lineZ(64, 68, 69, B_FUSE); lineZ(64, 66, 67, B_FUSE); // 缺口 (64,11,65)
      lineZ(64, 60, 64, B_FUSE);
      lineX(60, 62, 63, B_FUSE); // 西折支线 → (62,11,60)
    },
  },

  /* ---------- L10 大逃亡 (10岁) ----------
   三室连环: ①炸开内墙裂纹门 ②水渠+补线+自摆 TNT 炸支架开铁门
   ③链爆双 TNT 炸开大出口墙。全部机制联动, 引线刚好够用。 */
  {
    name: '大逃亡', par: 480,
    spawn: {x: 64, z: 73, yaw: 0},
    tnts: [{x: 64, y: 11, z: 69}, {x: 62, y: 11, z: 54}, {x: 65, y: 11, z: 54}],
    doors: [{plates: [{x: 66, y: 11, z: 63}], cells: doorCells(64, 1, 61)}],
    weights: [{x: 66, y: 13, z: 63}],
    pickups: [
      {x: 58, y: 11, z: 73, kind: 'fuse', n: 6},
      {x: 57, y: 11, z: 63, kind: 'fuse', n: 2}, {x: 70, y: 11, z: 63, kind: 'tnt', n: 1},
    ],
    build() {
      const b = mkRoom(64, 64, 23, 23, 7);
      this.exit = mkExit(b, 64, 3); // 大出口墙 x61..67
      SceneKit.fill(b.x1+1, 11, 61, b.x2-1, b.top-1, 61, 3); // 内墙1 (铁门)
      SceneKit.fill(63, 11, 61, 65, 13, 61, B_DOOR); // 铁门
      SceneKit.fill(b.x1+1, 11, 68, b.x2-1, b.top-1, 68, 3); // 内墙2 (裂纹门)
      SceneKit.fill(63, 11, 68, 65, 13, 68, B_CRACK); // 南室裂纹门
      lineZ(64, 70, 70, B_FUSE); // 南室预埋 (玩家向西绕线)
      // 中室: 水渠 + 机关 + 补线
      SceneKit.fill(55, 11, 65, 74, 11, 66, B_WATER);
      SceneKit.fill(63, 11, 65, 65, 11, 66, 0); // 缺口 (3宽)
      setBlockRaw(66, 11, 63, B_PLATE);
      setBlockRaw(66, 12, 63, B_SUPPORT);
      setBlockRaw(66, 13, 63, B_WEIGHT);
      setBlockRaw(64, 10, 62, 17); // TNT 摆位标记 (64,11,62)
      lineZ(64, 63, 63, B_FUSE); lineZ(64, 65, 67, B_FUSE); // 缺口 (64,11,64)
      // 北室: 链爆双 TNT + 缺口
      lineZ(64, 55, 55, B_FUSE); lineX(55, 64, 65, B_FUSE);
      lineZ(64, 57, 60, B_FUSE); // 缺口 (64,11,56)
    },
  },

];
