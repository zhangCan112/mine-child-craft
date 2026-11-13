'use strict';
/* ============================================================
   造型档案 · 铁守护 G01 阿稳 (town_g01) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   铁傀儡守护者: 自有骨(T-NPC-01 §5.2 表: 头 8×10×8+鼻 2×4×2/躯干 14×12×8
   y21~33/髋 10×5×7 y16~21/长臂 4×30×6 过膝/腿 6×16×5 ×2 隙 2px; 与官方
   golem.js 身 18×12×11 不同, 不共用) + 献花盒 4×4×4 独立附件骨(显隐后置)。
   本批只画 _ok 完好态; gen 内嵌裂纹示意像素(c #7A8086/X #8D9399)不进默认
   画布(裁决二, 裂纹叠加归动画层选型票)。
   姿态语义(供动画层选型票检索): 巡逻(行走摆臂)/献花(_flower) — 中性 bind。
   贴图非手绘: gen 批产字符行面图经一次性导出器烘焙为下方字面量, blit 语义
   等价移植(拉伸 out[r][c]=in[⌊r·inH/outH⌋][⌊c·inW/outW⌋]; 只用 g.px 确定性)。
   UV: 沿 gen boxUV 坐标系(与 kit faceRects 公式同构); 献花盒 (40,0)→(48,0)
   重排(gen 手排鼻只占 x32~40, faceRects 区达 x44), 像素内容逐纹素等值。
   像素真源: .scratch/town-design/gen/gen-rollout-golem.js(G 表+CH_G)
   复跑导出命令: node .scratch/town-design/gen/gen-export-look.js
   interface: declare('town_g01', {...}) — 单一声明(键=文件名)
   依赖: js/mob-look-kit.js(先载); 不入 mob-registry(镇民注册表归 T-NPC-03)
   可测性声明: 纯声明数据 — test/town-npc-look.test.js golden 逐面对账 +
     mob-look.test.js 全键循环(覆盖/布局/UV 落点/确定性)
   ============================================================ */
MobLookKit.declare('town_g01', {
  debris: 0xbfc5cb, /* G01 铁主体 #BFC5CB(CH_G.I, 碎块色=体主色) */
  bones: {
    /* 自有骨(§5.2 表; 无 base = 全部骨自声明, 形状随 creeper 先例: {add, pivot}) */
    head: {pivot: [0, 33, 0], add: [
      {origin: [-4, 33, -4], size: [8, 10, 8], uv: [0, 0]},
      {origin: [-1, 32, -6], size: [2, 4, 2], uv: [32, 0]}, /* 鼻 2×4×2 前突(S-c) */
    ]},
    root: {pivot: [0, 33, 0], add: [
      {origin: [-7, 21, -4], size: [14, 12, 8], uv: [0, 20]}, /* 躯干 y21~33 */
    ]},
    hip: {pivot: [0, 21, 0], add: [
      {origin: [-5, 16, -3.5], size: [10, 5, 7], uv: [0, 40]}, /* 髋盒 y16~21 */
    ]},
    armR: {pivot: [-9, 31, 0], add: [
      {origin: [-11, 1, -3], size: [4, 30, 6], uv: [44, 20]}, /* 肩接 y31 下垂 y1 */
    ]},
    armL: {pivot: [9, 31, 0], add: [
      {origin: [7, 1, -3], size: [4, 30, 6], uv: [44, 20]}, /* 与右臂共区 mirror */
    ]},
    legR: {pivot: [-4, 16, 0], add: [
      {origin: [-7, 0, -2.5], size: [6, 16, 5], uv: [0, 52]}, /* 落地 y0 */
    ]},
    legL: {pivot: [4, 16, 0], add: [
      {origin: [1, 0, -2.5], size: [6, 16, 5], uv: [0, 52]}, /* 与左腿共区; 原点距 8 */
    ]},
    flower: {pivot: [9.25, 24, -4.25], add: [
      {origin: [7.25, 22, -6.25], size: [4, 4, 4], uv: [48, 0]}, /* 独立附件骨(显隐后置); 三轴小数错臂面 */
    ]},
  },
  tex: {w: 64, h: 80, paint: (g, R) => {
    /* G01 色表(gen CH_G 全键烘焙, hex→[r,g,b]; c/X 裂纹示意色只留字典不落画布) */
    const RGB = {
      I: [191, 197, 203], M: [154, 160, 166], L: [215, 210, 200], g: [90, 70, 54],
      R: [201, 74, 58], r: [122, 46, 37], V: [111, 143, 91], v: [143, 176, 122],
      P: [244, 167, 193], p: [247, 227, 181], t: [127, 176, 105], c: [122, 128, 134],
      X: [141, 147, 153],
    };
    /* gen 字符行面图(烘焙字面量; 行序=模型 y 高→低, '.'=透跳) */
    const MAPS = {
      headFront: [
        'LLLLLLLL',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
        'MMMIIMMM',
        'RRrIIrRR',
        'IIIMIIII',
        'MIIMIIIM',
      ],
      headBack: [
        'LLLLLLLL',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIMIIIM',
      ],
      headSide: [
        'LLLLLLLL',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MIIIIIII',
        'MMIIIIII',
        'RMIIIIII',
        'MMIIIIII',
        'MMIIIIII',
      ],
      headTop: [
        'LLLLLLLL',
        'LLLLLLLL',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
        'IIIIIIII',
      ],
      headBot: [
        'MMMMMMMM',
        'MMMMMMMM',
        'MMMMMMMM',
        'MMMMMMMM',
        'MMMMMMMM',
        'MMMMMMMM',
        'MMMMMMMM',
        'MMMMMMMM',
      ],
      noseFront: [
        'MI',
        'MI',
        'MI',
        'MM',
      ],
      noseFlat: [
        'MM',
        'MM',
        'MM',
        'MM',
      ],
      noseTop: [
        'II',
        'II',
      ],
      noseBot: [
        'MM',
        'MM',
      ],
      torsoFront: [
        'LLLLLLLLLLLLLL',
        'MVvVgIIIIIIIIM',
        'MvVVVIIIIIIIIM',
        'MVVvVIIIIIIIIM',
        'MgVVvIIIIIIIIM',
        'MVvVVIIIIIIIIM',
        'MMMMMMMMMMMMMM',
        'MIIIIIIIIIIIIM',
        'MIIIIIIIIIIIIM',
        'MIIIIIIIIIIIIM',
        'MMMMMMMMMMMMMM',
        'gggggggggggggg',
      ],
      torsoBack: [
        'LLLLLLLLLLLLLL',
        'MIIIIILIIIIIIM',
        'MIILLIILILLIIM',
        'MIILLIILILLIIM',
        'MIIIIIILIVvVIM',
        'MIIIIIILIvVVIM',
        'MMMMMMMMMMMMMM',
        'MIIIIILIIIIIIM',
        'MIIIIILIIIIIIM',
        'MIIIIILIIIIIIM',
        'MMMMMMMMMMMMMM',
        'gggggggggggggg',
      ],
      torsoSide: [
        'LLLLLLLL',
        'VvIIIIIM',
        'vVIIIIIM',
        'MIIIIIIM',
        'MIIIIIIM',
        'MIIIIIIM',
        'MMMMMMMM',
        'MIIIIIIM',
        'MIIIIIIM',
        'MIIIIIIM',
        'MMMMMMMM',
        'gggggggg',
      ],
      torsoTop: [
        'LLLLLLLLLLLLLL',
        'IIIIIIIIIIIIII',
        'IIIIIIIIIIIIII',
        'IIIIIIIIIIIIII',
        'IIIIIIIIIIIIII',
        'IIIIIIIIIIIIII',
        'IIIIIIIIIIIIII',
        'IIIIIIIIIIIIII',
      ],
      torsoBot: [
        'gggggggggggggg',
        'gggggggggggggg',
        'gggggggggggggg',
        'gggggggggggggg',
        'gggggggggggggg',
        'gggggggggggggg',
        'gggggggggggggg',
        'gggggggggggggg',
      ],
      hipFront: [
        'MIIIIIIIIM',
        'MIIIIIIIIM',
        'MMMMMMMMMM',
        'MIIIIIIIIM',
        'gggggggggg',
      ],
      hipSide: [
        'MIIIIIM',
        'MIIIIIM',
        'MMMMMMM',
        'MIIIIIM',
        'ggggggg',
      ],
      hipTop: [
        'LLLLLLLLLL',
        'IIIIIIIIII',
        'IIIIIIIIII',
        'IIIIIIIIII',
        'IIIIIIIIII',
        'IIIIIIIIII',
        'IIIIIIIIII',
      ],
      hipBot: [
        'gggggggggg',
        'gggggggggg',
        'gggggggggg',
        'gggggggggg',
        'gggggggggg',
        'gggggggggg',
        'gggggggggg',
      ],
      armFront: [
        'LLLL',
        'VvII',
        'vVII',
        'MIIM',
        'MIIM',
        'MMMM',
        'MIIM',
        'MIIM',
        'MIIM',
        'gggg',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'gggg',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
      ],
      armBack: [
        'LLLL',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
        'MIIM',
        'MIIM',
        'MIIM',
        'gggg',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'gggg',
        'MIIM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
        'MIIM',
        'MIIM',
        'MIIM',
        'MMMM',
      ],
      armSide: [
        'LLLLLL',
        'VvIIII',
        'vVIIII',
        'MIIIIM',
        'MIIIIM',
        'MMMMMM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'gggggg',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MMMMMM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'gggggg',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MMMMMM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MMMMMM',
      ],
      armTop: [
        'IIII',
        'IIII',
        'IIII',
        'IIII',
        'IIII',
        'IIII',
      ],
      armBot: [
        'IIII',
        'IIII',
        'MMMM',
        'MMMM',
        'MMMM',
        'MMMM',
      ],
      legFront: [
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MMMMMM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MIIIIM',
        'MMMMMM',
        'MMMMMM',
      ],
      legSide: [
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MMMMM',
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MIIII',
        'MMMMM',
        'MMMMM',
      ],
      legTop: [
        'IIIIII',
        'IIIIII',
        'IIIIII',
        'IIIIII',
        'IIIIII',
      ],
      legBot: [
        'MMMMMM',
        'MMMMMM',
        'MMMMMM',
        'MMMMMM',
        'MMMMMM',
      ],
      flowerTop: [
        'PPPP',
        'PppP',
        'PppP',
        'PPPP',
      ],
      flowerFace: [
        'PPPP',
        'PppP',
        'PPPP',
        'tttt',
      ],
      flowerBot: [
        'tttt',
        'tttt',
        'tttt',
        'tttt',
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
    /* 鼻(head2 2×4×2, S-c 采纳): 侧/背面用 flat 面(gen UV 手排同款) */
    blit(MAPS.noseFront, R.head2.front);
    blit(MAPS.noseFlat, R.head2.back);
    blit(MAPS.noseFlat, R.head2.left);
    blit(MAPS.noseFlat, R.head2.right);
    blit(MAPS.noseTop, R.head2.top);
    blit(MAPS.noseBot, R.head2.bottom);
    /* 躯干(root 14×12×8): y21~33(§5.2 位置列) */
    blit(MAPS.torsoFront, R.root.front);
    blit(MAPS.torsoBack, R.root.back);
    blit(MAPS.torsoSide, R.root.left);
    blit(MAPS.torsoSide, R.root.right);
    blit(MAPS.torsoTop, R.root.top);
    blit(MAPS.torsoBot, R.root.bottom);
    /* 髋盒(hip 10×5×7): y16~21(S-b 采纳) */
    blit(MAPS.hipFront, R.hip.front);
    blit(MAPS.hipFront, R.hip.back);
    blit(MAPS.hipSide, R.hip.left);
    blit(MAPS.hipSide, R.hip.right);
    blit(MAPS.hipTop, R.hip.top);
    blit(MAPS.hipBot, R.hip.bottom);
    /* 长臂(armR/armL 共区 4×30×6): 肩接 y31 下垂至 y1 过膝(×2 mirror) */
    blit(MAPS.armFront, R.armR.front);
    blit(MAPS.armBack, R.armR.back);
    blit(MAPS.armSide, R.armR.left);
    blit(MAPS.armSide, R.armR.right);
    blit(MAPS.armTop, R.armR.top);
    blit(MAPS.armBot, R.armR.bottom);
    blit(MAPS.armFront, R.armL.front);
    blit(MAPS.armBack, R.armL.back);
    blit(MAPS.armSide, R.armL.left);
    blit(MAPS.armSide, R.armL.right);
    blit(MAPS.armTop, R.armL.top);
    blit(MAPS.armBot, R.armL.bottom);
    /* 腿(legR/legL 共区 6×16×5): ×2 mirror 隙 2px(原点距 8) */
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
    /* 献花盒(flower 4×4×4): gen flower* 原样(独立附件骨, 显隐后置) */
    blit(MAPS.flowerFace, R.flower.front);
    blit(MAPS.flowerFace, R.flower.back);
    blit(MAPS.flowerFace, R.flower.left);
    blit(MAPS.flowerFace, R.flower.right);
    blit(MAPS.flowerTop, R.flower.top);
    blit(MAPS.flowerBot, R.flower.bottom);
  }},
});
