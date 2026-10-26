'use strict';
/* ============================================================
   流体核心 (FluidCore, 术语见 GLOSSARY.md「流体核心」) — 引擎层纯核心
   ------------------------------------------------------------
   MC 液体的计划刻模拟(docs/mc-liquid-research.md §3.4 伪代码的落地,
   设计权威 docs/liquid-design.md D4): 每格 {源?, 水位 0-8} 存并行水位面
   (ADR 0004), 队列按排程序(入队序)驱动、零墙钟——同编辑序必同终态
   (确定性重放红线)。步进语义:
   · 非源格先重算水位(上方同流体=下落 8; 水平邻居供水减 dropOff),
     无供水 → 断供消退置空气;
   · 传播下落优先(下落不耗水平距离, 落地重铺), 平铺走坡向寻路
     (四方向各起步权重 1000, slopeSteps 步内找洞取最短, 只朝最低方向);
   · 流入目标: 异流体 → 混合表(圆石/石头/黑曜石, 设计稿 D4.4);
     thin 依附块 → 冲毁; 空气 → 源再生判定后写入(水可成源, 岩浆不可);
   · 与 MC 的全部差异登记在设计稿附录 B(≥3 源同刻侧铺不移植等)。
   interface: mkPolicy(BLOCKS) → {kindOf, flowable, washable}(身份旗标派生,
     world.js 与单测共用同一装配, 防两份漂移)
     mkSim(env) → sim, env = {read, write, readLv, policy, params, ids, mixIds, w, h, d}
       · notifyEdit(x,y,z)  编辑挂点: 本格与六邻的流体入列
       · activate(w,h,d)    全场激活: 全部流体格入列(装场期一次), 返回流体格数
       · step(now, budget)  推进: 出队 due≤now 的条目(按入队序), 返回事件
         清单[{type:'flow'|'dry'|'mix'|'wash', ...}], budget 格封顶
       · pending()          队列余量(性能/测试观察口)
     amountOf(lv) 水位→水量(0=源→8; 1-7 流动→8-lv; 8=下落→8)
   依赖(零全局, 全部经参数注入): read(x,y,z)→id(界外=0) ·
     write(x,y,z,id,lv) · readLv(x,y,z)(界外=0) · BLOCKS(仅 mkPolicy) ·
     params = FLUIDS(config 参数表, 按 kind 键) · ids = {water, lava} 方块 id ·
     mixIds = {obsidian, cobble, stone} 混合产物方块 id · w/h/d 世界尺寸
     (界外一律不可流入——世界底与图界不可渗透, 防无限坠落/溢图)
   可测性: 零 THREE·零 DOM·有单测(test/fluid-core.test.js)
   ============================================================ */
const FluidCore = (() => {
  const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const NEIGH6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const NO_DIR = 1000; // 坡向权重哨兵: 步数内找不到洞

  /* 水位 → 水量: 源(0)与下落(8)满水量, 流动 1-7 越远越空 */
  function amountOf(lv) {
    return lv === 8 ? 8 : 8 - lv;
  }

  /* 身份旗标派生(config BLOCKS, 装配一次; 调用期热路径只查闭包数组):
     kindOf 流体身份('water'|'lava'|null) · flowable 流动可替换面(空气+thin 族,
     与方块级联 isSupport 同判据族: 实心/玻璃/门面一律不可) · washable 被冲毁
     (thin 依附块——火把/树苗/草丛/麦, 复用既有旗标不新增, 设计稿 D4.3) */
  function mkPolicy(BLOCKS) {
    const kind = [];
    const flow = [];
    const wash = [];
    for (let id = 0; id < 256; id++) {
      const b = BLOCKS[id];
      kind[id] = (b && b.fluid) || null;
      flow[id] = id === 0 || !!(b && b.thin != null);
      wash[id] = !!(b && b.thin != null);
    }
    return {
      kindOf: (id) => kind[id] || null,
      flowable: (id) => !!flow[id],
      washable: (id) => !!wash[id],
    };
  }

  function mkSim(env) {
    const read = env.read; const write = env.write; const readLv = env.readLv;
    const policy = env.policy; const params = env.params;
    const ids = env.ids; const mixIds = env.mixIds;
    const W = env.w; const H = env.h; const D = env.d; // 世界界内判定: 界外一律不可流入(世界底与图界不可渗透——防无限坠落/溢图)
    const inside = (x, y, z) => x >= 0 && z >= 0 && y >= 0 && x < W && z < D && y < H;
    const canFlow = (x, y, z) => inside(x, y, z) && policy.flowable(read(x, y, z));
    const q = []; // 条目 {x,y,z,due,seq}; 消费后置 null, 半数空洞时压实
    const qk = new Map(); // "x,y,z" → 队列下标(同格去重)
    let seq = 0;
    let now = 0; // 最近一次 step 的游戏刻(排程序时间基, 与墙钟解耦)
    let evOut = []; // step 期间事件收集(闭包直填)

    /* 入列: 流体格才排程; 已入列 → 保留更早的 due(更新不重复) */
    function schedule(x, y, z) {
      const kind = policy.kindOf(read(x, y, z));
      if (!kind) return;
      const key = x + ',' + y + ',' + z;
      const at = qk.get(key);
      if (at !== undefined) {
        const due = now + params[kind].ticks;
        if (due < q[at].due) q[at].due = due;
        return;
      }
      qk.set(key, q.length);
      q.push({x, y, z, due: now + params[kind].ticks, seq: seq++});
    }

    function scheduleNeighbors(x, y, z) {
      for (const d of NEIGH6) {
        if (policy.kindOf(read(x + d[0], y + d[1], z + d[2]))) schedule(x + d[0], y + d[1], z + d[2]);
      }
    }

    /* 水岩混合表(设计稿 D4.4, MC 规则 1-3): moverKind 动作者流体 ·
       targetKind 目标流体 · targetLv 目标水位 · fromDown 自正上向下。
       返回产物方块 id 或 0(同流体不触发); 动作者不落格(停在原位) */
    function mixProduct(moverKind, targetKind, targetLv, fromDown) {
      if (moverKind === targetKind) return 0;
      if (moverKind === 'water') {
        return targetLv === 0 ? mixIds.obsidian : mixIds.cobble; // 水触岩浆源→黑曜石 / 流动岩浆→圆石
      }
      return fromDown ? mixIds.stone : mixIds.cobble; // 岩浆自上入水→石头 / 侧向遇水→圆石
    }

    /* 水位重算(非源格): 上方同流体 → 8(下落); 否则水平邻居供水取最强,
       供水量 = 邻居水量 − dropOff(下落邻居须已落地才侧供)。无供水 → null */
    function recalc(x, y, z, kind, P) {
      if (policy.kindOf(read(x, y + 1, z)) === kind) return 8;
      let best = 0;
      for (const d of DIR4) {
        const nx = x + d[0]; const nz = z + d[1];
        if (policy.kindOf(read(nx, y, nz)) !== kind) continue;
        const nlv = readLv(nx, y, nz);
        if (nlv === 8 && canFlow(nx, y - 1, nz)) continue; // 空中下落柱不侧供
        const amt = amountOf(nlv) - P.dropOff;
        if (amt > best) best = amt;
      }
      return best >= 1 ? 8 - best : null;
    }

    /* 坡向找洞(研究稿 §3.2): 候选格脚下可流入即洞(距离 1); 递归不回头,
       步数耗尽返回哨兵 */
    function slopeDist(x, y, z, steps, fromDx, fromDz) {
      if (canFlow(x, y - 1, z)) return 1;
      if (steps <= 0) return NO_DIR;
      let best = NO_DIR;
      for (const d of DIR4) {
        if (d[0] === -fromDx && d[1] === -fromDz) continue; // 不走回头路
        const nx = x + d[0]; const nz = z + d[1];
        if (!canFlow(nx, y, nz)) continue;
        const sub = slopeDist(nx, y, nz, steps - 1, d[0], d[1]);
        if (sub < best) best = sub;
      }
      return best >= NO_DIR ? NO_DIR : best + 1;
    }

    /* 坡向方向集: 可流入方向里找洞取最短(可并列); 全是哨兵 → null(平铺四方向) */
    function slopeDirs(x, y, z, P) {
      let best = NO_DIR;
      let wins = null;
      for (const d of DIR4) {
        if (!canFlow(x + d[0], y, z + d[1])) continue;
        const w = slopeDist(x + d[0], y, z + d[1], P.slopeSteps, d[0], d[1]);
        if (w >= NO_DIR) continue;
        if (w < best) {
          best = w;
          wins = [d];
        } else if (w === best) {
          wins.push(d); // 并列最低: 全取(MC 口径)
        }
      }
      return wins;
    }

    /* 源再生(研究稿 §4 两规则, 水开岩浆关): 流入空气格瞬间判定——
       ①水平 ≥2 源邻居 且 脚下不可流入(实心); ②水平 1 源 + 正上方源。
       脚下是任何流体(含异流体)都不判——实心下托才稳 */
    function regenLevel(tx, ty, tz, kind, P) {
      if (!P.regen) return null;
      if (canFlow(tx, ty - 1, tz) || policy.kindOf(read(tx, ty - 1, tz))) return null;
      let srcN = 0;
      for (const d of DIR4) {
        const nx = tx + d[0]; const nz = tz + d[1];
        if (policy.kindOf(read(nx, ty, nz)) === kind && readLv(nx, ty, nz) === 0) srcN++;
      }
      if (srcN >= 2) return 0;
      if (srcN >= 1 && policy.kindOf(read(tx, ty + 1, tz)) === kind && readLv(tx, ty + 1, tz) === 0) return 0;
      return null;
    }

    /* 流入目标结算(目标必非同流体——同流体走 strengthenInto):
       异流体 → 混合; thin → 冲毁后写入; 空气 → 源再生判定后写入; 实心/界外 → 无事 */
    function spreadInto(tx, ty, tz, kind, P, newLv, fromDown) {
      if (!inside(tx, ty, tz)) return;
      const tid = read(tx, ty, tz);
      const tkind = policy.kindOf(tid);
      if (tkind) {
        const prod = mixProduct(kind, tkind, readLv(tx, ty, tz), fromDown);
        if (prod) {
          write(tx, ty, tz, prod, 0);
          evOut.push({type: 'mix', x: tx, y: ty, z: tz, from: tid, to: prod});
          scheduleNeighbors(tx, ty, tz);
        }
        return;
      }
      if (!policy.flowable(tid)) return; // 实心/玻璃等: 不可流入
      let lv = newLv;
      if (tid === 0) { // 空气: 源再生判定(成源则 lv=0)
        const regen = regenLevel(tx, ty, tz, kind, P);
        if (regen !== null) lv = regen;
      }
      if (policy.washable(tid)) evOut.push({type: 'wash', x: tx, y: ty, z: tz, id: tid});
      write(tx, ty, tz, ids[kind], lv);
      evOut.push({type: 'flow', x: tx, y: ty, z: tz, id: ids[kind], lv});
      schedule(tx, ty, tz);
    }

    /* 同流体目标: 只加强不减弱(防振荡; 减弱走邻格重算路径) */
    function strengthenInto(tx, ty, tz, kind, P, newLv, fromDown) {
      const tid = read(tx, ty, tz);
      if (policy.kindOf(tid) !== kind) {
        spreadInto(tx, ty, tz, kind, P, newLv, fromDown);
        return;
      }
      const cur = readLv(tx, ty, tz);
      if (cur === 0 || amountOf(cur) >= amountOf(newLv)) return; // 源/更强水位: 不动
      write(tx, ty, tz, tid, newLv);
      evOut.push({type: 'flow', x: tx, y: ty, z: tz, id: tid, lv: newLv});
      schedule(tx, ty, tz);
    }

    /* 单格步进: 非源先重算(断供→消退), 再传播(下落优先 → 坡向/四方向侧铺) */
    function tickCell(x, y, z) {
      const id = read(x, y, z);
      const kind = policy.kindOf(id);
      if (!kind) return; // 被掏空/被替换的过期条目
      const P = params[kind];
      let lv = readLv(x, y, z);
      if (lv > 0) { // 非源重算(源永不自消退——MC 口径)
        const nl = recalc(x, y, z, kind, P);
        if (nl === null) {
          write(x, y, z, 0, 0);
          evOut.push({type: 'dry', x, y, z, id});
          scheduleNeighbors(x, y, z);
          return;
        }
        if (nl !== lv) {
          write(x, y, z, id, nl);
          evOut.push({type: 'flow', x, y, z, id, lv: nl});
          scheduleNeighbors(x, y, z); // 水位变化 → 邻格连锁重查(减弱也由此传播)
        }
        lv = nl;
      }
      /* 传播①: 脚下可流入(空气/thin) → 下落柱(满水量, 不耗水平距离), 本刻
         到此为止(空中不侧铺——MC 下落优先口径); 脚下异流体 → 混合占位;
         脚下同流体 → 柱体内部不动作(落地铺展由受水格自己的重算完成,
         研究稿 §3 Spread 步骤 6 的下落柱推广) */
      const bid = read(x, y - 1, z);
      const bkind = policy.kindOf(bid);
      if (bkind === kind) return;
      if (canFlow(x, y - 1, z) || (bkind && bkind !== kind)) {
        spreadInto(x, y - 1, z, kind, P, 8, true);
        return;
      }
      /* 传播②: 侧铺(脚下实心)——水量再衰减一格后仍有余才铺(停流线内嵌在此判据),
         坡向找到洞 → 只朝洞方向; 没洞 → 四方向 */
      const newAmt = amountOf(lv) - P.dropOff;
      if (newAmt < 1) return;
      const newLv = 8 - newAmt;
      const dirs = slopeDirs(x, y, z, P) || DIR4;
      for (const d of dirs) {
        strengthenInto(x + d[0], y, z + d[1], kind, P, newLv, false);
      }
    }

    /* 编辑挂点: 本格与六邻的流体入列(破坏/放置邻接即排程——与方块级联同一触发面) */
    function notifyEdit(x, y, z) {
      if (policy.kindOf(read(x, y, z))) schedule(x, y, z);
      scheduleNeighbors(x, y, z);
    }

    /* 全场激活(共识 Q4a): 全部流体格入列, 装场期由装配层结算到不动点 */
    function activate(w, h, d) {
      let n = 0;
      for (let x = 0; x < w; x++) {
        for (let z = 0; z < d; z++) {
          for (let y = 0; y < h; y++) {
            if (policy.kindOf(read(x, y, z))) {
              schedule(x, y, z);
              n++;
            }
          }
        }
      }
      return n;
    }

    function compact() { // 消费后的 null 槽超过半数 → 压实并重建索引
      let w = 0;
      for (let i = 0; i < q.length; i++) {
        if (q[i]) q[w++] = q[i];
      }
      q.length = w;
      qk.clear();
      for (let i = 0; i < q.length; i++) qk.set(q[i].x + ',' + q[i].y + ',' + q[i].z, i);
    }

    /* 推进: 出队 due≤nowTick 的条目(按入队序——确定性), budget 格封顶,
       未到期/超预算条目留队 */
    function step(nowTick, budget) {
      now = nowTick;
      let done = 0;
      let holes = 0;
      for (let i = 0; i < q.length && done < budget; i++) {
        const e = q[i];
        if (!e) {
          holes++;
          continue;
        }
        if (e.due > now) continue;
        q[i] = null;
        qk.delete(e.x + ',' + e.y + ',' + e.z);
        tickCell(e.x, e.y, e.z);
        done++;
      }
      if (holes > q.length / 2) compact();
      const evs = evOut;
      evOut = [];
      return evs;
    }

    function pending() {
      let n = 0;
      for (let i = 0; i < q.length; i++) if (q[i]) n++;
      return n;
    }

    function reset() { // 世界清场联动: 队列与时间基归零(闭包仍指向同一份注入函数)
      q.length = 0;
      qk.clear();
      evOut = [];
      now = 0;
      seq = 0;
    }

    return {notifyEdit, activate, step, pending, reset};
  }

  return {mkPolicy, mkSim, amountOf};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FluidCore;
