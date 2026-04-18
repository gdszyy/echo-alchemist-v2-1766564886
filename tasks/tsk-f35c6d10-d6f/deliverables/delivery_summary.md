# 任务交付物摘要 - tsk-f35c6d10-d6f

## 任务标题
取消普通命运选择，新增回合开始提示与充能特效

## 完成时间
2026-04-18

## Git 提交信息
- **分支**: feat/tsk-f35c6d10-d6f-round-start-banner → main
- **Commit**: 14a870c
- **仓库**: gdszyy/echo-alchemist-v2-1766564886

## 修改文件清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src/game_system.js` | 中型修改 | 取消普通命运选择，新增 `sys_showRoundStartBanner()` 方法 |
| `src/game_phase.js` | 微型修改 | 移除旧的 `showToast Round X` 提示 |
| `src/config.js` | 微型修改 | 三档 performance 新增 `roundStartBannerGlow` 字段 |
| `index.html` | 中型修改 | 新增 `#round-start-banner` DOM 元素及 CSS 样式/动画 |
| `.cursor/rules/game_phase.md` | 规范更新 | 更新 2.1 节，新增 2.5 节 |
| `.cursor/rules/process_insights/PI-006_round_start_reward_resolver.md` | 规范更新 | 升版至 v1.1，新增坑 4 |
| `.cursor/rules/process_insights/index.md` | 规范更新 | 更新 PI-006 版本号及模块检索表 |

## 功能变更详情

### 1. 取消普通命运选择
- `sys_startRoundStartResolver()` 队列为空时，不再调用 `sys_initSelectionPhase()`
- 改为调用 `sys_showRoundStartBanner()` 直接进入研磨阶段
- chaos_essence / pure_essence / relic 命运时刻流程不受影响

### 2. 回合开始大字提示
- 新增 `sys_showRoundStartBanner()` 方法
- 先调用 `phase_switchPhase('gathering')` 切换背景（避免残留 selection 界面）
- 显示 `#round-start-banner` 全屏覆盖层（z-index: 9500）
- 文本：「第 X 回合開始」，金色渐变大字（clamp(2rem, 6vw, 4rem)）
- 持续 1.5 秒后自动调用 `phase_startGatheringPhase()` 完成研磨初始化

### 3. 左侧面板充能特效
- 同时为 `#pc-left-sidebar` 添加 CSS 动画
- high/medium 档：`.ammo-panel-charging`（边框金色光流扫过 1.5 秒）
- low 档：`.ammo-panel-charging-simple`（简单淡入淡出）
- 性能门控：`CONFIG.performance[perfQualityLevel].roundStartBannerGlow`

## 验收标准确认

| 验收项 | 状态 |
|--------|------|
| 普通回合不再出现弹珠选择界面 | ✅ |
| 「第 X 回合开始」大字提示（居中，约 1.5 秒） | ✅ |
| 左侧面板充能特效，三档均有对应表现 | ✅ |
| chaos_essence / pure_essence / relic 流程不受影响 | ✅ |
| 规范文档同步更新 | ✅ |
