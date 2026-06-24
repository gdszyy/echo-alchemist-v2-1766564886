# 音乐系统交接提示词 v0.1

> 日期：2026-06-24
> 用途：交给后续 Agent 继续推进音乐系统文档、demo 或实现时直接复制使用。

## 1. 通用交接提示词

```text
你接手 Echo Alchemist V2 的音乐系统设计迭代。

工作目录：
D:/claude/echo-alchemist-v2-1766564886

必须先读：
1. AGENTS.md
2. docs/architecture/music_processing/INDEX.md
3. docs/architecture/music_processing/dark_alchemy_music_constraints_and_variants_v0.11.md
4. docs/architecture/music_processing/music_system_next_todo_v0.1.md

项目当前状态：
- 音乐处理文档已经把 dark psy / pad-chord / bass spine / chord-shard cloud / intensity ladder / FX transition 的 MIDI 规律沉淀到 v0.11。
- 当前还没有把这些规则接入正式运行时代码。
- 当前 demo 是 docs/architecture/music_processing/dark_alchemy_music_layer_demo.html，可以 file 直开。
- 不要继续把重点放在“再写一首 BGM”。本系统的核心是：BGM 是 groove 床，碰撞是 phrase，连击是编曲，肉鸽成长是加层，transition 是 section 桥接。

本次任务目标：
按照 music_system_next_todo_v0.1.md 中的优先级推进，不要重写已有大文档。新增文档应放在 docs/architecture/music_processing/，并更新 INDEX.md。

硬性边界：
- 遵守 AGENTS.md，使用 apply_patch 编辑文档。
- 不要改运行时代码，除非任务明确要求实现。
- 不要启动 dev server，除非需要验证非 file:// 可运行内容；当前 HTML demo 默认 file 直开。
- 不要把 MIDI 的绝对根音当成全局根音。
- 不要把同 SHA duplicate 当成新证据。
- 不要用随机旋律生成 dark psy lead。

交付要求：
- 给出新增/修改文件路径。
- 每条新增规则或 schema 字段要能追溯到 v0.11 的规则 ID 或 MIDI 章节。
- 如果做 demo 计划，写清楚验收动作和不改运行时代码的边界。
```

## 2. P0-1 Runtime Schema 提示词

```text
请基于 docs/architecture/music_processing/dark_alchemy_music_constraints_and_variants_v0.11.md 和 music_system_next_todo_v0.1.md，新增 music_runtime_schema_v0.1.md。

目标：
把现有音乐规则落成未来可实现的数据结构，不写运行时代码。

必须包含：
- MusicProfile
- IntensityLayer
- HarmonyState
- PhraseBook
- FXTransition
- EventMapping

每个结构需要：
- 字段表
- 字段说明
- 合法值或示例
- 对应来源规则 ID，例如 MUS-CLOCK-01、MUS-CHORD-06、MUS-INTENSITY-01、MUS-FX-03
- 一个普通房间 JSON 示例
- 一个 Boss profile JSON 示例

注意：
- 事件只能驱动 phrase、anchor、density bump、send bump、transition role。
- 高频碰撞必须聚合、限流、量化。
- intensity 0-5 是 layered density ramp，不是 6 首独立 loop。
- transition 是 bridge role，不是持续 lead。

完成后更新 docs/architecture/music_processing/INDEX.md。
```

## 3. P0-2 事件映射提示词

```text
请在音乐处理文档中补齐游戏事件到音乐事件的映射规格，可以并入 music_runtime_schema_v0.1.md 或新建 music_event_mapping_v0.1.md。

必须覆盖事件：
paddleHit, wallHit, brickBreak, armorHit, crystalBreak, poisonBreak, fireBreak, comboUp, multiBall, danger, bossWarning, dropTrigger, roomClear

每个事件要写：
- source event
- music intent
- target lane
- quantize grid
- cooldown beats
- priority
- max stack/polyphony
- 是否触发 FXTransition
- 对应 v0.11 规则 ID

重点：
- 不允许每次碰撞直接生成随机旋律。
- 不允许高频碰撞逐事件全量发声。
- brick/paddle 反馈要保留瞬态空间。

完成后更新 INDEX.md。
```

## 4. P1 Boss / Biome Profile 提示词

```text
请新增 music_boss_biome_profiles_v0.1.md，为 Echo Alchemist V2 设计 3 个 Boss 音乐 profile。

必须先读：
- dark_alchemy_music_constraints_and_variants_v0.11.md :: §3.4 Boss 风味变体
- §3.3 情绪和弦变体
- §3.6 Transition 变体
- §9 Pad / 和弦情绪导演
- §12 Intensity 0-5
- §13 FX / Transition

至少设计：
1. 机械炼金：techno / acid / metallic
2. 毒性腐化：trap / phonk / slime FX
3. 深渊仪式：dark psy / gothic / harmonic minor

每个 profile 要写：
- BPM / root / mode / scale
- lane recipe: low / mid / high / fx
- intensity 0-5 layer plan
- pad/chord shell family
- bass spine 规则
- lead/shard 限制
- transition roles
- pause veil 行为
- 可引用的 MIDI 来源

注意：
- Boss 差异不能只是换 one-shot。
- 不同 profile 的 dense cloud 不能混成全局音池。
- 绝对音高只能作为 profile 内部配置。

完成后更新 INDEX.md。
```

## 5. P1 Transition 模板提示词

```text
请新增 music_transition_templates_v0.1.md，把 v0.11 的 FX / Transition 规则整理成模板库。

必须包含模板：
- 1barPickup
- 2barDrumFill
- 4barRiser
- 8barBuild
- dropTrigger
- roomClearTail
- bossWarningPreRoll

每个模板要写：
- trigger window
- target lanes
- pitch boundary
- density curve
- tail budget
- intensity range
- event mapping
- MIDI 来源

必须引用：
- FXTransition_DrumSectionFillGrid.mid
- FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid
- FXTransition_ElectricBassASharpPickupStutter.mid
- FXTransition_VoiceOohsSectionHandoffArc.mid
- FXTransition_DrumImpactVoiceOohsLongTailCue.mid

注意：
- transition 只连接上一句和下一句，不开新旋律入口。
- long-tail 必须给碰撞反馈留空间。
- ramp/pickup 的音高必须继承当前 profile 或明确 handoff 目标。

完成后更新 INDEX.md。
```

## 6. Demo 迭代提示词

```text
请基于现有 docs/architecture/music_processing/dark_alchemy_music_layer_demo.html 做下一版 demo 迭代计划，优先新增文档 music_layer_demo_iteration_plan_v0.1.md，不要直接改代码，除非用户明确要求实现。

目标：
把 v0.11 规则转换成可听验证目标。

必须规划 4 个验证场景：
1. 普通房间 intensity 0-5 递进
2. pause veil
3. room clear / drop trigger transition
4. boss warning / boss profile swap

每个场景要写：
- 用户操作
- 预期听感
- 激活 lane
- 激活 rules
- 需要修改的 demo 数据或函数
- 验收方法

注意：
- 当前 demo 默认 file:// 直开，不要启动长期 dev server。
- 如果后续需要实现，改动应优先在 demo data 层，不要牵动正式运行时代码。

完成后更新 INDEX.md。
```

