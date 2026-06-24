# 音乐处理资料索引

> 状态：v0.11 迭代
> 日期：2026-06-24
> 目的：把外部节奏塔防项目中可迁移的音乐系统方法论，沉淀为 Echo Alchemist V2 的音乐处理入口。

## 必读顺序

1. [`dark_alchemy_music_constraints_and_variants_v0.11.md`](dark_alchemy_music_constraints_and_variants_v0.11.md)
   - 汇总当前版限制、硬规范、变体决策树、两批 MIDI-derived 规则、完整低强度暗黑房间规则、Psy Bass Spine 专项规则、Pad / 和弦情绪导演专项与增量规则、高强度 Chord-Shard Cloud 专项规则、完整规则验证曲、Intensity 0-5 递进版规则与 FX / Transition 专项规则，并逐条标注规范来源。
   - 用途：未来改音乐系统规则、Boss 风格、和弦情绪、dark psy profile、lead variation、bass spine、低强度悬浮态、transition 时优先查此文件。

2. [`music_system_next_todo_v0.1.md`](music_system_next_todo_v0.1.md)
   - 将 v0.11 之后仍缺的运行时 schema、事件映射、Boss/Biome profile、混音预算、transition 模板、demo 验证与资产交付规格落成 P0/P1/P2 TODO。
   - 用途：后续推进音乐系统时按优先级执行，避免继续无边界堆 MIDI 素材。

3. [`music_system_handoff_prompts_v0.1.md`](music_system_handoff_prompts_v0.1.md)
   - 保存可直接交给后续 Agent 的通用交接提示词，以及 runtime schema、事件映射、Boss profile、transition 模板、demo 迭代等专项提示词。
   - 用途：开新线程或交接给其他 Agent 时直接复制。

4. [`dark_alchemy_breakout_music_system_notes_v0.1.md`](dark_alchemy_breakout_music_system_notes_v0.1.md)
   - 提炼可迁移方法论：单一拍序时钟、Groove/Phrase 双层、调式与风格正交、频段分工、强度分层、密音低交互。
   - 用途：未来设计或实现音乐系统、碰撞音效量化、Boss 音乐阶段、连击编曲时优先阅读。

5. [`dark_alchemy_breakout_music_brainstorm_v0.1.md`](dark_alchemy_breakout_music_brainstorm_v0.1.md)
   - 保存暗黑炼金打砖块的配乐方向与玩法联动脑暴。
   - 用途：做垂直切片、音色需求、Biome 音乐身份、Phrase 事件清单时取材。

6. [`dark_alchemy_music_layer_demo.html`](dark_alchemy_music_layer_demo.html)
   - 独立可听原型：固定音轨、阶段变动音轨、暂停效果器、强度开关层、Boss 风格差异。
   - 用途：不启动 dev server，直接用浏览器打开试听音乐层逻辑。

## P0/P1 落地规格（v0.1，2026-06-24 新增）

> 承接 `music_system_handoff_prompts_v0.1.md` 与 `music_system_next_todo_v0.1.md`，把方法论落成可消费的数据规格。逐字段 / 逐条目可追溯到 v0.11 规则 ID 或 MIDI 章节；本批仍只沉淀规格，未改运行时代码。

7. [`music_runtime_schema_v0.1.md`](music_runtime_schema_v0.1.md) · **P0-1 基座**
   - 6 个结构：`MusicProfile` / `IntensityLayer` / `HarmonyState` / `PhraseBook` / `FXTransition` / `EventMapping`，含正常房间（`room.darkpsy.base`）与 Boss（`boss.crucible`）JSON 示例、逐字段规则溯源、边界。
   - 用途：实现或扩展音乐系统数据结构时的唯一真值；其余四篇都引用它。

8. [`music_event_mapping_v0.1.md`](music_event_mapping_v0.1.md) · **P0-2**
   - 13 个游戏事件 → 五类音乐意图（`phrase`/`anchor`/`densityBump`/`sendBump`/`transitionRole`）的路由表 + 限流表（`cooldownBeats`/`priority`/`maxStack`/`aggregate`），含高频碰撞聚合细则与事件→转场触发。
   - 用途：接玩法事件到音乐层、调限流与优先级时查此文件。

9. [`music_transition_templates_v0.1.md`](music_transition_templates_v0.1.md) · **P1-3**
   - 7 个 `FXTransition` 桥接模板（`1barPickup`/`2barDrumFill`/`4barRiser`/`8barBuild`/`dropTrigger`/`roomClearTail`/`bossWarningPreRoll`），逐模板 JSON + 5 个桥接 MIDI 交叉引用；全部 `opensNewMelody=false`、挂边界、留瞬态。
   - 用途：实现转场调度、对齐事件映射里的 `fx.*` 引用。

10. [`music_layer_demo_iteration_plan_v0.1.md`](music_layer_demo_iteration_plan_v0.1.md) · **P0-3**
    - 4 个 `file://` 可开验收场景（intensity 0→5 分层 / 暂停纱罩 / 清屋长尾+落点 / Boss 预告+profile 切换），每个含听感判据 + 结构判据。
    - 用途：验证"能不能听出来"，作为不改运行时的验收基线。

11. [`music_boss_biome_profiles_v0.1.md`](music_boss_biome_profiles_v0.1.md) · **P1-1**
    - 3 个 Boss `MusicProfile`：`boss.crucible`（机械炼金·acid 金属）/ `boss.venom`（毒性腐化·trap 黏液）/ `boss.abyssRite`（深渊仪式·dark psy 教堂），各含 bpm/root/mode、lane 配方、intensity 全档、transition 角色、pause veil。
    - 用途：实现 Boss 风味与 profile swap；情绪轴共享、Boss 只换风味。

12. [`music_mix_fx_budget_v0.1.md`](music_mix_fx_budget_v0.1.md) · **P1-2**
    - 四频段（low/mid/high/fx）预算 + 频段避让矩阵 + 效果器建议范围/禁用场景 + 留瞬态四闸门 + intensity 0–5 混音表 + pause veil 混音；含两条验收问答（pad/reverb 为何不糊碰撞、低频如何不打架）。
    - 用途：实现混音与 send/sidechain 时查此文件；保证碰撞瞬态优先权。

13. [`music_asset_delivery_spec_v0.1.md`](music_asset_delivery_spec_v0.1.md) · **P2-1**
    - stem / one-shot / MIDI 三类命名模板 + 字段字典 + 技术规格（WAV 48k/24bit、bar 对齐、loop 点、tail 裁切、dry/wet 分轨、响度 −18 LUFS / −1 dBTP）+ duplicate SHA 处理 + 程序校验三正则。
    - 用途：音频/美术导出与程序自动归档校验的唯一命名真值。

14. [`music_validation_gap_checklist_v0.1.md`](music_validation_gap_checklist_v0.1.md) · **P2-2**
    - 闭合验收要补的 MIDI 清单：Song A 普通房间（G-root 150，6 条）+ Song B Boss 战（boss.crucible F/128，9 条），各覆盖 groove/phrase/intensity/transition/pause 五状态；含现状-缺口对照（v0.11 §11 line 489）、五状态覆盖矩阵、每条目标文件名+验证规则+验收、入库规范。
    - 用途：音频端的制作工单；实际 MIDI 内容由音频端产出，本文件只规定"需要什么"。

15. [`music_algorithmic_generation_spec_v0.1.md`](music_algorithmic_generation_spec_v0.1.md) · **P3-1 · 含规则修订**
    - 改规则：澄清 `MUS-LEAD-01` 禁的是无约束随机、非算法生成；新增 `MUS-GEN-01..07` 规则族（受约束生成/约束三闸/联动单输入面/融合混音裁决/和谐调性闭包/可复现/只产意图）。算法生成设计规格聚焦编排耦合层：tick() 主循环 + intensity 密度生成器 + 事件→phrase 调度器 + transition 桥接选择器 + lane 融合裁决，全套伪代码；§4 受约束生成内核（quantizePitch/transformMotif/seededPick）；§6 "和谐≠随机"对照；§8 生成合规验证。
    - 用途：把"联动/融合/和谐"落成可实现的生成算法；下一步接 demo/façade 做可听验证。**已同步修订 v0.11 `MUS-LEAD-01`。**

16. [`music_constraint_kernel_spec_v0.1.md`](music_constraint_kernel_spec_v0.1.md) · **P3-2**
    - 深化 generation_spec §4：五原语完整算法——`legalSet` 带权合法音池推导（progression×shellFamily×scale + root 重力梯度）、`quantizePitch` 最近合法+avoid-note、`quantizeRhythm` slot16 密度档、`transformMotif` 闭合变换文法（transpose 级/invert/retrograde/density/octave/gate + 禁止项）、`voiceLead` 最小移动+root lock、`seededPick` 确定性 PRNG；每 lane 内核画像 + roomDarkpsy G# / bossCrucible F 端到端 worked example + 验证钩子。
    - 用途：让"和谐"成为机器保证（音 ∈ 闭包、同 seed 可复现）而非断言；作为 tick() 的下层取音内核。

17. [`music_generation_demo.html`](music_generation_demo.html) · **P3-3 可听验证原型**
    - 单文件 WebAudio 实时合成（file:// 直接双击可开，无依赖、无服务器）。把 constraint_kernel 五原语（legalSet/quantizePitch/quantizeRhythm/transformMotif/voiceLead/seededPick）+ generation_spec 的 tick() 编排环（单拍序时钟 + 分层密度 + 事件路由 + transition 桥接 + kick 侧链融合）落成可听代码。八个合成声部（kick/bass/pad/cloud/lead 短手势/downlifter/impact/veil drone）。
    - 四个验证开关：① intensity 0→5 密度阶梯（联动）② Pause Veil 面纱 ③ FX transition：drop+roomClear ④ Profile Swap room⇄Boss（相对级重定根, MUS-VALID-02）；外加碰撞 phrase（瞬态优先穿透=融合裁决）。
    - 实时 pitch-legality 日志 + legalSet 带权轮盘 + 和谐校验计数（违规恒 0）。**Node 验证**：语法 OK；168/168 quantizePitch 落点 ∈ legalSet；legalSet 复现 spec worked example（room G#1.00/D#0.70/B0.55、boss F1.00/C0.70/Ab0.55/Gb0.25）；root-lock/重定根/确定性/transpose 闭合全 PASS。
    - 边界：**纯听感验证沙箱，不触碰正式 `src/audio.js` 与游戏 `index.html`**（MUS-GEN-07）。

## Boss MIDI 深挖号段（v1，2026-06-25 新增）

> 与上面 1–17 的设计/规格文档并列，专开 **`M-` 号段**逐 Boss 深挖 `Audio_sample/Boss/` 分轨 MIDI，用来丰富 `dark_psy_engine_demo.html`、解决「音乐太单调」。

18. [`boss_midi_deep_mining_INDEX.md`](boss_midi_deep_mining_INDEX.md) · **音乐类专用索引 · M-01..M-08**
    - 把 8 个 Boss 各自的分轨 MIDI 逐条解析（16 分栅格 onset / 力度动态 / 时值分布 / 段落切分，而非只取中位 BPM+调式），每 Boss 一个稳定编号 `M-0x`。逐条结论回写 [`boss_music_design.md`](boss_music_design.md) §3.x 的「深挖 v2」小节，引擎新增声部/段落在本索引 §3 登记。
    - 工具：[`tools/midi_mine.py`](tools/midi_mine.py)（截断防护 SMF 解析器，零依赖；42 分轨已 0 截断校验）。
    - 用途：要给某个 Boss 的曲子加层、改节奏栅格、加段落编排时，先查此号段对应 `M-0x` 的实测结论。

## 源资料索引

主要源资料来自 `D:/claude/web-game-effect-core`：

| 源文件 | 本索引用到的核心信息 |
|---|---|
| `docs/06-技术架构/节奏塔防_音乐编排协议_v0.1.md` | Groove 床 + Phrase 反应层、StyleSpec、强度分层、`music:*` 命名空间、MusicDriver 接线 |
| `docs/06-技术架构/节奏塔防_音乐处理对比分析与优化_v0.1.md` | 前瞻调度、单一时钟源、humanize、tempo ramp、延迟校准边界 |
| `docs/06-技术架构/节奏塔防_多风格音乐身份落地计划_v0.1.md` | 风格身份落数据、调式与风格正交、多风格 tempo/grid/groove 招牌 |
| `docs/06-技术架构/节奏塔防_Strudel理念适配性调研_v0.1.md` | Pattern/time-as-function、mini-notation 只在加载层编译、不直接依赖 Strudel 包 |
| `docs/06-技术架构/节奏塔防_模块拆分与协作协议_v0.1.md` | 音乐是表现层消费者、核心事件名不可重发、玩法真相与音乐表现解耦 |
| `docs/02-玩法设计/节奏塔防_噪声炼金自动伴奏塔防_机制设计_v0.2.md` | 噪声炼金主题、自动伴奏机、音乐作为资源状态表 |
| `docs/03-MVP局内系统/节奏塔防_密音范式索引_v0.1.md` | `template ⊇ anchors`、autoFill 真音、密音但低交互 |
| `src/audio/README.md` | 音频门面、时钟、GrooveEngine、per-band intensity、数据驱动曲风的工程形态 |
| `docs/02-玩法设计/节奏塔防_音源调研_v0.1.md` | 低/中/高/FX 频段分工、one-shot 与可商用音源红线 |

## MIDI 参考素材

| 批次 | 文件 | 本索引用到的核心信息 |
|---|---|---|
| 第一批 | `D:/Downloads/Untitled Project.mid`、`(1)`、`(2)`、`(3)` | F Phrygian-ish profile、F/F# 半音摩擦、C#/D# 过渡、G# pad/voice 色彩 |
| 第二批 | `D:/Downloads/Untitled Project (4).mid` 到 `(9).mid` | G# minor/bVII profile、offbeat bass spine、quarter drum anchors、chord-shard cloud、8/16/32 小节 stem windows |
| 低强度暗黑房间完整 MIDI | `D:/Downloads/Untitled Project (14).mid` 到 `(18).mid` | G# minor/bVII 低强度 profile、sparse voice/pad 开场、bass 分段增密、dense cloud 延迟进入、late top motif |
| Psy Bass Spine 专项 | `D:/Downloads/PsyBassSpine_VoiceOohsSparseCall.mid`、`PsyBassSpine_VoiceOohsGSharpFSharpAnswer.mid`、`PsyBassSpine_DrumAnchorGrid.mid`、`PsyBassSpine_ElectricBassRootMotor.mid`、`PsyBassSpine_TinyDrumFill.mid`、`PsyBassSpine_DrumMusicBoxDenseMotor.mid`、`PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid` | 120 BPM G# root-locked spine、quarter/offbeat/even/full density ladder、drum anchor grid、octave/register ghost mirror |
| Pad / 和弦情绪导演专项 | `D:/Downloads/PadChordDirector_VoiceOohsGSharpMinorThirdArc.mid`、`PadChordDirector_DrumPulseGrid.mid`、`PadChordDirector_MutedGuitarGRootMotor.mid`、`PadChordDirector_CleanGuitarGSharpChromaticCell.mid`、`PadChordDirector_CleanGuitarGSharpChromaticCell_Duplicate.mid`、`PadChordDirector_SynthStringsDSharpPedalSectionArc.mid`、`PadChordDirector_VoiceOohsSparseCadenceCue.mid`、`PadChordDirector_VoiceOohsGOffbeatResolution.mid` | section-level harmony state、partial shell、D# pedal、G#-B minor third、G/G#/B 半音邻接 cell、pad gate、offbeat resolution |
| Pad / 和弦情绪导演增量 | `D:/Downloads/PadChordDirector_SynthStringsBorrowedTriadSectionArc.mid`、`PadChordDirector_SynthStringsBorrowedTriadSectionArc_Duplicate.mid`、`PadChordDirector_DrumSynthStringsFRootGateRamp.mid`、`PadChordDirector_VoiceOohsGSparseCue.mid`、`PadChordDirector_SynthStringsFChordCloudBody.mid`、`PadChordDirector_VoiceOohsDSharpPedalGate.mid` | F-profile chord/pad 情绪导演：borrowed triad section arc、F/C root-gravity chord cloud、D#/G sparse cue/pedal、drum-supported pad gate；Duplicate 文件同 SHA，只保留溯源不加权 |
| 高强度 Chord-Shard Cloud 专项 | `D:/Downloads/ChordShardCloud_VoiceOohsGSharpOffbeatCue.mid`、`ChordShardCloud_DrumHighIntensityPulseGrid.mid`、`ChordShardCloud_FretlessBassGSharpDensityMotor.mid`、`ChordShardCloud_FretlessBassGSharpDensityMotor_Duplicate.mid`、`ChordShardCloud_VoiceOohsGSharpLongAnchorCue.mid`、`ChordShardCloud_CleanGuitarGSharpDenseCloud.mid`、`ChordShardCloud_VoiceOohsCtoGSectionCue.mid` | drum grid、root density motor、G# root-gravity dense cloud、sparse cue/handoff、duplicate guard |
| 完整规则验证曲 | `D:/Downloads/FullRuleValidation_DrumGridPercussionStem.mid`、`FullRuleValidation_DrumFillAccentStem.mid`、`FullRuleValidation_DrumFillAccentStem_Duplicate.mid`、`FullRuleValidation_Lead2GRootShardStem.mid`；重复导出：`FullRuleValidation_DrumGridPercussionStem_Redownload.mid`、`FullRuleValidation_DrumFillAccentStem_Redownload.mid`、`FullRuleValidation_Lead2GRootShardStem_Redownload.mid`、`FullRuleValidation_DrumFillAccentStem_Redownload2.mid` | 150 BPM validation song、drum grid + fill/accent 分离、G-root shard stem、section coverage、duplicate guard；Redownload 文件同 SHA，只保留溯源不加权；待补 pad/chord 与 FX 层 |
| Intensity 0-5 递进版 | `D:/Downloads/IntensityLadder_VoiceOohsFGFinalCue.mid`、`IntensityLadder_VoiceOohsFPressureCue.mid`、`IntensityLadder_DrumGridDensityRamp.mid`、`IntensityLadder_BassFRootDensityRamp.mid`、`IntensityLadder_DrumFillMidHighCue.mid`、`IntensityLadder_VoiceOohsFCloudDensityRamp.mid`、`IntensityLadder_VoiceOohsGLongCueHandoff.mid` | 同一 F profile 内的 layered density ramp：drum density、F-root bass density、F-cloud density、sparse cue/handoff 分工；强度递进优先改 gate/stem/effect send，不换成独立歌曲 |
| FX / Transition 专项 | `D:/Downloads/FXTransition_DrumSectionFillGrid.mid`、`FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid`、`FXTransition_ElectricBassASharpPickupStutter.mid`、`FXTransition_VoiceOohsSectionHandoffArc.mid`、`FXTransition_DrumImpactVoiceOohsLongTailCue.mid` | 转场分角色系统：drum fill grid、F/F# semitone tension ramp、A# bass pickup/stutter、voice section handoff、impact + long-tail cue；全部挂 phrase/section 边界，不作为持续旋律层 |

## 当前项目接入提醒

- 当前 Echo Alchemist V2 的音频实现集中在 `src/audio.js` 的 `SoundManager`，已有 `.cursor/rules/audio.md` 约束：玩法/UI 模块只能通过 `audio` 代理或未来门面调用，不能散落创建 `AudioContext`。
- 本索引目前只沉淀设计与方法论，没有改动运行时代码。
- 如果未来实现音乐系统，应同步更新 `.cursor/rules/audio.md`，并保持核心玩法事件与音乐表现层分离。
