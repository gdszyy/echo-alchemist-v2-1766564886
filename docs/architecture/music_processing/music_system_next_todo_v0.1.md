# 音乐系统下一阶段 TODO v0.1

> 日期：2026-06-24
> 状态：从 `dark_alchemy_music_constraints_and_variants_v0.11.md` 提炼的下一阶段执行清单
> 目标：把 MIDI-derived 音乐语法推进为可制作、可实现、可验证的音乐系统规格。

## 0. 当前结论

现有 v0.11 已经完成“音乐语法层”沉淀：

- 单一拍序时钟、Groove/Phrase 双层、stage/intensity/boss/phrase 分层已经成立。
- Lead、bass spine、pad/chord、chord-shard cloud、intensity ladder、FX/transition 均已有 MIDI 溯源规则。
- 现阶段最缺的不是继续堆素材，而是把规则落成数据结构、事件接口、Boss profile、混音预算和可听验证。

## 1. P0 TODO

### P0-1. 运行时数据结构规格

- [ ] 新建 `music_runtime_schema_v0.1.md`。
- [ ] 定义 `MusicProfile`：`id / bpm / mode / root / scale / laneRecipe / effectRecipe / phraseBookRefs`。
- [ ] 定义 `IntensityLayer`：`drumDensity / bassDensity / cloudDensity / cueHandoff / fxSendDepth`。
- [ ] 定义 `HarmonyState`：`progression / shellFamily / pitchSet / voicingDensity / padGate / fxMotion`。
- [ ] 定义 `PhraseBook`：`eventType / quantizeGrid / motifId / cooldownBeats / priority / maxPolyphony`。
- [ ] 定义 `FXTransition`：`role / triggerWindow / pitchBoundary / tailBudget / sendAutomation`。
- [ ] 给出 1 个普通房间 profile 与 1 个 Boss profile 的 JSON 示例。

验收标准：

- 能从 schema 直接看出 `MUS-CLOCK-*`、`MUS-CHORD-*`、`MUS-INTENSITY-*`、`MUS-FX-*` 如何落数据。
- 不要求写运行时代码，但字段命名必须接近未来 JS 实现。

依据：

- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §1 硬限制`
- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §2 变体决策树`
- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §13 FX / Transition 专项 MIDI 分析摘录`

### P0-2. 游戏事件到音乐事件映射表

- [ ] 新建或并入 `music_runtime_schema_v0.1.md` 的 `EventMapping` 章节。
- [ ] 覆盖事件：`paddleHit`、`wallHit`、`brickBreak`、`armorHit`、`crystalBreak`、`poisonBreak`、`fireBreak`、`comboUp`、`multiBall`、`danger`、`bossWarning`、`dropTrigger`、`roomClear`。
- [ ] 每个事件标注：目标 lane、quantize grid、cooldown、优先级、是否允许叠加、是否触发 transition。
- [ ] 明确高频事件必须聚合，不逐碰撞全量发声。

验收标准：

- 任一事件都能落到 `phrase / anchor / density bump / send bump / transition role` 中的一类。
- 不允许把碰撞直接映射成随机 lead 音符。

依据：

- `MUS-PHRASE-01`
- `MUS-AUDIO-02`
- `MUS-DENSE-01`
- `MUS-FX-01`

### P0-3. 可听验证 Demo 计划

- [ ] 新建 `music_layer_demo_iteration_plan_v0.1.md`。
- [ ] 指定当前 HTML demo 下一步要验证的 4 个开关：`intensity ladder`、`pause veil`、`FX transition role`、`Boss profile swap`。
- [ ] 列出需要改动的 demo 文件和不改动运行时代码的边界。
- [ ] 定义最小可听验收：普通房间 0-5 递进、一次 pause、一次 room clear、一次 boss warning。

验收标准：

- 后续 Agent 能据此改 demo，而不是继续只写文档。
- 不启动长期 dev server；本 demo 可继续 file 直开，除非模块化重构需要本地服务。

依据：

- `dark_alchemy_music_layer_demo.html`
- `dark_alchemy_music_layer_demo.js`
- `dark_alchemy_music_layer_demo_data.js`
- `AGENTS.md :: Dev Server / 本地服务进程管理规范`

## 2. P1 TODO

### P1-1. Boss / Biome 音乐身份垂直切片

- [ ] 新建 `music_boss_biome_profiles_v0.1.md`。
- [ ] 至少设计 3 个 Boss profile：
  - 机械炼金：techno / acid / metallic，偏 Phrygian 或 diminished pressure。
  - 毒性腐化：trap / phonk / slime FX，偏 Aeolian 或 chromatic cell。
  - 深渊仪式：dark psy / gothic / harmonic minor，偏 ritual pad 与 long-tail transition。
- [ ] 每个 profile 给出：BPM、root、mode、lane recipe、pad/chord shell family、bass spine、lead/shard 限制、FX transition 角色。
- [ ] 标注与现有 MIDI profile 的继承关系，避免把 F/G#/G profile 混成全局音池。

验收标准：

- 3 个 Boss 听感身份差异来自 tempo/grid/timbre/effects/phrase book，而不是只换 one-shot。
- 每个 profile 都能引用 v0.11 中至少 3 条硬规则。

依据：

- `MUS-KEY-01`
- `MUS-SHARD-05`
- `MUS-VALID-02`
- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §3.4 Boss 风味变体`

### P1-2. 混音与效果器预算

- [ ] 新建 `music_mix_fx_budget_v0.1.md`。
- [ ] 定义低/中/高/FX 四组频段预算。
- [ ] 定义 reverb、delay、distortion、filter、sidechain 的建议范围和禁用场景。
- [ ] 明确 pause veil、long-tail cue、chord cloud 与 brick/paddle one-shot 的频段避让。
- [ ] 给出 `intensity 0-5` 的混音变化表。

验收标准：

- 能回答“为什么 pad/reverb 不会糊住碰撞反馈”。
- 能回答“低频 kick/sub/bass/paddle thump 如何避免打架”。

依据：

- `MUS-AUDIO-02`
- `MUS-PAUSE-01`
- `MUS-FX-03`
- `.cursor/rules/audio.md`

### P1-3. Transition 模板库

- [ ] 新建 `music_transition_templates_v0.1.md`。
- [ ] 模板至少包含：`1barPickup`、`2barDrumFill`、`4barRiser`、`8barBuild`、`dropTrigger`、`roomClearTail`、`bossWarningPreRoll`。
- [ ] 每个模板给出：触发窗口、lane、pitch boundary、density curve、tail budget、适用 intensity。
- [ ] 引用 `FXTransition_*` MIDI 样本作为来源。

验收标准：

- 后续实现可以按模板触发 transition role，而不是手写散乱效果。
- 每个模板都说明如何接上一个 phrase 和下一个 phrase。

依据：

- `MUS-FX-01`
- `MUS-FX-02`
- `MUS-FX-03`
- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §3.6 Transition 变体`

## 3. P2 TODO

### P2-1. 音频资产交付规格

- [ ] 新建 `music_asset_delivery_spec_v0.1.md`。
- [ ] 定义 stem 命名：`Profile_Role_Intensity_Bars_BPM_Key.wav`。
- [ ] 定义 one-shot 命名：`Event_Profile_Variant_Tail.wav`。
- [ ] 定义 MIDI 研究样本命名：`MusicName_TrackRole.mid`。
- [ ] 规定 BPM、bar 长度、loop 点、tail 裁切、dry/wet 分轨、响度范围、格式。
- [ ] 规定 duplicate SHA 的处理方式：保留溯源，不重复加权。

验收标准：

- 美术/音频制作人员能按此导出素材。
- 程序能按命名自动归档或校验。

依据：

- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §14 外部 MIDI 命名规范`
- 全部 MIDI 专项章节的 duplicate guard 记录。

### P2-2. 规则验证用完整曲补样

- [ ] 继续补齐完整规则验证曲缺口：pad/chord 情绪层、FX/riser/impact 层、pause veil 版本、Boss profile 变体版本。
- [ ] 每次新 MIDI 入库都按语义改名、记录 SHA、更新索引。
- [ ] 不把同 SHA 重复导出当作新增证据。

验收标准：

- 至少 1 个普通房间 + 1 个 Boss 战能覆盖 groove、phrase、intensity、transition、pause 五类状态。

依据：

- `MUS-VALID-01`
- `MUS-VALID-02`
- `dark_alchemy_music_constraints_and_variants_v0.11.md :: §11 完整规则验证曲 MIDI 分析摘录`

## 4. 暂不做

- [ ] 暂不接入正式 `src/audio.js`，除非先完成 runtime schema 与 demo 计划。
- [ ] 暂不引入外部音乐 DSL 或 Strudel runtime。
- [ ] 暂不把 MIDI 绝对音高硬编码成全局根音。
- [ ] 暂不继续生成随机 lead variation。
- [ ] 暂不为每个 intensity 写独立歌曲。

## 5. 下一步推荐顺序

1. 做 `music_runtime_schema_v0.1.md`。
2. 做事件映射表。
3. 做 transition 模板库。
4. 做 demo 迭代计划。
5. 再做 Boss / Biome profiles。
6. 最后整理混音预算和资产交付规格。

