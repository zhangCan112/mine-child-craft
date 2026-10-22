"use strict";
/* ============================================================
   网格化核心 (MeshCore) — 引擎层纯核心 (术语见 GLOSSARY.md)
   ------------------------------------------------------------
   区块数据 → 顶点裸数组 的纯变换: 全细节三通道(实心/玻璃/TNT贴图)
   与 LOD 降采样粗网格。零 THREE · 零 DOM · 加载零副作用 →
   Node 可直接加载单测; 同一份代码在主线程(world.js 兜底路径)与
   Worker(js/mesh-worker.js, http 服务下的主路径)里运行。
   依赖(均经全局名, 调用期解析): config.js 的 BLOCKS/CHUNK/faceColor。
   hashRand 由调用方注入(与 combat-core 同惯例: 纯核心零全局可变依赖,
   且 Worker 不加载体素模型 — 世界数据随消息传递, 不共享)。
   输入 pack = voxel.js packChunkData 的输出:
   { cells:Uint8Array(w*d*h), w, d, h, border, bx, bz, yMax }
   (bx/bz 为 pack 原点的世界坐标; border=1 时含邻块边界圈供跨区块剔面;
   网格顶点坐标一律用世界坐标 — 与渲染/物理同一坐标系)
   ============================================================ */

const MeshCore = (() => {

  /* 六面朝向表: dir 法线 · corners 四角(0/1 单位立方, 三角化序 0,1,2, 2,1,3 法线恒朝外) */
  const FACES = [
    { dir:[-1,0,0], corners:[ [0,1,0],[0,0,0],[0,1,1],[0,0,1] ] },
    { dir:[ 1,0,0], corners:[ [1,1,1],[1,0,1],[1,1,0],[1,0,0] ] },
    { dir:[0,-1,0], corners:[ [1,0,1],[0,0,1],[1,0,0],[0,0,0] ] },
    { dir:[0, 1,0], corners:[ [0,1,1],[1,1,1],[0,1,0],[1,1,0] ] },
    { dir:[0,0,-1], corners:[ [1,0,0],[0,0,0],[1,1,0],[0,1,0] ] },
    { dir:[0,0, 1], corners:[ [0,0,1],[1,0,1],[0,1,1],[1,1,1] ] }
  ];

  /* 面朝向 → UV (保证侧面文字不镜像; 从 world.js 原样迁入) */
  function faceUV(dir, cor){
    let u, v;
    if(dir[1] === 1)       { u = cor[0];   v = 1-cor[2]; }   // 顶
    else if(dir[1] === -1) { u = 1-cor[0]; v = 1-cor[2]; }   // 底
    else if(dir[0] === 1)  { u = 1-cor[2]; v = cor[1];   }   // 东
    else if(dir[0] === -1) { u = cor[2];   v = cor[1];   }   // 西
    else if(dir[2] === 1)  { u = cor[0];   v = cor[1];   }   // 南
    else                   { u = 1-cor[0]; v = cor[1];   }   // 北
    return [u, v];
  }

  const mkCh    = () => ({ positions:[], colors:[], normals:[], indices:[], n:0 });
  const mkTexCh = () => ({ positions:[], uvs:[],     normals:[], indices:[], n:0 });

  /* 贴地薄块(引线/压力板): 不参与面剔除, 始终绘制一个扁盒子(跳过底面) */
  function pushThin(t, x, y, z, h, col, tint){
    for(let f=0; f<6; f++){
      if(f===2) continue;
      const face = FACES[f];
      for(let c=0;c<4;c++){
        const cor = face.corners[c];
        t.positions.push(x+cor[0], y+cor[1]*h, z+cor[2]);
        t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
        t.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
      }
      t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
      t.n += 4;
    }
  }

  /* 通用四边形: 按面朝向取单位角点, 各轴按尺寸缩放(cor∈{0,1} → 0/尺寸)
     y 轴用 y0+cor[1]*sy — 顶面 sy=0(共面), 裙边 y0=邻格顶 · sy=高差 */
  function pushQuad(t, f, x, y0, z, sx, sy, sz, col){
    const face = FACES[f];
    for(let c=0;c<4;c++){
      const cor = face.corners[c];
      t.positions.push(x+cor[0]*sx, y0+cor[1]*sy, z+cor[2]*sz);
      t.normals.push(face.dir[0], face.dir[1], face.dir[2]);
      t.colors.push(col[0], col[1], col[2]);
    }
    t.indices.push(t.n, t.n+1, t.n+2, t.n+2, t.n+1, t.n+3);
    t.n += 4;
  }

  /* ---------- 全细节: 区块 → 实心/玻璃/TNT 三通道顶点裸数组 ----------
     与原 world.js buildChunkGeometries 的几何逐字节同构(仅把 getBlock
     换成 pack 内读取 — 含边界圈, 跨区块剔面数据随消息自带) */
  function meshChunk(pack, opts){
    const hashRand = opts.hashRand, tiles = opts.tntTiles;
    const S = mkCh(), G = mkCh(), T = mkTexCh();
    const cells = pack.cells, w = pack.w, d = pack.d, h = pack.h;
    const border = pack.border, bx = pack.bx, bz = pack.bz, yMax = pack.yMax;
    const lget = (lx,y,lz)=>{
      if(y<0 || y>=h || lx<0 || lz<0 || lx>=w || lz>=d) return 0;
      return cells[(y*d+lz)*w+lx];
    };
    for(let lx=border; lx<border+CHUNK; lx++){
      for(let lz=border; lz<border+CHUNK; lz++){
        const wx = bx+lx, wz = bz+lz;               // 世界坐标: tint 哈希与现状连续
        for(let y=0; y<=yMax; y++){
          const id = lget(lx,y,lz);
          if(id===0) continue;
          const b = BLOCKS[id];
          if(b.thin){                               // 引线 / 压力板
            pushThin(S, wx, y, wz, b.thin, b.all, 0.92 + hashRand(wx*3+wz, y)*0.12);
            continue;
          }
          if(b.tnt){                                // TNT: 走贴图通道
            for(let f=0; f<6; f++){
              const face = FACES[f];
              const nid = lget(lx+face.dir[0], y+face.dir[1], lz+face.dir[2]);
              const nb = nid!==0 ? BLOCKS[nid] : null;
              if(nb && !nb.glass && !nb.thin) continue;
              const tileV = face.dir[1]===1 ? tiles-1 : (face.dir[1]===-1 ? tiles-2 : tiles-3);  // 顶/底/侧 (0 号格是 mipmap 缓冲垫)
              for(let c=0;c<4;c++){
                const cor = face.corners[c];
                T.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
                T.normals.push(face.dir[0], face.dir[1], face.dir[2]);
                const uv = faceUV(face.dir, cor);
                T.uvs.push(uv[0], (tileV+uv[1])/tiles);
              }
              T.indices.push(T.n, T.n+1, T.n+2, T.n+2, T.n+1, T.n+3);
              T.n += 4;
            }
            continue;
          }
          const isGlass = !!b.glass;
          for(let f=0; f<6; f++){
            const face = FACES[f];
            const nid = lget(lx+face.dir[0], y+face.dir[1], lz+face.dir[2]);
            const nb = nid!==0 ? BLOCKS[nid] : null;
            let target;
            if(isGlass){
              if(nb && !nb.thin) continue;          // 玻璃只对着空气/薄块显示面
              target = G;
            } else {
              if(nb && !nb.glass && !nb.thin) continue; // 实心面被实心邻居遮挡才剔除
              target = S;
            }
            const col = faceColor(id, face.dir);
            const tint = isGlass ? 1 : (0.92 + hashRand(wx*3+wz, y)*0.12);
            for(let c=0;c<4;c++){
              const cor = face.corners[c];
              target.positions.push(wx+cor[0], y+cor[1], wz+cor[2]);
              target.normals.push(face.dir[0], face.dir[1], face.dir[2]);
              target.colors.push(col[0]*tint, col[1]*tint, col[2]*tint);
            }
            target.indices.push(target.n, target.n+1, target.n+2, target.n+2, target.n+1, target.n+3);
            target.n += 4;
          }
        }
      }
    }
    return { solid: S.n>0 ? S : null, glass: G.n>0 ? G : null, tnt: T.n>0 ? T : null };
  }

  /* ---------- LOD 降采样: 区块 → 顶面+侧裙粗网格 (Distant Horizons 思路) ----------
     每格 step×step 列合并: 格高 = 列表面最大高(薄块不算表面), 顶色取
     最高列的顶面方块。相邻格矮差处出裙边; 区块周界对 0 出裙边(藏在
     地形内部不可见, 格差处呈现为阶梯 — 体素风允许的误差)。 */
  function meshChunkLod(pack, opts){
    const step = (CHUNK % opts.step === 0) ? opts.step : 2;   // 非整除护栏: 静默丢边缘格不如回落
    const cells = pack.cells, w = pack.w, d = pack.d;
    const bx = pack.bx, bz = pack.bz, yMax = pack.yMax;
    const n = Math.floor(CHUNK/step);
    const hs  = new Int16Array(n*n);                // 格高(-1=空格)
    const ids = new Uint8Array(n*n);                // 格顶面方块 id
    for(let gx=0; gx<n; gx++){
      for(let gz=0; gz<n; gz++){
        let hTop = -1, idTop = 0;
        for(let sx=0; sx<step; sx++){
          for(let sz=0; sz<step; sz++){
            const lx = gx*step+sx, lz = gz*step+sz;
            for(let y=yMax; y>=0; y--){             // 自上而下找表面(跳过薄块)
              const id = cells[(y*d+lz)*w+lx];
              if(id!==0 && !BLOCKS[id].thin){
                if(y > hTop){ hTop = y; idTop = id; }
                break;
              }
            }
          }
        }
        hs[gx*n+gz] = hTop; ids[gx*n+gz] = idTop;
      }
    }
    const S = mkCh();
    for(let gx=0; gx<n; gx++){
      for(let gz=0; gz<n; gz++){
        const h = hs[gx*n+gz], id = ids[gx*n+gz];
        if(h < 0) continue;
        const X = bx+gx*step, Z = bz+gz*step, topY = h+1;
        pushQuad(S, 3, X, topY, Z, step, 0, step, faceColor(id, [0,1,0]));       // 顶面
        const side = faceColor(id, [1,0,0]);
        const nh = (nx,nz)=> (nx<0||nz<0||nx>=n||nz>=n) ? -1 : hs[nx*n+nz];      // 周界外按 -1 → 裙边到地
        const emit = (f, X0, Z0, sx, sz, hN)=>{                                   // 邻格顶 hN+1..topY
          if(h > hN) pushQuad(S, f, X0, hN+1, Z0, sx, topY-(hN+1), sz, side);
        };
        emit(1, X+step, Z,     0,      step, nh(gx+1,gz));                        // +X
        emit(0, X,     Z,      0,      step, nh(gx-1,gz));                        // -X
        emit(5, X,     Z+step, step,   0,    nh(gx,gz+1));                        // +Z
        emit(4, X,     Z,      step,   0,    nh(gx,gz-1));                        // -Z
      }
    }
    return { solid: S.n>0 ? S : null };
  }

  return { meshChunk, meshChunkLod };
})();
