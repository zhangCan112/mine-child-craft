"use strict";
/* ============================================================
   坦克演习场 (TankRangeMode, 术语见 GLOSSARY.md) — 应用层
   ------------------------------------------------------------
   载具能力的第一个投放场: 平地 + 围栏 + 履带爬坡台阶。
   政策全在此层(引擎不知道"提示"与"语音"):
   · E 键与触屏 🚙 按钮同走 Tank.toggle(单一入口)
   · 靠近邀请语音 10 秒节流; 上下车话术随 toggle 结果
   · Esc/菜单保底下车; 不挖不放, 隐藏方块高亮
   场景每次进入重建(switchMode 已 clearWorld), 天然"退出还原"。
   ============================================================ */
const TANK_RANGE = {
  x0: 34, z0: 34, x1: 94, z1: 94,        // 场地范围(128×128 世界居中)
  groundY: 12,                            // 草地顶层(y=12, 站立面 y=13)
  tank:  { x: 64, z: 70, yaw: 0 },        // 坦克初始位(朝 -Z 开阔地)
  spawn: { x: 67.5, z: 74, yaw: Math.PI } // 玩家出生在坦克侧后, 面向坦克
};

let speakArmed = 10;                      // 邀请语音计时: 初始即"到点"(首靠近就说)

function speakForToggle(r){
  if(r === 'entered'){ SpeechKit.speak('开坦克喽！'); showToast('🚙 上车！W 前进 · S 倒车 · A D 转向 · E 下车'); }
  else if(r === 'exited'){ SpeechKit.speak('下车喽，再见！'); showToast('🚙 下车'); }
  else if(r === 'far'){ showToast('🚙 先走近坦克一点'); }
}

function buildRange(){
  const R = TANK_RANGE;
  SceneKit.fill(R.x0, R.groundY-2, R.z0, R.x1, R.groundY-1, R.z1, 2);   // 泥土基层
  SceneKit.fill(R.x0, R.groundY,   R.z0, R.x1, R.groundY,   R.z1, 1);   // 草地
  /* 石围栏(高 3): 场地一圈, 坦克宽 1.9 格不设窄口 */
  SceneKit.fill(R.x0-1, R.groundY+1, R.z0-1, R.x1+1, R.groundY+3, R.z0-1, 3);
  SceneKit.fill(R.x0-1, R.groundY+1, R.z1+1, R.x1+1, R.groundY+3, R.z1+1, 3);
  SceneKit.fill(R.x0-1, R.groundY+1, R.z0,   R.x0-1, R.groundY+3, R.z1,   3);
  SceneKit.fill(R.x1+1, R.groundY+1, R.z0,   R.x1+1, R.groundY+3, R.z1,   3);
  /* 东侧履带爬坡: 五级台阶升到瞭望台(每级 1 格, 验证履带爬台阶) */
  for(let i=0; i<5; i++)
    SceneKit.fill(R.x1-14+i, R.groundY+1, R.z0+8, R.x1-14+i, R.groundY+1+i, R.z1-8, 3);
  SceneKit.fill(R.x1-9, R.groundY+1, R.z0+8, R.x1-2, R.groundY+5, R.z1-8, 3);
}

const TankRangeMode = mkMode({
  id: 'tank',

  init(){
    buildRange();
    Tank.place(TANK_RANGE.tank.x, TANK_RANGE.groundY+1, TANK_RANGE.tank.z, { yaw: TANK_RANGE.tank.yaw });
    spawn(TANK_RANGE.spawn.x, TANK_RANGE.groundY+1, TANK_RANGE.spawn.z, { yaw: TANK_RANGE.spawn.yaw });
    speakArmed = 10;                      // 重进模式即可再次邀请
  },

  cleanup(){ Tank.clear(); },

  onKey(code){
    if(code === 'KeyE') speakForToggle(Tank.toggle());
  },

  /* 靠近邀请: 未驾驶 + 近旁有车 + 距上次满 10 秒 → 语音一次 */
  update(dt){
    speakArmed += dt;
    if(!Tank.driving() && Tank.nearby() !== null && speakArmed >= 10){
      speakArmed = 0;
      SpeechKit.speak('要开坦克吗？按 E！');
    }
  },

  hud(){
    if(Tank.driving()) return ['🚙 驾驶中 · E 或 🚙 按钮下车'];
    if(Tank.nearby() !== null) return ['🚙 按 E 开坦克 · 平板点 🚙 按钮'];
    return [];
  },

  touch: [{ label: '🚙', act(){ speakForToggle(Tank.toggle()); } }],

  onMenu(){ Tank.exitAll(); },            // Esc/暂停保底: 人在车里也要安全落地
  onHighlight(){ return false; }          // 本模式不挖不放, 隐藏方块高亮
});

if(typeof module !== 'undefined' && module.exports) module.exports = TankRangeMode;
