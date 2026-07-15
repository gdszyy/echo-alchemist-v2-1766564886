---
id: "PI-014"
version: "v1.0"
last_updated: "2026-07-15"
author: "REQ-20260715-potion-tower-polish"
related_modules: ["core", "audio", "optional runtime assets", "git worktree"]
status: "active"
---

# PI-014：可选运行时模块不得阻断核心启动

## 流程概述

浏览器会在执行任何模块代码前解析整棵静态 import 图。只要一个可选增强文件缺失，`try/catch`、legacy fallback 与主菜单初始化都没有机会运行。因此，可选音乐包、实验性资源包或按需增强必须在受控函数内动态加载并捕获失败；核心玩法依赖仍应保持静态 import 与快速失败。

## 核心防坑指南

### 坑 1：把可选模块写成顶层静态 import

**现象**：页面只显示基础 HTML，`core.js` 动态导入失败，全局 `game` 未创建；业务层 fallback 完全没有执行。

**根因**：静态模块图解析早于模块求值。缺失依赖会拒绝整个 `core.js`，不是普通的运行时异常。

**正确做法**：在明确的可选加载边界内使用 `await import()`，在同一函数中捕获模块缺失、导出缺失和 loader 异常，返回稳定的 fallback 结果。

```js
async function loadOptionalFeature() {
    try {
        const loader = await import('./optional_feature.js');
        return typeof loader.load === 'function' ? await loader.load() : false;
    } catch (error) {
        console.warn('[Core] optional feature unavailable; using fallback:', error);
        return false;
    }
}
```

### 坑 2：从另一个 dirty checkout 借未跟踪文件

**现象**：本地似乎能启动，但提交、worktree 或其他机器仍缺文件，问题被临时文件掩盖。

**正确做法**：先用 `git ls-tree HEAD -- <path>`、`git log --all -- <path>` 和当前 worktree 的 HTTP/模块加载证据确认文件是否属于已集成基线。其他 checkout 的未跟踪文件所有权未知，未经 Owner 明确授权不得读取、复制或提交。

### 坑 3：把所有依赖都改成静默 fallback

动态降级只适用于有明确 legacy 路径、缺失不改变玩法结算的增强。配置真源、战斗系统和存档契约等必需模块仍必须静态加载并快速暴露错误，避免半初始化运行。

## 验证门禁

1. 静态 validator 锁定“无顶层静态 import、存在受控动态 import 与 catch”。
2. 浏览器刷新后确认主菜单可交互、全局 `game` 已创建、目标试炼场可进入。
3. 缺失可选模块只允许 warning；不得出现阻断 `core.js` 的 module fetch error。
4. 检查相关 checkout，确认没有复制或提交未知的未跟踪实现。

## 关键耦合点

- `src/core.js::loadClipPacks()`：可选 clip-pack 加载边界。
- `.cursor/rules/audio.md`：legacy 音乐 fallback 与启动契约。
- `tests/validate_core_optional_clip_pack.mjs`：静态回归门禁。

## 版本变更日志

| 版本 | 日期 | 变更内容 | 作者 |
|------|------|---------|------|
| v1.0 | 2026-07-15 | 记录可选静态 import 阻断模块图与 dirty checkout 借文件陷阱 | REQ-20260715-potion-tower-polish |
