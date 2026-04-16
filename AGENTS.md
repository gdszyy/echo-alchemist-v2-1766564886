# Echo Alchemist V2 AI Agent 协作规范 (AGENTS.md)
本文档是 Echo Alchemist V2 项目中所有 AI Agent（包括临时 Agent 和常驻 Agent）必须遵守的协作规范和工作指南。它定义了全局的编辑策略、代码风格约定以及各模块的规范文档索引。
## 1. 快速导航与核心入口规范 (Quick Navigation)

为了确保各技能 (Skills) 与本项目之间的索引契约一致，所有 Agent 在介入本项目时，**必须**优先阅读以下入口文档：

*   **项目全局规范入口**：本文档 (`AGENTS.md`)，包含核心编辑策略、禁止行为与文档索引。
*   **架构与防坑指南**：[`.cursor/rules/global.md`](.cursor/rules/global.md)（必读，包含子系统扩展规范与全局状态流转）。
*   **待办与进度大盘**：[`TODO.md`](TODO.md)（包含各阶段的完成状态与重构指标）。
*   **自适应性能规范**：[`.cursor/rules/performance.md`](.cursor/rules/performance.md)（凡修改粒子/特效/Peg/敌人渲染相关代码，必读）。
*   **流程洞察索引**：[`.cursor/rules/process_insights/index.md`](.cursor/rules/process_insights/index.md)（在涉及复杂跨模块流程、修复历史 Bug 区域或新增特效时必读；包含历次任务沉淀的防坑经验与版本化洞察文档）。

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
*   **自适应性能系统规范**：[`.cursor/rules/performance.md`](.cursor/rules/performance.md) - 基于手机平均帧率的动态特效等级系统（FPS 采样器、三档预算表、所有消费端关联索引、Agent 修改防坑指南）。**凡涉及粒子数量、特效上限、Peg 光效、敌人光泽的修改，必须先读此文档。**

### 数据索引文档（快速速查，无需读取源码）

*   **符文索引**：[`.cursor/rules/rune_index.md`](.cursor/rules/rune_index.md) - 所有 13 个符文的 ID、名称、稀有度、属性、掉落权重及亲和标签速查表。
*   **词条索引**：[`.cursor/rules/runeword_index.md`](.cursor/rules/runeword_index.md) - 所有 22 个词条的 ID、名称、符文组合、effectId、实现位置及与技能的解锁关系速查表。
*   **属性索引**：[`.cursor/rules/attribute_index.md`](.cursor/rules/attribute_index.md) - 7 种弹药属性的显示名称、克制关系（COUNTER_MAP）、共鸣效果（ELEMENT_RESONANCE_DB）及图鉴说明速查表。
*   **敌人词缀与 Boss 索引**：[`.cursor/rules/enemy_index.md`](.cursor/rules/enemy_index.md) - 8 种敌人词缀和 8 个 Boss 的行为机制、出现回合、克制属性、狂暴行为及关键代码位置速查表。

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
