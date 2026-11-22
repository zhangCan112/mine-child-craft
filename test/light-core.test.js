'use strict';
/* 光照核心 (js/light-core.js) 单测 — node --test (零依赖)
   运行: node --test test/light-core.test.js
   手法: 纯核心直接 require; 合成小世界(平铺 Uint8Array + read/write 闭包),
   policy 用核心自己的 mkPolicy 派生(与 world.js 同一装配, 防两份漂移)。
   另有真实 config BLOCKS 集成面(H2, T-C13-R7): config.js 是浏览器共享词法
   脚本(无导出), vm 装载后取 BLOCKS(campfire-kit.test.js 同款范式)——挡光
   谓词 thin 例外(ADR-0021)与熄态篝火格值面在真表上直证。
   断言按设计稿 docs/mc-daylight-torch-design.md §3 与 §10 光照行:
   · 方块通道: 单火把菱形(曼哈顿 −1 · 半径 13) · 双源取 max · 遮挡投阴影
     · 玻璃/水/薄块透光(不衰减, 差异 #7)
   · 天空通道: 列直灌 · 洞口横向渗透 · 屋檐下暗
   · updateEdit: 撤源归零 · 增量 === 全量重算(随机 50 步双通道逐格相等)
   光场布局契约: idx = (y*D + z)*W + x(与 voxel.js cellIdx 同式)。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const LightCore = require('../js/light-core.js');

const ROOT = path.join(__dirname, '..');

/* 真实 config BLOCKS: 共享词法脚本 vm 装载(零依赖原则不破——只读数据表) */
const eng = vm.createContext({console: {log() {}, warn() {}, error() {}}});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'config.js'), 'utf8'), eng,
    {filename: 'js/config.js'});
const REAL_BLOCKS = vm.runInContext('BLOCKS', eng);
const RID = vm.runInContext('({torch: B_TORCH, water: B_WATER, tnt: B_TNT, ' +
    'obsidian: B_OBSIDIAN, glow: B_GLOWSTONE, sign: B_GATE_SIGN, ' +
    'lit: B_CAMPFIRE, out: B_CAMPFIRE_OUT})', eng);

/* 合成方块表: 挡光口径与 mkPolicy 现判一致(solid 缺省=实心, glass/水/thin 透光;
   R-7/ADR-0021 注记: 光挡光谓词对 solid∧thin 组合加 thin 例外, 与视线 isOpaque
   刻意分叉——合成表 thin 族均为 solid:false, solid∧thin 组合在下方真表集成面直证),
   light 字段形状即 D4 将给 BLOCKS 补的形状 */
const BT = {
  1: {name: '石头'}, // 实心挡光
  2: {name: '玻璃', glass: true}, // 透光
  3: {name: '火把', light: 14, thin: 0.5, solid: false}, // 光源 + 薄块透光
  4: {name: '灯块', light: 15}, // 光源(实心, MC 灯口径)
  5: {name: '水', water: true, solid: false}, // 透光(差异 #7 不衰减)
  6: {name: '薄板', thin: 0.5, solid: false}, // 非光源薄块
};

/* 每测试一世界: 全新数组天然隔离(无跨测试残留) */
function mkWorld(W, D, H) {
  const cells = new Uint8Array(W * D * H);
  const sky = new Uint8Array(W * D * H);
  const block = new Uint8Array(W * D * H);
  const idx = (x, y, z) => (y * D + z) * W + x;
  const read = (x, y, z) =>
    (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) ? 0 : cells[idx(x, y, z)];
  const write = (x, y, z, id) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return;
    cells[idx(x, y, z)] = id;
  };
  return {
    W, D, H, cells, sky, block, idx, read, write,
    policy: LightCore.mkPolicy(BT),
    fill(x0, y0, z0, x1, y1, z1, id) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          for (let x = x0; x <= x1; x++) write(x, y, z, id);
        }
      }
    },
    compute() {
      LightCore.computeAll(read, W, D, H, this.policy, sky, block);
    },
    /* 镜像 world.js editBlock 装配(D4 接线): 先写格再增量更新光场 */
    edit(x, y, z, newId) {
      const old = read(x, y, z);
      write(x, y, z, newId);
      return LightCore.updateEdit(read, W, D, H, this.policy, x, y, z, old, sky, block);
    },
  };
}

/* 真表小世界: 同款装具换真实 config BLOCKS 装配(H2 集成面专用) */
function mkWorldReal(W, D, H) {
  const w = mkWorld(W, D, H);
  w.policy = LightCore.mkPolicy(REAL_BLOCKS);
  return w;
}

/* ============ mkPolicy: 挡光/发光判定(镜像 isOpaque 现判 + light 字段) ============ */

test('mkPolicy: lightOf 读 light 字段(缺省 0), opaque = 实心且非玻璃且非薄块(与视线 isOpaque 刻意分叉, ADR-0021)', () => {
  const policy = LightCore.mkPolicy(BT);
  assert.strictEqual(policy.lightOf(3), 14); // 火把
  assert.strictEqual(policy.lightOf(4), 15); // 灯块
  assert.strictEqual(policy.lightOf(1), 0); // 石头不发光
  assert.strictEqual(policy.lightOf(0), 0); // 空气
  assert.strictEqual(policy.lightOf(99), 0); // 未知 id 无光
  assert.strictEqual(policy.opaque(0), false); // 空气透光
  assert.strictEqual(policy.opaque(1), true); // 石头挡光
  assert.strictEqual(policy.opaque(4), true); // 灯块实心挡光(MC 灯口径: 源格自亮不透光)
  assert.strictEqual(policy.opaque(2), false); // 玻璃
  assert.strictEqual(policy.opaque(5), false); // 水(差异 #7)
  assert.strictEqual(policy.opaque(3), false); // 火把(thin)
  assert.strictEqual(policy.opaque(6), false); // 薄板
  assert.strictEqual(policy.opaque(99), true); // 未知 id 按实心(与 isOpaque 兜底一致)
});

/* ============ mkPolicy 真表集成面(H2, T-C13-R7/ADR-0021): solid∧thin 透光族 ============
   归因链(docs/campfire 复验黑区归因报告 §2): 熄态篝火 81/82 与门额牌 80 是全表仅有的
   solid∧thin 组合(config.js:527/:544-545), 旧判 solid∧¬glass 把它们判成挡光格 →
   熄态格双通道恒 0(skyCompute 直灌遇 opaque 即 break; bfsIncrease 邻格 opaque 即 skip)
   → 沙壁侧面顶点光采样熄格 0/0 渲染纯黑。H2: 谓词加 ¬thin 一处, 双通道共用。 */

test('mkPolicy(真实 config BLOCKS): solid∧thin 透光族 80/81/82 不挡光(与视线 isOpaque 刻意分叉, ADR-0021; 全表恰此三 id)', () => {
  const policy = LightCore.mkPolicy(REAL_BLOCKS);
  /* H2 主断言(对 H2 前实现真红: 旧判 solid∧¬glass → 三 id 全 true) */
  assert.strictEqual(policy.opaque(RID.sign), false,
      '门额牌 80(thin 0.15 实心)不挡光 — 横梁朝牌面黑变亮归位的谓词面');
  assert.strictEqual(policy.opaque(RID.lit), false,
      '燃态篝火 81(thin 0.4375 实心, light 15)不挡光 — 源格自亮例外不受影响');
  assert.strictEqual(policy.opaque(RID.out), false,
      '熄态篝火 82(thin 0.4375 实心, light 0)不挡光 — 熄态黑框病灶谓词面');
  /* 受影响面登记锁: 全表 solid∧thin 恰此三 id(数据驱动, 新增块自动继承) */
  const solidThin = Object.entries(REAL_BLOCKS)
      .filter(([, b]) => b && b.solid === true && b.thin)
      .map(([id]) => Number(id))
      .sort((a, b) => a - b);
  assert.deepStrictEqual(solidThin, [80, 81, 82],
      '全表 solid∧thin 恰 {80,81,82}(受影响 id 面=登记锁, 越界扩张必红)');
  /* 维持面(红线在职证明, 裁量四理由第 4 条): 视线 isOpaque 不动 — 物理 solid
     仍挡视线/拾取, 本谓词分叉只发生在光域 */
  assert.strictEqual(policy.opaque(RID.torch), false, '火把(thin 且非实心)透光(既有语义不动)');
  assert.strictEqual(policy.opaque(RID.water), false, '水(glass)透光(差异 #7 不动)');
  assert.strictEqual(policy.opaque(RID.tnt), true, 'TNT 实心非 thin 挡光(不动)');
  assert.strictEqual(policy.opaque(RID.obsidian), true, '黑曜石实心非 thin 挡光(不动)');
  assert.strictEqual(policy.opaque(RID.glow), true, '萤石光源格自亮不透光(MC 灯口径不动)');
  assert.strictEqual(policy.opaque(0), false, '空气透光(不动)');
  assert.strictEqual(policy.opaque(9999), true, '未知 id 实心兜底(不动)');
  /* 光源字段维持: 燃 15 源/熄 0/火把 14(config 数据驱动字段零动) */
  assert.strictEqual(policy.lightOf(RID.lit), 15, '燃态 light 15 源维持(红线)');
  assert.strictEqual(policy.lightOf(RID.out), 0, '熄态 light 0 维持(红线)');
  assert.strictEqual(policy.lightOf(RID.torch), 14, '火把 light 14 维持');
});

test('H2 熄态格值面(真实 BLOCKS 小世界): 熄态篝火格 sky=15 直灌穿透(薄块归位全透光) · ' +
    '火把方块光入格(block 通道不再恒 0) · 燃态源格自亮 15 与 sky 直灌双维持', () => {
  const w = mkWorldReal(16, 16, 8);
  w.fill(0, 0, 0, 15, 0, 15, RID.obsidian); // 地面整层(实心非 thin 挡光)
  w.fill(8, 1, 8, 8, 1, 8, RID.out); // 熄态篝火坐地
  w.fill(8, 1, 10, 8, 1, 10, RID.torch); // z 向两格外火把(隔一格空气)
  w.compute();
  const fi = w.idx(8, 1, 8);
  /* 黑框病灶格值面(归因报告 §2 病灶链): 沙壁侧面顶点光=面朝向邻格采样=本格;
     headless 探针读数口径(lightSkyAt/lightBlockAt 同读数)——修复前直灌遇挡光
     break 恒缺值(sky 0)且 BFS 邻格 skip(block 0), 修复后 sky=15:
     「薄块归位全透光」的格值面直接证明(比邻面非恒 0 更根本) */
  assert.strictEqual(w.sky[fi], 15,
      '熄态篝火格 sky=15(直灌穿透 thin 格; 邻墙面采样值由此点亮)');
  assert.strictEqual(w.block[fi], 12,
      '熄态篝火格 block=12(火把 14 经两格入格; 旧判 opaque skip 恒 0 必红)');
  assert.strictEqual(w.block[w.idx(8, 1, 9)], 13, '中间格 13(BFS 传导路径在格, 方向性变亮)');
  /* 燃态对照(红线维持面): 源格自亮 15 不透光(MC 灯口径), sky 同获直灌 15 */
  const w2 = mkWorldReal(16, 16, 8);
  w2.fill(0, 0, 0, 15, 0, 15, RID.obsidian);
  w2.fill(8, 1, 8, 8, 1, 8, RID.lit);
  w2.compute();
  assert.strictEqual(w2.block[w2.idx(8, 1, 8)], 15, '燃态源格自亮 block=15 维持(红线)');
  assert.strictEqual(w2.sky[w2.idx(8, 1, 8)], 15, '燃态格 sky=15(H2 连带: 光源格同样 thin 归位)');
});

test('H2 燃→熄过渡(玩法路径增量面): updateEdit 81→82 — 格值翻 sky15/block0, ' +
    '邻面采样格恒非双零(「光晕翻黑框」闪变判据程序化)', () => {
  const w = mkWorldReal(16, 16, 8);
  w.fill(0, 0, 0, 15, 0, 15, RID.obsidian);
  w.fill(8, 1, 8, 8, 1, 8, RID.lit);
  w.compute();
  assert.strictEqual(w.block[w.idx(8, 1, 8)], 15, '燃态源格在亮(前置)');
  w.edit(8, 1, 8, RID.out); // 浇熄: 与 world.js editBlock 同装配的增量路径
  assert.strictEqual(w.block[w.idx(8, 1, 8)], 0, '撤光: 熄格 block 归 0(光源语义退场)');
  assert.strictEqual(w.sky[w.idx(8, 1, 8)], 15,
      '浇熄后 sky=15(增量 skyRegion 同步归位; 旧判挡光恒 0 必红)');
  /* 黑框判据程序化(归因报告 §3 观感判据的读数面): 邻墙面采样格=篝火格,
     燃态(block15)+熄态(sky15)读数恒非双零 → 渲染不出现纯黑闪变 */
  const s = w.sky[w.idx(8, 1, 8)];
  const b = w.block[w.idx(8, 1, 8)];
  assert.ok(s > 0 || b > 0, '浇熄后采样格非双零(' + s + '/' + b + ' — 黑框闪变判据)');
});

/* ============ 方块通道: computeAll 光源 BFS(曼哈顿每格 −1) ============ */

test('方块通道: 单火把菱形光场 — 源格 14, 曼哈顿 d 处 14−d, 半径 13 外归零', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(14, 8, 14, 14, 8, 14, 3); // 火把
  w.compute();
  assert.strictEqual(w.block[w.idx(14, 8, 14)], 14); // 源格 = 发射级
  assert.strictEqual(w.block[w.idx(15, 8, 14)], 13); // 邻格 −1
  assert.strictEqual(w.block[w.idx(14, 8, 9)], 9); // |dz|=5 → 9
  assert.strictEqual(w.block[w.idx(14, 12, 14)], 10); // |dy|=4 → 10
  assert.strictEqual(w.block[w.idx(14 + 13, 8, 14)], 1); // d=13 → 1(半径边界)
  assert.strictEqual(w.block[w.idx(14 + 14, 8, 14)], 0); // d=14 → 0(照不到)
  assert.strictEqual(w.block[w.idx(14 + 7, 8 + 6, 14)], 1); // 斜向 d=13 → 1
  assert.strictEqual(w.block[w.idx(14 + 10, 8, 14 + 10)], 0); // d=20 → 0
});

test('方块通道: 双源取 max(火把 14 + 灯 15 交叠区)', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(10, 8, 12, 10, 8, 12, 3); // 火把 14
  w.fill(16, 8, 12, 16, 8, 12, 4); // 灯 15
  w.compute();
  assert.strictEqual(w.block[w.idx(13, 8, 12)], Math.max(14 - 3, 15 - 3)); // 正中 12
  assert.strictEqual(w.block[w.idx(10, 8, 16)], Math.max(14 - 4, 15 - 10)); // 火把侧 10
  assert.strictEqual(w.block[w.idx(16, 9, 12)], Math.max(14 - 7, 15 - 1)); // 灯旁 14
  assert.strictEqual(w.block[w.idx(16, 16, 12)], Math.max(14 - 14, 15 - 8)); // 灯正上方 d=8 → 7
  assert.strictEqual(w.block[w.idx(4, 16, 4)], 0); // 远角两头都照不到
});

test('方块通道: 遮挡投阴影 — 密封石盒内火把, 盒外全零盒内亮', () => {
  const w = mkWorld(25, 25, 17);
  w.fill(10, 6, 10, 14, 10, 14, 1); // 石壳
  w.fill(11, 7, 11, 13, 9, 13, 0); // 掏空内腔
  w.fill(12, 8, 12, 12, 8, 12, 3); // 火把居中
  w.compute();
  assert.strictEqual(w.block[w.idx(11, 8, 12)], 13); // 盒内隔一格
  assert.strictEqual(w.block[w.idx(13, 9, 13)], 11); // 盒内斜角 d=3
  assert.strictEqual(w.block[w.idx(12, 10, 12)], 0); // 壳体本身不透光(隔壁格在壳外)
  assert.strictEqual(w.block[w.idx(15, 8, 12)], 0); // 盒外一格
  assert.strictEqual(w.block[w.idx(12, 0, 12)], 0); // 远处
});

test('方块通道: 玻璃/水/薄块透光不衰减(差异 #7 口径)', () => {
  const mk = (wallId) => {
    const w = mkWorld(29, 29, 17);
    w.fill(8, 8, 14, 8, 8, 14, 3); // 火把
    w.fill(10, 0, 0, 10, 16, 28, wallId); // x=10 整面墙(隔断世界, 光只能穿墙而过)
    w.compute();
    return w.block[w.idx(12, 8, 14)]; // 火把后 4 格(隔一堵满墙)
  };
  const noWall = (() => {
    const w = mkWorld(29, 29, 17);
    w.fill(8, 8, 14, 8, 8, 14, 3);
    w.compute();
    return w.block[w.idx(12, 8, 14)];
  })();
  assert.strictEqual(noWall, 10); // 14−4
  assert.strictEqual(mk(2), 10, '玻璃墙不衰减');
  assert.strictEqual(mk(5), 10, '水墙不衰减(差异 #7)');
  assert.strictEqual(mk(6), 10, '薄板墙不衰减');
  assert.strictEqual(mk(1), 0, '石墙挡光(对照组, 无绕行路径)');
});

/* ============ 天空通道: computeAll(列直灌 + 横向渗透) ============ */

test('天空通道: 列直灌 — 地表以上全 15, 地下 0, 玻璃/水不挡天光', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(0, 5, 0, 28, 5, 28, 1); // y=5 整层石地板
  w.fill(5, 9, 5, 5, 9, 5, 2); // 玻璃悬浮块
  w.fill(20, 9, 20, 20, 9, 20, 5); // 水悬浮块
  w.compute();
  assert.strictEqual(w.sky[w.idx(10, 6, 10)], 15); // 地板上方
  assert.strictEqual(w.sky[w.idx(10, 16, 10)], 15); // 世界顶
  assert.strictEqual(w.sky[w.idx(10, 5, 10)], 0); // 地板内(挡光格)
  assert.strictEqual(w.sky[w.idx(10, 0, 10)], 0); // 深地下
  assert.strictEqual(w.sky[w.idx(5, 8, 5)], 15); // 玻璃正下方不挡天光
  assert.strictEqual(w.sky[w.idx(20, 8, 20)], 15); // 水正下方(差异 #7 不衰减)
  assert.strictEqual(w.sky[w.idx(5, 9, 5)], 15); // 玻璃格自身透光
});

test('天空通道: 洞口横向渗透 — 竖井 15 直下, 房间内自井口横向 −1 扩散', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(0, 0, 0, 28, 5, 28, 1); // y 0..5 实体大地
  w.fill(12, 2, 12, 16, 4, 16, 0); // 掏出地下房间(y 2..4)
  w.fill(14, 5, 14, 14, 5, 14, 0); // 房顶开 1×1 天窗(竖井 y=5)
  w.compute();
  assert.strictEqual(w.sky[w.idx(14, 5, 14)], 15); // 竖井(列直灌: 井列顶块=房底 y=1)
  assert.strictEqual(w.sky[w.idx(14, 2, 14)], 15); // 井底直下不衰减(列直灌)
  assert.strictEqual(w.sky[w.idx(15, 4, 14)], 14); // 井口旁横向 −1
  assert.strictEqual(w.sky[w.idx(16, 4, 14)], 13); // 再远 −1
  assert.strictEqual(w.sky[w.idx(12, 4, 14)], 13); // 另一向对称
  assert.strictEqual(w.sky[w.idx(15, 2, 16)], 12); // 斜向 d=3 → 12
  assert.strictEqual(w.sky[w.idx(18, 4, 14)], 0); // 房外石头里
});

test('天空通道: 屋檐下暗 — 全深挑檐沿进深每格 −1, 15 格进深处全暗', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(0, 0, 0, 28, 0, 28, 1); // y=0 地表
  w.fill(12, 10, 0, 28, 10, 28, 1); // y=10 挑檐(x 12..28 全 z 向, 西缘 x=12)
  w.compute();
  assert.strictEqual(w.sky[w.idx(11, 9, 14)], 15); // 檐外敞空
  assert.strictEqual(w.sky[w.idx(12, 9, 14)], 14); // 檐下第 1 列
  assert.strictEqual(w.sky[w.idx(14, 9, 14)], 12); // 进深 3
  assert.strictEqual(w.sky[w.idx(25, 9, 14)], 1); // 进深 14 → 1
  assert.strictEqual(w.sky[w.idx(26, 9, 14)], 0); // 进深 15 → 全暗
  assert.strictEqual(w.sky[w.idx(20, 4, 14)], 6); // 檐下任意高度同进深同值(离地也暗)
  assert.strictEqual(w.sky[w.idx(20, 11, 14)], 15); // 檐上方照常直灌
});

/* ============ updateEdit: 增量(增/撤两趟 BFS + 天空区域重算) ============
   权威判据是不变量: 随机编辑序列后 updateEdit 累计 === computeAll 重算
   (双通道逐格相等) — 设计稿 §3.1 以此兜底增量正确性 */

test('updateEdit: 撤源归零 — 挖掉火把后光场全零(空世界无其他源)', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(14, 8, 14, 14, 8, 14, 3);
  w.compute();
  assert.strictEqual(w.block[w.idx(15, 8, 14)], 13); // 撤前确实亮着
  w.edit(14, 8, 14, 0);
  assert.strictEqual(w.block[w.idx(14, 8, 14)], 0); // 源格归零
  assert.strictEqual(w.block[w.idx(15, 8, 14)], 0); // 近旁归零
  assert.strictEqual(w.block[w.idx(14 + 13, 8, 14)], 0); // 原半径边界归零
});

test('updateEdit: 增源 — 空场放火把, 增量 === 全量重算(逐格相等)', () => {
  const w = mkWorld(29, 29, 17);
  w.compute();
  w.edit(14, 8, 14, 3);
  const m = mkWorld(29, 29, 17);
  m.fill(14, 8, 14, 14, 8, 14, 3);
  m.compute();
  assert.deepStrictEqual([...w.block], [...m.block]);
  assert.deepStrictEqual([...w.sky], [...m.sky]);
});

test('updateEdit: 放置挡光块 — 探针值按绕行路径重算, 挖开复原', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(8, 8, 14, 8, 8, 14, 3); // 火把
  w.compute();
  assert.strictEqual(w.block[w.idx(12, 8, 14)], 10); // 直线距离 4
  w.edit(10, 8, 14, 1); // 正轴线中立一块石头
  assert.strictEqual(w.block[w.idx(12, 8, 14)], 8); // 绕行: 上/下/侧各绕 2 → 14−6
  w.edit(10, 8, 14, 0); // 拆掉
  assert.strictEqual(w.block[w.idx(12, 8, 14)], 10); // 复原
});

test('updateEdit: 天空通道遮挡变化 — 空场悬石投影列内 14, 移除复原 15', () => {
  const w = mkWorld(29, 29, 17);
  w.fill(0, 0, 0, 28, 0, 28, 1); // y=0 地表
  w.compute();
  w.edit(14, 9, 14, 1); // 空中悬一块石头
  assert.strictEqual(w.sky[w.idx(14, 9, 14)], 0); // 石头自身
  assert.strictEqual(w.sky[w.idx(14, 8, 14)], 14); // 影列: 四侧列直灌 15 → 横向 −1
  assert.strictEqual(w.sky[w.idx(14, 1, 14)], 14); // 影列任意深度(侧列全高直灌)
  assert.strictEqual(w.sky[w.idx(14, 10, 14)], 15); // 石头上方照常
  assert.strictEqual(w.sky[w.idx(13, 8, 14)], 15); // 影外
  w.edit(14, 9, 14, 0); // 移除
  assert.strictEqual(w.sky[w.idx(14, 8, 14)], 15); // 复原直灌
});

test('updateEdit: 脏格包围盒 — 含光达范围; 无变化编辑返 null', () => {
  const w = mkWorld(29, 29, 17);
  w.compute();
  const box = w.edit(14, 8, 14, 3); // 放火把(光 14 → 半径 13)
  assert.ok(box, '放置光源必返包围盒');
  assert.ok(box.x0 <= 14 && box.x1 >= 14 + 13, 'x 向含半径边界');
  assert.ok(box.y0 <= 8 - 13 || box.y0 === 0, 'y 向下界=光源−13(或世界底钳制)');
  assert.ok(box.z0 <= 14 - 13 || box.z0 === 0, 'z 向含光达范围');
  assert.strictEqual(w.edit(3, 3, 3, 0), null, '空气→空气无变化 → null');
  assert.strictEqual(w.edit(3, 3, 3, 0), null, '重复无变化 → null');
});

test('updateEdit 不变量: 随机 50 步编辑, 增量累计 === computeAll 全量重算', () => {
  const W = 48; const D = 48; const H = 20; // > ±14 区域带 → 区域重算真子集
  const run = (seedVal) => {
    const w = mkWorld(W, D, H);
    const m = mkWorld(W, D, H);
    w.fill(0, 0, 0, W - 1, 1, D - 1, 1); // 地壳 y 0..1
    let s = seedVal; // 确定性 LCG(失败可复现)
    const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff, s / 0x7fffffff);
    for (let i = 0; i < 40; i++) { // 地形: 随机石墩 + 散置玻璃/水/光源
      const x = 2 + Math.floor(rnd() * (W - 4));
      const z = 2 + Math.floor(rnd() * (D - 4));
      const h = 1 + Math.floor(rnd() * 5);
      w.fill(x, 2, z, x, 1 + h, z, 1);
    }
    for (let i = 0; i < 6; i++) {
      w.fill(4 + Math.floor(rnd() * (W - 8)), 2, 4 + Math.floor(rnd() * (D - 8)),
          4 + Math.floor(rnd() * (W - 8)), 2, 4 + Math.floor(rnd() * (D - 8)),
          [2, 3, 4, 5, 6, 1][Math.floor(rnd() * 6)]);
    }
    m.cells.set(w.cells); // 镜像地形(此后每步同编辑 + 全量重算)
    w.compute();
    m.compute();
    assert.deepStrictEqual([...w.sky], [...m.sky], '初始全量应一致');
    const ids = [0, 0, 0, 1, 1, 2, 3, 4, 5, 6]; // 3 成挖 · 7 成放(含光源/透光/挡光)
    for (let step = 0; step < 50; step++) {
      /* 全域取点(含世界边缘): 区域钳制路径也要进不变量 */
      const x = Math.floor(rnd() * W);
      const y = Math.floor(rnd() * H);
      const z = Math.floor(rnd() * D);
      const id = ids[Math.floor(rnd() * ids.length)];
      w.edit(x, y, z, id);
      const old = m.read(x, y, z);
      m.write(x, y, z, id);
      m.compute();
      for (let i = 0; i < W * D * H; i++) {
        assert.strictEqual(w.sky[i], m.sky[i],
            'seed ' + seedVal + ' step ' + step + ' sky[' + i + '] 增量≠全量(编辑 ' + old + '→' + id + ')');
        assert.strictEqual(w.block[i], m.block[i],
            'seed ' + seedVal + ' step ' + step + ' block[' + i + '] 增量≠全量(编辑 ' + old + '→' + id + ')');
      }
    }
  };
  run(20261025);
  run(99); // 双种子: 单种子曾漏过 skyRegion 选种时序缺陷(扫描序读未处理列顶)
});
