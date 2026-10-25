'use strict';
/* ============================================================
   体验馆 (ShowroomMode, 术语见 GLOSSARY.md「体验馆」) — 模式层
   ------------------------------------------------------------
   仅开发人员可见的调试模式(注册表 dev:true + 卡默认隐藏, ?dev=1 解锁):
   真游戏场景去掉跑图与挖掘 — 平地草场空场 + 预置被测道具(v1 展品=熔炉,
   T3 接线) + 满材料背包(T2 接线), 一切触手可及; 做出来的东西在这里
   亲手玩一遍, bug 自己冒出来(开发者亲手玩, 不是自动化测试管线)。
   T1 只落骨架: 装场 + 出生点 + HUD 坐标/FPS。
   红线: 零 localStorage/零存档键字面量(调试永不污染真实进度, ADR 0002)、
   不接指针锁定(无需 conventions §6 登记; 视角操作走触屏口径,
   配合 ?touch=1 强制预览即指针无关的完整操控)、不计儿童时限(gated:false)。
   interface: ShowroomMode(mkMode 注册对象, id='showroom'; 无菜单页,
     卡点击直进 — focus/math 同款先例)
   依赖(均经全局名, 调用期解析): mkMode/ModeKit.spawn(js/mode-kit.js) ·
     loadScene(js/world.js 场景装填 seam) · SceneKit(js/scene-kit.js) ·
     pos(js/voxel.js 玩家位置, HUD 只读) · touchPlaying(js/input.js
     "进行中"态, main.js 跨文件写先例) · fps/overlay/switchMode/
     showPage(js/main.js, 加载序在后、调用期已就绪)
   可测性: THREE/DOM 全经 loadScene/ModeKit 等惰性路径, boot 冒烟(vm 桩)
   全链可跑; 数据隔离由后续票据的守门测试扫键
   ============================================================ */

/* 场地常数: 全幅平地草场(世界 128×128, 坦克演习场同幅), 世界中心出生 */
const SHOWROOM = {
  groundY: 12, // 草地顶层(站立面 y=13, 坦克演习场同标高)
  spawn: {x: 64.5, z: 64.5, yaw: 0}, // 世界中心出生(T3 熔炉将预置在 4 格解锁圈内)
};

function showroomBuild() {
  /* 平地草场: 两层泥土垫底 + 整幅草皮 — 空场即调试画布(T3 再预置展品) */
  SceneKit.fill(0, SHOWROOM.groundY - 2, 0, 127, SHOWROOM.groundY - 1, 127, 2);
  SceneKit.fill(0, SHOWROOM.groundY, 0, 127, SHOWROOM.groundY, 127, 1);
}

/* 进场一条路: 清场 → 建场 → 出生 → 收菜单 → 置"进行中"态。
   switchMode 进来时 world 已清, loadScene 的清场再兜一次重建(幂等) */
function showroomEnter() {
  loadScene(showroomBuild); // 场景装填 seam: 建场+收尾重建一步到位
  ModeKit.spawn(SHOWROOM.spawn.x, SHOWROOM.groundY + 1, SHOWROOM.spawn.z,
      {yaw: SHOWROOM.spawn.yaw});
  touchPlaying = true; // input.js 的"进行中"态(触屏同款口径; 不接指针锁定)
  overlay.style.display = 'none'; // 直进: 收主菜单(训练营壳 init 同款动作)
}

const ShowroomMode = mkMode({
  id: 'showroom',

  init() {
    showroomEnter();
  },

  /* B/暂停回菜单: 体验馆无菜单页(page:false), 恢复菜单背景默认模式再回主页 —
     MODES.cur 交还 arena 后, 再点体验馆卡即全新进场(体验馆每次进场都是
     干净初始态, 炉态/背包后续票据也靠这条收场链兜住不渗漏) */
  onMenu() {
    switchMode('arena');
    showPage('main');
  },

  hud() {
    /* bug 报告口径: 坐标(探险同款行) + FPS(坦克演习场同款尾行) */
    return [
      '🧪 体验馆 · dev 调试场 · B 回菜单',
      `位置: ${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`,
      'FPS ' + fps,
    ];
  },

  onHighlight() {
    return false;
  }, // v1 不挖不放(spec Out of Scope), 隐藏方块高亮(坦克演习场同款)
});

if (typeof module !== 'undefined' && module.exports) module.exports = ShowroomMode;
