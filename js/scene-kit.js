'use strict';
/* ============================================================
   SceneKit — 场景搭建小工具, 坐在体素模型(voxel.js)之上
   ------------------------------------------------------------
   一句话职责: 填充、树家族(树形几何单一权威)、确定性散布与高度场,
   藏住全部体素写读细节; 调用方只需给坐标与盐。
   interface: fill(长方体填充) · 树家族四成员——tree(圆冠, 可选盐,
     缺省 hashRand 干高口径, 既有调用点零改动兼容) / pine(锥冠, 盐必传) /
     pineSnowy(覆雪锥冠, snowLeafId 由调用方注入) / scrub(矮丛, top=脚下
     表面格)——成员按形命名不按图命名; 几何归此, 落位政策(立面包门禁/
     雪根座/散布密度)留调用方; 越界守卫在家族内核(界外格不写, 防平面
     数组回卷污染对侧缘——北带 z=1 冠层事故在案) · rand(确定性散布散列) ·
     heightAt(确定性高度场, 纯函数不碰 voxel 全局)
   依赖(均经全局名, 调用期解析): voxel.js 的 setBlockRaw/getBlock/hashRand +
     config.js 的 WORLD_W/WORLD_D(树家族守卫读世界尺寸, 与 voxel 同一
     全局词法通道), 加载序: voxel → 本文件 → 使用方
   可测性声明: 零 THREE 零 DOM; heightAt 纯函数装载直测, 树家族带
     voxel 件装载直测(test/scene-kit.test.js)
   ------------------------------------------------------------
   树家族收编(2026-11-12, 六份散装树函数归一): 圆冠=SceneKit.tree+
     advEdgeEastTree 抄本 · 锥冠=advPineTree+advSnowTree 逐字同体抄本+
     advEdgeNorthSpruce 内部调用 · 矮丛=advEdgeSouthScrub 几何段。
     随收编撤销两处树形抄本备案(S3): adventure-core.js advPineTree 与
     adventure-maps-core.js advSnowTree 的「同形保留备案」注释随函数
     删除而消, 撤销记录落此 + GLOSSARY「SceneKit」词条。
   rand 即原 build.js 的 fxHash: hashRand 部分区间输出截断在
   0.5 以下不适合散布, 故散布专用此散列(家从 build 移来)。
   heightAt 例外: 16×16 控制格散布(自身 rand)→双线性插值→
   Math.round 整格阶梯化, 零 THREE 零 DOM 零玩法知识;
   相邻控制值差 ≤2×幅度界 ⇒ 插值斜率 <1 ⇒ 全图相邻高差 ≤1
============================================================ */
/* 树家族私有内核·干高公式单份: 圆冠/锥冠共用 4+⌊r·3⌋; r 缺省走
   hashRand(橡树缺省口径——其输出全域截断 <0.5, 干高恒 {4,5}), 传盐走
   SceneKit.rand(干高 {4,5,6})。scrub 矮干是另一形, 公式自持在成员内 */
function skTrunkH(x, z, salt) {
  const r = salt === undefined ? hashRand(x + 7, z + 3) : SceneKit.rand(x + 7, z + 3, salt);
  return 4 + Math.floor(r * 3);
}

/* 树家族私有内核·越界守卫单份: 界外格不写——setBlockRaw 无界检查,
   平面数组下标回卷会污染对侧缘(北带 z=1 冠层事故在案, 见
   adventure-core.js advEdgeNorthFar 注); 对界内格纯空转, 等价不破 */
function skInWorld(x, z) {
  return x >= 0 && x < WORLD_W && z >= 0 && z < WORLD_D;
}

const SceneKit = {
  fill(x1, y1, z1, x2, y2, z2, id) {
    for (let x=x1; x<=x2; x++) {
      for (let y=y1; y<=y2; y++) {
        for (let z=z1; z<=z2; z++) setBlockRaw(x, y, z, id);
      }
    }
  },
  /* 圆冠橡树: 干 4~5 高(缺省 hashRand 口径)+两层 rad2 圆冠(削角+让位
     树干)+顶层 rad1 小冠+顶帽; 冠叶只落空气格。第 4 参可选盐: 传盐干高
     换 SceneKit.rand 口径({4,5,6}), 冠形不变(东带贴边树消费) */
  tree(x, baseY, z, salt) {
    if (!skInWorld(x, z)) return;
    const th = skTrunkH(x, z, salt);
    for (let i=0; i<th; i++) setBlockRaw(x, baseY+i, z, 5);
    const top = baseY+th;
    for (let dy=-1; dy<=1; dy++) {
      const rad = dy===1?1:2;
      for (let dx=-rad; dx<=rad; dx++) {
        for (let dz=-rad; dz<=rad; dz++) {
          if (dx===0&&dz===0&&dy<1) continue;
          if (Math.abs(dx)===rad&&Math.abs(dz)===rad&&rad===2) continue;
          const lx=x+dx; const ly=top+dy-1; const lz=z+dz;
          if (!skInWorld(lx, lz)) continue;
          if (getBlock(lx, ly, lz)===0) setBlockRaw(lx, ly, lz, 7);
        }
      }
    }
    setBlockRaw(x, top, z, 7);
  },
  /* 锥冠松/杉(同形换盐, 不按图命名): 干 4~6 高+锥形叶冠(下宽上尖+
     顶帽), 冠叶只落空气格、叶贴干 ≤2 格; 盐必传(消费方恒传) */
  pine(x, baseY, z, salt) {
    if (!skInWorld(x, z)) return;
    const th = skTrunkH(x, z, salt);
    for (let i=0; i<th; i++) setBlockRaw(x, baseY+i, z, 5);
    const top = baseY+th;
    for (let ly=baseY+2; ly<=top; ly++) {
      const rad = ly >= top-1 ? 1 : 2;
      for (let dx=-rad; dx<=rad; dx++) {
        for (let dz=-rad; dz<=rad; dz++) {
          if (dx===0&&dz===0&&ly<top) continue; /* 让位树干 */
          if (Math.abs(dx)===rad&&Math.abs(dz)===rad&&rad===2) continue; /* 削角 */
          const lx=x+dx; const lz=z+dz;
          if (!skInWorld(lx, lz)) continue;
          if (getBlock(lx, ly, lz)===0) setBlockRaw(lx, ly, lz, 7);
        }
      }
    }
    setBlockRaw(x, top+1, z, 7); /* 顶帽 */
  },
  /* 覆雪锥冠: 先按 pine 落绿冠, 再两遍式置换——冠顶 crown 与冠肩
     crown-1 的正交四叶读到的 7 叶换 snowLeafId(邻位既有 7 也换, 单遍
     直写不等价), crown+1 顶帽无条件换; crown=baseY+干高 家族内部派生;
     材质注入: 引擎不知雪叶 id, 调用方传(北带杉传 B_SNOWY_LEAVES) */
  pineSnowy(x, baseY, z, salt, snowLeafId) {
    if (!skInWorld(x, z)) return;
    SceneKit.pine(x, baseY, z, salt);
    const crown = baseY + skTrunkH(x, z, salt);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (getBlock(x+dx, crown, z+dz)===7) setBlockRaw(x+dx, crown, z+dz, snowLeafId);
      if (getBlock(x+dx, crown-1, z+dz)===7) setBlockRaw(x+dx, crown-1, z+dz, snowLeafId);
    }
    setBlockRaw(x, crown+1, z, snowLeafId);
  },
  /* 矮丛: 干 1~2 高+3×3 缺角扁冠+顶心, 冠叶只落空气格; top=脚下表面格,
     干从 top+1 起; 角缺省判据是角格自身坐标的 rand(salt+1) */
  scrub(x, top, z, salt) {
    if (!skInWorld(x, z)) return;
    const th = 1 + (SceneKit.rand(x, z, salt) > 0.5 ? 1 : 0);
    for (let i=1; i<=th; i++) setBlockRaw(x, top+i, z, 5);
    const cy = top+th+1; /* 冠心层 */
    for (let dx=-1; dx<=1; dx++) {
      for (let dz=-1; dz<=1; dz++) {
        if (Math.abs(dx)===1&&Math.abs(dz)===1&&SceneKit.rand(x+dx, z+dz, salt+1) > 0.5) continue;
        const lx=x+dx; const lz=z+dz;
        if (!skInWorld(lx, lz)) continue;
        if (getBlock(lx, cy, lz)===0) setBlockRaw(lx, cy, lz, 7);
      }
    }
    if (getBlock(x, cy+1, z)===0) setBlockRaw(x, cy+1, z, 7); /* 顶心 */
  },
  rand(x, z, salt) {
    let n = ((x+salt)*2654435761 ^ (z-salt)*340573321) >>> 0;
    n = (n ^ (n>>>13)) >>> 0;
    n = (n + 0x9e3779b9) >>> 0;
    n = (n ^ (n>>>16)) >>> 0;
    return n / 4294967295;
  },
  /* 确定性高度场: 世界按 16×16 分控制格, 格点值 = rand 散布到 ±amp(amp
     支持每控制格函数)再按压平圆向 base 过渡, 四格点双线性插值后
     Math.round 整格阶梯化。同参同值, 零 Math.random。
     opts: {salt 哈希盐, amp 幅度 = 数值|(i,j)=>数值(均逐格钳 [0,3]),
     base 压平基准(钳 [-3,3]), flats 压平圆列表 [{cx,cz,r}]} */
  heightAt(x, z, opts) {
    const o = opts || {};
    const salt = o.salt || 0;
    /* 幅度界红线 ±3: amp 支持数值或 (i,j)=>数值(每控制格幅度, T5 圈层
       口径), 逐格钳 [0,3], 非法值回落 0。相邻控制值差恒 ≤ 2×3 →
       插值斜率 ≤ 6/16 < 1 → 全图相邻高差 ≤ 1(坡度红线) */
    const ampOf = typeof o.amp === 'function' ?
        o.amp : () => o.amp === undefined ? 3 : o.amp;
    const base = Math.max(-3, Math.min(3, o.base || 0));
    const flats = o.flats || [];
    const i = Math.floor(x / 16); const j = Math.floor(z / 16);
    const t = (x - i * 16) / 16; const s = (z - j * 16) / 16;
    /* 格点值: 散布 ±amp; 压平圆心距 ≤r 的格点回落 base, 圆外 16 格
       渐变带线性过渡 —— 平滑全发生在控制值层面, 边缘斜坡由双线性
       天然摊平, 压平区边缘不出 2 格断崖; 多圆逐次混合 = 并集向 base */
    const v = (ci, cj) => {
      const amp = Math.max(0, Math.min(3, ampOf(ci, cj) || 0));
      let out = (SceneKit.rand(ci, cj, salt) * 2 - 1) * amp;
      const px = ci * 16; const pz = cj * 16;
      for (let k = 0; k < flats.length; k++) {
        const c = flats[k];
        const dx = px - c.cx; const dz = pz - c.cz;
        const w = Math.max(0, Math.min(1,
            (c.r + 16 - Math.sqrt(dx * dx + dz * dz)) / 16));
        out = out * (1 - w) + base * w;
      }
      return out;
    };
    const a = v(i, j); const b = v(i + 1, j);
    const c = v(i, j + 1); const d = v(i + 1, j + 1);
    const f = (1 - t) * ((1 - s) * a + s * c) + t * ((1 - s) * b + s * d);
    return Math.round(f);
  },
};
