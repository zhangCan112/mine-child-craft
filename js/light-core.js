'use strict';
/* ============================================================
   光照核心 (LightCore, 术语见 GLOSSARY.md「光照核心」) — 引擎层纯核心
   ------------------------------------------------------------
   MC 双通道体素光场(docs/mc-daylight-torch-design.md §3, 研究见
   docs/mc-daylight-torch-research.md §2):
   · 方块光  光源(发射级 1..15)六邻 BFS, 曼哈顿每格 −1;
   · 天空光  列顶直灌 15(至首个挡光块), 横向/向上每格 −1
             (垂直下落不衰减被列直灌包含 — 同列 15 只能来自直灌)。
   逻辑亮度 = max(internalSky, blockLight) 是消费侧口径(D3/D5), 本核心
   只产出两个独立通道。挡光规则: opaque = 实心且非玻璃(玻璃/水/薄块/
   十字片全透光不衰减, 差异 #7); 挡光格两通道恒 0, 唯光源格例外
   (自亮不透光, MC 灯口径)。
   interface: mkPolicy(BLOCKS) → {lightOf(id) 0..15, opaque(id)}
     · computeAll(read, W, D, H, policy, sky, block)   全量: 装场一次写满
     · updateEdit(read, W, D, H, policy, x, y, z, oldId, sky, block)
       → 脏格包围盒 {x0,y0,z0,x1,y1,z1} | null
       增量: 方块通道增/撤两趟 BFS; 天空通道 x±14 × z±14 列带区域重算
       (从列顶重灌 + 局部 BFS, 保不变量: 增量累计 === 全量重算)。
   光场契约: sky/block 为 Uint8Array(W*D*H), 布局 idx = (y*D+z)*W+x
     (与 voxel.js cellIdx 同式, 布局即契约); updateEdit 既读又写。
   依赖(零全局, 全部经参数注入): read(x,y,z)→id(界外=0, 同 getBlock) ·
     W/D/H(世界尺寸, W↔x · D↔z · H↔y) · BLOCKS(仅 mkPolicy 消费)。
   可测性: 零 THREE·零 DOM·有单测(test/light-core.test.js)
   ============================================================ */
const LightCore = (() => {
  /* 六邻序: 传播与增/撤 BFS 共用(曼哈顿度量 = 六连通路径长) */
  const NEIGH6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  /* 发光/挡光判定(config BLOCKS 派生, 装配一次; world.js 与单测共用同一
     装配防两份漂移 — cascade-core mkPolicy 同款缝制)。
     opaque 镜像 voxel.js isOpaque 现判: 实心(solid 缺省=实心)且非玻璃,
     未知 id 按实心兜底; lightOf 读 light 字段(D4 给 BLOCKS 补), 缺省 0 */
  function mkPolicy(BLOCKS) {
    return {
      lightOf: (id) => (BLOCKS[id] && BLOCKS[id].light) || 0,
      opaque: (id) => {
        if (id === 0) return false;
        const b = BLOCKS[id];
        return b ? (b.solid !== false && !b.glass) : true;
      },
    };
  }

  /* ---------- 增光 BFS(两通道共用) ----------
     q 为扁平队列(4 元组 x,y,z,级; 指针出队免 shift)。种子级即弹出级:
     computeAll 的源格 / updateEdit 的边界存活光与重照源都自带级;
     邻级 −1, 只增写(nv > 现值才写入并入队), 挡光格不入不传 */
  function bfsIncrease(read, W, D, H, policy, field, q, touch) {
    let qi = 0;
    while (qi < q.length) {
      const x = q[qi]; const y = q[qi + 1]; const z = q[qi + 2]; let v = q[qi + 3];
      qi += 4;
      const ci = (y * D + z) * W + x;
      if (v > field[ci]) { // 种子自身可能待写(撤光后重照的源格)
        field[ci] = v;
        if (touch) touch(x, y, z);
      } else if (v < field[ci]) {
        v = field[ci]; // 期间已被更亮路径抬升 → 按现行级扩散
      }
      for (const d of NEIGH6) {
        const nx = x + d[0]; const ny = y + d[1]; const nz = z + d[2];
        if (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= D) continue;
        if (policy.opaque(read(nx, ny, nz))) continue; // 挡光格不入不传
        const nv = v - 1;
        if (nv <= 0) continue; // 衰减到 0 = 照不到
        const ni = (ny * D + nz) * W + nx;
        if (nv > field[ni]) {
          field[ni] = nv;
          if (touch) touch(nx, ny, nz);
          q.push(nx, ny, nz, nv);
        }
      }
    }
  }

  /* ---------- 天空通道: 列直灌 + 横向 BFS ----------
     直灌: 每列自顶向下到首个挡光块全写 15(挡光格与以下保持 0);
     种子: 直灌格中「贴着更高邻列」的格(邻列在该高度非直灌才可能横向
     外溢), 高度取四邻列顶最大; 界外邻列不产生种子(世界外无天光侧灌)。
     BFS 与方块通道同款增光(六邻全向 −1): 「垂直下落不衰减」已被列直灌
     包含 — 同列的 15 只可能来自直灌(横向传播最高 14), 挡光顶块之下的
     同列格只能靠横向绕入, 全向 −1 即 MC 语义等价 */
  function skyCompute(read, W, D, H, policy, sky) {
    const top = new Int16Array(W * D); // 每列首个挡光块的 y(全透列 = -1)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        let y = H - 1;
        for (; y >= 0; y--) {
          if (policy.opaque(read(x, y, z))) break;
          sky[(y * D + z) * W + x] = 15;
        }
        top[z * W + x] = y;
      }
    }
    const q = [];
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        const t = top[z * W + x];
        let maxN = -1; // 四邻列(界内)顶高最大 — 高过本列直灌带的邻列才有外溢
        if (x > 0 && top[z * W + x - 1] > maxN) maxN = top[z * W + x - 1];
        if (x < W - 1 && top[z * W + x + 1] > maxN) maxN = top[z * W + x + 1];
        if (z > 0 && top[(z - 1) * W + x] > maxN) maxN = top[(z - 1) * W + x];
        if (z < D - 1 && top[(z + 1) * W + x] > maxN) maxN = top[(z + 1) * W + x];
        const yHi = Math.min(H - 1, maxN);
        for (let y = t + 1; y <= yHi; y++) q.push(x, y, z, 15);
      }
    }
    bfsIncrease(read, W, D, H, policy, sky, q, null);
  }

  /* ---------- 全量计算: 装场 seam(loadScene 一次调用) ----------
     先双双清零再算 — 光场永远是方块场的纯派生(差异 #14: 不落盘),
     全量即权威。方块通道逐格找光源做增光 BFS; 天空通道列直灌+横向 */
  function computeAll(read, W, D, H, policy, sky, block) {
    sky.fill(0);
    block.fill(0);
    const q = [];
    for (let y = 0; y < H; y++) {
      for (let z = 0; z < D; z++) {
        const row = (y * D + z) * W;
        for (let x = 0; x < W; x++) {
          const e = policy.lightOf(read(x, y, z));
          if (e > 0 && e > block[row + x]) {
            block[row + x] = e; // 光源格自亮(挡光也不例外, MC 灯口径)
            q.push(x, y, z, e);
          }
        }
      }
    }
    bfsIncrease(read, W, D, H, policy, block, q, null);
    skyCompute(read, W, D, H, policy, sky);
  }

  /* ---------- 天空通道增量: 编辑列 ±14 列带区域重算(保不变量) ----------
     挖高/填低只会改本列直灌带, 光值扰动经 ≤15 级衰减横向最多传 14 列
     (界外格的理论新值 ≤ 15−15 = 0, 不可能变) — 列带清零重灌 + 局部 BFS:
     ① 区域列自列顶重灌(直灌 15 至首个挡光块, 其下清 0);
     ② 种子: 直灌格中贴更高邻列者(邻列该高度非直灌才可能外溢; 界外邻列
        不算 — 跨界光流由③的边界现值承担);
     ③ 边界条件: 区域外墙一圈现存光作种子向内照(墙外光场不动且恒正确)。
     BFS 只增写 → 墙外格的候选值恒 ≤ 现值, 天然不外溢, 无需钳制 */
  function skyRegion(read, W, D, H, policy, sky, x, z, touch) {
    const x0 = Math.max(0, x - 14); const x1 = Math.min(W - 1, x + 14);
    const z0 = Math.max(0, z - 14); const z1 = Math.min(D - 1, z + 14);
    const rw = x1 - x0 + 1;
    const top = new Int16Array(rw * (z1 - z0 + 1)); // 区域列顶(首个挡光块 y, 全透 -1)
    const q = [];
    /* ① 先全列重灌再选种 — 种子要读四邻列顶, 必须等 top 表完整 */
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        let y = H - 1;
        for (; y >= 0; y--) { // 直灌带(变化才 touch)
          if (policy.opaque(read(cx, y, cz))) break;
          const ii = (y * D + cz) * W + cx;
          if (sky[ii] !== 15) {
            sky[ii] = 15;
            touch(cx, y, cz);
          }
        }
        top[(cz - z0) * rw + (cx - x0)] = y;
        for (; y >= 0; y--) { // 挡光顶以下清 0(变化才 touch)
          const ii = (y * D + cz) * W + cx;
          if (sky[ii] !== 0) {
            sky[ii] = 0;
            touch(cx, y, cz);
          }
        }
      }
    }
    /* ② 种子: 直灌格中贴更高邻列者(界外邻列不算 — 跨界光流走③边界种子) */
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const ci2 = (cz - z0) * rw + (cx - x0);
        const t = top[ci2];
        let maxN = -1;
        if (cx > x0 && top[ci2 - 1] > maxN) maxN = top[ci2 - 1];
        if (cx < x1 && top[ci2 + 1] > maxN) maxN = top[ci2 + 1];
        if (cz > z0 && top[ci2 - rw] > maxN) maxN = top[ci2 - rw];
        if (cz < z1 && top[ci2 + rw] > maxN) maxN = top[ci2 + rw];
        const yHi = Math.min(H - 1, maxN);
        for (let y = t + 1; y <= yHi; y++) q.push(cx, y, cz, 15);
      }
    }
    /* ③ 区域外墙一圈(x0−1/x1+1/z0−1/z1+1 四面, 角格非六邻接不入) */
    const wallSeed = (cx, cz) => {
      for (let y = 0; y < H; y++) {
        const ii = (y * D + cz) * W + cx;
        if (sky[ii] > 1 && !policy.opaque(read(cx, y, cz))) q.push(cx, y, cz, sky[ii]);
      }
    };
    if (x0 > 0) for (let cz = z0; cz <= z1; cz++) wallSeed(x0 - 1, cz);
    if (x1 < W - 1) for (let cz = z0; cz <= z1; cz++) wallSeed(x1 + 1, cz);
    if (z0 > 0) for (let cx = x0; cx <= x1; cx++) wallSeed(cx, z0 - 1);
    if (z1 < D - 1) for (let cx = x0; cx <= x1; cx++) wallSeed(cx, z1 + 1);
    bfsIncrease(read, W, D, H, policy, sky, q, touch);
  }

  /* ---------- 增量更新: 单格编辑(编辑后方块态已就位, oldId = 编辑前) ----------
     方块通道增/撤两趟 BFS(经典 increase/decrease):
     · 撤光  编辑格旧光 > 0 且(新格挡光 | 旧格是光源) — 源没了或过路光
       断路, 自编辑格清零起撤: 邻格旧值 < 传播级(可能源自本路)一并清零
       续撤; ≥ 传播级的是独立光边界, 记为重照种子; 误清的光源格按自身
       发射级重照自愈。撤光半径受光级衰减天然 ≤15。
     · 挖开  旧格挡光新格透光 — 周边光涌入新孔(邻格作增光种子)。
     · 增源  新格发光 — 写入发射级入队。
     天空通道走 skyRegion 列带重算。返回脏格包围盒(双通道实际变化格的
     并集), 无变化返 null — D4 消费方据此 markDirty */
  function updateEdit(read, W, D, H, policy, x, y, z, oldId, sky, block) {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return null;
    let bx0 = Infinity; let by0 = Infinity; let bz0 = Infinity;
    let bx1 = -1; let by1 = -1; let bz1 = -1;
    const touch = (tx, ty, tz) => {
      if (tx < bx0) bx0 = tx;
      if (ty < by0) by0 = ty;
      if (tz < bz0) bz0 = tz;
      if (tx > bx1) bx1 = tx;
      if (ty > by1) by1 = ty;
      if (tz > bz1) bz1 = tz;
    };
    const pi = (y * D + z) * W + x;
    const eOld = policy.lightOf(oldId);
    const newId = read(x, y, z);
    const eNew = policy.lightOf(newId);
    const opOld = policy.opaque(oldId);
    const opNew = policy.opaque(newId);
    const lv = block[pi];
    const relight = []; // 第二趟增光种子(4 元组)
    if (lv > 0 && (opNew || eOld > 0)) {
      /* 撤光: 编辑格旧光清零起撤(源头消失/替换 或 本格被封死断路) */
      block[pi] = 0;
      touch(x, y, z);
      const uq = [x, y, z, lv];
      let qi = 0;
      while (qi < uq.length) {
        const cx = uq[qi]; const cy = uq[qi + 1]; const cz = uq[qi + 2]; const cl = uq[qi + 3];
        qi += 4;
        for (const d of NEIGH6) {
          const nx = cx + d[0]; const ny = cy + d[1]; const nz = cz + d[2];
          if (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= D) continue;
          const ni = (ny * D + nz) * W + nx;
          const nl = block[ni];
          if (nl === 0) continue; // 已暗: 撤无可撤, 也不是边界
          if (nl < cl) { // 旧值−1 ≥ 邻值 → 可能源自本撤路, 清零续撤
            block[ni] = 0;
            touch(nx, ny, nz);
            uq.push(nx, ny, nz, nl);
            const e = policy.lightOf(read(nx, ny, nz));
            if (e > 0) relight.push(nx, ny, nz, e); // 误清的真源按发射级自愈
          } else { // 独立光边界: 第二趟从这里重新照进清零区
            relight.push(nx, ny, nz, nl);
          }
        }
      }
    } else if (opOld && !opNew) {
      /* 挖开: 挡光格变透光, 周边现存光作种子涌入新孔(级 ≤1 照不动) */
      for (const d of NEIGH6) {
        const nx = x + d[0]; const ny = y + d[1]; const nz = z + d[2];
        if (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= D) continue;
        const nl = block[(ny * D + nz) * W + nx];
        if (nl > 1) relight.push(nx, ny, nz, nl);
      }
    }
    if (eNew > 0) { // 增源(含光源换光源: 撤完重立)
      if (eNew > block[pi]) {
        block[pi] = eNew;
        touch(x, y, z);
      }
      relight.push(x, y, z, block[pi]);
    }
    if (relight.length) bfsIncrease(read, W, D, H, policy, block, relight, touch);
    skyRegion(read, W, D, H, policy, sky, x, z, touch);
    return bx1 < 0 ? null : {x0: bx0, y0: by0, z0: bz0, x1: bx1, y1: by1, z1: bz1};
  }

  return {mkPolicy, computeAll, updateEdit};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LightCore;
