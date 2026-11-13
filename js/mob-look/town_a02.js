'use strict';
/* ============================================================
   造型档案 · 氛围动物 A02 咪喵 (town_a02) — 引擎层 (术语见 GLOSSARY「造型档案」)
   ------------------------------------------------------------
   咪喵(Cat, Ambient): 自有骨(§5.3 坐姿结构: 体 5×8×6 臀团+胸合并盒 bind 即
   坐姿/头 5×5×5+耳 1×2×1 ×2/前腿 1×5×1 ×4/尾 1×5×1 独立骨), 画布 32×32。
   姿态语义(供动画层选型票检索): 坐/伸懒腰(gen §5.3) — 本批中性 bind(裁决二)。
   贴图非手绘: gen 批产字符行面图经一次性导出器烘焙为下方字面量, blit 语义
   等价移植(拉伸 out[r][c]=in[⌊r·inH/outH⌋][⌊c·inW/outW⌋]; 只用 g.px 确定性)。
   UV: 沿 gen boxUV 坐标系(与 kit faceRects 公式同构), 像素内容逐纹素等值。
   像素真源: .scratch/town-design/gen/gen-rollout-mobs.js(A2 表+CH_A2)
   复跑导出命令: node .scratch/town-design/gen/gen-export-look.js
   interface: declare('town_a02', {...}) — 单一声明(键=文件名)
   依赖: js/mob-look-kit.js(先载); 不入 mob-registry(镇民注册表归 T-NPC-03)
   可测性声明: 纯声明数据 — test/town-npc-look.test.js golden 逐面对账 +
     mob-look.test.js 全键循环(覆盖/布局/UV 落点/确定性)
   ============================================================ */
MobLookKit.declare('town_a02', {
  debris: 0xe89b5e, /* A02 橘毛主色 #E89B5E(CH_A2.o, 碎块色=体主色) */
  bones: {
    /* 自有骨(§5.3 坐姿结构: bind 即坐姿; 骨名沿 quad 惯例) */
    head: {pivot: [0, 13, 0], add: [
      {origin: [-2.5, 8, -3.5], size: [5, 5, 5], uv: [0, 0]},
      {origin: [-1.5, 12.75, -2.25], size: [1, 2, 1], uv: [20, 0]}, /* 耳 ×2 共区; 底面嵌入 0.25 防共面 */
      {origin: [0.5, 12.75, -2.25], size: [1, 2, 1], uv: [20, 0]},
    ]},
    root: {pivot: [0, 4, 0], add: [
      {origin: [-2.5, 0, -3], size: [5, 8, 6], uv: [0, 10]}, /* 臀团+胸合并盒 y0~8 */
    ]},
    legR: {pivot: [-1, 5, 0], add: [
      {origin: [-1.5, 0, -4.25], size: [1, 5, 1], uv: [0, 24]},
      {origin: [-1.5, 0, 2.75], size: [1, 5, 1], uv: [0, 24]}, /* 前后各一, 凸出体缘防共面 */
    ]},
    legL: {pivot: [1, 5, 0], add: [
      {origin: [0.5, 0, -4.25], size: [1, 5, 1], uv: [0, 24]},
      {origin: [0.5, 0, 2.75], size: [1, 5, 1], uv: [0, 24]},
    ]},
    tail: {pivot: [-2.25, 2.5, 3.75], add: [
      {origin: [-2.75, 0, 3.25], size: [1, 5, 1], uv: [8, 24]}, /* 臀后垂 */
    ]},
  },
  tex: {w: 32, h: 32, paint: (g, R) => {
    /* town_a02 色表(gen CH 全键烘焙, hex→[r,g,b]) */
    const RGB = {
      o: [232, 155, 94], w: [247, 243, 236], e: [111, 175, 142], k: [90, 70, 54],
    };
    /* gen 字符行面图(烘焙字面量; 行序=模型 y 高→低, '.'=透跳) */
    const MAPS = {
      headFront: [
        'ooooo',
        'eeoee',
        'eeoee',
        'owwwo',
        'owwwo',
      ],
      headBack: [
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      headSide: [
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      headTop: [
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      headBot: [
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      earFront: [
        'o',
        'o',
      ],
      earSide: [
        'o',
        'o',
      ],
      earTop: [
        'o',
      ],
      bodyFront: [
        'owwwo',
        'owwwo',
        'owwwo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      bodyBack: [
        'kkkkk',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      bodySide: [
        'kkkkkk',
        'oooooo',
        'oooooo',
        'oooooo',
        'oooooo',
        'oooooo',
        'oooooo',
        'oooooo',
      ],
      bodyTop: [
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      bodyBot: [
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
        'ooooo',
      ],
      legFront: [
        'o',
        'o',
        'o',
        'o',
        'w',
      ],
      legSide: [
        'o',
        'o',
        'o',
        'o',
        'w',
      ],
      legTop: [
        'o',
      ],
      tailFront: [
        'o',
        'o',
        'o',
        'o',
        'o',
      ],
      tailSide: [
        'o',
        'o',
        'o',
        'o',
        'o',
      ],
      tailTop: [
        'o',
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
    /* 头(head 5×5×5): 眼 2×2 贴边 ×2/口鼻白 3×2 */
    blit(MAPS.headFront, R.head.front);
    blit(MAPS.headBack, R.head.back);
    blit(MAPS.headSide, R.head.left);
    blit(MAPS.headSide, R.head.right);
    blit(MAPS.headTop, R.head.top);
    blit(MAPS.headBot, R.head.bottom);
    /* 耳(head2/head3 1×2×1 ×2 共区 mirror) */
    blit(MAPS.earFront, R.head2.front);
    blit(MAPS.earFront, R.head2.back);
    blit(MAPS.earSide, R.head2.left);
    blit(MAPS.earSide, R.head2.right);
    blit(MAPS.earTop, R.head2.top);
    blit(MAPS.earTop, R.head2.bottom);
    blit(MAPS.earFront, R.head3.front);
    blit(MAPS.earFront, R.head3.back);
    blit(MAPS.earSide, R.head3.left);
    blit(MAPS.earSide, R.head3.right);
    blit(MAPS.earTop, R.head3.top);
    blit(MAPS.earTop, R.head3.bottom);
    /* 坐姿体(root 5×8×6): 胸白 3×3(§4.4 抽查件); bind 即坐姿 */
    blit(MAPS.bodyFront, R.root.front);
    blit(MAPS.bodyBack, R.root.back);
    blit(MAPS.bodySide, R.root.left);
    blit(MAPS.bodySide, R.root.right);
    blit(MAPS.bodyTop, R.root.top);
    blit(MAPS.bodyBot, R.root.bottom);
    /* 前腿(legR/legL 各×2 共区 1×5×1): 坐姿直立爪白 */
    blit(MAPS.legFront, R.legR.front);
    blit(MAPS.legFront, R.legR.back);
    blit(MAPS.legSide, R.legR.left);
    blit(MAPS.legSide, R.legR.right);
    blit(MAPS.legTop, R.legR.top);
    blit(MAPS.legTop, R.legR.bottom);
    blit(MAPS.legFront, R.legR2.front);
    blit(MAPS.legFront, R.legR2.back);
    blit(MAPS.legSide, R.legR2.left);
    blit(MAPS.legSide, R.legR2.right);
    blit(MAPS.legTop, R.legR2.top);
    blit(MAPS.legTop, R.legR2.bottom);
    blit(MAPS.legFront, R.legL.front);
    blit(MAPS.legFront, R.legL.back);
    blit(MAPS.legSide, R.legL.left);
    blit(MAPS.legSide, R.legL.right);
    blit(MAPS.legTop, R.legL.top);
    blit(MAPS.legTop, R.legL.bottom);
    blit(MAPS.legFront, R.legL2.front);
    blit(MAPS.legFront, R.legL2.back);
    blit(MAPS.legSide, R.legL2.left);
    blit(MAPS.legSide, R.legL2.right);
    blit(MAPS.legTop, R.legL2.top);
    blit(MAPS.legTop, R.legL2.bottom);
    /* 尾(tail 1×5×1): 独立骨(quad 惯例) */
    blit(MAPS.tailFront, R.tail.front);
    blit(MAPS.tailFront, R.tail.back);
    blit(MAPS.tailSide, R.tail.left);
    blit(MAPS.tailSide, R.tail.right);
    blit(MAPS.tailTop, R.tail.top);
    blit(MAPS.tailTop, R.tail.bottom);
  }},
});
