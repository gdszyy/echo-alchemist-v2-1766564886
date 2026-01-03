# 代码重构标准操作流程 (SOP)

**版本**: 1.0  
**日期**: 2026-01-03  
**适用范围**: Echo Alchemist 项目代码拆分（平衡版）

---

## 一、SOP目标

本SOP旨在提供一个清晰、可重复的流程，以确保代码重构过程的**完整性**、**正确性**和**可追溯性**。通过严格遵循此流程，可以最大限度地减少因重构引入的错误，并确保所有功能在拆分后保持一致。

## 二、核心原则

- **小步快跑**: 每个阶段只做一个明确的拆分任务。
- **先验后移**: 在移动代码之前，先验证其功能。
- **持续验证**: 每个小步骤后都进行语法检查和功能测试。
- **文档驱动**: 严格按照验收表进行操作，不遗漏任何一项。
- **版本控制**: 充分利用Git进行分支管理和回滚。

---

## 三、验收SOP（标准操作流程）

### 3.1 验收前准备

#### 步骤1: 备份原始文件
在开始任何修改之前，创建核心文件的备份。
```bash
cd src/
cp core.js core.js.backup_$(date +%Y%m%d)
cp entities.js entities.js.backup_$(date +%Y%m%d)
```

#### 步骤2: 创建验收分支
所有重构工作必须在独立的分支中进行。
```bash
git checkout -b refactor/balanced-split
```

#### 步骤3: 生成完整清单
使用提供的Python脚本生成`core.js`和`entities.js`的完整类和方法清单，作为后续验收的基准。
```bash
# 假设脚本名为 generate_inventory.py
python3 generate_inventory.py
# 这将生成 core_inventory.json 和 entities_inventory.json
```

---

### 3.2 迁移验收流程

#### 阶段1: 音频系统迁移（预计2小时）

**迁移步骤**:
1. 创建 `src/audio.js`。
2. 从 `core.js` 复制 SoundManager 类（第70-948行）到 `audio.js`。
3. 在 `audio.js` 中添加导出: `export { SoundManager };`。
4. 在 `core.js` 中删除 SoundManager 类。
5. 在 `core.js` 顶部添加导入: `import { SoundManager } from './audio.js';`。

**验收检查清单**:
- [ ] `audio.js` 文件已创建。
- [ ] `audio.js` 包含完整的 SoundManager 类（对照`core_inventory.json`，应有15个方法）。
- [ ] `audio.js` 正确导出 SoundManager。
- [ ] `core.js` 中 SoundManager 类已删除。
- [ ] `core.js` 正确导入 SoundManager。
- [ ] 游戏启动无报错。
- [ ] 音效功能正常（测试至少5种音效：射击、爆炸、收集、斩击、魔法）。
- [ ] 静音切换功能正常。

**验收命令**:
```bash
# 检查语法错误
node --check src/audio.js
node --check src/core.js

# 启动游戏测试
# 在浏览器中打开 index.html 并进行功能测试
```

**验收签字**:
- 迁移完成: __________ (签名/日期)
- 功能验证: __________ (签名/日期)

---

#### 阶段2: entities.js 拆分（预计8小时）

**迁移顺序**: 严格按照 `mechanics` -> `effects` -> `projectiles` -> `enemy` -> `player` 的顺序进行，以确保依赖关系正确。

##### 2.1 迁移 entities/mechanics.js

**迁移步骤**:
1. 创建 `src/entities/` 目录和 `src/entities/mechanics.js` 文件。
2. 从 `entities.js` 复制以下内容到 `mechanics.js`:
   - 独立函数: `getAudio`, `adjustColorBrightness`, `lerpColor`, `lerp`, `hexToRgba`, `showToast`。
   - 类: `Vec2`, `MarbleDefinition`, `SpecialSlot`, `FortuneWheel`, `Peg`, `DropBall`。
3. 在 `mechanics.js` 顶部添加导入: `import { CONFIG } from '../config.js';`。
4. 在 `mechanics.js` 底部添加导出所有类和函数。

**验收检查清单**:
- [ ] `entities/mechanics.js` 文件已创建。
- [ ] 包含6个类和6个独立函数（对照`entities_inventory.json`）。
- [ ] 正确导入 CONFIG。
- [ ] 正确导出所有内容。
- [ ] 文件行数约1900行。
- [ ] 语法检查通过: `node --check src/entities/mechanics.js`。

##### 2.2 迁移 entities/effects.js

**迁移步骤**:
1. 创建 `src/entities/effects.js`。
2. 从 `entities.js` 复制以下类: `Particle`, `SlashEffect`, `CollectionBeam`, `Shockwave`, `FloatingText`, `EnergyOrb`, `CloneSpore`。
3. 添加导入: `import { CONFIG } from '../config.js';` 和 `import { Vec2, lerpColor, lerp } from './mechanics.js';`。
4. 添加导出所有类。

**验收检查清单**:
- [ ] `entities/effects.js` 文件已创建。
- [ ] 包含7个类。
- [ ] 正确导入依赖（CONFIG, Vec2, lerpColor, lerp）。
- [ ] 正确导出所有类。
- [ ] 文件行数约650行。
- [ ] 语法检查通过: `node --check src/entities/effects.js`。

##### 2.3 迁移 entities/projectiles.js

**迁移步骤**:
1. 创建 `src/entities/projectiles.js`。
2. 从 `entities.js` 复制以下内容: `rotateTowards` 函数和 `SwordQi`, `SlashAnim`, `SonSword`, `Projectile`, `LaserBeam`, `LightningBolt`, `FireWave` 类。
3. 添加导入和导出。

**验收检查清单**:
- [ ] `entities/projectiles.js` 文件已创建。
- [ ] 包含7个类和1个函数。
- [ ] 正确导入依赖。
- [ ] 正确导出所有内容。
- [ ] 文件行数约1450行。
- [ ] 语法检查通过: `node --check src/entities/projectiles.js`。

##### 2.4 迁移 entities/enemy.js 和 entities/player.js

**迁移步骤**:
1. 分别创建 `enemy.js` 和 `player.js`。
2. 从 `entities.js` 复制对应的 `Enemy` 和 `Player` 类。
3. 添加导入和导出。

**验收检查清单**:
- [ ] `enemy.js` 和 `player.js` 文件已创建。
- [ ] 分别包含 `Enemy` 和 `Player` 类。
- [ ] 正确导入依赖。
- [ ] 正确导出类。
- [ ] 语法检查通过。

##### 2.5 更新所有导入引用

**关键步骤**: 这是最容易出错的步骤。使用全局搜索和替换来更新所有文件的导入语句。

**需要更新的文件**:
- `src/core.js`
- `src/systems.js`
- `src/render3d/` 目录下的相关文件（虽然我们不修改render3d，但其依赖需要更新）

**验收检查清单**:
- [ ] 所有文件的导入语句已从 `from './entities.js'` 更新为 `from './entities/...'`。
- [ ] 游戏启动无报错。
- [ ] **完整游戏流程测试通过**（选择 -> 研磨 -> 战斗 -> 结算）。
- [ ] 3D模式切换正常。

**验收命令**:
```bash
# 检查是否还有旧的导入
grep "from './entities.js'" src/**/*.js  # 应无结果

# 启动游戏进行完整功能测试
```

**验收签字**:
- 迁移完成: __________ (签名/日期)
- 功能验证: __________ (签名/日期)

---

#### 阶段3: phases.js 创建（预计8-10小时）

**迁移步骤**:
1. 创建 `src/phases.js`。
2. 创建 `PhaseBase` 基类，包含 `init`, `update`, `render`, `cleanup` 等方法。
3. 创建 `SelectionPhase`, `GatheringPhase`, `CombatPhase` 类，并继承 `PhaseBase`。
4. **逐一**将 `core.js` 中对应的阶段方法迁移到相应的类中（参照验收表）。
5. 更新 `core.js` 中的 `Game` 类，实例化这三个阶段类。
6. 重构 `Game.phase_switchPhase` 方法以使用新的阶段对象。
7. 在 `Game.sys_loop` 中，调用当前阶段的 `update` 和 `render` 方法。

**验收检查清单**:
- [ ] `phases.js` 文件已创建，包含4个类。
- [ ] 对照验收表，所有阶段相关方法已从 `Game` 类中删除并迁移到 `phases.js`。
- [ ] `Game.phase_switchPhase` 已更新为调用阶段对象的 `init` 和 `cleanup`。
- [ ] `Game.sys_loop` 已更新为调用 `this.currentPhase.update()` 和 `this.currentPhase.render()`。
- [ ] 文件行数符合预期（`phases.js` 约1900行，`core.js` 约900行）。
- [ ] 语法检查通过。
- [ ] **完整游戏流程测试通过**，特别注意阶段切换的瞬间。

**验收命令**:
```bash
node --check src/phases.js
wc -l src/core.js   # 应约为900行

# 启动游戏，进行以下专项测试：
# 1. 测试命运抉择阶段的功能。
# 2. 测试研磨阶段（弹珠机）的物理和UI。
# 3. 测试战斗阶段的完整流程（敌人生成、攻击、死亡、结算）。
# 4. 反复测试阶段切换是否流畅，有无状态丢失。
```

**验收签字**:
- 迁移完成: __________ (签名/日期)
- 功能验证: __________ (签名/日期)

---

### 3.3 最终验收

#### 最终检查清单

**文件结构验收**:
- [ ] 确认所有新文件已创建，旧文件已删除或修改。
- [ ] 确认文件行数与方案基本一致。

**代码质量验收**:
- [ ] 所有文件语法检查通过。
- [ ] 使用 `madge --circular src/` 检查无循环依赖。
- [ ] 所有导入路径正确，无冗余导入。

**功能验收**:
- [ ] 游戏启动正常。
- [ ] 音效系统正常。
- [ ] 所有游戏阶段功能正常。
- [ ] 所有实体（玩家、敌人、投射物、效果）表现正常。
- [ ] UI显示和交互正常。
- [ ] 3D模式切换正常（即使不修改，也要验证集成）。
- [ ] 存档和加载功能正常。

**性能验收**:
- [ ] 使用浏览器性能分析工具，对比重构前后的帧率和内存占用，无明显下降。

**文档验收**:
- [ ] `docs/acceptance_checklist.csv` 已完整填写并签字。
- [ ] 本SOP文档中的所有检查项已完成。
- [ ] `docs/refactoring_plan_balanced.md` 已更新为最终状态。

#### 最终验收命令

```bash
# 1. 检查所有文件语法
for file in src/*.js src/entities/*.js; do node --check "$file"; done

# 2. 检查循环依赖（需要安装 madge）
# npm install -g madge
madge --circular src/

# 3. 生成最终依赖图
madge --image dependency-graph-final.png src/
```

#### 最终验收签字

- 技术负责人: __________ (签名/日期)
- 测试负责人: __________ (签名/日期)
- 项目负责人: __________ (签名/日期)

---

### 3.4 回滚流程

如果最终验收失败，或在任何阶段出现无法解决的问题，按以下步骤回滚：

```bash
# 1. 切换回主分支，放弃所有修改
git checkout main

# 2. 删除重构分支
git branch -D refactor/balanced-split

# 3. （可选）如果本地文件混乱，使用备份恢复
cd src/
cp core.js.backup_YYYYMMDD core.js
cp entities.js.backup_YYYYMMDD entities.js
```
