"use strict";
/* ============================================================
   我的世界像素图标库 (16×16 手绘 → 96×96 dataURL, pixelated 渲染)
   专注训练营全部刺激/图标共用, 零外部资源
============================================================ */
const mcIconCache = {};
function mcIcon(name){
  if(mcIconCache[name]) return mcIconCache[name];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const px = (x,y,w,h,col)=>{ g.fillStyle = col; g.fillRect(x,y,w,h); };
  const stoneBase = ()=>{
    px(0,0,16,16,'#7d7d7d');
    [[2,1],[9,2],[13,5],[5,6],[12,9],[3,11],[8,13],[1,8]].forEach(([x,y])=>px(x,y,2,1,'#8c8c8c'));
    [[6,2],[11,7],[2,13],[13,3],[8,10],[4,4]].forEach(([x,y])=>px(x,y,1,1,'#6e6e6e'));
  };
  switch(name){
    case 'stone': stoneBase(); break;
    case 'coal': case 'iron': {
      stoneBase();
      const base = name==='coal' ? '#1e1e1e' : '#d8af93';
      const hi   = name==='coal' ? '#333333' : '#e6c5a5';
      [[2,3],[9,2],[5,10],[11,11]].forEach(([x,y])=>{
        px(x,y,2,2,base); px(x,y,1,1,hi);
      });
      px(13,6,2,2,base); px(6,7,1,1,base);
      break;
    }
    case 'diamond': case 'emerald': {
      const a = name==='diamond'
        ? ['#e6fdfa','#9ff5ec','#54d7cd','#2ba69e']
        : ['#dcffe6','#84ea9e','#3cc06d','#1f8f4a'];
      px(4,3,8,2,a[1]); px(6,2,4,1,a[0]);            // 顶部亮面
      px(3,4,1,2,a[1]); px(12,4,1,2,a[1]);           // 两侧翼
      px(5,5,6,2,a[2]);                              // 中段
      px(4,6,1,1,a[2]); px(11,6,1,1,a[2]);
      px(5,7,2,1,a[3]); px(9,7,2,1,a[3]);            // 收底
      px(6,8,4,1,a[3]); px(7,9,2,1,a[3]);
      px(5,3,2,1,a[0]); px(6,5,1,1,a[0]);            // 高光
      break;
    }
    case 'tnt': {
      px(0,0,16,16,'#c33a24');
      [[1,2],[5,1],[9,3],[13,2],[3,12],[12,11]].forEach(([x,y])=>px(x,y,1,1,'#a52c18'));
      px(0,5,16,5,'#efe7dc');                        // 白带
      px(2,6,3,1,'#141414'); px(3,7,1,2,'#141414');  // T
      px(6,6,1,3,'#141414'); px(8,6,1,3,'#141414'); px(7,7,1,1,'#141414'); // N
      px(10,6,3,1,'#141414'); px(11,7,1,2,'#141414'); // T
      px(0,0,16,1,'#8f2313'); px(0,15,16,1,'#8f2313');
      break;
    }
    case 'wool_red': case 'wool_blue': case 'wool_yellow': {
      const base = {wool_red:'#b5332c', wool_blue:'#35399d', wool_yellow:'#e0b526'}[name];
      const light = {wool_red:'#c94a41', wool_blue:'#4a4eb5', wool_yellow:'#eec845'}[name];
      const dark  = {wool_red:'#96271f', wool_blue:'#282c7d', wool_yellow:'#bd921a'}[name];
      px(0,0,16,16,base);
      for(let y=0;y<16;y++) for(let x=0;x<16;x++){
        if((x+y)%4===0) px(x,y,1,1,light);
        else if((x+y)%4===2) px(x,y,1,1,dark);
      }
      break;
    }
    case 'cobble': {
      px(0,0,16,16,'#4f4f4f');
      [[1,1],[5,2],[10,1],[2,6],[7,5],[12,6],[1,11],[6,10],[11,11],[4,14],[13,14]]
        .forEach(([x,y])=>{ px(x,y,3,2,'#8a8a8a'); px(x,y,2,1,'#9a9a9a'); });
      break;
    }
    case 'planks': {
      px(0,0,16,16,'#b8945f');
      [3,7,11,15].forEach(y=>px(0,y,16,1,'#8a6b3d'));
      px(5,0,1,3,'#8a6b3d'); px(11,4,1,3,'#8a6b3d');
      px(3,8,1,3,'#8a6b3d'); px(9,12,1,3,'#8a6b3d');
      [[2,1],[8,5],[13,9],[5,13]].forEach(([x,y])=>px(x,y,3,1,'#c9a672'));
      break;
    }
    case 'brick': {
      px(0,0,16,16,'#8a8a8a');
      [0,5,10,15].forEach(y=>px(0,y,16,1,'#5f5f5f'));
      px(7,1,1,4,'#5f5f5f'); px(3,6,1,4,'#5f5f5f'); px(11,6,1,4,'#5f5f5f');
      px(7,11,1,4,'#5f5f5f');
      [[1,1],[8,2],[4,7],[12,8],[1,11],[9,12]].forEach(([x,y])=>px(x,y,2,1,'#9c9c9c'));
      break;
    }
    case 'torch': {
      px(7,6,2,10,'#8a6b3d'); px(8,6,1,10,'#6e5430');   // 手柄
      px(6,3,4,3,'#ffd83d'); px(7,2,2,1,'#fff2a8');     // 火焰
      px(7,6,2,1,'#ff9d2e'); px(5,4,1,1,'#ffb52e'); px(10,4,1,1,'#ffb52e');
      break;
    }
    case 'pickaxe': {
      for(let i=0;i<8;i++) px(5+i-2, 13-i, 2, 2, '#8a6b3d');   // 斜柄
      px(3,1,10,2,'#9c9c9c'); px(2,2,2,3,'#9c9c9c'); px(12,2,2,3,'#9c9c9c');
      px(1,4,2,2,'#7d7d7d'); px(13,4,2,2,'#7d7d7d');
      px(4,3,8,1,'#b8b8b8');
      break;
    }
    case 'flag': {
      px(7,3,2,12,'#8a6b3d'); px(8,3,1,12,'#6e5430');   // 旗杆
      px(9,3,6,5,'#c33a24'); px(9,3,6,1,'#d94a35'); px(14,3,1,5,'#96271f');
      px(7,2,2,1,'#ffd83d');                            // 顶球
      break;
    }
  }
  const big = document.createElement('canvas');
  big.width = big.height = 96;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 96, 96);
  mcIconCache[name] = big.toDataURL();
  return mcIconCache[name];
}

/* 苦力怕头像(左/右视线) — Flanker 刺激 */
const creeperCache = {};
function creeperFace(dir){
  if(creeperCache[dir]) return creeperCache[dir];
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#4fae4f'; g.fillRect(0,0,16,16);
  g.fillStyle = '#3d8f3d';
  [[1,2],[5,1],[9,3],[13,2],[3,7],[11,6],[2,12],[7,14],[12,11],[14,14],[6,9],[9,13]]
    .forEach(([x,y])=>g.fillRect(x,y,1,1));
  const eyeY = 5;
  [[3],[10]].forEach(([x])=>{
    g.fillStyle = '#f4f4f4'; g.fillRect(x, eyeY, 3, 3);
    g.fillStyle = '#101510';
    g.fillRect(dir<0 ? x : x+2, eyeY+1, 1, 2);
  });
  g.fillStyle = '#101510';
  g.fillRect(6,9,4,3); g.fillRect(7,12,2,2);
  const big = document.createElement('canvas');
  big.width = big.height = 96;
  const bg = big.getContext('2d');
  bg.imageSmoothingEnabled = false;
  bg.drawImage(c, 0, 0, 96, 96);
  creeperCache[dir] = big.toDataURL();
  return creeperCache[dir];
}
