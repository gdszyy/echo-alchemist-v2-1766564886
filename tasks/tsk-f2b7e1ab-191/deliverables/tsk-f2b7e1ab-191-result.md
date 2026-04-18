# 任务交付物：纯净精华单弹珠选择 + 跳过研磨功能

## 任务 ID
tsk-f2b7e1ab-191

## Git Commit
1112d50 - fix(pure_essence): 修复单弹珠展示 + 实现跳过研磨功能

## 修改文件

### 1. `src/spawn_system.js`
**修复问题1：纯净精华只生成 1 个弹珠**

在 `spawn_generateMarbleOptions()` 的循环前添加：
```js
// [pure_essence 修复] 纯净精华模式下只生成 1 个弹珠（不是从 6 个中选 1 个）
const generateCount = (this.selectionMode === 'pure_essence') ? 1 : CONFIG.gameplay.selectionCount;
for(let i=0; i < generateCount; i++) {
```

### 2. `src/ui_system.js`
**修复问题1：单卡居中布局**
**新功能：控制跳过研磨按钮显示**

在 `ui_refreshSelectionModeUI()` 中添加：
```js
// [pure_essence 修复] 纯净精华模式下展示单卡居中布局
const gridEl = document.getElementById('marble-selection-grid');
if (gridEl) {
    if (this.selectionMode === 'pure_essence') {
        gridEl.style.gridTemplateColumns = '1fr';
        gridEl.style.maxWidth = '160px';
    } else {
        gridEl.style.gridTemplateColumns = '';
        gridEl.style.maxWidth = '';
    }
}
// [pure_essence] 控制「跳过研磨」按钮的显示/隐藏
const skipGrindBtn = document.getElementById('skip-grind-btn');
if (skipGrindBtn) {
    skipGrindBtn.style.display = (this.selectionMode === 'pure_essence') ? 'flex' : 'none';
}
```

### 3. `src/game_system.js`
**新增 `sys_skipGrindGetRune()` 函数 + RUNE_DB import**

```js
import { COUNTER_MAP, RUNE_DB } from './rune_config.js';

sys_skipGrindGetRune() {
    if (this.selectionMode !== 'pure_essence') { return; }
    // 根据回合数确定符文等级
    const round = this.round || 1;
    let forcedLevel = 1;
    if (round >= 16) { forcedLevel = 3; }
    else if (round >= 6) { forcedLevel = 2; }
    // 调用 loot_calcRuneDrop 生成随机符文
    const drop = loot_calcRuneDrop(this, { forcedLevel });
    if (drop && drop.runeId) {
        this.runeInventory.push({ id: drop.runeId, level: drop.level || forcedLevel });
        if (this.saveData) this.saveData.runeInventory = (this.runeInventory || []).slice();
        showToast(`跳过研磨！获得 ${runeIcon} ${runeName} Lv.${drop.level || forcedLevel}`);
    }
    // 清理状态
    this.marbleQueue = [];
    this.activeMarbleIndex = 0;
    this.ammoQueue = [];
    this.selectionMode = 'standard';
    this.selectionRequiredCount = CONFIG.gameplay.selectionReq || 3;
    this.selectionInjectedRune = null;
    this.selectionPreviewState = null;
    this.fateMomentContext = null;
    this.pendingSelectionMode = null;
    // 存档
    if (typeof this.sys_saveRunState === 'function') this.sys_saveRunState();
    // 直接进入战斗阶段（跳过研磨）
    if (typeof this.phase_startCombatPhase === 'function') {
        this.phase_startCombatPhase();
    } else {
        this.phase_switchPhase('combat');
    }
}
```

### 4. `index.html`
**新增跳过研磨按钮**

```html
<button id="skip-grind-btn" onclick="game.sys_skipGrindGetRune()" style="display:none;" 
    class="mt-2 flex items-center gap-1.5 px-4 py-2 bg-slate-800/80 border border-slate-600/60 rounded-lg text-xs text-slate-300 hover:bg-slate-700/80 hover:border-slate-400/80 hover:text-white transition-all duration-200">
    <span>⏩</span>
    <span>跳过研磨，隨機符文</span>
</button>
```

## 验收标准确认

| 验收项 | 状态 |
|--------|------|
| 纯净精华命运时刻界面只展示 1 个弹珠 | ✅ 已修复（spawn_system.js generateCount=1） |
| 「跳过研磨」按钮在纯净精华模式下可见 | ✅ 已实现（ui_refreshSelectionModeUI 控制显示） |
| 点击「跳过研磨」后符文正确加入 runeInventory | ✅ 已实现（sys_skipGrindGetRune） |
| 符文等级符合回合数规则 | ✅ Round 1-5→Lv1, 6-15→Lv2, 16+→Lv3 |
| 直接进入战斗阶段 | ✅ 调用 phase_startCombatPhase() |
| 跳过后刷新不丢失状态 | ✅ sys_saveRunState() 已调用 |
| 现有「选择弹珠 + 注入符文」路径不受影响 | ✅ 未修改 ui_confirmSelection 逻辑 |
