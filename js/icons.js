'use strict';
/* ============================================================
   像素图标工坊 — 菜单卡用的手绘像素图标(16×16 → 64×64 dataURL)
   tankIcon: 主菜单坦克演习场卡的入口图标 — emoji 🚙 各平台渲染不可控
   (有的机器上像救护车), 换成与游戏内军绿/履带同配色的像素坦克。
   怪物头像在怪物库(Mobs.face), 坦克型号图标在载具(Tank.icon),
   专注图标在 focus-icons.js — 本文件只放跨模式的菜单入口图标。
   ============================================================ */
function tankIcon() {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x, y, w, h, col)=>{
    g.fillStyle = col; g.fillRect(x, y, w, h);
  };
  const GREEN='#5a6b4a'; const GREEN2='#6d7f58'; const DARK='#333a2e';
  const TRACK='#22261e'; const WHEEL='#454d3e'; const METAL='#8a9184';
  px(0, 4, 7, 2, DARK); // 炮管(朝左)
  px(0, 3, 2, 4, METAL); // 炮口制退器
  px(6, 2, 5, 1, GREEN2); // 炮塔顶
  px(5, 3, 7, 4, GREEN); // 炮塔
  px(3, 7, 12, 3, GREEN); // 车体
  px(3, 7, 2, 1, GREEN2); // 斜甲高光
  px(2, 10, 13, 4, TRACK); // 履带
  for (const x of [3, 5, 7, 9, 11, 13]) px(x, 11, 1, 2, WHEEL); // 负重轮
  const big = document.createElement('canvas');
  big.width = big.height = 64;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 64, 64);
  return big.toDataURL();
}
(function() { // 入口卡换标(main.js 组合根之前的独立装配)
  const big = document.querySelector('#cardTank .big');
  if (big) big.innerHTML = '<img alt="坦克演习场" src="' + tankIcon() + '">';
})();
