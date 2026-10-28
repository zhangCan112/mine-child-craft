'use strict';
/* ============================================================
   Robot World (怪物指挥官棋盘世界宿主) — 应用层·库(THREE/DOM 装配)
   ------------------------------------------------------------
   一句话职责: 把 robot-core 的纯数据棋盘装进 3D 世界——loadScene 建浮空
   棋盘岛、按怪物包 spawn Q 版木偶(提线木偶剧场, 零战斗 AI), 按 stepSim
   意图演回放/单步/演示/倒放四类动画并联动脚印与碎屑; 判定与账本零逻辑
   (全在 RobotCore), 本文件只演不算。
   interface: RobotWorld{build(level, boardIdx) → handle · tick(dt) · stop()}
     · handle{board · sim · par · level · boardIdx · play(cards, o) ·
       stepOnce(card, cb) · demo(cards, previewSec, cb) · rollback(trace, cb) ·
       stop()} — o = {onStep(i, intent) 程序条卡拉OK高亮, onDone(status, sim)};
       status ∈ win/bonk/splash/out; tick 由 RobotMode.update 每帧喂
   依赖(均经全局名, 调用期解析): RobotCore(js/robot-core.js) ·
     boardSeed/boardOpts/paramsFor/ROBOT_PACKS(js/robot-levels.js, 加载序
     在本文件之前) · Mobs(js/mobs.js, 意图 API setPos/steer/settle/gait/
     scaleTo/stagger/remove — 位移/朝向零直写, pose 叠加与 pos.y 例外见
     mobs.js 白名单) · loadScene/setBlockRaw/getBlock/editBlock/markDirty/
     clearWorld(js/world.js·voxel.js) · SceneKit(js/scene-kit.js) ·
     Fx(js/effects.js) · ModeKit.spawn(js/mode-kit.js) · sfx(js/audio.js) ·
     CameraRig(js/camera-rig.js, 载具锚 mount 装悬停无人机镜头: apply 恒 0
     按契约隐藏玩家形象 — 看盘不被小人挡);
     index.html 装载序 robot-levels → robot-core → robot-world → modes/robot
   可测性: THREE/DOM 全惰性(顶层零执行), Node 测试可安全加载(vm 直载,
     boot.test.js 全链冒烟兜底); 判定与模拟纯逻辑在 robot-core(有单测)
   ============================================================ */

const RobotWorld = (() => {
  /* ---------- 节奏与相机参数表(真机试玩调参) ---------- */
  const ROBOT_GROUND = 12; // 棋盘岛顶层 y(数学世界轨 hop 同款浮岛高程)
  const ROBOT_CAM_PITCH = -0.64; // 固定俯角看整盘(MATH_W_CAM_PITCH 先例; 真机试玩调参: 配合无人机眼位让棋盘居中)
  const ROBOT_PUPPET_SCALE = 0.6; // Q 版化(设计稿 §3.2: 铁傀儡 h2.8 也放得下)
  const ROBOT_WALK_SPD = 2.6; // gait 摆腿速度(格/秒 ≈ 每格 380ms 的步频)
  /* 回放节奏(ms/卡, 每卡一步): turn 原地转向 · move 前进一格 ·
     bonk/splash 撞墙落水带停顿 · skill 特技+碎屑停顿 · nap 打盹一回合 ·
     win 到旗慢步庆祝 · spin 陷阱卡转圈 · nothing 特技空放耸肩 ·
     idle 空转卡 · roll 倒放单步(比前进略快, 滑稽感) */
  const ROBOT_T = {
    turn: 220, move: 380, bonk: 650, splash: 650, skill: 800,
    nap: 900, win: 900, spin: 600, nothing: 400, idle: 200, roll: 300,
  };
  /* 方块映射(config BLOCKS 实有 id): GROUND=草 · HARD=石 · SOFT=木板箱
     (可炸可砸) · WATER=水(glass 透渲) · GOAL=灯块(自发光=真旗) ·
     LEDGE=圆石抬升一格 · 起点石英垫 · 旗杆木 · 旗面黄羊毛 */
  const ROBOT_BLOCKS = {ground: 1, hard: 3, soft: 6, water: 24, goal: 19,
    ledge: 4, start: 17, pole: 5, flag: 14};
  const ROBOT_PLATFORM = {dz: 4, lift: 3}; // 观景台: 棋盘南侧 dz 格外 · 抬升 lift 格

  /* 计时器收口: stop 一次清空(math-world mWTimers 同构的本地副本, 不跨
     文件复用是刻意的 — 生命周期归各自 handle) */
  function rwTimers() {
    const ts = [];
    return {
      after(ms, fn) {
        const id = setTimeout(() => {
          const k = ts.indexOf(id);
          if (k >= 0) ts.splice(k, 1);
          fn();
        }, ms);
        ts.push(id);
        return id;
      },
      stop() {
        ts.forEach((id) => clearTimeout(id));
        ts.length = 0;
      },
    };
  }

  let cur = null; // 当前 handle(build 换盘先收旧场)
  let curTick = null; // 当前场的每帧推进闭包(tick 委托)

  /* ---------- 模块入口 ---------- */

  function build(level, boardIdx) {
    if (cur) stop(); // 换盘先收旧场(stop 全套: 计时/木偶/世界, 幂等)
    const board = RobotCore.mkBoard(boardSeed(level.i, boardIdx), boardOpts(level));
    const G = ROBOT_GROUND;
    const x0 = 64 - Math.floor(board.w / 2);
    const z0 = 64 - Math.floor(board.h / 2);
    const T = rwTimers();
    const relay = !!(typeof paramsFor === 'function' && paramsFor(level).relay);
    const cellAt = (x, z) =>
      (x < 0 || x >= board.w || z < 0 || z >= board.h) ? -1 : board.cells[z * board.w + x];
    const yawOf = (dir) => {
      const d = RobotCore.DIRS[dir] || RobotCore.DIRS[0];
      return Math.atan2(d.dx, d.dz); // 模型面朝 +Z(mobs.js wanderStep 同式)
    };
    const wx = (x) => x0 + x + 0.5; // 格心世界坐标
    const wz = (z) => z0 + z + 0.5;
    const cellOf = (m) => ({x: Math.round(m.pos.x - x0 - 0.5), z: Math.round(m.pos.z - z0 - 0.5)});
    const sfxSafe = (k) => {
      if (typeof sfx === 'function') sfx(k);
    };

    /* ===== 装场(场景装填纪律: 进场装场, 退出清场, 不写建造存档) ===== */
    loadScene(() => {
      const mg = 1; // 岛缘草圈一圈(旗杆与树都站在圈上)
      SceneKit.fill(x0 - mg, G - 3, z0 - mg, x0 + board.w, G - 1, z0 + board.h, 2); // 泥土芯
      SceneKit.fill(x0 - mg, G, z0 - mg, x0 + board.w, G, z0 + board.h, 1); // 草圈
      for (let z = 0; z < board.h; z++) {
        for (let x = 0; x < board.w; x++) {
          const t = cellAt(x, z);
          let id = ROBOT_BLOCKS.ground;
          if (x === board.start.x && z === board.start.z) id = ROBOT_BLOCKS.start;
          else if (t === RobotCore.CELL.HARD) id = ROBOT_BLOCKS.hard;
          else if (t === RobotCore.CELL.SOFT) id = ROBOT_BLOCKS.soft;
          else if (t === RobotCore.CELL.WATER) id = ROBOT_BLOCKS.water;
          else if (t === RobotCore.CELL.GOAL) id = ROBOT_BLOCKS.goal;
          setBlockRaw(x0 + x, G, z0 + z, id);
          /* 高台 = 草面上再抬一块圆石(怪踩其上, groundTop 自动高一格) */
          if (t === RobotCore.CELL.LEDGE) setBlockRaw(x0 + x, G + 1, z0 + z, ROBOT_BLOCKS.ledge);
        }
      }
      /* 终点旗: 杆立在终点南侧岛缘(不占棋盘格), 金色旗面 */
      const gx = x0 + board.goal.x;
      const gz = z0 + board.goal.z;
      SceneKit.fill(gx, G + 1, gz + 1, gx, G + 3, gz + 1, ROBOT_BLOCKS.pole);
      setBlockRaw(gx + 1, G + 3, gz + 1, ROBOT_BLOCKS.flag);
      /* 北缘两棵树(构图框景, 不进棋盘不挡走子) */
      SceneKit.tree(x0 - mg, G + 1, z0 - mg);
      SceneKit.tree(x0 + board.w, G + 1, z0 - mg);
      /* 观景台: 棋盘南侧上方 3×3 石台 — 玩家出生其上俯视整盘 */
      const pz = z0 + board.h + ROBOT_PLATFORM.dz;
      SceneKit.fill(63, G + ROBOT_PLATFORM.lift, pz - 1, 65, G + ROBOT_PLATFORM.lift, pz + 1,
          ROBOT_BLOCKS.hard);
    });
    /* 注: 水格用 B_WATER 裸 setBlockRaw(fluidLv 保持 0=源); 四邻同层实心
       无处可流, 计划刻泵下静态安全 — 纯视觉落水观感, 不参与流体玩法 */

    /* 出生: 观景台正上(物理落地即站台; ModeKit.spawn 记住出生点供 voidFall 兜底) */
    const spawnZ = z0 + board.h + ROBOT_PLATFORM.dz;
    ModeKit.spawn(64.5, G + ROBOT_PLATFORM.lift + 1, spawnZ + 0.5,
        {yaw: 0, pitch: ROBOT_CAM_PITCH});
    /* 载具锚 mount(坦克上车同款契约, tank.js 692 行先例): 眼位锚在棋盘南缘
       上空 → 相机换 CAM_TANK 悬停无人机轨道看盘; apply 恒返回 0 → 玩家形象
       按契约隐藏(真机试玩反馈: 第三人称小人挡棋盘, 本模式只需看盘排指令)。
       锚点 fn 只供位置 — 朝向仍走全局 yaw/pitch(frame 每帧复归, 白名单内) */
    CameraRig.mount(() =>
      ({x: x0 + board.w / 2, y: G + 5.4, z: z0 + board.h - 0.5}));

    /* ===== 木偶 ===== */
    const pack = ROBOT_PACKS.find((p) => p.key === level.pack) || {};
    /* relay 包无双怪主角(ROBOT_PACKS.mob=null): A 段铁傀儡/B 段苦力怕方言 */
    const mobA = Mobs.spawn(relay ? 'golem' : (pack.mob || 'creeper'),
        wx(board.start.x), wz(board.start.z), {yaw: yawOf(board.start.dir)});
    Mobs.scaleTo(mobA, ROBOT_PUPPET_SCALE);
    /* 交接格 = par 解落格序列的中点(自定口径: 偶数个落格取偏后一半的第一格;
       relay 关双木偶, B 停在交接格面向镜头等待接力) */
    const handover = relayHandover(board);
    const mobB = (relay && handover) ?
      Mobs.spawn('creeper', wx(handover.x), wz(handover.z), {yaw: 0}) : null;
    if (mobB) Mobs.scaleTo(mobB, ROBOT_PUPPET_SCALE);
    const puppets = mobB ? [mobA, mobB] : [mobA];

    /* ===== 回放状态机(计时器链排卡, 每帧 tick 推进插值) ===== */
    let anim = null; // 当前动画 {kind: move|turn|spin|nap|pause, mob, t, dur, ...}
    let busy = false; // 整段链(play/demo/rollback)进行中
    let onceBusy = false; // 单步动画未走完(直接驱动节流)
    let activeMob = mobA; // 当前执行木偶(relay 交接后切 B)
    let handed = false; // 已交接(单向 A→B)
    const marks = []; // 演示脚印 [{x, y, z, prev}]

    const handle = {
      board, sim: RobotCore.mkSim(board), par: RobotCore.parOf(board), level, boardIdx,
      play, stepOnce, demo, rollback, stop: stopHandle,
    };

    function resetToStart() {
      handle.sim = RobotCore.mkSim(board);
      anim = null;
      activeMob = mobA;
      handed = false;
      clearMarks();
      placePuppets();
    }
    function placePuppets() {
      Mobs.setPos(mobA, wx(board.start.x), wz(board.start.z));
      Mobs.steer(mobA, yawOf(board.start.dir));
      Mobs.settle(mobA, 1); // dt=1 → 贴地系数拉满, 一步落格
      if (mobB && handover) {
        Mobs.setPos(mobB, wx(handover.x), wz(handover.z));
        Mobs.steer(mobB, 0); // 面向镜头(+Z 南)等待接力
        Mobs.settle(mobB, 1);
      }
    }

    /* ===== 演示脚印: 落格逐格亮成灯块, previewSec 秒内按序淡出(0=不消退) ===== */
    function footY(x, z) {
      return cellAt(x, z) === RobotCore.CELL.LEDGE ? G + 1 : G; // 高台脚印落在抬升块面
    }
    function footAt(x, z) {
      const fy = footY(x, z);
      const lx = x0 + x;
      const lz = z0 + z;
      if (marks.some((mk) => mk.x === lx && mk.y === fy && mk.z === lz)) return;
      marks.push({x: lx, y: fy, z: lz, prev: getBlock(lx, fy, lz)});
      setBlockRaw(lx, fy, lz, ROBOT_BLOCKS.goal); // 灯块亮起
      markDirty(lx, lz);
    }
    function restoreMark(mk) {
      setBlockRaw(mk.x, mk.y, mk.z, mk.prev);
      markDirty(mk.x, mk.z);
      const i = marks.indexOf(mk);
      if (i >= 0) marks.splice(i, 1);
    }
    function clearMarks() {
      while (marks.length) restoreMark(marks[0]);
    }
    function footFade(previewSec) {
      if (!previewSec || !marks.length) return; // 0=不消退(带0/1 教学关, 设计稿 §5)
      const n = marks.length;
      marks.slice().forEach((mk, k) => { // 按序波浪淡出, 总窗 = previewSec
        T.after(previewSec * 1000 * (k + 1) / n, () => restoreMark(mk));
      });
    }

    /* ===== 卡步演出: 意图 → 动画/音效/世界副作用(棋盘改动仅炸格一处) ===== */
    function intentMs(intent) {
      switch (intent) {
        case 'turn': return ROBOT_T.turn;
        case 'move': return ROBOT_T.move;
        case 'bonk': return ROBOT_T.bonk;
        case 'splash': return ROBOT_T.splash;
        case 'skill': return ROBOT_T.skill;
        case 'nap': return ROBOT_T.nap;
        case 'win': return ROBOT_T.win;
        case 'spin': return ROBOT_T.spin;
        case 'nothing': return ROBOT_T.nothing;
        default: return ROBOT_T.idle; // idle/未知卡: 安全空转
      }
    }
    /* before = 这张卡执行前的 sim 态(格心硬吸附消除计时器/插值累计漂移) */
    function act(intent, s, before) {
      if (intent === 'move' || intent === 'win') {
        anim = {kind: 'move', mob: activeMob, fx: wx(before.x), fz: wz(before.z),
          tx: wx(s.x), tz: wz(s.z), y0: activeMob.yaw, y1: yawOf(s.dir),
          t: 0, dur: (intent === 'win' ? ROBOT_T.win : ROBOT_T.move) / 1000};
        if (intent === 'win') {
          sfxSafe('win');
          if (typeof Fx !== 'undefined' && Fx && Fx.pop) {
            Fx.pop(wx(s.x), G + 2.2, wz(s.z), {color: 0x7cfc00, r0: 0.6, r1: 3.5, dur: 0.5});
          }
        } else {
          sfxSafe('click'); // 每步一声轻响(步点与程序条高亮同拍)
        }
        return;
      }
      const base = {t: 0, dur: intentMs(intent) / 1000};
      if (intent === 'turn') {
        anim = Object.assign({kind: 'turn', mob: activeMob, y0: activeMob.yaw, y1: yawOf(s.dir)}, base);
        sfxSafe('click');
      } else if (intent === 'spin') {
        anim = Object.assign({kind: 'spin', mob: activeMob, y0: activeMob.yaw}, base);
        sfxSafe('click');
      } else if (intent === 'nap') {
        anim = Object.assign({kind: 'nap', mob: activeMob}, base);
        sfxSafe('breath'); // 打盹呼噜(SFX_KINDS 登记键)
      } else if (intent === 'skill') {
        skillBoom(s); // intent 'skill' 只从 boom/smash 分支来(climb/glide 在核心折算成 move/bonk)
        anim = Object.assign({kind: 'pause', mob: activeMob}, base);
      } else if (intent === 'bonk' || intent === 'splash') {
        sfxSafe(intent); // hit/splash 都在 SFX_KINDS
        Mobs.stagger(activeMob, 0.35); // 摇头晃脑(零惩罚观感硬直)
        anim = Object.assign({kind: 'pause', mob: activeMob}, base);
      } else {
        anim = Object.assign({kind: 'pause', mob: activeMob}, base); // nothing/idle: 耸肩空转
      }
    }
    /* 软障碍炸开成坑(editBlock 自带碎屑反馈; 木板无级联旗标零连带) */
    function skillBoom(s) {
      const d = RobotCore.DIRS[s.dir];
      if (typeof editBlock === 'function') editBlock(x0 + s.x + d.dx, G, z0 + s.z + d.dz, 0);
      sfxSafe('boom');
    }

    /* ===== 四类驱动 ===== */

    /* 整段回放: 重置到起点, 逐卡走 stepSim 账本, win 提前收(与 simulate 同口径) */
    function play(cards, o) {
      const cb = o || {};
      stopRun();
      resetToStart();
      busy = true;
      const seq = Array.isArray(cards) ? cards.slice() : [];
      let i = 0;
      let lastIntent = 'idle';
      const finish = () => {
        busy = false;
        const s = handle.sim;
        const status = s.won ? 'win' :
          (lastIntent === 'bonk' ? 'bonk' : lastIntent === 'splash' ? 'splash' : 'out');
        if (cb.onDone) cb.onDone(status, s);
      };
      const next = () => {
        if (!busy) return; // stop() 中途收口: 链即断
        if (i >= seq.length || handle.sim.won) return finish();
        const before = handle.sim;
        const r = RobotCore.stepSim(board, before, seq[i]);
        handle.sim = r.sim;
        lastIntent = r.intent;
        if (cb.onStep) cb.onStep(i, r.intent); // 程序条第 i 张卡拉OK高亮(模式层消费)
        act(r.intent, r.sim, before); // 用切换前的木偶演这一卡, 落格后再判交接
        relayCheck(r.sim);
        i++;
        T.after(intentMs(r.intent), next);
      };
      next();
    }

    /* 直接驱动(带0 tut): 单卡动画一步, 动画走完再报意图(模式层接成败反馈) */
    function stepOnce(card, cb) {
      if (busy || onceBusy) return; // 整段链进行中/上一步未完: 不接单步
      if (cellOf(activeMob).x !== handle.sim.x || cellOf(activeMob).z !== handle.sim.z) {
        resetToStart(); // 演示后木偶停在别处: 先归位再单步(直接驱动恒从 sim 态起步)
      }
      const before = handle.sim;
      const r = RobotCore.stepSim(board, before, card);
      handle.sim = r.sim;
      onceBusy = true;
      act(r.intent, r.sim, before);
      relayCheck(r.sim);
      T.after(intentMs(r.intent), () => {
        onceBusy = false;
        if (cb) cb(r.intent);
      });
    }

    /* 演示(带2 演示复现载体): 木偶按 cards 走一遍(缺省 par 解), 脚印逐格
       亮起, 走完后 previewSec 秒内淡出(0=不消退); cb 在走完时调, 淡出异步 */
    function demo(cards, previewSec, cb) {
      stopRun();
      resetToStart();
      const seq = Array.isArray(cards) ? cards.slice() : RobotCore.parSolution(board);
      if (!seq || !seq.length) {
        if (cb) cb();
        return;
      }
      busy = true;
      let dSim = RobotCore.mkSim(board); // 演示是预览: 不动 handle.sim(编辑器状态)
      let i = 0;
      const next = () => {
        if (!busy) return;
        if (i >= seq.length || dSim.won) {
          busy = false;
          footFade(previewSec);
          if (cb) cb();
          return;
        }
        const before = dSim;
        const r = RobotCore.stepSim(board, before, seq[i]);
        dSim = r.sim;
        act(r.intent, r.sim, before);
        if (r.intent === 'move' || r.intent === 'win') footAt(r.sim.x, r.sim.z); // 落格亮脚印
        i++;
        T.after(intentMs(r.intent), next);
      };
      next();
    }

    /* 倒放回起点: 沿 trace 的落格序列(含到旗)倒着走回起点, 归位后 cb */
    function rollback(trace, cb) {
      stopRun();
      const landings = (Array.isArray(trace) ? trace : [])
          .filter((st) => st.intent === 'move' || st.intent === 'win')
          .map((st) => ({x: st.x, z: st.z}));
      busy = true;
      const path = landings.reverse();
      path.push({x: board.start.x, z: board.start.z});
      let from = {x: handle.sim.x, z: handle.sim.z};
      let k = 0;
      const hop = () => {
        if (!busy) return;
        if (k >= path.length) { // 归位: 状态回到起点(倒放完即重编)
          handle.sim = RobotCore.mkSim(board);
          Mobs.steer(activeMob, yawOf(board.start.dir));
          busy = false;
          if (cb) cb();
          return;
        }
        const to = path[k];
        const dx = to.x - from.x;
        const dz = to.z - from.z;
        anim = {kind: 'move', mob: activeMob, fx: wx(from.x), fz: wz(from.z),
          tx: wx(to.x), tz: wz(to.z), y0: activeMob.yaw,
          y1: (dx || dz) ? Math.atan2(dx, dz) : activeMob.yaw,
          t: 0, dur: ROBOT_T.roll / 1000};
        sfxSafe('door_swing'); // 倒放滑稽步(SFX_KINDS 登记键)
        from = to;
        k++;
        T.after(ROBOT_T.roll, hop);
      };
      hop();
    }

    /* 链与动画收口(不归位木偶 — 归位是 stopHandle/resetToStart 的事) */
    function stopRun() {
      T.stop(); // 连带脚印淡出计时一并清(残留亮脚印由 resetToStart 复原)
      busy = false;
      anim = null;
    }
    /* 取消一切计时/动画、木偶归位(幂等) */
    function stopHandle() {
      stopRun();
      onceBusy = false;
      resetToStart();
    }

    /* relay 交接: 落在交接格之后的卡归 B 木偶演(单向; resetToStart 复位) */
    function relayCheck(s) {
      if (!mobB || handed || !handover) return;
      if (s.x === handover.x && s.z === handover.z) {
        handed = true;
        activeMob = mobB;
      }
    }

    /* ===== 每帧推进(RobotMode.update 喂): 插值/转向/打盹/步态/合批渲染 ===== */
    function frame(dt) {
      Mobs.update(dt); // 引擎本能先走(名牌跟随/受击闪白/踉跄计时/尸体回收)
      if (anim) stepAnim(dt);
      for (const m of puppets) {
        const moving = anim && anim.kind === 'move' && anim.mob === m;
        Mobs.gait(m, dt, moving ? ROBOT_WALK_SPD : 0); // 走路摆腿/扇翅, 静止衰减
        if (anim && anim.kind === 'nap' && anim.mob === m) {
          m.pose.head = -0.5 + Math.sin(anim.t * 3) * 0.15; // 打盹点头(gait 之上叠加, 白名单内)
        } else if (m.pose.head) {
          m.pose.head = 0; // 醒了抬头
        }
      }
      Mobs.render(); // 帧序契约: 本帧位移必须本帧上屏(mobs.js 头注释)
      pitch = ROBOT_CAM_PITCH; // 固定俯角看整盘(voxel.js 玩家段白名单例外, 已登记)
    }
    function stepAnim(dt) {
      anim.t += dt;
      const k = Math.min(1, anim.t / anim.dur);
      if (anim.kind === 'move') {
        Mobs.setPos(anim.mob, anim.fx + (anim.tx - anim.fx) * k, anim.fz + (anim.tz - anim.fz) * k);
        Mobs.steer(anim.mob, anim.y0 + yawDelta(anim.y0, anim.y1) * k);
        Mobs.settle(anim.mob, dt); // 爬台阶坎自然贴地(LEDGE 抬升/炸坑低洼都靠它)
      } else if (anim.kind === 'turn') {
        Mobs.steer(anim.mob, anim.y0 + yawDelta(anim.y0, anim.y1) * k);
      } else if (anim.kind === 'spin') {
        Mobs.steer(anim.mob, anim.y0 + Math.PI * 2 * k); // 陷阱卡原地转一圈
      } // pause/nap: 定格(打盹点头在 frame 叠加)
      if (k >= 1) anim = null;
    }
    /* 最短弧转向差(±π), 免得转远路 */
    function yawDelta(a, b) {
      let d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return d;
    }

    curTick = frame;
    cur = handle;
    return handle;
  }

  /* relay 交接格: par 解落格序列的中点(不可解/过短返 null, 该关退化为单木偶) */
  function relayHandover(board) {
    const sol = RobotCore.parSolution(board);
    if (!sol) return null;
    const landings = RobotCore.simulate(board, sol).trace
        .filter((st) => st.intent === 'move' || st.intent === 'win');
    if (landings.length < 2) return null;
    const mid = landings[Math.floor(landings.length / 2)];
    return {x: mid.x, z: mid.z};
  }

  function tick(dt) {
    if (curTick) curTick(dt);
  }

  /* 模式 cleanup 收口: 当前 handle.stop + 木偶回收 + 退场清场(幂等) */
  function stop() {
    CameraRig.mount(null); // 退模式还原玩家轨道(tank.js 683 行下车同款; 幂等)
    if (!cur) return;
    const h = cur;
    cur = null;
    curTick = null;
    h.stop(); // 计时/动画收口 + 木偶归位
    Mobs.clear(); // 木偶回收(引擎清场收口: 名牌一并; 清场期无他场怪)
    clearWorld(); // 场景装填纪律: 退出清场(幂等), 不写建造存档
  }

  return {build, tick, stop};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = RobotWorld;
