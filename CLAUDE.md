# CLAUDE.md · Echo Alchemist V2 Agent 操作铁律

> 本文件是所有 Agent 在本沙箱环境**操作文件前必读**的可靠性铁律。
> 协作规范、架构索引见 [`AGENTS.md`](AGENTS.md)；本文件只管「怎么读写文件才不会损坏」。
> 一句话铁律：**文件工具（Read/Write/Edit）是内容真值；Bash 的 `cp` / 挂载读 / `zip` 可能短读截断，必须带校验。**

---

## 文件截断 / 损坏根因分析（每个任务前必读）

> 完整根因分析、现象清单、可靠 vs 不可靠操作对照、防御与检测手册见下方引用文件。
> Claude Code / Cowork 会在加载本 `CLAUDE.md` 时，自动把 `@` 引用的文件内容一并读入上下文。
> 维护时只改 `truncation-root-cause-analysis.md` 这一个文件即可，本处无需重复粘贴正文。

@truncation-root-cause-analysis.md
