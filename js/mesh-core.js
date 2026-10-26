'use strict';
/* ============================================================
   网格化核心 (MeshCore) — 引擎层纯核心 (术语见 GLOSSARY.md)
   ------------------------------------------------------------
   区块数据 → 顶点裸数组 的纯变换: 全细节四通道(实心/玻璃/TNT贴图/
   方块图集 texture-atlas)与 LOD 降采样粗网格。零 THREE · 零 DOM ·
   加载零副作用 →
   Node 可直接加载单测; 同一份代码在主线程(world.js 兜底路径)与
   Worker(js/mesh-worker.js, http 服务下的主路径)里运行。
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/CHUNK/faceColor。
   图集布局经 opts.atlas 注入(texture-atlas.js 的 layout, 与 tntTiles
   同惯例): 未注入时入集方块回落纯色通道, 存量调用方零侵入。
   hashRand 由调用方注入(与 combat-core 同惯例: 纯核心零全局可变依赖,
   且 Worker 不加载体素模型 — 世界数据随消息传递, 不共享)。
   输入 pack = voxel.js packChunkData 的输出:
   { cells:Uint8Array(w*d*h), sky, block, w, d, h, border, bx, bz, yMax }
   (bx/bz 为 pack 原点的世界坐标; border=1 时含邻块边界圈供跨区块剔面;
   网格顶点坐标一律用世界坐标 — 与渲染/物理同一坐标系)。
   顶点光(D3, docs/mc-daylight-torch-design.md §4.1): 四通道每顶点产出
   sky/block 两个标量(值=等级/15) — 普通面取面朝向邻格光, 十字片/薄块取
   自身格(火把自亮), LOD 仅天空二值 0/15·block 恒 0; 无光照载荷的旧 pack
   回落全亮(sky 15 · block 0), 存量调用方零侵入。
   ============================================================ */

const MeshCore = (() => {
  /* 六面朝向表: dir 法线 · corners 四角(0/1 单位立方, 三角化序 0,1,2, 2,1,3 法线恒朝外) */
  const FACES = [
    {dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]]},
    {dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]]},
    {dir: [0, -1, 0], corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]]},
    {dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]]},
    {dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]]},
    {dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]},
  ];

  /* 面朝向 → UV (保证侧面文字不镜像; 从 world.js 原样迁入) */
  function faceUV(dir, cor) {
    let u; let v;
    if (dir[1] === 1) { // 顶
      u = cor[0]; v = 1-cor[2];
    } else if (dir[1] === -1) { // 底
      u = 1-cor[0]; v = 1-cor[2];
    } else if (dir[0] === 1) { // 东
      u = 1-cor[2]; v = cor[1];
    } else if (dir[0] === -1) { // 西
      u = cor[2]; v = cor[1];
    } else if (dir[2] === 1) { // 南
      u = cor[0]; v = cor[1];
    } else { // 北
      u = 1-cor[0]; v = cor[1];
    }
    return [u, v];
  }

  const mkCh = () => ({positions: [], colors: [], normals: [], indices: [], sky: [], block: [], n: 0});
  const mkTexCh = () => ({positions: [], uvs: [], normals: [], indices: [], sky: [], block: [], n: 0});

  /* 贴地薄块(引线/压力板/床): 不参与面剔除, 始终绘制一个扁盒子(跳过底面)。
     顶点光取自身格(设计稿 §4.1: 薄块无"面朝向邻格"概念, 光值=所在格)。
     逐面取 faceColor(昼夜 D3 兑现 D6 惰性 top 字段, §7.1): 床顶面=红毯 /
     侧=床架; 存量薄块(引线等)只有 all → 颜色零变化 */
  function pushThin(t, x, y, z, id, h, tint, lvSky, lvBlk) {
    for (let f=0; f<6; f++) {
      if (f===2) continue;
      const face = FACES[f];
      const col = faceColor(id, face.dir);
      for (let c=0; c<4; c++) {
        const cor = face.corners[c];
        t.positions.push(x+cor[0], y+cor[1]*h, z+cor[2]);
        t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        t.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
        t.sky.push(lvSky);
        t.block.push(lvBlk);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
  }

  /* 通用四边形: 按面朝向取单位角点, 各轴按尺寸缩放(cor∈{0,1} → 0/尺寸)
     y 轴用 y0+cor[1]*sy — 顶面 sy=0(共面), 裙边 y0=邻格顶 · sy=高差。
     LOD 顶点光: 仅天空二值(设计稿 §4.1, block 恒 0 — 火把点光不进 LOD) */
  function pushQuad(t, f, x, y0, z, sx, sy, sz, col, lvSky) {
    const face = FACES[f];
    for (let c=0; c<4; c++) {
      const cor = face.corners[c];
      t.positions.push(x+cor[0]*sx, y0+cor[1]*sy, z+cor[2]*sz);
      t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      t.colors.push(col[0], col[1], col[2]);
      t.sky.push(lvSky);
      t.block.push(0);
    }
    t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
    t.n += 4;
  }

  /* 十字面片(草丛/麦/火把/树苗等入集薄块): 两个对角面各正反两绘 —
     FrontSide 材质下双面可见; 几何占满格高, 视觉高度由贴图 alpha 裁切
     (world.js atlasMat 的 alphaTest), 麦四阶段的"渐高"画在像素里而非
     压扁几何(压扁会让植株比例失真)。
     顶点光取自身格(设计稿 §4.1: 火把自身格 block=14, 夜间自亮) */
  function pushCross(t, x, y, z, tile, cols, rows, lvSky, lvBlk) {
    const c = tile % cols; const r = Math.floor(tile / cols);
    const u0 = c/cols; const u1 = (c+1)/cols;
    const v0 = (rows-1-r)/rows; const v1 = (rows-r)/rows;
    const s = 0.7071; // 对角面法线水平分量(1/√2)
    /* corners 序 [bl, br, tl, tr]; 反向面角点镜像(UV 随之镜像, 背面图案不反) */
    const planes = [
      {p: [[0.1, 0, 0.1], [0.9, 0, 0.9], [0.1, 1, 0.1], [0.9, 1, 0.9]], n: [-s, 0, s], mirror: false},
      {p: [[0.9, 0, 0.9], [0.1, 0, 0.1], [0.9, 1, 0.9], [0.1, 1, 0.1]], n: [s, 0, -s], mirror: true},
      {p: [[0.9, 0, 0.1], [0.1, 0, 0.9], [0.9, 1, 0.1], [0.1, 1, 0.9]], n: [-s, 0, -s], mirror: false},
      {p: [[0.1, 0, 0.9], [0.9, 0, 0.1], [0.1, 1, 0.9], [0.9, 1, 0.1]], n: [s, 0, s], mirror: true},
    ];
    for (const pl of planes) {
      const us = pl.mirror ? [u1, u0, u1, u0] : [u0, u1, u0, u1];
      for (let i=0; i<4; i++) {
        t.positions.push(x+pl.p[i][0], y+pl.p[i][1], z+pl.p[i][2]);
        t.normals.push(pl.n[0], pl.n[1], pl.n[2]);
        t.uvs.push(us[i], i < 2 ? v0 : v1);
        t.sky.push(lvSky);
        t.block.push(lvBlk);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
  }

  /* 图集条目 → 面朝向格号(number 简写=六面同格; 分面条目按朝向取) */
  function atlasTileOf(entry, dir) {
    if (typeof entry === 'number') return entry;
    return dir[1] === 1 ? entry.top : (dir[1] === -1 ? entry.bottom : entry.side);
  }

  /* ---------- 全细节: 区块 → 实心/玻璃/TNT/图集 四通道顶点裸数组 ----------
     与原 world.js buildChunkGeometries 的几何逐字节同构(仅把 getBlock
     换成 pack 内读取 — 含边界圈, 跨区块剔面数据随消息自带) */
  function meshChunk(pack, opts) {
    const hashRand = opts.hashRand; const tiles = opts.tntTiles;
    const atlas = opts.atlas || null; // 图集布局可选: 缺省全走纯色通道(存量行为)
    const S = mkCh(); const G = mkCh(); const T = mkTexCh(); const A = mkTexCh();
    const cells = pack.cells; const w = pack.w; const d = pack.d; const h = pack.h;
    const border = pack.border; const bx = pack.bx; const bz = pack.bz; const yMax = pack.yMax;
    const lget = (lx, y, lz)=>{
      if (y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 0;
      return cells[(y*d+lz)*w+lx];
    };
    /* 光照取样(设计稿 §4.1): pack 的 sky/block 圈与 cells 同形(D2 契约),
       越界口径与 lightSkyAt/lightBlockAt 一致(sky 15 · block 0);
       无光照载荷的旧 pack 回落全亮(sky 15 · block 0) */
    const skyArr = pack.sky || null;
    const blkArr = pack.block || null;
    const lsky = (lx, y, lz)=>{
      if (!skyArr || y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 15;
      return skyArr[(y*d+lz)*w+lx];
    };
    const lblk = (lx, y, lz)=>{
      if (!blkArr || y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 0;
      return blkArr[(y*d+lz)*w+lx];
    };
    for (let lx=border; lx<border+CHUNK; lx++) {
      for (let lz=border; lz<border+CHUNK; lz++) {
        const wx = bx+lx; const wz = bz+lz; // 世界坐标: tint 哈希与现状连续
        for (let y=0; y<=yMax; y++) {
          const id = lget(lx, y, lz);
          if (id===0) continue;
          const b = BLOCKS[id];
          const ae = atlas ? atlas.tiles[id] : undefined;
          if (ae) { // 图集方块: 第 4 通道(薄块走十字面片, 立方体按面取格)
            if (b.thin) {
              pushCross(A, wx, y, wz, atlasTileOf(ae, [0, 0, 1]), atlas.cols, atlas.rows,
                  lsky(lx, y, lz)/15, lblk(lx, y, lz)/15);
              continue;
            }
            for (let f=0; f<6; f++) {
              const face = FACES[f];
              const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
              const nid = lget(nx, ny, nz);
              const nb = nid!==0 ? BLOCKS[nid] : null;
              if (nb && !nb.glass && !nb.thin) continue; // 剔面规则与实心通道一致
              const tile = atlasTileOf(ae, face.dir);
              const tc = tile % atlas.cols; const tr = Math.floor(tile / atlas.cols);
              const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
              for (let c=0; c<4; c++) {
                const cor = face.corners[c];
                A.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
                A.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                const uv = faceUV(face.dir, cor);
                // 画布 y 向下、纹理 v 向上: 第 0 行格占 v 最高段(与 tileUV 同换算)
                A.uvs.push((tc+uv[0])/atlas.cols, (atlas.rows-1-tr+uv[1])/atlas.rows);
                A.sky.push(fSky);
                A.block.push(fBlk);
              }
              A.indices.push(A.n, A.n+1, A.n+2, A.n+2, A.n+1, A.n+3);
              A.n += 4;
            }
            continue;
          }
          if (b.thin) { // 引线 / 压力板 / 床(顶点光取自身格, §4.1)
            pushThin(S, wx, y, wz, id, b.thin, 0.92 + hashRand(wx*3+wz, y)*0.12,
                lsky(lx, y, lz)/15, lblk(lx, y, lz)/15);
            continue;
          }
          if (b.tnt) { // TNT: 走贴图通道
            for (let f=0; f<6; f++) {
              const face = FACES[f];
              const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
              const nid = lget(nx, ny, nz);
              const nb = nid!==0 ? BLOCKS[nid] : null;
              if (nb && !nb.glass && !nb.thin) continue;
              // 顶/底/侧 (0 号格是 mipmap 缓冲垫)
              const tileV = face.dir[1]===1 ? tiles-1 : (face.dir[1]===-1 ? tiles-2 : tiles-3);
              const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
              for (let c=0; c<4; c++) {
                const cor = face.corners[c];
                T.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
                T.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                const uv = faceUV(face.dir, cor);
                T.uvs.push(uv[0], (tileV+uv[1])/tiles);
                T.sky.push(fSky);
                T.block.push(fBlk);
              }
              T.indices.push(T.n, T.n+1, T.n+2, T.n+2, T.n+1, T.n+3);
              T.n += 4;
            }
            continue;
          }
          const isGlass = !!b.glass;
          for (let f=0; f<6; f++) {
            const face = FACES[f];
            const nx = lx+face.dir[0]; const ny = y+face.dir[1]; const nz = lz+face.dir[2];
            const nid = lget(nx, ny, nz);
            const nb = nid!==0 ? BLOCKS[nid] : null;
            let target;
            if (isGlass) {
              if (nb && !nb.thin) continue; // 玻璃只对着空气/薄块显示面
              target = G;
            } else {
              if (nb && !nb.glass && !nb.thin) continue; // 实心面被实心邻居遮挡才剔除
              target = S;
            }
            const col = faceColor(id, face.dir);
            const tint = isGlass ? 1 : (0.92 + hashRand(wx*3+wz, y)*0.12);
            const fSky = lsky(nx, ny, nz)/15; const fBlk = lblk(nx, ny, nz)/15;
            for (let c=0; c<4; c++) {
              const cor = face.corners[c];
              target.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
              target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
              target.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
              target.sky.push(fSky);
              target.block.push(fBlk);
            }
            target.indices.push(target.n, target.n+1, target.n+2, target.n+2, target.n+1, target.n+3);
            target.n += 4;
          }
        }
      }
    }
    return {solid: S.n>0 ? S : null, glass: G.n>0 ? G : null, tnt: T.n>0 ? T : null, atlas: A.n>0 ? A : null};
  }

  /* ---------- LOD 降采样: 区块 → 顶面+侧裙粗网格 (Distant Horizons 思路) ----------
     每格 step×step 列合并: 格高 = 列表面最大高(薄块不算表面), 顶色取
     最高列的顶面方块。相邻格矮差处出裙边; 区块周界对 0 出裙边(藏在
     地形内部不可见, 格差处呈现为阶梯 — 体素风允许的误差)。 */
  function meshChunkLod(pack, opts) {
    const step = (CHUNK % opts.step === 0) ? opts.step : 2; // 非整除护栏: 静默丢边缘格不如回落
    const cells = pack.cells; const w = pack.w; const d = pack.d;
    const bx = pack.bx; const bz = pack.bz; const yMax = pack.yMax;
    /* 合并列顶面之上的天空光 → 二值 0/15(设计稿 §4.1): 直灌带恒 15, 阈值 8
       只是量化口径; 无光照载荷回落全亮。aBlock 恒 0 由 pushQuad 落实 */
    const skyArr = pack.sky || null;
    const lodSky = (lx, lz, top)=>{
      if (!skyArr) return 15;
      const sy = top + 1;
      if (sy >= pack.h) return 15; // 世界顶之上 = 敞开天光
      return skyArr[(sy*d + lz)*w + lx] >= 8 ? 15 : 0;
    };
    const n = Math.floor(CHUNK/step);
    const hs = new Int16Array(n*n); // 格高(-1=空格)
    const ids = new Uint8Array(n*n); // 格顶面方块 id
    for (let gx=0; gx<n; gx++) {
      for (let gz=0; gz<n; gz++) {
        let hTop = -1; let idTop = 0;
        for (let sx=0; sx<step; sx++) {
          for (let sz=0; sz<step; sz++) {
            const lx = gx*step+sx; const lz = gz*step+sz;
            for (let y=yMax; y>=0; y--) { // 自上而下找表面(跳过薄块)
              const id = cells[(y*d+lz)*w+lx];
              if (id!==0 && !BLOCKS[id].thin) {
                if (y > hTop) {
                  hTop = y; idTop = id;
                }
                break;
              }
            }
          }
        }
        hs[gx*n+gz] = hTop; ids[gx*n+gz] = idTop;
      }
    }
    const S = mkCh();
    for (let gx=0; gx<n; gx++) {
      for (let gz=0; gz<n; gz++) {
        const h = hs[gx*n+gz]; const id = ids[gx*n+gz];
        if (h < 0) continue;
        const X = bx+gx*step; const Z = bz+gz*step; const topY = h+1;
        const lvSky = lodSky(gx*step, gz*step, h)/15; // 合并列一格一值: 顶面与裙边共用
        pushQuad(S, 3, X, topY, Z, step, 0, step, faceColor(id, [0, 1, 0]), lvSky); // 顶面
        const side = faceColor(id, [1, 0, 0]);
        const nh = (nx, nz)=> (nx<0||nz<0||nx>=n||nz>=n) ? -1 : hs[nx*n+nz]; // 周界外按 -1 → 裙边到地
        const emit = (f, X0, Z0, sx, sz, hN)=>{ // 邻格顶 hN+1..topY
          if (h > hN) pushQuad(S, f, X0, hN+1, Z0, sx, topY-(hN+1), sz, side, lvSky);
        };
        emit(1, X+step, Z, 0, step, nh(gx+1, gz)); // +X
        emit(0, X, Z, 0, step, nh(gx-1, gz)); // -X
        emit(5, X, Z+step, step, 0, nh(gx, gz+1)); // +Z
        emit(4, X, Z, step, 0, nh(gx, gz-1)); // -Z
      }
    }
    return {solid: S.n>0 ? S : null};
  }

  return {meshChunk, meshChunkLod};
})();
