'use strict';
/* ============================================================
   放置链装配 kit (PlaceKit, 术语见 GLOSSARY.md) — 应用层装配
   ------------------------------------------------------------
   探险(js/modes/adventure.js)与体验馆(js/modes/showroom.js)「放置/破坏/
   门开关」三段装配的共享 kit(docs/showroom-design.md §8, 两消费者塑形)。
   规则全在纯函数(adventure-core 的 advPlaceCheck/advDoorSiteOk/
   advDoorTogglePlan/advDoorBreakPlan/advPortalSiteOk/advPortalFrame/
   advIsDoor/advMineStep/advCascadeLedger + craft-core 的 breakTime +
   drops 的 rollBlockDrop), 本 kit 只收编两模式镜像的壳段, 不造第二份
   规则实现; 消费方政策全走 opts 缝(与 FurnaceKit 的语义事件缝同一思路):
     opts.inv — 背包对象(引用稳定)或 () => 背包(进场换新), 内部取数器归一
     opts.sel — () => 选中槽号(快捷栏选中态归消费方)
     opts.pos — () => {x,y,z}(站点/门/传送门校验纯函数的玩家位置形状)
     opts.onEdit(x,y,z,id) — 世界改动记账(探险=journal+站点缓存;
       体验馆 noop——无 journal, 改动只活当次进场=恢复原装)
     opts.onPlaced(blockId,x,y,z) — 放置后钩(探险=任务 tally+树苗挂表)
     opts.onConsume() — 扣件后(快捷栏同步)
     opts.onPortalPlaced(by,px,pz) — 传送门立起后(探险=锚这扇门的光束)
     opts.cascade — {mark,sapling,drop,questMine} 级联账本 sink
       (advCascadeLedger 形状; drop=掉落物出口, questMine=挖掘记账)
     opts.onFelled() — 整树倒观感
     opts.wear() — 破坏成功磨损(探险=advWearHeld('mine'); 体验馆=简版)
     opts.say/speak/sfx — 观感三件(体验馆 dev 降噪全不传=静默)
     opts.ring(p)/opts.swing() — 准星进度环/挥动观感
     opts.mesh — {touch(x,z), flush()} setBlockRaw 直写后的网格收口
     opts.hardText(id) — 无 hard 方块话术(空串=不出声)
   interface: PlaceKit.mkEditor(opts) → editor {tryPlace · placeDoor ·
     placePortal · tryDoorToggle · breakBlock · doorBreakApply · applyCascade ·
     mineTick(mine,hit,dt,view) · mineStop(mine) · tickTimers(dt)} ·
     PlaceKit.aimHit()(静态: 准星命中, Node 无相机件返 null)
     mine 状态形状 {down,t,key,need,drops,swingT} 与探险 advMine 同形。
     view 形状 {held(按住), panelOpen(面板遮罩)}。
   依赖(均经全局名, 调用期解析): js/adventure-core.js 的纯函数族(加载序在
     本文件之前) · js/craft-core.js 的 breakTime · js/drops.js 的
     rollBlockDrop · js/items-core.js 的 ITEMS/isTool · js/inventory-core.js
     的 remove · js/config.js 的 BLOCKS/PLAYER · js/voxel.js 的 getBlock/
     editBlock/setBlockRaw/blockKey/collidesAtPlayer · js/world.js 的
     CameraRig/raycastVoxel/camera(aimHit 运行期守卫, Node 缺席返 null)
   可测性: THREE/DOM 全经注入缝与运行期守卫, 假环境可全链驱动; 契约由
     test/place-kit.test.js 守门(放置/门/破坏/蓄力四线, 只测编排不重测
     纯函数——各纯函数单测在各自 -core 文件)
   ============================================================ */

function aimHitNow() {/* 准星命中(CameraRig.aim 唯一视线入口, nether 先例):
  Node 测试无相机件时返回 null(蓄力链经 onMouse 直测) */
  if (typeof CameraRig === 'undefined' || typeof camera === 'undefined' ||
      typeof raycastVoxel === 'undefined') return null;
  const a = CameraRig.aim(camera);
  return raycastVoxel(a.origin, a.dir, PLAYER.reach);
}

function mkEditor(opts) {
  const o = opts || {};
  const invOf = (typeof o.inv === 'function') ? o.inv : () => o.inv; /* 两供给形态归一 */
  const sink = o.cascade || {}; /* 级联账本 sink(advCascadeLedger 形状) */
  let tierT = 0; /* 「需要更硬的镐子」TTS 节流(3s, tickTimers 递减) */
  let hardT = 0; /* 「挖不动」话术节流(3s, tickTimers 递减; 微默认3) */

  /* 级联块结算(方块级联设计稿 D4/D5/P6): 记账编排纯段在 adventure-core
     (advCascadeLedger, 存档红线件), 编辑动作经 sink 接线到消费方; 整树倒
     观感走 opts.onFelled。quest=true 蓄力链视同玩家亲手挖, TNT 链传 false */
  function applyCascade(removed, quest) {
    const r = advCascadeLedger(removed, quest, sink);
    if (r.felled && o.onFelled) o.onFelled();
  }

  /* 门配对破坏(设计稿 §4.3): 任何移除点(挖方/TNT)清格后调用——挖任一半/
     挖门下支撑=整扇消失+掉 1 扇(政策在 advDoorBreakPlan, MC 口径);
     door 格无级联旗标, editBlock 级联清单恒空, 统一走全链防漂移 */
  function doorBreakApply(bx, by, bz, quest) {
    const plan = advDoorBreakPlan(getBlock, bx, by, bz);
    for (const c of plan.cells) {
      if (o.onEdit) o.onEdit(c.x, c.y, c.z, 0);
      applyCascade(editBlock(c.x, c.y, c.z, 0), quest);
    }
    if (plan.drop > 0 && sink.drop) sink.drop('door', plan.drop, bx + 0.5, by + 0.5, bz + 0.5);
  }

  /* 破坏结算: 碎屑(editBlock 内置同色 Fx.debrisBurst)+记账+级联+掉落+磨损。
     bt 为破坏时的 breakTime 结果(drops:false = tier 不足, 只碎不掉+节流提示) */
  function breakBlock(x, y, z, id, bt) {
    if (o.onEdit) o.onEdit(x, y, z, 0); /* 触发格先记账(级联移动可能落回此格, 后写覆盖才对) */
    applyCascade(editBlock(x, y, z, 0), true); /* 蓄力链视同亲手挖(P6) */
    doorBreakApply(x, y, z, true); /* 门配对破坏(挖任一半/挖门下支撑=整扇回收) */
    if (id === B_SAPLING && sink.sapling) sink.sapling(x, y, z); /* 挖树苗撤计时 */
    if (o.sfx) o.sfx('hit');
    if (o.wear) o.wear(); /* 破坏成功 −1(工具匹配与否都扣, MC 口径; 徒手无槽可扣) */
    if (!bt.drops) {/* tier 不足: 可挖慢速但掉落不触发(§3.4) */
      if (tierT <= 0) {
        tierT = 3;
        if (o.speak) o.speak('需要更硬的镐子哦！');
        if (o.say) o.say('⛏️ 换更硬的镐子才能挖到宝贝');
      }
      return;
    }
    const held = invOf().slots[o.sel()];
    /* 剪刀 × shearDrop 掷专属表(D2); 爆炸路径不传工具走默认表(TNT 链自 roll) */
    for (const d of rollBlockDrop(BLOCKS[id], null, held)) {
      if (sink.drop) sink.drop(d.id, d.n, x + 0.5, y + 0.8, z + 0.5);
    }
    if (sink.questMine) sink.questMine(id, x, y, z); /* 挖到矿记账+首获仪式(消费方 sink) */
  }

  /* 门放置(拦截分支, 门/玻璃板设计稿 §4.1; 传送门 D4 先例): 点击面外一格为
     门基 → 纯核心 advDoorSiteOk 校验(两格空气+下方实心+玩家不入) → 失败给
     儿童话术不扣物品; 成功两格 editBlock(挡光性变化走光场全链)+逐格记账 */
  function placeDoor(hit) {
    if (!hit) return false;
    const slot = o.sel();
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz; /* 与单格放置同款目标格(点击面外一格) */
    const ok = advDoorSiteOk(getBlock, o.pos(), tx, ty, tz);
    if (!ok.ok) {
      if (o.say) {
        o.say(ok.reason === 'inside' ? '🚪 别站在门框里放哦！' :
          ok.reason === 'nosupport' ? '🚪 门要放在地上哦' : '🚪 上下两格都空着才放得下');
      }
      return false; /* 不扣物品, 换个地方再试 */
    }
    for (const c of ok.cells) {
      editBlock(c.x, c.y, c.z, c.id);
      if (o.onEdit) o.onEdit(c.x, c.y, c.z, c.id);
    }
    remove(invOf(), slot, 1);
    if (o.onConsume) o.onConsume();
    if (o.sfx) o.sfx('door_swing');
    if (o.speak) o.speak('门装好啦！点一下就能开关');
    if (o.say) o.say('🚪 门装好啦！点一下就能开关');
    return true;
  }

  /* 下界传送门放置(拦截分支, D4/D13): 点击面外一格为门基 → 纯核心
     advPortalSiteOk 校验(结构包围盒全空气+玩家不入盒) → 失败给话术不扣
     物品; 成功 advPortalFrame 经「setBlockRaw+逐格记账」sink 长出整座门
     (结构只以 edits 形态存在, 重放即重建——互锁红线)+扣 1。放置朝向固定
     (门面朝 ±z), 不随视角(D13) */
  function placePortal(hit) {
    if (!hit) return false;
    const slot = o.sel();
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz;
    const ok = advPortalSiteOk(getBlock, o.pos(), ty, tx, tz); /* 参数序 by,px,pz */
    if (!ok.ok) {
      if (o.say) {
        o.say(ok.reason === 'inside' ? '🌀 站远一点再放哦！' : '🌀 这里太挤啦，找一块大空地！');
      }
      return false; /* 不扣物品, 换个地方再试 */
    }
    advPortalFrame((x, y, z, id) => {
      setBlockRaw(x, y, z, id); /* 直写不走 editBlock: 整座门是原子结构, 不触发级联/掉落 */
      if (o.onEdit) o.onEdit(x, y, z, id); /* 逐格记账 = 重放即重建 */
      if (o.mesh && o.mesh.touch) o.mesh.touch(x, z); /* 门体当帧可见(直写不标脏会等跨环) */
    }, ty, tx, tz);
    if (o.mesh && o.mesh.flush) o.mesh.flush();
    remove(invOf(), slot, 1);
    if (o.onConsume) o.onConsume();
    if (o.onPortalPlaced) o.onPortalPlaced(ty, tx, tz); /* 消费方观感(探险=锚这扇门的光束) */
    if (o.sfx) o.sfx('click');
    if (o.speak) o.speak('下界传送门立起来啦！走进紫色门面去下界！');
    if (o.say) o.say('🌀 下界传送门立起来啦！走进紫色门面去下界！');
    return true;
  }

  /* 放置交互: 选中放置型物品(ITEMS.block 字段)点击准星面 → editBlock+记账+
     背包 −1(D4); thin 块非法落点给话术; nether_portal 与 door 无 block 字段,
     在旧判断之前拦截走结构放置(§3.3/§4.1) */
  function tryPlace(hit) {
    const slot = o.sel();
    const s = invOf().slots[slot];
    const it = s ? ITEMS[s.id] : null;
    if (s && s.id === 'nether_portal') return placePortal(hit); /* 整座门放置, 不走单格 */
    if (s && s.id === 'door') return placeDoor(hit); /* 2 格门结构放置 */
    if (!hit || !it || it.block == null) return false;
    const lookId = getBlock(hit.x, hit.y, hit.z);
    const targetId = getBlock(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
    const pc = advPlaceCheck(hit, it.block, lookId, targetId);
    if (!pc.ok || collidesAtPlayer(pc.x, pc.y, pc.z)) {/* 不与玩家身体重叠(arena 先例) */
      if (o.say) o.say('这里放不了哦');
      return false;
    }
    const moved = editBlock(pc.x, pc.y, pc.z, it.block); /* 放置触发仅 fall(P9): 半空沙即落 */
    if (o.onEdit) o.onEdit(pc.x, pc.y, pc.z, it.block);
    for (const r of moved) {/* 移动两格记账: 原格清空+落格得沙(漏记重进悬空沙复活) */
      if (o.onEdit) {
        o.onEdit(r.x, r.y, r.z, 0);
        o.onEdit(r.to.x, r.to.y, r.to.z, r.id);
      }
    }
    if (o.onPlaced) o.onPlaced(it.block, pc.x, pc.y, pc.z); /* 站点/树苗等放置后钩(消费方政策) */
    remove(invOf(), slot, 1);
    if (o.onConsume) o.onConsume();
    if (o.sfx) o.sfx('click');
    if (o.say) o.say('放下 ' + it.name + '！');
    return true;
  }

  /* 点击门开关(门/玻璃板设计稿 §4.2, 使用先于放置/挖掘): 门任一半命中 →
     纯核心 advDoorTogglePlan 产出成对换 id 写入 → editBlock 两格(挡光性
     变化走光场)+记账+音效话术。返回 true=消费了本次点击(不放不挖) */
  function tryDoorToggle(hit, lookId) {
    if (!hit || !advIsDoor(lookId)) return false;
    const plan = advDoorTogglePlan(getBlock, lookId, o.pos(), hit.x, hit.y, hit.z);
    if (!plan.ok) {
      if (o.say) {
        o.say(plan.reason === 'occupied' ? '🚪 门口有人站着，关不上啦' : '🚪 门缺了一半，挖掉重新放吧');
      }
      return true; /* 命中门但开不了: 吞掉点击 */
    }
    for (const w of plan.writes) {
      editBlock(w.x, w.y, w.z, w.id);
      if (o.onEdit) o.onEdit(w.x, w.y, w.z, w.id);
    }
    if (o.sfx) o.sfx('door_swing');
    if (o.say) o.say(plan.open ? '🚪 吱呀～门开啦' : '🚪 咔哒，门关上啦');
    return true;
  }

  /* 蓄力清零(松手/换目标不可挖/面板打开/退出模式) */
  function mineStop(mine) {
    mine.down = false;
    mine.t = 0;
    mine.key = '';
    mine.swingT = 0;
    if (o.ring) o.ring(-1);
  }

  /* 蓄力循环保守编排(update 每帧; advMineTick 收编): 准星指住可挖方块才
     累计; 换目标/指空清零; 松手态换目标熄火(单击只认起步那块, 不跟准星
     漂); 到点破坏。view = {held 按住, panelOpen 面板遮罩守卫}; hit 由消费方
     每帧喂(PlaceKit.aimHit)。TNT 短按/按住二分与站点点燃是探险专属, 留在
     探险壳(不进 kit) */
  function mineTick(mine, hit, dt, view) {
    const v = view || {};
    if (!mine.down || v.panelOpen) {
      mineStop(mine);
      return;
    }
    const id = hit ? getBlock(hit.x, hit.y, hit.z) : 0;
    const def = id ? BLOCKS[id] : null;
    if (!def || def.hard == null) {/* 空气/水/创造专属(字段缺失即不可采集, T2 判据) */
      if (def) {/* 有实体定义但无 hard = 声明式不可破坏: 节流话术, 不起蓄力 */
        const hardTxt = o.hardText ? o.hardText(id) : '';
        if (hardTxt && hardT <= 0) {
          hardT = 3;
          if (o.speak) o.speak(hardTxt);
          if (o.say) o.say('⛏️ ' + hardTxt);
        }
      }
      mineStop(mine);
      return;
    }
    const aimKey = blockKey(hit.x, hit.y, hit.z);
    if (!v.held && mine.key && mine.key !== aimKey) {/* 松手态(桌面已松手/触屏
      单击)只认起步那块: 单击的意图是"挖这块", 不是"此后准星扫过的每一块" */
      mineStop(mine);
      return;
    }
    const s = invOf().slots[o.sel()];
    const bt = breakTime(def, s && isTool(s.id) ? s : null); /* 非工具手持 = 徒手口径 */
    Object.assign(mine, advMineStep(mine, aimKey, bt, dt));
    mine.swingT += dt; /* 挥动循环: 节拍触发消费方观感(swingPose 循环归 Avatar) */
    if (mine.swingT >= ADV_MINE_SWING) {
      mine.swingT = 0;
      if (o.swing) o.swing();
    }
    if (o.ring) o.ring(mine.need > 0 ? mine.t / mine.need : -1); /* 准星进度环填充 */
    if (!mine.done) return;
    breakBlock(hit.x, hit.y, hit.z, id, bt);
    mine.t = 0;
    mine.key = '';
    if (!v.held) mine.down = false; /* 触屏单击/桌面已松手: 本块完成即停 */
    if (o.ring) o.ring(-1);
  }

  /* 话术节流账本递减(update 每帧调用, 与探险 update 直减同拍; 不在蓄力中
     也递减——「隔 3 秒再挖再提示」的既有口径) */
  function tickTimers(dt) {
    tierT = Math.max(0, tierT - dt);
    hardT = Math.max(0, hardT - dt);
  }
  function resetTimers() {/* 切图/退模式复位(探险 scene-leave 同拍) */
    tierT = 0;
    hardT = 0;
  }

  return {tryPlace, placeDoor, placePortal, tryDoorToggle, breakBlock,
    doorBreakApply, applyCascade, mineTick, mineStop, tickTimers, resetTimers};
}

const PlaceKit = {mkEditor, aimHit: aimHitNow};
if (typeof module !== 'undefined' && module.exports) module.exports = PlaceKit;
