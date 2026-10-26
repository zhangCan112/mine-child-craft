'use strict';
/* ============================================================
   SceneKit — 场景搭建小工具, 坐在体素模型(voxel.js)之上
   fill: 长方体填充 · tree: 树 · rand: 确定性散布散列
    · heightAt: 确定性高度场(纯函数, 不碰 voxel 全局)
   依赖 voxel 的全局词法(setBlockRaw/getBlock/hashRand),
   与 build/arena 的加载序: voxel → 本文件 → 使用方
   rand 即原 build.js 的 fxHash: hashRand 部分区间输出截断在
   0.5 以下不适合散布, 故散布专用此散列(家从 build 移来)。
   heightAt 例外: 16×16 控制格散布(自身 rand)→双线性插值→
   Math.round 整格阶梯化, 零 THREE 零 DOM 零玩法知识;
   相邻控制值差 ≤2×幅度界 ⇒ 插值斜率 <1 ⇒ 全图相邻高差 ≤1
============================================================ */
const SceneKit = {
  fill(x1, y1, z1, x2, y2, z2, id) {
    for (let x=x1; x<=x2; x++) {
      for (let y=y1; y<=y2; y++) {
        for (let z=z1; z<=z2; z++) setBlockRaw(x, y, z, id);
      }
    }
  },
  tree(x, baseY, z) {
    const th = 4 + Math.floor(hashRand(x+7, z+3)*3);
    for (let i=0; i<th; i++) setBlockRaw(x, baseY+i, z, 5);
    const top = baseY+th;
    for (let dy=-1; dy<=1; dy++) {
      const rad = dy===1?1:2;
      for (let dx=-rad; dx<=rad; dx++) {
        for (let dz=-rad; dz<=rad; dz++) {
          if (dx===0&&dz===0&&dy<1) continue;
          if (Math.abs(dx)===rad&&Math.abs(dz)===rad&&rad===2) continue;
          const lx=x+dx; const ly=top+dy-1; const lz=z+dz;
          if (getBlock(lx, ly, lz)===0) setBlockRaw(lx, ly, lz, 7);
        }
      }
    }
    setBlockRaw(x, top, z, 7);
  },
  rand(x, z, salt) {
    let n = ((x+salt)*2654435761 ^ (z-salt)*340573321) >>> 0;
    n = (n ^ (n>>>13)) >>> 0;
    n = (n + 0x9e3779b9) >>> 0;
    n = (n ^ (n>>>16)) >>> 0;
    return n / 4294967295;
  },
  /* 确定性高度场: 世界按 16×16 分控制格, 格点值 = rand 散布到 [-amp,amp],
     四格点双线性插值后 Math.round 整格阶梯化。同参同值, 零 Math.random。
     opts: {salt 哈希盐, amp 幅度} */
  heightAt(x, z, opts) {
    const o = opts || {};
    const salt = o.salt || 0;
    const amp = o.amp === undefined ? 3 : o.amp;
    const i = Math.floor(x / 16); const j = Math.floor(z / 16);
    const t = (x - i * 16) / 16; const s = (z - j * 16) / 16;
    const v = (ci, cj) => (SceneKit.rand(ci, cj, salt) * 2 - 1) * amp;
    const a = v(i, j); const b = v(i + 1, j);
    const c = v(i, j + 1); const d = v(i + 1, j + 1);
    const f = (1 - t) * ((1 - s) * a + s * c) + t * ((1 - s) * b + s * d);
    return Math.round(f);
  },
};
