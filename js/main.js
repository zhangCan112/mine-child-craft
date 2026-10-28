'use strict';
/* ============================================================
   主入口（Main）— 应用层(术语见 GLOSSARY.md 的"应用层/模式注册表/每日预算")
   ------------------------------------------------------------
   模式调度与主循环: 消费模式注册表派生菜单页/卡片接线, 驱动 MODES 框架的
   进入/退出/update/render 主循环, 装配每日预算(setupBudgets)与画质档决策
   (帧率采样喂 quality-core + LPM 守卫冻结 + GL 上下文丢失 UX)。
   依赖(均经全局名, 经典 script 顺序加载): js/ 全部引擎与应用模块 +
   js/modes/*.js 模式文件 — 后者必须先于本文件加载(由
   test/mode-registry.test.js 对着 index.html 断言, 手滑即红)。
   清场消费(switchMode 兜底清场, C4-T2): mobs.js 的 Mobs · tank.js 的
   Tank · drops.js 的 Drops · avatar.js 的 Avatar(实参 config.js 的 PLAYER);
   并跨文件写 voxel.js 的 flyMode(conventions §2.1 先例: input.js 写 pitch);
   主循环接线 js/hand-view.js 的 HandView(update 在 Avatar.update 后,
   render 在主渲染后 — 换装/挥击意图经 Avatar 镜像转发, design D2/D4/D5)。
============================================================ */

const MODES = {
  arena: ArenaMode,
  focus: FocusMode,
  math: MathMode,
  build: BuildMode,
  tank: TankRangeMode,
  adventure: AdventureMode,
  showroom: ShowroomMode,
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
    游玩模式(竞技场/建造/坦克/探险) 的儿童时限与 专注训练营的每日限额 都记在
    js/daily-budget.js 的同一本预算里; 计时/午夜翻转/按日限额/迁移全部在那边 */
/* 游玩模式清单见 js/mode-registry.js(模式注册表 — 卡片/页面/按钮 id、
   儿童时限成员、限额文案的模式名全部由它派生, 不在此另持影子) */
const PLAY_LIMIT_MODES = ModeRegistry.playModeIds(); // 共享儿童时限的模式
let Budgets = null; // SyncDB.ready 后填充(镜像完成, 防"第二台设备读到旧本地值")
let playSaveT = 0;

function setupBudgets() {
  const store = {get: (k)=>SyncDB.get(k), set: (k, v)=>SyncDB.set(k, v), remove: (k)=>SyncDB.remove(k)};
  Budgets = mkDailyBudgets({
    dev: DEV, // ?dev=1 预算全开: blocked 恒 false + warn/exhausted 不触发( docs/dev-mode-design.md D2)
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
  /* —— 兜底清场(C4-T2): 旧 cleanup 与新 init 之间的单一收口 ——
     为什么在这里: 各模式 cleanup 是散装清场, 漏写一件上一场状态就渗进
     新模式(对孩子是不解释自愈的坏状态); 收进切换单一出口, 与 Fx.clear/
     clearWorld 同拍。
     为什么是这五件: 共享引擎层的实体账与跨模式存活的状态 — Mobs/Tank/
     Drops 是共享模块, Avatar 跨模式存活, flyMode 是 voxel.js 的引擎级
     飞行态; 模式私有物(自管投射物/面板/计时队列)仍归各模式 cleanup。
     两个守恒契约:
     ① Tank.clear 只清实体不解除模式钩子(钩子在 tank-range.js 加载期一次
        注册, tank-range 自己就 cleanup+enterField 双清) — 无条件清安全
        幂等, 非坦克模式清空列表是零成本空转(常态)。
     ② Mobs/Drops 的 clear 会解除会话回调 — adventure init 本就是
        "先 clear 再重挂", 兜底必须在新 init 之前, 放 init 之后会抹掉
        新模式刚挂的回调。
     保守版只加不删: 各模式 cleanup 的共性行原样保留为幂等双保险,
     去重留给后续票评估。 */
  Mobs.clear(); // 清怪+解除击杀回调(新模式 init 重挂, adventure 契约)
  Tank.clear(); // 清载具实体(钩子常驻不解除 — Tank 契约, 见 tank.js clear 注释)
  Drops.clear(); // 清掉落物+解除收集回调
  Avatar.setItem(PLAYER.heldItem); // 手持物复位(剑/弓/铲不渗进其他模式)
  setFly(false); // 飞行态复位(不渗进新模式出生; 走意图入口)
  MODES.cur = MODES[id];
  MODES.cur.init();
  /* BGM 情绪随模式走: 注册表 mood 字段是唯一权威(mode-registry.test 逐行
     断言必在 — 不手抄 || 'none' 回落, 对齐 GLOSSARY Tank 条"单一回落"判例);
     同 mood 续播不打断, 起曲计时/挂起保护收在 audio.js 的 MusicDirector,
     此处只报情绪 */
  AudioMixer.setMood(ModeRegistry.all.find((m) => m.id === id).mood);
}

/* ---------- 关页兜底存档 ----------
   世界档是 5s 节流落盘(build/adventure 同款), 窗口内直接关页/刷新会丢最后
   几秒的世界改动——而任务/背包等即时档已落盘, 重进就出现「任务完成了、世界
   里却没发生」的错位(2026-10 探险树苗丢失排查)。模式可声明 onPageHide 同步
   落盘; 随后立即补发 push: sync.js 的 pagehide 监听先注册先跑, 推的是 save
   之前的旧缓存, 这里 save 已把新档写进 SyncDB.cache, 再 push 一发让服务器
   收到新档(按设备整份覆盖, 后到者赢)。localStorage 同步写在 pagehide 内
   安全; file:// 离线形态 push 为空转, 本地档已落。 */
addEventListener('pagehide', () => {
  if (MODES.cur && MODES.cur.onPageHide) MODES.cur.onPageHide();
  SyncDB.push();
});

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
/* 悬停报名(设计稿 menu-ui §2.2): 桌面指针停在卡上 0.65s 才报模式名 —
   扫过不吵、想要才说; 移出即取消。零文字依赖的 TTS 补充(MISSION);
   触屏无悬停不接; 打断政策归 SpeechKit(cancel-then-speak, 模式开场白优先) */
function wireCardVoice(mc, card) {
  if (!card || IS_TOUCH || typeof SpeechKit === 'undefined') return;
  let hoverT = 0;
  card.addEventListener('mouseenter', () => {
    clearTimeout(hoverT);
    hoverT = setTimeout(() => SpeechKit.speak(mc.name), 650);
  });
  card.addEventListener('mouseleave', () => clearTimeout(hoverT));
}

function buildMenu() {
  for (const mc of ModeRegistry.all) {
    const card = document.getElementById(ModeRegistry.cardId(mc));
    card.onclick = ()=>{
      sfx('click'); // 选中确认音(设计稿 menu-ui §2.2; 音效键既有, 注册表零改动)
      if (mc.gated && playBlocked()) {
        showPlayTimeoutPage(); return;
      }
      if (curModeId() !== mc.id) switchMode(mc.id);
      if (ModeRegistry.hasPage(mc)) showPage(mc.id);
      if (mc.menu && MODES.cur.buildMenu) MODES.cur.buildMenu();
    };
    wireCardVoice(mc, card);
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
/* ---------- GL 上下文丢失 UX(设计稿 docs/ipad5-performance-design.md 票③) ----------
   r128 内部已监听同款事件并 preventDefault+自复位渲染状态(调研 §3.1), 这里只做
   儿童可见提示与计数 — iOS 上 context lost 常是内存压力前兆, 计数供 PerfKit
   遥测(内存红线报警器, 调研 §2.6-3) */
let glLostCount = 0; /* 丢失计数(PerfKit 遥测读) */
let glLostBar = null;
renderer.domElement.addEventListener('webglcontextlost', () => {
  glLostCount++;
  if (glLostBar) return; // 提示条已在场, 只计数
  glLostBar = document.createElement('div');
  glLostBar.id = 'glLostBar';
  glLostBar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:#8e44ad;' +
      'color:#fff;font:15px/1.8 sans-serif;padding:8px 14px;text-align:center;';
  glLostBar.textContent = '🖥️ 平板累了，正在歇口气…如果一直没画面，请刷新这一页';
  document.body.appendChild(glLostBar);
  SpeechKit.speak('平板累了，正在歇口气，马上就好');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  if (glLostBar) {
    glLostBar.remove(); glLostBar = null;
  }
  showToast('🖼️ 画面回来啦');
});
/* 帧率上限 60: ProMotion(pad Pro 等 120Hz)设备 rAF 翻倍 → JS/渲染成本全翻,
   GPU 撑不住时帧率在 60~120 抖动, 锁 60 帧 pacing 反而稳; 60Hz 屏不受影响
   (阈值 16.4ms < 16.7ms 常规帧全部放行) */
const FRAME_MIN = 16.4;
/* 触屏自适应画质: 决策全在画质核心 QualityCore(js/quality-core.js,
   纯核心+单元测试), 这里只做半秒采样与施加;
   初始 DPR 拉满在 world.js, 桌面端不参与自适应 */
let quality = null;
/* LPM 守卫(设计稿 docs/ipad5-performance-design.md 票④): 低电量模式把 rAF 钉在
   30fps, 不冻结会被降档逻辑误读为"带不动"一路降到底且永不回升 — 锁存期间
   adaptDpr 直接返回(冻结档位) */
let lpmGuard = IS_TOUCH ? QualityCore.mkLpmGuard() : null;
let lpmOn = false; /* 守卫锁存态(PerfKit 遥测读, conventions §2.1 跨文件读先例) */
function adaptDpr() {
  if (!IS_TOUCH) return;
  if (lpmOn) return; // LPM 冻结: 30fps 是系统省电, 不是设备带不动
  if (!quality) quality = QualityCore.mk(renderer.getPixelRatio());
  const next = QualityCore.step(quality, fps);
  if (next) renderer.setPixelRatio(next);
}
function loop(now) {
  requestAnimationFrame(loop);
  if (NET_DEAD) return; // 心跳失联: 冻结一切
  if (now - last < FRAME_MIN) return; // 未满一帧预算: 等下个 rAF
  let dt = (now-last)/1000; last=now;
  if (lpmGuard) lpmOn = lpmGuard.feed(dt*1000); /* 原始帧间隔(钳制前, 毫秒)喂 LPM 守卫 */
  if (dt>0.05) dt=0.05;
  AudioMixer.tick(dt*1000); // BGM 调度步进: dt 秒→毫秒; context 挂起时 audio.js 内部有闸不推进

  if (locked || touchPlaying) {
    if (!Tank.driving()) physics(dt);
    Tank.update(dt); // 载具: 驾驶步进 · 在飞炮弹 · 履带动画, 每帧推进
    pumpFluids(dt); // 流体计划刻泵(liquid D5): 20tps 累积, 空队列零成本
    if (worldEvents.voidFall) { // 引擎事件 → 分发给当前模式的 onVoidFall
      worldEvents.voidFall = false;
      if (MODES.cur && MODES.cur.onVoidFall) MODES.cur.onVoidFall();
    }
    if (worldEvents.splash) { // 高速入水水花(liquid D10): 音效经声音清单注册表
      worldEvents.splash = false;
      sfx('splash');
    }
    if (MODES.cur && MODES.cur.update) MODES.cur.update(dt);
    /* 昼夜推进(引擎机制, 何时走表=模式政策, 设计稿 mc-daylight-torch §2.2):
       暂停(菜单/未锁定)不推进; dayTime/dayCycleOn 是 world.js 顶层绑定
       (跨文件可写), 场景驱动收在 world.applyDaylight */
    if (dayCycleOn) {
      dayTime = Daylight.advance(dayTime, dt);
      applyDaylight();
    }
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
  updateFluidFog(); // 头没水/岩浆的雾色切换(liquid D10, 出水复原)
  Avatar.update(dt, camDist); // 玩家形象同步+动画(近距自动隐藏)
  HandView.update(dt); // 第一人称手持视图: 可见性自判+动画推进(design D5)
  Fx.wobble(dt, camera); // 震屏消费(衰减+抖动)收在 Fx, 须在相机位姿设定之后

  const aim = CameraRig.aim(camera); // 瞄准射线统一从眼睛出发(不因第三人称瞄到身后)
  const hit = raycastVoxel(aim.origin, aim.dir, PLAYER.reach);
  let hlShow = !!hit;
  if (hit && MODES.cur && MODES.cur.onHighlight) {
    if (MODES.cur.onHighlight(hit) === false) hlShow = false;
  }
  if (hit && hlShow) hlShow = highlightShape(hit); /* 位置+缩放+框去留(world.js): 贴形薄块不画框(2026-10-28 用户反馈「边框干掉」) */
  highlight.visible = hlShow;

  renderer.render(scene, camera);
  HandView.render(renderer, camera); // 手部通道恰在主渲染后: 清深度再画, 手永不插墙(design D4)

  fpsAcc+=dt; fpsCnt++;
  if (fpsAcc>=0.5) {
    fps=Math.round(fpsCnt/fpsAcc); fpsAcc=0; fpsCnt=0; adaptDpr();
  }
  PerfKit.tick(now); // 性能 HUD(默认关闭零成本, ?perf=1 常驻, 设计稿票②)
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
  /* 加载屏退场(设计稿 menu-ui §1): .done 触发 0.45s 淡出; 600ms 兜底
     remove — reduced-motion/旧引擎下 transition 可能不发生, 不依赖事件 */
  const sp = document.getElementById('splash');
  if (sp) {
    sp.classList.add('done');
    setTimeout(() => sp.remove(), 600);
  }
  /* dev 解锁: DEV 旗标(config.js 读 ?dev=1, 全游戏唯一口径)给 body 加
     dev-on — 体验馆等 dev 向模式卡的可见开关。CSS 默认隐藏是构造性防闪现
     (样式表先于脚本生效), 这里只做解锁(旗标读取与 ?touch=1 同款惯例收在
     config.js; DEV 同时旁路预算/关卡解锁, 见 docs/dev-mode-design.md) */
  if (DEV) document.body.classList.add('dev-on');
  PerfKit.init(); // 性能 HUD 自检+心跳(?perf=1 才有实质动作, 设计稿票②)
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
