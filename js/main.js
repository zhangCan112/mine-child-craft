'use strict';
/* ============================================================
   主入口（Main）— 应用层(术语见 GLOSSARY.md 的"应用层/模式注册表/每日预算")
   ------------------------------------------------------------
   模式调度与主循环: 消费模式注册表派生菜单页/卡片接线, 驱动 MODES 框架的
   进入/退出/update/render 主循环, 装配每日预算(setupBudgets)与画质档决策
   (帧率采样喂 quality-core)。
   依赖(均经全局名, 经典 script 顺序加载): js/ 全部引擎与应用模块 +
   js/modes/*.js 模式文件 — 后者必须先于本文件加载(由
   test/mode-registry.test.js 对着 index.html 断言, 手滑即红)。
============================================================ */

const MODES = {
  arena: ArenaMode,
  focus: FocusMode,
  math: MathMode,
  build: BuildMode,
  tank: TankRangeMode,
  nether: NetherMode,
  adventure: AdventureMode,
};
MODES.cur = null;
/* 组合根接线: 触屏按钮像素图标解析器(button-icons.js 工坊)注入引擎
   input.js 的 Input.icon seam — 引擎层不反向依赖应用层图标库 */
Input.icon = btnIcon;
/* 当前模式 id 只从 MODES.cur 派生 — 不再另持一份需同步的状态 */
const curModeId = () => (MODES.cur ? MODES.cur.id : null);

/* ---------- 菜单页面切换 ----------
   页面清单从模式注册表派生(唯一权威, 见 js/mode-registry.js);
   win/playTime 是主循环/预算的静态页, 不属游玩模式 */
const overlay = document.getElementById('overlay');
const pages = {
  main: document.getElementById('menuMain'),
  playTime: document.getElementById('menuPlayTime'),
};
for (const m of ModeRegistry.all) {
  if (ModeRegistry.hasPage(m)) pages[m.id] = document.getElementById(ModeRegistry.pageId(m));
}
let curPage = 'main';
function showPage(id) {
  curPage = id;
  for (const k of Object.keys(pages)) pages[k].classList.toggle('active', k===id);
  /* 回主菜单换 menu 口径情绪(MOODS.menu=calm): 模式菜单页仍是该模式情绪, 不在此切 */
  if (id === 'main') {
    refreshPlayCards();
    AudioMixer.setMood(MOODS.menu);
  }
}

/* ---------- 每日预算 (DailyBudget) — 儿童时限的唯一账本 ----------
    游玩模式(竞技场/建造/坦克/下界) 的儿童时限与 专注训练营的每日限额 都记在
    js/daily-budget.js 的同一本预算里; 计时/午夜翻转/按日限额/迁移全部在那边 */
/* 游玩模式清单见 js/mode-registry.js(模式注册表 — 卡片/页面/按钮 id、
   儿童时限成员、限额文案的模式名全部由它派生, 不在此另持影子) */
const PLAY_LIMIT_MODES = ModeRegistry.playModeIds(); // 共享儿童时限的模式
let Budgets = null; // SyncDB.ready 后填充(镜像完成, 防"第二台设备读到旧本地值")
let playSaveT = 0;

function setupBudgets() {
  const store = {get: (k)=>SyncDB.get(k), set: (k, v)=>SyncDB.set(k, v), remove: (k)=>SyncDB.remove(k)};
  Budgets = mkDailyBudgets({
    storage: store,
    defs: {
      play: {capMsFor: (d) => PLAY_LIMIT_DEFAULT_MIN * 60 * 1000 + // 默认限额常量在 daily-budget.js; 临时调整走存储, 不写源码日期
                         readExtraMs(store.get(PLAY_EXTRA_KEY), d), // 家长加时: 本设备当日 {date,ms}, 次日自动失效
      warnAtMs: 60*1000},
      focus: {capMsFor: () => FOCUS_DAILY_MIN * 60 * 1000, capCount: FOCUS_DAILY_LEVELS},
      math: {capMsFor: () => MATH_DAILY_MIN * 60 * 1000, capCount: MATH_DAILY_LEVELS},
    },
  });
  Budgets.migrate(); // 旧 play_time_save / focus_camp_save.daily → daily_budget_save
  Budgets.play.onWarn(()=> showToast('⏰ 还剩 1 分钟哦'));
  Budgets.play.onExhausted(playTimeUp); // 每天至多触发一次(语音也只说一次)
  updateLimitText(); // 规则文案始终由限额生成(单一来源)
  refreshPlayCards();
}
function playBlocked() {
  return !!(Budgets && Budgets.play.blocked());
}
function updateLimitText() {
  if (!Budgets) return;
  const m = Math.round(Budgets.play.capMs()/60000);
  const t = document.getElementById('playTimeRule');
  if (t) {
    t.textContent = ModeRegistry.playModeNames().join(' + ') + '每天共 ' + m + ' 分钟' +
        ' · 专注训练营不受影响（每天 ' + FOCUS_DAILY_LEVELS + ' 关 / ' + FOCUS_DAILY_MIN + ' 分钟）';
  }
  const b = document.getElementById('buildTimeRule');
  if (b) {
    b.textContent = '你的建造会自动保存，换设备也能继续！和' +
        ModeRegistry.playModeNames('build').join('、') + '共享每天 ' + m + ' 分钟游玩时间';
  }
}
function refreshPlayCards() {
  const blocked = playBlocked();
  ModeRegistry.all.filter((m) => m.gated).forEach((mc)=>{
    const c = document.getElementById(ModeRegistry.cardId(mc));
    if (!c) return;
    c.classList.toggle('timedout', blocked);
    let b = c.querySelector('.timeout-badge');
    if (blocked && !b) {
      b = document.createElement('div'); b.className='timeout-badge'; b.textContent='🌙 今天玩完啦'; c.appendChild(b);
    }
    if (!blocked && b) b.remove();
  });
}
function showPlayTimeoutPage() {
  overlay.style.display = 'flex';
  showPage('playTime');
}
function playTimeUp() {
  if (Budgets) Budgets.play.flush();
  SpeechKit.speak('今天的游玩时间到啦，怪物们要休息了，明天再来挑战吧！');
  if (document.pointerLockElement) document.exitPointerLock(); // 事件异步, onLockChanged 尊重 playTime 页
  else {
    touchPlaying = false; overlay.style.display = 'flex';
  }
  showPlayTimeoutPage();
}

/* ---------- 模式切换 ---------- */
function switchMode(id) {
  if (Budgets && PLAY_LIMIT_MODES.indexOf(curModeId()) >= 0) Budgets.play.flush(); // 离开计费模式先落账
  if (MODES.cur && MODES.cur.cleanup) MODES.cur.cleanup();
  Fx.clear(); // 特效清场收口在 Fx, 不再亲手 dispose 私有数组
  clearWorld();
  MODES.cur = MODES[id];
  MODES.cur.init();
  /* BGM 情绪随模式走: 注册表 mood 字段是唯一权威(mode-registry.test 逐行
     断言必在 — 不手抄 || 'none' 回落, 对齐 GLOSSARY Tank 条"单一回落"判例);
     同 mood 续播不打断, 起曲计时/挂起保护收在 audio.js 的 MusicDirector,
     此处只报情绪 */
  AudioMixer.setMood(ModeRegistry.all.find((m) => m.id === id).mood);
}

/* ---------- 指针锁 / 遮罩 ---------- */
function onLockChanged(l) {
  overlay.style.display = l ? 'none' : 'flex';
  if (!l) {
    if (curPage === 'playTime') return; // 时限页由各自逻辑控制
    if (MODES.cur && MODES.cur.onMenu) MODES.cur.onMenu(); // 定义了菜单钩子的模式自行接管
    else showPage(curModeId() || 'main');
  }
}
/* 输入层路由注入(依赖倒置 seam, 见 input.js 头注释): 引擎不反向依赖应用层 */
Input.route = MODES;
Input.onLockChange = onLockChanged;

/* ---------- 坦克模式卡入口图标: 已移居 js/icons.js(菜单像素图标工坊) ---------- */

/* ---------- 主菜单与按钮(卡片 onclick / 返回 / 出发 全部由注册表派生) ---------- */
function buildMenu() {
  for (const mc of ModeRegistry.all) {
    document.getElementById(ModeRegistry.cardId(mc)).onclick = ()=>{
      if (mc.gated && playBlocked()) {
        showPlayTimeoutPage(); return;
      }
      if (curModeId() !== mc.id) switchMode(mc.id);
      if (ModeRegistry.hasPage(mc)) showPage(mc.id);
      if (mc.menu && MODES.cur.buildMenu) MODES.cur.buildMenu();
    };
    if (ModeRegistry.hasPage(mc)) { // 出发配置页的返回按钮
      const back = document.getElementById(ModeRegistry.backBtnId(mc));
      if (back) back.onclick = ()=> showPage('main');
    }
    if (mc.enter) { // "出发/进入"按钮: 锁指针进战场(触屏=touchPlaying)
      const eb = document.getElementById(ModeRegistry.enterBtnId(mc));
      if (eb) {
        eb.onclick = ()=>{
          if (curModeId() !== mc.id) switchMode(mc.id);
          requestLock();
        };
      }
    }
  }
  document.getElementById('playTimeHomeBtn').onclick = ()=> showPage('main');
}

/* ---------- 主循环 ---------- */
let last=performance.now(); let fps=0; let fpsAcc=0; let fpsCnt=0;
/* 全局错误可见化: rAF 回调里的异常默认被下一帧静默吞掉, 游戏会带病运行
   (传送门不切地图问题曾因此无从下手)。首个未捕获异常钉一条红条在屏幕
   顶端, 刷新即消失 — 孩子/家长看得见, 排查不用猜。 */
window.addEventListener('error', (e)=>{
  const old = document.getElementById('runtimeErr');
  if (old) return; // 只钉第一条, 不刷屏
  const d = document.createElement('div');
  d.id = 'runtimeErr';
  d.textContent = '⚠ 出了点问题: ' + (e.message || '未知错误') +
    (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '') + ' · 请截图反馈并刷新页面';
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#c0392b;color:#fff;' +
    'font:13px/1.6 sans-serif;padding:6px 12px;box-shadow:0 2px 8px rgba(0,0,0,.4)';
  document.body.appendChild(d);
});
/* 帧率上限 60: ProMotion(pad Pro 等 120Hz)设备 rAF 翻倍 → JS/渲染成本全翻,
   GPU 撑不住时帧率在 60~120 抖动, 锁 60 帧 pacing 反而稳; 60Hz 屏不受影响
   (阈值 16.4ms < 16.7ms 常规帧全部放行) */
const FRAME_MIN = 16.4;
/* 触屏自适应画质: 决策全在画质核心 QualityCore(js/quality-core.js,
   纯核心+单元测试), 这里只做半秒采样与施加;
   初始 DPR 拉满在 world.js, 桌面端不参与自适应 */
let quality = null;
function adaptDpr() {
  if (!IS_TOUCH) return;
  if (!quality) quality = QualityCore.mk(renderer.getPixelRatio());
  const next = QualityCore.step(quality, fps);
  if (next) renderer.setPixelRatio(next);
}
function loop(now) {
  requestAnimationFrame(loop);
  if (NET_DEAD) return; // 心跳失联: 冻结一切
  if (now - last < FRAME_MIN) return; // 未满一帧预算: 等下个 rAF
  let dt = (now-last)/1000; last=now;
  if (dt>0.05) dt=0.05;
  AudioMixer.tick(dt*1000); // BGM 调度步进: dt 秒→毫秒; context 挂起时 audio.js 内部有闸不推进

  if (locked || touchPlaying) {
    if (!Tank.driving()) physics(dt);
    Tank.update(dt); // 载具: 驾驶步进 · 在飞炮弹 · 履带动画, 每帧推进
    if (worldEvents.voidFall) { // 引擎事件 → 分发给当前模式的 onVoidFall
      worldEvents.voidFall = false;
      if (MODES.cur && MODES.cur.onVoidFall) MODES.cur.onVoidFall();
    }
    if (MODES.cur && MODES.cur.update) MODES.cur.update(dt);
    Fx.update(dt);
    /* 儿童时限: 游玩模式实际游玩时累计入每日预算 */
    if (Budgets && PLAY_LIMIT_MODES.indexOf(curModeId()) >= 0) {
      Budgets.play.accrue(dt*1000);
      if (now - playSaveT > 5000) {
        playSaveT = now; Budgets.play.flush();
      }
    }
  }
  pumpRemesh(2); // 编辑+距离环收尾: 每帧出队(编辑优先,近处优先); http 下经 Worker 后台建网格, file:// 兜底同步每帧 2 块(暂停时也要追平; 泵自动收口脏区块)

  const camDist = CameraRig.apply(camera, dt); // 相机装置: 视角模式/轨道/防穿墙
  Avatar.update(dt, camDist); // 玩家形象同步+动画(近距自动隐藏)
  Fx.wobble(dt, camera); // 震屏消费(衰减+抖动)收在 Fx, 须在相机位姿设定之后

  const aim = CameraRig.aim(camera); // 瞄准射线统一从眼睛出发(不因第三人称瞄到身后)
  const hit = raycastVoxel(aim.origin, aim.dir, PLAYER.reach);
  let hlShow = !!hit;
  if (hit && MODES.cur && MODES.cur.onHighlight) {
    if (MODES.cur.onHighlight(hit) === false) hlShow = false;
  }
  highlight.visible = hlShow;
  if (hlShow) highlight.position.set(hit.x+0.5, hit.y+0.5, hit.z+0.5);

  const tNow = now/1000;
  for (const s of sunSprites) {
    const k = 1 + Math.sin(tNow*1.5 + s.userData.phase)*0.08;
    s.scale.set(s.userData.base*k, s.userData.base*k, 1);
  }

  renderer.render(scene, camera);

  fpsAcc+=dt; fpsCnt++;
  if (fpsAcc>=0.5) {
    fps=Math.round(fpsCnt/fpsAcc); fpsAcc=0; fpsCnt=0; adaptDpr();
  }
  if (MODES.cur && MODES.cur.updateHud) MODES.cur.updateHud(hit); // hit 复用本帧唯一一次 raycast
}

/* ---------- 启动 ---------- */
let NET_DEAD = false; // 心跳失联 → 冻结游戏
function netDead() {
  if (NET_DEAD) return;
  NET_DEAD = true;
  SpeechKit.cancel();
  const d = document.createElement('div');
  d.id = 'netDead';
  d.innerHTML = '<div><h1>📡 与服务器的连接已断开</h1>' +
    '<p>训练师与方块世界的通道关闭了。</p>' +
    '<p class="tip">请确认电脑上的服务已启动（node server.js），<br>然后刷新本页面继续游玩。</p></div>';
  document.body.appendChild(d);
}
(function startHeartbeat() {
  if (typeof location === 'undefined' || location.protocol.indexOf('http') !== 0) return; // file:// 不检测
  let fails = 0;
  setInterval(()=>{
    if (NET_DEAD) return;
    const ctl = new AbortController();
    const to = setTimeout(()=>ctl.abort(), 5000);
    fetch('/ping', {cache: 'no-store', signal: ctl.signal})
        .then(()=>{
          clearTimeout(to); fails = 0;
        })
        .catch(()=>{
          clearTimeout(to); if (++fails >= 5) netDead();
        }); // 5×10s ≈ 50s < 60s
  }, 10000);
})();

function init() {
  const sp = document.getElementById('splash');
  if (sp) sp.remove();
  buildMenu();
  Avatar.setItem(PLAYER.heldItem); // 组合根装配默认手持物(参数表驱动, 见 config.js)
  SyncDB.ready.then(setupBudgets); // 服务器镜像完成后再建账本/迁移(进度零丢失的时序保证)
  switchMode('arena'); // 默认后台加载竞技场作为主菜单背景
  showPage('main');
  addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  requestAnimationFrame(loop);
}
init();
