# retro · 东带门坊化线（E1+E2）2026-11-15

工程线: engineer-manager · worktree town-boundary · 基线 80d9ed2 → 收口 1f8252c（3 commits, 两票全清, 整体评审两轴通过）。
本文只记机械错误与环境债, 按成本升序给修复建议。

## 1. conventions §7.3 补一句: `>` 重定向同禁（成本 0）

- 症状: E1 施工主取证时用 PowerShell `>` 重定向写 diff 文件, 落盘 UTF-16（本线两主同报此坑）。
- 根因证据: docs/conventions.md §7.3 只点名「禁 `| Out-File` 管道」, 未点名 `>` 重定向——
  同族坑（cmdlet 输出经格式化序列化, 默认 UTF-16/混合编码）, 主凭纪律字面合规地踩了它。
- 建议: §7.3 该条改为「禁 `| Out-File` 与 `>` 重定向落盘（同族坑, 编码不可控）, 日志/diff
  落盘一律工具直写（write/edit 或 git --output）」。纯纪律文字补丁。

## 2. run-green.js 收编为共享装具（成本低）

- 症状: worktree 无 .scratch/run-green.js, E1 主按 §7.4 随票重写了一遍; 评审发现其
  :51 存在死代码（`sections[0] === sections[1] ? sections : sections` 两分支相同）,
  且首跑失败清单正则漏新版 node:test spec reporter 的 `✖` 行（修后才抓全失败清单）。
- 根因证据: conventions §7.4 点名 .scratch/run-green.js 为机械面, 但该脚本只活在
  个别会话工作树未入库（git ls-files .scratch 无此文件）——每票重写, 每次漂移。
- 建议: 把修过正则、清过死代码的版本入库（如 test/helpers/run-green.js 或 scripts/）,
  §7.4 改指入库路径; worktree 从此自带, 消每票重写面。

## 3. worktree 交接文补「分支名核实」条目（纪律条目, 成本 0）

- 症状: 交接文写「分支 town-boundary」, 实际 worktree 是 detached HEAD @ 80d9ed2
  （目录名≠分支名, git 里并无同名分支）; E2 主进场才发现, 如直接 commit 会造游离提交。
- 根因证据: worktree 目录命名与分支命名无强制绑定; 交接文口径凭目录名推分支名。
- 建议: worktree 类交接文模板固定一条「进场核 git branch --show-current, detached
  则开工票禁 commit 并上报调度岗」; 或 worktree_create 惯例化「建 worktree 即建分支」。
- 本线实际处置: 收口时 git switch -c town-boundary 钉分支后三语义 commit, 已闭环。

## 4. 登记级 judgement calls（不阻塞, 归后续票）

- 「传送门阵」词条拆分/紧凑化（design-lead 支持）: 前置项=交叉引用面盘点（词条名文本锚,
  拆分/改名断锚）; 新增依据=同一 east 判据文本现存 landscape-spec 附录 A / east-spec /
  GLOSSARY 三处, §1.8 复制漂移面在积累——推导论证归 landscape-spec 单一权威;
  可顺带登记 advEdgeEastSign 的「sign→门坊」别名词条（Standards 轴建议, 不更名）。
- test/adventure-core.test.js 门坊测试块消息文本「告示牌板面」→「门坊」称谓同步
  （3 行, 零行为, 工程线后续动此文件的票顺带）。
- commit 切分微瑕: c1154f9（docs）先于 433aed6（E1 代码）合入, 文档预写「E1 实测闭环」
  引用后置 commit; HEAD 终态自洽（run-green.log 同 commit 入库）, 仅理论 revert 场景
  有悬空引用——重写历史成本高于收益, 不动, 留痕于此。
