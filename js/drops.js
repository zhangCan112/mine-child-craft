'use strict';
/* ============================================================
   掉落物实体库 (Drops, 术语见 GLOSSARY.md — 词条随 T16 收尾合入) — 引擎层
   ------------------------------------------------------------
   全游戏唯一的掉落物实体模块(探险挖掘与巢穴战斗共用):
   · 掷骰: rollDrops 读 config.js 的 MOB_DROPS(保底必得, 再以 50% 掷
     「加成次数」次, rare 独立掷骰) · rollBlockDrop 读 BLOCKS.drop 三元组
     [itemId, 保底, 概率](概率=额外再得 1 个的几率) — 掷骰语义在此, 表只存数据
   · 拾取判定: pickupCheck 三维距离 — <=0.6 收集 · <=2.5 真空吸附
   · 壳段实体生命周期: 落地弹跳一次 → 贴地浮动+缓旋 → 2.5 格内加速飞向
     玩家 → 0.6 格触发收集回调 → 3 分钟到期静默消失; 贴图 emoji canvas
     Sprite 过渡, 运行时存在全局 iconOf(T8 的 icons.js 将提供)则优先用
     像素图 dataURL, 否则 emoji 兜底(本模块不定义 iconOf, 只消费)
   interface: rollDrops(type, rand?) · rollBlockDrop(blockDef, rand?) ·
              pickupCheck(dropPos, playerPos) · resolveIcon(itemId) /
              Drops.spawn(itemId, n, x, y, z) · Drops.update(dt, playerPos) ·
              Drops.render · Drops.clear · Drops.list · Drops.onCollect(cb)
   依赖(均经全局名, 调用期解析): config.js 的 MOB_DROPS(+测试交叉断言用
     BLOCKS/MOB_TYPES) · items-core.js 的 ITEMS(resolveIcon 兜底) ·
     world.js 的 scene/groundTop · THREE/DOM(壳段惰性创建) ·
     可选全局 iconOf(icons.js, 不存在则 emoji 兜底)
   可测性: 顶层纯函数段零 THREE·零 DOM(vm 直测, test/drops.test.js);
     壳段 THREE/DOM 惰性创建, 无桩环境 spawn 不建 Sprite、实体逻辑照跑
   ============================================================ */

/* ---------- 顶层纯函数段(零 THREE 零 DOM) ---------- */

/* 怪物掉落掷骰: 读 MOB_DROPS, 返回 [{id, n}] 供模式层逐条 spawn。
   取数顺序 = rolls 逐条(先落保底, 再掷 extraMax 次 50% 加成, 每中一次 +1),
   之后 rare 逐条(rand < 概率额外掉 1 个, 与加成掷互不相干) — 种子化测试
   依赖此顺序。未收录怪种返回 [](不掉落, 不抛错: 掉落表没写就是没有)。
   rand 可注入随机源(缺省 Math.random)。 */
function rollDrops(type, rand) {
  rand = rand || Math.random;
  const out = [];
  const tbl = MOB_DROPS[type];
  if (!tbl) return out;
  for (const entry of (tbl.rolls || [])) {
    const id = entry[0];
    let n = entry[1];
    for (let i = 0; i < entry[2]; i++) {
      if (rand() < 0.5) n++;
    }
    if (n > 0) out.push({id, n});
  }
  for (const entry of (tbl.rare || [])) {
    if (rand() < entry[1]) out.push({id: entry[0], n: 1});
  }
  return out;
}

/* 方块掉落掷骰: BLOCKS.drop 条目 [itemId, 保底, 概率] — n = 保底 + (rand <
   概率 ? 1 : 0), 概率=额外再得 1 个的几率(设计稿 §3.4; rand=0 且概率=0
   也不加成)。无 drop 字段(创造专属)/裸定义/null → 空数组。 */
function rollBlockDrop(blockDef, rand) {
  rand = rand || Math.random;
  const out = [];
  if (!blockDef || !blockDef.drop) return out;
  for (const entry of blockDef.drop) {
    const n = entry[1] + (rand() < entry[2] ? 1 : 0);
    if (n > 0) out.push({id: entry[0], n});
  }
  return out;
}

/* 拾取判定半径(格, 设计稿 D6): 2.5 内真空吸附 · 0.6 内收集 */
const PICKUP_PULL_R = 2.5;
const PICKUP_COLLECT_R = 0.6;

/* 拾取距离判定: 三维距离(掉落物中心到玩家给定点) → 'collect' | 'attract'
   | 'far'(两档半径都含等号)。壳段 update 每帧调用, 判定权威只此一份。 */
function pickupCheck(dropPos, playerPos) {
  const d = Math.hypot(dropPos.x - playerPos.x, dropPos.y - playerPos.y, dropPos.z - playerPos.z);
  if (d <= PICKUP_COLLECT_R) return 'collect';
  if (d <= PICKUP_PULL_R) return 'attract';
  return 'far';
}

/* 掉落物贴图来源: 运行时存在全局 iconOf(T8 的 icons.js)则优先取其
   dataURL({url}); 否则读 ITEMS[id].icon emoji 兜底({emoji}), 未注册物品
   给 ❓。本模块不定义 iconOf — 它是 T8 的统一出口, 引擎只消费。 */
function resolveIcon(itemId) {
  if (typeof globalThis.iconOf === 'function') {
    const url = globalThis.iconOf(itemId);
    if (typeof url === 'string' && url) return {url};
  }
  const it = ITEMS[itemId];
  return {emoji: (it && it.icon) || '❓'};
}

/* ---------- 壳段: 实体生命周期(THREE/DOM 惰性创建) ---------- */
const Drops = (() => {
  const live = []; // 实例数组归本模块私有, list() 只读约定(同 Mobs)
  const collectCbs = [];
  /* 物理常量(格/秒): 重力 18 · 弹跳初速 1.9 · 悬浮离地 0.35(地面怪站线
     groundTop+1 之上) · 吸附起步 2.5/加速度 30/封顶 10(越飞越快) ·
     浮动角频 2.4 振幅 0.06 · 缓旋角速 0.9 · 寿命 180s(3 分钟) ·
     拒收冷却 1.2s(背包满停在地上, 冷却后再试) */
  const GRAV = 18; const BOUNCE_V = 1.9; const HOVER = 0.35;
  const PULL_V0 = 2.5; const PULL_ACC = 30; const PULL_MAX = 10;
  const BOB_W = 2.4; const BOB_A = 0.06; const SPIN_W = 0.9;
  const LIFE = 180; const REJECT_CD = 1.2; const SPRITE_SIZE = 0.55;

  /* 悬浮线 = 脚下最高实心方块顶(groundTop+1)再抬 HOVER(贴地浮动) */
  function restYAt(x, z) {
    return groundTop(Math.floor(x), Math.floor(z)) + 1 + HOVER;
  }

  /* ---------- 贴图: 按物品缓存共享(emoji 先上屏, 像素图就绪后换脸) ---------- */
  const texCache = {};
  function texFor(itemId) {
    if (texCache[itemId]) return texCache[itemId];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '44px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const src = resolveIcon(itemId);
    g.fillText(src.emoji || '❓', 32, 34); // 像素图路径下先画占位, 图到即覆画
    const tex = new THREE.CanvasTexture(cv);
    if (src.url) { // T8 像素图: 载入后覆画同一画布, 全部实例共享贴图自动换脸
      const img = document.createElement('img');
      img.onload = () => {
        g.clearRect(0, 0, 64, 64);
        g.drawImage(img, 0, 0, 64, 64);
        tex.needsUpdate = true;
      };
      img.src = src.url;
    }
    texCache[itemId] = tex;
    return tex;
  }

  function mountSprite(d) {
    const mat = new THREE.SpriteMaterial({map: texFor(d.id), transparent: true});
    d.sprite = new THREE.Sprite(mat);
    d.sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1);
    scene.add(d.sprite);
  }
  function unmount(d) {
    if (!d.sprite) return;
    scene.remove(d.sprite);
    d.sprite.material.dispose(); // 贴图按物品缓存共享, 不随实例销毁
    d.sprite = null;
  }

  /* 出生: 从击杀碎块里「蹦出来」— 随机水平散布 + 小上抛, 落地弹跳一次 */
  function spawn(itemId, n, x, y, z) {
    const a = Math.random() * Math.PI * 2;
    const d = {
      id: itemId, n: Math.max(1, n || 1),
      x, y, z,
      vx: Math.cos(a) * (0.4 + Math.random() * 0.8),
      vz: Math.sin(a) * (0.4 + Math.random() * 0.8),
      vy: 2.6,
      grounded: false, bounced: false,
      age: 0, phase: Math.random() * 6, spin: Math.random() * Math.PI * 2,
      pullV: 0, rejectT: 0, gone: false, sprite: null,
    };
    if (typeof THREE !== 'undefined' && typeof document !== 'undefined' &&
        typeof scene !== 'undefined') {
      mountSprite(d); // 引导桩/Node 测试环境不建观感, 实体逻辑照跑
    }
    live.push(d);
    return d;
  }

  /* 下落: 重力 + 首次触地弹起(BOUNCE_V), 第二次触地静止归位 */
  function fallStep(d, dt) {
    d.vy -= GRAV * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.z += d.vz * dt;
    const ry = restYAt(d.x, d.z);
    if (d.y <= ry && d.vy < 0) {
      d.y = ry;
      if (!d.bounced) {
        d.bounced = true;
        d.vy = BOUNCE_V;
        d.vx *= 0.4;
        d.vz *= 0.4; // 弹跳损耗水平散布, 落点收敛
      } else {
        d.grounded = true;
        d.vy = 0;
        d.phase = 0;
      }
    }
  }

  /* 真空吸附: 加速飞向玩家(途中不再受重力/浮动); 一帧跨过玩家就贴身待收
     (防大步长绕轨穿越) */
  function pullStep(d, p, dt) {
    const dx = p.x - d.x; const dy = p.y - d.y; const dz = p.z - d.z;
    const dist = Math.hypot(dx, dy, dz) || 1e-9;
    d.pullV = Math.min(PULL_MAX, (d.pullV || PULL_V0) + PULL_ACC * dt);
    const step = d.pullV * dt;
    if (step >= dist) {
      d.x = p.x; d.y = p.y; d.z = p.z;
    } else {
      d.x += dx / dist * step;
      d.y += dy / dist * step;
      d.z += dz / dist * step;
    }
  }

  /* 收集: 逐回调报 (itemId, n); 任一回调显式返回 false = 拒收(背包满,
   D6 政策在模式层) → 掉落物停在地上进冷却, 冷却结束再试 */
  function collect(d) {
    let rejected = false;
    for (const cb of collectCbs) {
      if (cb(d.id, d.n) === false) rejected = true;
    }
    if (rejected) {
      d.rejectT = REJECT_CD;
      return;
    }
    d.gone = true;
    unmount(d);
  }

  /* 通用本能(每帧): 寿命 → 拾取意图(判定权威 pickupCheck) → 吸引/物理。
     playerPos {x,y,z} 由模式层喂(建议玩家胸口点), 缺省只做物理 */
  function update(dt, playerPos) {
    for (const d of live) {
      if (d.gone) continue;
      d.age += dt;
      if (d.rejectT > 0) d.rejectT -= dt;
      d.spin += dt * SPIN_W;
      if (d.age > LIFE) { // 3 分钟到期: 静默消失(不是收集, 不触发回调)
        d.gone = true;
        unmount(d);
        continue;
      }
      const pick = (playerPos && d.rejectT <= 0) ? pickupCheck(d, playerPos) : 'far';
      if (pick === 'collect') {
        collect(d);
        continue;
      }
      if (pick === 'attract') {
        pullStep(d, playerPos, dt);
        continue;
      }
      d.pullV = 0;
      if (!d.grounded) {
        fallStep(d, dt);
      } else {
        const ry = restYAt(d.x, d.z);
        if (ry < d.y - 0.3) { // 脚下方块被挖走 → 重新下落
          d.grounded = false;
          d.vy = 0;
        } else {
          d.phase += dt * BOB_W;
          d.y = ry + Math.sin(d.phase) * BOB_A; // 贴地浮动(缓旋在 render 施加)
        }
      }
    }
    for (let i = live.length - 1; i >= 0; i--) {
      if (live[i].gone) live.splice(i, 1);
    }
  }

  /* 观感同步: 实体位置/缓旋 → Sprite(无观感环境为 no-op) */
  function render() {
    for (const d of live) {
      if (!d.sprite) continue;
      d.sprite.position.set(d.x, d.y, d.z);
      d.sprite.material.rotation = d.spin;
    }
  }

  function onCollect(cb) {
    collectCbs.push(cb);
  }
  function list() {
    return live;
  }
  /* 清场: 回收全部观感并解除收集回调(与 Mobs.clear 同口径 —
     切模式页时旧模式的闭包不残留到新场景) */
  function clear() {
    for (const d of live) unmount(d);
    live.length = 0;
    collectCbs.length = 0;
  }

  return {spawn, update, render, clear, list, onCollect,
    rollDrops, rollBlockDrop, pickupCheck, resolveIcon};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Drops;
