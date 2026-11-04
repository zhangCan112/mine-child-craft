'use strict';
/* 怪物库 (js/mobs.js) 壳层单测 — node --test (零依赖)
   运行: node --test test/mobs.test.js
   通过 interface 驱动(spawn/update/hit/near/clear/onDeath — 界面即测试面):
   出厂契约(战斗节拍置零)/ 数值 / 受击死亡 / 击杀事件 / 圆域查询 / 尸体回收。
   THREE 以最小桩注入: 加载期只 new 矩阵临时量, 断言不依赖其语义。
   造型档案(票③起 mobs.js 硬依赖): 装载真 kit+46 份声明(与浏览器共享词法
   环境同构 — vm 注入); 测试只走纯逻辑路径(clear 先清表再 render, 批次
   几何/材质的 THREE·document 段不被触达)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/* ---- 造型档案: 真 kit + 声明文件(经典脚本共享词法环境复刻) ---- */
globalThis.MobLookKit = require('../js/mob-look-kit.js');
{
  const lookDir = path.join(__dirname, '..', 'js', 'mob-look');
  const ctx = vm.createContext({MobLookKit: globalThis.MobLookKit});
  for (const f of fs.readdirSync(lookDir).filter((x) => x.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(lookDir, f), 'utf8'), ctx, {filename: f});
  }
}

/* ---- 最小 THREE 桩(链式 no-op: render 的临时量, 不参与断言) ---- */
function mk() {
  return {set() {
    return this;
  }, compose() {
    return this;
  }, multiplyMatrices() {
    return this;
  },
  setFromEuler() {
    return this;
  }, setFromAxisAngle() {
    return this;
  }, fromArray() {
    return this;
  },
  setRGB() {}, setScalar() {
    return this;
  }};
}
globalThis.THREE = {
  Matrix4: function() {
    return mk();
  }, Quaternion: function() {
    return mk();
  },
  Euler: function() {
    return mk();
  },
  Vector3: function(x, y, z) {
    this.x = x || 0; this.y = y || 0; this.z = z || 0;
  },
  Color: function() {
    return mk();
  },
  MeshLambertMaterial: function() {}, DynamicDrawUsage: 1,
  InstancedMesh: function() {
    this.instanceMatrix = {setUsage() {}, needsUpdate: false};
    this.instanceColor = null; this.count = 0; this.frustumCulled = true;
    this.setMatrixAt = () => {}; this.setColorAt = () => {
      this.instanceColor = {needsUpdate: false};
    };
    this.dispose = () => {};
  },
};
globalThis.scene = {add() {}, remove() {}};
const sfxLog = [];
globalThis.sfx = (n) => {
  sfxLog.push(n);
};
globalThis.MobCore = require('../js/mob-core.js');
globalThis.groundTop = () => 11; /* 平地: 出生 y=12, 飞行巡航 y=17 */
globalThis.getBlock = () => 0;
globalThis.isSolid = () => false;
globalThis.MOB_TYPES = {
  zombie: {name: '僵尸', hp: 30, dmg: 5, speed: 2.3, range: 2.1, cd: 1.1, h: 1.9, hitR: 0.55},
  blaze: {name: '烈焰人', hp: 30, dmg: 8, speed: 2.3, range: 15, cd: 2.4, h: 1.8, fly: true, ranged: true, hitR: 0.45},
  hoglin: {name: '疣猪兽', hp: 60, dmg: 9, speed: 2.8, range: 2.6, cd: 1.5, h: 1.4, hitR: 0.7},
  piglin: {name: '猪灵', hp: 24, dmg: 8, speed: 2.7, range: 2.2, cd: 1.1, h: 1.9, hitR: 0.55},
  mix: {name: '混合编队', hp: 0, dmg: 0, speed: 0, range: 0, cd: 0, h: 2},
};

const Mobs = require('../js/mobs.js');

/* ============ 测试 ============ */

test('怪物库: spawn 出厂即战斗就绪 — attackCd/attackT/target 已置零(下界永不攻击的回归钉)', () => {
  Mobs.clear();
  const m = Mobs.spawn('zombie', 10, 10, {});
  assert.strictEqual(m.attackCd, 0, 'attackCd 引擎置零(曾因模式漏初始化 → undefined<=0 恒 false, 怪物永不攻击)');
  assert.strictEqual(m.attackT, 0, 'attackT 引擎置零');
  assert.strictEqual(m.target, null, 'target 引擎置空');
  Mobs.clear();
});

test('怪物库: spawn 数值契约 — hp/maxHp 按表 · hpMult 生效 · 地面贴顶/飞行巡航', () => {
  Mobs.clear();
  const g = Mobs.spawn('zombie', 10, 10, {});
  assert.strictEqual(g.hp, 30); assert.strictEqual(g.maxHp, 30);
  assert.strictEqual(g.pos.y, 12, '地面怪出生在 groundTop+1');
  const b = Mobs.spawn('blaze', 12, 12, {});
  assert.strictEqual(b.pos.y, 18, '飞行怪缺省巡航 = 站立面(groundTop+1)+6');
  const b2 = Mobs.spawn('blaze', 14, 14, {flyY: 15});
  assert.strictEqual(b2.pos.y, 15, 'flyY 覆盖巡航高度');
  const elite = Mobs.spawn('zombie', 16, 16, {hpMult: 2});
  assert.strictEqual(elite.hp, 60); assert.strictEqual(elite.maxHp, 60);
  assert.strictEqual(Mobs.list().length, 4, '实例数组私有, list() 只读可见');
  Mobs.clear();
});

test('怪物库: hit 扣血 → 归零死亡只结算一次 + 死亡音; 尸体血量不再下降', () => {
  Mobs.clear(); sfxLog.length = 0;
  const m = Mobs.spawn('zombie', 10, 10, {});
  let r = Mobs.hit(m, 10, 1, 0, 0.5);
  assert.strictEqual(r.hp, 20); assert.strictEqual(r.freshDead, false);
  assert.strictEqual(sfxLog.length, 0, '未死不播死亡音');
  r = Mobs.hit(m, 25, 1, 0, 0.5);
  assert.strictEqual(r.hp, 0); assert.strictEqual(r.dead, true); assert.strictEqual(r.freshDead, true, '首次归零');
  assert.ok(sfxLog.indexOf('death') >= 0, '死亡音收在怪物库');
  r = Mobs.hit(m, 99, 1, 0, 0.5);
  assert.strictEqual(r.freshDead, false, '补刀不重复结算');
  assert.strictEqual(r.hp, 0, '尸体血量封底');
  Mobs.clear();
});

test('怪物库: onDeath 击杀事件 — 致死一击每个回调恰一次 · 非致死/补刀不回调 · clear 解除注册', () => {
  Mobs.clear();
  let a = 0; let b = 0; let got = null;
  Mobs.onDeath((m) => {
    a++; got = m;
  });
  Mobs.onDeath(() => {
    b++;
  });
  const m = Mobs.spawn('zombie', 10, 10, {});
  Mobs.hit(m, 10, 0, 0, 0);
  assert.strictEqual(a + b, 0, '非致死一击不回调');
  Mobs.hit(m, 99, 0, 0, 0);
  assert.strictEqual(a, 1, '致死一击: 回调 A 恰一次');
  assert.strictEqual(b, 1, '致死一击: 回调 B 恰一次(可注册多个回调)');
  assert.strictEqual(got, m, '参数为死亡的怪物实体(引擎只报事件, 不解释死因)');
  Mobs.hit(m, 99, 0, 0, 0);
  assert.strictEqual(a + b, 2, '补刀不重复回调(只在存活→死亡瞬间触发)');
  Mobs.clear();
  const m2 = Mobs.spawn('zombie', 20, 20, {});
  Mobs.hit(m2, 99, 0, 0, 0);
  assert.strictEqual(a + b, 2, 'clear() 清场一并解除死亡回调(切模式不残留旧闭包)');
  Mobs.clear();
});

test('怪物库: near 圆域查询 — 半径 · 高度门 · 死亡/移除过滤', () => {
  Mobs.clear();
  const a = Mobs.spawn('zombie', 10, 10, {});
  const d = Mobs.spawn('zombie', 30, 30, {});
  Mobs.hit(d, 99, 0, 0, 0); /* 击杀 → dead */
  const out = Mobs.near(10, 10, 3, 12, 2);
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0], a, '近处活怪命中');
  assert.strictEqual(Mobs.near(10, 10, 3, 40, 2).length, 0, '高度差超门控');
  assert.strictEqual(Mobs.near(10, 10, 1).length, 1, '不传高度门时只看半径');
  Mobs.clear();
});

test('怪物库: 死亡时序 — update 推进 deadT, 超时回收(实例数组原地收缩)', () => {
  Mobs.clear();
  const m = Mobs.spawn('zombie', 10, 10, {});
  Mobs.hit(m, 99, 0, 0, 0);
  const before = Mobs.list();
  for (let i=0; i<26; i++) Mobs.update(0.1); /* 2.6s > 2.4s 回收线 */
  assert.strictEqual(Mobs.list().length, 0, '尸体超时回收');
  assert.strictEqual(before.length, 0, 'list() 返回内部引用, 回收立即可见');
  Mobs.clear();
});

test('怪物库: 意图 API — move/shift/setPos/steer/heal/setMaxHp/remove/settle', () => {
  Mobs.clear();
  const m = Mobs.spawn('zombie', 10, 10, {});
  Mobs.move(m, 1.5, 0); /* 平地(stub 恒 11)无高差, 全额步进 */
  assert.ok(Math.abs(m.pos.x - 11.5) < 1e-9, 'move: 地面步进(台阶规则)');
  assert.strictEqual(typeof Mobs.groundUnderAt, 'function',
      'groundUnderAt 导出(候选④: 竞技场列边判据注入消费, 引擎单源)');
  Mobs.shift(m, 0, 2);
  assert.ok(Math.abs(m.pos.z - 12) < 1e-9, 'shift: 无碰撞平移');
  Mobs.setPos(m, 3, 4);
  assert.strictEqual(m.pos.x, 3); assert.strictEqual(m.pos.z, 4, 'setPos: 几何回弹落位');
  Mobs.steer(m, 1.23);
  assert.strictEqual(m.yaw, 1.23, 'steer: 面向');
  Mobs.heal(m, 500);
  assert.strictEqual(m.hp, 30, 'heal: 封顶 maxHp');
  Mobs.hit(m, 10, 0, 0, 0);
  Mobs.setMaxHp(m, 100);
  assert.strictEqual(m.maxHp, 100, 'setMaxHp: 晋升改上限');
  Mobs.heal(m, 20);
  assert.strictEqual(m.hp, 40, 'heal: 新上限内回血');
  Mobs.setMaxHp(m, 10);
  assert.strictEqual(m.hp, 10, 'setMaxHp: 现血超出即截断');
  Mobs.remove(m);
  Mobs.update(0.05);
  assert.strictEqual(Mobs.list().length, 0, 'remove: gone → 下帧走引擎回收');
  const f = Mobs.spawn('blaze', 20, 20, {});
  f.pos.y = 12; /* 模拟被震落到地面 */
  Mobs.settle(f, 1);
  assert.ok(f.pos.y > 12, 'settle: 飞行单位回巡航高度(flyHome=18)');
  Mobs.clear();
});

test('怪物库: settle 贴地收敛 — 天上落回/上 1 格爬/下坎落 · move/setPos 内部序自带贴地(位移后必贴地契约)', () => {
  /* 2026-11-04 候选②契约翻转: 「位移后必须 settle」配对纪律收回引擎——move/setPos
     内部序收尾贴地, 调用方不可见; settle 保留独立出口(无位移收敛兜底, dt 缺省
     1=一步贴齐, dt≥0.1 收敛系数取满单帧贴齐)。地面三态各钉一记; 深埋 ≥3 格的
     指数不跨界(groundUnderAt 深扫口径)不在本测试面内 */
  Mobs.clear();
  const origTop = globalThis.groundTop;
  try {
    const m = Mobs.spawn('zombie', 10, 10, {});
    /* 天上出生(门面/环点错层): 落回列顶+1 */
    globalThis.groundTop = () => 11;
    m.pos.y = 40;
    Mobs.settle(m, 0.1);
    assert.strictEqual(m.pos.y, 12, '悬空 40 → 落回 groundTop+1');
    /* 缺省 dt=1: 一步贴齐(忘传 dt 不再产出 NaN——arena 末影人瞬移桩教训) */
    m.pos.y = 40;
    Mobs.settle(m);
    assert.strictEqual(m.pos.y, 12, 'settle 缺省 dt=1 → 单帧贴齐');
    /* 上 1 格台阶: 台阶门(≤1.05)放行的对偶面 —— 脚随列顶抬升 */
    globalThis.groundTop = () => 12;
    Mobs.settle(m, 0.1);
    assert.strictEqual(m.pos.y, 13, '脚 12/列顶 12 → 抬到 13');
    /* 下坎: 走下 1 格地 → 落到新列顶+1(不悬空) */
    globalThis.groundTop = () => 8;
    Mobs.settle(m, 0.1);
    assert.strictEqual(m.pos.y, 9, '脚 13/列顶 8 → 落到 9');
    /* move 契约钉(2026-11-04 翻转): 位移即贴地(引擎内部序收尾)——
       上坡嵌地/下坡悬空从「调用方义务」降为「不可能」 */
    globalThis.groundTop = () => 12;
    const st = Mobs.spawn('hoglin', 12, 10, {});
    st.pos.y = 12;
    Mobs.move(st, 0.5, 0.5, 0.1);
    assert.strictEqual(st.pos.y, 13, 'move 后已贴地(内部序收尾, dt=0.1 收敛系数取满)');
    Mobs.settle(st, 0.1);
    assert.strictEqual(st.pos.y, 13, '独立出口 settle 幂等(已贴地再收尾不动)');
  } finally {
    globalThis.groundTop = origTop; /* 文件级桩还原(后续测试仍按平地 11 跑) */
    Mobs.clear();
  }
});

test('怪物库: hit 击退贴地 — 击退也是位移, 内部序契约覆盖(跨列击退一步落新地形)', () => {
  /* 候选②(2026-11-04): hit 的地面击退位移后补 settle——旧口径 Y 冻结在受击前
     (竞技场硬直帧整段不收敛), 被击退跨下坎会悬空/上坡会嵌地 */
  Mobs.clear();
  const origTop = globalThis.groundTop;
  try {
    /* 世界: x<12 列顶 11, x≥12 列顶 8(下坎) */
    globalThis.groundTop = (x) => (Math.floor(x) >= 12 ? 8 : 11);
    const m = Mobs.spawn('zombie', 10.5, 10.5, {}); /* 脚 y=12 */
    Mobs.hit(m, 1, 1, 0, 2); /* 向 +x 击退 1.8: 跨到列顶 8 的低地 */
    assert.strictEqual(m.pos.y, 9, '击退跨下坎 → 一步贴齐新列顶+1(不再冻结)');
  } finally {
    globalThis.groundTop = origTop;
    Mobs.clear();
  }
});

test('怪物库: 高墙拦截 — 列顶远高于脚且身体有实心=墙, move 不得入(2026-11 穿墙票回归钉)', () => {
  /* 旧 groundUnderAt 地下分支把墙在脚层的块顶当"地板"(top≈脚高 → 台阶门
     高差 1 放行), 高墙被逐列穿过。新判据: 脚层/头层有实心 → 返回列顶, 门拦 */
  Mobs.clear();
  const origTop = globalThis.groundTop; const origBlock = globalThis.getBlock;
  const origSolid = globalThis.isSolid;
  try {
    /* 世界: 平地块在 11; 墙列 x=12 自 11 垒到 14(高 3, 顶 14 > 脚 12+1.5) */
    const solidAt = (x, y) => (x === 12 && y >= 11 && y <= 14) || y === 11;
    globalThis.getBlock = (x, y, z) => (solidAt(x, y) ? 1 : 0);
    globalThis.isSolid = (id) => id !== 0;
    globalThis.groundTop = (x, z) => {
      for (let y = 40; y > 0; y--) if (solidAt(x, y)) return y;
      return 0;
    };
    const m = Mobs.spawn('zombie', 10.5, 10.5, {}); /* 脚 y=12 */
    Mobs.move(m, 1.4, 0); /* 到 11.9(墙前开地照走) */
    assert.ok(Math.abs(m.pos.x - 11.9) < 1e-9, '墙前开地照走');
    Mobs.move(m, 1.0, 0); /* 目的列 = 墙(12) → 拦 */
    assert.ok(Math.abs(m.pos.x - 11.9) < 1e-9, '高墙列不得入(旧口径当 1 级台阶放行穿墙)');
    Mobs.settle(m, 0.1);
    assert.ok(Math.abs(m.pos.y - 12) < 1e-9, '墙前原地贴地不受墙列影响');
  } finally {
    globalThis.groundTop = origTop; globalThis.getBlock = origBlock;
    globalThis.isSolid = origSolid;
    Mobs.clear();
  }
});

test('怪物库: 洞底贴地保留 — 列顶远高于脚但身体净空(悬顶洞道)照走不误拦', () => {
  /* 穿墙拦截的另一面: 怪物巢穴副本/黑巢洞道(上有悬顶脚下净空)必须仍可走
     且贴洞底——墙判据只认"身体高度有实心", 不误伤洞道 */
  Mobs.clear();
  const origTop = globalThis.groundTop; const origBlock = globalThis.getBlock;
  const origSolid = globalThis.isSolid; const origWH = globalThis.WORLD_H;
  try {
    /* 世界: 平地块在 11; 洞道列 x=12 顶板在 20(身体 12/13 净空, 洞底 11) */
    const solidAt = (x, y) => (x === 12 && y === 20) || y === 11;
    globalThis.WORLD_H = 40; /* 地下扫的下界口径(groundUnderAt 深扫消费) */
    globalThis.getBlock = (x, y, z) => (solidAt(x, y) ? 1 : 0);
    globalThis.isSolid = (id) => id !== 0;
    globalThis.groundTop = (x, z) => {
      for (let y = 40; y > 0; y--) if (solidAt(x, y)) return y;
      return 0;
    };
    const m = Mobs.spawn('zombie', 10.5, 10.5, {});
    Mobs.move(m, 1.4, 0);
    Mobs.move(m, 1.0, 0); /* 入洞道列 */
    assert.ok(Math.abs(m.pos.x - 12.9) < 1e-9, '洞道列照走(身体净空不是墙)');
    Mobs.settle(m, 0.1);
    assert.ok(Math.abs(m.pos.y - 12) < 1e-9, '贴洞底(顶板 20 不扰地板 11)');
  } finally {
    globalThis.groundTop = origTop; globalThis.getBlock = origBlock;
    globalThis.isSolid = origSolid; globalThis.WORLD_H = origWH;
    Mobs.clear();
  }
});

test('怪物库: walkDist 实走距离 — 平地直线/同列 0/预算尽/高墙拦断/绕行计程/立柱末步', () => {
  Mobs.clear();
  const origTop = globalThis.groundTop; const origBlock = globalThis.getBlock;
  const origSolid = globalThis.isSolid; const origWH = globalThis.WORLD_H;
  try {
    globalThis.WORLD_H = 40;
    globalThis.isSolid = (id) => id !== 0;
    const install = (solidAt) => {
      globalThis.getBlock = (x, y, z) => (solidAt(x, y, z) ? 1 : 0);
      globalThis.groundTop = (x, z) => {
        for (let y = 40; y > 0; y--) if (solidAt(x, y, z)) return y;
        return 0;
      };
    };
    /* 平地: 直线计程 + 同列 0 + 预算尽 */
    install(() => false);
    assert.strictEqual(Mobs.walkDist(0.5, 0.5, 12, 3.5, 0.5, 12), 3, '平地: 3 列步');
    assert.strictEqual(Mobs.walkDist(0.5, 0.5, 12, 0.9, 0.2, 12), 0, '同列: 0');
    assert.strictEqual(Mobs.walkDist(0.5, 0.5, 12, 3.5, 0.5, 2), Infinity, '预算尽: ∞');
    /* 无限长高墙(x=2 全 z 垒 11..14): 拦断 → ∞ */
    install((x, y) => (x === 2 && y >= 11 && y <= 14) || y === 11);
    assert.strictEqual(Mobs.walkDist(0.5, 0.5, 12, 4.5, 0.5, 12), Infinity, '墙后不可达(视觉外)');
    /* 有限高墙(x=2, 仅 z∈[-1,1]): 绕行计程——最短绕 z=±2, 4+4=8 步 */
    install((x, y, z) => (x === 2 && z >= -1 && z <= 1 && y >= 11 && y <= 14) || y === 11);
    assert.strictEqual(Mobs.walkDist(0.5, 0.5, 12, 4.5, 0.5, 12), 8, '绕行按实际步数计程');
    /* 立柱末步: 目标列 x=3 垒 11..13(比脚高 2, 逾台阶门)——末步免爬仍可达 */
    install((x, y) => (x === 3 && y >= 11 && y <= 13) || y === 11);
    assert.strictEqual(Mobs.walkDist(0.5, 0.5, 12, 3.5, 0.5, 12), 3, '玩家立柱上: 末步免爬照达(贴柱集结)');
  } finally {
    globalThis.groundTop = origTop; globalThis.getBlock = origBlock;
    globalThis.isSolid = origSolid; globalThis.WORLD_H = origWH;
    Mobs.clear();
  }
});

test('怪物库: gait 攻击姿态窗口(第 4 参) — 挥臂(人形)/头前扑(四足) · 相位钳制 · 每帧幂等', () => {
  Mobs.clear();
  const z = Mobs.spawn('zombie', 10, 10, {});
  Mobs.gait(z, 1/60, 2.3); /* 不传窗口: 与旧 3 参签名行为一致 */
  assert.ok(Math.abs(z.pose.armR - (-1.45)) < 1e-9, '僵尸式基础姿态: 双臂前伸平举');
  z.attackT = 0.45;
  Mobs.gait(z, 1/60, 0, 0.5);
  assert.ok(z.pose.armR < -1.45, '僵尸式攻击中: 平举手臂下劈(低于基线)');
  z.attackT = 0.6; /* attackT 超窗口 → 相位钳制, 不起负摆 */
  Mobs.gait(z, 1/60, 0, 0.5);
  assert.ok(Math.abs(z.pose.armR - (-1.45)) < 1e-9, 'attackT 超窗口: 钳制在起手位(修硬编码 /0.45 的相位越界)');
  z.attackT = 0;
  Mobs.gait(z, 1/60, 0, 0.5);
  assert.ok(Math.abs(z.pose.armR - (-1.45)) < 1e-9, 'attackT 归零: 回平举基线(每帧幂等, 无残留姿态)');

  const b = Mobs.spawn('blaze', 14, 14, {}); /* 通用人形分支(有臂槽, 无 armStyle) */
  b.attackT = 0.25; /* 相位中点 → 挥幅峰值 */
  Mobs.gait(b, 1/60, 0, 0.5);
  assert.ok(Math.abs(b.pose.armR - (-1.9)) < 1e-9, '通用人形: 相位中点抡臂到峰值 -1.9');
  b.attackT = 0;
  Mobs.gait(b, 1/60, 2, 0.5);
  assert.ok(Math.abs(b.pose.armR) < 0.25, 'attackT 归零: 回步态摆臂基线');

  const p = Mobs.spawn('piglin', 16, 16, {}); /* 持械人形(造型档案 weaponArm → 武器挂 armL) */
  p.attackT = 0.25; /* 相位中点 → 挥幅峰值 */
  Mobs.gait(p, 1/60, 0, 0.5);
  assert.ok(Math.abs(p.pose.armL - (-1.9)) < 1e-9, '持械人形: 相位中点持械臂(armL)抡到峰值 -1.9, 不再空手挥拳');
  assert.ok(Math.abs(p.pose.armR) < 1e-9, '空手右臂: 反向平衡(sp=0 时静止归零)');
  p.attackT = 0;
  Mobs.gait(p, 1/60, 2, 0.5);
  assert.ok(Math.abs(p.pose.armL) < 0.25, 'attackT 归零: 持械臂回步态摆臂基线(每帧幂等)');

  const h = Mobs.spawn('hoglin', 12, 12, {}); /* 四足分支(无臂有头) */
  h.attackT = 0.3;
  Mobs.gait(h, 1/60, 0, 0.5);
  assert.strictEqual(h.pose.head, -0.55, '四足攻击中: 头部前扑');
  h.attackT = 0;
  Mobs.gait(h, 1/60, 0, 0.5);
  assert.strictEqual(h.pose.head, 0, 'attackT 归零: 头部回正');
  Mobs.clear();
});

test('怪物库: 名牌 Sprite 不关深度测试 — 地形遮挡语义(地下透视看到地表名牌的回归钉)', () => {
  /* 桩: document + THREE 贴图三件套, 让 spawn 的名牌段(引擎层唯一 Sprite
     出口)在 Node 里真跑一次 — 材质参数逐字落入桩构造器可断言 */
  const ctxStub = {
    clearRect() {}, fillText() {}, fillRect() {}, strokeRect() {},
    measureText: () => ({width: 10}),
  };
  globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => ctxStub})};
  globalThis.THREE.CanvasTexture = function() {
    this.needsUpdate = false; this.dispose = () => {};
  };
  globalThis.THREE.SpriteMaterial = function(opts) {
    Object.assign(this, opts); this.dispose = () => {};
  };
  globalThis.THREE.Sprite = function(mat) {
    this.material = mat; this.scale = {set() {}};
    this.position = new THREE.Vector3();
  };
  try {
    Mobs.clear();
    const m = Mobs.spawn('zombie', 10, 10, {});
    assert.ok(m.label, '有 document 时 spawn 建名牌');
    assert.notStrictEqual(m.label.material.depthTest, false,
        '名牌材质不得关深度测试(关了就穿墙透视, 隔着地形也可见)');
  } finally {
    Mobs.clear(); /* dispose 走桩的 dispose, 无泄漏 */
    delete globalThis.document; /* 摘桩: 后续测试回到无名牌路径 */
    delete globalThis.THREE.CanvasTexture;
    delete globalThis.THREE.SpriteMaterial;
    delete globalThis.THREE.Sprite;
  }
});
