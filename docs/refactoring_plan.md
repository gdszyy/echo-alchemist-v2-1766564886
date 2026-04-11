# Echo Alchemist V2 架构改造与 AI 协作流升级规划

**日期：** 2026年4月11日
**作者：** Manus AI
**目标仓库：** [gdszyy/echo-alchemist-v2-1766564886](https://github.com/gdszyy/echo-alchemist-v2-1766564886)

## 1. 改造背景与目标

针对 `Echo Alchemist V2` 项目在 AI 辅助开发中暴露出的高 Token 消耗、模块耦合度高以及上下文管理混乱等问题，本规划旨在通过一系列架构和工程化改造，建立一套高效、可维护且高度适应 AI Agent 协作的现代开发工作流。

核心目标包括：
1. **彻底终结全量文件交付**：引入智能编辑策略，根据任务规模动态选择修改方式。
2. **模块化与架构解耦**：拆分巨型单体文件，消除巨型 Mixin 模式。
3. **建立基于 Git 的活文档（Living Documentation）知识库**：将领域知识（Skills）与代码库同构管理，实现“代码-文档”的协同演进。

## 2. 核心改造方案调研与设计

### 2.1 智能编辑策略：动态选择修改方式

虽然 `Unified Diff` 能够显著降低 Token 消耗，但完全依赖 Diff 也会带来脆弱性（例如当上下文发生变化时，Patch 可能会应用失败）。根据业界（如 Morph Fast Apply 模型和 Claude Code）的经验，最佳实践是**根据任务规模动态选择编辑策略** [1] [2]：

- **微型修改（1-5行，如修复拼写、调整参数）**：使用精确的搜索-替换块（Search/Replace Blocks）或正则表达式修改。
- **中型修改（局部逻辑重构、新增函数）**：使用 `Unified Diff` 格式交付，并要求 AI 必须包含足够的上下文行（通常为 3-5 行）以确保精准匹配。
- **大型修改（跨多个函数的重构、结构性改变）**：此时 Diff 极易出错，应采用**全文件重写（Full-file Rewrite）**，但前提是目标文件已经被拆分得足够小（< 500 行）。
- **脚本化编辑（Script Generation）**：对于涉及多个文件的模式化修改（如批量重命名），应让 Agent 生成并执行 Shell 脚本（如 `sed`、`awk`），使文件内容完全不进入 Token 流。

### 2.2 基于 Git 的领域知识库（Git-based Skill Knowledge Base）

传统的做法是维护庞大的全局系统提示词（如 `CLAUDE.md` 或 `AGENTS.md`），但这会导致每次对话都加载大量无关信息，引发“上下文腐烂”（Context Rot）[3]。

我们采用**“规范驱动开发”（Spec-Driven Development）**与**嵌套规则（Nested Rules）**相结合的架构 [4] [5]：

1. **知识库同构化**：不再依赖外部的中心化 Skill 系统。所有的领域知识、模块规范和架构约定，都以 Markdown 文件的形式直接存储在 Git 仓库的 `.cursor/rules/` 或对应模块的子目录中。
2. **统一调度 Skill**：创建一个轻量级的“统一开发者 Skill”（如 `echo_developer_skill`），其唯一职责是：在接到任务后，首先读取项目根目录的索引文件（如 `AGENTS.md`），根据任务涉及的模块，动态拉取对应的具体规范文件。
3. **代码与文档协同演进（Co-evolution）**：在统一开发者 Skill 中明确规定：**任何对代码逻辑的实质性修改，必须伴随着对对应模块 Markdown 规范文档的更新**。AI 必须在同一个 PR/Commit 中同时交付代码和文档的修改，确保文档永远是“活的”（Living Documentation）。

### 2.3 模块化拆分方案

为了配合智能编辑策略和分布式知识库，必须对现有的巨型文件进行物理拆分。

- **解耦核心**：彻底废弃 `Object.assign(Game.prototype, ...)`，全面拥抱现有的 `event_bus.js` 进行模块间通信。
- **拆分目标**：
  - `entities.js` (6100+行) 拆分为：`utils/math.js`、`effects/particles.js`、`entities/enemy.js`、`entities/projectile.js`。
  - `combat_system.js` (2500+行) 拆分为：`combat/damage_calc.js`、`combat/collision.js`。
  - `ui_system.js` (2000+行) 拆分为：`ui/hud.js`、`ui/shop.js`、`ui/relics.js`。

## 3. 任务拆分清单 (Linear / GitHub Issues)

整个改造工程将采用“梯度下降”式的迭代方式，分为三个主要阶段进行。每个任务完成后，必须在 GitHub 上提交对应的 Commit，并与 Linear 任务关联。

### 阶段一：基础设施与知识库搭建 (Phase 1: Infrastructure & Knowledge Base)

本阶段的目标是建立“代码-文档”协同演进的框架，不涉及大规模业务代码重构。

- [ ] **Task 1.1: 初始化 Git 知识库目录结构**
  - 在仓库根目录创建 `.cursor/rules/` 目录。
  - 创建根路由文件 `AGENTS.md`，定义项目的全局规范（如禁用全量交付、代码风格）以及子模块规范的索引。
- [ ] **Task 1.2: 提取并归档历史文档**
  - 将 `tasks/` 目录下的历史设计文档（如符文设计、音频修复记录）整理并移动到 `docs/Archive/` 目录。
  - 将当前有效的系统架构信息提取为初步的模块规范文件（如 `.cursor/rules/audio_system.md`）。
- [ ] **Task 1.3: 开发“统一开发者 Skill”**
  - 编写或更新 Manus 调度脚本，使其在分配开发任务时，强制执行“先读 AGENTS.md -> 找对应模块 MD -> 修改代码 -> 更新模块 MD”的标准工作流。

### 阶段二：核心模块物理拆分 (Phase 2: Module Splitting)

本阶段是降低 Token 消耗的核心，将巨型文件拆分为小文件，为后续的高效编辑铺平道路。

- [ ] **Task 2.1: 拆分 `entities.js` (第一部分：工具与特效)**
  - 提取数学计算、通用工具类至 `src/utils/`。
  - 提取所有视觉特效类（Particle, Shockwave 等）至 `src/effects/`。
  - **同步更新**：创建并完善 `.cursor/rules/entities.md`。
- [ ] **Task 2.2: 拆分 `entities.js` (第二部分：核心实体)**
  - 将 `Enemy`、`Projectile`、`Player` 等核心实体剥离为独立文件。
- [ ] **Task 2.3: 拆分 `combat_system.js`**
  - 将伤害计算逻辑与碰撞检测逻辑分离。
  - **同步更新**：创建 `.cursor/rules/combat.md`。
- [ ] **Task 2.4: 拆分 `ui_system.js`**
  - 按功能域（商店、HUD、弹珠配方）拆分 UI 渲染逻辑。
  - **同步更新**：创建 `.cursor/rules/ui.md`。

### 阶段三：架构解耦与通信重构 (Phase 3: Architecture Decoupling)

本阶段旨在彻底消除巨型 Mixin 带来的状态污染。

- [ ] **Task 3.1: 完善 EventBus 机制**
  - 梳理并定义全系统标准事件字典（Event Dictionary），记录于 `.cursor/rules/events.md`。
- [ ] **Task 3.2: 消除 UI 层与业务层的强耦合**
  - 重构 `combat_system.js` 等业务模块，移除所有直接的 DOM 操作。
  - 改为通过 EventBus 触发事件，由 UI 模块监听并更新视图。
- [ ] **Task 3.3: 移除 `Object.assign` Mixin 模式**
  - 重构 `core.js`，将原本混入到 `Game.prototype` 的方法，改为各模块独立导出并按需导入。
  - 修复由此带来的 `this` 指向问题。

## 4. 预期收益与度量指标

完成上述改造后，预期将达成以下效果：
1. **Token 消耗锐减**：日常迭代任务的输入/输出 Token 消耗预计降低 70% - 85%。
2. **上下文精准**：AI Agent 每次只需加载全局 `AGENTS.md` + 1~2 个特定模块的规范文档，彻底消除上下文噪音。
3. **知识永不过期**：强制的代码与文档协同演进（Co-evolution）机制，将确保知识库始终反映当前代码库的真实状态，大幅降低维护成本。

---

### References

[1] Morph. "Fast Apply: Code Merging at 10,500 tok/s for AI Agents." Morph Blog.
[2] Aider. "Unified diffs make GPT-4 Turbo 3X less lazy." Aider Documentation.
[3] Anthropic. "Effective context engineering for AI agents." Anthropic Engineering Blog, Sep 2025.
[4] GitHub. "Spec-driven development with AI: Get started with a new open source toolkit." GitHub Blog, Sep 2025.
[5] SitePoint. "Cursor Rules Advanced Guide: Pattern Configuration & Templates." SitePoint, Mar 2026.
