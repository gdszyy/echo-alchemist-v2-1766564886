# EchoAlchemistV2 重构任务规划

**生成日期**：2026年4月11日  
**项目 ID**：prj-771f457e-e12  
**协调者 Agent**：agt-c1375f5e-9aa

## 任务总览

| 任务 ID | 标题 | 优先级 | 模型 | Git 分支 | 涉及文件 |
|---------|------|--------|------|----------|----------|
| tsk-b1def027-9d1 | 致命 Bug 修复 | critical | manus-1.6-max | `fix/critical-bugs` | `game_phase.js`, `ui_system.js`, `core.js`, `game_system.js` |
| tsk-c8904190-f4a | Canvas 状态栈修复与性能优化 | high | manus-1.6 | `fix/canvas-performance` | `entities.js`, `ui_system.js` |
| tsk-70d8de71-c8f | 架构解耦 - 事件总线与 Mixin 重构 | high | manus-1.6-max | `refactor/event-bus` | `core.js`, `game_phase.js`, `game_system.js`, `combat_system.js`, `audio.js`, `entities.js` |
| tsk-34f3bed9-90b | UI 层分离与规范化 | medium | manus-1.6 | `refactor/ui-separation` | `ui_system.js`, `combat_system.js`, `game_phase.js` |
| tsk-f102db2f-132 | 工程规范清理 - TODO 与魔法数字 | low | manus-1.6-lite | `chore/engineering-cleanup` | `game_system.js`, `game_phase.js`, `ui_system.js`, `config.js`, 全局 |

## 建议执行顺序

```
任务1（致命 Bug 修复）
    ↓ 合并 fix/critical-bugs
任务2（Canvas + 性能）  ←→  任务3（架构解耦）  [可并行，但任务3需在任务1基础上]
    ↓                           ↓ 合并 refactor/event-bus
任务4（UI 层分离）  [依赖任务3的事件总线接口]
    ↓ 合并 refactor/ui-separation
任务5（工程规范清理）  [最后执行，对最终代码库统一清理]
```

## 冲突矩阵

| 文件 | 任务1 | 任务2 | 任务3 | 任务4 | 任务5 |
|------|-------|-------|-------|-------|-------|
| `game_phase.js` | ✅ 主要 | — | ✅ 重叠 | ✅ 重叠 | ✅ 重叠 |
| `ui_system.js` | ✅ 主要 | ✅ 轻微 | — | ✅ 主要 | ✅ 重叠 |
| `core.js` | ✅ 主要 | — | ✅ 主要 | — | — |
| `game_system.js` | ✅ 主要 | — | ✅ 重叠 | — | ✅ 重叠 |
| `entities.js` | — | ✅ 主要 | ✅ 轻微 | — | — |
| `combat_system.js` | — | — | ✅ 主要 | ✅ 主要 | — |
| `audio.js` | — | — | ✅ 主要 | — | — |
| `config.js` | — | — | ✅ 轻微 | — | ✅ 主要 |

## Manus 对话链接

| 任务 | 对话链接 |
|------|----------|
| 致命 Bug 修复 | https://manus.im/app/AE9gAraWmXWEBHXrxXAurR |
| Canvas + 性能优化 | https://manus.im/app/nTBdmgnvZMXnPSpg64Lmnk |
| 架构解耦 | https://manus.im/app/7THNzLsE7RhJxCxA4AzNie |
| UI 层分离 | https://manus.im/app/CvvcdqXDWmtvnJm4dqwzNW |
| 工程规范清理 | https://manus.im/app/bDwVFY9pPe2LnxNDNb2Lrt |
