# Worktree 使用注意事项(pitfalls)

2026-10-28 · 来源:dev1-debug-enhance worktree 收尾时的真实事故(junction 穿透删空主仓库
node_modules,已恢复)。给未来会话的操作清单——AGENTS.md 的 MCP 章节只讲图谱,本文收
worktree 生命周期的全部坑。

## 1. 核心:red line — junction 穿透递归删除

**现象**:worktree 里为跑 lint,把主仓库 `node_modules` 用 junction 借进来
(`New-Item -ItemType Junction -Path node_modules -Target E:\my-craft-demo\node_modules`),
收尾删 worktree 时,删除工具的递归删除(opencode worktree_remove /
`Remove-Item -Recurse` / `git worktree remove --force` 的 rm 实现)**跟着链接走进目标**,
把主仓库 `node_modules` 内容删光。

**原理**:Windows junction 是目录重解析点。`Remove-Item -Recurse`、`rm -rf`、
robocopy /MIR 等一切"递归"语义都会穿透它删目标内容;**不递归的 `rmdir` 只摘链接本身**,
是唯一安全的摘法。

**规矩**:

1. worktree 里要 node_modules,**首选独立 `npm install`**(见 §2 的网络坑);
2. 网络/磁盘原因必须借 junction:**删 worktree 之前先摘链接**——
   `cmd /c rmdir "<worktree>\node_modules"`(cmd 的 rmdir,不是 PowerShell 的
   Remove-Item),然后再做任何递归删除;
3. 摘链接操作要在"清理 worktree"动作**之前**单步执行,不要指望删除工具识别 junction。

## 2. 本机 npm install 的两个坑(网络环境相关)

- **自签证书代理**:直接 `npm install` 报 `UNABLE_TO_VERIFY_LEAF_SIGNATURE` →
  加 `--strict-ssl=false`(仅命令级,不改全局配置);
- **ffmpeg-static postinstall 会炸并回滚**:它的 `node install.js` 下载 ffmpeg 二进制,
  是子进程**不吃** npm 的 `--strict-ssl` 参数;失败后 npm **回滚整个 reify**
  (node_modules 几乎清空、只剩 .bin 残骸)。→ 加 `--ignore-scripts` 跳过:
  ffmpeg 是一次性音频转码工具(adr/0003),lint/test/运行时都不需要;
  将来要转码再 `node node_modules/ffmpeg-static/install.js` 单独补。

一条能用的命令:

```
npm install --ignore-scripts --strict-ssl=false
```

## 3. 生命周期清单

**开 worktree**:

1. `worktree_create` → `session_move`(会话工作目录切过去,后续工具才落在对的地方);
2. 图谱全量构建(AGENTS.md MCP 章节:显式 `repo_root` + `full_rebuild: true`)。

**用 worktree**:

- 图谱没有 hook 自动增量,改动多了手动跑一次增量(`repo_root` 必须显式传);
- node_modules 见 §1/§2;若用了 junction,当场记进收尾待办。

**删 worktree**(顺序即安全):

1. **先摘 junction**(若有):`cmd /c rmdir "<worktree>\node_modules"`;
2. 删本体:git 侧 `git worktree remove --force`(`.code-review-graph/` 属未跟踪文件
   必须带 --force)或 opencode `worktree_remove(force)`;
3. 删已合并分支:`git branch -d <branch>`(主仓库执行);
4. **`session_move` 回主仓库**——会话工作目录还指着已删目录,不切回去后续工具全错;
5. 已知小坑:目录被外部删除后,opencode 的 worktree 登记可能残留且
   `worktree_remove` 报"directory does not exist"清不掉——git 侧
   (`git worktree list`)干净即可,登记残留不影响使用。

## 4. 事故复盘存档(2026-10-28)

- 过程:worktree junction 借主仓库 node_modules(因 npm install 网络证书失败)→
  合并回 main 后 `worktree_remove(force)` 递归删除穿透 junction → 主仓库
  node_modules 内容删光(worktree 删了一半失败)。
- 损失范围:**仅开发期 lint 工具**(node_modules 全程 gitignore,源码/git 历史/已验证
  合并零损失)。
- 恢复:`npm install --ignore-scripts --strict-ssl=false` 重装,lint + 1331 测试全绿。
- 教训固化:§1 三条规矩 + §3 清单(本文档 + AGENTS.md 指针)。
