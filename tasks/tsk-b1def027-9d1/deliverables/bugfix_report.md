# 致命 Bug 修复报告

**任务ID**: tsk-b1def027-9d1  
**分支**: fix/critical-bugs  
**提交**: 13ee73c  
**修改文件**: src/game_phase.js, src/game_system.js, src/ui_system.js  

## 修复清单

### BUGFIX #1 - pegTypes 硬编码截断（最高优先级）
- **文件**: `src/game_phase.js` (line 233-237)
- **方法**: `phase_gathering_getRandomPegType`
- **问题**: `pegTypes` 数组被硬编码为 `['bounce']`，导致所有元素属性钉子无法生成
- **修复**: 恢复完整 `allPegTypes` 数组，并通过 `filter(t => (this.unlockedWeights[t] || 0) > 0)` 动态过滤，确保只有已解锁属性才会出现

### BUGFIX #2 - meta_buyUpgrade 数值翻倍
- **文件**: `src/ui_system.js` (line 1173-1181)
- **方法**: `meta_buyUpgrade`
- **问题**: `isTemporary` 分支内外各调用了一次 `setDeepValue`，导致临时升级数值翻倍
- **修复**: 将 `effectValue` 计算提取到分支外，使用 `if/else` 确保 `setDeepValue` 只被调用一次

### BUGFIX #3 - specialSlots 类型错误
- **文件**: `src/game_system.js` (line 253-256)
- **方法**: `sys_resetGame`
- **问题**: `this.specialSlots` 被初始化为字符串数组 `["skill_point"]`，后续 `forEach` 调用 `s.draw()` 抛出 TypeError
- **修复**: 初始化为空数组 `[]`，SpecialSlot 实例在 `phase_gathering_initPachinko` 中动态创建

### BUGFIX #4 - multicast 颜色条件顺序错误
- **文件**: `src/ui_system.js` (line 930-940)
- **问题**: `if (item.multicast >= 5)` 在 `>= 10` 之前，导致金色徽章永远无法显示
- **修复**: 交换判断顺序，先判断 `>= 10`（金色），再判断 `>= 5`（紫色）

### BUGFIX #5a - 阶段跳转冗余赋值
- **文件**: `src/game_phase.js` (line 280-282)
- **方法**: `phase_startCombatPhase`
- **问题**: `phase_switchPhase('combat')` 内部已赋值 `this.phase = newPhase`，外部再次 `this.phase = 'combat'` 冗余
- **修复**: 删除冗余赋值行

### BUGFIX #5b - round++ 重复执行
- **文件**: `src/game_phase.js` (line 26-28)
- **方法**: `phase_advanceWave`
- **问题**: `round++` 在 `phase_advanceWave` 和 `phase_finalizeRound` 中均执行，导致回合计数异常
- **修复**: 删除 `phase_advanceWave` 中的 `round++`，保留 `phase_finalizeRound` 中的作为唯一执行位置

## 修改统计
- 3 files changed, 25 insertions(+), 18 deletions(-)
- 所有修改均为最小化改动，未进行结构性重构
- 每处修复均标注 `[BUGFIX]` 注释和对应问题编号
