# UI 系统重构结果报告

## 任务 ID: tsk-7522264a-bad

## 完成的修改

### 1. 删除分数系统（score-num）
- `index.html`: 删除 `score-num` stat-pill DOM 元素
- `game_system.js`: 删除 `sys_resetGame` 中的 `score-num` DOM 操作，改为调用 `ui_updateRuneCountDisplay()`
- `game_phase.js`: 删除 `activeEnemies === 0` 时的 `score-num` DOM 更新
- `spawn_system.js`: `spawn_addScore` 中保留 `runCurrency` 加钱逻辑，删除 `score-num` DOM 操作
- `index.html`: 更新 phase-relic 跳过按钮文本（删除"500分"字样）

### 2. 删除局外货币 Energy Essence
- `index.html`: 删除 `meta-currency-display` 的 Energy Essence 文字，改为"符文碎片"
- `index.html`: 更新 `shop-currency-display` 样式（amber -> purple）
- `config.js`: `META_SHOP_CONFIG.resources` 中 `energy_essence` 改为 `rune_fragments`，所有升级项的 `resourceId` 同步更新
- `spawn_system.js`: 删除 `EnergyOrb` 回调中的 `meta_addCurrency` 调用

### 3. 引入符文碎片作为新局外货币（saveData.runeFragments）
- `core.js`: `saveData` 默认值添加 `runeFragments: 0`
- `game_system.js`: `sys_loadSaveData` 默认值添加 `runeFragments: 0`
- `ui_system.js`: `meta_addCurrency` 改为操作 `saveData.runeFragments`
- `ui_system.js`: `meta_buyUpgrade` 改为从 `saveData.runeFragments` 扣费
- `ui_system.js`: `ui_updateMetaCurrency` 显示 `runeFragments`，同步更新 `shop-currency-display`
- `ui_system.js`: `ui_renderShop` 中 `canAfford` 判断使用 `runeFragments`
- `game_phase.js`: `gameOver` 时将 `runCurrency` 转换为 `runeFragments` 并保存

### 4. 添加符文背包悬浮按钮和查看面板
- `index.html`: 在 `phase-gathering` 中添加符文背包悬浮按钮（右下角）
- `index.html`: 在 `phase-combat` 中添加符文背包悬浮按钮（右下角）
- `index.html`: 添加 `rune-backpack-panel` 全局面板（只读查看）
- `ui_system.js`: 新增 `ui_openRuneBackpack()` 函数
- `ui_system.js`: 新增 `ui_closeRuneBackpack()` 函数
- `ui_system.js`: 新增 `_ui_renderRuneBackpackList()` 私有函数（只读渲染符文列表）

### 5. 简化顶部信息栏
- `index.html`: 删除 `score-num` stat-pill
- `index.html`: 将 `run-currency-display` 改为 `rune-count-display`（显示符文数量）
- `ui_system.js`: 新增 `ui_updateRuneCountDisplay()` 函数
- `ui_system.js`: `ui_playResourceFlyEffect` 目标元素改为 `rune-count-display`

## Git 提交
- Commit: `bd32aca`
- Branch: `main`
- Repository: `gdszyy/echo-alchemist-v2-1766564886`
