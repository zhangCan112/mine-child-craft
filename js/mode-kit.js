'use strict';
/* ============================================================
   ModeKit — 应用层 shell 服务 (术语见 GLOSSARY.md)
   ------------------------------------------------------------
   mkMode(cfg) 深接口(四模式壳样板收编): chrome{score,hotbar} 进模式
   施加 DOM 显隐(cleanup 无需还原) · hotbar(mkHotbar 实例, digit/wheel/
   点选选块全自动) · hud(hit)→string[] 每帧 HUD 文本(命中由主循环注入,
   模式不再自行 raycast) · touch(Input.setActions 声明, 缺省=null 隐藏) ·
   onHold(触屏长按起止钩子, 手势分类在 input.js/touch-core) ·
   onPageHide(关页兜底存档钩子, main.js pagehide 白名单透传) · KeyB 默认
   暂停 · 无 hud 配置清空跳过 · onVoidFall 默认回最近出生点; 工具
   spawn(对外经 ModeKit.spawn)/lookName/confirmBtn。
   面板族(共骨架——内部底座 mkPanelShell 收编遮罩/头/✕/背包格区/Esc/
   生命周期; refresh 语义统一=重画内容不碰开合态; 三面板同吐 cellAt
   只读查询面; 图标/格子/chip 渲染单份收口 kitIconHtml/kitCellHtml/
   kitChipHtml): mkCraftPanel(3×3 摆放台站点外锁外圈+配方卡一键摆入+
   产出槽点击一发/长按连做, 交互语义权威 docs/crafting-grid-design.md
   §5) · mkFurnacePanel(三槽+进度条+燃料余量条, 常驻背包区手动放料/
   点击报意图回调, docs/furnace-design.md F2) · mkChestPanel(大宝箱,
   政策与存档在模式层回调, 顶格档隐藏扩容行)。
   其余构件: mkHotbar 第三槽型 {item:id}(像素图标+右上数量+底部耐久条) ·
   mkMainAct/mkHeldSync(手持感知五件套, 评审候选 6: 调色板+'shovel'
   哨兵槽+Avatar.setItem+主动作键图标切换) · mkMobPicker(选怪按钮族:
   Mobs.face 头像+families() 谱系分组+active 高亮, 差异全经 opts) ·
   mkBubbleBar(溺气 HUD 10 泡像素条, 液体 D10) · sortInv(主格区同项
   合并, 快捷栏不动) · editHit(挖/放编辑原语)/mkHoldMine(触屏按住连挖
   驱动)——两件全部交互期调用, 精简装载的 Node 单测不触发即不依赖 ·
   物品提示装配(话术唯一权威在 item-hint-registry.js; 触发点=选槽/
   三面板格子点击/灰配方卡点击, kitHint 气泡 3.2s 淡出+SpeechKit,
   设计定稿 docs/item-hint-design.md)。
   引擎层(world/input)对本文件零依赖; 本文件属应用层。
   interface: mkMode · mkHotbar · mkMainAct · mkHeldSync(手持感知同步件) ·
              mkMobPicker(选怪按钮组) · mkCraftPanel · mkFurnacePanel ·
              mkChestPanel(三者=内部底座 mkPanelShell+差异段, 均含 cellAt
              查询面) · sortInv · spawn · lookName · confirmBtn ·
              editHit(挖/放编辑原语) · mkHoldMine(触屏按住连挖驱动)
   依赖(均经全局名, 调用期解析): items-core 的 ITEMS/toolOf/stackMax/durOf ·
     inventory-core 的 HOTBAR_SLOTS/costEntry/remove/add · craft-core 的
     RECIPES/canCraft/matchGrid/gridCraft/fillGrid/FUEL/fuelUnits/smeltOf ·
     mobs 的 Mobs(mkMobPicker 的分组唯一入口 families() 与 face/types,
     mkMode 的触屏声明走 input 的 Input.setActions — 缺装时回落过渡别名) ·
     avatar 的 Avatar 与 input 的 Input(mkHeldSync 的同步面, 均经
     typeof 守卫: 精简装载的 Node 单测可缺装, 静默跳过) ·
     world 的 editBlock/getBlock/camera 与 voxel 的 collidesAtPlayer/
     raycastVoxel · camera-rig 的 CameraRig · config 的 PLAYER ·
     effects 的 showToast(editHit 底层守卫话术, 经 typeof 守卫)——
     editHit/mkHoldMine 两件(2026-10-26 建造/竞技场镜像收编)全部
     交互期调用, 精简装载的 Node 单测不触发即不依赖 ·
     icons 的 iconOf 与
     button-icons 的 btnImg/BTN_PIX(两者加载序在本文件之后, 但全部
     调用发生在用户交互期, 彼时已加载完毕) · item-hint-registry 的
     hintForItem/hintForSlot 与 speech 的 SpeechKit(后两者经 typeof 守卫:
     精简装载的 Node 单测可缺装, 静默无提示 — 先例 math-world 守卫)
   可测性: DOM 惰性创建(doc 可注入), Node 单测注入假 document
     (test/mode-kit.test.js); mkHpBar 的 THREE/DOM 惰性创建,
     Node 无渲染环境时 update/dispose 静默跳过(不参与行为断言)
============================================================ */

const MK = (typeof document !== 'undefined') ?
  {hotbar: document.getElementById('hotbar'),
    score: document.getElementById('score'),
    hud: document.getElementById('hud')} :
  {hotbar: null, score: null, hud: null}; // Node 测试环境

/* ---------- 出生点: 设置玩家状态并记住, 供默认 onVoidFall 兜底 ----------
   (内部名 kitSpawn: 不占用共享全局里最裸的 spawn 一词, 经 ModeKit.spawn 对外) */
let mkLastSpawn = null;
function kitSpawn(x, y, z, o) {
  o = o || {};
  pos.set(x, y, z);
  vel.set(0, 0, 0);
  yaw = o.yaw || 0;
  pitch = o.pitch || 0;
  onGround = false;
  mkLastSpawn = {x, y, z, yaw: o.yaw || 0, pitch: o.pitch || 0};
}

/* "注视"方块名 — arena/build 两处重复的查询 */
function lookName(hit) {
  if (!hit) return '无';
  const id = getBlock(hit.x, hit.y, hit.z);
  return BLOCKS[id] ? BLOCKS[id].name : '?';
}

/* ---------- 物品提示(ItemHint): 点到什么读什么 — 装配缝 ----------
   话术与三型槽解析的唯一权威在 item-hint-registry.js; 本段只做装配:
   ① 解析经全局名 + typeof 守卫(精简装载的 Node 单测里注册表可能未加载
      → 静默无提示, 先例 math-world 的 SpeechKit 守卫);
   ② 气泡 = 单例 div.hint-bubble 挂 body(名字金色大字 + 说明白色小字,
      3.2s 淡出; z-index 高于面板遮罩, 面板开着也可见 —— 与 #toast 两条
      通道互不抢占: toast 承载系统消息, 气泡承载物品认知);
   ③ 语音经 SpeechKit(自带 cancel-then-speak 与 BGM 让路, 守卫同①)。 */
let kitHintEl = null; let kitHintDoc = null; let kitHintT = 0;
function kitHintSlot(it) {
  return (typeof hintForSlot === 'function') ? hintForSlot(it) : null;
}
function kitHintItem(id) {
  return (typeof hintForItem === 'function') ? hintForItem(id) : null;
}
function kitHint(h, doc) {
  if (!h) return;
  if (doc && doc.body) {
    if (!kitHintEl || kitHintDoc !== doc) {/* 单例: 换 doc(测试环境)才重建 */
      kitHintEl = doc.createElement('div');
      kitHintEl.className = 'hint-bubble';
      kitHintEl.style.opacity = 0;
      doc.body.appendChild(kitHintEl);
      kitHintDoc = doc;
    }
    kitHintEl.innerHTML = '<b>' + h.name + '</b>' + (h.desc ? '<i>' + h.desc + '</i>' : '');
    kitHintEl.style.opacity = 1;
    clearTimeout(kitHintT);
    kitHintT = setTimeout(()=> {
      if (kitHintEl) kitHintEl.style.opacity = 0; /* 3.2s 淡出(CSS transition) */
    }, 3200);
  }
  if (typeof SpeechKit !== 'undefined' && SpeechKit) SpeechKit.speak(h.tts);
}

/* ---------- 主动作键智能分派(2026-10-24 用户拍板: 手持感知) ----------
   规则全模式统一: placeable() 为真(手持可放置物) → 放置一次并返 false
   (input.js 据此不进 onHold 连发 — 一按一放, 防误连放); 其余(空手/工具/
   武器/食物/材料) → 挖/打起步走 aimClick(0), 返 undefined 进按住连挖。
   MC 口径同构: 拿方块点哪放哪、空手/工具按哪挖哪(docs/mc-touch-controls-
   research.md §3.9; 手持分派详见 docs/touch-controls-design.md §3.2) */
function mkMainAct(placeable) {
  return () => {
    if (placeable()) {
      aimClick(2);
      return false;
    }
    aimClick(0);
  };
}

/* ---------- mkHeldSync: 手持感知同步件(评审候选 6, 跨模式样板收编) ----------
   竞技场与建造逐字镜像的五件套样板(调色板数组 + 'shovel' 哨兵槽渲染铁锹
   物品图标 + typeof number 手持判定 + Avatar.setItem 同步 + 主动作键图标
   切换 镐/铲↔砖块)收编一处, 两消费方均已接入。
   调色板形状: 数字=方块槽(可放置), 哨兵串('shovel')=挖掘入口槽;
   哨兵语义与判定逻辑藏在本实现, 消费方只见三个纯问题:
     isBlock()  选中槽是否可放置方块
     itemId()   方块数字 id(哨兵槽 → null, 铁锹物品映射不外泄)
     sync()     手持观感对齐选中槽(Avatar 换物 + 主动作键图标随手持切换)
   Avatar/Input 均经 typeof 守卫(精简装载的 Node 单测可缺装, 静默跳过)。 */
function mkHeldSync(palette, hb) {
  const SENTINEL_ITEM = 'shovel_iron'; /* 哨兵槽的手持物: 铁锹(工具 def 现成) */
  function isBlock() {
    return typeof palette[hb.sel] === 'number';
  }
  function itemId() {
    return isBlock() ? palette[hb.sel] : null;
  }
  function sync() {
    if (typeof Avatar !== 'undefined' && Avatar) {
      Avatar.setItem(isBlock() ? palette[hb.sel] : SENTINEL_ITEM);
    }
    if (typeof Input !== 'undefined' && Input && typeof Input.refreshMain === 'function') {
      Input.refreshMain(isBlock() ? 'brick' : 'shovel', isBlock() ? '放置' : '挖掘');
    }
  }
  return {isBlock, itemId, sync};
}

/* ---------- editHit: 挖/放编辑原语(2026-10-26 建造/竞技场镜像收编) ----------
   button 0=挖(世界底层 y0 保护: 挖穿=坠出世界, 儿童话术提示; 原建造私有
   守卫升格共享——竞技场补齐, 两模式同口径) · 2=放置(手持感知 placeId +
   目标格空置 + 不与玩家碰撞三重守卫, 沿命中面法线落位; 命中 replaceable
   薄块(花草/火把, config 旗标)例外——落点=被点格本身直接盖掉, 镂空块
   贴着放悬空半格很出戏, 用户拍板 2026-10-28)。
   placeId() 返回可放置的方块数字 id(铲子槽/空手经 mkHeldSync.itemId
   天然返 null=无操作)。
   返回 {x, y, z, id, removed}(removed=editBlock 的级联清单)或 null
   (未发生编辑); 存档记账/掉落等模式政策留在消费方。 */
function editHit(button, hit, placeId) {
  if (!hit) return null;
  if (button === 0) {
    /* 世界底层保护(儿童口径, 建造既有守卫) */
    if (hit.y === 0) {
      if (typeof showToast === 'function') showToast('🪨 底层基岩挖不动哦');
      return null;
    }
    return {x: hit.x, y: hit.y, z: hit.z, id: 0,
      removed: editBlock(hit.x, hit.y, hit.z, 0)};
  }
  if (button === 2) {
    const id = placeId ? placeId() : null;
    if (id == null) return null; /* 手持不可放置: 无操作(MC 拿工具右键同构) */
    const hitId = getBlock(hit.x, hit.y, hit.z);
    const rep = !!(hitId !== 0 && BLOCKS[hitId] && BLOCKS[hitId].replaceable); /* 覆盖放置: 落点=被点格 */
    const x = rep ? hit.x : hit.x + hit.nx;
    const y = rep ? hit.y : hit.y + hit.ny;
    const z = rep ? hit.z : hit.z + hit.nz;
    if (!rep && getBlock(x, y, z) !== 0) return null; /* 目标格非空(覆盖时目标=被点格本身, 免此检) */
    if (collidesAtPlayer(x, y, z)) return null; /* 不把自己埋进去 */
    return {x, y, z, id, removed: editBlock(x, y, z, id)};
  }
  return null;
}

/* ---------- mkHoldMine: 触屏按住连挖驱动(2026-10-26 建造样板收编) ----------
   input.js 主动作键的 onHold(active) 起止 + 每帧 step(dt) 步进
   (250ms/块, 与桌面单击同路), 目标跟随准星(CameraRig.aim 长按期间被
   holdAim 覆盖=挖跟手); 命中空/世界底层静默跳过(单击仍有提示, 连挖
   不刷屏)。防误触不在连挖上加延迟: 长按需静止满 250ms 才成手势,
   门槛本身即防误触(docs/touch-controls-design.md §6)。
   fire(hit) 由消费方注入(通常=模式 onMouse(0, hit) 的挖路径);
   桌面不触发(hold 恒 false); 引擎件缺装(Node 单测)静默跳过。 */
function mkHoldMine(fire) {
  let on = false; let t = 0;
  return {
    hold(active) {
      on = active; t = 0; // 起止都复位: 下一轮从满 250ms 计起
    },
    step(dt) {
      if (!on) return;
      if (typeof CameraRig === 'undefined' || !CameraRig ||
          typeof raycastVoxel !== 'function' || typeof camera === 'undefined') return;
      t += dt;
      if (t < 0.25) return;
      t = 0;
      const aim = CameraRig.aim(camera);
      const hit = raycastVoxel(aim.origin, aim.dir, PLAYER.reach);
      if (!hit || hit.y === 0) return; /* 指空/底层: 静默等下一拍 */
      fire(hit);
    },
  };
}

/* ---------- hotbar: 三种槽型 {block:id} | {icon,lbl,cnt()} | {item:id}(T10) ----------
   cls:'build' 附加类名; cnt 为函数, refresh/show 时重读;
   item 型: 像素图标(iconOf 的 dataURL/emoji 二合一) + 右上数量(>1 才显) +
   底部耐久条(dur 访问器返 0..1 比, 模式层算 dur/toolOf(id).dur, 仅工具条目配) */
function mkHotbar(opts) {
  const o = opts || {};
  const doc = o.doc || document; // 可注入, 供 Node 单测
  const mount = o.mount || MK.hotbar;
  const items = o.items || [];
  let sel = 0;
  function render() {
    mount.innerHTML = '';
    mount.classList.toggle('build', o.cls === 'build');
    items.forEach((it, i)=>{
      const div = doc.createElement('div');
      div.className = 'slot';
      let html = '<span class="num">' + (i + 1 <= 9 ? i + 1 : '') + '</span>';
      if (it.block !== undefined) {
        const b = BLOCKS[it.block]; const col = (b.all || b.side);
        html += '<div class="cube" style="background:rgb(' + col.map((c)=>Math.round(c*255)).join(',') + ')"></div>' +
             '<span class="lbl">' + b.name + '</span>';
      } else if (it.item !== undefined) {
        /* 图标统一出口(kitIconHtml 小件): 像素图喂 img · emoji 喂 icon · '' 跳过 */
        html += kitIconHtml(it.item, 'pic', 'icon') +
             '<span class="cnt">' + ((it.cnt && it.cnt() > 1) ? it.cnt() : '') + '</span>' +
             (it.dur ? '<i class="dur"><i></i></i>' : '') + // 耐久条骨架, 宽/档位由 sync 填
             '<span class="lbl">' + (ITEMS[it.item] ? ITEMS[it.item].name : '') + '</span>';
      } else {
        html += '<span class="icon">' + it.icon + '</span>' +
             '<span class="cnt">' + (it.cnt ? it.cnt() : '') + '</span>' +
             '<span class="lbl">' + (it.lbl || '') + '</span>';
      }
      div.innerHTML = html;
      div.addEventListener('pointerdown', (ev)=>{
        ev.preventDefault(); select(i);
      });
      mount.appendChild(div);
    });
    sync();
  }
  function sync() {
    [...mount.children].forEach((c, i)=>{
      c.classList.toggle('active', i === sel);
      if (items[i] && items[i].cnt) {
        const raw = items[i].cnt() || 0;
        c.classList.toggle('empty', raw <= 0);
        const cntEl = c.querySelector('.cnt');
        if (cntEl) {
          cntEl.textContent = items[i].item === undefined ? raw : // 旧 icon 型原样(存量口径)
            (raw > 1 ? String(raw) : ''); // item 型单件不显数
        }
      }
      if (items[i] && items[i].dur) { // 耐久条实时重读: 宽=比值, 档位 绿/黄/红(D9 <25% 红)
        const fill = c.querySelector('.dur i');
        if (fill) {
          const r = Math.max(0, Math.min(1, items[i].dur() || 0));
          fill.style.width = Math.round(r * 100) + '%';
          fill.classList.toggle('bar-hi', r >= 0.5);
          fill.classList.toggle('bar-mid', r >= 0.25 && r < 0.5);
          fill.classList.toggle('bar-lo', r < 0.25);
        }
      }
    });
  }
  function select(i) {
    if (i < 0 || i >= items.length) return;
    sel = i;
    sync();
    /* 物品提示: 点选/数字键/滚轮统一走 select — 点到什么读什么;
       空槽(注册表判空)静默, 同格重点 = 再读一遍(孩子主动问的天然手势) */
    kitHint(kitHintSlot(items[i]), o.doc);
    if (o.onPick) o.onPick(i);
  }
  return {
    get sel() {
      return sel;
    },
    items,
    select,
    refresh: sync,
    render,
    show() {
      render(); mount.style.display = 'flex';
    },
    hide() {
      mount.style.display = 'none';
    },
  };
}

/* ---------- sortInv: 一键整理(D10 🧹) — 只压实主格区(槽 9~26), 快捷栏
   (0~8, 孩子摆好的手上格)不动; 主格内同项合并到堆叠上限·首现序稳定·
   工具耐久随堆保留·空槽压到主格尾部。就地修改并返回 inv;
   堆叠上限经 stackMax(items-core)。---------- */
function sortInv(inv) {
  const s = inv.slots;
  const order = []; // 首现序(稳定: 不按字母重排, 孩子找得到东西)
  const piles = {}; // id → 待合并堆列表
  for (let i = HOTBAR_SLOTS; i < s.length; i++) {
    if (!s[i]) continue;
    if (!piles[s[i].id]) {
      piles[s[i].id] = [];
      order.push(s[i].id);
    }
    piles[s[i].id].push(s[i]);
  }
  for (let i = HOTBAR_SLOTS; i < s.length; i++) s[i] = null; // 清空主格区待回填
  let i = HOTBAR_SLOTS;
  for (const id of order) {
    let n = 0; let dur;
    for (const p of piles[id]) {
      n += p.n;
      if (p.dur != null) dur = p.dur; // 工具(上限1)不跨堆, 保住耐久
    }
    const max = stackMax(id) || 1;
    while (n > 0 && i < s.length) {
      const put = Math.min(n, max);
      s[i] = {id, n: put};
      if (dur != null) s[i].dur = dur;
      n -= put; i++;
    }
  }
  return inv;
}

/* 一期不点亮的配方 id(T6 备注: 原料/用途归二期, 模式层过滤口径收在面板;
   bag_upgrade=大背包「只扩一次」门禁——模式层未扩容时经 allow 放开, 已扩容
   保持隐藏, 2026-10) */
const KIT_HIDDEN_RECIPES = ['bread', 'bone_meal', 'bow_item', 'bag_upgrade'];

/* 站点徽标(D8): table=工作台 furnace=二期烧炼站点配方预留 hand=无
   (设计稿 D8 定稿: 一期熔炉是走近点击的开面板交互, 非 station 门槛配方——
   furnace 键位为二期烧炼站点配方占位, 出处可溯而非泛泛「备用」);
   值 = 按钮像素图标键名(button-icons.js 工坊, 物品图委托 itemIcon) */
const KIT_STATION_BADGE = {table: 'table', furnace: 'furnace'};

/* 分类页签(D8): 图标式零文字; 图标键名在 button-icons.js 工坊
   (分类判据=产物(工具 toolOf/食物 food/方块 block),
    其余(材料)不归类 — 只在「全部」页出现) */
const KIT_TABS = [
  {key: 'all', icon: 'grid'},
  {key: 'tool', icon: 'pick'},
  {key: 'food', icon: 'apple'},
  {key: 'block', icon: 'brick'},
];

/* ---------- 面板族渲染小件: iconOf 二合一出口 → 图标/格子内容/材料 chip ----------
   渲染知识单份收口(原 hotbar/三面板七处誊写): 'data:' 前缀喂 img.src ·
   文本喂 icon span · '' 跳过; img 与 span 的 class 由调用方成对给出
   (格子 'pic'/icon · 卡片 'big'/icon big · chip 'mini'/icon mini —— 与
   CSS 观感契约对齐, 不设默认值) */
function kitIconHtml(id, imgCls, iconCls) {
  const ic = iconOf(id);
  return ic.startsWith('data:') ?
    '<img class="' + imgCls + '" alt="" src="' + ic + '">' :
    (ic ? '<span class="' + iconCls + '">' + ic + '</span>' : '');
}

/* 槽堆 → 格子内容 HTML(像素图/emoji 二合一 + 数量>1 才显); 空栈空串 */
function kitCellHtml(stack) {
  return stack ? kitIconHtml(stack.id, 'pic', 'icon') +
      (stack.n > 1 ? '<span class="cnt">' + stack.n + '</span>' : '') : '';
}

/* 材料 chip(配方卡缺料 / 宝箱扩容账单同观感): 比例模式(ratio 立显或缺料且
   有 have 数)显 have/need, 其余显 ×n; lack 附灰显类 */
function kitChipHtml(id, need, have, lack, ratio) {
  const b = (ratio || (lack && have != null)) ? '<b>' + have + '/' + need + '</b>' :
    '<b>×' + need + '</b>';
  return '<span class="mkp-chip' + (lack ? ' lack' : '') + '" data-id="' + id + '">' +
      kitIconHtml(id, 'mini', 'icon mini') + b + '</span>';
}

/* ---------- mkPanelShell — 面板族公共骨架的内部底座(评审候选 2, 不对外) ----------
   craft/furnace/chest 三面板誊写的公共骨架收编为一处: 遮罩/box/头部(标题+
   可选头钮+✕)/背包格区(18 主格+9 快捷镜像双循环)/格子渲染/Esc 与开合
   生命周期。DOM 组装序仍归各面板(头/背包区挂哪由面板自己 append), 底座
   只管创建与行为。
   cfg: doc(文档注入, Node 单测) · inv(背包引用, 背包区读数与 cellAt 查询)
        · boxCls(box 附加类, 如 'mkp-furnace') · headBtns(✕ 前的头钮
        [{cls, onClick}], craft 的整理钮) · onDrop(槽号→丢弃意图, 提供则
        加「丢弃」头钮——armed 态点背包格整摞扔出, 关面板/再点即收,
        docs/bag-and-drop-design.md §1) · onArm(丢弃态切换通知, craft
        收起手) · preClose(close 前置钩子, craft 退料收手) · onClose
        (✕/Esc 统一出口尾钩, 模式层做状态同步与回锁)
        · onUnmount(卸载前置钩子, craft 停连做计时)
   吐出: {doc, root, box, head, titleEl, headBtnEls, dropBtn, closeBtn, grid,
        hotrow, cellEl, cellAt, renderInv, wirePut, paintChrome, show, hide,
        close, unmount, onEsc, dropArmed, dropIntercept} —— 内部卸载函数名
        unmount(各面板返回对象负责别名成 remove): 底座域不占用 remove 一词,
        面板体内裸调 remove 即解析到 inventory-core 的槽级移除(不再同名遮蔽);
        refresh 不在底座(各面板的重画范围不同), 但语义统一: 只重画内容,
        开合态只有 show/hide 碰 */
function mkPanelShell(cfg) {
  const o = cfg || {};
  const doc = o.doc || document;
  const inv = o.inv;
  const root = doc.createElement('div');
  root.className = 'mkp-mask';
  const box = doc.createElement('div');
  box.className = 'mkp-box' + (o.boxCls ? ' ' + o.boxCls : '');
  root.appendChild(box);

  /* —— 头部: 标题 + 可选头钮(✕ 前) + 关闭 —— */
  const head = doc.createElement('div');
  head.className = 'mkp-head';
  const titleEl = doc.createElement('span');
  titleEl.className = 'mkp-title';
  head.appendChild(titleEl);
  const headBtnEls = (o.headBtns || []).map((b) => {
    const btn = doc.createElement('button');
    btn.className = b.cls;
    btn.onclick = b.onClick;
    head.appendChild(btn);
    return btn;
  });

  /* —— 丢弃态(2026-10, docs/bag-and-drop-design.md §1): onDrop 提供方才有
     头钮; armed 时点背包格=整摞扔出(onDrop 报模式层), 空格/再点/关面板收。
     图标 show 期注入(paintChrome), 与 ✕ 同一延迟加载口径 —— */
  let dropMode = false;
  const dropBtn = o.onDrop ? doc.createElement('button') : null;
  function setDropMode(on) {
    dropMode = on;
    if (dropBtn) dropBtn.classList.toggle('on', on);
    grid.classList.toggle('dropmode', on);
    hotrow.classList.toggle('dropmode', on);
    if (o.onArm) o.onArm(on);
  }
  if (dropBtn) {
    dropBtn.className = 'mkp-drop';
    dropBtn.onclick = () => setDropMode(!dropMode);
    head.appendChild(dropBtn);
  }
  /* armed 查询与点击拦截: 面板各自接进背包格点击路径(wirePut 兜住熔炉/宝箱,
     craft 的点选搬运状态机在 cellClick 里自查) */
  function dropArmed() {
    return dropMode && !!o.onDrop;
  }
  function dropIntercept(i) {
    if (!dropArmed() || !inv.slots[i]) return false;
    o.onDrop(i);
    return true;
  }

  const closeBtn = doc.createElement('button');
  closeBtn.className = 'mkp-x';
  closeBtn.onclick = ()=>close(); /* 统一出口: 隐藏+通知模式层(状态同步/回锁) */
  head.appendChild(closeBtn);

  /* —— 背包格区骨架: 18 主格(槽 9~26) + 9 快捷栏镜像(槽 0~8), 挂载位置归面板 —— */
  const grid = doc.createElement('div');
  grid.className = 'mkp-grid';
  const hotrow = doc.createElement('div');
  hotrow.className = 'mkp-hotrow';

  /* 槽堆 → 格子元素(像素图标/数量>1 才显; dim 灰显可选: 熔炉不可入炉物预告) */
  function cellEl(stack, dim) {
    const d = doc.createElement('div');
    d.className = 'mkp-cell';
    if (stack) {
      d.innerHTML = kitCellHtml(stack);
      if (dim) d.classList.add('dim');
    }
    return d;
  }
  /* 查询面(测试/模式层只读): 背包槽号 → 栈快照|null, 断言格子内容不用爬 DOM 序 */
  function cellAt(i) {
    const s = inv.slots[i];
    if (!s) return null;
    const c = {id: s.id, n: s.n};
    if (s.dur != null) c.dur = s.dur;
    return c;
  }
  /* 背包区整幅重画: 双循环(主格 9~26 + 快捷镜像 0~8), wire(i)→格子元素由面板给 */
  function renderInv(wire) {
    grid.innerHTML = ''; hotrow.innerHTML = '';
    for (let i = HOTBAR_SLOTS; i < inv.slots.length; i++) grid.appendChild(wire(i));
    for (let i = 0; i < HOTBAR_SLOTS; i++) hotrow.appendChild(wire(i));
  }
  /* 意图接线(熔炉/宝箱同口径): 点击背包格报 onPut(槽号) 意图 + 读被点物品
     提示 + 重画; dimIf 可选(熔炉: 不可入炉物灰显预告); 丢弃态优先拦截 */
  function wirePut(onPut, redraw, dimIf) {
    return (i)=>{
      const d = cellEl(inv.slots[i], dimIf && dimIf(inv.slots[i]));
      d.onclick = ()=>{
        if (dropIntercept(i) || dropArmed()) { // 丢弃态: 有摞扔摞, 空格不动
          redraw();
          return;
        }
        const st = inv.slots[i]; /* 先取: onPut 后模式层会扣包 */
        if (onPut) onPut(i);
        kitHint(kitHintItem(st ? st.id : ''), doc); /* 读被点的那摞(空格静默) */
        redraw();
      };
      return d;
    };
  }

  /* chrome 像素图标 show 期才注入: 构造可能发生在模式加载序早期(adventure.js
     顶层建面板), button-icons.js 排在本文件之后未就位 — 运行期首次 show 必已
     加载(与 iconOf 同一延迟解析口径); 底座填标题/✕, extra() 填面板自己的件 */
  function paintChrome(titleHtml, extra) {
    titleEl.innerHTML = titleHtml;
    closeBtn.innerHTML = btnImg('close');
    if (dropBtn) dropBtn.innerHTML = btnImg('trash') + '丢弃';
    if (extra) extra();
  }

  /* —— 生命周期: show=复明+幂等挂载+Esc 监听(内容重画归面板 paint 回调);
     hide/close 不卸载; unmount 幂等卸载(面板对外别名 remove) —— */
  function show(paint) {
    if (paint) paint();
    root.style.display = 'flex'; /* hide 后重开要复明(refresh 不再碰开合态) */
    if (root.parentNode !== doc.body) doc.body.appendChild(root);
    if (doc.addEventListener) doc.addEventListener('keydown', onEsc, true); /* 面板开着: Esc=关面板, 不走菜单链 */
  }
  function hide() {
    if (dropMode) setDropMode(false); // 关面板收丢弃态(重开不带武器)
    root.style.display = 'none';
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
  }
  function close() {/* ✕/Esc 统一出口: preClose(退料类) + 隐藏 + onClose */
    if (o.preClose) o.preClose();
    hide();
    if (o.onClose) o.onClose();
  }
  function onEsc(e) {
    if (e.code !== 'Escape') return;
    e.preventDefault();
    close();
  }
  function unmount() {
    if (o.onUnmount) o.onUnmount();
    if (dropMode) setDropMode(false);
    if (doc.removeEventListener) doc.removeEventListener('keydown', onEsc, true);
    if (root.parentNode === doc.body) doc.body.removeChild(root);
  }
  return {doc, root, box, head, titleEl, headBtnEls, dropBtn, closeBtn, grid, hotrow,
    cellEl, cellAt, renderInv, wirePut, paintChrome, show, hide, close, unmount,
    onEsc, dropArmed, dropIntercept};
}

/* ---------- 背包+摆放台+配方书面板(crafting-grid 设计稿 §5, T10 改造) ----------
   自建遮罩挂 body 级, 不动 index.html。
   公共骨架(遮罩/头/✕/背包格区/Esc/生命周期)在内部底座 mkPanelShell,
   本函数=底座+差异段(摆放台/配方书/整理钮/关面板退料)。
   opts: inv(mkInventory 背包) · recipes(缺省 RECIPES 全表) · station()桌站点
   判定(缺省恒 true) · allow(放开默认过滤的配方 id 数组) · onCraft(out)/onSort ·
   onMove(from,to)(背包格点选搬运: 点非空格起手高亮, 再点目标格搬过去,
   政策与存档在模式层; 大宝箱点选搬运同口径, 拍板② 无拖拽)
   · onGridMove()(摆放台动了背包(摆入/退回/合成)后的通知缝——模式层
   存档/同步快捷栏; 不传则只刷面板) · onReturnLeft([{id,n}])(关面板
   退料装不下的余量, 模式层转掉落物, 零惩罚口径)
   摆放台: 3×3 常驻渲染, 站点外仅左上 2×2 激活(锁定格锁图标+TTS 指路);
   点背包格→摆放格=整摞入格(同 id 并堆, 异种拒绝收手不散, 工具不入格),
   点摆放格→背包格=整摞退回(经 add); 摆对图案→产出槽亮, 点击合成一发,
   长按 0.4s 连做 0.3s/发至材料尽(拍板④; 防误合由「摆错不产出」天然承担,
   旧两步制确认钮退役)。配方卡=BE 口径一键摆入(拍板③): fillGrid 自动
   摆材料, 缺料格留空, 重复点卡=再备一套; 站点外只列 hand 级卡(正典配方
   书口径)。关面板格内材料退回背包(MC 工作台口径)。
   挂载幂等: 同一遮罩节点反复 show 只挂一次, remove 可重复调 */
function mkCraftPanel(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const inv = o.inv;
  const station = o.station || (() => true); // 站点规则归模式层(T13 传 Mobs.near 判定)
  let pickIdx = -1; // 点选搬运的起手背包槽号(-1 无起手); 整理/关面板即收手
  let pickCell = -1; // 摆放格起手下标(-1 无起手); 与 pickIdx 互斥
  const cells = new Array(9).fill(null); // 摆放台 9 格槽堆({id,n}|null), 面板持有(2×2 站点为 UI 锁格)
  /* 公共骨架(遮罩/box/头/✕/背包格区/Esc/生命周期)吃差异配置: 整理头钮 +
     关面板退料收手 + 卸载停连做; 组装序(main/quest/摆放台/配方书)归本段 */
  const shell = mkPanelShell({doc, inv,
    headBtns: [{cls: 'mkp-sort', onClick: onSortClick}],
    onDrop: o.onDrop, /* 丢弃头钮(提供才现身, 2026-10) */
    onArm: (on) => { // 进丢弃态先收起手: 起手格语义与丢弃互斥
      if (on) {
        pickIdx = -1; pickCell = -1;
      }
    },
    preClose: onPreClose, onClose: o.onClose, onUnmount: stopPress});
  const root = shell.root;
  const main = doc.createElement('div');
  main.className = 'mkp-main';
  const quest = doc.createElement('aside'); // 任务卡占位容器(T15 填内容)
  quest.className = 'mkp-quest';
  shell.box.appendChild(main); shell.box.appendChild(quest);
  main.appendChild(shell.head);
  const sortBtn = shell.headBtnEls[0]; /* 整理钮(✕ 前的头钮, 图标 show 期注入) */

  /* 整理按钮: 起手收手(整理会重排主格, 起手槽号失义) + sortInv + 重画 + onSort */
  function onSortClick() {
    pickIdx = -1; pickCell = -1;
    sortInv(inv);
    refresh();
    if (o.onSort) o.onSort();
  }

  /* chrome 像素图标 show 期注入(标题/✕ 在底座, 整理钮在此补; 延迟注入的
     加载序口径见底座 paintChrome 注释) */
  function paintChrome() {
    shell.paintChrome(btnImg('grid') + ' 背包与配方书', ()=>{
      sortBtn.innerHTML = btnImg('sort') + '整理';
    });
  }

  /* —— 背包网格(18 主格 槽 9~26 + 9 快捷栏镜像 槽 0~8): 骨架在底座 —— */
  main.appendChild(shell.grid); main.appendChild(shell.hotrow);

  /* —— 摆放台(crafting-grid §5): 3×3 常驻, 站点外仅左上 2×2 激活;
     产出槽 = matchGrid 命中亮起, 点击一发/长按连做(拍板④) —— */
  const bench = doc.createElement('div');
  bench.className = 'mkp-bench';
  const bgrid = doc.createElement('div');
  bgrid.className = 'mkp-bgrid';
  const barrow = doc.createElement('div');
  barrow.className = 'mkp-barrow';
  const outBtn = doc.createElement('button');
  outBtn.className = 'mkp-oslot off';
  outBtn.type = 'button';
  bench.appendChild(bgrid); bench.appendChild(barrow); bench.appendChild(outBtn);
  main.appendChild(bench);

  /* —— 配方书区: 页签 + 卡片列表(卡片渲染在下方 renderCards) —— */
  const tabs = doc.createElement('div');
  tabs.className = 'mkp-tabs';
  const cards = doc.createElement('div');
  cards.className = 'mkp-cards';
  main.appendChild(tabs); main.appendChild(cards);

  function renderGrid() {/* 背包区双循环在底座, 本段只给点选搬运接线 */
    shell.renderInv((i)=>{ // 格子 + 点选搬运接线(起手格重画后补高亮)
      const d = shell.cellEl(inv.slots[i]);
      if (i === pickIdx) d.classList.add('pick');
      d.onclick = ()=>cellClick(i);
      return d;
    });
  }

  /* —— 点选搬运状态机(大宝箱同口径): 无起手时点非空格=起手(高亮),
     有起手时点另一格=搬去那里(onMove 报模式层执行), 点原格=放下;
     起手格被合成掏空则本次点击改当新起手 —— */
  function cellClick(i) {
    if (shell.dropArmed()) { // 丢弃态优先: 有摞报 onDrop, 空格不动(不进搬运状态机)
      shell.dropIntercept(i);
      refresh();
      return;
    }
    if (pickCell >= 0) { // 摆放格起手 → 点背包格: 整摞退回(经 add, 零损失)
      backCell(pickCell, i);
      return;
    }
    if (pickIdx >= 0 && pickIdx !== i && inv.slots[pickIdx]) {
      const from = pickIdx;
      const moved = inv.slots[from]; /* 先取引用: onMove 后原格内容可能已换 */
      pickIdx = -1;
      if (o.onMove) o.onMove(from, i);
      kitHint(kitHintItem(moved ? moved.id : ''), o.doc); /* 读搬走的那摞 */
      refresh(); // 搬运后整幅重画(模式层已动 inv)
      return;
    }
    pickIdx = (pickIdx === i || !inv.slots[i]) ? -1 : i; // 起手/放下/空格无效
    if (inv.slots[i]) kitHint(kitHintItem(inv.slots[i].id), o.doc); /* 读被点的物品 */
    refresh();
  }

  /* —— 摆放台交互(crafting-grid §5) —— */

  /* 站点外的锁定格: 3×3 下标 2/5/6/7/8(左上 2×2 = 0/1/3/4 激活) */
  function cellLocked(c) {
    return !station() && c !== 0 && c !== 1 && c !== 3 && c !== 4;
  }

  /* 摆放格点击: 背包起手→入格(整摞/并堆, 异种拒绝收手不散, 工具不入格);
     摆放格起手→格间搬(空/并/换); 无起手点非空格=起手 */
  function benchClick(c) {
    if (cellLocked(c)) { // 锁定格指路: 教「走近工作台解锁大格子」
      pickIdx = -1; pickCell = -1;
      kitHint({name: '工作台', desc: '走近工作台就能摆大配方啦', tts: '走近工作台就能摆大配方啦'}, o.doc);
      refresh();
      return;
    }
    if (pickIdx >= 0 && inv.slots[pickIdx]) { // 背包格 → 摆放格
      const stack = inv.slots[pickIdx];
      const cur = cells[c];
      if (durOf(stack.id) > 0) { // 工具/可耗损物不入格(图案永不引用, 避开耐久重铸)
        kitHint({name: '工具', desc: '工具不用放进格子哦', tts: '工具不用放进格子哦'}, o.doc);
        refresh();
        return;
      }
      if (cur && cur.id !== stack.id) { // 异种: 拒绝并保留起手(孩子换格再点)
        kitHint({name: '格子', desc: '格子里已经有别的材料啦', tts: '格子里已经有别的材料啦'}, o.doc);
        refresh();
        return;
      }
      const max = stackMax(stack.id); /* 堆叠上限经 items-core(未注册 0=门禁拒收) */
      const free = cur ? max - cur.n : max;
      /* 槽级取走(inventory-core): 内部卸载函数已改名 unmount, 本域不再
         遮蔽 remove —— 裸调即解析到共享全局的背包原语(经典 script 顶层
         函数 = 全局属性, 测试桩同口径挂 globalThis, 晚绑定不变) */
      const got = free > 0 ? remove(inv, pickIdx, free) : null;
      pickIdx = -1;
      if (got) {
        if (cur) cur.n += got.n;
        else cells[c] = got;
        if (o.onGridMove) o.onGridMove();
        kitHint(kitHintItem(got.id), o.doc);
      }
      refresh();
      return;
    }
    if (pickCell >= 0 && pickCell !== c) { // 摆放格 → 摆放格(搬/并/换)
      const from = pickCell;
      pickCell = -1;
      const a = cells[from];
      if (!a) {
        refresh(); return;
      }
      const b = cells[c];
      if (!b) {
        cells[c] = a; cells[from] = null;
      } else if (b.id === a.id && b.n < stackMax(b.id)) {
        const put = Math.min(a.n, stackMax(b.id) - b.n);
        b.n += put; a.n -= put;
        if (a.n <= 0) cells[from] = null;
      } else {
        cells[c] = a; cells[from] = b; // 整摞对调
      }
      refresh();
      return;
    }
    pickCell = (pickCell === c || !cells[c]) ? -1 : c; // 起手/放下/空格无效
    if (cells[c]) kitHint(kitHintItem(cells[c].id), o.doc);
    refresh();
  }

  /* 摆放格 → 背包: 整摞退回经 add(并堆/找空位, 装不下留格零损失) */
  function backCell(c, slot) {
    const s = cells[c];
    pickCell = -1;
    if (!s) {
      refresh(); return;
    }
    const left = add(inv, s.id, s.n);
    if (left > 0) s.n = left;
    else cells[c] = null;
    if (o.onGridMove) o.onGridMove();
    kitHint(kitHintItem(s.id), o.doc);
    refresh();
  }

  /* 当前摆放命中的配方(visibleRecipes 集 = 站点过滤+allow 放开; 隐藏配方
     (bread/bone_meal/bow_item 二期)不参与匹配——二期门禁随卡片走) */
  function matchNow() {
    return visibleRecipes().find((r) => matchGrid(cells, r)) || null;
  }

  /* 摆放台渲染: 9 格 + 锁定态 + 产出槽(命中亮起, 图案×数量); 台面状态类
     随站点切换(away=不在工作台: 木框变暗 + bgrid 金框圈出激活 2×2) */
  function renderBench() {
    const at = station();
    bench.classList.toggle('away', !at);
    bgrid.classList.toggle('locked', !at);
    bgrid.innerHTML = '';
    for (let c = 0; c < 9; c++) {
      const d = shell.cellEl(cells[c]);
      if (cellLocked(c)) {
        d.classList.add('lock');
        d.innerHTML = '<span class="icon">🔒</span>';
      } else {
        if (c === pickCell) d.classList.add('pick');
        d.onclick = ()=>benchClick(c);
      }
      bgrid.appendChild(d);
    }
    paintOut();
  }

  /* 产出槽: 命中显示产物预览(icon ×n)可点 + 箭头点亮(has-out); 未命中灰显引导 */
  function paintOut() {
    const r = matchNow();
    bench.classList.toggle('has-out', !!r);
    if (r) {
      outBtn.className = 'mkp-oslot on';
      outBtn.innerHTML = kitIconHtml(r.out.item, 'big', 'icon big') +
        (r.out.n > 1 ? '<b class="mkp-n">×' + r.out.n + '</b>' : '');
    } else {
      outBtn.className = 'mkp-oslot off';
      outBtn.innerHTML = '<span class="mkp-outq">?</span>';
    }
  }

  /* 合成执行: 产出槽点击/连做共用; visibleRecipes 作匹配集(与预览同口径) */
  function craftOnce() {
    const res = gridCraft(cells, inv, station(), visibleRecipes());
    if (!res.ok) return false;
    if (o.onCraft) o.onCraft({item: res.out.item, n: res.out.n, leftover: res.leftover});
    refresh(); // 格内数量/产出槽实时重读
    return true;
  }

  /* 摆错无产出(防误合由图案承担): 点灰产出槽读指路提示, 不静默 */
  function dimOutHint() {
    kitHint({name: '摆放台', desc: '摆对了才会出现做法哦', tts: '再照着卡片摆一摆，摆对了就能做啦'}, o.doc);
  }

  /* 产出槽按压状态机(拍板④, 自旧「合成」钮平移): 长按 0.4s 进连做
     (立即一发+0.3s/发), 松开/离开/摆空停; 未命中按压只读提示 */

  /* —— 配方可见集: 一期过滤(bread/bone_meal/bow_item 不点亮) + allow 放开
     + 站点口径(站点外只列 hand 级卡——正典: 2×2 配方才进随身配方书);
     站点是动态判定, 求值期算 —— */
  const recipes = o.recipes || (typeof RECIPES !== 'undefined' ? RECIPES : []);
  function visibleRecipes() {
    return recipes.filter((r) => (!KIT_HIDDEN_RECIPES.includes(r.id) ||
      (o.allow && o.allow.includes(r.id))) && (r.station === 'hand' || station()));
  }
  let tab = 'all'; // 当前分类页签
  function cardTab(r) {
    if (toolOf(r.out.item)) return 'tool';
    const it = ITEMS[r.out.item];
    if (it && it.food) return 'food';
    if (it && it.block) return 'block';
    return 'all'; // 未归类(材料): 只在「全部」页出现
  }
  function renderCards() {
    cards.innerHTML = '';
    visibleRecipes().filter((r) => tab === 'all' || cardTab(r) === tab) // 未归类只随「全部」
        .forEach((r) => cards.appendChild(cardEl(r)));
  }
  function renderTabs() {
    tabs.innerHTML = '';
    KIT_TABS.forEach((t)=>{
      const b = doc.createElement('button');
      b.className = 'mkp-tab' + (tab === t.key ? ' on' : '');
      b.innerHTML = btnImg(t.icon);
      b.onclick = ()=>{
        tab = t.key;
        renderTabs();
        renderCards();
      };
      tabs.appendChild(b);
    });
  }
  function cardEl(r) {
    const d = doc.createElement('div');
    d.dataset.recipe = r.id;
    /* 亮灰判定: canCraft(inv, recipe, stationOk)(craft-core 三形状 missing 驱动灰显) */
    const check = canCraft(inv, r, station());
    const lackHave = {}; // id → have(单候选缺料)
    const lackAny = new Set(); // 任选组全缺的候选
    let stationLack = false;
    for (const m of check.missing) {
      if (m.station) stationLack = true; // 站点未解锁 → 徽标灰
      else if (m.id != null) lackHave[m.id] = m.have;
      else if (m.any) m.any.forEach((c) => lackAny.add(c));
    }
    d.className = 'mkp-card' + (check.ok ? '' : ' dim');
    let chips = '';
    for (const [key, val] of Object.entries(shapeCost(r))) {/* 派生计费(crafting-grid §4) */
      const e = costEntry(key, val); // 候选数组+数量(inventory-core 统一形状)
      if (!e) continue;
      e.cands.forEach((c) => {
        chips += kitChipHtml(c, e.n, lackHave[c], c in lackHave || lackAny.has(c));
      }); // 任选=逐候选一枚(需求量同一份)
    }
    const badge = KIT_STATION_BADGE[r.station] || '';
    const badgeHtml = badge ?
      '<span class="mkp-badge' + (stationLack ? ' lack' : '') + '">' + btnImg(badge) + '</span>' : '';
    d.innerHTML = badgeHtml +
      '<div class="mkp-out">' + kitIconHtml(r.out.item, 'big', 'icon big') +
      (r.out.n > 1 ? '<b class="mkp-n">×' + r.out.n + '</b>' : '') + '</div>' +
      '<div class="mkp-chips">' + chips + '</div>';
    d.onclick = ()=>tapCard(r); /* 点卡=BE 一键摆入(拍板③), 合成走产出槽 */
    return d;
  }

  /* —— 配方卡 = BE 口径一键摆入(拍板③): fillGrid 自动摆材料(异种清扫
      +逐规约格并堆+1, 缺料留空, 重复点=再备一套); 亮卡读产物提示,
      灰卡加「现在还做不了哦」尾句(静默对孩子是谜题, 纯增益通道
      docs/item-hint-design.md §3.5) —— */
  function dimCardHint(r) {
    const h = kitHintItem(r.out.item);
    if (h) kitHint({name: h.name, desc: h.desc, tts: h.tts + '，现在还做不了哦'}, o.doc);
  }
  function tapCard(r) {
    const check = canCraft(inv, r, station());
    fillGrid(inv, r, cells);
    if (o.onGridMove) o.onGridMove();
    refresh();
    if (check.ok) {
      const h = kitHintItem(r.out.item);
      if (h) kitHint({name: h.name, desc: h.desc, tts: h.tts}, o.doc);
    } else {
      dimCardHint(r);
    }
  }

  /* —— 产出槽按压状态机(拍板④, 自旧「合成」钮平移): 长按 0.4s 进入连做
      (立即一发+0.3s/发), 松开/离开/图案散了停; 未命中按压读指路提示 —— */
  let active = null; // {el, repeating, stop}
  function stopPress() {
    if (active) active.stop();
  }
  outBtn.addEventListener('pointerdown', (ev)=>{
    if (!matchNow()) {
      dimOutHint();
      return;
    }
    ev.preventDefault();
    stopPress(); // 旧按压让位
    let holdT = 0; let repT = 0;
    const stop = ()=>{
      clearTimeout(holdT); clearInterval(repT);
      if (active && active.el === outBtn) active = null;
    };
    active = {el: outBtn, repeating: false, stop};
    holdT = setTimeout(()=>{ // 0.4s 判定线
      if (active && active.el === outBtn) active.repeating = true;
      if (!craftOnce()) {
        stop(); // 摆空/装不下 → 不进连做
        return;
      }
      repT = setInterval(()=>{ // 0.3s/发, 图案散了自动停
        if (!craftOnce()) stop();
      }, 300);
    }, 400);
  });
  outBtn.addEventListener('pointerup', ()=>{ // 松开: 未进连做→补单击; 连做中→只停
    const a = active;
    if (!a || a.el !== outBtn) return;
    const rep = a.repeating;
    a.stop();
    if (!rep && !craftOnce()) dimOutHint(); // 未命中点击: 提示代替静默
  });
  outBtn.addEventListener('pointerleave', ()=>{
    if (active && active.el === outBtn) active.stop();
  });

  /* —— 生命周期(show/hide/close/unmount)在底座, 本段只剩 craft 差异:
     关面板退料 + refresh 重画内容(不碰开合态, 复明归 show) —— */
  /* 关面板退料(crafting-grid §5, MC 工作台口径): 格内材料退回背包;
     装不下的余量经 onReturnLeft 报模式层(转掉落物零损失), 无处理方留格不丢 */
  function stashCells() {
    const stuck = [];
    for (let i = 0; i < cells.length; i++) {
      const s = cells[i];
      if (!s) continue;
      const rem = add(inv, s.id, s.n);
      if (rem > 0) {
        s.n = rem;
        stuck.push(i); // 装不下的格
      } else {
        cells[i] = null;
      }
    }
    if (stuck.length && o.onReturnLeft) {
      o.onReturnLeft(stuck.map((i) => ({id: cells[i].id, n: cells[i].n})));
      stuck.forEach((i) => (cells[i] = null)); // 余量已交模式层(掉落物), 清格
    }
  }
  function onPreClose() {/* 底座 close 前置: 收面板顺手收起手(下次打开不带旧高亮)+退料 */
    pickIdx = -1; pickCell = -1;
    stashCells();
  }
  function refresh() {/* 重画内容不碰开合态(语义统一): 关着时调 refresh 不再弹面板 */
    renderTabs();
    renderGrid();
    renderBench(); /* 摆放台(锁定态/起手高亮/产出槽)随站点与摆放实时重读 */
    renderCards();
  }
  function show() {
    paintChrome();
    refresh();
    shell.show(); /* 复明 + 幂等挂载 + Esc 监听 */
  }
  return {root, questEl: quest, show, hide: shell.hide, close: shell.close,
    remove: shell.unmount, refresh, cellAt: shell.cellAt};
}


function confirmBtn(btn, o) {
  let armed = false; let t = 0;
  btn.textContent = o.label;
  btn.onclick = ()=>{
    if (armed) {
      armed = false; clearTimeout(t);
      btn.textContent = o.label;
      o.onConfirm();
    } else {
      armed = true;
      btn.textContent = o.confirm;
      t = setTimeout(()=>{
        armed = false; btn.textContent = o.label;
      }, o.hold || 3000);
    }
  };
}

/* ---------- 熔炉面板(D8, T10): 三槽(料/燃料/产物)+进度条+放料意图(自动+手动) ----------
   面板是纯显示+意图出口: 烧炼状态(槽内容/进度)由模式层经 setSlots/
   setProgress 喂入(烧炼计时与扣加归 T13 模式层, 经 inventory-core);
   「自动放入」只算 plan(矿石全放 + FUEL 序最省凑料)回调 onAutoFill,
   不动背包 — 实际扣加由模式层执行;
   手动放入(2026-10-25 交互优化): 面板常驻背包区(18 主格+9 快捷镜像,
   mkCraftPanel/mkChestPanel 同款观感), 点击格 → onPut(槽号) 意图,
   点击炉三槽 → onSlot('input'|'fuel'|'out') 意图 — 路由/扣加/取回
   政策全归模式层(furnace-kit); 可烧或燃料物亮显、其余 dim 灰显
   (判据 smeltOf/fuelUnits, 交互期才求值——craft-core 彼时已加载) */
function mkFurnacePanel(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const inv = o.inv;
  /* 公共骨架(遮罩/头/✕/背包格区/Esc/生命周期)在底座, 本段只剩炉子差异段;
     onDrop 透传底座(丢弃头钮, 2026-10) */
  const shell = mkPanelShell({doc, inv, boxCls: 'mkp-furnace',
    onDrop: o.onDrop, onClose: o.onClose});
  const root = shell.root;
  const box = shell.box;
  box.appendChild(shell.head);

  const row = doc.createElement('div');
  row.className = 'mkp-frow';
  let furnaceState = null; /* 最近一次 setSlots 的三槽现状: 炉槽点击时报"点到什么" */
  function fslot(label, name) {/* name = 炉槽意图键, 点击报模式层(取回/收取) */
    const wrap = doc.createElement('div');
    wrap.className = 'mkp-fslot';
    const cell = shell.cellEl(null); /* 空格起步, 内容由 setSlots/paint 喂 */
    cell.onclick = ()=>{
      const st = furnaceState && furnaceState[name]; /* 先取: onSlot 后模式层会取走 */
      if (o.onSlot) o.onSlot(name);
      kitHint(kitHintItem(st ? st.id : ''), o.doc); /* 读点击瞬间炉槽里的物品 */
      refreshGrid(); /* 取回/收取动了包: 背包格跟随重画 */
    };
    const lbl = doc.createElement('span');
    lbl.className = 'mkp-flbl';
    lbl.textContent = label;
    wrap.appendChild(cell);
    wrap.appendChild(lbl);
    row.appendChild(wrap);
    return cell;
  }
  const cellIn = fslot('要烧的', 'input');
  const cellFuel = fslot('燃料', 'fuel');
  const prog = doc.createElement('div');
  prog.className = 'mkp-pbar';
  /* F2 火焰复合件(设计稿 §2.2): 火焰图(工坊注入) + 脚下燃料余量条;
     余量经 setFuel 喂 r=heat/fuelUnits(0..1), 模式层与 setSlots 同节拍 */
  const fire = doc.createElement('div');
  fire.className = 'mkp-fire';
  const fireIcon = doc.createElement('span');
  fireIcon.className = 'mkp-fireicon';
  const fgauge = doc.createElement('span');
  fgauge.className = 'mkp-fgauge';
  const ffill = doc.createElement('i');
  ffill.className = 'mkp-ffill';
  fgauge.appendChild(ffill);
  fire.appendChild(fireIcon);
  fire.appendChild(fgauge);
  const fill = doc.createElement('i');
  fill.className = 'mkp-pfill';
  prog.appendChild(fill);
  const mid = doc.createElement('div');
  mid.className = 'mkp-fmid';
  mid.appendChild(fire);
  mid.appendChild(prog);
  row.appendChild(mid);
  const cellOut = fslot('产物', 'out');
  box.appendChild(row);

  const autoBtn = doc.createElement('button');
  autoBtn.className = 'mkp-autofill';
  autoBtn.onclick = ()=>{
    if (o.onAutoFill) o.onAutoFill(autoPlan());
    refreshGrid(); /* 自动放料动了包: 背包格跟随重画 */
  };
  box.appendChild(autoBtn);

  /* —— 背包区(手动放入, 2026-10-25 交互优化): 标签 + 18 主格 + 9 快捷
     镜像(mkChestPanel 同款布局) — 点击格报 onPut(槽号) 意图, 路由与
     扣加归模式层; 不可入炉物(不可烧也非燃料)dim 灰显作视觉预告 —— */
  const bpLabel = doc.createElement('div');
  bpLabel.className = 'mkp-invlbl';
  box.appendChild(bpLabel); box.appendChild(shell.grid); box.appendChild(shell.hotrow);

  function refreshGrid() {/* 动作后整幅重画(格子数 ≤30, 无性能顾虑); 双循环与
    点击意图接线在底座, 本段只给差异: 不可入炉物(不可烧也非燃料)dim 灰显 */
    shell.renderInv(shell.wirePut(o.onPut, refreshGrid,
        (s)=> s && !smeltOf(s.id) && !fuelUnits(s.id)));
  }

  /* chrome 像素图标 show 期注入(标题/✕ 在底座, 炉子件在此补) */
  function paintChrome() {
    shell.paintChrome(btnImg('furnace') + ' 熔炉', ()=>{
      fireIcon.innerHTML = btnImg('flame');
      autoBtn.innerHTML = btnImg('autofill') + '自动放入';
      bpLabel.innerHTML = btnImg('grid') + ' 背包（点一下放进熔炉）';
    });
  }

  function paint(cell, stack) {/* 炉槽回显: 格子内容 HTML 收口在 kitCellHtml 小件 */
    cell.innerHTML = kitCellHtml(stack);
  }
  function setSlots(s) { // 烧炼三槽现状(模式层每态变化时喂)
    furnaceState = s || null; /* 炉槽点击提示的记忆面(空态置 null) */
    paint(cellIn, s && s.input);
    paint(cellFuel, s && s.fuel);
    paint(cellOut, s && s.output);
  }
  function setProgress(r) { // 0..1 进度条(越界钳制)
    fill.style.width = Math.round(Math.max(0, Math.min(1, r || 0)) * 100) + '%';
  }
  function setFuel(r) { // F2 燃料余量条(设计稿 §2.2): r=heat/fuelUnits 单件剩余比(0..1 越界钳制);
    // r≤0 = 无热(必然无燃料可烧) → 熄灭灰显, 复燃去灰显(CSS opacity/滤镜接管)
    const c = Math.max(0, Math.min(1, r || 0));
    ffill.style.width = Math.round(c * 100) + '%';
    fire.classList.toggle('mkp-fire-out', c <= 0);
  }
  function autoPlan() { // 意图计算: 矿石全放(首现序聚合) + FUEL 序最省凑料
    const load = [];
    const seen = {};
    let need = 0;
    for (const s of inv.slots) {
      if (!s || seen[s.id] || !smeltOf(s.id)) continue;
      seen[s.id] = true;
      let n = 0;
      for (const t of inv.slots) if (t && t.id === s.id) n += t.n;
      load.push({id: s.id, n, out: smeltOf(s.id)});
      need += n;
    }
    const fuel = [];
    let units = 0;
    for (const id of FUEL) { // FUEL 序即最省排序(craft-core 派生)
      if (units >= need) break;
      const per = fuelUnits(id);
      if (!per) continue;
      let have = 0;
      for (const t of inv.slots) if (t && t.id === id) have += t.n;
      if (!have) continue;
      const take = Math.min(have, Math.ceil((need - units) / per));
      fuel.push({id, n: take});
      units += take * per;
    }
    return {load, fuel, units}; // 执行权在模式层(T13): take/add 经 inventory-core
  }
  /* 生命周期(show/hide/close/unmount)全在底座; refresh 保持既有口径=重画背包区 */
  function show() {
    shell.show(() => {/* 背包区常驻: 开面板即画当前包(手动放入入口) */
      paintChrome();
      refreshGrid();
    });
  }
  return {root, show, hide: shell.hide, close: shell.close, remove: shell.unmount,
    refresh: refreshGrid, cellAt: shell.cellAt, setSlots, setProgress, setFuel, autoPlan};
}

/* ---------- 大宝箱面板(mkChestPanel, 引导链 v2): 点选搬运的纯格子面板 ----------
    全局共享账户的观感层: 箱子格(前 size 格, 点击=取回背包) + 扩容行(下一档
    材料 chip + 按钮, 顶格隐藏) + 背包格(18 主格+9 快捷镜像, 点击=存入箱子)。
    存取/扩容的政策与存档全在模式层(onPut/onTake/onExpand 回调), 面板只管
    格子与点击, 每次动作后自 chest()/inv 重画; 触屏桌面同一套点选(无拖拽, 拍板②)。
    opts: inv(mkInventory 背包) · chest()→{size, slots} 账户现状 · next()→
    {size, cost}|null 下一扩容档 · have(id)→背包持有数(缺料角标 have/need) ·
    onPut(invSlotIdx) · onTake(chestSlotIdx) · onExpand() · onClose */
function mkChestPanel(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const inv = o.inv;
  /* 公共骨架(遮罩/头/✕/背包格区/Esc/生命周期)在底座, 本段只剩箱格/扩容行;
     onDrop 透传底座(丢弃头钮, 2026-10) */
  const shell = mkPanelShell({doc, inv, boxCls: 'mkp-chest',
    onDrop: o.onDrop, onClose: o.onClose});
  const root = shell.root;
  const box = shell.box;
  box.appendChild(shell.head);

  const chestGrid = doc.createElement('div');
  chestGrid.className = 'mkp-grid mkp-chestgrid';
  box.appendChild(chestGrid);

  const expandRow = doc.createElement('div');
  expandRow.className = 'mkp-chestrow';
  box.appendChild(expandRow);

  const bpLabel = doc.createElement('div');
  bpLabel.className = 'mkp-chestlbl';
  box.appendChild(bpLabel);
  box.appendChild(shell.grid); box.appendChild(shell.hotrow);

  /* chrome 像素图标 show 期注入(标题/✕ 在底座, 背包标签在此补) */
  function paintChrome() {
    shell.paintChrome(btnImg('chest') + ' 我的宝箱', ()=>{
      bpLabel.innerHTML = btnImg('grid') + ' 背包（点一下放进箱子）';
    });
  }

  function refresh() {/* 每次动作后整幅重画(格子数 ≤27+27, 无性能顾虑); 背包区
    双循环与点击接线在底座(主格/快捷镜像同一段 onPut 意图, 收编前两份逐字誊写) */
    const ch = o.chest();
    chestGrid.innerHTML = '';
    for (let i = 0; i < ch.size; i++) {
      const d = shell.cellEl(ch.slots[i]);
      d.onclick = ()=>{
        const st = ch.slots[i]; /* 先取: onTake 后模式层会取走 */
        o.onTake(i);
        kitHint(kitHintItem(st ? st.id : ''), doc); /* 读从箱子拿起的物品 */
        refresh();
      };
      chestGrid.appendChild(d);
    }
    expandRow.innerHTML = '';
    const nx = o.next();
    if (nx) {
      for (const key of Object.keys(nx.cost)) {
        const chip = doc.createElement('span'); /* 材料账单 chip(配方卡同观感) */
        chip.innerHTML = kitChipHtml(key, nx.cost[key], o.have(key),
            o.have(key) < nx.cost[key], true); /* 账单恒显 have/need, 缺料附 lack */
        expandRow.appendChild(chip);
      }
      const btn = doc.createElement('button');
      btn.className = 'mkp-autofill';
      btn.textContent = '＋ 扩到 ' + nx.size + ' 格';
      btn.onclick = ()=>{
        o.onExpand();
        refresh();
      };
      expandRow.appendChild(btn);
    }
    shell.renderInv(shell.wirePut(o.onPut, refresh));
  }

  /* 生命周期(show/hide/close/unmount)全在底座; show 不重画内容——消费方
    adventure.js 开面板后自调 refresh(既有契约, 面板行为不变) */
  function show() {
    shell.show(()=> paintChrome());
  }
  return {root, show, hide: shell.hide, close: shell.close, remove: shell.unmount,
    refresh, cellAt: shell.cellAt};
}

/* ---------- 头顶血条已迁 js/combat-kit.js(C6-T3, CombatKit.mkHpBar) ----------
    玩家战斗 vocabulary 归一处; 本文件保留 UI/chrome/面板族服务 */

/* ---------- 气泡条(liquid D10): 溺气 HUD, HP 模式挂快捷栏上方 ----------
    10 泡像素图标(按钮图标工坊自绘 bubble, 禁 emoji); update(airFrac 0..1)
    点亮 ceil(10×frac) 泡, 气满整条隐藏; 剩 3 泡 TTS 轻提醒恰一次(每次
    下潜至多一次, 节流自持——危险意识但不惊吓, 共识 Q16); visible() 回调
    是额外显隐门(如只在某阶段显示)。 */
function mkBubbleBar(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const mount = o.mount || doc.body;
  const root = doc.createElement('div');
  root.className = 'bubblebar';
  const url = (typeof btnIcon === 'function') ? btnIcon('bubble') : '';
  const bubbles = [];
  for (let i = 0; i < 10; i++) {
    const b = doc.createElement('span');
    b.className = 'bub';
    if (url) b.style.backgroundImage = 'url(' + url + ')';
    root.appendChild(b);
    bubbles.push(b);
  }
  mount.appendChild(root);
  let shown = 10;
  let warned = false;
  return {
    update(frac) {
      const n = Math.max(0, Math.min(10, Math.ceil((frac || 0) * 10)));
      const vis = (o.visible ? o.visible() : true) && n < 10; /* 气满藏条 */
      root.style.display = vis ? 'flex' : 'none';
      if (!vis) return;
      if (n !== shown) {
        shown = n;
        for (let i = 0; i < 10; i++) bubbles[i].classList.toggle('off', i >= n);
      }
      if (n <= 3 && !warned) {
        warned = true;
        if (typeof SpeechKit !== 'undefined' && SpeechKit) SpeechKit.speak('要抬头换气啦');
      }
      if (n >= 10) warned = false; /* 回满气: 下次下潜再提醒 */
    },
    dispose() {
      if (root.parentNode) root.parentNode.removeChild(root);
    },
  };
}

/* ---------- mkMobPicker: 选怪按钮组(评审候选 6, 三处誊写收编) ----------
   「Mobs.face(k) 头像 img + 名字 + families() 谱系分组簇(组头+组员) +
   data-type + active 高亮」的按钮制造术在竞技场双队面板(.mob-btns)/
   演习场 👾 浮动面板(#pkMobBtns)/出发配置页怪物行(#tankMobPick)写了三遍,
   收进一处; 分组唯一入口怪物库 families()(主族归组), Mobs 经全局名调用期
   解析(与 BLOCKS/ITEMS 同口径), 键清单随之动态 — 以后加怪自动出现。
   opts:
     doc         文档注入(Node 单测)
     mount       容器元素(竞技场传 .mob-btns 双队各自建一组)
     onPick(k)   点击回调 — 配置写入/配平/重画政策全归消费方
     activeOf()→k|null  选中态供给(缺省无高亮; 点击后自动重读)
     headKeys[]  组前置平铺键(不归族 — 竞技场 mix 功能位排最前)
     groupOf(k)→组名|null  键的组归属覆写: 缺省主族; 返 null=平铺不建组
                 (出发配置页怪物行的卡片流口径)
     itemTag/itemCls/itemHtml(k)  按钮观感差异(缺省 button + 头像+名字;
                 配置页卡片 div.scene-card + .big/h2 结构)
     titleOf(k)  悬停提示(竞技场战力/Boss/族名)
   吐出 {render(整组重画, 幂等) · sync(仅选中态重读)}; 未注册键兜底显
   键名不静默丢(面板分组「不丢桶」同款口径)。 */
function mkMobPicker(opts) {
  const o = opts || {};
  const doc = o.doc || document;
  const mount = o.mount;
  const items = []; /* 本组全部按钮(含 headKeys), sync 精确重读不爬 DOM 序 */
  function nameOf(k) {
    const t = (typeof Mobs !== 'undefined' && Mobs.types) ? Mobs.types[k] : null;
    return (t && t.name) || k;
  }
  function itemEl(k) {
    const b = doc.createElement(o.itemTag || 'button');
    if (o.itemCls) b.className = o.itemCls;
    b.innerHTML = (o.itemHtml ? o.itemHtml(k) :
      '<img src="' + Mobs.face(k) + '" alt="">' + nameOf(k));
    if (o.titleOf) b.title = o.titleOf(k);
    b.dataset.type = k;
    /* onclick 属性接线(被收编三处的两处先例; 每按钮恰一个 click 监听,
       与 addEventListener 语义等价) */
    b.onclick = ()=>{
      if (o.onPick) o.onPick(k);
      sync(); /* 点击后重读选中态(activeOf 是消费方口径) */
    };
    items.push(b);
    return b;
  }
  function render() {
    mount.innerHTML = '';
    items.length = 0;
    (o.headKeys || []).forEach((k)=> mount.appendChild(itemEl(k))); /* 前置功能位(不归族) */
    const flat = []; /* groupOf 覆写为 null 的键 → 平铺不建组头 */
    const buckets = {}; const order = [];
    for (const g of Mobs.families()) {
      for (const k of g.members) {
        const gv = o.groupOf ? o.groupOf(k) : g.name;
        if (gv == null) {
          flat.push(k); continue;
        }
        if (!buckets[gv]) {
          buckets[gv] = {name: gv, members: []}; order.push(gv);
        }
        buckets[gv].members.push(k);
      }
    }
    flat.forEach((k)=> mount.appendChild(itemEl(k)));
    for (const name of order) {/* 谱系分组簇: 组头+组员成簇随行流动(不整行断组) */
      const grp = doc.createElement('div');
      grp.className = 'fam-group';
      const head = doc.createElement('span');
      head.className = 'fam-head';
      head.textContent = buckets[name].name;
      grp.appendChild(head);
      for (const k of buckets[name].members) grp.appendChild(itemEl(k));
      mount.appendChild(grp);
    }
    sync();
  }
  function sync() {
    const act = o.activeOf ? o.activeOf() : null;
    items.forEach((b)=> b.classList.toggle('active', b.dataset.type === act));
  }
  return {render, sync};
}

/* ---------- 模式工厂: 模式只声明差异, 样板在此吸收 ---------- */
function mkMode(cfg) {
  const hb = cfg.hotbar || null;
  function applyChrome() {
    if (MK.score) MK.score.style.display = (cfg.chrome && cfg.chrome.score) || 'none';
    /* hotbar: 'flex' 立即显示; 'deferred' 现在隐藏、由模式在合适时机自行 show();
       缺省/none 恒隐藏 */
    if (hb && cfg.chrome && cfg.chrome.hotbar === 'flex') hb.show();
    else if (MK.hotbar) MK.hotbar.style.display = 'none';
    if (!cfg.hud && MK.hud) MK.hud.innerHTML = '';
  }
  const mode = {
    id: cfg.id,
    hotbar: hb,
    init() {
      applyChrome();
      /* 触屏动作声明走 Input 命名空间(input.js 引擎缝收口); typeof 守卫保持:
         精简装载的 Node 单测可缺装 input.js, 回落旧散全局名(过渡别名) */
      if (typeof Input !== 'undefined' && Input && typeof Input.setActions === 'function') {
        Input.setActions(cfg.touch || null);
      } else if (typeof setTouchActions === 'function') {
        setTouchActions(cfg.touch || null);
      }
      if (cfg.init) cfg.init();
    },
    cleanup() {
      if (cfg.cleanup) cfg.cleanup();
    },
    update(dt) {
      if (cfg.update) cfg.update(dt);
    },
    onKey(code) {
      if (code === 'KeyB') {
        uiPause(); return;
      } // 三模式共用的默认暂停键
      if (cfg.onKey) cfg.onKey(code);
    },
    onDigit(n) {
      if (hb) hb.select(n - 1); if (cfg.onDigit) cfg.onDigit(n);
    },
    onWheel(d) {
      if (hb) hb.select((hb.sel + d + hb.items.length) % hb.items.length); if (cfg.onWheel) cfg.onWheel(d);
    },
    onMouse(b, hit) {
      if (cfg.onMouse) cfg.onMouse(b, hit);
    },
    /* 触屏长按起止(input.js 手势路由): 按住连挖等持续语义由模式自决 */
    onHold(active) {
      if (cfg.onHold) cfg.onHold(active);
    },
    onVoidFall() {
      if (cfg.onVoidFall) cfg.onVoidFall();
      else if (mkLastSpawn) kitSpawn(mkLastSpawn.x, mkLastSpawn.y, mkLastSpawn.z, mkLastSpawn);
    },
  };
  if (cfg.onHighlight) mode.onHighlight = cfg.onHighlight;
  if (cfg.onMenu) mode.onMenu = cfg.onMenu;
  if (cfg.buildMenu) mode.buildMenu = cfg.buildMenu;
  /* 关页兜底存档钩子(main.js pagehide 收口, 2026-10 树苗丢档修复):
     与 onHighlight/onMenu 同款白名单透传——mkMode 不过滤已知钩子之外的
     语义, 世界档 5s 节流的模式(build/adventure)借此在关页时同步落盘 */
  if (cfg.onPageHide) mode.onPageHide = cfg.onPageHide;
  if (cfg.hud && MK.hud) {
    /* HUD 节流: 主循环每帧调用, 但文本至多 10Hz 变化 — 先限频再比对,
       内容相同直接跳过 innerHTML 写入(省去每帧 DOM 重建/布局/重绘,
       也省掉 hud() 内的全量重算, 如竞技场记分板遍历全部怪物) */
    let hudLastT = -1e9; let hudLastHtml = null;
    mode.updateHud = (hit)=>{
      const now = performance.now();
      if (now - hudLastT < 100) return;
      hudLastT = now;
      const html = cfg.hud(hit).join('<br>');
      if (html === hudLastHtml) return;
      hudLastHtml = html;
      MK.hud.innerHTML = html;
    };
  }
  return mode;
}

const ModeKit = {mkMode, mkHotbar, mkMainAct, mkHeldSync, editHit, mkHoldMine,
  mkMobPicker, mkCraftPanel,
  mkFurnacePanel, mkChestPanel, mkBubbleBar, sortInv,
  spawn: kitSpawn, lookName, confirmBtn};
if (typeof module !== 'undefined' && module.exports) module.exports = ModeKit;
