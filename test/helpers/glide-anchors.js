'use strict';
/* ==== GlideAnchors — 滑翔 spec 拍板锚唯一登记处（测试装具）
   一句话职责: 钉住 glider-spec §3.9 的 PO 实机拍板值, 并派生各测试的
   「等落地」帧数窗口——缓降速率的算术知识只活在本文件。
   缘起: 2026-11-16 同日三压调参(−1.2→−0.7)时, config 一处改动连带 12 处
   测试红: voxel.test.js 镜像常量要人肉同步 + 两份测试文件里十几个帧数
   窗口(400/720/1200/160/200)是速率的隐性派生值, 报错看不出该改哪。
   收口( locality ): 锚+对账+派生三件集中一处, 下次调参 = 改 js/config.js
   一行 + 改本文件 GLIDE_SINK 一行, 窗口全部自动跟随。
   interface:
     GLIDE_SINK — spec §3.9 拍板锚(字面钉值; 手算锚文化: config 抄错时
                  直读 config 的断言仍绿, 钉值断言才红——这是特征不是缺陷)
     assertSinkMirror(GLIDE) — 对账缝: config.GLIDE.sink 漂离锚时恰在此
                  红一次, 报错消息给出两条出路(有意调参→同步本锚; 无意→回滚)
     sinkFrames(blocks, margin=2) — 派生件: 缓降 blocks 格所需帧数 ×margin
                  余量向上取整(引擎固定步长 1/60 钉死 = 两份装具 DT/GDT 同源;
                  margin 缺省 2 = 既有「滞空翻倍」窗口政策)
   依赖: 零依赖(node:assert, CommonJS 直 require)
   可测性声明: 零 THREE·零 DOM; 对账守门 = 消费文件各一条 guard test
   (test/voxel.test.js 滑翔段首条 + test/adventure-mode.test.js T-G04 段首条) ====

   修订链(spec §3.9 逐次记账): −3.0 初值 → −1.5(T-G07) → −1.2(T-G08)
   → −0.7(2026-11-16 三压, PO 实机拍板「再降」)。 */

const assert = require('node:assert');

/* spec §3.9 拍板锚(格/秒, 负=向下): 唯一钉值处, 下方派生件与两份测试全跟它 */
const GLIDE_SINK = -0.7;

function assertSinkMirror(GLIDE) {
  assert.strictEqual(GLIDE.sink, GLIDE_SINK,
      'config GLIDE.sink(' + GLIDE.sink + ') 漂离 spec §3.9 拍板锚(' + GLIDE_SINK + '): ' +
      '有意调参 → 同步本文件 GLIDE_SINK 并过 glider-spec §3.9 记账; ' +
      '无意改动 → 回滚 js/config.js');
}

function sinkFrames(blocks, margin = 2) {
  return Math.ceil(blocks / Math.abs(GLIDE_SINK) * 60 * margin);
}

module.exports = {GLIDE_SINK, assertSinkMirror, sinkFrames};
