'use strict';
/* ============================================================
   篝火账 kit (CampfireKit) — 应用层装配
   ------------------------------------------------------------
   探险(js/modes/adventure.js)与体验馆(js/modes/showroom.js, 共享同一
   place-kit 实例=同缝)篝火侧账的共享装配 kit(篝火票据 T-C1, campfire-spec
   §3.3/§3.4/§4): 台账 Map + tick(dt) 计划刻累积器 + 放置/破坏两钩 + encode
   存档桩。刻账纯函数(燃尽步进/档账清扫)在 js/adventure-core.js(纯函数宿主),
   本 kit 只收编装配段: dt 累积器把帧增量量化成 1/20s 整刻(pumpFluids 的
   fluidAcc 同款, guard=8 掉帧防螺旋), 燃尽余量全按整刻记账(整数入档零漂)。
   零墙钟(墙钟读数禁用, spec §6-8 确定性重放红线)——不喂
   tick 即冻结, 暂停语义归消费方挂缝(菜单/未锁定/暂停不喂, furnace 同拍)。
   interface: CampfireKit.mkCampfireLedger(opts) → ledger
     opts.onBurnout(x,y,z,k) — 燃尽回调(消费方做 editBlock 收尾; 未注入=静默
       删条); 第 4 参 k=台账键(T-C5: 跨图收尾按键落自己场景的桶)
     opts.read(x,y,z)→id — 水浇读缝(T-C3): 传世界 getBlock, tick 每刻经
       advCampfireQuenchHit 问浇熄几何; 未注入=零问询零炸(燃尽路径原样)
     opts.onQuench(x,y,z,k) — 浇熄回调(T-C3): 命中水邻删条后消费方做 id 互换
       (editBlock B_CAMPFIRE_OUT); 未注入=静默删条; 第 4 参同上(T-C5)
     opts.key(x,y,z)→posKey — 键形注入(T-C5 跨图): 台账/encode/回调全链同源
       一键形(带图前缀族); 缺省裸键(旧装配零迁移)
     opts.sceneGate(k)→bool — 浇熄问询门禁(T-C5 误淬防线): 拒答=该条目本刻
       不问水(跨图条目不被当前世界水误淬); 缺省全查(=旧行为)
     opts.updraft — 气流注册/注销缝(T-C2, {add,remove} 鸭型; 生产侧传
       world.js 装配的 UPDRAFT_SIM; 未注入全程容忍=装配前/Node 语境零炸):
       plant(燃烧态)=add({x,y,z,r,h,lift}) · tick 燃尽到期=remove ·
       drop 已知格=remove(未知格零回调, presence 口径)
     ledger.map — 台账 Map(裸形状暴露, furnace-kit station.map 同款口径)
     ledger.plant(x,y,z) — 放置即燃: 满时长建条(键形经 opts.key)
     ledger.tick(dt) — 计划刻泵(20tps 量化整刻, 燃尽条目经 onBurnout 逐条回调;
       水邻条目经 onQuench 逐条回调, 浇熄先于燃尽问)
     ledger.drop(x,y,z) — 挖除/覆盖删条(未知格零炸零副作用, presence Map 口径)
     ledger.readd(x,y,z) — presence 重注册(T-C5 对账缝): 台账在册才挂柱
       (柱三参单源转发 CF_COLUMN, mode 层零誊抄), 未知格零炸零注册; 登记册
       去重=重复调用幂等
     ledger.simClear() — 登记册作废(T-C5): sim 侧注册被外力清空(loadScene
       清场链)后调, 其后 readd 全数重挂(台账不清——跨图同烧条目留档)
     ledger.reset() — 重进场复位清空(存档重灌归消费方, T-C5 档键缝)
     ledger.encode() — [[posKey,{left}]] 存档形状(advCampfiresClean 同形,
       台账键原样=带注入前缀)
   依赖(均经全局名, 调用期解析): js/adventure-core.js 的 advCampfiresStep/
     advCampfiresClean/advCampfireQuenchHit(装载序双栖: 经典 script 共享词法
     全局名直用, Node 走 CJS 导出面, town-ui core 解析先例) · js/config.js 的
     CAMPFIRE.ticks(Node 装具无 config 导出面时退 spec §3.9 初值——与参数块
     同源同值)
   可测性: 零 THREE·零 DOM·零墙钟·零随机; 契约由 test/campfire-kit.test.js
     守门(数据接线段+kit 行为段)
   ============================================================ */

/* 纯函数解析(装载序双栖, town-ui core 解析先例): 经典 script 里 adventure-core
   先于本文件装载, 共享词法全局名直用; Node require 沙盒无共享词法, 走 core 的
   CJS 导出面(键名在此归一)。core 缺席(装载序破坏)→null: 燃尽步进/encode 防御
   回落不炸加载 */
function cfPureResolve() {
  if (typeof advCampfiresStep === 'function') {
    return {step: advCampfiresStep, clean: advCampfiresClean,
      quenchHit: advCampfireQuenchHit};
  }
  if (typeof module !== 'undefined' && module.exports) {
    const c = require('./adventure-core.js');
    return {step: c.advCampfiresStep, clean: c.advCampfiresClean,
      quenchHit: c.advCampfireQuenchHit};
  }
  return null;
}
const CF_PURE = cfPureResolve();

/* 满时长单源=config 参数块 CAMPFIRE.ticks(spec §3.9); Node 装具(config 无
   CJS 导出面)退 spec 初值——数值与参数块同源 spec §3.9, 生产路径恒走参数块 */
const CF_PARAMS = typeof CAMPFIRE !== 'undefined' ? CAMPFIRE : null;
const CF_FULL_TICKS = (CF_PARAMS && CF_PARAMS.ticks > 0) ? CF_PARAMS.ticks : 6000;

const CF_STEP_S = 1 / 20; /* 计划刻步长: 20tps 游戏钟(spec §4 拍板案) */
const CF_CATCHUP = 8; /* 单帧至多追平刻数(掉帧防螺旋, pumpFluids guard 同款) */

/* 气柱三参单源=config 参数块 CAMPFIRE(updraft 缝 add 载荷转发, 篝火 T-C2);
   Node 装具(config 无 CJS 导出面)退 spec §3.9 初值——与 CF_FULL_TICKS 同款
   回落纪律, 数值与参数块同源, 生产路径恒走参数块 */
const CF_COLUMN = {
  r: (CF_PARAMS && CF_PARAMS.columnR > 0) ? CF_PARAMS.columnR : 1,
  h: (CF_PARAMS && CF_PARAMS.columnH > 0) ? CF_PARAMS.columnH : 20,
  lift: (CF_PARAMS && CF_PARAMS.lift) ? CF_PARAMS.lift : 3.0,
};

/* 台账键形: x,y,z 逗号串(voxel.js blockKey 同形, kit 自建不引引擎件——
   存档/回调双端同形, 防第二份键规约) */
function cfKey(x, y, z) {
  return x + ',' + y + ',' + z;
}

function mkCampfireLedger(opts) {
  const o = opts || {};
  const map = new Map(); /* posKey → 燃烧条目 {x,y,z,left}; 引用跨 init 稳定 */
  /* 键形/门禁注入(T-C5 跨图四缝之二): key 缺省裸键(旧装配零迁移),
     sceneGate 缺省全查(=旧行为)——两缝缺省路径与 T-C1/C3 时代逐字节同效 */
  const key = o.key || cfKey;
  const sceneGate = o.sceneGate || (() => true);
  /* 登记册: 账本自认已在 sim 侧的键(readd 幂等据此; plant 挂/drop·浇熄·
     燃尽摘/reset·simClear 清)——sim 本体按格键幂等, 册=账本侧对齐镜像 */
  const simKeys = new Set();

  /* 放置即燃(spec §3.3): 满时长建条——燃烧账在方块侧, 物品零 dur;
     燃烧态=气流注册(spec §3.5): 源格心+柱参三件单源转发(T-C2 updraft 缝) */
  function plant(x, y, z) {
    const k = key(x, y, z);
    map.set(k, {x, y, z, left: CF_FULL_TICKS});
    simKeys.add(k);
    if (o.updraft) {
      o.updraft.add({x, y, z, r: CF_COLUMN.r, h: CF_COLUMN.h, lift: CF_COLUMN.lift});
    }
  }

  let acc = 0; /* 亚刻累积器(丢的是亚刻不是整刻, fluidAcc 同款) */
  let backlog = 0; /* 追平欠账刻数(单帧 guard 截断的余量, 后续帧清偿) */

  /* 计划刻泵(update gameplay 块喂, furnace.tick 同缝同拍): dt 累积成整刻,
     每刻步进一次燃尽账, 到期条目逐条经 onBurnout(坐标全参, 消费方 editBlock
     收尾); 单帧消费以 guard 刻封顶, 超限整刻记欠账后续帧排水(优雅降级
     不丢刻); 不喂即冻结(零墙钟, 账本自身零主动推进) */
  function tick(dt) {
    /* 整刻换算用除法+容差(减法连扣有浮点残渣: 0.5-9d 已 < d, 直扣只数出
       9 刻; 0.5/d=9.999...998, +1e-9 容差回到整 10——合同 0.5s=10 刻零漂) */
    const avail = acc + dt;
    const fresh = Math.floor(avail / CF_STEP_S + 1e-9);
    const whole = backlog + fresh; /* 欠账按整刻数记账(整数域零漂) */
    const n = Math.min(whole, CF_CATCHUP); /* 单帧至多追平 guard 刻(掉帧防螺旋) */
    backlog = whole - n; /* 未追平刻数留待后续帧排水(优雅降级不丢刻) */
    acc = avail - fresh * CF_STEP_S; /* 亚刻余量留累积器(丢的是亚刻不是整刻) */
    for (let i = 0; i < n; i++) {
      /* 水浇问询(T-C3, 每刻先于燃尽步进): read 注入才问(零问询零炸, 装配前/
         无水世界燃尽路径原样), 纯几何经 CF_PURE.quenchHit; sceneGate 拒答的
         条目本刻不问(T-C5 误淬防线——跨图条目不吃当前世界的水问询); 命中=
         删条+气流注销+onQuench(同 onBurnout 回调序)——浇熄不是燃尽, 两态
         互换非消失; 回调第 4 参=台账键(T-C5 跨图收尾按键落桶) */
      if (o.read) {
        for (const [k, e] of map) {
          if (!sceneGate(k)) continue;
          if (CF_PURE.quenchHit(e.x, e.y, e.z, o.read)) {
            map.delete(k);
            simKeys.delete(k);
            if (o.updraft) o.updraft.remove(e.x, e.y, e.z);
            if (o.onQuench) o.onQuench(e.x, e.y, e.z, k);
          }
        }
      }
      /* 到期键采样(条目键=身份, 与 step 同序): 回调携实际 map 键——燃尽可发生在
         键所属场景之外(T-C5 跨图同烧), 当下重拼会随 advSceneKey() 漂移(人在哪张图
         拼出哪张图的前缀), 消费方按键归属收尾——键形必须稳 */
      const dueK = [];
      for (const [k, e] of map) if (e.left <= 1) dueK.push(k);
      const due = CF_PURE.step(map, 1); /* 纯函数递减+删条, 出到期清单 */
      for (let i = 0; i < due.length; i++) {
        const e = due[i];
        simKeys.delete(dueK[i]); /* 登记册随条目出清(携条目实际键, 同下) */
        if (o.updraft) o.updraft.remove(e.x, e.y, e.z); /* 燃尽=注销(与 onBurnout 同一状态迁移点, spec §3.5) */
        if (o.onBurnout) o.onBurnout(e.x, e.y, e.z, dueK[i]);
      }
    }
  }

  /* 破坏钩(挖除/TNT/覆盖, advMarkEdit seam): presence Map 口径——未知格
     零炸零副作用, 不读世界值; 已知格删条连带气流注销(挖除=remove, T-C2) */
  function drop(x, y, z) {
    const k = key(x, y, z);
    if (map.delete(k)) {
      simKeys.delete(k);
      if (o.updraft) o.updraft.remove(x, y, z);
    }
  }

  /* presence 重注册(T-C5 对账缝): 台账在册才挂柱(未知格零炸零注册), 柱三参
     单源转发 CF_COLUMN(mode 层零誊抄); 登记册去重=重复调用幂等(sim 本体
     按格键覆盖, 册=免重复载荷的账本侧镜像) */
  function readd(x, y, z) {
    const k = key(x, y, z);
    const e = map.get(k);
    if (!e || simKeys.has(k) || !o.updraft) return;
    simKeys.add(k);
    o.updraft.add({x: e.x, y: e.y, z: e.z, r: CF_COLUMN.r, h: CF_COLUMN.h, lift: CF_COLUMN.lift});
  }

  /* 登记册作废(T-C5): sim 侧注册被外力清空(loadScene 清场链 UPDRAFT_SIM.clear)
     后调——册=注册态镜像, 外力清场后册已过期, 作废使其后 readd 全数重挂;
     台账不动(跨图同烧条目留档) */
  function simClear() {
    simKeys.clear();
  }

  /* 重进场复位(init 消费): 台账清空(存档重灌归消费方) */
  function reset() {
    map.clear();
    simKeys.clear();
    acc = 0;
    backlog = 0;
  }

  /* 存档形状(T-C5 档键缝): [[posKey,{left}]] 二元组数组——纯函数
     advCampfiresClean 同形, 只挑 left 坐标不双写; 键=台账键原样(带注入前缀) */
  function encode() {
    return CF_PURE.clean(map);
  }

  return {map, plant, tick, drop, readd, simClear, reset, encode};
}

const CampfireKit = {mkCampfireLedger};
if (typeof module !== 'undefined' && module.exports) module.exports = CampfireKit;
