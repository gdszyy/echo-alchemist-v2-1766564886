# 药剂炼成开发计划

> 状态：2026-06-27 文档整理与规划版。
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
| 炼成 UI | `src/ui/rune_launcher.js` | 已有药剂 Tab、投料即消耗、黑箱状态反馈、手动接触封装、失败返还、炼金笔记 |
| 当前配方解析 | `src/ui/rune_launcher.js -> _ui_resolvePotionRecipe()` | 仍是元素宽松匹配，2-4 个符文直接映射到 9 个静态 `potionId`，尚未解析 `RUNEWORD_DB` 的 `spellContent` |
| 战斗槽 UI | `src/systems.js -> UIManager.updateSkillBar()` | 贤者药匣解锁后显示药剂槽；药剂不消耗 SP，只显示 `charges/maxCharges` |
| 战斗释放 | `src/combat_system.js` | `combat_activatePotionSpell()` 校验阶段与装药量；`combat_applyPotionSpell()` 按静态药剂 ID 结算，成功后扣 1 装药 |
| 药瓶 VFX | `src/combat_system.js` | `combat_playPotionBottleVFX()`、`combat_playPotionShatterVFX()` 已接入 `vfxProfile.shatterStyle` |
| 法阵 VFX | `src/combat_system.js` | `combat_playSpellFormVFX()` 已有 `orb`、`mine`、`beam`、`orbit`、`slash`、`meteor`、`sweeping_laser`、`tower` 首版表现分支，但炼金台尚未产出这些形态 |
| 静态测试 | `tests/validate_potion_vfx_contract.mjs`、`tests/validate_spell_vfx_design.mjs`、`tests/validate_rune_spell_forms.mjs` | 已覆盖静态药剂 VFX 字段、通用法阵 VFX 分支和符文 3x3 中心轴公式 |

## 3. 当前已完成

| 模块 | 完成口径 |
|---|---|
| 药剂解锁 | 贤者药匣获得后显示药剂炼成入口和战斗药剂槽 |
| 投料即消耗 | 点击符文后立即从 `runeInventory` 移除，并写入 `_potionAlchemyDraft.consumedRunes` |
| 黑箱反馈 | 封装前 UI 只显示“结构稳定/未稳/坍塌”，不显示药剂名、效果、品质或装药量 |
| 手动接触封装 | 结构稳定时写入 `preparedPotionSpell`，此时才揭示药剂 |
| 失败返还 | 失败或中断时按 `potionAlchemyFailRefundRatio` 返还局内碎片，不返还符文 |
| 炼金笔记 | 只记录已成功揭示的药剂 |
| 战斗使用 | 药剂不走 SP 成本和技能冷却，释放成功后只扣 `charges` |
| 药瓶表现层 | 9 个静态药剂都有 `spellType`、`formId: 'bottle'`、`nestingMode: 'shatter'`、`vfxProfile` |
| 通用形态表现层 | 非药瓶形态已有短生命周期 VFX helper，且带 `@perf-impact` 标记 |

## 4. 当前差距

| 差距 | 影响 |
|---|---|
| 炼成尚未解析 `RUNEWORD_DB` 为 `spellContent` | 目前“符文组合 = 法术内容”仍停留在规范和符文网格测试，药剂炼成还不能复用词条法术 |
| 没有法阵选择/绘制 UI | `POTION_SPELL_DB` 虽有 `formId` 字段，但玩家不能选择形态，所有实战药剂仍是药瓶 |
| 没有 `spellType x formId` 合法性表 | 不合法法阵、Tower active/death、Beam 禁用项等规则还没有代码闸门 |
| `preparedPotionSpell` 只保存 `potionId` | 还不是 `spellTree`，无法表达父子嵌套、隐藏节点或法阵形态 |
| `combat_applyPotionSpell()` 仍按静态药剂 ID 分支 | 不能按 `spellTree` 分发，也不能让不同 `formId` 改变结算 |
| 复合法术嵌套未实现 | “继续投料 -> 新节点 -> 父子查表 -> 合法接入/非法坍塌”尚未落地 |
| 中断保护需要全入口复核 | `ui_clearPotionSelection()` 已有确认逻辑，但仍需确认关闭面板、切 Tab、进入战斗、刷新恢复等入口全部接入 |
| 正式资产未接入 | 炼金炉、法阵画布、稳定/排斥、坍塌、药瓶液面等仍以 CSS/占位表现为主 |

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

| Codex 批次 | 目标 | 主要文件 | 验收 |
|---|---|---|---|
| C0 文档/测试基线 | 保持计划、规则、测试入口一致 | `docs/*`、`tests/README.md` | 相关静态测试全绿 |
| C1 中断与覆盖边界 | 加固投料即消耗、关闭/切 Tab/进入战斗的确认与恢复 | `src/ui/rune_launcher.js`、必要时 `src/ui_system.js` | 投料后不能免费撤回；中断有确认/返还；旧药剂覆盖清楚 |
| C2 法阵选择 MVP | 加入 `formId`、`nestingMode`、`slotType` 草稿字段与 5 个形态按钮 | `src/ui/rune_launcher.js`、`index.html`、样式文件 | 未选法阵不能封装；Tower active/death 二选一 |
| C3 法阵合法性表 | 建立 `spellType x formId` 校验，并让 UI 只显示稳定/排斥 | 小型 helper、`src/ui/rune_launcher.js`、测试 | 禁用组合不能封装；不泄露最终药剂 |
| C4 `spellContent` 解析 | 从 `RUNEWORD_DB` 解析隐藏法术内容，保留静态药剂兼容 | `src/rune_system.js` 或 helper、`src/rune_config.js`、测试 | 至少一批词条能成为隐藏法术节点 |
| C5 `spellTree` 存档 | 让封装结果保存草稿树，同时兼容旧 `potionId` | `src/game_system.js`、`src/ui/rune_launcher.js`、测试 | 新旧存档均可恢复和释放 |
| C6 嵌套 MVP | 支持继续投料、父子查表、非法整炉坍塌 | `src/ui/rune_launcher.js`、合法性 helper、测试 | 合法嵌套接入；非法嵌套不返符文 |
| C7 战斗 `spellTree` 释放 | `combat_applyPotionSpellTree()` 读取形态与内容结算 | `src/combat_system.js`、`src/combat/combat.md`、测试 | 不同 `formId` 有不同结算时机；无目标/无弹药不扣装药 |
| C8 资产与体验 polish | 接入炼金炉、法阵、药瓶槽等复用资产 | 资产、CSS、必要 UI helper | 视觉读感提升且不改机制 |

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
```

## 7. P1：法阵选择 MVP

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
| 1 | C1 | 中断与覆盖边界 | 投料即消耗是高风险规则，先封边界 |
| 2 | C2 | 法阵选择 MVP | 让炼成进入“符文法术 + 法阵形态”的真实结构 |
| 3 | C3 | 法阵合法性表 | 后续 `spellTree` 和战斗释放都依赖这些字段 |
| 4 | C4 | `spellContent` 解析 | 从静态药剂迁移到符文组合法术 |
| 5 | C5 | `spellTree` 存档 | 先让新结果可持久化，再引入嵌套风险 |
| 6 | C6 | 嵌套 MVP | 单节点稳定后再引入高风险复合结构 |
| 7 | C7 | 战斗 `spellTree` 释放 | 让法阵真正改变实战形态 |

## 13. 验收闸门

每一阶段完成后至少通过对应静态验证；涉及 UI 或战斗交互时再补浏览器/训练场验证。

| 阶段 | 静态验证 | 交互验证 |
|---|---|---|
| P0 | `node tests/validate_phase_contracts.mjs`、`node tests/validate_potion_vfx_contract.mjs` | 投料、刷新、关闭、覆盖旧药剂、失败返还 |
| P1 | 新增法阵字段/合法性测试 | 选择法阵、排斥反馈、Tower 二选一 |
| P2 | `node tests/validate_rune_spell_forms.mjs` + 新增 spellContent 测试 | 词条组合法术不提前泄露 |
| P3 | 新增嵌套表测试 | 合法接入、非法坍塌、整炉不返符文 |
| P4 | `node tests/validate_spell_vfx_design.mjs` + 战斗释放测试 | 各形态释放读感、无目标/无弹药不扣装药 |

## 14. 当前一句话结论

当前系统已经不是纸面设定：解锁、投料、黑箱封装、静态药剂释放、药瓶 VFX、通用法阵 VFX 都有了首版代码。下一步的关键不是继续加药剂数量，而是把“静态 `potionId`”升级成“隐藏 `spellContent` + 法阵 `formId` + 可持久化 `spellTree`”，并用查表规则守住嵌套边界。
