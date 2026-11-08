'use strict';
/* ============================================================
   放置链装配 kit (PlaceKit, 术语见 GLOSSARY.md) — 应用层装配
   ------------------------------------------------------------
   探险(js/modes/adventure.js)与体验馆(js/modes/showroom.js)「放置/破坏/
   门开关」三段装配的共享 kit(docs/showroom-design.md §8, 两消费者塑形)。
   规则全在纯函数(adventure-core 的 advPlaceCheck/advDoorSiteOk/
   advDoorTogglePlan/advBedSiteOk/
   advPortalSiteOk/advPortalFrame/
   advIsDoor/advMineStep/advCascadeLedger + craft-core 的 breakTime +
   drops 的 rollBlockDrop + paired-block-core 的 advPairedBlockRows 行表),
   本 kit 只收编两模式镜像的壳段, 不造第二份
   规则实现; 消费方政策全走 opts 缝(与 FurnaceKit 的语义事件缝同一思路):
     opts.inv — 背包对象(引用稳定)或 () => 背包(进场换新), 内部取数器归一
     opts.sel — () => 选中槽号(快捷栏选中态归消费方)
     opts.pos — () => {x,y,z}(站点/门/床/传送门校验纯函数的玩家位置形状)
     opts.yaw — () => 朝向弧度(床放置轴向取主导轴用, 缺省 0=朝北)
     opts.onEdit(x,y,z,id) — 世界改动记账(探险=journal+站点缓存;
       体验馆 noop——无 journal, 改动只活当次进场=恢复原装)
     opts.onPlaced(blockId,x,y,z) — 放置后钩(探险=任务 tally+树苗挂表)
     opts.onLootChestBreak(x,y,z,id,quest) — 奖励箱破坏后钩(D19: 探险=探宝
       任务 tally 随箱型迁移; quest=false=TNT 链不计数; 仅计划命中才发)
     opts.onConsume() — 扣件后(快捷栏同步)
     opts.onPortalPlaced(by,px,pz) — 传送门立起后(探险=锚这扇门的光束)
     opts.cascade — {mark,sapling,crop,drop,questMine} 级联账本 sink
       (advCascadeLedger 形状; drop=掉落物出口, questMine=挖掘记账)
     opts.onFelled() — 整树倒观感
     opts.wear() — 破坏成功磨损(探险=advWearHeld('mine'); 体验馆=简版)
     opts.say/speak/sfx — 观感三件(体验馆 dev 降噪全不传=静默)
     opts.ring(p)/opts.swing() — 准星进度环/挥动观感
     opts.mesh — {touch(x,z), flush()} setBlockRaw 直写后的网格收口
     opts.hardText(id, x, y, z) — 不可破坏话术缝(空串=不出声): ①无 hard 方块
        (传送门等, 既有)②边界屏障格(T7 P2: 有 hard 方块坐标落在未解锁屏障体,
        政策拒绝; 老注入 (id) 签名多收三参天然向后兼容——JS 语义)
     opts.placeGuard(tx, ty, tz) — 禁放柱守卫缝(T7 P3, true=拒绝): 命中→拒绝+
        话术+不扣物品, 未注入=不拦(体验馆形态零影响, R9——不进共享纯函数
        advPlaceCheck, 挂消费方注入层, 无边界带的世界不被误伤)
      opts.cascadeGuard(removed) — 级联清单守卫缝(T7 R10 补口, 波次二): 级联移除
        在 editBlock→cascadeRemove 内已直写世界, 本缝在账本前给消费方一个
        「原位复原受保护格+从清单剔除」的口(探险=屏障格豁免); 未注入=恒等
        (体验馆/零边界带世界零影响)
   interface: PlaceKit.mkEditor(opts) → editor {tryPlace · placeDoor ·
     placePortal · tryDoorToggle · breakBlock · pairedBreakApply ·
     applyCascade ·
     mineTick(mine,hit,dt,view) · mineStop(mine) · tickTimers(dt)} ·
     PlaceKit.aimHit()(静态: 准星命中, Node 无相机件返 null)
     mine 状态形状 {down,t,key,need,drops,swingT} 与探险 advMine 同形。
     view 形状 {held(按住), panelOpen(面板遮罩)}。
   依赖(均经全局名, 调用期解析): js/adventure-core.js 的纯函数族(加载序在
     本文件之前) · js/paired-block-core.js 的 advPairedBlockRows(配对方块
     行注册表, 2026-11-04 架构评审候选①, 加载序在本文件之前) ·
     js/adventure-dims-core.js 的 advLootChestPlan/advLootChestSmallPlan
     (宝箱计划, 经行表消费, D16/D18) · js/craft-core.js 的 breakTime · js/drops.js 的
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
  const guard = o.placeGuard || null; /* T7 禁放柱守卫缝(方案 P3, hardText 先例同构):
    (tx,ty,tz)→true=拒绝; 未注入=不拦(体验馆形态零影响, R9——守卫不进共享纯函数
    advPlaceCheck, 只在消费方注入层生效, 无边界带的世界不被误伤) */
  let tierT = 0; /* 「需要更硬的镐子」TTS 节流(3s, tickTimers 递减) */
  let hardT = 0; /* 「挖不动」话术节流(3s, tickTimers 递减; 微默认3) */

  /* 守卫命中统一出口: 儿童话术占位(与门/床既有拒绝话术同族; 分向文案骨架归
     各向 spec §6/§7 建议、终稿归 T8 话术过目——R8 纪律)+拒绝, 调用方不扣物品 */
  function guardReject() {
    if (o.say) o.say('🚧 大自然的边界还没让开，这里放不了哦');
    return false;
  }

  /* 级联块结算(方块级联设计稿 D4/D5/P6): 记账编排纯段在 adventure-core
     (advCascadeLedger, 存档红线件), 编辑动作经 sink 接线到消费方; 整树倒
     观感走 opts.onFelled。quest=true 蓄力链视同玩家亲手挖, TNT 链传 false */
  function applyCascade(removed, quest) {
    if (o.cascadeGuard) removed = o.cascadeGuard(removed); /* T7 R10: 受保护格被
      级联放倒时消费方原位复原+剔除(移除已在 cascadeRemove 内直写发生) */
    const r = advCascadeLedger(removed, quest, sink);
    if (r.felled && o.onFelled) o.onFelled();
  }

  /* 配对方块破坏(行注册表单编排, js/paired-block-core.js 家族清单唯一
     权威, 2026-11-04 架构评审候选①): 任何移除点(蓄力链/TNT 链/右键拆)
     清格后同走此一处——逐行跑计划, 命中行: 余格清格+记账+级联, drops 逐条
     落地(门/床补发扇与宝箱掉落表同形), 行钩(宝箱探宝 tally 缝 D19)恰一发;
     触发格身份门(bed/lchest 旗标)在计划内。行序=小箱先于大箱(D18);
     quest 穿透级联(蓄力链 true/TNT 链 false, 掉落不受 quest 影响) */
  function pairedBreakApply(bx, by, bz, quest, id) {
    const ctx = {id, rnd: Math.random};
    for (const row of advPairedBlockRows) {
      const plan = row.plan(getBlock, bx, by, bz, ctx);
      if (!plan) continue;
      for (const c of plan.cells) {
        if (o.onEdit) o.onEdit(c.x, c.y, c.z, 0);
        applyCascade(editBlock(c.x, c.y, c.z, 0), quest);
      }
      for (const d of plan.drops) {
        if (sink.drop) sink.drop(d.id, d.n, bx + 0.5, by + 0.5, bz + 0.5);
      }
      if (row.hook && o[row.hook]) o[row.hook](bx, by, bz, id, quest);
    }
  }

  /* 「需要更硬的镐子」节流提醒(3s, tierT 账本 tickTimers 递减): tier 不足的
     唯一话术出口(蓄力链起手与 breakBlock 直调兜底同用, 不造第二份文案) */
  function tierHint() {
    if (tierT > 0) return;
    tierT = 3;
    if (o.speak) o.speak('需要更硬的镐子哦！');
    if (o.say) o.say('⛏️ 换更硬的镐子才能挖到宝贝');
  }

  /* 破坏结算: 碎屑(editBlock 内置同色 Fx.debrisBurst)+记账+级联+掉落+磨损。
     bt 为破坏时的 breakTime 结果(drops:false = tier 不足)——2026-11-04 用户票
     「挖不动就是真挖不动」: tier 不足整链拒绝, 方块原地不动只节流提醒
     (原「可挖慢速只碎不掉」口径废止; 磨损只认破坏成功) */
  function breakBlock(x, y, z, id, bt) {
    if (!bt.drops) {/* tier 不足: 拒绝破坏(方块原地不动), 节流提醒(直调路径同守蓄力门) */
      tierHint();
      return;
    }
    if (o.onEdit) o.onEdit(x, y, z, 0); /* 触发格先记账(级联移动可能落回此格, 后写覆盖才对) */
    applyCascade(editBlock(x, y, z, 0), true); /* 蓄力链视同亲手挖(P6) */
    if (sink.mined) sink.mined(id, x, y, z); /* 触发格(亲手挖)开采记账(生态恢复/南瓜账, 2026-11-08 补起点:
      级联清单不含触发格(cascadeRemove 只收连带块)——此前挖掘链 mined 从未触发, oreRegen 只剩 TNT 连带路在记) */
    pairedBreakApply(x, y, z, true, id); /* 配对方块破坏(门/床/宝箱行表驱动: 挖任一半整结构回收) */
    if (id === B_SAPLING && sink.sapling) sink.sapling(x, y, z); /* 挖树苗撤计时 */
    if (BLOCKS[id] && BLOCKS[id].crop && sink.crop) sink.crop(x, y, z); /* 挖麦苗撤生长计时(farm-and-recipe D3, crop 身份旗标) */
    if (o.sfx) o.sfx('hit');
    if (o.wear) o.wear(); /* 破坏成功 −1(工具匹配与否都扣, MC 口径; 徒手无槽可扣) */
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
      if (guard && guard(c.x, c.y, c.z)) return guardReject(); /* T7: 禁放柱(门两 cell 逐格判) */
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

  /* 床放置(拦截分支, 两格床改版; 门放置同款): 点击面外一格为床尾候选 →
     纯核心 advBedSiteOk 校验(两格空气+各自下方实心+玩家不入, 床头沿玩家
     朝向取邻格) → 失败给儿童话术不扣物品; 成功两格 editBlock+逐格记账 */
  function placeBed(hit) {
    if (!hit) return false;
    const slot = o.sel();
    const tx = hit.x + hit.nx;
    const ty = hit.y + hit.ny;
    const tz = hit.z + hit.nz; /* 与单格放置同款目标格(点击面外一格) */
    const ok = advBedSiteOk(getBlock, o.pos(), o.yaw ? o.yaw() : 0, tx, ty, tz);
    if (!ok.ok) {
      if (o.say) {
        o.say(ok.reason === 'inside' ? '🛏️ 别站在放床的地方哦！' :
          ok.reason === 'nosupport' ? '🛏️ 床要放在地上哦' : '🛏️ 床头那边要空着才放得下');
      }
      return false; /* 不扣物品, 换个地方再试 */
    }
    for (const c of ok.cells) {
      if (guard && guard(c.x, c.y, c.z)) return guardReject(); /* T7: 禁放柱(床两 cell 逐格判——床头沿朝向可与床尾异列) */
    }
    for (const c of ok.cells) {
      editBlock(c.x, c.y, c.z, c.id);
      if (o.onEdit) o.onEdit(c.x, c.y, c.z, c.id);
    }
    remove(invOf(), slot, 1);
    if (o.onConsume) o.onConsume();
    if (o.sfx) o.sfx('click');
    if (o.speak) o.speak('床放好啦！夜里点它就能睡');
    if (o.say) o.say('🛏️ 床放好啦！夜里点它就能睡');
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
    /* T7: 门框+塔楼+步道列整判(结构占列 x: tx-1..tx+ADV_PORTAL.w, z: tz-1..tz+1,
       与 advPortalSiteOk 包围盒同源——advPortalFrame 会写的每列都拦; 列判与 y
       无关, ty 透传) */
    for (let gx = tx - 1; gx <= tx + ADV_PORTAL.w; gx++) {
      for (const gz of [tz - 1, tz, tz + 1]) {
        if (guard && guard(gx, ty, gz)) return guardReject();
      }
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
     背包 −1(D4); thin 块非法落点给话术; replaceable 薄块(花草/火把, config
     旗标)命中即覆盖——落点=被点格本身, thin 新块支承改认正下方(belowId),
     盖掉树苗连带撤计时(sink.sapling, 挖树苗同款); nether_portal 与 door 无
     block 字段, 在旧判断之前拦截走结构放置(§3.3/§4.1) */
  function tryPlace(hit) {
    const slot = o.sel();
    const s = invOf().slots[slot];
    const it = s ? ITEMS[s.id] : null;
    if (s && s.id === 'nether_portal') return placePortal(hit); /* 整座门放置, 不走单格 */
    if (s && s.id === 'door') return placeDoor(hit); /* 2 格门结构放置 */
    if (s && s.id === 'bed') return placeBed(hit); /* 2 格床结构放置(两格床改版) */
    if (!hit || !it || it.block == null) return false;
    const lookId = getBlock(hit.x, hit.y, hit.z);
    const lookDef = lookId !== 0 ? BLOCKS[lookId] : null;
    const replace = !!(lookDef && lookDef.replaceable); /* 覆盖放置: 落点=被点格 */
    const targetId = getBlock(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
    const pc = advPlaceCheck(hit, it.block, lookId, targetId,
        replace ? getBlock(hit.x, hit.y - 1, hit.z) : null); /* belowId 仅覆盖+thin 新块消费 */
    if (!pc.ok || collidesAtPlayer(pc.x, pc.y, pc.z)) {/* 不与玩家身体重叠(arena 先例) */
      if (o.say) o.say('这里放不了哦');
      return false;
    }
    if (guard && guard(pc.x, pc.y, pc.z)) return guardReject(); /* T7: 禁放柱拒绝(目标格=落点, 含覆盖落点) */
    if (replace && lookId === B_SAPLING && sink.sapling) sink.sapling(pc.x, pc.y, pc.z); /* 盖掉树苗撤计时 */
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
    /* 话术缝起手统一问询(硬块话术, T7 扩签名 (id,x,y,z)): ①无 hard 声明式不可
       破坏(传送门/水等, 字段缺失判据, 既有)②边界屏障格(T7 P2: 有 hard 的方块
       坐标落在未解锁屏障体上——屏障件与带内可挖件同 id, 只有坐标判据能分,
       政策拒绝)——两者共用「挖不动就是真挖不动」既有拒绝链: 不起蓄力+方块
       原地不动+hardT 3s 节流话术, 不造第二份拒绝机制。老注入 (id) 签名多收
       三参天然向后兼容(JS 语义); 判据纯函数零分配, 只在按住+准星命中时到达
       (事件路径, T7 §3.2 每帧审计口径); 空串=放行进蓄力(既有语义) */
    const hardTxt = (def && o.hardText) ? o.hardText(id, hit.x, hit.y, hit.z) : '';
    if (!def || def.hard == null || hardTxt) {/* 空气/水/创造专属/屏障格: 统一拒绝出口 */
      if (hardTxt && hardT <= 0) {
        hardT = 3;
        if (o.speak) o.speak(hardTxt);
        if (o.say) o.say('⛏️ ' + hardTxt);
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
    if (!bt.drops) {/* tier 不足: 挖不动就是真挖不动(2026-11-04 用户票) — 不起蓄力,
      节流提醒换工具; 同上方无 hard 先例(方块原地不动) */
      tierHint();
      mineStop(mine);
      return;
    }
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
    pairedBreakApply, applyCascade, mineTick, mineStop,
    tickTimers, resetTimers};
}

const PlaceKit = {mkEditor, aimHit: aimHitNow};
if (typeof module !== 'undefined' && module.exports) module.exports = PlaceKit;
