# AGENTS.md — my-craft-demo

给 6 岁孩子的 Minecraft 风格体素注意力训练游戏。原生 JS + Three.js r128，
经典 `<script>` 共享词法环境（顶层声明互为全局，加载序即依赖序），**无构建步骤**。

## 必读（按需到达）

- **MISSION.md** — 项目使命、成功标准、技术栈约束。动工前先读。
- **docs/conventions.md** — 工程与代码规范正文。改任何代码前读；本地偏离登记表在它的 §6。
- **GLOSSARY.md** — 模块术语表。**找模块先查这里**：词条按 interface 收词，_Avoid_ 是已废弃的旧名，别再用。
- docs/google-style-research.md · docs/project-structure-research.md — 规范背后的来源论证（改规范前读）。

## 硬规则（conventions.md 的浓缩，细节以正文为准）

- 一文件一模块：文件名即模块索引，kebab-case + 后缀语义（`-core` 纯核心必配同名单测、
  `-registry` 清单唯一权威、`-kit` 跨模式工具、`-worker` Worker 入口）。
- 引擎层不知道玩法；应用可依赖引擎，引擎不得依赖应用。
- 可能被其他文件写的顶层绑定用 `let`（input.js 写 pitch、build.js 写 flyMode），
  文件内变量默认 `const`。
- 新模式 = index.html 加卡/页/script + mode-registry.js 加行（三重命名有测试断言）。
- 注释用中文；模块头注释走 `====` 五要素契约（conventions.md §1.7）。
- 新约定先过 conventions.md §1.10 升格判据；不可逆决策写 docs/adr/。

## 收尾前必跑

```
npm test        # 全部单测 + boot 全链冒烟 + 规范守门（test/conventions.test.js）
npm run lint    # ESLint(google 基线) + Stylelint + htmlhint，零错误才算过
node server.js  # 本地起服务，端口默认 8080
```

运行时不依赖 node_modules（浏览器直引 js，server.js 只用 Node 内建模块）；
package.json 只装开发期 lint 工具。

<!-- code-review-graph MCP tools -->
## MCP 工具：code-review-graph

**本项目建有代码知识图谱。先用 code-review-graph 的 MCP 工具收窄范围，再读源码。**
图谱查询比全量扫文件省 token，还能给出文件搜索给不了的结构上下文
（调用方、依赖方、测试覆盖）。

### 切入 worktree 后：先建图谱（必做第一步，不用再查）

图谱 DB 存在仓库内 `.code-review-graph/graph.db`（已 gitignore），新 worktree 里没有。
MCP server（`uvx code-review-graph serve`）的 cwd 固定在主仓库，`repo_root` 省略时
自动探测会指到主仓库的图谱。所以 worktree 会话里**每次调用图谱工具都要显式传
`repo_root`（worktree 绝对路径）**，且进会话第一件事是全量构建（本仓库约几秒）：

```js
// execute 工具内调用；repo_root 换成 worktree 绝对路径
await tools["code-review-graph"].build_or_update_graph_tool({
  repo_root: "<worktree 绝对路径>",
  full_rebuild: true, // 新 worktree 没有旧图谱，必须全量
});
```

等价 CLI：`code-review-graph build --repo <worktree 绝对路径>`。

- 就绪检查：`get_minimal_context_tool({ repo_root })` 返回 `status: "ok"` 即可用；
  `not_ready` + `missing_graph` = 还没建；`not_ready` 但有图 = 落后于当前 HEAD，
  再跑一次 `build_or_update_graph_tool({ repo_root })`（不带 full_rebuild）增量补齐。
- worktree 里没有主仓库那套 hook 自动增量更新，改动多了就手动跑一次增量（同上，不带 full_rebuild）。
- 删 worktree 时 `.code-review-graph/` 属未跟踪文件，`git worktree remove` 需加 `--force`。

### 优先用图谱工具的场景

- **探索代码**：`semantic_search_nodes_tool` 或 `query_graph_tool`，代替 Grep。
- **评估影响**：`get_impact_radius_tool`，代替手工追 import。
- **代码审查**：`detect_changes_tool` + `get_review_context_tool`，代替整文件通读。
- **查关系**：`query_graph_tool` 的 callers_of / callees_of / imports_of / tests_for。
- **架构问题**：`get_architecture_overview_tool` + `list_communities_tool`。

### 以源码为准

- 图谱只用来收窄范围，之后读源码；不要只凭图谱输出就改代码。
- 非平凡改动，下结论前先读实现和相关测试。
- 触及行为、数据库、迁移、重试、降级、恢复、兼容性代码时，逐字核对源码。
- 图谱与源码冲突时以源码为准：图谱可能过期，或没建模那条关系。
- 图谱查空 ≠ 不存在，也可能是「未索引」或「静态分析看不见」。

### 常用工具

| 工具 | 用途 |
| ------ | ---------- |
| `detect_changes_tool` | 审查代码改动 — 附风险评分 |
| `get_review_context_tool` | 审查需要源码片段 — 省 token |
| `get_impact_radius_tool` | 看一次改动的影响半径 |
| `get_affected_flows_tool` | 找受影响的执行流 |
| `query_graph_tool` | 追调用方 / 被调方 / 导入 / 测试 / 依赖 |
| `semantic_search_nodes_tool` | 按名字或关键词找函数 / 类 |
| `get_architecture_overview_tool` | 看代码库整体结构 |
| `refactor_tool` | 规划重命名、找死代码 |

### 工作流

1. 主仓库：文件变更后图谱自动增量更新（hook 驱动）；worktree：先全量建（见上小节），之后手动增量。
2. 代码审查用 `detect_changes_tool`。
3. 看影响面用 `get_affected_flows_tool`。
4. 查测试覆盖用 `query_graph_tool` 的 pattern="tests_for"。
<!-- /code-review-graph MCP tools -->
