'use strict';
/* ============================================================
   网格化 Worker — http 服务下的网格构建主路径 (调研 §7②b)
   ------------------------------------------------------------
   与主线程共享同一份代码: importScripts 依次加载 config.js(方块注册
   表/VIEW/TNT_TILES) · voxel.js(hashRand 单一来源) · mesh-core.js
   (网格化纯核心) · texture-atlas.js(方块图集布局, MeshCore opts.atlas
   共读)。世界数据不共享 — 每次请求随消息携带区块打包
   (voxel.js packChunkData 的输出, ArrayBuffer transferable 零拷贝),
   主线程(world.js)负责收集与 THREE 装配。
   file:// 下浏览器拒绝 Worker 构造 → world.js try/catch 兜底同步构建,
   两条路径共享同一 remeshQueue, 只是消费者不同。
   importScripts 相对本文件(js/)解析 — 与主页面脚本同目录。
   ============================================================ */
importScripts('config.js', 'voxel.js', 'mesh-core.js', 'texture-atlas.js');

self.onmessage = (e)=>{
  const m = e.data;
  const pack = {
    cells: new Uint8Array(m.cells), // 转移来的 ArrayBuffer → 视图
    /* 光照圈(D3, 设计稿 §3.4): 与 cells 同形同布局, 布局即跨线程契约;
       旧协议消息(无 sky/block 字段)回落全亮 — mesh-core 容忍缺省 */
    sky: m.sky ? new Uint8Array(m.sky) : undefined,
    block: m.block ? new Uint8Array(m.block) : undefined,
    w: m.w, d: m.d, h: m.h,
    border: m.border, bx: m.bx, bz: m.bz, yMax: m.yMax,
  };
  const res = m.kind === 'full' ?
    MeshCore.meshChunk(pack, {hashRand, tntTiles: TNT_TILES, atlas: TextureAtlas.layout}) :
    MeshCore.meshChunkLod(pack, {step: VIEW.lodStep});
  /* 裸数组 → TypedArray 转移回传: 普通 number[] 的结构化克隆逐元素装箱
     (最慢路径), TypedArray 走 transfer 零拷贝, 主线程侧 Float32BufferAttribute
     可直接视图、setIndex 直接包装 — 不再有第二次拷贝 */
  const transfer = [];
  const conv = (r)=>{
    const out = {};
    for (const ch of ['solid', 'glass', 'tnt', 'atlas']) {
      const c = r[ch];
      if (!c) {
        out[ch] = null; continue;
      }
      const t = {
        positions: new Float32Array(c.positions),
        normals: new Float32Array(c.normals),
        indices: new Uint32Array(c.indices),
      };
      if (c.colors) t.colors = new Float32Array(c.colors);
      if (c.uvs) t.uvs = new Float32Array(c.uvs);
      if (c.sky) t.sky = new Float32Array(c.sky); // 顶点光(D3): 每顶点标量, 同款零拷贝
      if (c.block) t.block = new Float32Array(c.block);
      out[ch] = t;
      for (const key of ['positions', 'normals', 'indices', 'colors', 'uvs', 'sky', 'block']) {
        if (t[key]) transfer.push(t[key].buffer);
      }
    }
    return out;
  };
  self.postMessage(
      {gen: m.gen, cx: m.cx, cz: m.cz, token: m.token, kind: m.kind, res: conv(res)},
      transfer);
};
