# 药剂炼成开发计划

> 状态词口径：`done` = 已有 gameplay 或持久化行为并有测试；`contract-only` = 字段、metadata、VFX dispatcher 或文档合同，不代表玩法完成；`placeholder` = 占位表现或临时资产；`debt` = 仍需后续 Codex 开发。
> 当前药剂线：done = C1 中断与覆盖边界、Root Orb carrier、Tower active/death 基础运行时、共享嵌套校验、root `spellTree` 保存；contract-only = 静态药剂 `vfxProfile` 与通用法阵 VFX dispatcher；debt = C4 `spellContent`、C6 多节点嵌套 UI、完整 Tower 系统与正式资产。
> 权威规则来源：[`docs/rune_potion_spell_contract.md`](rune_potion_spell_contract.md)。
> 特效规格来源：[`docs/spell_vfx_design.md`](spell_vfx_design.md)。
> 目标：把当前“静态药瓶药剂 + 黑箱炼成面板”整理成可持续推进的工程路线，最终落到“符文组合 = 法术内容，法阵 = 形态 + 嵌套合约，药剂 = spellTree 封装结果”。

## 1. 文档分层

药剂机制后续只按以下文档分工维护，避免旧设计稿重新分叉：

| 文档 | 职责 | 修改时机 |
|---|---|---|
| `docs/rune_potion_spell_contract.md` | 机制权威口径：炼成顺序、黑箱规则、法阵合法性、嵌套禁用清单、数据结构建议 | 修改药剂规则、合法性矩阵、嵌套规则时 |
| `docs/potion_alchemy_development_plan.md` | 工程现状、差距、分期计划、文件影响范围与验收清单 | 推进药剂功能、拆任务或调整优先级时 |
| `docs/spell_vfx_design.md` | 法阵形态 VFX 规格、表现层 helper、性能与验收要求 | 新增或调整法阵表现层时 |
| `docs/core_mechanics.md` | 核心机制总览入口，只保留摘要和权威链接 | 药剂机制影响核心循环说明时 |
| `.cursor/rules/config.md` | `POTION_SPELL_DB`、失败返还、遗物解锁、字段要求 | 修改配置字段或药剂库时 |
| `.cursor/rules/ui_system.md` | 炼金台 UI 职责、函数入口、UI/战斗边界 | 修改药剂炼成面板时 |
| `src/combat/combat.md` | 战斗药剂槽、释放入口、VFX 与结算边界 | 修改药剂战斗释放时 |

旧 `rune_design_v5`、`rune_system_redesign`、`skill_system_alchemy_redesign`、风剑词条任务稿已归档，只能作为历史材料，不再作为实现依据。

## 2. 当前代码现状

| 层级 | 文件/入口 | 当前状态 |
|---|---|---|
| 解锁与配置 | `src/config.js` | `relic_sage_apothecary` 解锁药剂炼成；`CONFIG.gameplay.potionAlchemyFailRefundRatio = 0.35`；`POTION_SPELL_DB` 有 9 个静态药剂 |
| 运行态字段 | `src/core.js`、`src/game_system.js` | 已初始化并存档 `potionAlchemyUnlocked`、`preparedPotionSpell`、`knownPotionSpellIds`、`potionRecipeHistory`、`_potionAlchemyDraft` |
| 炼成 UI | `src/ui/rune_launcher.js`、`index.html` | 已有药剂 Tab、投料即消耗、黑箱状态反馈、法阵形态按钮、手动接触封装、失败返还、炼金笔记 |
| 当前配方解析 | `src/ui/rune_launcher.js -> _ui_resolvePotionRecipe()` | 仍是元素宽松匹配，2-4 个符文直接映射到 9 个静态 `potionId`，尚未解析 `RUNEWORD_DB` 的 `spellContent` |
| 战斗槽 UI | `src/systems.js -> UIManager.updateSkillBar()` | 贤者药匣解锁后显示药剂槽；药剂不消耗 SP，只显示 `charges/maxCharges` |
| 战斗释放 | `src/combat_system.js` | `combat_activatePotionSpell()` 校验阶段与装药量；`combat_applyPotionSpell()` 兼容旧静态药剂并读取 `spellTree` 分流 Root Orb / Tower / 内容结算，成功后扣 1 装药 |
| 药瓶 VFX | `src/combat_system.js` | contract-only：`combat_playPotionBottleVFX()`、`combat_playPotionShatterVFX()` 已读取 `vfxProfile.shatterStyle`，只证明表现层合同，不证明玩法完成 |
| 法阵/嵌套合法性 | `src/potion_nesting.js` | `validatePotionNode()` / `validatePotionNesting()` / `validatePotionSpellTree()` 统一覆盖 parent form、parent slot、child form、child spellType、child nesting mode |
| 法阵 VFX 与运行时 | `src/combat_system.js` | contract-only：`combat_playSpellFormVFX()` 保留形态表现分支；done：`combat_spawnPotionOrbCarrier()` 与 `combat_spawnPotionTower()` 提供 Root Orb carrier 和 Tower active/death 基础运行时 |
| 静态/运行时测试 | `tests/validate_potion_vfx_contract.mjs`、`tests/validate_spell_vfx_design.mjs`、`tests/validate_potion_nesting.mjs`、`tests/validate_potion_spell_tree_combat.mjs`、`tests/validate_rune_spell_forms.mjs` | contract-only：静态药剂 VFX 字段、通用法阵 VFX 分支；done：共享嵌套合法性、Root Orb 无子节点飞行与 Tower active/death 生命周期 |

## 3. done / contract-only 边界

| 状态 | 模块 | 口径 |
|---|---|---|
| done | 药剂解锁 | 贤者药匣获得后显示药剂炼成入口和战斗药剂槽 |
| done | 投料即消耗 | 点击符文后立即从 `runeInventory` 移除，并写入 `_potionAlchemyDraft.consumedRunes` |
| done | 黑箱反馈 | 封装前 UI 只显示“结构稳定/未稳/坍塌”，不显示药剂名、效果、品质或装药量 |
| done | 手动接触封装 | 结构稳定时写入 `preparedPotionSpell`，此时才揭示药剂 |
| done | 失败返还 | 失败或中断时按 `potionAlchemyFailRefundRatio` 返还局内碎片，不返还符文 |
| done | 炼金笔记 | 只记录已成功揭示的药剂 |
| done | 战斗使用 | 药剂不走 SP 成本和技能冷却，释放成功后只扣 `charges` |
| done | Root Orb carrier | 无子节点 root Orb 也生成 `potion_orb_carrier`，到点破裂后释放 root 内容 |
| done | Tower active/death 基础运行时 | `potion_tower` 有 active 周期 pulse、death 销毁释放、互斥槽校验 |
| done | 共享嵌套校验 | `src/potion_nesting.js` 被 UI、封装、战斗和测试共用 |
| contract-only | 静态药剂 metadata | 9 个静态药剂声明 `spellType`、`formId`、`nestingMode`、`vfxProfile`；这只保证字段合同 |
| contract-only | 药瓶与法阵表现层 | VFX helper 和 dispatcher 只负责短生命周期表现，不应用伤害、状态、DOM、存档或装药消耗 |

## 4. 当前差距

| 差距 | 影响 |
|---|---|
| 炼成尚未解析 `RUNEWORD_DB` 为 `spellContent` | 目前“符文组合 = 法术内容”仍停留在规范和符文网格测试，药剂炼成还不能复用词条法术 |
| 多节点嵌套 UI 尚未实现 | 当前工作台只封装 root `spellTree`；共享合法性函数已支持递归校验，但“继续投料 -> 新节点 -> 父子接入”还没有交互层 |
| 完整防御塔系统尚未实现 | done 仅覆盖 active/death 基础运行时；专用资产、复杂阻挡公式、多塔平衡、子法术深度释放仍是 debt |
| 子法术内容解析仍是兼容路径 | 允许 `spellTree.children` 进入战斗内部释放，但炼金台还不会从 `RUNEWORD_DB` 生成真实子节点 |
| `spellContent` 解析仍未接入炼金台 | C1 已加固关闭面板、切 Tab、进入战斗、刷新恢复与旧药剂覆盖边界；下一步应迁移到 `RUNEWORD_DB` 的隐藏法术内容 |
| 正式资产未接入 | 炼金炉、法阵画布、稳定/排斥、坍塌、药瓶液面等仍为 placeholder |

## 5. 规划原则

1. 先稳住“投料即消耗 + 黑箱不泄露”的 P0 契约，再扩法阵和嵌套。
2. 法阵第一版用按钮/分段控件实现，不先做手绘识别，避免把交互风险和规则风险绑在一起。
3. 所有新增合法性必须查表，查不到即不允许，不用“降数值”放行。
4. `spellTree` 进入存档前必须保留旧 `potionId` 兼容路径。
5. 表现层只表现形态和结算时机，不改伤害、状态、DOM、存档或装药消耗。
6. 新增持续特效、粒子、Beam、电弧、防御塔实体时必须执行性能影响评估，并接入 `CONFIG.performance` 预算。

## 5.1 Codex 开发执行方案

药剂线后续按 Codex 小批次推进。每个批次必须能独立阅读、独立验证、独立交接；不把 UI、配置、战斗结算、资产和存档迁移塞进同一次改动。

### 5.1.1 每轮固定上下文

每个 Codex 批次开始前只读必要上下文，避免在大文件里盲翻：

| 类型 | 必读入口 |
|---|---|
| 项目约束 | `AGENTS.md`、`.cursor/rules/global.md` |
| 药剂规则 | `docs/rune_potion_spell_contract.md`、本计划 |
| UI 批次 | `.cursor/rules/ui_system.md`、`.cursor/rules/auto_index/src_ui_rune_launcher_js_index.md`、`src/ui/rune_launcher.js` 目标函数片段 |
| 配置批次 | `.cursor/rules/config.md`、`src/config.js` 中 `POTION_SPELL_DB` 与相关配置片段 |
| 符文法术批次 | `.cursor/rules/rune_system.md`、`src/rune_config.js`、`src/rune_system.js` 目标函数片段 |
| 战斗批次 | `src/combat/combat.md`、`.cursor/rules/auto_index/src_combat_system_js_index.md`、`docs/spell_vfx_design.md` |
| 性能相关 | `.cursor/rules/performance.md`、`docs/spell_vfx_design.md` 第 7 节 |

若批次涉及已索引大文件中的函数修改，先看对应 `.cursor/rules/auto_index/*_index.md`，用函数名定位，不全文件重写。

### 5.1.2 每轮固定交付

| 交付项 | 要求 |
|---|---|
| 代码 | 只改当前批次声明文件；超过 200 行的改动优先拆 helper 或分批 |
| 文档 | 若改了规则、字段、状态或战斗契约，同步更新对应文档 |
| 测试 | 至少跑本批次静态测试；新增规则必须新增或扩展静态验证 |
| 索引 | 修改已索引大文件函数后，按 AGENTS 规则更新对应 auto index |
| 总结 | 说明改了什么、验证了什么、没做什么、是否启动服务 |

除非明确需要浏览器实机验证，不启动 dev server。若必须启动，默认检查并复用 `http://localhost:3002`，验证后关闭自己启动的进程。

### 5.1.3 Codex 批次拆分

| Codex 批次 | 状态 | 目标 | 主要文件 | 验收/边界 |
|---|---|---|---|---|
| C0 文档/测试基线 | done | 保持计划、规则、测试入口一致 | `docs/*`、`tests/README.md` | 相关静态测试全绿 |
| C1 中断与覆盖边界 | done | 加固投料即消耗、关闭/切 Tab/进入战斗的确认与恢复 | `src/ui/rune_launcher.js`、`src/game_system.js`、`src/game_phase.js` | 关闭炼金台、切 Tab、进入战斗、刷新恢复与旧药剂覆盖均明确不返符文/不返旧装药 |
| C2 法阵选择第一版 | done | 加入 `formId`、`nestingMode`、`slotType` 草稿字段与形态按钮 | `src/ui/rune_launcher.js`、`index.html` | 工作台按钮选择 bottle/orb/beam/meteor/tower active/tower death |
| C3 法阵合法性表 | done | 建立 parent/slot/child/form/type/mode 共享校验，并让 UI 只显示稳定/排斥 | `src/potion_nesting.js`、`src/ui/rune_launcher.js`、测试 | UI、封装、战斗、夹具走同一套函数 |
| C4 `spellContent` 解析 | debt | 从 `RUNEWORD_DB` 解析隐藏法术内容，保留静态药剂兼容 | `src/rune_system.js` 或 helper、`src/rune_config.js`、测试 | 至少一批词条能成为隐藏法术节点 |
| C5 `spellTree` root 存档 | done | 让封装结果保存 root 草稿树，同时兼容旧 `potionId` | `src/ui/rune_launcher.js`、现有 `game_system.js` 保存字段 | `preparedPotionSpell` 保留 `potionId` 并新增 root `spellTree`；多节点 UI 仍是 debt |
| C6 多节点嵌套 UI | debt | 支持继续投料、父子查表、非法整炉坍塌 | `src/ui/rune_launcher.js`、合法性 helper、测试 | 合法嵌套接入；非法嵌套不返符文 |
| C7 战斗 `spellTree` 基础释放 | done | `combat_applyPotionSpellTree()` 读取形态与内容结算 | `src/combat_system.js`、`src/game_phase.js`、`src/combat/combat.md`、测试 | Root Orb carrier 到点破裂；Tower active/death 有基础运行时；完整 Tower 系统仍是 debt |
| C8 资产与体验 polish | placeholder / debt | 接入炼金炉、法阵、药瓶槽等复用资产 | 资产、CSS、必要 UI helper | 视觉读感提升且不改机制 |

### 5.1.4 批次边界

| 禁止合并 | 原因 |
|---|---|
| C1 与 C2 | 中断保护是成本边界，法阵 UI 是新交互，风险不同 |
| C2 与 C4 | 法阵形态与符文法术解析可独立验证 |
| C4 与 C7 | `spellContent` 是数据层，战斗结算是高风险行为层 |
| C6 与 C8 | 嵌套规则先稳定，再接资产表现 |

资产生成、PixiJS、手绘法阵识别、防御塔实体长期行为都不进入 C1-C4。它们只能在基础规则稳定后独立开批次。

## 6. P0：黑箱炼成闭环加固

目标：

```text
投料不可撤回。
封装前不泄露具体药剂。
所有离开炼成的入口都能处理已消耗符文。
旧药剂覆盖风险清楚可见。
```

任务：

| 任务 | 文件 | 验收 |
|---|---|---|
| 中断入口复核 | `src/ui/rune_launcher.js`、`src/ui_system.js` | 关闭炼金台、切出药剂 Tab、进入战斗、关闭浏览器恢复时，有已投料则提示不返还或恢复草稿 |
| 覆盖旧药剂强化 | `src/ui/rune_launcher.js` | 已有药剂且有装药时，封装按钮、确认文案、当前药剂条都说明旧药剂弃置且不返还 |
| 失败状态统一 | `src/ui/rune_launcher.js` | `empty` / `feeding` / `spell_ready` / `form_ready` / `failed` 文案和按钮状态一一对应 |
| 草稿存档校验 | `src/game_system.js`、`tests/validate_phase_contracts.mjs` | 投料后刷新不返符文，草稿状态能恢复或进入中断失败处理 |
| 记录页优化 | `src/ui/rune_launcher.js` | 炼金笔记只展示已揭示药剂，未发现项不泄露配方答案 |

推荐测试：

```bash
node tests/validate_phase_contracts.mjs
node tests/validate_potion_vfx_contract.mjs
node tests/validate_potion_nesting.mjs
node tests/validate_potion_spell_tree_combat.mjs
```

## 7. P1：法阵选择第一版

目标：

```text
玩家先投入符文形成隐藏法术，再选择法阵形态。
法阵只反馈稳定/排斥，不显示最终药剂。
第一版用法阵按钮代替真实绘制。
```

第一版法阵：

| 法阵 | `formId` | `nestingMode` | P1 行为 |
|---|---|---|---|
| 药瓶法阵 | `bottle` | `shatter` | 碎裂释放，兼容当前 9 个静态药剂 |
| Orb 法阵 | `orb` | `rupture` | 移动核心破裂释放 |
| Beam 法阵 | `beam` | `conduct` | 命中传导状态/延迟 |
| 坠击法阵 | `meteor` | `impact` | 指定目标，飞行/落点结算 |
| 防御塔法阵 | `tower` | `tower_slot` | `active` 或 `death` 二选一 |

任务：

| 任务 | 文件 | 验收 |
|---|---|---|
| 法阵选择区 UI | `src/ui/rune_launcher.js`、`index.html`、样式文件 | 炉心区域出现 5 个形态选项，未选择时不能封装 |
| 草稿字段扩展 | `src/ui/rune_launcher.js`、`src/game_system.js` | `_potionAlchemyDraft` 记录 `formId`、`nestingMode`、`slotType` |
| 法阵合法性表 | 新增小型 helper 或配置表 | `spellType x formId` 可返回 `stable` / `extendable` / `rejected` |
| Tower 互斥槽 | `src/ui/rune_launcher.js` | Tower 只能选 `active` 或 `death`，不能双槽 |
| 静态验证 | `tests/validate_potion_vfx_contract.mjs` 或新增测试 | 所有可选 `formId` 均能被 VFX dispatcher 识别 |

## 8. P2：符文法术类型化

目标：

```text
从元素宽松配方迁移到 RUNEWORD_DB spellContent。
当前静态药剂保留为兼容 fallback。
```

任务：

| 任务 | 文件 | 验收 |
|---|---|---|
| 建立 `spellContent` 解析 | `src/rune_system.js` 或独立 helper | 一组投入符文可解析为隐藏 `spellContentId` 和 `spellType` |
| 对齐 26 个 `RUNEWORD_DB` | `src/rune_config.js`、`.cursor/rules/runeword_index.md` | 每个词条有药剂收口分类：爆发、状态、延迟、构筑、折叠、禁用 |
| 替换 `_ui_resolvePotionRecipe()` | `src/ui/rune_launcher.js` | UI 不再按元素粗暴映射药剂，而是读取隐藏法术节点 |
| 保留静态药剂兼容 | `src/config.js`、`src/combat_system.js` | 老 `preparedPotionSpell.potionId` 存档仍可释放 |
| 禁用项闸门 | 测试文件 | 纯扣血、普通弹体、链式反应、吸取/链接不可进入子节点 |

## 9. P3：`spellTree` 与复合法术嵌套

目标：

```text
稳定结构可以继续投料。
新节点必须自身合法，父子嵌套必须查表合法。
查不到即整炉坍塌。
```

任务：

| 任务 | 文件 | 验收 |
|---|---|---|
| 草稿树结构 | `src/ui/rune_launcher.js`、`src/game_system.js` | `_potionAlchemyDraft.root.children[]` 可持久化 |
| 父子嵌套表 | 新增配置/helper | `parentForm x childSpellType` 命中白名单才允许接入 |
| 嵌套 UI | `src/ui/rune_launcher.js` | 显示未知稳定节点树，不泄露具体法术名 |
| 失败坍塌 | `src/ui/rune_launcher.js` | 嵌套失败后整炉失败，已投入符文不返还，只按失败规则给补偿 |
| 封装结果 | `preparedPotionSpell` | 成功封装保存 `spellTree`，同时保留 `potionId` 兼容字段 |

第一版嵌套白名单继续沿用 `docs/rune_potion_spell_contract.md` 第 5 节，不在代码里另开口径。

## 10. P4：战斗释放升级

目标：

```text
战斗层读取 spellTree。
法阵形态决定释放过程和结算时机。
法术内容决定伤害/状态/构筑内容。
```

任务：

| 任务 | 文件 | 验收 |
|---|---|---|
| `spellTree` dispatcher | `src/combat_system.js` | 新增 `combat_applyPotionSpellTree()`，旧 `combat_applyPotionSpell()` 作为兼容入口 |
| 形态结算接口 | `src/combat_system.js` | `bottle`、`orb`、`beam`、`meteor`、`tower` 至少有独立结算时机 |
| 防御塔实体方案 | `src/entities.js` 或小模块 | 防御塔承伤复用护盾/撞击逻辑，active/death 互斥触发 |
| 扫射激光 | `src/combat_system.js` | 只允许状态/延迟，不生成 Orb 或隐藏扣血 |
| 存档兼容 | `src/game_system.js` | 老 `potionId` 和新 `spellTree` 均能恢复 |

## 11. P5：美术资产与体验 polish

资产优先做复用组件，不为每种药剂单独画完整大图。

| 优先级 | 资产 | 用途 |
|---|---|---|
| P0 | 炼金炉底座、法阵画布底纹、符文入炉残影 | 投料即消耗和主页面仪式感 |
| P0 | 法阵稳定线、法阵排斥裂纹、失败坍塌黑烟 | 合法/非法反馈 |
| P0 | 药瓶基础壳、药液液面遮罩、空药匣图标 | 战斗药剂槽 |
| P1 | 未知稳定核心、子核连接线 | 嵌套黑箱结构 |
| P1 | 手动接触烙印、封装结果品质边框 | 封装仪式与结果揭示 |
| P2 | 炼金笔记贴纸、封蜡/标签变体 | 长期记录页 |

涉及新位图生成或替换时，必须同时读取：

- `design_spec_bitmap.md`
- `docs/art_asset_generation_guidelines.md`
- `docs/ui_asset_requirements.md`

## 12. 推荐近期 Codex 顺序

| 顺序 | Codex 批次 | 任务 | 理由 |
|---:|---|---|---|
| 1 | C4 | `spellContent` 解析 | 从静态药剂迁移到符文组合法术 |
| 2 | C6 | 多节点嵌套 UI | 单节点与共享校验已稳定，下一步接复合结构 |
| 3 | Tower debt | 完整 Tower 系统 | 在基础 active/death 运行时上补资产、阻挡公式、平衡和深层调度 |
| 4 | C8 | 资产与体验 polish | 规则稳定后再替换 placeholder 表现 |

## 13. 验收闸门

每一阶段完成后至少通过对应静态验证；涉及 UI 或战斗交互时再补浏览器/训练场验证。

| 阶段 | 静态验证 | 交互验证 |
|---|---|---|
| P0 | `node tests/validate_phase_contracts.mjs`、`node tests/validate_potion_vfx_contract.mjs` | 投料、刷新、关闭、覆盖旧药剂、失败返还 |
| P1 | `node tests/validate_potion_nesting.mjs` | 选择法阵、排斥反馈、Tower 二选一、Orb/Beam/纯扣血禁用项 |
| P2 | `node tests/validate_rune_spell_forms.mjs` + 新增 spellContent 测试 | 词条组合法术不提前泄露 |
| P3 | 新增嵌套表测试 | 合法接入、非法坍塌、整炉不返符文 |
| P4 | `node tests/validate_spell_vfx_design.mjs` + `node tests/validate_potion_spell_tree_combat.mjs` | Root Orb 无子节点也会飞、Tower active/death 生命周期、非法树不生成运行时 |

## 14. 当前一句话结论

当前系统不是纸面设定，但也不能把 contract-only 当 done：解锁、投料、C1 中断与覆盖边界、黑箱封装、root `spellTree` 保存、Root Orb carrier、Tower active/death 基础运行时和共享嵌套校验属于 done；静态药剂 metadata、药瓶 VFX 和通用法阵 VFX dispatcher 只属于 contract-only；下一步的关键是补 C4、C6、完整 Tower 系统和正式资产这些 debt。

## 15. 剩余 debt 提示词

以下提示词用于交给后续 Codex 执行。每条默认只做对应 debt，不顺手扩玩法、不改无关资产、不把 placeholder / contract-only 写成 done。

### C4 spellContent 解析

```text
请在 D:\claude\echo-alchemist-v2-1766564886 执行“药剂炼成 C4 spellContent 解析”。

必读：AGENTS.md、.cursor/rules/global.md、docs/rune_potion_spell_contract.md 第 10-12 节、docs/potion_alchemy_development_plan.md、.cursor/rules/rune_system.md、.cursor/rules/runeword_index.md、src/rune_config.js、src/rune_system.js、src/ui/rune_launcher.js 目标函数索引。

目标：把炼金台当前元素宽松匹配迁移为从 RUNEWORD_DB 解析隐藏 spellContentId / spellType 的流程；封装前 UI 仍只显示稳定/排斥，不泄露具体法术；保留旧 potionId 存档兼容。

边界：只做数据解析与炼金台接入；不做多节点嵌套 UI、不改 Tower 行为、不新增法术数量、不做资产。纯扣血、普通弹体、链式反应、吸取/链接不得进入子节点。

验收：新增 spellContent 静态测试；运行 node tests/validate_rune_spell_forms.mjs、node tests/validate_potion_nesting.mjs、node tests/validate_potion_spell_tree_combat.mjs、node tests/validate_scenarios.js；文档状态只能使用 done / contract-only / debt / placeholder。
```

### C6 多节点嵌套 UI

```text
请在 D:\claude\echo-alchemist-v2-1766564886 执行“药剂炼成 C6 多节点嵌套 UI”。

必读：AGENTS.md、.cursor/rules/global.md、docs/rune_potion_spell_contract.md、docs/potion_alchemy_development_plan.md、.cursor/rules/ui_system.md、.cursor/rules/testing.md、src/potion_nesting.js、tests/validate_potion_nesting.mjs。

目标：在单节点草稿基础上支持继续投料 -> 新隐藏法术节点 -> 绘制/选择法阵 -> validatePotionSpellTree 父子查表 -> 合法接入 children；非法时整炉坍塌，本轮符文不返还，只按失败规则补偿。

边界：不新增新的合法性口径；必须复用 src/potion_nesting.js。不要把抽象节点树做成具体法术泄露；不要接正式资产；不要改战斗伤害平衡。

验收：新增正反向嵌套 UI/结构测试，覆盖合法接入、Orb -> Orb、Beam -> Orb、纯伤害、链式反应、active/death 混用；运行 node tests/validate_potion_nesting.mjs、node tests/validate_potion_spell_tree_combat.mjs、node tests/validate_phase_contracts.mjs、node tests/validate_scenarios.js；同步 TODO/REQ/计划状态。
```

### 完整 Tower 系统与资产

```text
请在 D:\claude\echo-alchemist-v2-1766564886 执行“药剂 Tower debt 收口”。

必读：AGENTS.md、.cursor/rules/global.md、.cursor/rules/performance.md、docs/rune_potion_spell_contract.md 第 7 节、docs/potion_alchemy_development_plan.md、src/combat/combat.md、.cursor/rules/auto_index/src_combat_system_js_index.md、docs/art_asset_generation_guidelines.md、docs/ui_asset_requirements.md（若生成/接入资产）。

目标：在已存在的 potion_tower active/death 基础运行时上，补完整阻挡/承伤公式、范围/冷却/目标选择参数、专用视觉资产或明确 fallback、平衡口径和训练/静态验证入口。active 与 death 仍必须互斥，Tower 不得生成 Tower。

边界：不改 spellContent 解析、不做多节点 UI，除非该批次已标记 done 并且显式要求联调。新增高开销视觉必须加 // @perf-impact 并接入 CONFIG.performance 预算。

验收：扩展 tests/validate_potion_spell_tree_combat.mjs 或新增 Tower 专项测试，覆盖 active pulse、death release、阻挡/承伤、互斥槽、非法树不生成运行时；运行 node tests/validate_potion_spell_tree_combat.mjs、node tests/validate_potion_nesting.mjs、node tests/validate_scenarios.js；更新 combat.md、合同、计划与 TODO 状态。
```

### C8 炼金资产与体验 polish

```text
请在 D:\claude\echo-alchemist-v2-1766564886 执行“药剂炼成 C8 资产与体验 polish”。

必读：AGENTS.md、.cursor/rules/global.md、design_spec_bitmap.md、docs/art_asset_generation_guidelines.md、docs/ui_asset_requirements.md、docs/rune_potion_spell_contract.md、docs/potion_alchemy_development_plan.md、.cursor/rules/performance.md。

目标：替换炼金炉、法阵画布、稳定/排斥、坍塌、药瓶液面、空药匣等 placeholder 表现，提升读感但不改变机制。资产必须归类为运行时资产、审稿资料或临时来源文件，并同步 manifest/资产清单。

边界：不改炼成规则、spellContent、嵌套合法性或战斗结算。不能因为接入图像而把 placeholder 标成 done；只有运行时路径、清单和验证都完成才可标 done。

验收：静态检查资产路径、尺寸、透明度/9-slice 要求；运行相关 UI/合同测试与 git diff --check；如启动本地服务，默认 3002，验证后关闭或明确保留方式；更新 TODO、资产需求清单和计划状态。
```
