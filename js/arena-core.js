'use strict';
/* ============================================================
   竞技场核心 (ArenaCore) — 应用层·纯核心
   ------------------------------------------------------------
   竞技场模式的政策与数值段纯核心(js/modes/arena.js 的纯段剥出,
   先例: world→mesh-core / tank→tank-core / mobs→mob-core /
   adventure→adventure-core)。一期: 常数表(几何/战力/档位/克制/选块)与
   叶子纯函数(角度插值/移速修正/星级/翻盘系数/苦力怕合体探测);
   二期: 参数化即纯段——配平三件套/晋升阈值公式/击杀信用判定半/
   队伍血量占比/编队池构造与抽取/地形段; 技能 tick 族/索敌后续票迁入。
   壳(战斗编排/THREE·DOM 观感/技能 tick/索敌权重/配平 UI 与状态)留在
   js/modes/arena.js, 在本文件之后加载并经共享词法环境消费。
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
     wallBlock·generate(地形段)
   依赖(全局名): WORLD_W/WORLD_D(config.js)加载期求 ARENA 几何 ·
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
  const TIER_MULT = {2: {hp: 1.6, dmg: 1.4, spd: 1.1}, 3: {hp: 2.5, dmg: 2.0, spd: 1.2}};
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

  return {ARENA, HOTBAR, ARENA_POWER, ID_GRASS, ID_STONE, ID_COBBLE, ID_BRICK, ID_MOSS,
    ID_BLUEWOOL, ID_REDWOOL, ID_QUARTZ, ID_GLASS, ID_LAMP, TIER_MULT, TIER_NAME, COUNTER,
    FLY_KNOCK_R, FLY_ORBIT_R, MAX_MOBS, angleLerp, mobSpeed, tierStars, tierHot,
    comebackMult, fusingCreeperNear,
    floorBlock, wallBlock, generate, mixPool, mixAvgPower, mixBuckets, pickMix,
    unitPower, teamPower, balanceTeams, promoThresholds, killCredit, teamHpFrac};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ArenaCore;
