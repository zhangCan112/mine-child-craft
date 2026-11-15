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
     接线的现成缝, 本期不接线) · PrefabKit.spinnerOf(id, x, y, z, v?)
     旋转组件查询第三门(TIDEA-01: 两遍差分收叶片组件 {center,axis,cells}
     世界系零写, 非 spin 行拼写域错——门面「恰好两个入口」拍板自此三门)。
   依赖(均经全局名, 调用期解析): voxel.js 的 setBlockRaw/getBlock(under-room
     出路垫脚「空气才垫」与沙盖置换的世界读数, getBlock 界外=0) +
     config.js 的 WORLD_W/WORLD_D/WORLD_H(越界守卫, scene-kit skInWorld
     同款先例) + scene-kit.js 的 SceneKit.rand(mound 掷点, 世界坐标散列),
     加载序: config → voxel → scene-kit → 本文件 → 使用方。
   缺省材质逐槽对 config 实义核真(T-PREFAB-09 材质基线: 危险/错义 id 禁作
   缺省, 测试黑名单钉死; 注入是调用方自由)。
   可测性声明: 零三维渲染库 · 零 DOM · 有同名单测(test/prefab-kit.test.js)。
   ------------------------------------------------------------
   v 键集 = 行 defaults 键集(唯一权威, 未知键即炸); 检查按行声明收放(行
   defaults 没声明的轴不查, 各行只认自己的键面)。错误两档: 拼写域(未知
   id · 未知 v 键含 size/ids/exit 子键 · 枚举值非法(PF_ENUMS 十轴) ·
   piles:'terrain' 缺 ground · 行 require 必传轴缺 mat/top/rock)
   →throw(装场期炸=测试当场红); 几何数值域(size/steps/half 等负值或非
   整数, ground 非有限数)→钳。枚举轴值域单份在 PF_ENUMS(§1.10 升格),
   错误消息由表派生。朝向=整数格点旋转表(90° 倍数恒整数格,
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
/* 两类写笔并存(T-PREFAB-09 ⑤评估结论, 注释明示零行为变更): 统一 put 通道=
   place 内联 orient 写笔(全行默认; mirror=-dx 先翻后旋, 偶宽域脚印盒平移
   一格——shop-awning/stash-hut/house-loft/stall-canopy 口径) vs cottage-gable
   kernel 自管 cgO(域内镜像 -1-dx, 盒不动)。收编需 pfOrient 补偶宽偏置镜像
   参数并回归四行已清票, 属行为变更——挂架构线单独票议(T-05 评审建议 B 档
   先落注释明示) */
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

/* stall-canopy 布幔缺省的 theme 映射单份(§4.7「布幔奶油/樱粉/天蓝 canopy
   按 theme 注入」→现调色板 v2 字库): bread/generic→52 羊毛奶油 ·
   flower→78 粉羊毛樱粉(v2: 16 大红出局, 78 已入字库——树 pinkLeaf 先例) ·
   fruit→15 蓝羊毛天蓝 · fish→15 同天蓝(鱼水色) · pumpkin→76 南瓜亮橙
   (Step E: fish/pumpkin 档配平, scene 需求表摊位扩展); 显式 v.ids.canopy
   覆写映射(pfMerge 判显式后才注入) */
const PF_STALL_CANOPY = {bread: 52, flower: 78, fruit: 15, fish: 15,
  pumpkin: 76, generic: 52};

/* stall-canopy 顶层滚边(双层阶梯顶 tier2 前条)的 theme 映射单份(Step D:
   顶改双层阶梯——tier1 主色=canopy 上表, tier2 副色=本表, 奶油×樱粉
   对偶保六摊位家族相似): bread/generic→78 粉羊毛 · flower→52 羊毛奶油
   (主副互换) · fruit→52 · fish→52 同奶油 · pumpkin→78 粉羊毛(Step E
   配平同法); 显式 v.ids.canopyTrim 覆写映射(同 canopy 口径) */
const PF_STALL_TRIM = {bread: 78, flower: 52, fruit: 52, fish: 52,
  pumpkin: 78, generic: 78};

/* 枚举轴值域表(conventions §1.10 升格: 值域清单原散在实现链/头注释/错误
   消息/规格 ≥3 处且逐行追加已生漂移——单份数据源+循环消费, 错误消息由表
   派生; face 恒查=全行共有轴, size 为双型轴——stall-canopy 字符串枚举档
   受检/stilt-hut 对象档走下方形状校验故循环内按 typeof 收; 循环键序=检查
   位序, 多错位先后者与收编前一致(test/prefab-kit.test.js 逐字钉)) */
const PF_ENUMS = {
  face: 'north/east/south/west',
  piles: 'fixed/terrain',
  roof: 'flat/stepped',
  torch: 'wall/rim/none',
  torches: 'solo/pair',
  windowGlow: 'warm/none',
  signVariant: 'icon/blank',
  roofPitch: 'low/mid',
  theme: 'bread/flower/fruit/fish/pumpkin/generic',
  size: 'sm/md',
};

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
  /* 枚举轴校验(PF_ENUMS 单源): face 恒查, 其余按行声明收放(行 defaults 没
     声明的轴不查——各行只认自己的键面); piles:'terrain' 的 ground 注入检
     随 piles 轴就地(位序=收编前) */
  for (const axis of Object.keys(PF_ENUMS)) {
    if (axis !== 'face' && !pfHas(d, axis)) continue;
    if (axis === 'size' && typeof d.size !== 'string') continue;
    if (!PF_ENUMS[axis].split('/').includes(e[axis])) {
      throw new Error('PrefabKit: ' + axis + ' 非法「' + e[axis] + '」(' + PF_ENUMS[axis] + ')');
    }
    if (axis === 'piles' && e.piles === 'terrain' && typeof e.ground !== 'function') {
      throw new Error('PrefabKit: piles:\'terrain\' 必传 ground(x,z) 注入缝(引擎不认识地形权威)');
    }
  }
  if (d.size !== undefined && typeof d.size !== 'string') {
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
  /* stall-canopy 布幔缺省按 theme 注入(§4.7「canopy 按 theme 注入」):
      未显式给 v.ids.canopy/canopyTrim 时按 theme 补映射(显式键已在上方
      合并胜出, theme 不反杀); 部分注入的其余槽已由 Object.assign 回落
      行缺省。canopy=顶棚主色(PF_STALL_CANOPY)/canopyTrim=顶层滚边副色
      (PF_STALL_TRIM), 两表同法各自单源 */
  if (pfHas(d, 'theme') && (v === undefined || v.ids === undefined ||
      v.ids.canopy === undefined)) {
    e.ids = Object.assign({}, e.ids, {canopy: PF_STALL_CANOPY[e.theme]});
  }
  if (pfHas(d, 'theme') && (v === undefined || v.ids === undefined ||
      v.ids.canopyTrim === undefined)) {
    e.ids = Object.assign({}, e.ids, {canopyTrim: PF_STALL_TRIM[e.theme]});
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
  /* board-pool 跳板长钳域 [6,8]/池径钳域 [2,3](§4.8 契约数值域→钳口径;
     非有限数回落缺省——boardLen 6/poolSize 2) */
  if (pfHas(d, 'boardLen')) {
    const bl = Math.floor(Number(e.boardLen));
    e.boardLen = Number.isFinite(bl) ? Math.max(6, Math.min(8, bl)) : 6;
  }
  if (pfHas(d, 'poolSize')) {
    const ps = Math.floor(Number(e.poolSize));
    e.poolSize = Number.isFinite(ps) ? Math.max(2, Math.min(3, ps)) : 2;
  }
  if (pfHas(d, 'mirror')) e.mirror = !!e.mirror;
  if (pfHas(d, 'door')) e.door = !!e.door;
  if (pfHas(d, 'doorOpen')) e.doorOpen = !!e.doorOpen; /* shop-awning 门洞敞开 */
  if (pfHas(d, 'chest')) e.chest = !!e.chest;
  if (pfHas(d, 'flags')) e.flags = !!e.flags;
  if (pfHas(d, 'sailStatic')) e.sailStatic = !!e.sailStatic; /* windmill 叶轮静态 */
  if (pfHas(d, 'porchLamp')) e.porchLamp = !!e.porchLamp; /* stash 门楣挂灯 */
  if (pfHas(d, 'hasChimney')) e.hasChimney = !!e.hasChimney; /* cottage-gable 装饰烟囱(无烟) */
  if (pfHas(d, 'windowLit')) e.windowLit = !!e.windowLit; /* cottage-gable 窗亮观感开关 */
  if (pfHas(d, 'balcony')) e.balcony = !!e.balcony; /* house-loft 二层小阳台收放 */
  if (pfHas(d, 'awningAccent')) e.awningAccent = !!e.awningAccent; /* house-loft 布幔点缀收放 */
  return e;
}

/* 行表(清单唯一权威, kit 自持): 行字段 facing0(现朝向)/defaults(变种缺省
   面, 键集=合法 v 键)/require(必传轴)/foot(脚印模板, 形常数纯算术投影)/
   kernel(几何内核)。十五行: stilt-hut(P0 高脚木屋对)/under-room/mound
   (P1 地下宝箱室与巢穴丘)/tower-belfry(T-PREFAB-01 钟塔)/shop-awning
   (T-PREFAB-02 店身+前廊遮檐铺面)/stash-hut(T-PREFAB-03 秘密储藏小屋)/
   windmill-tower(T-PREFAB-04 风车塔)/cottage-gable(T-PREFAB-05 民居 A)/
   house-loft(T-PREFAB-06 民居 B 双层挑窗/错顶形)/stall-canopy(T-PREFAB-07
   市集摊位), 按形命名不按图命名; TIDEA 波次一增五小件(TIDEA-04 稻草人/
   TIDEA-08 晾衣绳·柴堆·鸡窝(窗台花箱走 assembly windowbox kind 单源
   不建行)/TIDEA-10 高跳板与小水池=§4.8 board-pool 契约实装, PO 批
   「动骨架-轻」)——全静态陈设, 零行为接线零波次二预设(town-npc* 零触) */
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
    /* 钟塔 v2 三段式立面(视觉重制总纲 §3 G 层): 石砖基座 6×6×2 → 石英/
       深木 half-timber 塔身 4×4×8 → 开敞钟亭+金钟+阶梯收分顶+顶旗的竖向
       地标件。锚=塔心投影, 局部轴 dx 横/dz 前后/dy 竖; face0=south=前立面
       朝 +dz。heightTier=封顶档 {14,15,16}: 16→dy15 顶旗/15→dy14 收分帽/
       14→dy13 檐板封顶; 缺省 16(总高 ~16 读法, 体量域 [14,16])。
       door/doorTop=门两格(64/65 关态成对块, 总纲 §2 字库点名)——T-09
       door 旗标基线显式豁免(见测试); 金钟用灯块 19(自发光=钟亭夜里
       「看得见钟」的趣味光, §2 字库「亮橙-趣味光」读法) */
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      heightTier: 16, /* 档 {14,15,16} 钳域, 封顶比例(缺省 16=顶旗档) */
      flags: true,
      /* 材质注入, 缺省裸数字(总纲 §2 字库→现调色板, T-PREFAB-09 逐槽实义
          核真): base 石砖中石基座 · wall 石英奶油白填墙(half-timber 墙面,
          石英主导) · pillar/trim 木头暖木-深(角柱与门楣/檐层——half-timber
          框架) ·
          roof 红砖陶橙阶梯顶 · bell 灯块自发光金钟 · window 玻璃板前窗 ·
          flag 粉羊毛顶旗(樱粉) · door/doorTop 门叶两格(关态成对块) */
      ids: {base: 13, wall: 17, pillar: 5, trim: 5, roof: 9, bell: 19,
        window: 68, flag: 78, door: 64, doorTop: 65},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids; const tier = e.heightTier;
      const capDy = tier - 1; /* 封顶层: 16→15(顶旗)/15→14(收分帽)/14→13(檐板) */
      /* dy0..1 基座: 恰 6×6×2 实心(dx,dz∈[-2,3])石砖——三段式第一段,
          比旧版高一格, 塔身收窄读「坐在石台上」 */
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = -2; dx <= 3; dx++) {
          for (let dz = -2; dz <= 3; dz++) put(dx, dy, dz, ids.base);
        }
      }
      /* dy2..9 塔身: 恰 4×4×8 实心([-1,2]²)half-timber——石英填墙+四角深木
          角柱贯通。PO 裁决(2026-11-15, 石英主导重平衡): 原 dy5/dy9 两道周界
          木腰线撤除——4 宽脸面角柱已占 50% 宽, 再叠腰线致木主导、远读似旧
          木墙(shot 12 误判旧墙残留即此因); 水平节奏改由门楣/窗楣/檐层承担,
          边中格恒石英板(与风车白塔读感一致) */
      for (let dy = 2; dy <= 9; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          for (let dz = -1; dz <= 2; dz++) {
            const corner = (dx === -1 || dx === 2) && (dz === -1 || dz === 2);
            put(dx, dy, dz, corner ? ids.pillar : ids.wall);
          }
        }
      }
      /* 前立面 dz=2 覆写(后写者赢, 序即几何): 门叶两格 (0,2..3,2)=
          door/doorTop(关态成对块) + 门楣 (0,4,2)=trim + 前窗 2w×2h
          (0..1,6..7,2)=window 玻璃板(门-楣-石英板带-窗的立面节奏) */
      put(0, 2, 2, ids.door);
      put(0, 3, 2, ids.doorTop);
      put(0, 4, 2, ids.trim);
      put(0, 6, 2, ids.window);
      put(1, 6, 2, ids.window);
      put(0, 7, 2, ids.window);
      put(1, 7, 2, ids.window);
      /* dy10..12 钟亭 4×4: 四角深木柱贯通三层, dy10..11 四边开敞(不写,
          金钟四面可见), dy12 檐层恰 4×4 全 trim(平檐板收头) */
      for (let dy = 10; dy <= 12; dy++) {
        for (const dx of [-1, 2]) {
          for (const dz of [-1, 2]) put(dx, dy, dz, ids.pillar);
        }
      }
      for (let dx = -1; dx <= 2; dx++) {
        for (let dz = -1; dz <= 2; dz++) put(dx, 12, dz, ids.trim);
      }
      /* 金钟: 恰 2×2×2 室心(dx,dz∈[0,1]×dy10..11)=bell 灯块——自发光,
          开敞亭四面透光(「夜里看得见钟」) */
      for (let dx = 0; dx <= 1; dx++) {
        for (let dz = 0; dz <= 1; dz++) {
          for (let dy = 10; dy <= 11; dy++) put(dx, dy, dz, ids.bell);
        }
      }
      /* dy13..cap 阶梯收分顶: dy13 恰 6×6 roof 檐板(盖过基座缘)→
          cap≥14 再收 4×4 roof 帽 → cap≥15 顶旗单格 (0,15,0)=flag
          (阶梯-帽-旗的三级收分, 顶旗读「塔尖飘旗」) */
      for (let dx = -2; dx <= 3; dx++) {
        for (let dz = -2; dz <= 3; dz++) put(dx, 13, dz, ids.roof);
      }
      if (capDy >= 14) {
        for (let dx = -1; dx <= 2; dx++) {
          for (let dz = -1; dz <= 2; dz++) put(dx, 14, dz, ids.roof);
        }
      }
      if (capDy >= 15) put(0, 15, 0, ids.flag);
      /* 檐下小旗(受 flags): 钟亭檐层同高外挑一格, 悬空点缀两则 */
      if (e.flags) {
        put(-2, 12, -1, ids.flag);
        put(3, 12, 1, ids.flag);
      }
    },
    foot(e, x, y, z, orient) {
      const tier = e.heightTier;
      const topDy = Math.max(14, tier - 1); /* 覆盖 dy0..15 全高, 低档保守兜 14 */
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
    /* 商店 v2(视觉重制总纲 §3 G+checkpoint 定稿): 三段式立面店身+前廊柱廊+
       招牌层的临街铺面(town-prefab-specs §4.2 契约不变; 视觉对照 buildings-
       visual-spec §7.2 与 §8 去威胁红线——「熔岩」仅作暖橙装饰意象, 禁真实
       熔岩/明火, 19 灯块=暖光非火)。锚=店身地面中心投影, 局部轴 dx 横/
       dz 前后/dy 竖, face0=south=店面朝 +dz; 偶宽 NW 偏置同 pfSpan 口径:
       宽 10→dx∈[-5,4], 深 8→dz∈[-4,3], 前廊向 +dz 外延 dz=4 一格(平面
       共 10×9)。v2 几何: 墙环改「石英抹灰门脸+木板侧后墙」混搭(§3 M「6
       木板为主, 17 石英抹灰混搭」), 前廊立深木柱廊(柱 dy1..3+柱顶横梁
        dy4), 橱窗=68 玻璃板+窗台 19 内藏暖光带(warm 档), 遮檐双层布幔
        (dy5 天蓝主幔+dy6 奶油滚边两端两格, §2 布幔=15/17), 招牌改「端框
        5 深木+板 76 南瓜亮橙(§2「亮橙-招牌」)+鸡剪影立板」(Step D lead
        终审定稿: dy6..7 双层立板 8×2 门上方居中——signBird 白身鸡影
        +signComb 红冠+signLight 灯点两枚; checkpoint 徽记案撤, 「或 17
        勾勒」可选项未取省格); 门前桶/南瓜陈设省略(checkpoint 裁决: 归
        scene 线摊位陈设范畴)。总高不变 dy7 封顶, footprint 10×9×8
        契约不动。 */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      doorOpen: true, /* 门洞 2w×3h: true 掏空气(白天敞开店门)/false 补抹灰墙 */
      windowGlow: 'warm', /* 橱窗窗台带: warm=glow 19 内藏暖光 / none=plaster 抹灰 */
      signVariant: 'icon', /* 招牌板: icon=鸡剪影立板 / blank=全板(零鸟零灯) */
      /* 材质注入, 缺省裸数字(视觉重制 §2 字库 v2 重映射; Step D 招牌
         返工换槽): base 石砖基座 · wall 木板侧后墙 · plaster 石英抹灰
         门脸(v2 新槽) · trim 深木角柱/廊柱/横梁/招牌端框 · roof 红砖
         陶橙 · awning 天蓝主幔(v2 换值) · awningTrim 奶油滚边(v2 新槽,
         Step D 缩两端两格) · signBg 南瓜亮橙招牌板(旧 15 蓝→76) ·
         signBird 鸡剪影白身(Step D 新槽, 52 羊毛奶油) · signComb 鸡冠
         (Step D 新槽, 16 红羊毛) · signLight 招牌灯点(Step D 新槽, 19
         暖光非火 §8 红线) · glow 灯块窗台内藏暖光 · window 玻璃板
         橱窗(旧 18 玻璃→68 玻璃板, 大面橱窗用带框板) */
      ids: {base: 13, wall: 6, plaster: 17, trim: 5, roof: 9, awning: 15,
        awningTrim: 17, signBg: 76, signBird: 52, signComb: 16,
        signLight: 19, glow: 19, window: 68},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z 未用: 纯局部系直写(无地形读数) */
      const ids = e.ids;
      /* dy=0 地台: 店身 10×8(dx∈[-5,4]×dz∈[-4,3])+前廊外延 dz=4 → 恰 10×9 全 base */
      for (let dx = -5; dx <= 4; dx++) {
        for (let dz = -4; dz <= 4; dz++) put(dx, 0, dz, ids.base);
      }
      /* dy=1..4 店身墙环(店身周界, 不含前廊; 内域不写=空): 四角角柱=trim
         (深木); 前立面 dz=3 门脸格=plaster 抹灰/侧后墙=wall 木板——后写者赢,
         序即几何; 前立面逐格覆写橱窗/窗台光带/门洞 */
      for (let dy = 1; dy <= 4; dy++) {
        for (let dx = -5; dx <= 4; dx++) {
          for (let dz = -4; dz <= 3; dz++) {
            const corner = (dx === -5 || dx === 4) && (dz === -4 || dz === 3);
            const onRing = corner || dx === -5 || dx === 4 || dz === -4 || dz === 3;
            if (!onRing) continue; /* 内域空 */
            let id = corner ? ids.trim : (dz === 3 ? ids.plaster : ids.wall);
            if (dz === 3 && !corner) {/* 前立面门脸地图 */
              const win = (dx >= -4 && dx <= -3) || (dx >= 2 && dx <= 3);
              if (win) {/* 橱窗 2w×2h: dy3..4=68 玻璃板; 窗台 dy2=19 内藏暖光带 */
                id = dy >= 3 ? ids.window :
                  (dy === 2 ? (e.windowGlow === 'warm' ? ids.glow : ids.plaster) :
                    ids.plaster); /* dy1 窗基=抹灰(光带只在窗台层) */
              }
              if (dx >= -1 && dx <= 0 && dy <= 3) id = e.doorOpen ? 0 : ids.plaster; /* 门洞 2w×3h */
            }
            put(dx, dy, dz, id);
          }
        }
      }
      /* 前廊柱廊(dz=4): 柱 dy1..3 落 dx∈{-5,-2,1,4} 四根 trim 深木柱
         (两端+门两侧)+dy4 柱顶横梁全宽 trim 一条——廊下空间可穿行 */
      for (const px of [-5, -2, 1, 4]) {
        for (let dy = 1; dy <= 3; dy++) put(px, dy, 4, ids.trim);
      }
      for (let dx = -5; dx <= 4; dx++) put(dx, 4, 4, ids.trim);
      /* dy=5 檐层: 店身 10×8=roof + 前廊 dz=4 全宽=awning 天蓝主幔(前檐突出=遮檐) */
      for (let dx = -5; dx <= 4; dx++) {
        for (let dz = -4; dz <= 3; dz++) put(dx, 5, dz, ids.roof);
        put(dx, 5, 4, ids.awning);
      }
      /* dy=6 屋顶内缩一圈 8×6(dx∈[-4,3]×dz∈[-3,2])=roof, 域外空; 前廊
         dz=4 滚边缩至两端 dx∈{-5,4} 两格 awningTrim(Step D: dz=4 中段
         让位招牌立板, 滚边成角饰) */
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -3; dz <= 2; dz++) put(dx, 6, dz, ids.roof);
      }
      put(-5, 6, 4, ids.awningTrim);
      put(4, 6, 4, ids.awningTrim);
      /* dy6..7 招牌立板: 恰 8×2(dx∈[-4,3]×dz=4), 门上方居中挑出前廊上空
         (Step D lead 终审鸡剪影案): 端框 trim 两端×2 行/板面 signBg 南瓜
         亮橙/icon 档行图(dx=-4..3)——dy7=[trim,signBg,signComb,signBird,
         signBird,signBg,signBg,trim](signComb 红冠+signBird 白身头颈),
         dy6=[trim,signLight,signBird,signBird,signBg,signBg,signLight,
         trim](signLight 灯点两枚+signBird 白身); blank 档=端框+全板
         零鸟零灯; dy≥8 无物(封顶于 7) */
      const sign7 = ['trim', 'signBg', 'signComb', 'signBird', 'signBird',
        'signBg', 'signBg', 'trim'];
      const sign6 = ['trim', 'signLight', 'signBird', 'signBird', 'signBg',
        'signBg', 'signLight', 'trim'];
      for (let i = 0; i < 8; i++) {
        const icon = e.signVariant === 'icon';
        const end = i === 0 || i === 7;
        put(i - 4, 7, 4, icon ? ids[sign7[i]] : (end ? ids.trim : ids.signBg));
        put(i - 4, 6, 4, icon ? ids[sign6[i]] : (end ? ids.trim : ids.signBg));
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
    /* 秘密储藏小屋 v2(视觉重制总纲 §3 G「小屋+桶堆+51 箱子+苔石点缀」:
       外部道具升格入蓝图, 取代 town-prefab-specs §4.3「道具散布不入
       蓝图」旧约——「隐秘储藏」读法): 中石基座(对角苔石)+墙环+双层
       小巧屋顶+门前桶堆/储物箱陈设(town-prefab-specs §4.3 几何契约
       不变; 视觉对照 buildings-visual-spec §5.2 P1-01——「小而神秘但
       友好」, 无阴暗压迫)。锚=小屋地面中心投影, 局部轴 dx 横/dz 前后/
       dy 竖, face0=south=门面朝 +dz; 偶宽 6 NW 偏置同 pfSpan 口径:
       dx,dz∈[-3,2] (宽=坐标差+1=6, 中心偏置 −0.5)。门前陈设后写覆写
       前墙格——序即几何; 内域空腔无家具; 无光/火语义槽位(ids 白名单
       无 torch/glow, §8 去威胁红线) */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      roofPitch: 'mid', /* 顶档: mid=dy5 内缩顶封顶(总高 6, 缺省)/low=dy4
          檐层即封顶(总高 5)——高 5-6 读作含 dy0 基座总层数 */
      door: true, /* true=门叶块在位(ids.door/doorTop 材质有几何生命)/
          false=门洞敞开空气 */
      porchLamp: false, /* TIDEA-09 门楣挂灯(波次二): true=门洞上半 (0,2,2)
          覆 doorTop 挂 ids.porchLamp 单格 19——挂点=数据「基+dy2」(scene
          closeout §8.3 porchLamp {dx2,dy2,dz0} 世界 (51,26,98) 对账:
          局部恰门上叶位, 半门挂灯读法; false=门叶成对原样) */
      /* 材质注入, 缺省裸数字(§4.3 语义→现调色板 v2; Step D 换值+扩键):
          base 石头中石基座 · wall 木板暖木-中墙体 · roof/trim 木头暖木-深
          屋顶与屋檐(小巧屋顶同檐材族) · door 木门叶下半(6→64 全局字库
          门叶统一, cottage/tower 先例) · doorTop 门上叶(Step D 新槽, 65
          同族上半) · metalAccent 金属铁灰小配件(门侧点缀, §4.3「可选」
          拍板槽位常驻) · barrel 橡木桶堆(Step D 新槽, 5 木头桶材族) ·
          chest 储物箱(Step D 新槽, 51 箱子——零危险旗标 T-09 审计免
          豁免) · mossy 苔石基座点缀(Step D 新槽, 14 苔石「隐秘」读法) ·
           porchLamp 门楣挂灯(波次二新槽, 19 灯块 light15 暖金, TIDEA-09) */
      ids: {base: 3, wall: 6, roof: 5, trim: 5, door: 64, doorTop: 65,
        metalAccent: 12, barrel: 5, chest: 51, mossy: 14, porchLamp: 19},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z 未用: 纯局部系直写(无地形读数) */
      const ids = e.ids;
      /* dy=0 基座: 恰 6×6 实心板(dx,dz∈[-3,2]), 对角 (-3,-3)/(2,2) 两格
          mossy 苔石点缀(隐秘读法), 域外无物 */
      for (let dx = -3; dx <= 2; dx++) {
        for (let dz = -3; dz <= 2; dz++) {
          put(dx, 0, dz, (dx === -3 && dz === -3) || (dx === 2 && dz === 2) ?
            ids.mossy : ids.base);
        }
      }
      /* dy=1..3 墙环: 周界 wall, 内域不写=空腔(无家具); 门前陈设(门叶/
          桶堆/箱/小配件)后写覆写前墙格——序即几何 */
      for (let dy = 1; dy <= 3; dy++) {
        for (let dx = -3; dx <= 2; dx++) {
          for (let dz = -3; dz <= 2; dz++) {
            const onRing = dx === -3 || dx === 2 || dz === -3 || dz === 2;
            if (!onRing) continue; /* 内域空 */
            put(dx, dy, dz, ids.wall);
          }
        }
      }
      /* 门叶 1w×2h 前沿中轴 (0,dy1..2,2): v2 上下分槽——dy1=door 下半/
          dy2=doorTop 门上叶(64/65 全局门叶字库统一); true=在位/false=
          掏空气(门洞敞开); 门上 dy3 恒墙(环写已补); 门叶在 mirror 轴上
          格 dx=0(翻 dx 不变式) */
      put(0, 1, 2, e.door ? ids.door : 0);
      put(0, 2, 2, e.door ? ids.doorTop : 0);
      /* 门楣挂灯(TIDEA-09, porchLamp 才写): 门洞上半覆 doorTop 单格 19
         (挂点=数据「基+dy2」; 灯笔在门叶笔后=后写者赢, door=false 亦挂) */
      if (e.porchLamp) put(0, 2, 2, ids.porchLamp);
      /* 门前陈设(§3 G 升格): 桶堆 2+2+1——dx∈{-3,-2}×dz=2 前墙格 dy1..2
          各两格 barrel+顶格 dy3@(-3,2) 靠角错位码放; 储物箱 chest 一格
          @(-1,1,2) 居门西侧; 门东侧铁灰小配件 (1,1,2)=metalAccent(受
          door 开合不动) */
      put(-3, 1, 2, ids.barrel); put(-2, 1, 2, ids.barrel);
      put(-3, 2, 2, ids.barrel); put(-2, 2, 2, ids.barrel);
      put(-3, 3, 2, ids.barrel);
      put(-1, 1, 2, ids.chest);
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
    /* 风车塔 v2(视觉重制总纲 §3 G 层): 石砖基座+收分塔身(石英墙+深木
       箍带)+红砖锥顶(檐层/锥/锥尖三级)+「石英肋+木板帆」错位十字叶轮
       +南瓜亮橙轴心——走查实证的「灰暗风车」换暖色三材读法。锚=塔基地面
       中心投影, 局部轴 dx 横/dz 前后/dy 竖, face0=south=叶轮面朝 +dz;
       偶宽 NW 偏置同 pfSpan 口径: 6→[-3,2]², 5×5 居中 [-2,2]², 4×4
       [-2,1]², 2×2 [-1,0]²。
       叶片组件(肋+帆+轴)受 sailStatic 整体收放(§4.4「资产可分件预留」
       ——动态旋转属实现/动画选型, 蓝图只给静态造型; false=组件整体不入
       几何, 塔体独立成景); 无光/火语义槽位(ids 白名单无 torch/glow,
       §8 去威胁红线——机械件无裸露危险) */
    facing0: 'south',
    /* spin 声明(spinnerOf 第三门参数, TIDEA-01 波次二): center=叶轮 hub
       局部格(轴心南瓜列 dy8·轮面 dz3)——其他行无此声明, spinnerOf 调用
       即抛拼写域错(门面拼写域纪律) */
    spin: {center: {dx: 0, dy: 8, dz: 3}},
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      sailStatic: true, /* 叶轮静态: true=叶片组件(肋+帆+轴)入几何/0 值钳 false */
      bladeSpan: 4, /* 叶展档 [3,4]: 4=臂顶 dy12(总高 13)/3=收短 dy11(总高 12) */
      /* 材质注入, 缺省裸数字(总纲 §2 字库→现调色板, T-PREFAB-09 逐槽实义
          核真): base 石砖中石基座 · wall 石英奶油白塔身 · roof 红砖暖褐
          檐层与锥顶 · trim 木头深箍带与小窗 · blade 木板帆面 · axle 南瓜
          亮橙轴心(总纲「南瓜轴心」趣味光意象; 总纲正文的「75」系 id 笔误
          ——§2 字库表权威南瓜=76, 75 是铁块, 勘误登记 2026-11-15) ·
          accent 石英细肋(叶轮十字骨架) */
      ids: {base: 13, wall: 17, roof: 9, trim: 5, blade: 6, axle: 76, accent: 17},
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
      /* dy=8 檐层 4×4=roof · dy=9 锥顶 2×2([-1,0]²)=roof · dy=10 锥尖
          单格 (0,10,0)=roof(新增第三级收分——塔顶剪影更挺拔), 域外空 */
      for (let dx = -2; dx <= 1; dx++) {
        for (let dz = -2; dz <= 1; dz++) put(dx, 8, dz, ids.roof);
      }
      for (let dx = -1; dx <= 0; dx++) {
        for (let dz = -1; dz <= 0; dz++) put(dx, 9, dz, ids.roof);
      }
      put(0, 10, 0, ids.roof);
      /* 门洞 1w×2h 前沿中轴 (0,dy1..2,2)=掏空气 · 小窗 (0,4,2)=trim
          (§7.5 y4 小窗居中拍板): 塔身后写覆写——序即几何 */
      put(0, 1, 2, 0);
      put(0, 2, 2, 0);
      put(0, 4, 2, ids.trim);
      /* 叶片组件(sailStatic 才写; 塔体后写, 覆写檐层——序即几何): 轴心
          ids.axle 3 连格——根 (0,8,1) 覆写檐/连杆 (0,8,2)/轮心 (0,8,3);
          轮面 dz=3(塔前沿外 1 格, 叶轮悬于塔面)十字骨架=石英细肋 accent
          (单格臂), 帆板=木板 blade 单列贴肋错位外侧(上臂帆偏西 dx=-1/
          下臂帆偏东 dx=1/东臂帆偏上 dy=9/西臂帆偏下 dy=7)——「斜格栅」
          风车读法, 四臂满帆 S4=28 格/S3=20 格 */
      if (e.sailStatic) {
        for (let dz = 1; dz <= 3; dz++) put(0, 8, dz, ids.axle);
        for (let dy = 9; dy <= 8 + S; dy++) {/* 上臂肋 */
          put(0, dy, 3, ids.accent);
        }
        for (let dy = 8 - S; dy <= 7; dy++) {/* 下臂肋 */
          put(0, dy, 3, ids.accent);
        }
        for (let dx = 1; dx <= S; dx++) {/* 东臂肋 */
          put(dx, 8, 3, ids.accent);
        }
        for (let dx = -S; dx <= -1; dx++) {/* 西臂肋 */
          put(dx, 8, 3, ids.accent);
        }
        for (let dy = 10; dy <= 8 + S; dy++) {/* 上臂帆(肋西错位) */
          put(-1, dy, 3, ids.blade);
        }
        for (let dy = 8 - S; dy <= 6; dy++) {/* 下臂帆(肋东错位) */
          put(1, dy, 3, ids.blade);
        }
        for (let dx = 2; dx <= S; dx++) {/* 东臂帆(肋上错位) */
          put(dx, 9, 3, ids.blade);
        }
        for (let dx = -S; dx <= -2; dx++) {/* 西臂帆(肋下错位) */
          put(dx, 7, 3, ids.blade);
        }
      }
    },
    /* 脚印: 同参纯算术投影——动态=纯塔体盒([-3,2]²×dy0..10 锥尖, bladeSpan
        不参与); 静态并入叶展保守盒(dx∈[-S,S]×dz∈[-3,3]×dy0..max(8+S,10)
        ——锥尖 dy10 兜底, S3 时叶顶 dy11 仍高于锥尖)。平面 4 角过同一张
        朝向表(90° 旋转盒恒轴对齐), y 域取写笔最低/最高层 */
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
      return {x1, y1: y, z1, x2, y2: y + (e.sailStatic ? Math.max(8 + S, 10) : 10), z2};
    },
  },
  'cottage-gable': {
    /* 民居 A v2(视觉重制总纲 §3 G): 单层「阶梯山墙双坡顶」小屋
       (town-prefab-specs §4.5 契约不变, 视觉对照 buildings-visual-spec
       §7.3——友好可读, 无烟火烟囱)。锚=小屋地面中心投影, 局部轴 dx 横/
       dz 前后/dy 竖, face0=south=门窗立面朝 +dz; 偶宽 8 NW 偏置 dx∈[-4,3],
       奇深 7 居中 dz∈[-3,3](平面恰 8×7)。
       v2 几何(§3 M 三段式+§3 G 字面): dy0 石砖基座; dy1..3 墙环(四角深木
       柱+木板环, 内域空腔无家具)+墙根花坛(门窗域外前墙根 5 格: 草丛/花
       cross 薄块零成本点缀)+前门 64/65 关态成对门叶(总纲 §2 字库)+前窗
       「石英框楣 17+玻璃 18」(§3 G「窗框(17 框+18 玻璃)」)+侧窗; 屋顶改
       「双坡+阶梯山墙」: 脊沿 dz 前后向(门窗立面即山墙立面), dy4 檐层全
       覆 8×7 → dy5 第二阶 roof 4×5+前后山墙带 wall(dx∈[-2,1]×dz=±3) →
       dy6 脊带 roof 2×5+山墙顶尖 wall(dx∈[-1,0]×dz=±3)——阶梯三角山墙
       封端, 总高 dy6(foot y2=y+6, 旧 y+5+1); 后侧装饰烟囱(hasChimney,
       无烟): dy5=chimney 圆石身+dy6=trim 深木口(总纲「4 石+烟囱口 5 深
       木」, 54 雪块为山顶尖塔语义与白天态不符, 总纲原文自弃稿裁决);
       windowLit 预留缝保留(无几何效果, 脚印同形域)。材质经 ids 注入,
       不焊死。 */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      hasChimney: true, /* 装饰烟囱(无烟): 缺省 true, 可关 */
      windowLit: false, /* 预留缝: 当前无几何效果(材质兑现待 spec 补 lit/glow 口径), 脚印同形域 */
      /* 材质注入, 缺省裸数字(视觉重制 §2 字库 v2 重映射; 旧错号 roof:40=
          草丛 thin 可穿行/window:20=TNT 已修禁回退): base 石砖基座(旧 58
          砂岩) · wall 木板墙环 · trim 深木角柱+烟囱口(旧预留槽未消费,
          v2 起消费) · frame 石英窗框楣(v2 新槽) · roof 红砖陶橙双坡顶 ·
          window 玻璃小窗(民居 18 玻璃, 区别于 shop 橱窗 68 玻璃板) ·
          door 门叶下格(旧 6 木板→64 真门叶, 总纲 §2「门 64/65」) ·
          doorTop 门上叶(v2 新槽, 关态成对) · chimney 圆石烟囱身(旧 3
          石头→4, §2「中石-路缘/纹样」4 圆石) · bedGrass/bedFlower1/
          bedFlower2 墙根花坛 cross 薄块(v2 新槽×3: 40 草丛/61 蒲公英/
          62 雏菊, §2「地被零成本点缀」; T-09 审计槽名豁免 thin/
          replaceable——点缀语义, door/doorTop 槽名豁免先例) */
      ids: {base: 13, wall: 6, trim: 5, frame: 17, roof: 9, window: 18,
        door: 64, doorTop: 65, chimney: 4,
        bedGrass: 40, bedFlower1: 61, bedFlower2: 62},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z/put 未用: 自管朝向与写笔 */
      const ids = e.ids;
      const rot = PF_ROTS[(PF_FACE_K[e.face] - PF_FACE_K['south'] + 4) % 4];
      const cgO = (dx, dz) => rot(e.mirror ? -1 - dx : dx, dz); /* 偶宽域内镜像, 盒同域 */
      const cgPut = (dx, dy, dz, id) => {
        const o = cgO(dx, dz);
        pfCell(x + o[0], y + dy, z + o[1], id);
      };
      /* dy=0 基座: 恰 8×7 实心板(石砖) */
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) cgPut(dx, 0, dz, ids.base);
      }
      /* dy=1..3 墙环: 四角深木柱 trim+周界 wall 木板, 内域不写=空腔(无家具) */
      for (let dy = 1; dy <= 3; dy++) {
        for (let dx = -4; dx <= 3; dx++) {
          for (let dz = -3; dz <= 3; dz++) {
            const corner = (dx === -4 || dx === 3) && (dz === -3 || dz === 3);
            const onRing = corner || dx === -4 || dx === 3 || dz === -3 || dz === 3;
            if (onRing) cgPut(dx, dy, dz, corner ? ids.trim : ids.wall);
          }
        }
      }
      /* 墙根花坛(v2 新增): 前墙根 dz=3 门窗域外格(dy1, 后写覆写墙根)——
         门左带 3 格(草丛/蒲公英/草丛)+窗下 2 格(雏菊/草丛), cross 薄块
         贴地读法=花从墙根长出 */
      cgPut(-4, 1, 3, ids.bedGrass);
      cgPut(-3, 1, 3, ids.bedFlower1);
      cgPut(-2, 1, 3, ids.bedGrass);
      cgPut(1, 1, 3, ids.bedFlower2);
      cgPut(2, 1, 3, ids.bedGrass);
      /* 前门(dx=-1, dy1..2, dz=3): 64 门叶下格+65 门上叶——关态成对块,
         后写覆写墙环(v2 真门叶, 旧 6 木板门叶) */
      cgPut(-1, 1, 3, ids.door);
      cgPut(-1, 2, 3, ids.doorTop);
      /* 前窗 2w×2h(dx∈[1,2], dz=3): dy2=18 玻璃+dy3=17 石英框楣——
         「窗框(17 框+18 玻璃)」(后写覆写墙环) */
      cgPut(1, 2, 3, ids.window);
      cgPut(2, 2, 3, ids.window);
      cgPut(1, 3, 3, ids.frame);
      cgPut(2, 3, 3, ids.frame);
      /* 侧窗: 右侧墙面 dx=3(非前后立面) dy2 一格 window */
      cgPut(3, 2, 0, ids.window);
      /* dy=4 檐层: roof 全覆 8×7(出挑计入脚印) */
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) cgPut(dx, 4, dz, ids.roof);
      }
      /* dy=5 屋面第二阶: roof 4×5(dx∈[-2,1]×dz∈[-2,2])+前后山墙带
         wall(dx∈[-2,1]×dz=±3)——阶梯山墙封端(山墙从檐上生, 门窗面
         即山墙立面) */
      for (let dx = -2; dx <= 1; dx++) {
        for (let dz = -2; dz <= 2; dz++) cgPut(dx, 5, dz, ids.roof);
        cgPut(dx, 5, -3, ids.wall);
        cgPut(dx, 5, 3, ids.wall);
      }
      /* dy=6 脊带: roof 2×5(dx∈[-1,0]×dz∈[-2,2])+山墙顶尖
         wall(dx∈[-1,0]×dz=±3)——阶梯三角收顶; dy≥7 无物 */
      for (let dx = -1; dx <= 0; dx++) {
        for (let dz = -2; dz <= 2; dz++) cgPut(dx, 6, dz, ids.roof);
        cgPut(dx, 6, -3, ids.wall);
        cgPut(dx, 6, 3, ids.wall);
      }
      /* 后侧装饰烟囱(无烟; hasChimney 收放): dz=-3 后沿 dx=-2——
         dy5=chimney 圆石身(后写覆写同格山墙带)+dy6=trim 深木口
         (「4 石+口 5 深木」, 白天态无烟, 口即顶格) */
      if (e.hasChimney) {
        cgPut(-2, 5, -3, ids.chimney);
        cgPut(-2, 6, -3, ids.trim);
      }
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
      /* 8×7 基座/檐同域, 全写入落在 dy0..6(双坡脊带/山墙顶尖/烟囱口
         同高 dy6, 无烟), 高 7(旧 6+1: 山墙阶梯与脊带上移) */
      return {x1, y1: y, z1, x2, y2: y + 6, z2};
    },
  },
  'house-loft': {
    /* 民居 B v2(视觉重制总纲 §3 G): 双层「挑窗/错顶/布幔阳台」联排感
       民居(town-prefab-specs §4.6 契约不变, 视觉对照 buildings-visual-
       spec §7.4——双层错落丰富轮廓, 与民居 A 组合成街区)。锚=地面中心
       投影, 局部轴 dx 横/dz 前后/dy 竖, face0=south=门窗立面朝 +dz;
       偶宽 NW 偏置同 pfSpan 口径(shop-awning 同尺寸 10×8 先例): 宽 10→
       dx∈[-5,4], 深 8→dz∈[-4,3](平面恰 10×8)。
       v2 几何(§3 M 三段式+§3 G 字面): dy0 石砖基座; dy1..3 一层墙环
       (四角深木柱+前侧木板/后墙石英抹灰混搭)+前门 64/65 关态成对门叶+
       一层窗「框楣 17+玻璃 18」(窗楣布幔: awningAccent true 覆 15 天蓝
       小布幔, §7.4「可挂天蓝小布幔一角」落真布幔块)+东侧窗; dy4..6 二层
       内缩一圈 8×6 墙环+二层窗组①真挑窗(dx∈[-3,-2]: dy4 trim 托架+
       dy5..6 窗体外挑 dz=3 至一层立面线, 「二层挑窗」体量感; 组②
       dx∈[1,2] 阳台落地窗保持 dz=2)+前立面外挑小阳台(balcony: dy4 暖木
       平台+dy5 布幔帘栏 awning 天蓝——「布幔阳台」); dy7 低屋面全域
       (周界 trim 深木檐口线+内域 roof, §3 M「檐口 5 深木描边」)+dy8 高
       屋面北半内缩 8×4 全 roof——前后错落陶橙顶, dy9 无物, 总高 9 不变。
       材质经 ids 注入不焊死; 无光/火语义槽位(ids 白名单无 torch/glow,
       §8 去威胁红线)。 */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      balcony: true, /* 二层前立面小阳台(暖木平台+布幔帘栏): 缺省 true, 可关 */
      awningAccent: true, /* 一层窗楣布幔(15 天蓝真块): 缺省 true, false 落回窗框楣 */
      /* 材质注入, 缺省裸数字(视觉重制 §2 字库 v2 重映射, 均为真方块 id):
          base 石砖基座(旧 58 砂岩) · wallA 木板前侧墙(6 不变) · wallB
          石英抹灰后墙(旧 5 木头→17, §3 M「17 石英抹灰混搭」) · roof 红
          砖陶橙错落顶(9 不变) · trim 深木角柱/挑窗托架/檐口线(5 不变) ·
          window 玻璃小窗(18 不变, 民居口径) · frame 石英窗框楣(v2 新槽,
          「17 框+18 玻璃」) · door 门叶下格(旧 6 木板→64 真门叶) ·
          doorTop 门上叶(v2 新槽, 关态成对) · balcony 暖木阳台平台(5
          不变, §7.4「2×1 暖木平台」) · awning 天蓝布幔(v2 新槽: 窗楣
          布幔+阳台帘栏, §2「天蓝-布幔」; 布幔真块化替代旧 trim 占位) */
      ids: {base: 13, wallA: 6, wallB: 17, roof: 9, trim: 5, window: 18,
        frame: 17, door: 64, doorTop: 65, balcony: 5, awning: 15},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z/orient 未用: 纯局部系直写,
        朝向与镜像统一走 place 传入的 put 通道, kernel 不自管朝向(票文
        拍板口径; mirror=标准 pfOrient -dx 先翻后旋, 偶宽 [-5,4]→[-4,5]
        盒平移一格, shop-awning/stash-hut 先例, 区别于 cottage-gable
        「域内镜像盒不动」的自管 cgO) */
      const ids = e.ids;
      /* 写序=覆写优先级(后写者赢, 序即几何): 基座→一层墙环→门窗(覆写
          前立面)→窗楣布幔(覆写窗框)→二层墙环→二层窗/挑窗(覆写二层
          前立面)→阳台(立面外空域, 不覆写)→错落顶(立面之上) */
      /* dy=0 基座: 恰 10×8 实心板(石砖), 域外无物 */
      for (let dx = -5; dx <= 4; dx++) {
        for (let dz = -4; dz <= 3; dz++) put(dx, 0, dz, ids.base);
      }
      /* dy=1..3 一层墙环(周界实/内域 8×6 空腔无家具): 三段式混搭——
          四角 trim 角柱(tower/cottage 先例)/后墙面 dz=-4=wallB 石英抹灰/
          前侧墙 dz=3+侧山墙=wallA 木板 */
      for (let dy = 1; dy <= 3; dy++) {
        for (let dx = -5; dx <= 4; dx++) {
          for (let dz = -4; dz <= 3; dz++) {
            const corner = (dx === -5 || dx === 4) && (dz === -4 || dz === 3);
            const onRing = corner || dx === -5 || dx === 4 || dz === -4 || dz === 3;
            if (!onRing) continue; /* 内域空腔 */
            let id = dz === -4 ? ids.wallB : ids.wallA;
            if (corner) id = ids.trim;
            put(dx, dy, dz, id);
          }
        }
      }
      /* 前门(dx=-1, dy1..2, dz=3): 64 门叶下格+65 门上叶——关态成对块,
         后写覆写前立面(v2 真门叶); 一层前窗 2w×2h(dx∈[1,2]): dy2=18
         玻璃+dy3=17 石英框楣+东侧窗(dx=4, dy2)——后写覆写前立面 */
      put(-1, 1, 3, ids.door);
      put(-1, 2, 3, ids.doorTop);
      for (let dx = 1; dx <= 2; dx++) put(dx, 2, 3, ids.window);
      for (let dx = 1; dx <= 2; dx++) put(dx, 3, 3, ids.frame);
      put(4, 2, 0, ids.window);
      /* 窗楣布幔(awningAccent 收放): true 时前窗框楣 dy3 行覆 awning
         天蓝布幔 2 格(§7.4「天蓝小布幔一角」真块化; 后写覆写框楣),
         false=保留石英框楣——差分真实且同盒 */
      if (e.awningAccent) {
        for (let dx = 1; dx <= 2; dx++) put(dx, 3, 3, ids.awning);
      }
      /* dy=4..6 二层墙环: 内缩一圈 8×6(dx∈[-4,3]×dz∈[-3,2]), 混搭同
          一层口径(角柱 trim/后墙 dz=-3=wallB 抹灰/前侧+侧山墙=wallA) */
      for (let dy = 4; dy <= 6; dy++) {
        for (let dx = -4; dx <= 3; dx++) {
          for (let dz = -3; dz <= 2; dz++) {
            const corner = (dx === -4 || dx === 3) && (dz === -3 || dz === 2);
            const onRing = corner || dx === -4 || dx === 3 || dz === -3 || dz === 2;
            if (!onRing) continue; /* 内域空腔 */
            let id = dz === -3 ? ids.wallB : ids.wallA;
            if (corner) id = ids.trim;
            put(dx, dy, dz, id);
          }
        }
      }
      /* 二层窗组①真挑窗(dx∈[-3,-2], §3 G「二层挑窗」): dy4 trim 托架
          2 格(dz=3, 挑窗底托, 立面外空域)+dy5..6 窗体外挑 dz=3 至一层
          立面线(dy5=18 玻璃/dy6=17 框楣, 后写覆写; 与二层墙 dz=2 错一
          格=凸出体量感); 组②阳台落地窗(dx∈[1,2], dy5..6)保持 dz=2
          (窗面随内缩, 阳台位呼应 §7.4 Front 图「阳台窗」) */
      for (const wx of [-3, -2]) {
        put(wx, 4, 3, ids.trim);
        put(wx, 5, 3, ids.window);
        put(wx, 6, 3, ids.frame);
      }
      for (const wx of [1, 2]) {
        put(wx, 5, 2, ids.window);
        put(wx, 6, 2, ids.frame);
      }
      /* 前立面外挑小阳台(balcony 收放, 「布幔阳台」): 平台 dy4 dx∈[1,2]
          ×dz=3 暖木(悬挑于二层立面外一格, 下方即一层前墙)+帘栏 dy5
          dx∈[1,2]×dz=3 awning 天蓝布幔帘(布幔垂坠读法, 替代旧 trim 矮
          栏)——立面外空域, 不覆写墙体 */
      if (e.balcony) {
        for (let dx = 1; dx <= 2; dx++) put(dx, 4, 3, ids.balcony);
        for (let dx = 1; dx <= 2; dx++) put(dx, 5, 3, ids.awning);
      }
      /* dy=7 低屋面: 全域 10×8——周界一圈 trim 深木檐口线(§3 M「檐口 5」
          描边读法)+内域 roof; dy=8 高屋面: 北半内缩 8×4(dx∈[-4,3]×
          dz∈[-4,-1])全 roof 覆写(错高落差 1 层; 高层带无檐线=错层次),
          dy9 无物(封顶 dy8, 总高 9 不变) */
      for (let dx = -5; dx <= 4; dx++) {
        for (let dz = -4; dz <= 3; dz++) {
          const rim = dx === -5 || dx === 4 || dz === -4 || dz === 3;
          put(dx, 7, dz, rim ? ids.trim : ids.roof);
        }
      }
      for (let dx = -4; dx <= 3; dx++) {
        for (let dz = -4; dz <= -1; dz++) put(dx, 8, dz, ids.roof);
      }
    },
    /* 脚印: 同参纯算术投影——平面 4 角([-5,4]×[-4,3] 过同一张朝向表, 90°
        旋转盒恒轴对齐; mirror 含 -dx 翻转, 偶宽体盒平移一格同被 4 角
        min/max 包络), y 域取写笔最低/最高层(dy0 基座..dy8 错顶最高点;
        挑窗/阳台 dz=3 在平面域内) */
    foot(e, x, y, z, orient) {
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of [-5, 4]) {
        for (const dz of [-4, 3]) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 8, z2};
    },
  },
  'stall-canopy': {
    /* 市集摊位 v2: 木架+双层阶梯顶布幔+台面柜身+后沿主题货品+角旗的开放
        摊位(town-prefab-specs §4.7 契约几何升级同 cottage 先例; 视觉对照
        buildings-visual-spec §6.1/§5.3 P2-02——低高度不遮挡钟塔视线)。
        锚=摊位地面中心投影, 局部轴 dx 横/dz 前后/dy 竖, face0=south=
        摊面(顾客侧)朝 +dz; 占地奇偶偏置同 pfSpan 口径: sm 3×2(dx∈[-1,1]
        奇宽居中×dz∈[-1,0] 偶深 NW 偏置)总高 4 · md 4×3(dx∈[-2,1] 偶宽
        NW 偏置×dz∈[-1,1] 奇深居中)总高 5。层序(序即几何): dy0 全幅台面
        柜身→dy1 四角柱+后沿(dz=-1)中段主题货品色块(sm 单格 (0,-1)/md
        两格 (-1..0,-1) NW 偏置偶簇, 均不在四角柱位覆写无冲突)→[仅 md]
        dy2 后沿中景叶饰(花叶/面包堆顶; sm dy2 即 tier1 顶无空间)→双层
        阶梯顶: tier1 全 footprint(sm dy2/md dy3)主色布幔+tier2 前条
        dz=dzHi(sm dy3/md dy4)副色滚边+前角格 flag 角旗(零额外增高)。
        theme 六档几何同形仅材质差异: canopy/canopyTrim 缺省按 theme 注入
        (见 pfMerge/PF_STALL_CANOPY/PF_STALL_TRIM), 货物/叶饰按 theme 选
        槽; 无光/火语义槽位(ids 白名单无 torch/glow, §8 去威胁红线) */
    facing0: 'south',
    defaults: {
      face: 'south', /* 缺省=行 facing0(恒等映射) */
      mirror: false,
      size: 'sm', /* 枚举轴(区别于 stilt-hut 对象轴): sm=3×2×4/md=4×3×5 */
      theme: 'generic', /* 市集主题六档: canopy/canopyTrim 注入与货物选槽源 */
      /* 材质注入, 缺省裸数字(§4.7 口径→现调色板 v2; Step D 扩键):
          frame 木头暖木四角柱(tower pillar/cottage trim 先例) · canopy
          羊毛顶棚主幔(generic 档显式缺省, 实际按 theme 于 pfMerge 注入
          覆缺) · canopyTrim 顶层滚边副色(Step D 新槽, PF_STALL_TRIM 按
          theme 注入, 奶油×樱粉对偶) · counter 木板暖木-中台面柜身(stilt
          地板/店身墙先例) · goodsBread 石英堆面包货(bread/generic 案;
          shop plaster 先例, 弃 38 金矿旧材质) · goodsFlower 粉羊毛花束
          (78 樱粉) · goodsFruit 南瓜亮橙果篮(76) · goodsLeaf1/2 花叶饰
          (61/62 树叶薄块先例, 仅 md 中景) · flag 角旗(78 樱粉, tier2
          前角一格) */
      ids: {frame: 5, canopy: 52, canopyTrim: 78, counter: 6,
        goodsBread: 17, goodsFlower: 78, goodsFruit: 76,
        goodsLeaf1: 61, goodsLeaf2: 62, flag: 78},
    },
    kernel(e, x, y, z, orient, put) {/* x/y/z/orient 未用: 纯局部系直写,
        朝向与镜像统一走 place 传入的 put 通道不自管朝向(pfOrient -dx
        先翻后旋盒平移口径: sm 奇宽 dx 对称形 mirror 同盒同形/md 偶宽
        [-2,1]→[-1,2] 盒东移一格, shop-awning/house-loft 先例) */
      const ids = e.ids;
      const md = e.size === 'md';
      const dxLo = md ? -2 : -1; /* dxHi 恒 1(两档东界同) */
      const dzHi = md ? 1 : 0; /* dzLo 恒 -1(后沿/摊面基准同) */
      /* dy0 台面柜身: 恰全 footprint 实心 counter, 域外无物 */
      for (let dx = dxLo; dx <= 1; dx++) {
        for (let dz = -1; dz <= dzHi; dz++) put(dx, 0, dz, ids.counter);
      }
      /* 柱腿 dy1..legTop: 恰四角 frame/层(高款腿更长, 两档高差落棚架腿) */
      const legTop = md ? 2 : 1;
      for (let dy = 1; dy <= legTop; dy++) {
        for (const [px, pz] of [[dxLo, -1], [1, -1], [dxLo, dzHi], [1, dzHi]]) {
          put(px, dy, pz, ids.frame);
        }
      }
      /* dy1 后沿(dz=-1)中段货品色块: sm 单格 (0,-1)/md 两格 (-1..0,-1)
          ——v2 货物主题化(§3 G): bread/generic→goodsBread 石英堆/flower→
          goodsFlower 粉羊毛/fruit→goodsFruit 南瓜亮橙/fish→goodsBread
          石英堆(银白冰台读法)/pumpkin→goodsFruit 同橙(Step E 配平;
          显式注入按槽覆写) */
      const GOODS_OF = {bread: 'goodsBread', flower: 'goodsFlower',
        fruit: 'goodsFruit', fish: 'goodsBread', pumpkin: 'goodsFruit',
        generic: 'goodsBread'};
      const goodsLo = md ? -1 : 0;
      for (let dx = goodsLo; dx <= 0; dx++) {
        put(dx, 1, -1, ids[GOODS_OF[e.theme]]);
      }
      /* md 中景叶饰(dy2 后沿, tier1 之下货堆加高): 仅 md(sm dy2 即 tier1
          顶无空间)——flower 双叶 goodsLeaf1/2@(-1..0,2,-1)/fruit 单叶
          goodsLeaf1@(0,2,-1)/其余档(bread/fish/pumpkin/generic)案面货
          加高堆顶@(-1,2,-1)(与 dy1 货同槽两格高=堆叠读法; Step E 起
          else 槽跟案面货走——bread/fish/generic 仍 goodsBread, pumpkin
          goodsFruit 南瓜堆两格高, 既有四档行为逐字节不变) */
      if (md) {
        if (e.theme === 'flower') {
          put(-1, 2, -1, ids.goodsLeaf1);
          put(0, 2, -1, ids.goodsLeaf2);
        } else if (e.theme === 'fruit') {
          put(0, 2, -1, ids.goodsLeaf1);
        } else {
          put(-1, 2, -1, ids[GOODS_OF[e.theme]]);
        }
      }
      /* 双层阶梯顶(§3 G v2): tier1 全 footprint(sm dy2/md dy3)=canopy
          主色(缺省按 theme 注入); tier2 前条 dz=dzHi(sm dy3/md dy4)=
          canopyTrim 副色(缺省按 theme 注入, 奶油×樱粉对偶), 前角格
          (1,dzHi)=flag 角旗——零额外增高, 低高度不遮挡钟塔视线; 封顶
          之上一层无物 */
      const tier1 = md ? 3 : 2;
      for (let dx = dxLo; dx <= 1; dx++) {
        for (let dz = -1; dz <= dzHi; dz++) put(dx, tier1, dz, ids.canopy);
      }
      for (let dx = dxLo; dx <= 1; dx++) {
        put(dx, tier1 + 1, dzHi, ids.canopyTrim);
      }
      put(1, tier1 + 1, dzHi, ids.flag);
    },
    /* 脚印: 同参纯算术投影——随 size 变体外包围盒, 平面 4 角过同一张
        朝向表(90° 旋转盒恒轴对齐; mirror 含 -dx 翻转被 min/max 包络),
        y 域取写笔最低/最高层(dy0 台面..tier2 滚边) */
    foot(e, x, y, z, orient) {
      const md = e.size === 'md';
      const xs = md ? [-2, 1] : [-1, 1];
      const zs = md ? [-1, 1] : [-1, 0];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + (md ? 4 : 3), z2};
    },
  },

  /* ---------- TIDEA 波次一·静态小件五行(全陈设零行为, 落位归 scene) ---------- */

  /* 稻草人(scarecrow, TIDEA-04/W-04): 田里叙事物——dy0 原木桩 5(腿)+
      dy1 蓝羊毛衣 15 贴身(桩上段覆读)+木板横臂 6 两格(±dx 同层=肩)+
      dy2 南瓜头 76。全现成字库, 零字库扩展; footprint 3×1×3(臂展计入)。
      落位(农田角)归 scene 后续波次 */
  'scarecrow': {
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      ids: {post: 5, arm: 6, shirt: 15, head: 76},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids;
      put(0, 0, 0, ids.post); /* 桩(腿) */
      put(0, 1, 0, ids.shirt); /* 衣贴桩上段(蓝羊毛) */
      put(-1, 1, 0, ids.arm); /* 横臂左 */
      put(1, 1, 0, ids.arm); /* 横臂右 */
      put(0, 2, 0, ids.head); /* 南瓜头 */
    },
    foot(e, x, y, z, orient) {
      const xs = [-1, 1]; const zs = [0];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 2, z2};
    },
  },

  /* 晾衣绳(clothesline, TIDEA-08/W-08 ①): 两桩一线三衣——桩 5 各 3 高
      (±2), 绳 5 连桩顶(dy2 中段三格), 衣三色块 15 蓝/78 粉/17 奶白挂绳下
      (dy1 悬空一格, 脚下无支撑=静态晾晒读法)。footprint 5×1×3 */
  'clothesline': {
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      ids: {pole: 5, line: 5, shirtBlue: 15, shirtPink: 78, shirtQuartz: 17},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids;
      for (const px of [-2, 2]) {
        for (let dy = 0; dy <= 2; dy++) put(px, dy, 0, ids.pole);
      }
      for (let dx = -1; dx <= 1; dx++) put(dx, 2, 0, ids.line); /* 绳连桩顶 */
      put(-1, 1, 0, ids.shirtBlue); /* 衣挂绳下 dy1 悬空 */
      put(0, 1, 0, ids.shirtPink);
      put(1, 1, 0, ids.shirtQuartz);
    },
    foot(e, x, y, z, orient) {
      const xs = [-2, 2]; const zs = [0];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 2, z2};
    },
  },

  /* 柴堆(woodpile, TIDEA-08/W-08 ③): 墙根五根短桩错叠——底三根 5(dy0
      ±1)+上两根 5 错位(dy1 −1..0)。footprint 3×1×2 */
  'woodpile': {
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      ids: {log: 5},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids;
      for (let dx = -1; dx <= 1; dx++) put(dx, 0, 0, ids.log); /* 底三根 */
      put(-1, 1, 0, ids.log); /* 上两根错叠 */
      put(0, 1, 0, ids.log);
    },
    foot(e, x, y, z, orient) {
      const xs = [-1, 1]; const zs = [0];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 1, z2};
    },
  },

  /* 小鸡窝(hencoop, TIDEA-08/W-08 ④): 干草色砂岩台 58 2×2(dy0)+两只静态
      块状鸡剪影(白身 52 呼应招牌鸡+红冠 16)立于台前沿(dy1..2)。零 spawn
      零 town-npc* 触——将来「帮阿面数小鸡」寻找类锚点(map-design §6.2)
      的现成视觉底, 玩法接线不在本件。footprint 2×2×3 */
  'hencoop': {
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      ids: {hay: 58, henBody: 52, henComb: 16},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids;
      for (let dx = 0; dx <= 1; dx++) {
        for (let dz = 0; dz <= 1; dz++) put(dx, 0, dz, ids.hay); /* 干草台 */
      }
      /* 两只并排(前沿) */
      for (const hx of [0, 1]) {
        put(hx, 1, 0, ids.henBody); /* 白身 */
        put(hx, 2, 0, ids.henComb); /* 红冠 */
      }
    },
    foot(e, x, y, z, orient) {
      const xs = [0, 1]; const zs = [0, 1];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 2, z2};
    },
  },

  /* 高跳板与小水池(board-pool, TIDEA-10/W-10, prefab-specs §4.8 契约
      P2-01 图纸变真, PO 批「动骨架-轻」): 板沿 +dx 排 boardLen 格(6..8 钳)
      逐格升 dy(round(i*4/(len-1)) 斜率, 顶恒 dy4=高 5∈契约「高 4-5」),
      板顶小旗(柱 5+旗 78 两格); 池贴板尾外(dx len..len+ps+1)——沿
      poolEdge 17 浅石一圈(poolSize 2..3 钳+2 宽)+水心静态色块 15 蓝羊毛
      (缺省安全: 流体身份块禁作缺省——fluid 旗标写入触流体机制, T-09
      纪律; 非流体零机制, v.ids.water 可注覆)。比例幽默纯观赏, 不接玩法。footprint
      (len+ps+2)×(ps+2)×7(旗顶) */
  'board-pool': {
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      boardLen: 6,
      poolSize: 2,
      ids: {board: 5, poolEdge: 17, water: 15, flagPole: 5, flag: 78},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids;
      const len = e.boardLen; const ps = e.poolSize;
      let topDy = 0;
      for (let i = 0; i < len; i++) {
        const dy = Math.round(i * 4 / (len - 1)); /* 斜率恒顶 dy4 */
        put(i, dy, 0, ids.board);
        topDy = Math.max(topDy, dy);
      }
      put(len - 1, topDy + 1, 0, ids.flagPole); /* 板顶小旗 */
      put(len - 1, topDy + 2, 0, ids.flag);
      /* 池贴板尾外: 沿环+水心 */
      for (let dx = 0; dx < ps + 2; dx++) {
        for (let dz = -1; dz <= ps; dz++) {
          const edge = dx === 0 || dx === ps + 1 || dz === -1 || dz === ps;
          put(len + dx, 0, dz, edge ? ids.poolEdge : ids.water);
        }
      }
    },
    foot(e, x, y, z, orient) {
      const len = e.boardLen; const ps = e.poolSize;
      const xs = [0, len + ps + 1]; const zs = [-1, ps];
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 6, z2}; /* 旗顶 dy6 */
    },
  },

  /* 铁傀儡全身立像(iron-golem, PO 亲需③+PO 实屏拍板「头像→全身像」
     升级, 头版未落位即转全身=零死行): 村民感恩守卫的方块雕塑全身像,
     南面朝镇(facing0 south)。识别基因全继承: 颅 7 宽(dy12..17 石英 17
     实心)+凸鼻(dx0 dy12..15 凸出 dz+1 悬挑——头版前凸先例)+眼窝
     (±2, dy15, 面侧 dz0 铁灰 12 沉稳守卫非红眼, §8 去威胁)+苔岁月
     点缀非破损(颅苔 6 格平移+身苔 6 格=12 格)。身体傀儡剪影语汇
     (z 收胸 v3, scene 325e1d7 包络+map-core 分区硬界: 基座承压 ≤3 理想——基座 9×3 贴
     裙板 z29..31; §4.1 远景层 z≤31 硬界——鼻从 scene 所点 z33 收进
     z31, 颅 5 深 z28..32 收 3 深 z28..30 背倚山缘, 正面剪影不变):
     基座 9×3×1 石头 3
     (dy0 插桩面, 山脚裙板落位嵌面下埋)→粗短腿 2×2×5 ×2 分立(dy1..5)→
     肩梁 9×3×3(dy6..8, 宽 9>颅 7=宽肩读感)→腰缝铁灰 12 一圈(dy9,
     腰带读感)→收腰 5×3(dy10..11, 躯干渐收)+垂臂 2×2 续垂 dy9..11
     (梢 dy11 长过髋 dy5——傀儡标志剪影)→颅 7×3×6(dy12..17, dx±3 格
     坐臂顶)。全身无悬空(鼻/面前凸悬挑同头版先例)。footprint 9×4
     (基座 x±4; 背 dz-2 到鼻凸 dz+1)高 18——scene 锚 (70,25,30) 嵌面
     落位顶 y42 ≤47(约 6 倍玩家身高=宏大喊)。材质全现有字库: 躯干四肢 17
     统一白(远读剪影不被杂色打碎)+12 眼/腰带+14 苔+3 石座, 零新键。
     v 键 face|mirror|ids 同构(ids +body/belt 两槽) */
  'iron-golem': {
    facing0: 'south',
    defaults: {
      face: 'south',
      mirror: false,
      ids: {skull: 17, nose: 17, eye: 12, moss: 14, plinth: 3,
        body: 17, belt: 12},
    },
    kernel(e, x, y, z, orient, put) {
      const ids = e.ids;
      const box = (x1, x2, dy1, dy2, z1, z2, id) => {
        for (let dy = dy1; dy <= dy2; dy++) {
          for (let dx = x1; dx <= x2; dx++) {
            for (let dz = z1; dz <= z2; dz++) put(dx, dy, dz, id);
          }
        }
      };
      /* 基座 dy0: 9×3 石座(dz-1..1 贴裙板三线, 承压理想口径) */
      box(-4, 4, 0, 0, -1, 1, ids.plinth);
      /* 粗短腿 ×2: 2×2×5 分立(dy1..5, 腿间通透) */
      box(-3, -2, 1, 5, -1, 0, ids.body);
      box(2, 3, 1, 5, -1, 0, ids.body);
      /* 肩梁 dy6..8: 9×3×3(宽肩, 覆双腿顶) */
      box(-4, 4, 6, 8, -1, 1, ids.body);
      /* 垂臂续垂 dy9..11: 肩两端 2×2 ×2(梢 dy11 长过髋 dy5) */
      box(-4, -3, 9, 11, -1, 0, ids.body);
      box(3, 4, 9, 11, -1, 0, ids.body);
      /* 腰缝铁灰一圈 dy9 + 收腰 dy10..11: 5×3(躯干渐收) */
      box(-2, 2, 9, 9, -1, 1, ids.belt);
      box(-2, 2, 10, 11, -1, 1, ids.body);
      /* 颅 dy12..17: 7×3×6 实心(dx±3 格坐臂顶; 背 dz-2 倚 z28 山缘) */
      box(-3, 3, 12, 17, -2, 0, ids.skull);
      /* 凸鼻: dx0 dy12..15 凸出 dz+1(悬挑 1 格=z31, 头版前凸先例) */
      box(0, 0, 12, 15, 1, 1, ids.nose);
      /* 眼窝: (±2, dy15) 面侧 dz0 覆颅前面格 */
      put(-2, 15, 0, ids.eye);
      put(2, 15, 0, ids.eye);
      /* 颅苔 6 格岁月死位: 顶后角(±3,17,-2)/颊(±3,14,0)/顶心(±1,17,-1) */
      put(-3, 17, -2, ids.moss);
      put(3, 17, -2, ids.moss);
      put(-3, 14, 0, ids.moss);
      put(3, 14, 0, ids.moss);
      put(-1, 17, -1, ids.moss);
      put(1, 17, -1, ids.moss);
      /* 身苔 6 格: 肩顶(±2,8,-1)/腿(−3,3,0)/(2,4,0)/腰侧(±2,10,1) */
      put(-2, 8, -1, ids.moss);
      put(2, 8, -1, ids.moss);
      put(-3, 3, 0, ids.moss);
      put(2, 4, 0, ids.moss);
      put(-2, 10, 1, ids.moss);
      put(2, 10, 1, ids.moss);
    },
    foot(e, x, y, z, orient) {
      const xs = [-4, 4]; const zs = [-2, 1]; /* 背 dz-2 到鼻凸 dz+1 */
      let x1 = Infinity; let x2 = -Infinity; let z1 = Infinity; let z2 = -Infinity;
      for (const dx of xs) {
        for (const dz of zs) {
          const o = orient(dx, dz);
          x1 = Math.min(x1, x + o[0]); x2 = Math.max(x2, x + o[0]);
          z1 = Math.min(z1, z + o[1]); z2 = Math.max(z2, z + o[1]);
        }
      }
      return {x1, y1: y, z1, x2, y2: y + 17, z2}; /* 颅顶 dy17 */
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

/* 门面: 三入口 place/footOf/spinnerOf(footOf/spinnerOf 纯查询零写;
   spinnerOf=TIDEA-01 波次二增, 「恰好两个入口」拍板自此三门, 偏差登记
   arch 回执 §10) */
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
  /* spinnerOf 第三门(TIDEA-01, ADR-0011 增补①): 纯查询零写——两遍差分收
     叶片组件: 钳 sailStatic=false 跑 kernel 收塔体格集 A, 钳 true 收全量
     B, cells=B−A(§4.4 分件缝的查询面投影, kernel 几何单源不破)。返回
     {center, axis, cells} 世界系(orient 在本门内做完, 消费方 dims 零
     orient 负担); period 不归本门(pfMerge 白名单外——op 层数据钩经 dims
     进 SpinnerCore)。旋转方向=rotation[axis] 正向(+向, ADR 未定口径取
     + 向, 登记见 arch 回执)。非 spin 行/未知 id 抛拼写域错。 */
  spinnerOf(id, x, y, z, v) {
    const row = pfRow(id);
    if (!row.spin) {
      throw new Error('PrefabKit.spinnerOf: 蓝图「' + id + '」无 spin 声明' +
        '(旋转组件中心只对带 spin 声明的行有效)');
    }
    const mk = (flag) => pfMerge(row, id, Object.assign({}, v, {sailStatic: flag}));
    const eB = mk(true);
    const orient = pfOrient(row, eB.face, eB.mirror);
    const body = new Map(); /* A 面: 塔体格键→id(Map.set 同键覆写=终态) */
    row.kernel(mk(false), x, y, z, orient, (dx, dy, dz, bid) => {
      body.set(dx + ',' + dy + ',' + dz, bid);
    });
    const full = new Map(); /* B 面: 同取终态(后写者赢)——kernel 对同格多笔
       写(如墙环→门洞掏空), 逐笔对比会把 B 中间态误收, 须先折叠再差分 */
    row.kernel(eB, x, y, z, orient, (dx, dy, dz, bid) => {
      full.set(dx + ',' + dy + ',' + dz, bid);
    });
    const cells = [];
    for (const [k, bid] of full) {
      /* 值敏感差分: 同格同值=纯塔体格剔除; 覆写格(叶片覆塔体, 如轴根
         (0,8,1) 覆檐层)同键异值, 随组件走——语义=B 终态相对 A 终态的可见变化 */
      if (body.get(k) === bid) continue;
      const p = k.split(',');
      const dx = +p[0]; const dy = +p[1]; const dz = +p[2];
      const o = orient(dx, dz);
      cells.push({x: x + o[0], y: y + dy, z: z + o[1], id: bid});
    }
    const oc = orient(row.spin.center.dx, row.spin.center.dz);
    const oa = orient(0, 1); /* 局部 +dz(轮面法向)的世界向量 → 旋转轴 */
    return {
      center: {x: x + oc[0], y: y + row.spin.center.dy, z: z + oc[1]},
      axis: oa[0] !== 0 ? 'x' : 'z',
      cells,
    };
  },
};
