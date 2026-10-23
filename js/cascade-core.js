'use strict';
/* ============================================================
   方块级联核心 (CascadeCore, 术语见 GLOSSARY.md「方块级联」) — 引擎层纯核心
   ------------------------------------------------------------
   编辑后世界自洽的级联结算(docs/block-lifecycle-design.md): 破坏一个
   方块后, 依身份旗标连锁结算失撑方块——
   · thin 脱落  依附块随底座脱落(火把/树苗/草丛/麦, 柱状链式上行)
   · fell 接地  结构组件失去接地 → 整组件倒(接地判定而非位置启发式:
                砍树底=整树倒/砍中段=树桩连带整树倒(P15)/双柱桥断一
                柱仍立/挖脚=结构倒)
   · need 存活  伴生块重查依赖(树叶 taxicab 4 内无原木即落)
   · fall 重力  重力段失撑整体下沉(二期 D7: 移动语义——落沙砸碎沿途
                thin/穿水, 段顶空位入队连锁①②)
   · fell 树桩连带  被移除的原木正下方同柱残段一并倒(P15: 砍任何一
                节=整树倒, 树桩不再撑起残余树冠的浮空叶观感)
   身份原则(设计稿 P2): 各规则只读旗标, 不含任何位置/模式/场景条件——
   石头没有旗标在哪挖都不塌; 是树就倒(生成的/种的/孩子搭的一视同仁)。
   触发面: 破坏(id→0)全旗标; 放置仅 fall 旗标(P9 半空即落, 原木/树叶/
   thin 放置永不触发——建造装饰保护)。定点迭代, 被移除/空出的格才入队
   (空格天然免疫, 树桩连带/清扫可与组件移除重复入队同格——各规则幂等),
   总量有界必终止。
   interface: cascadeRemove(read, write, x, y, z, oldId, policy) → 清单
     · cascadePlace(read, write, x, y, z, id, policy) → 清单(放置触发)
     · cascadeSweep(read, write, policy, w, h, d) → 清单(世界卫生清扫,
       P14/D9: 全图违例治愈, 装场期迁移 seam)
     · mkPolicy(BLOCKS) → policy(身份旗标 → 判定函数, world.js 与单测
       共用同一装配, 防两份派生漂移)
   清单条目: {x,y,z,id}=移除(消费方掉落/任务照常); {x,y,z,id,to:{x,y,z}}
   =移动(方块存活——不掉落不进任务, 记账必须两格: 原格 0 + 落格 id)。
   依赖(零全局, 全部经参数注入): read(x,y,z)→id(界外=0) · write(x,y,z,id) ·
     BLOCKS(config 方块注册表, 仅 mkPolicy 消费) · w/h/d(清扫的全图尺寸)
   可测性: 零 THREE·零 DOM·有单测(test/cascade-core.test.js)
   ============================================================ */
const CascadeCore = (() => {
  const NEIGH6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  /* 身份旗标 → 判定函数(config BLOCKS 派生, 装配一次; 调用期热路径只查闭包)。
     isSupport: 非空气且 solid(旗标缺省=实心)——thin 族/水面 solid:false 不承重,
     树叶无 solid 旗标=实心可承重(MC 口径); fall 段自身是实心(沙上可叠沙) */
  function mkPolicy(BLOCKS) {
    return {
      isFell: (id) => !!(BLOCKS[id] && BLOCKS[id].fell),
      isThin: (id) => !!(BLOCKS[id] && BLOCKS[id].thin != null),
      isFall: (id) => !!(BLOCKS[id] && BLOCKS[id].fall),
      isSupport: (id) => !!(BLOCKS[id] && BLOCKS[id].solid !== false),
      needOf: (id) => (BLOCKS[id] && BLOCKS[id].need) || null,
      needRules: Object.keys(BLOCKS).filter((bid) => BLOCKS[bid] && BLOCKS[bid].need)
          .map((bid) => Object.assign({block: +bid}, BLOCKS[bid].need)),
    };
  }

  /* 依赖某方块的全部 need 规则里的最大距离(决定重查盒半径; 0=无规则) */
  function depMaxDist(policy, depId) {
    let m = 0;
    for (const r of policy.needRules) {
      if (r.id === depId && r.dist > m) m = r.dist;
    }
    return m;
  }

  /* fell 组件: 从起点 6-连通 BFS 穿结构成员(只读当前网格; seen 收全组件成员
     供同一触发格的邻里去重——跨格不缓存: 同组件可能先后失去两处支撑,
     每次支撑丢失都重查, 正确性优先) */
  function fellComponent(read, sx, sy, sz, policy, seen) {
    const comp = [];
    const stack = [[sx, sy, sz]];
    seen.add(sx + ',' + sy + ',' + sz);
    while (stack.length) {
      const m = stack.pop();
      comp.push(m);
      for (const d of NEIGH6) {
        const nx = m[0] + d[0]; const ny = m[1] + d[1]; const nz = m[2] + d[2];
        const k = nx + ',' + ny + ',' + nz;
        if (seen.has(k)) continue;
        const id = read(nx, ny, nz);
        if (id !== 0 && policy.isFell(id)) {
          seen.add(k);
          stack.push([nx, ny, nz]);
        }
      }
    }
    return comp;
  }

  /* 组件接地 ⇔ 有成员在世界底(y=0 兜底, 防挖穿世界底雪崩)或脚下是外部
     实心支撑(非空气·solid·非结构成员——组件内部互撑不算接地, 唯有
     外部支撑承重: 叠在树顶上的另一棵树随树倒, 落地的树桩自己站着) */
  function compGrounded(read, comp, policy) {
    for (const m of comp) {
      if (m[1] === 0) return true;
      const below = read(m[0], m[1] - 1, m[2]);
      if (below !== 0 && !policy.isFell(below) && policy.isSupport(below)) return true;
    }
    return false;
  }

  /* 依赖存在性: taxicab dist 内是否存在依赖方块(伴生块存活判据) */
  function hasDepWithin(read, x, y, z, need) {
    for (let dx = -need.dist; dx <= need.dist; dx++) {
      for (let dy = -need.dist; dy <= need.dist; dy++) {
        for (let dz = -need.dist; dz <= need.dist; dz++) {
          if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > need.dist) continue;
          if (read(x + dx, y + dy, z + dz) === need.id) return true;
        }
      }
    }
    return false;
  }

  /* fall 段下沉(规则④核心, 破坏/放置两触发共用): 自 runBottom 向上收连续
     fall 段 → 落点自段底向下扫(穿空气/水等非支撑, 途遇 thin 先弹出=P10
     落沙砸碎, 世界底或实心支撑止) → 整段下移 Δ(自底向上搬免覆盖) →
     moved 逐块记 {…, to} → 段顶空位逐格入队(上方依附块弹出/原木结构
     失接地连锁倒/更上隔空段不追认——与浮空原木同口径只在扰动时结算) */
  function settleFallRun(read, write, take, enqueue, x, runBottom, z, policy, moved) {
    let runLen = 0;
    while (policy.isFall(read(x, runBottom + runLen, z))) runLen++;
    if (runLen === 0) return false;
    let ny = runBottom; /* 落底候选: 检查其下方是否可穿 */
    while (ny > 0) {
      const below = read(x, ny - 1, z);
      if (below === 0 || !policy.isSupport(below)) {
        if (below !== 0 && policy.isThin(below)) take(x, ny - 1, z); /* P10: 依附块被落沙砸碎 */
        ny--;
        continue;
      }
      break;
    }
    const delta = runBottom - ny;
    if (delta <= 0) return false;
    const runTop = runBottom + runLen - 1;
    for (let i = 0; i < runLen; i++) {/* 自底向上搬, 免覆盖未搬的上段 */
      const id = read(x, runBottom + i, z);
      write(x, runBottom + i, z, 0);
      write(x, ny + i, z, id);
      moved.push({x, y: runBottom + i, z, id, to: {x, y: ny + i, z}});
    }
    for (let y = runTop - delta + 1; y <= runTop; y++) enqueue(x, y, z, 0);
    return true;
  }

  /* 定点迭代循环(破坏/放置/清扫三种子共用): take=级联移除一格, enqueue=登记
     新空格; 规则①thin→②fell→④fall 查正上方(互斥旗标, else-if 链),
     规则⑤树桩连带查正下方同柱(只认被移除的是 fell), 规则③need 与邻格
     无关独立查(只认被移除的是依赖方块) */
  function mkLoop(read, write, policy, removed) {
    const queue = [];
    const take = (cx, cy, cz) => {/* 级联移除一格: 落地 + 记账 + 入队 */
      const id = read(cx, cy, cz);
      if (id === 0) return; /* 空格天然免疫: 已移除的格重复 take 无副作用 */
      write(cx, cy, cz, 0);
      removed.push({x: cx, y: cy, z: cz, id});
      queue.push({x: cx, y: cy, z: cz, oldId: id});
    };
    const enqueue = (qx, qy, qz, qoid) => queue.push({x: qx, y: qy, z: qz, oldId: qoid});
    const run = () => {
      while (queue.length) {
        const c = queue.shift();
        const up = read(c.x, c.y + 1, c.z);
        if (up !== 0 && policy.isThin(up)) {
          take(c.x, c.y + 1, c.z); /* ① 依附块随底座脱落(链式上行由队列完成) */
        } else if (up !== 0 && policy.isFell(up)) {
          /* ② 六邻里的结构组件逐一重查(删格只可能影响贴着它的组件)。
             同组件占多个邻里位 → 本格去重; 组件仍接地则不动 */
          const seen = new Set();
          for (const d of NEIGH6) {
            const nx = c.x + d[0]; const ny = c.y + d[1]; const nz = c.z + d[2];
            const nid = read(nx, ny, nz);
            if (nid === 0 || !policy.isFell(nid) || seen.has(nx + ',' + ny + ',' + nz)) continue;
            const comp = fellComponent(read, nx, ny, nz, policy, seen);
            if (!compGrounded(read, comp, policy)) {
              for (const m of comp) take(m[0], m[1], m[2]);
            }
          }
        } else if (up !== 0 && policy.isFall(up)) {
          /* ④ 重力段整体下沉(移动语义); 段顶空位入队 → 连锁①②④ */
          settleFallRun(read, write, take, enqueue, c.x, c.y + 1, c.z, policy, removed);
        }
        /* ⑤ 树桩连带(P15): 被移除的是 fell 且正下方仍是同柱 fell(残余树桩) →
           下方连续段整段移除——砍任何一节=整树倒(P1 口径), 树桩不再撑起残余
           树冠(中段砍伐的浮空叶, 2026-10-24 拍板)。与接地无关: 树桩本就接地,
           连带的是「同柱结构被斩断」事件本身; 桥面等横向结构脚下非同柱 fell,
           不受牵连(砍桥面中格两半各自经柱接地, 桥不倒) */
        if (policy.isFell(c.oldId)) {
          let sy = c.y - 1;
          while (policy.isFell(read(c.x, sy, c.z))) {
            take(c.x, sy, c.z);
            sy--;
          }
        }
        /* ③ 伴生存活: 被移除的是依赖方块(原木)才重查——伴生块存活只取决于
           依赖方块的分布, 移除树叶/泥土等不改变任何树叶的判定(手掰单叶
           不误伤纯装饰叶团); 只重查「曾可能被本格支撑」的伴生块
           (taxicab ≤ 其自身 need.dist, 更远的从未被本格支撑) */
        const rMax = depMaxDist(policy, c.oldId);
        for (let dx = -rMax; dx <= rMax; dx++) {
          for (let dy = -rMax; dy <= rMax; dy++) {
            for (let dz = -rMax; dz <= rMax; dz++) {
              const manh = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
              if (manh > rMax) continue;
              const lx = c.x + dx; const ly = c.y + dy; const lz = c.z + dz;
              const need = policy.needOf(read(lx, ly, lz));
              if (!need || need.id !== c.oldId || manh > need.dist) continue;
              if (!hasDepWithin(read, lx, ly, lz, need)) take(lx, ly, lz);
            }
          }
        }
      }
    };
    return {take, enqueue, run};
  }

  /* 级联结算(破坏触发): 调用方已把触发格清成空气, 从它出发定点迭代 */
  function cascadeRemove(read, write, x, y, z, oldId, policy) {
    const removed = [];
    const lp = mkLoop(read, write, policy, removed);
    lp.enqueue(x, y, z, oldId);
    lp.run();
    return removed;
  }

  /* 级联结算(放置触发, P9 仅 fall 旗标): 放下的方块脚下非支撑 → 即时下沉;
     返回移动清单(可空)。原木/树叶/thin 放置不经此入口(装饰保护) */
  function cascadePlace(read, write, x, y, z, id, policy) {
    const removed = [];
    if (!policy.isFall(id)) return removed;
    const lp = mkLoop(read, write, policy, removed);
    settleFallRun(read, write, lp.take, lp.enqueue, x, y, z, policy, removed); /* 放置格自身即段底 */
    lp.run();
    return removed;
  }

  /* 世界卫生清扫(P14, 设计稿 D9): 全图扫四类不变量违例并治愈——级联只由
     编辑触发, 级联合并前存档里的既有浮空(孤儿冠/悬浮树/浮沙/悬空依附块)
     永无触发时机, 这里在装场期一次性补结算:
     · need 违例(叶 4 格内无原木) → 直接移除(依赖早已不在, 破坏触发面无机会)
     · fell 违例(组件无接地) → 整组件移除(成员入队后规则③照常重查伴生块
       ——邻树互保的叶按 P4 口径存活)
     · fall/thin 违例(脚下非支撑) → 以脚下合成空格入队, 交规则④/①按既有
       语义下沉/脱落(砸碎沿途 thin/穿水等连锁照常)
     不动点迭代: 一轮治愈可能揭出新违例(如沙沉后骑沙结构失撑——多由队列
     链当场结算, 扫描仅兜底斜邻等漏网), 扫到无违例止。终止性: 每轮净移除
     或净下移至少一格(take 减块数, settle 降重心不增块), 总量有界; 干净
     世界首轮即空 → 返回 []。违例判据与 test/world-integrity.test.js 的
     全图扫描同构(身份旗标, 无位置条件)。 */
  function cascadeSweep(read, write, policy, w, h, d) {
    const removed = [];
    const lp = mkLoop(read, write, policy, removed);
    /* 旗标查表前置(装场期一次): 扫描热路径 ~80 万格逐格查 id → 数组直查,
       免 needOf/isSupport 等函数调用; id 域=Uint8Array 0..255 */
    const needRule = [];
    const thinId = [];
    const fallId = [];
    const fellId = [];
    const supportId = [];
    for (let id = 0; id < 256; id++) {
      needRule[id] = policy.needOf(id);
      thinId[id] = policy.isThin(id);
      fallId[id] = policy.isFall(id);
      fellId[id] = policy.isFell(id);
      supportId[id] = policy.isSupport(id);
    }
    for (;;) {
      const needSeeds = [];
      const fellSeeds = [];
      const fallSeeds = [];
      const thinSeeds = [];
      const fellSeen = new Set();
      /* 列主序扫描(x,z 外层, y 内层): below=上一格 id 直复用, 免二次 read */
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          let below = 0;
          for (let y = 0; y < h; y++) {
            const id = read(x, y, z);
            if (id !== 0) {
              if (needRule[id] && !hasDepWithin(read, x, y, z, needRule[id])) needSeeds.push([x, y, z]);
              if (y > 0 && (below === 0 || !supportId[below])) {
                if (thinId[id]) thinSeeds.push([x, y - 1, z]);
                if (fallId[id]) fallSeeds.push([x, y - 1, z]);
              }
              if (fellId[id] && !fellSeen.has(x + ',' + y + ',' + z)) {
                const comp = fellComponent(read, x, y, z, policy, fellSeen);
                if (!compGrounded(read, comp, policy)) {
                  for (const m of comp) fellSeeds.push(m);
                }
              }
            }
            below = id;
          }
        }
      }
      if (!needSeeds.length && !fellSeeds.length && !fallSeeds.length && !thinSeeds.length) break;
      for (const s of needSeeds) lp.take(s[0], s[1], s[2]);
      for (const s of fellSeeds) lp.take(s[0], s[1], s[2]);
      for (const s of thinSeeds) lp.enqueue(s[0], s[1], s[2], 0);
      for (const s of fallSeeds) lp.enqueue(s[0], s[1], s[2], 0);
      lp.run();
    }
    return removed;
  }

  return {cascadeRemove, cascadePlace, cascadeSweep, mkPolicy};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CascadeCore;
