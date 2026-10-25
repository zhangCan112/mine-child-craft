'use strict';
/* ============================================================
   竞技场核心 (ArenaCore) — 应用层·纯核心
   ------------------------------------------------------------
   竞技场模式的政策与数值段纯核心(js/modes/arena.js 的纯段剥出,
   先例: world→mesh-core / tank→tank-core / mobs→mob-core /
   adventure→adventure-core)。一期: 常数表(几何/战力/档位/克制/选块)与
   叶子纯函数(角度插值/移速修正/星级/翻盘系数/苦力怕合体探测);
   二期: 参数化即纯段——配平三件套/晋升阈值公式/击杀信用判定半/
   队伍血量占比/编队池构造与抽取/地形段; 三期: 快照→意图段——索敌
   权重/协同计数/分裂决策/计时递减/判负判定/节奏/克制判定(输入快照→
   输出意图, core 不碰 Mobs 实例与观感); 四期: 家传技能 tick 族
   (狂暴/疾爬突进/蛮冲/磐石/颤栗瞬移)快照→意图 + 晋升数值半 + 击杀
   结算决策半 + 技能表(FAMILY_SKILLS/MOB_QUIRKS)声明式迁移与分发
   (蓄力激光 tickLaserCharge 拍板永久留壳——状态机×三类意图×观感交织)。
   壳(战斗编排/THREE·DOM 观感/意图落回与 fx·sfx/移动段/配平 UI 与
   状态)留在 js/modes/arena.js, 在本文件之后加载并经共享词法环境消费。
   interface: 常数表 ARENA(几何)/HOTBAR(选块物品栏)/ARENA_POWER(编队
     配平战力)/ID_GRASS..ID_LAMP(地形方块别名)/TIER_MULT·TIER_NAME
     (晋升档位)/COUNTER(克制关系)/FLY_KNOCK_R·FLY_ORBIT_R(飞行边界
     两档半径)/MAX_MOBS(单队数量上限) · 叶子纯函数 angleLerp(环形角度
     插值)/mobSpeed(移速修正)/tierStars·tierHot(晋升星级的名牌呈现)/
     comebackMult(劣势方击杀信用加成, 入参为双方总血量占比)/
     fusingCreeperNear(逃跑 AI 的合体探测, 入参为读条苦力怕清单) ·
     二期纯段 unitPower·teamPower·balanceTeams(配平三件套, 选边/写回
     状态留壳)/promoThresholds(晋升杀数阈值)/killCredit(击杀信用判定半,
     观感半留壳)/teamHpFrac(队伍总血量占比)/mixPool·mixAvgPower·
     mixBuckets·pickMix(编队池构造与抽取, 核心零 Mobs 依赖)/floorBlock·
     wallBlock·generate(地形段) · 三期快照→意图段 retarget(索敌权重, 入参
     候选快照+rand 注入)/raidTick(袭击协同计数与 dmgMult)/splitReq(分裂
     决策半, 返回延迟队列条目)/decayTimers(13 计时字段递减)/battleEnd
     (判负判定半)/volleyDiv·skeletonHeavySwing(骷髅节奏两件)/ghostChill
     (阴风判定) — 统一意图形状: 返回纯数据, 壳负责落回字段与观感 ·
     四期 rageTick·burstTick·chargeTick·guardTick·blinkTick(家传技能
     tick 族, 信封意图 writes/tint/buff/shock/tp/fx·sfx 标签)/
     levelUpIntent(晋升数值半)/awardKillPlan(击杀结算决策半)/
     FAMILY_SKILLS·MOB_QUIRKS(声明式技能表, tick 直引 core 函数)/
     familyMain(主族折算)/familyTick·familyOnDead(分发, laser 旗标型
     留壳施放)
   依赖(全局名): WORLD_W/WORLD_D(config.js)加载期求 ARENA 几何 ·
     MOB_TYPES(config.js, familyMain 主族折算调用期解析)·
     hashRand/setBlockRaw(voxel.js)与 SceneKit(scene-kit.js)在地形段
     调用期解析(加载序均在前, 见 index.html; Node 测试先载这些再
     require 本文件, adventure-core 档)
   可测性: 零 THREE·零 DOM·有单测(test/arena-core.test.js)
   ============================================================ */
const ArenaCore = (() => {
  /* ---------- 竞技场几何参数(本模式唯一消费者, 归位自 config.js) ---------- */
  const ARENA = {
    cx: WORLD_W/2, cz: WORLD_D/2, // 中心 (64,64)
    floorY: 14, // 场地地面顶层方块 y
    rIn: 36, // 内墙半径
    rOut: 40, // 外墙半径
    flyAlt: 7.8, // 飞行单位悬停高度(离地面)
  };
  /* 选块物品栏(本模式唯一消费者, 归位自 config.js); 第 1 格铁锹哨兵=挖掘入口
     (智能主动作手持感知, 用户拍板 2026-10-24: 选中方块→⛏️放置, 选中铲子→⛏️连挖) */
  const HOTBAR = ['shovel', 3, 4, 13, 5, 6, 17, 16, 15, 18];

  /* ---------- 竞技场配平战力(本模式唯一消费者, 归位自 config.js 的 MOB_TYPES.power) ----------
     综合命中/射程/技能的配平系数, 只喂给编队数量匹配; 其他模式(坦克演习场/
     下界冒险)不感知战力。菜单页的战力示例文案由本表派生(fillPowerNote)。 */
  const ARENA_POWER = {
    zombie: 170, skeleton: 165, creeper: 195, golem: 1000, dragon: 2000, spider: 110,
    cave_spider: 85, silverfish: 40, endermite: 55, slime: 130, enderman: 480, witch: 300,
    husk: 160, drowned: 160, stray: 170, bogged: 150, phantom: 190, vex: 260, creaking: 200,
    zombified_piglin: 230, piglin: 200, piglin_brute: 950, hoglin: 420, zoglin: 430,
    wither_skeleton: 350, blaze: 280, ghast: 320, magma_cube: 190, guardian: 330,
    elder_guardian: 1000, shulker: 200, vindicator: 560, evoker: 300, pillager: 210,
    ravager: 1150, wither: 3000, warden: 4800,
  };

  /* 地形方块别名(config 的 BLOCKS id, 名字见注册表): 免魔法数字散在地形代码里 */
  const ID_GRASS=1; const ID_STONE=3; const ID_COBBLE=4; const ID_BRICK=13; const ID_MOSS=14;
  const ID_BLUEWOOL=15; const ID_REDWOOL=16; const ID_QUARTZ=17; const ID_GLASS=18; const ID_LAMP=19;

  /* ---------- 升级系统常数表(晋升逻辑 awardKill/levelUp 留壳) ----------
     个人击杀累积信用(劣势方×加成), 达标晋升:
     2级精英=属性暴涨+现有技能强化  3级王者=解锁新技能
     阈值随敌方初始数量缩放(25%/60%), 封顶 6/14 杀 */
  const TIER_MULT = {1: {hp: 1, dmg: 1, spd: 1}, 2: {hp: 1.6, dmg: 1.4, spd: 1.1}, 3: {hp: 2.5, dmg: 2.0, spd: 1.2}};
  /* 第 1 档 = 基础档(无加成): 2026-10-25 补 — e160d46 起 tickRaid 协同重数在
     level=1 到拍时 TIER_MULT[1] 为 undefined 必 TypeError(raidT 初值
     Math.random()*0.4, 开战 0.4s 内必炸), 补齐后 raidTick 的 dmgMult
     晋升系数底座与 dmgMult 初值 1 对齐; levelUp 只在 ++ 后读 ≥2 档不受影响 */
  const TIER_NAME = {2: '精英', 3: '王者'};
  /* 克制关系(索敌偏好: 优先进攻自己克制的对手, 回避克制自己的)。龙另行特判 */
  const COUNTER = {
    zombie: 'skeleton', skeleton: 'creeper', creeper: 'golem', golem: 'zombie', // 经典环
    enderman: 'skeleton', // 末影人瞬移闪箭, 专猎弓手
    blaze: 'stray', stray: 'magma_cube', // 火克冰, 冰克熔岩
    warden: 'ravager', // 监守者的蛮力无视巨兽冲撞
  };

  /* 飞行单位场地边界(圆形): 击退回调(半径 FLY_KNOCK_R)与巡飞约束(FLY_ORBIT_R)两档,
     均收在壳的 clampToArena 一处 — 怪物库 hit 的 clamp 回调与战斗巡飞共用 */
  const FLY_KNOCK_R = 2; const FLY_ORBIT_R = 2.5;

  /* 对战管理: 单队数量上限(配平/加点都钳在此) */
  const MAX_MOBS = 1000;

  /* ---------- 叶子纯函数 ---------- */
  /* 环形角度插值: 取 0~2π 的最短弧按 t 比例逼近(t>1 钳到 1) */
  function angleLerp(a, b, t) {
    let d = (b - a) % (Math.PI*2);
    if (d > Math.PI) d -= Math.PI*2;
    if (d < -Math.PI) d += Math.PI*2;
    return a + d*Math.min(1, t);
  }
  /* 狂暴/群体冲锋/疾爬突进/蛮冲/阴风减速/晋升档位 速度系数(各旗标乘子叠加) */
  function mobSpeed(m) {
    let s = m.cfg.speed;
    if (m.raged) s *= 1.5;
    if (m.rageBuffT > 0) s *= 1.25;
    if (m.burstT > 0) s *= 1.8; // 虫虫族·疾爬突进(家传)
    if (m.chargeT > 0) s *= 2.2; // 猪猪一家·蛮冲(家传)
    if (m.slowT > 0) s *= 0.6; // 被鬼一族·阴风打中(减速)
    if (m.level===2) s *= 1.1;
    else if (m.level===3) s *= 1.2;
    return s;
  }
  /* 晋升星级的名牌呈现(语义归模式层): 名牌渲染归怪物库(labelCfg.suffix/hot) */
  const tierStars = (m) => m.level>1 ? '★'.repeat(m.level-1) : '';
  const tierHot = (m) => m.level>1;

  /* 劣势方击杀信用加成(1~2): mine/theirs = 己方/敌方当前总血量占比(壳的
     teamHpFrac 算好传入——核心不读 mobs 全局)。落后越多加成越高, 领先封底 1 */
  function comebackMult(mine, theirs) {
    return Math.min(2, Math.max(1, 1 + 0.8*(theirs - mine)));
  }

  /* 附近有正在读条的敌方苦力怕则返回之(自己读条中,或贴脸两击能反杀时除外);
     fusing = 壳每帧收集的读条苦力怕清单(collectFusing)——核心不读全局清单 */
  function fusingCreeperNear(m, fusing) {
    if (m.type==='creeper' && m.fuse >= 0) return null;
    for (const t of fusing) {
      if (t.team===m.team) continue;
      const fd = Math.hypot(t.pos.x-m.pos.x, t.pos.z-m.pos.z);
      if (fd < 5.5) {
        if (!m.cfg.ranged && fd < m.cfg.range && m.cfg.dmg*m.dmgMult*2 >= t.hp) return null;
        return t;
      }
    }
    return null;
  }

  /* ---------- 地形段(adventure-core seam 先例: 体素写读经全局名调用期解析) ---------- */
  /* 场地地面选块: 中央徽章(红西蓝东)/石英环/双方出生垫 + 确定性石·圆石·苔石拌料 */
  function floorBlock(x, z, dx, dz, r) {
    if (r < 8.6) return dx < 0 ? ID_REDWOOL : ID_BLUEWOOL; // 中央徽章 红西蓝东
    if (Math.abs(r-9.5) < 0.6 || Math.abs(r-30) < 0.6) return ID_QUARTZ; // 石英环
    if (Math.hypot(dx+19, dz) < 3.3) return ID_REDWOOL; // 红方出生垫
    if (Math.hypot(dx-19, dz) < 3.3) return ID_BLUEWOOL; // 蓝方出生垫
    const t = hashRand(x*5+z, z*7+x);
    return t < 0.8 ? ID_STONE : (t < 0.95 ? ID_COBBLE : ID_MOSS);
  }
  /* 环形墙/看台选块: 确定性砖·圆石·苔石拌料 */
  function wallBlock(x, y, z) {
    const t = hashRand(x*7+z*3, y*13+z);
    return t < 0.7 ? ID_BRICK : (t < 0.9 ? ID_COBBLE : ID_MOSS);
  }
  /* 建场总装: 地基 + 地面/环形墙/看台 + 玻璃护栏 + 外圈树 + 12 看台立柱灯 —
     hashRand/setBlockRaw(voxel.js)与 SceneKit.tree(scene-kit.js)经全局名
     调用期解析, 与 advBuildWorld 同款确定性建场 */
  function generate() {
    const G = ARENA.floorY;
    for (let x=0; x<WORLD_W; x++) {
      for (let z=0; z<WORLD_D; z++) {
        const dx = x+0.5-ARENA.cx; const dz = z+0.5-ARENA.cz;
        const r = Math.hypot(dx, dz);
        for (let y=0; y<=G; y++) setBlockRaw(x, y, z, ID_STONE); // 地基
        if (r < ARENA.rIn-0.5) setBlockRaw(x, G, z, floorBlock(x, z, dx, dz, r));
        else if (r <= ARENA.rOut+0.5) setBlockRaw(x, G, z, wallBlock(x, G, z));
        else setBlockRaw(x, G, z, ID_GRASS); // 外部草原
        if (r >= ARENA.rIn-0.5 && r <= ARENA.rOut+0.5) { // 环形墙 + 看台
          for (let y=G+1; y<=G+7; y++) setBlockRaw(x, y, z, wallBlock(x, y, z));
          setBlockRaw(x, G+8, z, hashRand(x*3, z) < 0.88 ? ID_BRICK : ID_COBBLE);
        }
        if (r >= ARENA.rIn-0.6 && r <= ARENA.rIn+0.6) { // 内侧玻璃护栏(1格,不挡视线)
          setBlockRaw(x, G+9, z, ID_GLASS);
        }
        if (r >= ARENA.rOut-0.6 && r <= ARENA.rOut+0.6) { // 外侧玻璃护栏(2格)
          setBlockRaw(x, G+9, z, ID_GLASS);
          setBlockRaw(x, G+10, z, ID_GLASS);
        }
        if (r > ARENA.rOut+7 && x>2 && z>2 && x<WORLD_W-3 && z<WORLD_D-3 &&
           hashRand(x+31, z+17) > 0.988) SceneKit.tree(x, G+1, z);
      }
    }
    for (let i=0; i<12; i++) { // 看台立柱 + 灯
      const a = i*Math.PI/6 + Math.PI/12;
      const px = Math.round(ARENA.cx + Math.cos(a)*(ARENA.rOut-1.4));
      const pz = Math.round(ARENA.cz + Math.sin(a)*(ARENA.rOut-1.4));
      for (let y=G+9; y<=G+11; y++) setBlockRaw(px, y, pz, ID_BRICK);
      setBlockRaw(px, G+12, pz, ID_LAMP);
    }
  }

  /* ---------- 编队池(核心零 Mobs 依赖: spawnable 清单与 MOB_TYPES 由壳注入) ---------- */
  /* 混合编队池: 全部常规怪(Boss 与飞行单位除外 — 混编要贴脸互殴才热闹);
     spawnable 是怪物库的"可部署清单"(排除 mix 伪类型), 伪类型过滤归引擎 */
  function mixPool(spawnable, mobTypes) {
    return spawnable.filter((k) => !mobTypes[k].boss && !mobTypes[k].fly);
  }
  /* 混编单只战力 = 池内平均值(伪类型不落盘到 ARENA_POWER) */
  function mixAvgPower(pool) {
    return Math.round(pool.reduce((s, k)=>s+ARENA_POWER[k], 0) / pool.length);
  }
  /* 混编按族等权分桶(谱系第一期机制消费): 先均匀抽主族再族内均匀抽成员 —
     成员均匀会让大家族(僵尸一家 4 只)挤掉小家族(软软族 2 只)的出场名额 */
  function mixBuckets(pool, mobTypes) {
    const b = {lone: []};
    for (const k of pool) {
      const fam = ((mobTypes[k].family)||[])[0] || 'lone';
      (b[fam] = b[fam] || []).push(k);
    }
    return b;
  }
  /* 从分桶抽一只混编怪: rand 可注入(缺省 Math.random, 出场确定性归单测) */
  function pickMix(buckets, fams, rand) {
    const r = rand || Math.random;
    const fam = buckets[fams[Math.floor(r()*fams.length)]];
    return fam[Math.floor(r()*fam.length)];
  }

  /* ---------- 配平三件套(选边 lastEdited 与写回 to.count 的状态留壳) ---------- */
  /* 单只战力: 混编按池内平均值 mixAvg(壳传 MIX_AVG_POWER — 伪类型不落盘
     到 ARENA_POWER, 见 mixAvgPower) */
  function unitPower(cfg, mixAvg) {
    return cfg.type==='mix' ? mixAvg : ARENA_POWER[cfg.type];
  }
  function teamPower(cfg, mixAvg) {
    return cfg.count * unitPower(cfg, mixAvg);
  }
  /* 配平: 按 from 战力折算 to 的应有人数, 返回新 count(钳 1..MAX_MOBS);
     壳负责按 lastEdited 选边与写回 */
  function balanceTeams(from, to, mixAvg) {
    const n = Math.round(from.count * unitPower(from, mixAvg) / unitPower(to, mixAvg));
    return Math.min(MAX_MOBS, Math.max(1, n));
  }

  /* ---------- 晋升与击杀信用(判定半; 观感半 levelUp/特效留壳) ---------- */
  /* 晋升杀数阈值(随敌方初始数量缩放 25%/60%, 封顶 6/14 杀): 部署时逐只定值 */
  function promoThresholds(ec) {
    const k2 = Math.max(1, Math.min(6, Math.ceil(ec*0.25)));
    const k3 = Math.max(k2+1, Math.min(14, Math.ceil(ec*0.6)));
    return {k2, k3};
  }
  /* 击杀信用入账: 累计信用并数出本次连跳档数(同帧多杀可连跳级) —
     存活口径(!dead/!gone)与 levelUp 循环留壳 */
  function killCredit(kills, credit, level, k2, k3) {
    let k = kills + credit;
    let lv = level;
    let ups = 0;
    while (lv < 3 && k >= (lv===1 ? k2 : k3)) {
      lv++; ups++;
    }
    return {kills: k, ups};
  }
  /* 队伍当前总血量占比(roster=怪物清单快照, initHp=开战基准; 无基准=1) */
  function teamHpFrac(roster, team, initHp) {
    if (!initHp) return 1;
    let hp = 0;
    for (const t of roster) if (t.team===team && !t.dead && !t.gone) hp += t.hp;
    return Math.min(1, hp/initHp);
  }

  /* ---------- 三期: 快照→意图段(壳建快照/落意图, core 不碰 Mobs 实例与观感) ---------- */

  /* 索敌(距离 × 战术权重): snap={retargetT, target(现目标的 {dead,gone} 快照或
     null), targetId, id, team, type, fly, ranged, x, z}; candidates=全体现望
     {id,team,type,mfam,dead,gone,hp,maxHp,fly,ranged,x,z}(壳每帧收集一次
     共用, collectFusing 同款避免逐怪建表)。权重序: 确定性个体偏好(hashRand
     0.75~1.25) · 目标粘性 ×0.75 · 收割残血(<30%) ×0.55 · 克制 ×0.65/被克
     ×1.5 · 地面近战摸不到飞行 ×4 · 龙的猎杀偏好 ×0.6/×1.3 — 权重全玩法
     概念, 归应用层 core。返回 {retargetT}(未到重索敌窗, 目标不变)或
     {targetId, retargetT}(重索敌; targetId=null=全场无候选清空目标)。
     rand 注入(缺省 Math.random, 喂重索敌节拍抖动)。 */
  function retarget(snap, candidates, dt, rand) {
    const r = rand || Math.random;
    const t = snap.retargetT - dt;
    const tg = snap.target;
    if (tg && !tg.dead && !tg.gone && t > 0) return {retargetT: t};
    let bestId = null; let bd = 1e9;
    for (const c of candidates) {
      if (c.id === snap.id || c.dead || c.gone || c.team === snap.team) continue;
      let w = 0.75 + hashRand(snap.id*97 + c.id*13, c.id*29 + snap.id*7)*0.5;
      if (snap.targetId != null && c.id === snap.targetId) w *= 0.75; // 目标粘性:不频繁切换
      if (c.hp < c.maxHp*0.3) w *= 0.55; // 优先收割残血
      if (COUNTER[snap.type] === c.type) w *= 0.65; // 优先进攻克制对象
      else if (COUNTER[c.type] === snap.type) w *= 1.5; // 回避克制自己的对手
      if (c.fly && !snap.fly && !snap.ranged) w *= 4; // 地面近战摸不到飞行
      if (snap.fly && !c.fly) {
        if (!c.ranged) w *= 0.6; // 龙:优先收割无法还手的近战
        else w *= 1.3; // 龙:优先清除远程威胁
      }
      const d = ((c.x-snap.x)*(c.x-snap.x) + (c.z-snap.z)*(c.z-snap.z)) * w;
      if (d < bd) {
        bd = d; bestId = c.id;
      }
    }
    return {targetId: bestId, retargetT: 0.5 + r()*0.4};
  }

  /* 灾厄帮·袭击协同(家传): 每 0.4s 重数 10 格内同族同阵营, 每多一只 +6% 伤害
     (至多 4 只)。snap={raidT, team, level, x, z}, roster=候选快照(含 mfam,
     壳每帧收集共用)。未到拍返回 {raidT}; 到拍返回 {raidT: 0.4, dmgMult} —
     晋升系数 × 协同加成(levelUp 直写下一拍自愈, 语义一致; 第 1 档基础
     系数 1 已补齐, level=1 到拍不再 TypeError) */
  function raidTick(snap, roster, dt) {
    const t = snap.raidT - dt;
    if (t > 0) return {raidT: t};
    let n = 0;
    for (const a of roster) {
      if (a.mfam === 'illager' && a.team === snap.team && !a.dead && !a.gone &&
         Math.hypot(a.x-snap.x, a.z-snap.z) < 10) n++;
    }
    return {raidT: 0.4, dmgMult: TIER_MULT[snap.level].dmg * (1 + 0.06*Math.min(4, n-1))};
  }

  /* 软软族·分裂决策半(家传亡语): snap={splitChild, fighting, team, type, x,
     z, k2, k3}, aliveCount=当前存活数。返回 spawnReq(延迟队列条目形状, 壳
     push 进 pendingSplits)或 null — 小只不再分裂 / 未开战 / 团战 600 只后
     停(防爆仓)。落场(flushSplits)留壳 */
  function splitReq(snap, aliveCount) {
    if (snap.splitChild || !snap.fighting || aliveCount > 600) return null;
    return {team: snap.team, type: snap.type, x: snap.x, z: snap.z, k2: snap.k2, k3: snap.k3};
  }

  /* 计时递减半: 13 个冷却/效果计时字段各减 dt(已 ≤0 的不动, 可过零负 —
     门控都在消费侧的 >0 判定, CombatCore.tickCadence 同风格)。字段族谱:
     slamCd/pounceCd 跃起砸地/扑袭 · rageBuffT 僵尸一家·群体冲锋 ·
     burstCd/burstT 虫虫族·疾爬突进 · chargeCd/chargeT 猪猪一家·蛮冲 ·
     tpCd 末影人·颤栗瞬移(个体特化) · stoneT/stoneCd 守卫组·磐石 ·
     slowT 鬼一族·阴风减速 · invulnT 晋升金身 · rockCd 王者巨石。s 为
     这些字段的只读快照视图(壳直接传 m, 本函数只读不写), 返回新对象由
     壳落回; 光环呼吸动画(tierNode)留壳 */
  function decayTimers(s, dt) {
    const o = {};
    for (const k of ['slamCd', 'pounceCd', 'rageBuffT', 'burstCd', 'burstT', 'chargeCd',
      'chargeT', 'tpCd', 'stoneT', 'stoneCd', 'slowT', 'invulnT', 'rockCd']) {
      o[k] = s[k] > 0 ? s[k] - dt : s[k];
    }
    return o;
  }

  /* 判负判定半: aAlive/bAlive=两侧是否仍有存活, queueLen=部署队列余量
     (未到场≠全灭) — 返回胜方 'A'/'B'、'draw'(两败俱伤)或 null(继续打);
     battleState 门与胜负播报留壳 */
  function battleEnd(aAlive, bAlive, queueLen) {
    if (queueLen > 0) return null;
    if (aAlive && bAlive) return null;
    if (aAlive) return 'A';
    if (bAlive) return 'B';
    return 'draw';
  }

  /* 强力箭节奏: 除数 2/3 — 骷髅一家基础即每 2 箭(D7 族版更密), 其余族
     精英起加密; 发射观感(shootArrow)留壳 */
  function volleyDiv(skeletonLine, level) {
    return (skeletonLine || level >= 2) ? 2 : 3;
  }

  /* 骷髅一家家传的近战表达(凋灵骷髅·节奏重斩): 按挥击计数取重斩拍
     (精英每 2 击, 基础每 3 击); 伤害/击退加成与挥击观感留壳 */
  function skeletonHeavySwing(meleeCnt, level) {
    return meleeCnt % (level >= 2 ? 2 : 3) === 0;
  }

  /* 鬼一族·阴风(家传): 攻击方主族是鬼 → 返回减速时长, 否则 0 — 受击者写
     slowT=max(现值, 时长) 与 Fx 观感留壳 */
  function ghostChill(srcFam) {
    return srcFam === 'ghost' ? 1.5 : 0;
  }

  /* ---------- 四期: 家传技能 tick 族(快照→意图信封) ----------
     统一信封(键可缺省): writes=字段直写表 · tint=持久色(白名单) ·
     buff/buffT=按 id 清单群体写 rageBuffT · shock=冲击波 AoE 参数(壳施放) ·
     tp/steerYaw=瞬移(壳走 Mobs 意图 API) · fx/sfx=观感标签(参数表在壳,
     决策不进 core)。返回 null=本拍无事。 */

  /* 僵尸一家·狂暴(家传): 血量触发(精英 70%/基础 50%), 自身加速+攻速,
     附近同族群体冲锋(跨阵营都吃 — 原口径照搬); 王者附冲击波(shock 只报
     参数, 壳调 aoeDamage + Fx.pop; fx 标签只在王者分支挂) */
  function rageTick(snap, roster) {
    if (snap.raged || snap.hp >= snap.maxHp*(snap.level>=2 ? 0.7 : 0.5)) return null;
    const buffT = snap.level>=3 ? 5 : 4;
    const rr = snap.level>=2 ? 9 : 6;
    const buff = [];
    for (const t of roster) {
      if (t.id !== snap.id && t.mfam === 'zombie_line' && !t.dead && !t.gone &&
         Math.hypot(t.x-snap.x, t.z-snap.z) < rr) buff.push(t.id);
    }
    const it = {writes: {raged: true}, tint: [1.4, 0.5, 0.5], buff, buffT, sfx: 'roar'};
    if (snap.level >= 3) { // 王者·狂暴冲击波
      it.fx = 'rage';
      it.shock = {x: snap.x, y: snap.y, z: snap.z, r: 5, dmg: 10*snap.dmgMult,
        fallOff: 0.5, kpow: 1.2, stagger: 0.8, dyGate: 4};
    }
    return it;
  }

  /* 虫虫族·疾爬突进(家传): 距目标 3~10 格短促加速贴脸(1.1s ×1.8),
     冷却 6s/精英 4.5s */
  function burstTick(snap) {
    if (snap.burstCd > 0 || snap.burstT > 0) return null;
    const tg = snap.target;
    if (!tg || tg.dead || tg.gone) return null;
    const d = Math.hypot(tg.x-snap.x, tg.z-snap.z);
    if (d < 3 || d > 10) return null;
    return {writes: {burstCd: snap.level>=2 ? 4.5 : 6, burstT: 1.1}, fx: 'burst'};
  }

  /* 猪猪一家·蛮冲(家传): 距目标 3~9 格发起直线冲刺(0.8s ×2.2), 撞到第
     一个敌人重击+大击退+硬直(撞击结算在壳的 moveMelee 蛮冲分支,
     chargeYaw 在起手瞬间锁定) */
  function chargeTick(snap) {
    if (snap.chargeT > 0 || snap.chargeCd > 0) return null;
    const tg = snap.target;
    if (!tg || tg.dead || tg.gone) return null;
    const d = Math.hypot(tg.x-snap.x, tg.z-snap.z);
    if (d < 3 || d > 9) return null;
    return {writes: {chargeCd: snap.level>=2 ? 5 : 7, chargeT: 0.8,
      chargeYaw: Math.atan2(tg.x-snap.x, tg.z-snap.z)}, fx: 'charge', sfx: 'roar'};
  }

  /* 守卫组·磐石(家传): 血量跌破 40% 进入坚守 3s(受伤减半, 结算在壳的
     damageMob), 冷却 12s/精英 9s */
  function guardTick(snap) {
    if (snap.stoneCd > 0 || snap.stoneT > 0 || snap.hp >= snap.maxHp*0.4) return null;
    return {writes: {stoneT: 3, stoneCd: snap.level>=2 ? 9 : 12}, fx: 'guard', sfx: 'roar'};
  }

  /* 末影人·颤栗瞬移(个体特化): 距目标 8 格外闪现贴身(目标旁 2.5~3.5 格,
     场内圆钳制 rIn-1.5), 冷却 5s/精英 3.5s; rand 注入(缺省 Math.random,
     角度+半径两掷); Mobs.setPos/settle/steer 与两次 Fx.pop 留壳 */
  function blinkTick(snap, roster, dt, rand) {
    if (snap.tpCd > 0) return null;
    const tg = snap.target;
    if (!tg || tg.dead || tg.gone) return null;
    if (Math.hypot(tg.x-snap.x, tg.z-snap.z) < 8) return null;
    const r = rand || Math.random;
    const a = r()*Math.PI*2; const rr = 2.5 + r();
    let nx = tg.x + Math.sin(a)*rr; let nz = tg.z + Math.cos(a)*rr;
    const cdx = nx-ARENA.cx; const cdz = nz-ARENA.cz; const cd = Math.hypot(cdx, cdz);
    if (cd > ARENA.rIn-1.5) {
      const k = (ARENA.rIn-1.5)/cd; nx = ARENA.cx+cdx*k; nz = ARENA.cz+cdz*k;
    }
    return {writes: {tpCd: snap.level>=2 ? 3.5 : 5}, tp: {x: nx, z: nz},
      steerYaw: Math.atan2(tg.x-nx, tg.z-nz), sfx: 'hit'};
  }

  /* ---------- 四期: 晋升数值半 + 击杀结算决策半 ---------- */

  /* 晋升数值半: lv → 下一档意图 {level, hpMult, dmgMult, invulnT, tierScale,
     labelScale}(体型/名牌放大原在 applyTierVisual, 数值半在此收口);
     heal 的基数是 setMaxHp 之后的新上限, 由壳按 m.maxHp 算 —
     applyTierVisual/levelUpFx/toast 观感半留壳 */
  function levelUpIntent(level) {
    const lv = level + 1;
    return {level: lv, hpMult: TIER_MULT[lv].hp, dmgMult: TIER_MULT[lv].dmg, invulnT: 0.5,
      tierScale: lv === 2 ? 1.3 : 1.6, labelScale: lv === 3 ? 1.5 : 1.25};
  }

  /* 击杀结算决策半: killerSnap=null 或 {id,team,dead,gone}, victimTeam,
     roster=候选快照, fracs={killer,other} 双方总血量占比(壳用 teamHpFrac
     算好), rand 注入 — 返回 {mult, credit, creeperPickId?}: credit=击杀方
     应得信用(0=不给: 非敌对/阵亡/无击杀者), creeperPickId=苦力怕特权的
     转投对象(每击杀随机挑一只存活敌队苦力怕分半信用, 避免全群同步晋升;
     无候选时缺省)。kills 入账/连跳/toast 留壳(addKillCredit) */
  function awardKillPlan(killerSnap, victimTeam, roster, fracs, rand) {
    const r = rand || Math.random;
    const mult = comebackMult(fracs.killer, fracs.other);
    const k = killerSnap;
    const credit = (k && k.team !== victimTeam && !k.dead && !k.gone) ? mult : 0;
    const creeps = [];
    for (const c of roster) {
      if (c.id !== (k && k.id) && c.type === 'creeper' && c.team !== victimTeam &&
         !c.dead && !c.gone) creeps.push(c.id);
    }
    const out = {mult, credit};
    if (creeps.length) out.creeperPickId = creeps[Math.floor(r()*creeps.length)];
    return out;
  }

  /* ---------- 四期: 技能表(声明式) + 分发 ----------
     表内 tick 直引 core 函数(同 IIFE 词法域, 无加载序问题);
     蓄力激光(守卫者系)以 laser:true 旗标表达 — tickLaserCharge 拍板
     永久留壳(状态机×三类意图×观感交织, 见壳内头注释), 壳查旗标施放。 */
  const MOB_QUIRKS = {
    guardian: {laser: true}, // 特化=蓄力激光(守卫者)
    elder_guardian: {laser: true}, // 特化=蓄力激光(远古守卫者, 威慑咆哮三期补)
    enderman: {tick: blinkTick}, // 特化=颤栗瞬移(鬼一族成员, 瞬移是末影人个性不是全族的)
  };
  /* 主族折算(家传发放单位); familySkill:false 可声明个体豁免("族给默认值、个体可覆盖") */
  function familyMain(type) {
    const q = MOB_QUIRKS[type];
    if (q && q.familySkill === false) return null;
    return ((MOB_TYPES[type] || {}).family || [])[0] || null;
  }
  const FAMILY_SKILLS = {
    zombie_line: {name: '狂暴', tick: rageTick},
    skeleton_line: {name: '强力节奏', tick: null}, // 节拍型: 射击/挥击处直接读族(节奏两件 volleyDiv/skeletonHeavySwing)
    arthropod: {name: '疾爬突进', tick: burstTick},
    pig_line: {name: '蛮冲', tick: chargeTick},
    ghost: {name: '阴风', tick: null}, // 命中型: ghostChill 在 damageMob 的 src 判定
    guard: {name: '磐石', tick: guardTick},
    illager: {name: '袭击协同', tick: raidTick},
    slime_line: {name: '分裂', tick: null, onDead: splitReq},
  };
  /* 技能分发(单条目): 调 entry.tick(统一签名 snap/roster/dt/rand)返回意图;
     查表(家传按主族 + 个体特化按种类, 两处挂点)与意图落回归壳 */
  function familyTick(entry, snap, roster, dt, rand) {
    return entry && entry.tick ? entry.tick(snap, roster, dt, rand) : null;
  }
  /* 亡语分发: onDead 条目(现只有软软族·分裂)吃 (snap, aliveCount) 返回
     延迟队列条目; 落场(flushSplits)留壳 */
  function familyOnDead(mfam, snap, aliveCount) {
    const fs = FAMILY_SKILLS[mfam];
    return fs && fs.onDead ? fs.onDead(snap, aliveCount) : null;
  }

  return {ARENA, HOTBAR, ARENA_POWER, ID_GRASS, ID_STONE, ID_COBBLE, ID_BRICK, ID_MOSS,
    ID_BLUEWOOL, ID_REDWOOL, ID_QUARTZ, ID_GLASS, ID_LAMP, TIER_MULT, TIER_NAME, COUNTER,
    FLY_KNOCK_R, FLY_ORBIT_R, MAX_MOBS, angleLerp, mobSpeed, tierStars, tierHot,
    comebackMult, fusingCreeperNear,
    floorBlock, wallBlock, generate, mixPool, mixAvgPower, mixBuckets, pickMix,
    unitPower, teamPower, balanceTeams, promoThresholds, killCredit, teamHpFrac,
    retarget, raidTick, splitReq, decayTimers, battleEnd, volleyDiv, skeletonHeavySwing,
    ghostChill,
    rageTick, burstTick, chargeTick, guardTick, blinkTick, levelUpIntent, awardKillPlan,
    FAMILY_SKILLS, MOB_QUIRKS, familyMain, familyTick, familyOnDead};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ArenaCore;
