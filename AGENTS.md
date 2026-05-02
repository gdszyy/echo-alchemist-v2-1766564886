# Echo Alchemist V2 AI Agent 协作规范 (AGENTS.md)
本文档是 Echo Alchemist V2 项目中所有 AI Agent（包括临时 Agent 和常驻 Agent）必须遵守的协作规范和工作指南。它定义了全局的编辑策略、代码风格约定以及各模块的规范文档索引。
## 1. 快速导航与核心入口规范 (Quick Navigation)

为了确保各技能 (Skills) 与本项目之间的索引契约一致，所有 Agent 在介入本项目时，**必须**优先阅读以下入口文档：

*   **项目全局规范入口**：本文档 (`AGENTS.md`)，包含核心编辑策略、禁止行为与文档索引。
*   **架构与防坑指南**：[`.cursor/rules/global.md`](.cursor/rules/global.md)（必读，包含子系统扩展规范与全局状态流转）。
*   **待办与进度大盘**：[`TODO.md`](TODO.md)（包含各阶段的完成状态与重构指标）。
*   **自适应性能规范**：[`.cursor/rules/performance.md`](.cursor/rules/performance.md)（凡修改粒子/特效/Peg/敌人渲染相关代码，必读）。
*   **流程洞察索引**：[`.cursor/rules/process_insights/index.md`](.cursor/rules/process_insights/index.md)（在涉及复杂跨模块流程、修复历史 Bug 区域或新增特效时必读；包含历次任务沉淀的防坑经验与版本化洞察文档）。
*   **自动函数索引**：[`.cursor/rules/auto_index/INDEX.md`](.cursor/rules/auto_index/INDEX.md)（在涉及大文件修改时必读；包含所有大文件的函数名、行号范围和 @section 内部节点映射，由 `code-indexer` 脚本自动维护，**严禁手动编辑**）。
*   **位图化视觉重构规格**：[`design_spec_bitmap.md`](design_spec_bitmap.md)（凡涉及位图生成、Sprite 接入、图标替换的任务必读；包含 UI 切图清单、敌人 Sprite 规格、Boss 形象清单）。
*   **测试基础设施规范**：[`.cursor/rules/testing.md`](.cursor/rules/testing.md)（凡修改涉及遗物、精华、符文词条、敌人词条等核心机制时必读；包含试炼场场景规范、Puppeteer 测试套件运行方式、测试覆盖范围与已知盲区）。

所有专门针对本项目的技能 (如 `echo-developer`) 仅需指引 Agent 阅读上述入口，无需在技能文件内硬编码具体的架构细节或行数统计。

---

## 1.5 性能自适应影响标记规范

为了防止新增代码破坏已有的自适应性能系统，所有 AI Agent 在进行可能影响渲染性能的修改时，**必须**遵循以下标记与评估规范：

1. **触发条件**：凡涉及新增粒子、特效对象、修改 Canvas 混合模式（如 `lighter`、`screen`）、使用发光属性（`shadowBlur`）或重建渐变（`createRadialGradient` 等）的修改，均触发本规范。
2. **标记要求**：
   - **代码注释**：在受影响的函数或代码块上方添加 `// @perf-impact: [影响简述]` 标记。
   - **Commit Message**：在提交信息末尾添加 `[perf-impact]` 标签。
3. **强制评估**：修改代码后，必须在 PR 或任务总结中包含“性能自适应影响评估”，说明该修改在 `high`/`medium`/`low` 三档下的表现，并确认已接入 `CONFIG.performance` 预算。
4. **基准参考**：详细评估流程与已知瓶颈列表，请参阅 [PI-005: 性能自适应影响评估流程](.cursor/rules/process_insights/PI-005_perf_impact_assessment.md)。

---

## 2. 全局 AI 编辑策略规范
为了解决巨型单体文件带来的高 Token 消耗问题，本项目严禁全量文件交付模式。所有 AI Agent 在修改代码时，必须遵循以下**智能编辑策略决策树**：
### 智能编辑策略决策树
在对代码文件进行修改前，请根据预计修改的行数和复杂度，选择合适的编辑策略：
1.  **微型修改（< 20 行）**
    *   **策略**：使用搜索替换（Search and Replace）或行内编辑。
    *   **适用场景**：修复小 Bug、修改变量名、调整局部逻辑、添加少量注释。
    *   **工具推荐**：使用 `sed`、`awk` 或专用的文本编辑工具（如 `file` 模块的 `edit` 动作）。
2.  **中型修改（20 - 200 行）**
    *   **策略**：使用 Unified Diff 格式进行补丁应用（Patch）。
    *   **适用场景**：重构单一函数、添加中等规模的新特性、调整局部架构。
    *   **工具推荐**：生成标准的 diff 文件，并使用 `patch` 命令应用。
3.  **大型修改（> 200 行）**
    *   **策略**：全文件重写（Full File Rewrite）。
    *   **适用场景**：仅在文件本身较小（< 500 行）且需要进行彻底重构时使用。**严禁对超过 500 行的文件进行全量重写**。对于大型文件，必须先将其拆分为多个小文件，然后再进行修改。
    *   **工具推荐**：直接写入新文件覆盖旧文件。
4.  **脚本化修改（结构化重构）**
    *   **策略**：编写 Python 或 Node.js 脚本，利用 AST（抽象语法树）或正则表达式进行自动化重构。
    *   **适用场景**：跨文件的大规模 API 替换、统一的格式化调整、批量重命名。
    *   **工具推荐**：编写专用脚本执行。
### 强制要求
*   **禁止全量文件交付**：严禁在未评估修改规模的情况下直接输出整个文件的代码，特别是对于 `entities.js`、`combat_system.js`、`ui_system.js` 等核心大文件。
*   **同步更新文档**：任何代码修改，如果涉及到架构、API、状态管理或核心逻辑的变更，**必须在同一个 Commit 中同步更新对应模块的规范文档**（位于 `.cursor/rules/` 目录下）。
*   **历史文档归档**：过期的设计文档和旧版本的记录应移动到 `docs/archive/` 目录，保持文档库的整洁。
## 3. 代码风格约定
本项目采用原生 JavaScript (ES Modules) 架构。所有新编写或重构的代码必须遵循以下风格：
*   **命名规范**：
    *   变量和函数名使用驼峰命名法（camelCase）。
    *   类名使用帕斯卡命名法（PascalCase）。
    *   常量使用全大写字母加下划线（UPPER_SNAKE_CASE）。
    *   私有属性和方法以单下划线开头（例如 `_privateMethod`）。
*   **模块化**：
    *   使用 ES6 的 `import` 和 `export` 进行模块管理。
    *   每个文件应保持单一职责原则，避免产生巨型文件。
*   **状态管理**：
    *   禁止直接修改全局 `Game` 实例上的属性（如 `this.phase`）。
    *   使用 `event_bus.js` 提供的 EventBus 机制进行模块间的通信和状态同步。
*   **UI 与逻辑分离**：
    *   业务逻辑模块（如 `combat_system.js`）严禁直接操作 DOM。
    *   UI 更新应通过监听 EventBus 的事件，在 `ui_system.js` 中统一处理。
*   **注释与文档**：
    *   复杂的算法和业务逻辑必须添加清晰的注释。
    *   移除无用的自动生成 TODO 注释。
## 4. 子模块规范文档索引
为了指导各个子模块的开发和重构，项目在 `.cursor/rules/` 目录下维护了详细的模块规范文档。以下是当前的文档索引：
*   **全局规范**：[`.cursor/rules/global.md`](.cursor/rules/global.md) - 包含项目整体架构概述、模块依赖关系及全局禁止行为清单。
*   **音频系统规范**：[`.cursor/rules/audio.md`](.cursor/rules/audio.md) - 音频系统架构约定（SoundManager 类、延迟初始化机制、已知问题与修改规范）。
*   **配置模块规范**：[`.cursor/rules/config.md`](.cursor/rules/config.md) - 全局配置结构（ELEMENT_CONFIG、RELIC_DB、SKILL_DB 等数据字典格式和修改规范）。
*   **符文系统规范**：[`.cursor/rules/rune_system.md`](.cursor/rules/rune_system.md) - 符文系统完整规范（智能掉落算法、网格拼图逻辑、合成重铸规则）。
*   **游戏阶段规范**：[`.cursor/rules/game_phase.md`](.cursor/rules/game_phase.md) - 阶段转换逻辑（命运抉择→研磨→战斗的状态机、各阶段的入口/出口条件）。
*   **事件总线规范**：[`.cursor/rules/events.md`](.cursor/rules/events.md) - 事件总线机制（EventBus）、标准事件字典与事件通信规范。（Task 3.1 完成）
*   **实体系统规范**：[`.cursor/rules/entities.md`](.cursor/rules/entities.md) - 实体系统拆分状态、依赖管理与性能要求规范。（Task 2.2 完成：已提取 Enemy 和 Projectile 类，entities.js 减少约 2004 行）
*   **战斗系统规范**：[`src/combat/combat.md`](src/combat/combat.md) - 包含战斗模块拆分结构、职责边界、组合模式注入方式及 DOM 操作迁移计划。（Task 2.3 完成）
*   **UI 系统规范**：[`.cursor/rules/ui_system.md`](.cursor/rules/ui_system.md) - UI 子模块架构（hud.js、shop.js、rune_launcher.js）、函数命名约定、耦合点标记规范。
*   **游戏系统与试炼场规范**：[`.cursor/rules/systems.md`](.cursor/rules/systems.md) - 包含试炼场（TrainingGround）场景化配置契约、真理之书（TruthBook）图鉴配置及 UI 渲染机制。
*   **生成系统规范**：[`.cursor/rules/spawn_system.md`](.cursor/rules/spawn_system.md) - 导演系统阵型模板完整规范（所有阵型的设计意图、触发条件和实现细节）。（Task B.1/B.2 完成）
*   **自适应性能系统规范**：[`.cursor/rules/performance.md`](.cursor/rules/performance.md) - 基于手机平均帧率的动态特效等级系统（FPS 采样器、三档预算表、所有消费端关联索引、Agent 修改防坑指南）。**凡涉及粒子数量、特效上限、Peg 光效、敌人光泽的修改，必须先读此文档。**

### 数据索引文档（快速速查，无需读取源码）

*   **符文索引**：[`.cursor/rules/rune_index.md`](.cursor/rules/rune_index.md) - 所有 13 个符文的 ID、名称、稀有度、属性、掉落权重及亲和标签速查表。
*   **词条索引**：[`.cursor/rules/runeword_index.md`](.cursor/rules/runeword_index.md) - 所有 22 个词条的 ID、名称、符文组合、effectId、实现位置及与技能的解锁关系速查表。
*   **属性索引**：[`.cursor/rules/attribute_index.md`](.cursor/rules/attribute_index.md) - 7 种弹药属性的显示名称、克制关系（COUNTER_MAP）、共鸣效果（ELEMENT_RESONANCE_DB）及图鉴说明速查表。
*   **敌人词缀与 Boss 索引**：[`.cursor/rules/enemy_index.md`](.cursor/rules/enemy_index.md) - 8 种敌人词缀和 8 个 Boss 的行为机制、出现回合、克制属性、狂暴行为及关键代码位置速查表。

*   **位图化视觉重构规格**：[`design_spec_bitmap.md`](design_spec_bitmap.md) - 阶段五规划文档。包含 UI 切图清单（9-Slice 规格 + 图标尺寸）、敌人 Sprite 规格（128×128 基准、帧数要求、Overlay 分层设计）、8 种 Boss 专属形象清单。**凡涉及位图生成、Sprite 接入、图标替换的任务，必先读此文档。**
*   **UI 页面与美术素材需求清单**：[`docs/ui_asset_requirements.md`](docs/ui_asset_requirements.md) - 所有 UI 页面（`#phase-*` + 组件）的美术状态、缺失素材清单与优先级（P0/P1/P2）、命名/尺寸/接入路径规范。**新增 UI 页面或替换素材时必先读此文档，并同步更新该表。**

### 核心机制文档（深度阅读，含数值与流程说明）

*   **核心机制文档**：[`docs/core_mechanics.md`](docs/core_mechanics.md) - 四大核心机制的完整数值与流程说明：“符文充能”、“子弹替换（混沌/纯净精华两条路径）”、“遗物/精华保底概率（DropPity V3）”、“符文智能掉落算法（三层加权）”。**凡修改上述任一机制时，必须先读此文档。**
*   **敌人视觉设计 V2**：[`docs/enemy_visual_design_v2.md`](docs/enemy_visual_design_v2.md) - 敌人尺寸足迹、基底类型、专属词条与 3×3 范围内大型敌人的视觉/机制规范。**凡修改敌人尺寸、基底形体、敌人词条归属或大型敌人生成逻辑时，必须先读此文档。**

> **架构状态（Task 3.3 更新）**：`core.js` 已完全移除 `Object.assign(Game.prototype, ...)` Mixin 模式。全部 10 个子系统均已迁移至组合模式（Composition via bind）。新增子系统必须遵循 [`.cursor/rules/global.md`](.cursor/rules/global.md) 第 5 节「子系统扩展规范」。

> **注意**：随着项目的拆分和重构，本索引应持续更新。每个子模块的负责 Agent 在完成初步重构后，需创建并维护对应的规则文档。

## 5. 流程洞察体系 (Process Insights)

流程洞察是 Agent 在完成任务后沉淀的经验文档，记录非直观的隐蔽逻辑、跨模块耦合陷阱和关键操作流程。与静态模块规范不同，流程洞察随任务持续积累，并通过独立版本号管理演进。

*   **洞察注册表**：[`.cursor/rules/process_insights/index.md`](.cursor/rules/process_insights/index.md) - 所有活跃与废弃洞察的版本索引。

**当前活跃洞察清单（快速预览）**：

| ID | 标题 | 适用场景 |
|----|------|----------|
| PI-001 | 核心 Bug 修复流程与高频陷阱 | 修改 `game_phase.js`、`ui_system.js`、`game_system.js` 时 |
| PI-002 | 符文词条 Hook 注入流程 | 新增或修改符文词条效果时 |
| PI-003 | 子系统扩展与组合模式注入流程 | 新增子系统或修改 `core.js` 时 |
| PI-004 | 性能预算扩展与新特效接入流程 | 新增粒子特效或高开销视觉效果时 |

**Agent 维护规范**：
- 当任务中发现隐蔽逻辑或耦合陷阱时，**必须**在任务完成后在此目录创建或更新对应洞察文档。
- 新增洞察的 Git Commit 必须包含对 `index.md` 的更新。
- 因代码重构导致洞察失效时，必须将其标记为 `[DEPRECATED]` 并在索引中归档。

---

## 6. 自动函数索引维护规范 (Auto Index Maintenance)

本项目已建立 `.cursor/rules/auto_index/` 函数级索引体系，由 `code-indexer` 脚本自动维护。所有 Agent 在修改代码后必须遵循以下规范，确保索引与源码保持同步。

### 6.1 索引更新触发规则

| 场景 | 操作 |
|------|------|
| 修改已索引大文件（>500行 或 >20个函数）中的函数 | **必须**在 Git Commit 之前更新对应文件的索引 |
| 新增函数到已索引大文件 | **必须**更新该文件索引 |
| 仅修改 Markdown、配置文件或静态资源 | 无需更新索引 |
| 新文件超过阈值（500行 或 20个函数） | 运行全量扫描生成新索引 |

### 6.2 索引更新命令

**单文件更新（日常开发，推荐）**：

```bash
# 修改单个文件后，仅更新该文件的索引
python3 /home/ubuntu/skills/code-indexer/scripts/generate_index.py \
  <仓库本地路径> --file src/combat_system.js
```

**全量重建（修复索引损坏或初次建立时使用）**：

```bash
python3 /home/ubuntu/skills/code-indexer/scripts/generate_index.py \
  <仓库本地路径> --src-dirs src
```

### 6.3 @section 标记规范

当函数超过 **200 行**时，必须在函数内部按业务逻辑块添加 `@section` 标记，以便索引器提取内部节点映射：

```javascript
function combat_damageEnemy(enemy, projectile) {
    // @section:damage_pre_calc - 伤害前置计算：基础值、暴击、穿透
    const baseDmg = projectile.damage;
    // ...

    // @section:damage_runeword_hooks - 符文词条 Hook 注入点
    if (hasRuneword('focused_fire')) { ... }

    // @section:damage_apply_to_enemy - 伤害写入敌人并触发属性反应
    enemy.takeDamage(finalDmg);
}
```

**格式规范**：`// @section:{snake_case_name} - {一句话中文说明}`

- `snake_case_name`：全小写下划线，描述该段的业务职责
- 说明：一句话，不超过 20 个汉字
- 标记必须独占一行，与上方代码之间空一行

### 6.4 已索引大文件清单

以下文件已建立函数级索引，修改时必须同步更新：

| 文件 | 行数 | 函数数 | @section 数 | 索引文件 |
|------|------|--------|------------|----------|
| `src/entities.js` | ~4741 | 104 | 21 | [auto_index/src_entities_js_index.md](.cursor/rules/auto_index/src_entities_js_index.md) |
| `src/entities/enemy.js` | ~4418 | 26 | 18 | [auto_index/src_entities_enemy_js_index.md](.cursor/rules/auto_index/src_entities_enemy_js_index.md) |
| `src/combat_system.js` | ~3331 | 42 | 22 | [auto_index/src_combat_system_js_index.md](.cursor/rules/auto_index/src_combat_system_js_index.md) |
| `src/systems.js` | ~2810 | 85 | 10 | [auto_index/src_systems_js_index.md](.cursor/rules/auto_index/src_systems_js_index.md) |
| `src/game_phase.js` | ~2461 | 16 | 15 | [auto_index/src_game_phase_js_index.md](.cursor/rules/auto_index/src_game_phase_js_index.md) |
| `src/spawn_system.js` | ~2120 | 28 | 8 | [auto_index/src_spawn_system_js_index.md](.cursor/rules/auto_index/src_spawn_system_js_index.md) |
| `src/game_system.js` | ~1788 | 42 | 0 | [auto_index/src_game_system_js_index.md](.cursor/rules/auto_index/src_game_system_js_index.md) |
| `src/ui/rune_launcher.js` | ~1682 | 25 | 0 | [auto_index/src_ui_rune_launcher_js_index.md](.cursor/rules/auto_index/src_ui_rune_launcher_js_index.md) |
| `src/effects/particles.js` | ~1371 | 58 | 0 | [auto_index/src_effects_particles_js_index.md](.cursor/rules/auto_index/src_effects_particles_js_index.md) |
| `src/ui_system.js` | ~1352 | 40 | 0 | [auto_index/src_ui_system_js_index.md](.cursor/rules/auto_index/src_ui_system_js_index.md) |

> **完整索引入口**：[`.cursor/rules/auto_index/INDEX.md`](.cursor/rules/auto_index/INDEX.md)

### 6.5 禁止行为

- **严禁手动编辑** `.cursor/rules/auto_index/` 目录下的任何文件，该目录 100% 由脚本自动生成
- **严禁在 Git Commit 中包含过期索引**：代码修改与索引更新必须在同一个 Commit 中
- **严禁删除 @section 标记**：已有标记只能增加或修改，不能删除（除非对应代码段已被移除）
