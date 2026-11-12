'use strict';
/* ============================================================
   PrefabKit — 蓝图件库 — 引擎层
   ------------------------------------------------------------
   一句话职责: 具名建筑蓝图的几何单一权威——一份蓝图=几何内核+脚印声明+
   变种参数面, 坐在 SceneKit 原语层之上, 藏住全部几何/朝向/越界细节;
   调用方一句落位, 只需给 id+锚+变种。
   interface: PrefabKit.place(id, x, y, z, v?) → 世界脚印盒
     {x1,y1,z1,x2,y2,z2}(闭区间整数) · PrefabKit.footOf(id, x, y, z, v?)
     同参同盒零写纯查询(测试「写出格 ⊆ 脚印盒」口径, 未来 flats/blocked
     接线的现成缝, 本期不接线)。
   依赖(均经全局名, 调用期解析): voxel.js 的 setBlockRaw + config.js 的
     WORLD_W/WORLD_D/WORLD_H(越界守卫, scene-kit skInWorld 同款先例),
     加载序: config → voxel → scene-kit → 本文件 → 使用方。
   可测性声明: 零三维渲染库 · 零 DOM · 有同名单测(test/prefab-kit.test.js)。
   ------------------------------------------------------------
   v 键集 = 行 defaults 键集(唯一权威, 未知键即炸); 错误两档: 拼写域(未知
   id · 未知 v 键含 size/ids 子键 · 枚举值非法 face/piles/roof/torch ·
   piles:'terrain' 缺 ground)→throw(装场期炸=测试当场红); 几何数值域
   (size/steps 负值或非整数, ground 非有限数)→钳。朝向=整数格点旋转表
   (90° 倍数恒整数格, 零浮点), 缺省 face=行 facing0 → k=0 恒等——恒等
   路径与直写代码同构, 是等价迁移逐字节红线的结构保证。越界守卫逐格
   静默不写(树家族先例; 东带剪影贴边裁件是既有实践)。
   ============================================================ */

/* 写出口: 全模块唯一直写世界的函数——越界守卫逐格(x/z/y 三界, 界外静默
   不写)。不复用 SceneKit.fill: 旋转变换下部件会甩出世界, 守卫必须逐格 */
function pfCell(x, y, z, id) {
  if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D || y < 0 || y >= WORLD_H) return;
  setBlockRaw(x, y, z, id);
}

/* 朝向表: face → 90° 倍数(k1 把 (dx,dz)→(−dz,dx), k2/k3 连乘), mirror
   先翻 dx 后旋转; 全整数格点运算零浮点。缺省 'south' → k=0 恒等 */
const PF_FACE_K = {south: 0, west: 1, north: 2, east: 3};
const PF_ROTS = [
  (dx, dz) => [dx, dz],
  (dx, dz) => [-dz, dx],
  (dx, dz) => [-dx, -dz],
  (dx, dz) => [dz, -dx],
];
function pfOrient(face, mirror) {
  const rot = PF_ROTS[PF_FACE_K[face]];
  return mirror ? (dx, dz) => rot(-dx, dz) : rot;
}

/* 几何数值域钳: 负值/非整数/超界收敛 [0,255](第二档, 装场期不炸) */
function pfNum(n) {
  return Math.max(0, Math.min(255, Math.floor(Number(n) || 0)));
}

/* 自有属性判(白名单校验不吃原型链上的继承键) */
const pfHas = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/* 地形桩的地面顶读数: 偏移取整+非有限数回落 0(数值域第二档); 内核与
   脚印同参喂 ground——同锚同值, 盒与写笔不漂移 */
function pfGroundOf(e, wx, wz) {
  const g = e.ground(wx, wz);
  return Number.isFinite(g) ? Math.floor(g) : 0;
}

/* stilt-hut 形常数单份: 桩柱位 (±hx, ±back)——沼泽款 {back:1, front:2}
   南端 z+2 无桩(地板前挑, 收编前不对称照抄), 西带款 {2,2,2} 恰四角。
   内核与 foot 共用此一份 */
function pfStiltPiles(e) {
  return [[-e.size.hx, -e.size.back], [e.size.hx, -e.size.back],
    [-e.size.hx, e.size.back], [e.size.hx, e.size.back]];
}

/* 变种合并+校验: 键白名单=行 defaults 键集; 拼写域全在此一次验,
   place/footOf 共用(纯查询同样炸=同一防火墙) */
function pfMerge(row, id, v) {
  const d = row.defaults;
  const e = Object.assign({}, d);
  if (v !== undefined) {
    if (typeof v !== 'object' || v === null) {
      throw new Error('PrefabKit: v 须是变种对象(id ' + id + ')');
    }
    for (const key of Object.keys(v)) {
      if (!pfHas(d, key)) {
        throw new Error('PrefabKit: 未知 v 键「' + key + '」(id ' + id +
            ', 合法键=行 defaults 键集: ' + Object.keys(d).join('/') + ')');
      }
      e[key] = v[key];
    }
  }
  if (!pfHas(PF_FACE_K, e.face)) {
    throw new Error('PrefabKit: face 非法「' + e.face + '」(north/east/south/west)');
  }
  if (e.piles !== 'fixed' && e.piles !== 'terrain') {
    throw new Error('PrefabKit: piles 非法「' + e.piles + '」(fixed/terrain)');
  }
  if (e.piles === 'terrain' && typeof e.ground !== 'function') {
    throw new Error('PrefabKit: piles:\'terrain\' 必传 ground(x,z) 注入缝(引擎不认识地形权威)');
  }
  if (e.roof !== 'flat' && e.roof !== 'stepped') {
    throw new Error('PrefabKit: roof 非法「' + e.roof + '」(flat/stepped)');
  }
  if (e.torch !== 'wall' && e.torch !== 'rim' && e.torch !== 'none') {
    throw new Error('PrefabKit: torch 非法「' + e.torch + '」(wall/rim/none)');
  }
  let sz = d.size;
  if (v !== undefined && v.size !== undefined) {
    if (typeof v.size !== 'object' || v.size === null) {
      throw new Error('PrefabKit: size 须是 {hx, back, front} 对象(id ' + id + ')');
    }
    for (const key of Object.keys(v.size)) {
      if (!['hx', 'back', 'front'].includes(key)) {
        throw new Error('PrefabKit: size 未知子键「' + key + '」(hx/back/front)');
      }
    }
    sz = Object.assign({}, d.size, v.size);
  }
  e.size = {hx: pfNum(sz.hx), back: pfNum(sz.back), front: pfNum(sz.front)};
  let mats = d.ids;
  if (v !== undefined && v.ids !== undefined) {
    if (typeof v.ids !== 'object' || v.ids === null) {
      throw new Error('PrefabKit: ids 须是 {log, plank, chest, torch} 对象(id ' + id + ')');
    }
    for (const key of Object.keys(v.ids)) {
      if (!pfHas(d.ids, key)) {
        throw new Error('PrefabKit: ids 未知子键「' + key + '」(log/plank/chest/torch)');
      }
    }
    mats = Object.assign({}, d.ids, v.ids);
  }
  e.ids = mats;
  e.mirror = !!e.mirror;
  e.door = !!e.door;
  e.chest = !!e.chest;
  e.steps = pfNum(e.steps);
  return e;
}

/* 行表(清单唯一权威, kit 自持): 行字段 facing0(现朝向)/defaults(变种缺省
   面, 键集=合法 v 键)/foot(脚印模板, 形常数纯算术投影)/kernel(几何内核)。
   P0 只一行 stilt-hut(P1 再加 under-room/mound, 按形命名不按图命名) */
const PF_ROWS = {
  'stilt-hut': {
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      size: {hx: 2, back: 1, front: 2}, /* 半宽/后深/前深: 沼泽款 5×4, 西带款 5×5 传 {2,2,2} */
      piles: 'fixed',
      ground: undefined, /* piles:'terrain' 时必传(注入缝) */
      door: true,
      roof: 'flat',
      chest: true,
      torch: 'wall',
      steps: 3,
      ids: {log: 5, plank: 6, chest: 51, torch: 48}, /* 材质注入, 缺省裸数字 */
    },
    /* 几何内核: 全部坐标写局部系(锚为原点, face0='south' 为正面即 +z=门前;
       局部格 = 相对锚的偏移, put 内部才映射世界)。写序照抄收编前实现(等价
       红线: 桩脚→地板→墙→门洞→顶→帽→家具→台阶; 门洞掏墙/家具压地板/火把
       插墙是后写者赢的覆写格——序即几何)。旋转变换作用在写笔上 */
    kernel(e, x, z, orient, put) {/* x/z 仅 terrain 桩的地面读数需要(世界位) */
      const hx = e.size.hx; const back = e.size.back; const front = e.size.front;
      for (const [dx, dz] of pfStiltPiles(e)) {/* 桩脚 ×4: fixed 固定高 1..3;
          terrain 逐柱从各自地面顶+1 到 3(超埋段被地形吞=雾中半埋现行为) */
        const base = e.piles === 'fixed' ? 1 :
            pfGroundOf(e, x + orient(dx, dz)[0], z + orient(dx, dz)[1]) + 1;
        for (let dy = base; dy <= 3; dy++) put(dx, dy, dz, e.ids.log);
      }
      for (let dx = -hx; dx <= hx; dx++) {/* 地板 */
        for (let dz = -back; dz <= front; dz++) put(dx, 4, dz, e.ids.plank);
      }
      for (const dy of [5, 6]) {/* 墙环: 北 z=-back/南 z=+front 全行, 西东 x=±hx 夹行 */
        for (let dx = -hx; dx <= hx; dx++) put(dx, dy, -back, e.ids.plank);
        for (let dx = -hx; dx <= hx; dx++) put(dx, dy, front, e.ids.plank);
        for (let dz = -back + 1; dz <= front - 1; dz++) put(-hx, dy, dz, e.ids.plank);
        for (let dz = -back + 1; dz <= front - 1; dz++) put(hx, dy, dz, e.ids.plank);
      }
      if (e.door) {/* 前墙中轴门洞 1 宽 2 高: 掏空气, 覆写南墙 */
        put(0, 5, front, 0);
        put(0, 6, front, 0);
      }
      for (let dx = -hx; dx <= hx; dx++) {/* 顶 y+7 全盒 */
        for (let dz = -back; dz <= front; dz++) put(dx, 7, dz, e.ids.plank);
      }
      if (e.roof === 'stepped') {/* 阶梯帽: y+8 内缩一层 */
        for (let dx = -hx + 1; dx <= hx - 1; dx++) {
          for (let dz = -back + 1; dz <= front - 1; dz++) put(dx, 8, dz, e.ids.plank);
        }
      }
      if (e.chest) put(0, 4, 0, e.ids.chest); /* 家具: 地板中轴格宝箱 */
      if (e.torch === 'wall') put(-hx, 5, -1, e.ids.torch); /* 低位: 沼泽款=北墙西端 */
      if (e.torch === 'rim') put(-hx, 8, -1, e.ids.torch); /* 顶沿(阶梯帽角行) */
      for (let i = 0; i < e.steps; i++) {/* 台阶: 门前 1 格级下行(0=无) */
        put(0, 1 + i, front + 3 - i, e.ids.plank);
      }
    },
    /* 脚印模板: 生效后 v 的纯算术投影(与内核同一组形常数字段——size/steps/
       roof/piles 收放此随动, 非静态表); xz 域 4 角过同一张朝向表(90° 倍数
       旋转变换下盒仍轴对齐), y 域取写笔的最低/最高层 */
    foot(e, x, y, z, orient) {
      const hx = e.size.hx; const back = e.size.back; const front = e.size.front;
      const zTop = front + (e.steps > 0 ? 3 : 0); /* 台阶向门前探出 3 格 */
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-hx, hx]) {
        for (const dz of [-back, zTop]) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      let y1 = y + 4; /* 地板 */
      if (e.piles === 'fixed') {
        y1 = y + 1;
      } else {/* terrain: 逐柱地面顶+1, 与内核同参喂 ground */
        for (const [dx, dz] of pfStiltPiles(e)) {
          const o = orient(dx, dz);
          y1 = Math.min(y1, y + pfGroundOf(e, x + o[0], z + o[1]) + 1);
        }
      }
      if (e.steps > 0) y1 = Math.min(y1, y + 1);
      let y2 = y + 7;
      if (e.roof === 'stepped' || e.torch === 'rim') y2 = y + 8;
      if (e.steps > 0) y2 = Math.max(y2, y + e.steps);
      return {x1, y1, z1, x2, y2, z2};
    },
  },
};

function pfRow(id) {/* 行表查找: 未知 id 即炸(拼写防火墙第一档) */
  const row = PF_ROWS[id];
  if (!row) {
    throw new Error('PrefabKit: 未知蓝图 id「' + id + '」(行表键: ' + Object.keys(PF_ROWS).join('/') + ')');
  }
  return row;
}

/* 门面: 恰好两个入口(拍板 interface) */
const PrefabKit = {
  place(id, x, y, z, v) {/* 一句落位: 取行→合并缺省与 v→键检→朝向格点变换→写世界 */
    const row = pfRow(id);
    const e = pfMerge(row, id, v);
    const orient = pfOrient(e.face, e.mirror);
    row.kernel(e, x, z, orient, (dx, dy, dz, bid) => {
      const o = orient(dx, dz);
      pfCell(x + o[0], y + dy, z + o[1], bid);
    });
    return row.foot(e, x, y, z, orient);
  },
  footOf(id, x, y, z, v) {/* 同参同盒零写纯查询 */
    const row = pfRow(id);
    const e = pfMerge(row, id, v);
    return row.foot(e, x, y, z, pfOrient(e.face, e.mirror));
  },
};
