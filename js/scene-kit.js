'use strict';
/* ============================================================
   SceneKit — 场景搭建小工具, 坐在体素模型(voxel.js)之上
   fill: 长方体填充 · tree: 树 · rand: 确定性散布散列
   依赖 voxel 的全局词法(setBlockRaw/getBlock/hashRand),
   与 tnt-levels/build/arena 的加载序: voxel → 本文件 → 使用方
   rand 即原 build.js 的 fxHash: hashRand 部分区间输出截断在
   0.5 以下不适合散布, 故散布专用此散列(家从 build 移来)
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
};
