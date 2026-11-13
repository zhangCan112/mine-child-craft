'use strict';
/* ============================================================
   造型档案 · 镇民 V07 小厨乐乐 (town_v07) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   厨师（Lava Chicken 趣味转译）: illager 基座官方等比(头 8×10×8+鼻 2×4×2+袍 8×12×6+长袍 overlay
   inflate 0.5 下摆收 y6, 同 V01) + root 追加托盘 6×2×4(gen ACC.tray
   双手胸前 y16~18(§6.6/票 §1); z 凸出袍面(−3)0.25 防共面; UV [16,40] 空位, 基座区零重叠)。
   姿态语义(供动画层选型票检索): 端盘行走 — 本批中性 bind(裁决二)。
   贴图非手绘: gen 批产字符行面图(makeHead('chefhat') 等 v07 真源)经一次性
   导出器烘焙为下方字面量, blit 语义等价移植(拉伸 out[r][c]=
   in[⌊r·inH/outH⌋][⌊c·inW/outW⌋], 尺寸全等时恒等; 只用 g.px 确定性操作)。
   像素真源: .scratch/town-design/gen/gen-rollout-villagers.js CAST[v07]
   复跑导出命令: node .scratch/town-design/gen/gen-export-look.js
   interface: declare('town_v07', {...}) — 单一声明(键=文件名)
   依赖: js/mob-look-kit.js(先载); 不入 mob-registry(镇民注册表归 T-NPC-03)
   可测性声明: 纯声明数据 — test/town-npc-look.test.js golden 逐面对账 +
     mob-look.test.js 全键循环(覆盖/布局/UV 落点/确定性)
   ============================================================ */
MobLookKit.declare('town_v07', {
  base: ['illager'],
  greet: 'eyesmile', /* gen CAST greet(帽饰全保留, 表情帧元数据, 消费在 T-NPC-03) */
  debris: 0xf7f3ec, /* V07 小厨乐乐 袍主 #F7F3EC(CAST v07.pal.a, 碎块色=服装主色) */
  bones: {root: {add: [
    /* 托盘 6×2×4(尺寸随 gen ACC.tray; 双手胸前 y16~18(§6.6/票 §1); z 凸出袍面(−3)0.25 防共面) */
    {origin: [-3, 16, -5.25], size: [6, 2, 4], uv: [16, 40]},
  ]}},
  tex: {w: 64, h: 64, paint: (g, R) => {
    /* town_v07 色表(gen makeCH+accCH 合并烘焙, hex→[r,g,b]; 两表同名字符同值) */
    const RGB = {
      s: [200, 154, 106], d: [185, 133, 88], k: [214, 170, 122], e: [47, 93, 80],
      w: [234, 247, 242], a: [247, 243, 236], h: [247, 243, 236], b: [217, 107, 82],
      o: [90, 70, 54], m: [230, 195, 92], n: [181, 122, 74], p: [215, 210, 200],
      u: [247, 243, 236], v: [247, 243, 236], f: [215, 210, 200], g: [181, 122, 74],
    };
    /* gen 字符行面图(烘焙字面量; 行序=模型 y 高→低, '.'=透跳) */
    const MAPS = {
      headFront: [
        'uuuuuuuu',
        'uuuuuuuu',
        'soooooos',
        'swessews',
        'seessees',
        'sssdssss',
        'kssdsssk',
        'sssdssss',
        'sosdssos',
        'ssooooss',
      ],
      headBack: [
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
      ],
      headSide: [
        'uuuuuuuu',
        'uuuuuuuu',
        'ssssssss',
        'ssssssss',
        'sssddsss',
        'sssddsss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
      ],
      headTop: [
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
        'uuuuuuuu',
      ],
      headBot: [
        'dddddddd',
        'dddddddd',
        'dddddddd',
        'dddddddd',
        'dddddddd',
        'dddddddd',
        'dddddddd',
        'dddddddd',
      ],
      noseFront: [
        'ds',
        'ds',
        'ds',
        'dd',
      ],
      noseFlat: [
        'dd',
        'dd',
        'dd',
        'dd',
      ],
      noseTop: [
        'ss',
        'ss',
      ],
      noseBot: [
        'dd',
        'dd',
      ],
      bodyFront: [
        'hhhoohhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hoaaaaoh',
        'hoaaaaoh',
        'hoaaaaoh',
        'hoaaaaoh',
        'bbbbbbbb',
        'bbbmbbbb',
        'hoaaaaoh',
        'hoaaaaoh',
      ],
      bodyBack: [
        'hhbhhbhh',
        'hhbhhbhh',
        'hhhbhbhh',
        'hhhbhbhh',
        'hhhbbhhh',
        'hhhbbhhh',
        'hhbhhbhh',
        'hhbhhbhh',
        'bbbbbbbb',
        'bbbbbbbb',
        'hhhhhhhh',
        'hhhhhhhh',
      ],
      bodySide: [
        'hhhhhh',
        'hhhhhh',
        'hhhhhh',
        'hhhhhh',
        'ohhhhh',
        'ohhhhh',
        'ohhhhh',
        'ohhhhh',
        'bbbbbb',
        'bbbbbb',
        'ohhhhh',
        'ohhhhh',
      ],
      bodyTop: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhsshhh',
        'hhhsshhh',
        'hhhhhhhh',
        'hhhhhhhh',
      ],
      bodyBot: [
        'oooooooo',
        'oooooooo',
        'oooooooo',
        'oooooooo',
        'oooooooo',
        'oooooooo',
      ],
      skirtFront: [
        'hoaaaaoh',
        'hoaaaaoh',
        'hoaaaaoh',
        'hoaaaaoh',
        'hoaaaaoh',
        'hoaaaaoh',
        'hooooooh',
      ],
      skirtBack: [
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hhhhhhhh',
        'hooooooh',
      ],
      skirtSide: [
        'ohhhhh',
        'ohhhhh',
        'ohhhhh',
        'ohhhhh',
        'ohhhhh',
        'ohhhhh',
        'oooooo',
      ],
      skirtTB: [
        'oooooooo',
        'oooooooo',
        'oooooooo',
        'oooooooo',
        'oooooooo',
        'oooooooo',
      ],
      armSide12: [
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
        'oooo',
        'ssss',
        'ssss',
      ],
      armTop: [
        'hhhh',
        'hhhh',
        'hhhh',
        'hhhh',
      ],
      armBot: [
        'ssss',
        'ssss',
        'dddd',
        'dddd',
      ],
      legFront: [
        'ppp',
        'ppp',
        'bbb',
      ],
      legSide: [
        'pppppp',
        'pppppp',
        'bbbbbb',
      ],
      legTop: [
        'oooooo',
        'oooooo',
        'oooooo',
      ],
      legBot: [
        'bbbbbb',
        'bbbbbb',
        'bbbbbb',
      ],
      accFront: [
        'ffffff',
        'ffffff',
      ],
      accSide: [
        'ffff',
        'ffff',
      ],
      accTop: [
        'ffffff',
        'ffffff',
        'ffffff',
        'ffffff',
      ],
      accBot: [
        'gggggg',
        'gggggg',
        'gggggg',
        'gggggg',
      ],
    };
    /* gen 层 blit 语义等价移植(未知字符即抛错; 拉伸规则见文件头) */
    const blit = (map, rect) => {
      const inH = map.length; const inW = map[0].length;
      for (let r = 0; r < rect[3]; r++) {
        const row = map[Math.floor(r * inH / rect[3])];
        for (let c = 0; c < rect[2]; c++) {
          const ch = row[Math.floor(c * inW / rect[2])];
          if (ch === '.') continue;
          const col = RGB[ch];
          if (!col) throw new Error('未知色字符: ' + ch);
          g.px(rect[0] + c, rect[1] + r, col);
        }
      }
    };
    /* 头(head 8×10×8): gen 布局左右共用 side 图 */
    blit(MAPS.headFront, R.head.front);
    blit(MAPS.headBack, R.head.back);
    blit(MAPS.headSide, R.head.left);
    blit(MAPS.headSide, R.head.right);
    blit(MAPS.headTop, R.head.top);
    blit(MAPS.headBot, R.head.bottom);
    /* 鼻(head2 2×4×2): 侧/背面用 flat 面(gen 同款) */
    blit(MAPS.noseFront, R.head2.front);
    blit(MAPS.noseFlat, R.head2.back);
    blit(MAPS.noseFlat, R.head2.left);
    blit(MAPS.noseFlat, R.head2.right);
    blit(MAPS.noseTop, R.head2.top);
    blit(MAPS.noseBot, R.head2.bottom);
    /* 身(root 8×12×6) */
    blit(MAPS.bodyFront, R.root.front);
    blit(MAPS.bodyBack, R.root.back);
    blit(MAPS.bodySide, R.root.left);
    blit(MAPS.bodySide, R.root.right);
    blit(MAPS.bodyTop, R.root.top);
    blit(MAPS.bodyBot, R.root.bottom);
    /* 长袍 overlay(root2 8×12×6): gen 袍摆 7 行图拉伸到 12 行 */
    blit(MAPS.skirtFront, R.root2.front);
    blit(MAPS.skirtBack, R.root2.back);
    blit(MAPS.skirtSide, R.root2.left);
    blit(MAPS.skirtSide, R.root2.right);
    blit(MAPS.skirtTB, R.root2.top);
    blit(MAPS.skirtTB, R.root2.bottom);
    /* 臂(armR/armL 共区 4×12×4): 四侧同图(gen mirror 同构) */
    blit(MAPS.armSide12, R.armR.front);
    blit(MAPS.armSide12, R.armR.back);
    blit(MAPS.armSide12, R.armR.left);
    blit(MAPS.armSide12, R.armR.right);
    blit(MAPS.armTop, R.armR.top);
    blit(MAPS.armBot, R.armR.bottom);
    blit(MAPS.armSide12, R.armL.front);
    blit(MAPS.armSide12, R.armL.back);
    blit(MAPS.armSide12, R.armL.left);
    blit(MAPS.armSide12, R.armL.right);
    blit(MAPS.armTop, R.armL.top);
    blit(MAPS.armBot, R.armL.bottom);
    /* 腿(legR/legL 共区 4×12×4): gen 3×3/6×3 图拉伸 */
    blit(MAPS.legFront, R.legR.front);
    blit(MAPS.legFront, R.legR.back);
    blit(MAPS.legSide, R.legR.left);
    blit(MAPS.legSide, R.legR.right);
    blit(MAPS.legTop, R.legR.top);
    blit(MAPS.legBot, R.legR.bottom);
    blit(MAPS.legFront, R.legL.front);
    blit(MAPS.legFront, R.legL.back);
    blit(MAPS.legSide, R.legL.left);
    blit(MAPS.legSide, R.legL.right);
    blit(MAPS.legTop, R.legL.top);
    blit(MAPS.legBot, R.legL.bottom);
    /* 托盘(root3 6×2×4): gen ACC.tray 原样 */
    blit(MAPS.accFront, R.root3.front);
    blit(MAPS.accFront, R.root3.back);
    blit(MAPS.accSide, R.root3.left);
    blit(MAPS.accSide, R.root3.right);
    blit(MAPS.accTop, R.root3.top);
    blit(MAPS.accBot, R.root3.bottom);
  }},
});
