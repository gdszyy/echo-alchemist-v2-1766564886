---
id: "PI-012"
version: "v1.0"
last_updated: "2026-06-30"
author: "Codex"
related_modules: ["AGENTS", "global", "git", "workflow"]
status: "active"
---

# PI-012: Task Closeout and Git Hygiene

## 流程概述

本流程用于防止每轮 Codex 任务结束后仓库持续变脏。核心原则是：任务可以产生改动，但每个 modified / untracked 路径都必须有归属；临时产物必须进忽略目录或被清理；交付物必须同步文档、索引或 manifest；最终回复必须给出 Git 状态证据。

## 核心防坑指南

### 坑 1: 生成物与交付物混在一起

**现象**：`git status --short` 同时出现运行时资源、概念稿、下载资料、临时截图、自动索引和代码修改，后续 Codex 无法判断哪些应提交、哪些应丢弃。

**根因**：任务开始时没有定义临时目录和交付边界；生成脚本默认把输出写进活跃目录或仓库根目录。

**正确做法**：任务开始时先约定输出类型。临时分析、截图、下载包放入 `tmp/`、`.codex_tmp/` 或 `tmp/codex/<REQ-ID>/`；运行时资产必须同步 manifest / 资产清单 / TODO；概念稿和审稿资料进入明确的 `docs/design/` 或归档路径并在总结中说明。

**关键位置**：`AGENTS.md` 第 2.6 节；`.gitignore`；`docs/work_items/active/<REQ-ID>.md`

### 坑 2: 只看测试结果，不看工作区状态

**现象**：验证通过，但仓库仍有大量 modified / untracked 文件，下一轮任务一开始就被历史脏状态干扰。

**根因**：任务收尾只记录测试命令，没有把 Git 工作区作为验收闸门。

**正确做法**：每轮结束前执行：

```powershell
git status --short --branch
git diff --check
```

最终回复必须说明工作区是“干净”“仅有本次预期改动”“存在历史改动”还是“已 stash 保存”。如果用户要求仓库干净，优先用命名 stash 保护不明内容：

```powershell
git stash push -u -m "codex-clean-worktree-YYYY-MM-DD"
git stash list
```

PowerShell 恢复 stash 时要给引用加引号：

```powershell
git stash apply 'stash@{0}'
```

### 坑 3: LF/CRLF 与格式化噪音扩大 diff

**现象**：Git 报告大量文件 modified，但实际业务改动很少；`git diff` 中出现换行、格式化或自动生成索引的无关变化。

**根因**：Windows 环境、编辑器默认格式化、生成脚本或自动索引重跑范围过大。

**正确做法**：只保留当前任务需要的文件改动。若发现纯换行/格式化噪音，先判断是否属于当前任务；不属于则恢复该文件或拆成独立格式化任务。修改已索引大文件时，只运行对应文件的索引生成命令，不做无关全量重建。

### 坑 4: 为了“干净”误删用户成果

**现象**：为了让 `git status` 清空，直接删除未跟踪目录或执行硬 reset，导致素材、文档或迁移工程丢失。

**根因**：没有区分“可丢弃临时产物”和“尚未纳入版本控制的成果”。

**正确做法**：未知内容优先 stash 或汇报，不直接删除。只有明确属于当前任务的一次性临时文件，才可删除；删除前确认路径在预期临时目录内。运行时资产和迁移工程必须由用户或需求卡决定是纳入、归档还是 stash。

## 关键耦合点

- `AGENTS.md` 是每个 Codex 介入仓库的硬入口，必须写明任务收尾闸门。
- `.cursor/rules/global.md` 是全局工程规范，负责把 Git 清洁纳入“禁止遗留脏状态”的工程约束。
- `docs/work_items/active/<REQ-ID>.md` 记录当前工作流的临时产物、验证证据和收口状态。
- `.gitignore` 只屏蔽确认为临时或编辑器缓存的路径；不能用 ignore 掩盖真实运行时资产缺失。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-06-30 | 初始记录：任务收尾 Git 状态闸门、未跟踪文件归属、stash 清理和换行噪音处理规范 | Codex |
