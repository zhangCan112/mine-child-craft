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
   依赖(均经全局名, 调用期解析): voxel.js 的 setBlockRaw/getBlock(under-room
     出路垫脚「空气才垫」与沙盖置换的世界读数, getBlock 界外=0) +
     config.js 的 WORLD_W/WORLD_D/WORLD_H(越界守卫, scene-kit skInWorld
     同款先例) + scene-kit.js 的 SceneKit.rand(mound 掷点, 世界坐标散列),
     加载序: config → voxel → scene-kit → 本文件 → 使用方。
   可测性声明: 零三维渲染库 · 零 DOM · 有同名单测(test/prefab-kit.test.js)。
   ------------------------------------------------------------
   v 键集 = 行 defaults 键集(唯一权威, 未知键即炸); 检查按行声明收放(行
   defaults 没声明的轴不查, 各行只认自己的键面)。错误两档: 拼写域(未知
   id · 未知 v 键含 size/ids/exit 子键 · 枚举值非法 face/piles/roof/
   roofPitch/torch/torches/windowGlow/signVariant · piles:'terrain' 缺 ground · 行 require
   必传轴缺 mat/top/rock)
   →throw(装场期炸=测试当场红); 几何数值域(size/steps/half 等负值或非
   整数, ground 非有限数)→钳。朝向=整数格点旋转表(90° 倍数恒整数格,
   零浮点), 旋转序=(face−行 facing0) 的 90° 倍数, 缺省 face=行 facing0 →
   序 0 恒等——恒等路径与直写代码同构, 是等价迁移逐字节红线的结构保证。
   越界守卫逐格静默不写(树家族先例; 东带剪影贴边裁件是既有实践)。
   ============================================================ */

/* 写出口: 全模块唯一直写世界的函数——越界守卫逐格(x/z/y 三界, 界外静默
   不写)。不复用 SceneKit.fill: 旋转变换下部件会甩出世界, 守卫必须逐格 */
function pfCell(x, y, z, id) {
  if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D || y < 0 || y >= WORLD_H) return;
  setBlockRaw(x, y, z, id);
}

/* 朝向表: 旋转序=(face−行 facing0) 的 90° 倍数(k1 把 (dx,dz)→(−dz,dx),
   k2/k3 连乘), mirror 先翻 dx 后旋转; 全整数格点运算零浮点。缺省
   face=行 facing0 → 序 0 恒等(内核局部系=收编前直写坐标系) */
const PF_FACE_K = {south: 0, west: 1, north: 2, east: 3};
const PF_ROTS = [
  (dx, dz) => [dx, dz],
  (dx, dz) => [-dz, dx],
  (dx, dz) => [-dx, -dz],
  (dx, dz) => [dz, -dx],
];
function pfOrient(row, face, mirror) {
  const rot = PF_ROTS[(PF_FACE_K[face] - PF_FACE_K[row.facing0] + 4) % 4];
  return mirror ? (dx, dz) => rot(-dx, dz) : rot;
}

/* 几何数值域钳: 负值/非整数/超界收敛 [0,255](第二档, 装场期不炸) */
function pfNum(n) {
  return Math.max(0, Math.min(255, Math.floor(Number(n) || 0)));
}

/* 奇偶偏置跨度: n 格宽贴西北象限(偶数宽 NW 偏置: 2 → −1..0), 奇数居中
   (1 → 0..0, 3 → −1..1), 0 → 空跨度。竖井/可疑地板区与出路走廊宽共用 */
function pfSpan(n) {
  const s = -Math.floor(n / 2);
  return [s, n - 1 + s];
}

/* 纵深轴钳(floorDy 可负=埋地下): 非有限数回落 0, 域收敛 ±255(第二档) */
function pfDy(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.max(-255, Math.min(255, v)) : 0;
}

/* 盐轴(掷点散列入参, 不钳域): 非有限数回落 0(第二档) */
function pfInt(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? v : 0;
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
   place/footOf 共用(纯查询同样炸=同一防火墙)。检查按行声明收放:
   行 defaults 没声明的轴不查(under-room 无 piles/roof/torch/size,
   stilt-hut 无 half/exit——各行只认自己的键面) */
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
  for (const key of row.require || []) {/* 必传轴: 材质=身分轴, 行不给缺省 */
    if (e[key] === undefined) {
      throw new Error('PrefabKit: ' + key + ' 必传(id ' + id + ')');
    }
  }
  if (!pfHas(PF_FACE_K, e.face)) {
    throw new Error('PrefabKit: face 非法「' + e.face + '」(north/east/south/west)');
  }
  if (pfHas(d, 'piles')) {
    if (e.piles !== 'fixed' && e.piles !== 'terrain') {
      throw new Error('PrefabKit: piles 非法「' + e.piles + '」(fixed/terrain)');
    }
    if (e.piles === 'terrain' && typeof e.ground !== 'function') {
      throw new Error('PrefabKit: piles:\'terrain\' 必传 ground(x,z) 注入缝(引擎不认识地形权威)');
    }
  }
  if (pfHas(d, 'roof') && e.roof !== 'flat' && e.roof !== 'stepped') {
    throw new Error('PrefabKit: roof 非法「' + e.roof + '」(flat/stepped)');
  }
  if (pfHas(d, 'torch') && e.torch !== 'wall' && e.torch !== 'rim' && e.torch !== 'none') {
    throw new Error('PrefabKit: torch 非法「' + e.torch + '」(wall/rim/none)');
  }
  if (pfHas(d, 'torches') && e.torches !== 'solo' && e.torches !== 'pair') {
    throw new Error('PrefabKit: torches 非法「' + e.torches + '」(solo/pair)');
  }
  /* shop-awning 双枚举(roof/torch 同款第一档): 暖橙装饰光意象仅 warm/none
     两档(禁火语义), 招牌文字不硬编码几何故仅 icon/blank */
  if (pfHas(d, 'windowGlow') && e.windowGlow !== 'warm' && e.windowGlow !== 'none') {
    throw new Error('PrefabKit: windowGlow 非法「' + e.windowGlow + '」(warm/none)');
  }
  if (pfHas(d, 'signVariant') && e.signVariant !== 'icon' && e.signVariant !== 'blank') {
    throw new Error('PrefabKit: signVariant 非法「' + e.signVariant + '」(icon/blank)');
  }
  /* stash-hut 顶档枚举(同款第一档): 小巧屋顶收放仅两档——low=檐层即封顶
     (总高 5)/mid=dy5 内缩顶封顶(总高 6, 缺省) */
  if (pfHas(d, 'roofPitch') && e.roofPitch !== 'low' && e.roofPitch !== 'mid') {
    throw new Error('PrefabKit: roofPitch 非法「' + e.roofPitch + '」(low/mid)');
  }
  if (d.size !== undefined) {
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
  }
  if (d.ids !== undefined) {
    let mats = d.ids;
    if (v !== undefined && v.ids !== undefined) {
      if (typeof v.ids !== 'object' || v.ids === null) {
        throw new Error('PrefabKit: ids 须是对象(id ' + id + ')');
      }
      for (const key of Object.keys(v.ids)) {
        if (!pfHas(d.ids, key)) {
          throw new Error('PrefabKit: ids 未知子键「' + key + '」(合法子键: ' +
              Object.keys(d.ids).join('/') + ')');
        }
      }
      mats = Object.assign({}, d.ids, v.ids);
    }
    e.ids = mats;
  }
  if (d.exit !== undefined) {
    let ex = d.exit;
    if (v !== undefined && v.exit !== undefined) {
      if (typeof v.exit !== 'object' || v.exit === null) {
        throw new Error('PrefabKit: exit 须是 {steps, width, capSwap, landing} 对象(id ' + id + ')');
      }
      for (const key of Object.keys(v.exit)) {
        if (!pfHas(d.exit, key)) {
          throw new Error('PrefabKit: exit 未知子键「' + key + '」(steps/width/capSwap/landing)');
        }
      }
      ex = Object.assign({}, d.exit, v.exit);
    }
    e.exit = {steps: pfNum(ex.steps), width: pfNum(ex.width),
      capSwap: !!ex.capSwap, landing: !!ex.landing};
  }
  /* 标量轴收放(只钳行声明的): stilt-hut 台阶 · under-room 室形/竖井/
     地板深/盐 · tower-belfry 高度档钳域 · windmill-tower 叶展档钳域 ·
     布尔轴按声明收放 */
  if (pfHas(d, 'steps')) e.steps = pfNum(e.steps);
  if (pfHas(d, 'half')) e.half = pfNum(e.half);
  if (pfHas(d, 'cavH')) e.cavH = pfNum(e.cavH);
  if (pfHas(d, 'shaft')) e.shaft = pfNum(e.shaft);
  if (pfHas(d, 'floorDy')) e.floorDy = pfDy(e.floorDy);
  if (pfHas(d, 'salt')) e.salt = pfInt(e.salt);
  if (pfHas(d, 'heightTier')) {
    const ht = Math.floor(Number(e.heightTier));
    e.heightTier = Number.isFinite(ht) ? Math.max(14, Math.min(16, ht)) : 15;
  }
  /* windmill-tower 叶展档钳域 [3,4](heightTier 档先例; 非有限数回落缺省 4) */
  if (pfHas(d, 'bladeSpan')) {
    const bs = Math.floor(Number(e.bladeSpan));
    e.bladeSpan = Number.isFinite(bs) ? Math.max(3, Math.min(4, bs)) : 4;
  }
  if (pfHas(d, 'mirror')) e.mirror = !!e.mirror;
  if (pfHas(d, 'door')) e.door = !!e.door;
  if (pfHas(d, 'doorOpen')) e.doorOpen = !!e.doorOpen; /* shop-awning 门洞敞开 */
  if (pfHas(d, 'chest')) e.chest = !!e.chest;
  if (pfHas(d, 'openBelfry')) e.openBelfry = !!e.openBelfry;
  if (pfHas(d, 'hasDoorNiche')) e.hasDoorNiche = !!e.hasDoorNiche;
  if (pfHas(d, 'flags')) e.flags = !!e.flags;
  if (pfHas(d, 'sailStatic')) e.sailStatic = !!e.sailStatic; /* windmill 叶轮静态 */
  if (pfHas(d, 'hasChimney')) e.hasChimney = !!e.hasChimney; /* cottage-gable 装饰烟囱(无烟) */
  if (pfHas(d, 'windowLit')) e.windowLit = !!e.windowLit; /* cottage-gable 窗亮观感开关 */
  return e;
}

/* 行表(清单唯一权威, kit 自持): 行字段 facing0(现朝向)/defaults(变种缺省
   面, 键集=合法 v 键)/require(必传轴)/foot(脚印模板, 形常数纯算术投影)/
   kernel(几何内核)。七行: stilt-hut(P0 高脚木屋对)/under-room/mound
   (P1 地下宝箱室与巢穴丘)/tower-belfry(T-PREFAB-01 钟塔)/shop-awning
   (T-PREFAB-02 店身+前廊遮檐铺面)/stash-hut(T-PREFAB-03 秘密储藏小屋)/
   windmill-tower(T-PREFAB-04 风车塔), 按形命名不按图命名 */
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
    kernel(e, x, y, z, orient, put) {/* x/z 仅 terrain 桩的地面读数需要(世界位);
        y 全是固定层不用 */
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
  'under-room': {
    /* 地下宝箱室: 神殿室(沙漠图)与雪屋室(雪原图)的同形收编——「三明治埋室」
       (室地板/室腔掏空/两层室顶)+可选竖井与可疑地板+宝箱火把+东侧出路台阶。
       锚=室心地表格(x/z=室心, y=地表层: 两份现值都在图平坦区, 地表即
       锚 y), floorDy 记室地板埋深(神殿 −7/雪屋 −6=缺省安全款)。 */
    facing0: 'east', /* 现朝向=出路向东(两份同) */
    require: ['mat'], /* 三明治+垫脚+可疑地板材质(身分轴, 必传缺炸) */
    defaults: {
      face: 'east', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      mat: undefined, /* 必传(见 require) */
      half: 2, /* 室半宽: 室 (2·half+1)²; 神殿 3 */
      cavH: 3, /* 室腔高; 神殿 4 */
      floorDy: -6, /* 室地板相对锚埋深(负=地下); 神殿 −7 */
      shaft: 0, /* 竖井边格(0=无): 顶两层掏穿, 偶数宽贴西北象限(pfSpan);
          神殿 2 */
      trap: null, /* 可疑地板(真值开): y=室顶上地表层(floorDy+cavH+3 派生,
          不设 y 轴——「室顶+地表关系」), 区=竖井区(踩塌须正对竖井);
          神殿 true */
      torches: 'solo', /* solo=西北内角单支(雪屋) / pair=对角双支(神殿,
          ±(half−1)); y 恒室地板+1(落地站膛, 悬空 thin 会被清扫治愈) */
      chest: true, /* 宝箱: 室心中轴, y=腔顶层−1(floorDy+cavH−1, 两份同式) */
      exit: {steps: 6, width: 1, capSwap: false, landing: false}, /* 东侧出路
          (现朝向 +dx): steps 级 1 格级上行(起 dy=floorDy+cavH−2=腔顶下 2,
          恒净空 3 高/恒「空气才垫」中轴单格垫脚) · width 走廊宽 ·
          capSwap=沿途沙柱置换室材质盖(fall 旗沙悬空→清扫迁移红线) ·
          landing=出口 2 格平台(地表层, 宽随 width); 神殿 {7, 3, true, true} */
      ids: {chest: 51, torch: 48, cap: 8, land: 8}, /* 家具与出路材质注入
          (cap=沙盖置换判读 id / land=出口平台), 缺省裸数字 */
    },
    /* 内核写序照抄收编前实现(等价红线): 三明治→竖井→可疑地板→家具→
       出路→平台; 腔掏空/竖井掏顶/净空掏柱是后写者赢的覆写格——序即几何 */
    kernel(e, x, y, z, orient, put) {
      const half = e.half; const cavH = e.cavH; const fDy = e.floorDy;
      for (let dx = -half; dx <= half; dx++) {/* 室地板 */
        for (let dz = -half; dz <= half; dz++) put(dx, fDy, dz, e.mat);
      }
      for (let dx = -half; dx <= half; dx++) {/* 室腔掏空 */
        for (let dz = -half; dz <= half; dz++) {
          for (let dy = fDy + 1; dy <= fDy + cavH; dy++) put(dx, dy, dz, 0);
        }
      }
      for (let dy = fDy + cavH + 1; dy <= fDy + cavH + 2; dy++) {/* 室顶恒两层 */
        for (let dx = -half; dx <= half; dx++) {
          for (let dz = -half; dz <= half; dz++) put(dx, dy, dz, e.mat);
        }
      }
      if (e.shaft > 0) {/* 竖井: 顶两层掏穿(踩塌即坠入) */
        const sp = pfSpan(e.shaft);
        for (let dx = sp[0]; dx <= sp[1]; dx++) {
          for (let dz = sp[0]; dz <= sp[1]; dz++) {
            for (let dy = fDy + cavH + 1; dy <= fDy + cavH + 2; dy++) {
              put(dx, dy, dz, 0);
            }
          }
        }
      }
      if (e.trap) {/* 可疑地板: 室顶上地表层, 区=竖井区 */
        const sp = pfSpan(e.shaft);
        for (let dx = sp[0]; dx <= sp[1]; dx++) {
          for (let dz = sp[0]; dz <= sp[1]; dz++) {
            put(dx, fDy + cavH + 3, dz, e.mat);
          }
        }
      }
      if (e.chest) put(0, fDy + cavH - 1, 0, e.ids.chest); /* 宝箱(先箱后火把) */
      if (e.torches === 'solo') {/* 火把: 落地站膛(室地板+1) */
        put(-1, fDy + 1, -1, e.ids.torch);
      }
      if (e.torches === 'pair') {
        put(-(half - 1), fDy + 1, -(half - 1), e.ids.torch);
        put(half - 1, fDy + 1, half - 1, e.ids.torch);
      }
      if (e.exit.steps > 0) {/* 东侧出路: 1 格级上行回地表 */
        const sp = pfSpan(e.exit.width);
        const startDy = fDy + cavH - 2;
        for (let i = 0; i < e.exit.steps; i++) {
          const dx = half + 1 + i; const dy = startDy + i;
          for (let dz = sp[0]; dz <= sp[1]; dz++) {
            const o = orient(dx, dz); const wx = x + o[0]; const wz = z + o[1];
            for (let ddy = dy; ddy <= dy + 2; ddy++) put(dx, ddy, dz, 0); /* 净空 3 */
            if (e.exit.capSwap) {/* 沙柱换室材质盖(读世界: 只换散层 id) */
              for (let ddy = dy + 3; ddy <= 0; ddy++) {
                if (getBlock(wx, y + ddy, wz) === e.ids.cap) put(dx, ddy, dz, e.mat);
              }
            }
          }
          const oc = orient(dx, 0); /* 垫脚「空气才垫」: 中轴单格(读世界) */
          if (getBlock(x + oc[0], y + dy - 1, z + oc[1]) === 0) {
            put(dx, dy - 1, 0, e.mat);
          }
        }
        if (e.exit.landing) {/* 出口 2 格平台(地表层, 末级位起) */
          const lx = half + e.exit.steps;
          for (let dx = lx; dx <= lx + 1; dx++) {
            for (let dz = sp[0]; dz <= sp[1]; dz++) put(dx, 0, dz, e.ids.land);
          }
        }
      }
    },
    /* 脚印: half/cavH/exit/trap 收放纯算术投影; xz 4 角过同一张朝向表 */
    foot(e, x, y, z, orient) {
      const half = e.half; const cavH = e.cavH; const fDy = e.floorDy;
      const hasExit = e.exit.steps > 0;
      const sp = pfSpan(e.exit.width);
      const ex2 = half + (hasExit ? e.exit.steps + (e.exit.landing ? 1 : 0) : 0);
      const zLo = -Math.max(half, hasExit ? -sp[0] : 0);
      const zHi = Math.max(half, hasExit ? sp[1] : 0);
      let y1 = Math.min(fDy, fDy + cavH - 3); /* 室地板/垫脚(腔高<3 时垫脚更低) */
      let y2 = fDy + cavH + 2; /* 室顶上层(三明治整体在盒内, 与出口收放无关) */
      if (hasExit) y2 = Math.max(y2, fDy + cavH + e.exit.steps - 1); /* 末级净空上沿 */
      if (e.trap) y2 = Math.max(y2, fDy + cavH + 3); /* 可疑地板层 */
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const [dx, dz] of [[-half, zLo], [ex2, zLo], [-half, zHi], [ex2, zHi]]) {
        const o = orient(dx, dz);
        x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
        z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
      }
      return {x1, y1: y + y1, z1, x2, y2: y + y2, z2};
    },
  },
  'mound': {
    /* 巢穴丘: r2 圆底三层土丘(心 3 高/中环 2 高/缘 1 高)+点缀掷点+
       朝南 2 高洞口。三图巢穴(advMapNest)与 home 巢(advBuildNest)同形
       收编; 黑巢 advBuildDenNest 异形巨丘不属此行。掷点散列喂变换后
       世界坐标(旧代码散列世界坐标——换系即换纹理, 等价红线)。 */
    facing0: 'south', /* 现朝向=洞口朝南(两份同) */
    require: ['top', 'rock'], /* 丘体/点缀材质(身分轴, 必传缺炸) */
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      top: undefined, /* 必传(见 require) */
      rock: undefined, /* 必传(见 require) */
      salt: 5102, /* 掷点盐: 缺省=三图口径; home 薄壳显式传 5101 */
    },
    /* 内核写序照抄收编前实现: 逐列(dz 内层)掷点写柱, 末掏洞口 */
    kernel(e, x, y, z, orient, put) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          const d = Math.hypot(dx, dz);
          if (d > 2) continue;
          const h = d < 0.8 ? 3 : (d < 1.8 ? 2 : 1);
          const o = orient(dx, dz); /* 掷点喂变换后世界坐标(非局部系!) */
          for (let dy = 1; dy <= h; dy++) {
            const id = (d >= 0.8 && SceneKit.rand(x + o[0], z + o[1], e.salt) > 0.72) ?
                e.rock : e.top;
            put(dx, dy, dz, id);
          }
        }
      }
      put(0, 1, 2, 0); /* 洞口朝南 2 高 */
      put(0, 2, 2, 0);
    },
    foot(e, x, y, z, orient) {
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-2, 2]) {
        for (const dz of [-2, 2]) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y + 1, z1, x2, y2: y + 3, z2};
    },
  },
  'tower-belfry': {
    /* 钟塔: 地基+塔身+钟室+顶饰的竖向地标件(town-prefab-specs §4.1). 锚=塔心
       投影, 局部轴 dx 横/dz 前后/dy 竖; face0=south=前立面朝 +dz */
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      heightTier: 15, /* 档 {14,15,16} 钳域, 影响顶饰比例/封顶 */
      openBelfry: true,
      hasDoorNiche: true,
      flags: true,
      ids: {base: 58, wall: 6, pillar: 5, trim: 47, roof: 40, bell: 41, window: 20, flag: 35},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids; const tier = e.heightTier;
      const topDy = tier - 1; /* 缺省 15→封顶 dy14 */
      /* dy=0 地基 6×6 */
      for (let dx = -2; dx <= 3; dx++) {
        for (let dz = -2; dz <= 3; dz++) put(dx, 0, dz, ids.base);
      }
      /* dy=1..7 塔身 4×4 主体([-1,2]², 与 6×6 地基/钟室同心=内缩1圈) + 四角立柱 + 中线竖缝装饰
         [裁决登记 T-PREFAB-01 阻塞项: PO 超时默认落板 2026-11-13, 采纳 4×4 同心读法(PO-pending 可推翻);
          spec 文面“5×5 主体”与“6×6 内缩1圈”算术互斥, 本票按 4×4 落地并判文样为笔误, 异议已登记需求线;
          spec 文本未改(视觉唯一权威), 勘误待 PO 确认后由需求线另落] */
      for (let dy = 1; dy <= 7; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          for (let dz = -1; dz <= 2; dz++) {
            const corner = (dx === -1 || dx === 2) && (dz === -1 || dz === 2);
            let id = corner ? ids.pillar : ids.wall;
            /* 四面中线竖缝装饰(后于墙体): 边中点位覆写 trim */
            const onEdge = dx === -1 || dx === 2 || dz === -1 || dz === 2;
            const midX = (dx === 0 || dx === 1) && (dz === -1 || dz === 2);
            const midZ = (dz === 0 || dz === 1) && (dx === -1 || dx === 2);
            if (onEdge && !corner && (midX || midZ)) id = ids.trim;
            put(dx, dy, dz, id);
          }
        }
      }
      /* 前立面装饰门龛 dy1..3(南向 +dz 前沿 z=2 中线 dx 0..1): 浅色内衬/开口视觉 */
      for (let dy = 1; dy <= 3; dy++) put(0, dy, 2, e.hasDoorNiche ? ids.window : ids.wall);
      /* 侧面 dy4..6 小窗位(ids.window) */
      for (let dy = 4; dy <= 6; dy++) {
        put(-1, dy, 0, ids.window);
        put(2, dy, 0, ids.window);
      }
      /* dy=8..10 钟室 6×6 外扩亭式: 柱脚保留, 四面开敞(受 openBelfry), 檐层围合 */
      for (let dy = 8; dy <= 10; dy++) {
        for (let dx = -2; dx <= 3; dx++) {
          for (let dz = -2; dz <= 3; dz++) {
            const corner = (dx === -2 || dx === 3) && (dz === -2 || dz === 3);
            const edge = dx === -2 || dx === 3 || dz === -2 || dz === 3;
            if (!edge) continue; /* 室内先空, 后放钟体 */
            if (corner) {
              put(dx, dy, dz, ids.pillar);
              continue;
            }
            if (e.openBelfry && dy < 10) {
              /* 四面开敞: 中段边开口 */
              const mid = (dx === 0 || dx === 1) || (dz === 0 || dz === 1);
              if (mid) {
                put(dx, dy, dz, 0);
                continue;
              }
            }
            /* 檐层围合(dy==10)或柱间封边 */
            put(dx, dy, dz, dy === 10 ? ids.trim : ids.pillar);
          }
        }
      }
      /* 钟体占位 2×2×2(ids.bell), 室内中心偏上 */
      for (let dx = 0; dx <= 1; dx++) {
        for (let dz = 0; dz <= 1; dz++) {
          for (let dy = 8; dy <= 9; dy++) put(dx, dy, dz, ids.bell);
        }
      }
      /* dy=11..14 顶饰: 阶梯收分小屋顶+顶尖饰件(随 tier, 封顶于 topDy) */
      for (let dy = 11; dy <= topDy; dy++) {
        const inset = dy <= 12 ? 0 : 1; /* 逐层收分 */
        const x1 = -2 + inset; const x2 = 3 - inset; const z1 = -2 + inset; const z2 = 3 - inset;
        if (x1 > x2 || z1 > z2) continue;
        for (let dx = x1; dx <= x2; dx++) {
          for (let dz = z1; dz <= z2; dz++) {
            const edge = dx === x1 || dx === x2 || dz === z1 || dz === z2;
            const isTop = dy === topDy;
            put(dx, dy, dz, isTop && !edge ? ids.trim : ids.roof);
          }
        }
      }
      /* 檐下小旗装饰(受 flags): 面积小, 放在钟室檐下外侧计入 foot */
      if (e.flags) {
        put(-2, 10, -1, ids.flag);
        put(3, 10, 1, ids.flag);
      }
    },
    foot(e, x, y, z, orient) {
      const tier = e.heightTier;
      const topDy = Math.max(14, tier - 1); /* 覆盖 dy0..14 全高, 高档可更高 */
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-2, 3]) {
        for (const dz of [-2, 3]) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + topDy, z2};
    },
  },
  'shop-awning': {
    /* 商店: 店身+前廊遮檐+招牌层的临街铺面(town-prefab-specs §4.2, 视觉对照
       buildings-visual-spec §7.2 与 §8 去威胁红线——「熔岩」仅作暖橙装饰
       块意象, 禁真实熔岩/明火)。锚=店身地面中心投影, 局部轴 dx 横/dz 前后/
       dy 竖, face0=south=店面朝 +dz; 偶宽 NW 偏置同 pfSpan 口径: 宽 10→
       dx∈[-5,4], 深 8→dz∈[-4,3], 前廊向 +dz 外延 dz=4 一格(平面共 10×9) */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      doorOpen: true, /* 门洞 2w×3h: true 掏空气(白天敞开感)/false 补墙 */
      windowGlow: 'warm', /* 展示窗区: warm=glow 暖橙装饰块 / none=window 浅色内衬 */
      signVariant: 'icon', /* 招牌板: icon=底板+图形区 / blank=全底板(图形归纹理层) */
      /* 材质注入, 缺省裸数字(§4.2 语义→现调色板): base 砂岩浅石地台 ·
         wall 木板暖木 · roof 红砖陶橙 · trim 木头暖木-深 · awning 羊毛
         奶油布幔 · signBg 蓝羊毛天蓝 · signAccent 金矿暖金 · glow 灯块
         暖橙装饰光(灯块非火, §8 允许意象) · window 玻璃浅色内衬 */
      ids: {base: 58, wall: 6, roof: 9, trim: 5, awning: 52,
        signBg: 15, signAccent: 38, glow: 19, window: 18},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z 未用: 纯局部系直写(无地形读数) */
      const ids = e.ids;
      /* dy=0 地台: 店身 10×8(dx∈[-5,4]×dz∈[-4,3])+前廊外延 dz=4 → 恰 10×9 全 base */
      for (let dx = -5; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) put(dx, 0, dz, ids.base);
      }
      /* dy=1..4 店身墙环(店身周界, 不含前廊; 内域不写=空): 四角角柱=trim
         (暖木-深); 前立面 dz=3 逐格覆写门洞/展示窗——后写者赢, 序即几何 */
      for (let dy = 1; dy <= 4; dy++) {
        for (let dx = -5; dx <= 4; dx++) {
          for (let dz = -4; dz <= 3; dz++) {
            const corner = (dx === -5 || dx === 4) && (dz === -4 || dz === 3);
            const onRing = corner || dx === -5 || dx === 4 || dz === -4 || dz === 3;
            if (!onRing) continue; /* 内域空 */
            let id = corner ? ids.trim : ids.wall;
            if (dz === 3 && !corner) {/* 前立面地图 */
              const win = (dx >= -4 && dx <= -3) || (dx >= 2 && dx <= 3);
              if (win && dy >= 3) id = e.windowGlow === 'warm' ? ids.glow : ids.window; /* 展示窗 2w×2h */
              if (dx >= -1 && dx <= 0 && dy <= 3) id = e.doorOpen ? 0 : ids.wall; /* 门洞 2w×3h */
            }
            put(dx, dy, dz, id);
          }
        }
      }
      /* dy=5 檐层: 店身 10×8=roof + 前廊 dz=4 全宽=awning(前檐突出=前廊遮檐) */
      for (let dx = -5; dx <= 4; dx++) {
        for (let dz = -4; dz <= 3; dz++) put(dx, 5, dz, ids.roof);
        put(dx, 5, 4, ids.awning);
      }
      /* dy=6 阶梯顶内缩一圈: 恰 8×6(dx∈[-4,3]×dz∈[-3,2])=roof, 域外空 */
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -3; dz <= 2; dz++) put(dx, 6, dz, ids.roof);
      }
      /* dy=7 招牌板: 恰宽 6(dx∈[-3,2])×1 厚, dz=4 挑出前廊上空; icon=中央
         图形区 2 格 signAccent(图标化「鸡+餐盘+暖橙光」占位, 细化归纹理/
         资产层)夹 signBg 底板, blank=全底板; dy≥8 无物(封顶于 7) */
      for (let dx = -3; dx <= 2; dx++) {
        const emblem = e.signVariant === 'icon' && dx >= -1 && dx <= 0;
        put(dx, 7, 4, emblem ? ids.signAccent : ids.signBg);
      }
    },
    /* 脚印: 同参纯算术投影——平面外廓 4 角(店身宽 10×前廊外延 dz=4)过同一
       张朝向表, y 域取写笔最低/最高层(dy0 地台..dy7 招牌) */
    foot(e, x, y, z, orient) {
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-5, 4]) {
        for (const dz of [-4, 4]) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 7, z2};
    },
  },
  'stash-hut': {
    /* 秘密储藏小屋: 中石基座+墙环+双层小巧屋顶的储藏氛围点(town-prefab-specs
       §4.3, 视觉对照 buildings-visual-spec §5.2 P1-01——「小而神秘但友好」,
       无阴暗压迫)。锚=小屋地面中心投影, 局部轴 dx 横/dz 前后/dy 竖,
       face0=south=门面朝 +dz; 偶宽 6 NW 偏置同 pfSpan 口径: dx,dz∈[-3,2]
       (宽=坐标差+1=6, 中心偏置 −0.5)。门侧箱/桶=外部道具散布不入蓝图
       (spec §4.3 明示不强绑), 内域空腔无家具; 无光/火语义槽位(ids 白名单
       无 torch/glow, §8 去威胁红线) */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      roofPitch: 'mid', /* 顶档: mid=dy5 内缩顶封顶(总高 6, 缺省)/low=dy4
          檐层即封顶(总高 5)——高 5-6 读作含 dy0 基座总层数 */
      door: true, /* true=门叶块在位(ids.door 材质有几何生命)/false=门洞敞开空气 */
      /* 材质注入, 缺省裸数字(§4.3 语义→现调色板): base 石头中石基座 ·
          wall 木板暖木-中墙体 · roof/trim 木头暖木-深屋顶与屋檐(小巧屋顶
          同檐材族) · door 木板门叶(上下半同材, 开合语义归交互层) ·
          metalAccent 金属铁灰小配件(门侧点缀, §4.3「可选」拍板槽位常驻) */
      ids: {base: 3, wall: 6, roof: 5, trim: 5, door: 6, metalAccent: 12},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z 未用: 纯局部系直写(无地形读数) */
      const ids = e.ids;
      /* dy=0 基座: 恰 6×6 实心板(dx,dz∈[-3,2]), 域外无物 */
      for (let dx = -3; dx <= 2; dx++) {
        for (let dz = -3; dz <= 2; dz++) put(dx, 0, dz, ids.base);
      }
      /* dy=1..3 墙环: 周界 wall, 内域不写=空腔(无家具——箱/桶属外部道具);
          前沿 dz=2 的门叶/门侧小配件后写覆写——序即几何 */
      for (let dy = 1; dy <= 3; dy++) {
        for (let dx = -3; dx <= 2; dx++) {
          for (let dz = -3; dz <= 2; dz++) {
            const onRing = dx === -3 || dx === 2 || dz === -3 || dz === 2;
            if (!onRing) continue; /* 内域空 */
            put(dx, dy, dz, ids.wall);
          }
        }
      }
      /* 门叶 1w×2h 前沿中轴 (0,dy1..2,2): true=door 材质/false=掏空气(门洞
          敞开); 门上 dy3 恒墙(环写已补); 门叶在 mirror 轴上格 dx=0(翻 dx
          不变式); 门侧铁灰小配件 (1,1,2) 恰一格, 居门东侧偏一格(受 door
          开合不动) */
      put(0, 1, 2, e.door ? ids.door : 0);
      put(0, 2, 2, e.door ? ids.door : 0);
      put(1, 1, 2, ids.metalAccent);
      /* dy=4 檐层: 恰 6×6——周界 trim(暖木-深屋檐)+内芯 4×4[-2,1]² roof */
      for (let dx = -3; dx <= 2; dx++) {
        for (let dz = -3; dz <= 2; dz++) {
          const onRing = dx === -3 || dx === 2 || dz === -3 || dz === 2;
          put(dx, 4, dz, onRing ? ids.trim : ids.roof);
        }
      }
      /* dy=5 内缩顶(仅 mid): 恰 4×4[-2,1]² roof 封顶, 域外空; low 封顶
          dy4——封顶上一层无物 */
      if (e.roofPitch === 'mid') {
        for (let dx = -2; dx <= 1; dx++) {
          for (let dz = -2; dz <= 1; dz++) put(dx, 5, dz, ids.roof);
        }
      }
    },
    /* 脚印: 同参纯算术投影——平面 4 角([-3,2]² 过同一张朝向表, 90° 旋转下
       盒仍轴对齐), y 域取写笔最低/最高层(dy0 基座..dy5 内缩顶随 roofPitch) */
    foot(e, x, y, z, orient) {
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-3, 2]) {
        for (const dz of [-3, 2]) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + (e.roofPitch === 'mid' ? 5 : 4), z2};
    },
  },
  'windmill-tower': {
    /* 风车塔: 中石基座+收分塔身+暖褐锥顶+四臂叶轮的竖向天际线地标
       (town-prefab-specs §4.4, 视觉对照 buildings-visual-spec §7.5——
       风车天际线母题, 门窗小而友好)。锚=塔基地面中心投影, 局部轴 dx 横/
       dz 前后/dy 竖, face0=south=叶轮面朝 +dz; 偶宽 NW 偏置同 pfSpan
       口径: 6→[-3,2]², 5×5 居中 [-2,2]², 4×4 [-2,1]², 2×2 [-1,0]²。
       叶片组件(叶+轴)受 sailStatic 整体收放(§4.4「资产可分件预留」——
       动态旋转属实现/动画选型, 蓝图只给静态造型; false=组件整体不入
       几何, 塔体独立成景); 无光/火语义槽位(ids 白名单无 torch/glow,
       §8 去威胁红线——机械件无裸露危险) */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      sailStatic: true, /* 叶轮静态: true=叶片组件(叶+轴)入几何/0 值钳 false */
      bladeSpan: 4, /* 叶展档 [3,4]: 4=臂顶 dy12(总高 13)/3=收短 dy11(总高 12) */
      /* 材质注入, 缺省裸数字(§4.4 口径→现调色板): base 石头中石基座 ·
          wall 木板暖木-浅塔身(现调色板木板暖木-中近似) · roof 红砖暖褐
          檐层与锥顶(顶先例 40) · trim 木头暖木-中箍带与小窗 · blade 羊毛
          奶油叶面 · axle 金属铁灰轴心 */
      ids: {base: 3, wall: 6, roof: 40, trim: 5, blade: 52, axle: 12},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z 未用: 纯局部系直写(无地形读数) */
      const ids = e.ids; const S = e.bladeSpan;
      /* dy=0 基座: 恰 6×6 实心板(dx,dz∈[-3,2]), 域外无物 */
      for (let dx = -3; dx <= 2; dx++) {
        for (let dz = -3; dz <= 2; dz++) put(dx, 0, dz, ids.base);
      }
      /* dy=1..4 塔身 5×5 实心([-2,2]², 收分第一段): dy3 箍带=该层周界
          trim(§7.5「横向箍带 2 圈」拍板其一, 增强结构感) */
      for (let dy = 1; dy <= 4; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            const edge = dx === -2 || dx === 2 || dz === -2 || dz === 2;
            put(dx, dy, dz, dy === 3 && edge ? ids.trim : ids.wall);
          }
        }
      }
      /* dy=5..7 塔身 4×4 实心([-2,1]², 收分第二段): dy6 箍带=周界 trim */
      for (let dy = 5; dy <= 7; dy++) {
        for (let dx = -2; dx <= 1; dx++) {
          for (let dz = -2; dz <= 1; dz++) {
            const edge = dx === -2 || dx === 1 || dz === -2 || dz === 1;
            put(dx, dy, dz, dy === 6 && edge ? ids.trim : ids.wall);
          }
        }
      }
      /* dy=8 檐层 4×4=roof · dy=9 锥顶 2×2([-1,0]²)=roof 封顶, 域外空 */
      for (let dx = -2; dx <= 1; dx++) {
        for (let dz = -2; dz <= 1; dz++) put(dx, 8, dz, ids.roof);
      }
      for (let dx = -1; dx <= 0; dx++) {
        for (let dz = -1; dz <= 0; dz++) put(dx, 9, dz, ids.roof);
      }
      /* 门洞 1w×2h 前沿中轴 (0,dy1..2,2)=掏空气 · 小窗 (0,4,2)=trim
          (§7.5 y4 小窗居中拍板): 塔身后写覆写——序即几何 */
      put(0, 1, 2, 0);
      put(0, 2, 2, 0);
      put(0, 4, 2, ids.trim);
      /* 叶片组件(sailStatic 才写; 塔体后写, 覆写檐层——序即几何): 轴心
          ids.axle 3 连格——根 (0,8,1) 覆写檐/连杆 (0,8,2)/轮心 (0,8,3);
          轮面 dz=3(塔前沿外 1 格, 叶轮悬于塔面——真实风车母题)四臂十字,
          臂宽 2 偶宽西偏 [-1,0] 同 pfSpan: 上臂 dy9..8+S · 下臂 dy8-S..7 ·
          东西臂 dx∈[1,S]/[-S,-1] 贴 dy∈{7,8} */
      if (e.sailStatic) {
        for (let dz = 1; dz <= 3; dz++) put(0, 8, dz, ids.axle);
        for (let dy = 9; dy <= 8 + S; dy++) {/* 上臂 */
          for (const dx of [-1, 0]) put(dx, dy, 3, ids.blade);
        }
        for (let dy = 8 - S; dy <= 7; dy++) {/* 下臂 */
          for (const dx of [-1, 0]) put(dx, dy, 3, ids.blade);
        }
        for (let dx = -S; dx <= S; dx++) {/* 东西臂(避开轮心 dx=0) */
          if (dx === 0) continue;
          put(dx, 7, 3, ids.blade);
          put(dx, 8, 3, ids.blade);
        }
      }
    },
    /* 脚印: 同参纯算术投影——动态=纯塔体盒([-3,2]²×dy0..9, bladeSpan
        不参与); 静态并入叶展保守盒(dx∈[-S,S]×dz∈[-3,3]×dy0..8+S)。
        平面 4 角过同一张朝向表(90° 旋转盒恒轴对齐), y 域取写笔最低/
        最高层 */
    foot(e, x, y, z, orient) {
      const S = e.bladeSpan;
      const corners = [[-3, 2], [-3, -3], [2, 2], [2, -3]]; /* 塔体 [-3,2]² */
      if (e.sailStatic) {
        for (const dx of [-S, S]) {
          for (const dz of [-3, 3]) corners.push([dx, dz]); /* 叶展保守域 */
        }
      }
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const [dx, dz] of corners) {
        const o = orient(dx, dz);
        x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
        z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
      }
      return {x1, y1: y, z1, x2, y2: y + (e.sailStatic ? 8 + S : 9), z2};
    },
  },
  'cottage-gable': {
    /* 民居 A: 单层人字/阶梯顶小屋(town-prefab-specs §4.5, 视觉对照
       buildings-visual-spec §7.3——友好可读, 无烟火烟囱)。锚=小屋地面中心
       投影, 局部轴 dx 横/dz 前后/dy 竖, face0=south=门窗立面朝 +dz;
       偶宽 8 NW 偏置 dx∈[-4,3], 奇深 7 居中 dz∈[-3,3](平面恰 8×7)。
       dy0 基座实心; dy1..3 墙环(内域空腔无家具)+前门 1w×2h+前窗 2w×2h
       +侧窗; dy4..5 陶橙阶梯顶收分(檐层出挑计入脚印, foot=写域同盒);
       后侧装饰烟囱(无烟, 受 hasChimney)可选; windowLit 为观感开关(脚印
       同形域)。材质经 ids 注入, 不焊死。 */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      hasChimney: true, /* 装饰烟囱(无烟): 缺省 true, 可关 */
      windowLit: false, /* 窗亮观感开关(同形域, 不改脚印) */
      ids: {base: 58, wall: 6, roof: 40, trim: 5, window: 20, door: 6, chimney: 3},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z/put 未用: 自管朝向与写笔 */
      const ids = e.ids;
      const rot = PF_ROTS[(PF_FACE_K[e.face] - PF_FACE_K['south'] + 4) % 4];
      const cgO = (dx, dz) => rot(e.mirror ? -1 - dx : dx, dz); /* 偶宽域内镜像, 盒同域 */
      const cgPut = (dx, dy, dz, id) => {
        const o = cgO(dx, dz);
        pfCell(x + o[0], y + dy, z + o[1], id);
      };
      /* dy=0 基座: 恰 8×7 实心板 */
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) cgPut(dx, 0, dz, ids.base);
      }
      /* dy=1..3 墙环: 周界 wall, 内域不写=空腔(无家具) */
      for (let dy = 1; dy <= 3; dy++) {
        for (let dx = -4; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const onRing = dx === -4 || dx === 3 || dz === -3 || dz === 3;
            if (onRing) cgPut(dx, dy, dz, ids.wall);
          }
        }
      }
      /* 前立面(+dz, dz=3)开口与窗: 门 1w×2h dx=-1, dy1..2(门材质在位) */
      cgPut(-1, 1, 3, ids.door);
      cgPut(-1, 2, 3, ids.door);
      /* 前窗 2w×2h: dx∈[1,2], dy2..3 连续 ids.window */
      for (let dx = 1; dx <= 2; dx++) {
        for (let dy = 2; dy <= 3; dy++) cgPut(dx, dy, 3, ids.window);
      }
      /* 侧窗: 右侧墙面 x=3(非前后立面) dy2 放 ids.window */
      cgPut(3, 2, 0, ids.window);
      /* dy=4..5 陶橙阶梯顶: dy4 全覆 8×7, dy5 内缩一圈 6×5(收分) */
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) cgPut(dx, 4, dz, ids.roof);
      }
      for (let dx = -3; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) cgPut(dx, 5, dz, ids.roof);
      }
      /* 后侧装饰烟囱(无烟): hasChimney 时后沿 dz=-3 单格 dy5,
         正上方 dy6 无物(无烟); foot 已覆盖 dy0..5 */
      if (e.hasChimney) cgPut(-2, 5, -3, ids.chimney);
    },
    foot(e, x, y, z, orient) {
      const rot = PF_ROTS[(PF_FACE_K[e.face] - PF_FACE_K['south'] + 4) % 4];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-4, 3]) {
        for (const dz of [-3, 3]) {
          const o = rot(dx, dz); /* 盒同域: 不随 mirror 平移 */
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      /* 8×7 基座/檐同域, 全写入落在 dy0..5(含后侧装饰烟囱, 无烟), 高 6 */
      return {x1, y1: y, z1, x2, y2: y + 5, z2};
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
    const orient = pfOrient(row, e.face, e.mirror);
    row.kernel(e, x, y, z, orient, (dx, dy, dz, bid) => {
      const o = orient(dx, dz);
      pfCell(x + o[0], y + dy, z + o[1], bid);
    });
    return row.foot(e, x, y, z, orient);
  },
  footOf(id, x, y, z, v) {/* 同参同盒零写纯查询 */
    const row = pfRow(id);
    const e = pfMerge(row, id, v);
    return row.foot(e, x, y, z, pfOrient(row, e.face, e.mirror));
  },
};
