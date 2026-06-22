# Boss 特色机制重构范围与验收文档

> 状态：执行中。2026-06-22 已落地第一批：Boss 专属敌人元数据、Boss 入场画像驱动转化、Ignis 温压流光护盾闭环；第二批：Tesla 导体网络、场强召唤闭环与 cryo / bounce 反制；第三批：Chimera 胃域吸引、吞噬继承状态与养料循环。
> 目标：在不改动基础回合结构和符文主循环的前提下，为 Boss 与超级精英建立强识别、可反制、可测试的专属机制。
> 非目标：本轮不重写符文系统、不重写战斗阶段状态机、不把战斗阶段逻辑接入钉盘交互。

## 1. 改造原则

- Boss 必须有“机制核心”，不能只是更高数值。
- 每个 Boss 机制必须使用当前游戏已经存在的资源：元素属性、温度、护盾、词缀、召唤、位置、回合结算、Boss 入场转化。
- 每个 Boss 必须有清晰反制入口，反制入口映射到 `bossConfigs.vulnerability` 或动态弱点。
- 所有位移、吸引、召唤必须遵守格子占用规则，敌人不能重叠。
- 视觉必须让玩家在第一眼看出 Boss 当前机制状态，例如流光护盾、导体网络、胃域吸引、六附体轮转。
- 涉及粒子、发光、渐变、混合模式的改动必须接入 `CONFIG.performance` 预算，并带 `@perf-impact` 注释。

## 2. 修改范围

### 2.1 配置与数据

- `src/config.js`
  - 扩展 `CONFIG.balance.bossConfigs` 的 Boss 专属机制参数。
  - 重设 Boss 破绽属性与 `vulnerabilityMode`。
  - 增加超级精英 / Boss 专属词条配置，例如 `radiantAegis`、导体、孢子护甲、附体敌人组合。
  - 扩展 `TRUTH_BOOK_DB`、图鉴描述、训练场场景引用的数据入口。

- `src/wave_presets.js`
  - 为 Boss 入场、Boss 专属敌人、关键机制教学波次补充 preset。

- `src/data/enemy_visual_assets.js`
  - 接入 Boss 专属 overlay、词条图标、附体敌人装饰、流光护盾与孢子护甲视觉键。

### 2.2 运行时机制

- `src/entities/enemy.js`
  - 扩展 Enemy 状态字段、回合 tick、受击结算、状态继承、护盾吸收、视觉绘制。
  - 增加 Boss 专属状态的 save/load 安全字段。
  - 增加超级精英词条的精英半数值版本。

- `src/combat_system.js`
  - 调整 Boss 破绽检测、动态弱点、属性命中后的 Boss 机制反馈。
  - 接入温度超过 100 后的温压结算，不让 Ignis 走烧伤 DoT。
  - 接入闪电伤害触发 Tesla 召唤物 haste / 导体网络收益。

- `src/game_phase.js`
  - 在敌方回合开始或 Boss tick 节点触发 Boss 机制。
  - 确认 Glacies 不接触钉盘阶段逻辑。
  - 接入 Chimera 吸引、吞噬、召唤的回合顺序。
  - 接入 Ouroboros 六附体轮转。

- `src/spawn_system.js`
  - 改造 Boss 入场冲击波转化逻辑，使普通敌人可以变为 Boss 专属敌人。
  - 扩展 Boss 专属词缀池与转化权重。
  - 增加安全落点搜索，避免召唤和吸引导致重叠。

- `src/game_system.js`
  - 持久化 Boss 专属状态：温压、导体网络、胃域储存、孢子护甲、附体轮转状态等。

- `src/systems.js`
  - 更新图鉴、训练场、机制说明与测试场景。

### 2.3 文档与索引

- `.cursor/rules/enemy_index.md`
  - 更新 Boss 机制、破绽属性、专属词缀和出现回合速查。

- `.cursor/rules/entities.md`
  - 更新 Enemy 状态字段、视觉层、性能注意事项。

- `.cursor/rules/spawn_system.md`
  - 更新 Boss 入场转化、专属敌人、非重叠召唤规则。

- `.cursor/rules/performance.md`
  - 登记新增高开销特效预算。

- `.cursor/rules/auto_index/`
  - 修改已索引大文件后，运行 `python scripts/generate_index.py D:\claude\echo-alchemist-v2-1766564886 --file <path>` 更新对应索引。

## 3. 分阶段 Checklist

### 阶段 A：共享基础设施

- [x] 梳理 Boss 机制统一 tick 入口，避免把 Boss 逻辑分散到多个阶段。
- [x] 增加格子安全工具：查询占用、找最近空格、按方向吸引一格、范围内非重叠召唤。
- [x] 增加 Boss 专属敌人标记，例如 `bossOwnerId`、`bossMinionRole`、`bossMechanicTags`。
- [x] 增加 Boss 专属状态序列化白名单。
- [x] 增加机制状态的 HUD / 浮字 / 敌人状态标签显示。
- [x] 为新增特效建立 `high / medium / low` 三档预算。

### 阶段 B：Boss 入场转化

- [x] 保留现有 Boss 入场冲击波节奏。
- [x] 将部分普通敌人转化为 Boss 专属敌人，而不是只随机加普通词缀。
- [x] 每个 Boss 有独立转化池和转化文案。
- [x] 转化后的敌人继承位置和基本血量倍率，但获得 Boss 专属机制标签。
- [x] 转化逻辑在敌人数量不足、边界位置、非 1x1 敌人附近时不报错。

### 阶段 C：Ignis 机制

- [x] Ignis 不触发烧伤 DoT。
- [x] 对 Ignis 造成的正温度超过 100 后，溢出部分进入 `furnacePressure`。
- [x] `furnacePressure` 达阈值时，直接触发一次流光彩护盾。
- [x] 流光彩护盾沿用超级精英词条逻辑：护盾未破时每回合增长，达到上限后再次获得护盾会给周围一格敌人加护盾。
- [x] 冰冻 / cryo 命中可泄压，降低温压或延后护盾脉冲。
- [x] 视觉显示温压槽和流光护盾状态。

### 阶段 D：Glacies 机制

- [x] 重新设计为战斗场内机制，不接入钉盘阶段。
- [x] 建立“霜缝”机制：连接 `frostStitch` 或周围敌人，复制护盾并提供短暂回血 / 承伤关系。
- [x] pierce 能切断连接并穿透霜缝收益，本次命中获得额外伤害。
- [x] cryo 命中会切断霜缝，并冻结 Glacies 下一次机制 tick。
- [x] 机制影响场上敌人的承伤关系：非 cryo / pierce 命中被缝敌人会被霜缝减伤。
- [x] 视觉显示连接线、冰蓝缝线、`缝N` 状态短标签和被缝合敌人的标记。

### 阶段 E：Tesla 机制

- [x] Tesla 每回合电击随机敌人，造成 1 点伤害并给予 haste。
- [x] Tesla 召唤的专属敌人受到 lightning 伤害时获得 haste。
- [x] 场上 Tesla 专属敌人越多，Tesla 的 `fieldPower` 越高。
- [x] `fieldPower` 提升 Tesla 的召唤能力、护盾或行动频率，但必须有上限和衰减。
- [x] haste 的召唤物能反过来增强 Tesla，例如提供充能、额外召唤额度或电弧分叉。
- [x] bounce 命中可接地，降低导体网络收益。
- [x] cryo 命中可移除 haste 或冻结 `fieldPower`。
- [x] 视觉显示导体网络、电弧链路、Tesla 本体充能层数。

### 阶段 F：Chimera 机制

- [x] Chimera 每个机制 tick 吸引身边 +2 格范围内敌人一格。
- [x] 吸引必须把敌人移动到合法空格，不能重叠。
- [x] Chimera 可吞噬身边 +2 格范围内所有敌人。
- [x] 吞噬后继承目标所有负面状态。
- [x] 吞噬后继承目标温度，温度采用相加。
- [x] Chimera 同时召唤可被吸引和吞噬的专属敌人。
- [x] 召唤物与吸引必须形成“养料循环”，但不能无限爆场。
- [x] 视觉显示胃域范围、吸引方向、吞噬继承的状态堆叠。

### 阶段 G：孢子 / 活体护甲 Boss

- [x] 决定该机制是重做 Viridis，还是新增独立 Boss。
- [x] 孢子护甲以场上敌人、孢子层数或被治疗次数为资源。
- [x] 护甲未破时吸收伤害或复制治疗。
- [x] 护甲破裂时释放孢子敌人、毒雾或负面状态。
- [x] venom 应成为核心反制或风险属性。
- [x] pyro 可烧掉孢子护甲或触发爆燃清场。
- [x] 视觉显示活体护甲、孢子层、破裂喷发。

### 阶段 H：Ouroboros 机制

- [x] Ouroboros 身上附着六个附体敌人。
- [x] 六个附体敌人每回合转动并更换位置。
- [x] 每个附体敌人拥有互相搭配的词条组合。
- [x] 附体组合至少覆盖护盾、治疗、召唤、位移、吞噬、加速六类压力。
- [x] 附体位置影响当前 Boss 弱点或当前回合主机制。
- [x] 玩家可通过命中正确属性打断当前附体。
- [x] 附体死亡或被打断后会改变轮转节奏，而不是只扣血。
- [x] 视觉显示六环轨道、当前前位附体、下一轮即将生效的附体。

### 阶段 I：破绽属性重设

- [x] Ignis：保留 pyro + pierce，但 pyro 表示点燃炉心压力，不表示烧伤。
- [x] Glacies：cryo + pierce，用于冻结 / 切断霜缝。
- [x] Mikro：lightning + scatter，用于过载克隆 / 清理复制体。
- [x] Devourer：bounce + laser，用于胃袋反弹 / 精准灼穿。
- [x] Viridis 或孢子 Boss：pyro + venom，用于烧孢子 / 以毒攻毒。
- [x] Tesla：cryo + bounce，用于冻结导体 / 接地。
- [x] Chimera：venom + laser，用于污染胃域 / 精准剖解。
- [x] Ouroboros：动态六组破绽，随附体轮转改变。

## 4. 验收标准

### 4.1 通用验收

- [ ] 所有 Boss 至少有一个可观察的机制资源条或状态标记。
- [ ] 所有 Boss 的反制属性在实战中有明确反馈，不只是额外伤害。
- [ ] 所有召唤、吸引、位移都不产生敌人重叠。
- [x] Boss 入场转化出的专属敌人能参与对应 Boss 机制：Mikro 的 `fissionLink` / `fission_cell` 计入母体分裂减伤，Devourer 的 `mawFeed` / `maw_thrall` 会被吞噬优先选中；Tesla / Glacies / Viridis / Chimera / Ouroboros 已由对应运行期测试覆盖机制 tick 或专属随从链路。
- [x] 保存并读取后，Boss 机制状态不丢失、不重复触发：`validate_phase_contracts.mjs` 锁定 Boss 随从元数据、温压、孢甲资源、Tesla 场强、霜缝、Chimera 冷却与破绽状态的 save/load 成对恢复。
- [ ] 低性能档下仍能识别机制状态，且不会生成过量粒子。
- [ ] 新增视觉效果在 `high / medium / low` 三档都有预算说明。
- [ ] 不在战斗逻辑模块直接操作 DOM。
- [x] 修改已索引大文件后，自动函数索引已更新。
- [ ] 图鉴、训练场、敌人索引与代码行为一致。

### 4.2 Boss 级验收

- [x] Ignis：温度超过 100 会进入温压结算；温压满时触发流光彩护盾；不会产生烧伤 DoT。
- [x] Glacies：机制完全发生在战斗场；不会修改钉盘；霜缝可被 pierce / cryo 反制。
- [x] Tesla：召唤物越多，本体越强；本体越强又能制造更多召唤压力；该循环有上限、衰减和反制。
- [x] Chimera：能吸引 +2 格范围敌人一格并避免重叠；能吞噬 +2 格范围敌人；继承负面状态和温度相加。
- [x] 孢子 / 活体护甲 Boss：护甲、孢子、破裂、反制四个环节都可观察。
- [x] Ouroboros：六附体每回合轮转；附体词条组合能互相配合；动态弱点随轮转变化。

### 4.3 测试验收

- [x] `node --check src/config.js`
- [x] `node --check src/entities/enemy.js`
- [x] `node --check src/combat_system.js`
- [x] `node --check src/game_phase.js`
- [x] `node --check src/game_system.js`
- [x] `node --check src/systems.js`
- [x] `node --check src/spawn_system.js`
- [x] `node tests/validate_enemy_spawn_runtime.mjs`
- [x] `node tests/validate_scenarios.js`
- [x] `node tests/validate_wave_presets.mjs`
- [x] `node tests/validate_boss_vulnerability.mjs`
- [x] 新增或扩展 Boss 机制专项测试，例如 `tests/validate_boss_mechanics.mjs`。
- [x] 浏览器烟测：`http://localhost:5173/` 可加载，主 Canvas 正常渲染；控制台仅有既有 Tailwind CDN 与缺失 enemy sprite JSON fallback 警告。

## 5. 推荐实现顺序

1. 共享基础设施：格子安全移动、Boss 专属敌人标记、机制 tick、状态持久化。
2. Boss 入场转化：先把“Boss 出现时转换一批敌人为 Boss 专属敌人”的基础链路做稳。
3. Ignis：基于已存在的温度和流光彩护盾，是最适合先落地的机制闭环。
4. Tesla：围绕导体网络建立“召唤越多，本体越强，本体越能召唤”的正反馈循环。
5. Chimera：实现吸引、吞噬、继承状态和温度相加，重点验证非重叠位移。
6. Glacies：在战斗场内重做霜缝机制，避免误接钉盘阶段。
7. 孢子 / 活体护甲 Boss：已重做为 Viridis 孢子活甲网络。
8. Ouroboros：最后实现六附体轮转，因为它依赖词条组合、动态弱点、视觉层和存档字段。

## 6. 风险清单

- Chimera 的范围吸引和范围吞噬最容易造成格子重叠，需要先做安全移动工具。
- Tesla 正反馈循环容易滚雪球，需要硬上限、回合衰减和 cryo / bounce 反制。
- Ouroboros 六附体状态复杂，必须先设计存档结构再写视觉。
- Ignis 的温度结算要避免影响普通敌人的烧伤路径，只对 Ignis 或带对应 Boss 机制的单位生效。
- Boss 入场转化会影响波次压力，需要和 director preset、敌人数量上限、性能预算一起验证。
- 新增发光护盾、导体电弧、六环轨道会影响移动端性能，必须按性能规范接入三档预算。

## 7. 完成定义

本轮 Boss 机制重构完成时，应满足：

- 8 个 Boss 不再是纯数值怪，每个都有专属机制和反制属性。
- 至少 1 个超级精英词条可复用于 Boss 和精英半数值版本。
- Boss 入场会把一批敌人转化为 Boss 专属敌人，并能服务 Boss 机制。
- 图鉴、训练场、视觉资产、测试脚本和核心规则文档同步更新。
- 全部验收命令通过，浏览器烟测无新增控制台错误；既有资源 fallback / CDN warning 需在总结中如实列明。


## 8. 2026-06-22 Phase G: Viridis 孢子活甲网络

本阶段把 Viridis 从单纯高数值治疗 Boss 改成“孢子侍体 + 活体护甲 + 火毒反制”的机制 Boss。

影响范围：
- `src/config.js`：Viridis 获得 `regen + healer + livingArmor + armorSpore`，破绽谱改为 `pyro + venom`，新增 `sporeBloom*` / `sporeArmor*` 参数；Boss 入场专属敌人改为 `spore_vassal`，携带 `armorSpore` 与 `sporeArmor` 标签。
- `src/entities/enemy.js`：新增 `viridisSporeBloom` 资源、孢甲 tick、治疗供能、非反制破甲反哺、火毒蚀甲和 `孢N` / `腐N` 状态短标签。
- `src/combat_system.js`：Viridis 狂暴后仍放弃治疗他人，但额外启动孢甲强化循环。
- `src/game_system.js`：持久化 Viridis 孢甲资源与腐蚀回合。
- `src/systems.js`：新增 `boss_viridis` 试炼场入口，便于验收孢甲循环和火毒反制。
- `tests/validate_enemy_spawn_runtime.mjs`：覆盖入场转化、孢甲补盾、火毒反制与非反制破甲反哺。

验收清单：
- [x] Viridis 不再只是数值型 `regen + healer` Boss。
- [x] Boss 入场可以转化 `spore_vassal` 专属敌人并写入机制标签。
- [x] 孢子侍体与治疗会推动 Viridis 孢甲资源循环。
- [x] 孢甲资源达到阈值后会为目标补 `livingArmor`。
- [x] `venom` 命中会蚀甲、补毒层并削减 `sporeBloom`。
- [x] `pyro` 命中会高比例蚀甲并削减 `sporeBloom`。
- [x] 孢甲视觉接入性能降级：low 档关闭发光和混合，仅保留语义描边。
- [x] 浏览器试炼场实机打开 `boss_viridis`，确认无新增控制台错误、孢甲环/状态短标签可读。

## 9. 2026-06-23 Phase H: Ouroboros 六附体轮转

本阶段把 Ouroboros 从三组词缀轮转升级为六个附体槽位围绕本体旋转的终局 Boss。

影响范围：
- `src/config.js`：`bossConfigs.ouroboros` 新增 6 个 `orbitAttachments`，动态破绽谱扩展到六组，并配置轨道回声上限、封印回合、护盾与治疗参数。
- `src/entities/enemy.js`：新增六附体状态、每回合转位、附体主机制、轨道回声召唤、破绽封印与六节点视觉。
- `src/combat_system.js`：Boss 破绽满格时调用 `_interruptOuroborosAttachment()`，让打断影响轮转节奏。
- `src/game_system.js`：持久化六附体槽状态、打断次数与初始化标记。
- `src/systems.js`：更新 `boss_ouroboros` 试炼场描述。
- `tests/validate_enemy_spawn_runtime.mjs`：覆盖六槽配置、逐回合轮转、轨道回声召唤和破绽封印。

验收清单：
- [x] 六个附体槽均有词缀组合、破绽属性、主机制和视觉颜色。
- [x] 每回合前位附体改变 Boss 当前词缀与当前破绽谱。
- [x] 附体组合覆盖护盾、治疗、召唤、位移、吞噬、加速六类压力。
- [x] 打满当前破绽会封印当前附体，轮转跳到下一个可用槽。
- [x] 裂群附体召唤 `orbit_echo`，并使用非重叠格子检查。
- [x] 存档保存并恢复 `ouroborosOrbitStates`、打断次数与轮转索引。
- [x] 视觉显示六节点轨道、当前前位、下一位和封印槽。
- [x] 浏览器试炼场实机打开 `boss_ouroboros`，确认六节点轨道与封印反馈无新增控制台错误。
