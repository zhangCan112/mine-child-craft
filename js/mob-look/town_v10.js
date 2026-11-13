'use strict';
/* ============================================================
   造型档案 · 镇民 V10 跑跑妮妮 (town_v10) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   孩童气质村民: illager 基座官方等比(头 8×10×8+鼻 2×4×2+袍 8×12×6+长袍 overlay
   inflate 0.5 下摆收 y6, 同 V01) + root 追加小挎包 3×3×2(gen ACC.satchel
   mode=side=右体侧挂(§5.10); x 凸出袍缘(+4)0.25; UV [16,40] 空位, 基座区零重叠)。
   姿态语义(供动画层选型票检索): 小跳/玩耍(gen §5.10 原文) — 本批中性 bind(裁决二)。
   贴图非手绘: gen 批产字符行面图(makeHead('ribbon') 等 v10 真源)经一次性
   导出器烘焙为下方字面量, blit 语义等价移植(拉伸 out[r][c]=
   in[⌊r·inH/outH⌋][⌊c·inW/outW⌋], 尺寸全等时恒等; 只用 g.px 确定性操作)。
   像素真源: .scratch/town-design/gen/gen-rollout-villagers.js CAST[v10]
   复跑导出命令: node .scratch/town-design/gen/gen-export-look.js
   interface: declare('town_v10', {...}) — 单一声明(键=文件名)
   依赖: js/mob-look-kit.js(先载); 不入 mob-registry(镇民注册表归 T-NPC-03)
   可测性声明: 纯声明数据 — test/town-npc-look.test.js golden 逐面对账 +
     mob-look.test.js 全键循环(覆盖/布局/UV 落点/确定性)
   ============================================================ */
MobLookKit.declare('town_v10', {
  base: ['illager'],
  greet: 'eyesmile', /* gen CAST greet(帽饰全保留, 表情帧元数据, 消费在 T-NPC-03) */
  debris: 0xf0a45d, /* V10 跑跑妮妮 袍主 #F0A45D(CAST v10.pal.a, 碎块色=服装主色) */
  bones: {root: {add: [
    /* 小挎包 3×3×2(尺寸随 gen ACC.satchel; mode=side=右体侧挂(§5.10); x 凸出袍缘(+4)0.25) */
    {origin: [4.25, 9, -1], size: [3, 3, 2], uv: [16, 40]},
  ]}},
  tex: {w: 64, h: 64, paint: (g, R) => {
    /* town_v10 色表(gen makeCH+accCH 合并烘焙, hex→[r,g,b]; 两表同名字符同值) */
    const RGB = {
      s: [214, 170, 122], d: [200, 154, 106], k: [214, 170, 122], e: [47, 93, 80],
      w: [234, 247, 242], a: [240, 164, 93], h: [247, 227, 181], b: [126, 200, 216],
      o: [90, 70, 54], m: [126, 200, 216], n: [247, 227, 181], p: [240, 164, 93],
      u: [247, 227, 181], v: [247, 227, 181], f: [126, 200, 216], g: [90, 70, 54],
    };
    /* gen 字符行面图(烘焙字面量; 行序=模型 y 高→低, '.'=透跳) */
    const MAPS = {
      headFront: [
        'sssmmsss',
        'ssssssss',
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
        'sssmmsss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
      ],
      headSide: [
        'sssmmsss',
        'ssssssss',
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
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
        'ssssssss',
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
        'bbb',
        'bob',
        'bbb',
      ],
      accSide: [
        'bb',
        'bb',
        'bb',
      ],
      accTop: [
        'bbb',
        'bbb',
      ],
      accBot: [
        'bbb',
        'bbb',
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
    /* 小挎包(root3 3×3×2): gen ACC.satchel 原样 */
    blit(MAPS.accFront, R.root3.front);
    blit(MAPS.accFront, R.root3.back);
    blit(MAPS.accSide, R.root3.left);
    blit(MAPS.accSide, R.root3.right);
    blit(MAPS.accTop, R.root3.top);
    blit(MAPS.accBot, R.root3.bottom);
  }},
});
