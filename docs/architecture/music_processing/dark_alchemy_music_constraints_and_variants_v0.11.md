# 暗黑炼金音乐限制与变体规范 v0.11

> 日期：2026-06-24
> 状态：当前汇总版，整合第二批 150 BPM psy trance MIDI、低强度暗黑房间完整 MIDI、Psy Bass Spine 专项 MIDI、Pad / 和弦情绪导演专项 MIDI 与增量 MIDI、高强度 Chord-Shard Cloud 专项 MIDI 增量、完整规则验证曲 MIDI、Intensity 0-5 递进版 MIDI 与 FX / Transition 专项 MIDI
> 范围：仅固化音乐处理方法论、demo 规则、MIDI 参考规律与后续实现边界。

## 0. 本版总结

这一版的核心不是“写一首循环 BGM”，而是把音乐拆成可被游戏状态驱动的系统：

- 固定部分负责身份：低频 pulse、root drone、基础 pad，让房间在低强度和暂停时仍有暗黑炼金质感。
- 变动部分负责局势：stage、intensity、boss profile、phrase window 决定哪些 lane、和弦、效果器、lead gesture 进入。
- 和弦是情绪导演：阶段与激烈程度决定 progression，Boss 与关卡决定 mode、voicing、pad 音色和效果器。
- Lead 不再自由随机：MIDI 参考显示主导逻辑不是“随机旋律”，而是根音中心、固定音级集合、短 gate、八度/密度/效果器变化。第一批素材偏 F Phrygian-ish，第二批素材偏 G# minor / bVII / III，因此根音必须由 profile 决定，motif 语法要可移调。
- 碰撞是乐句触发器，不是无限 one-shot：高频事件必须聚合、限流、量化到音乐网格。
- Pause 不是静音：暂停应关闭运动层，保留固定 pulse/drone，并加低通、delay、reverb 等 veil 效果。
- 第二批 150 BPM psy trance 进一步确认：有效变化通常发生在 8/16/32 小节级别的 stem 进出、bass 密度切换、drum fill、chord-shard cloud，而不是每小节重抽一条新旋律。
- 低强度暗黑房间完整 MIDI 修正了上一次只看 drum/stem 包导致的误判：它不是单根音 D# 静态场，而是 sparse voice/pad 开场、G# minor/bVII 音高集合、bass 分段增密、dense voice cloud 延迟进入、late top motif 收束。低强度的第一原则是“少层、慢入场、受限音集、section 级增密”。
- Psy Bass Spine 专项 MIDI 进一步确认：bass spine 不是单一 `2/6/10/14` 模式，而是一套密度阶梯。它可以从 quarter anchors、offbeat spine、even-slot motor 逐步升级到 full 16th motor，同时保持 G# root lock 与 octave/register 分层。
- Pad / 和弦情绪导演专项 MIDI 进一步确认：和弦情绪不等于每 4 小节换一套完整和弦。有效做法是 section 级 pitch-set/harmony state 调度，用 pedal tone、minor third shell、半音邻接 cell、pad gate、voicing density 与效果器去改变情绪；完整三和弦反而只是其中一种表现。
- Pad / 和弦情绪导演增量 MIDI 进一步确认：F profile 的 pad/chord 可以用 borrowed triad section arc、F chord cloud body、D#/G 稀疏 cue/pedal 共同导演情绪。它不是“和弦进行表一行一换”，而是 shell family、root gravity、voicing density 与 gate grid 在 section 级调度。
- 高强度 Chord-Shard Cloud 专项 MIDI 进一步确认：密音不是“把所有音随机撒满”。它需要拆成 drum grid、root density motor、dense cloud body、sparse cue/handoff 四类角色；cloud body 可以极密，但 pitch set 必须有 root gravity 与 chord/profile 边界，重复导出素材只计一次，不能重复加权。
- 高强度 Chord-Shard Cloud 增量 MIDI 进一步确认：不同 profile 的 dense cloud 不能混成一个全局音池。G# profile 与 F profile 要分开注册；F profile 可用 F root density、F-A-C shard sections、A#-C dyad dense cloud 与 C#/F# 等少量压力色。
- 完整规则验证曲 MIDI 的职责是验证“系统能否合奏”，不是新增一个全局风格模板。它在 150 BPM 下同时检查 drum grid、fill/accent、root/shard stem、section coverage 与 duplicate guard 是否能共同成立。
- Intensity 0-5 递进版 MIDI 进一步确认：强度不是 6 首互不相关的 loop，而是同一 profile 内的 layered density ramp。鼓网格、F-root bass motor、F-cloud、稀疏 cue/handoff 分别承担不同强度维度；越高强度越应该先加密 gate/stem/effect send，再考虑改变音高集合。
- FX / Transition 专项 MIDI 进一步确认：转场不是一个泛用 riser，而是一套分角色桥接系统。drum fill grid 负责身体推进，F/F# 失真 ramp 与 A# bass pickup 负责张力，voice handoff 与 long-tail cue 负责和声/空间衔接；这些都应挂在 phrase/section 边界，而不是成为持续旋律层。

来源标注格式：

```text
本目录文档：docs/architecture/music_processing/<file> :: §章节
上游文档：D:/claude/web-game-effect-core/<file> :: §章节
MIDI：D:/Downloads/<file>.mid :: Track 名称 / 统计结论
Demo 数据：docs/architecture/music_processing/<file>.js :: 对象名/函数名
```

## 1. 硬限制

| ID | 规范 | 落地含义 | 来源 |
|---|---|---|---|
| MUS-CLOCK-01 | 音乐、阶段、攻击反馈、持续效果优先使用 `beat / bar / abs` 拍序语义。 | 墙钟秒只存在于 Web Audio 调度和视觉补偿边界；音乐真相用小节与拍号表达。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §1.1 单一拍序时钟`; `节奏塔防_音乐处理对比分析与优化_v0.1.md :: §1.3 单一时钟源铁律` |
| MUS-LAYER-01 | 音乐层只能消费玩法事件，不写玩法真相。 | `MusicDriver` 订阅 `ball:*`、`brick:*`、`combo:*`、`boss:*`，输出 `cuePhrase`、`setIntensity`、`setBandLevel` 等音乐意图。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §1.2 音乐层是表现层消费者`; `节奏塔防_模块拆分与协作协议_v0.1.md :: §9 表现层桥接协议`; `§14.1 关系定位` |
| MUS-EVENT-01 | 音乐内部事件必须保留 `music:*` 命名空间。 | 不与 `phase:*`、`combat:*`、`wave:*` 混名，不重发核心事件。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §1.1`; `节奏塔防_模块拆分与协作协议_v0.1.md :: §14.3 命名空间规则` |
| MUS-AUDIO-01 | 玩法/UI 模块不得直接创建 `AudioContext`、`Audio`、采样 fetch。 | 新音乐系统必须进 `SoundManager` 或未来音乐门面，通过 `audio` proxy 暴露。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §7 当前项目落地约束`; `.cursor/rules/audio.md :: Local sample preview layer`; `.cursor/rules/audio.md :: §5 已知问题与修改规范` |
| MUS-AUDIO-02 | 高频碰撞声音必须防抖、限流或聚合。 | 墙体反弹、多球碰撞、碎砖密集段不能逐事件全量发声。 | `.cursor/rules/audio.md :: Local sample preview layer`; `.cursor/rules/audio.md :: §5 已知问题与修改规范`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §5 密音但低交互` |
| MUS-DSL-01 | 作者层可用 mini-notation/Pattern，运行层不认识 DSL。 | 加载层编译成数组、步号集或事件表；短期不引入 `@strudel/*`。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §1.3 作者层 DSL，运行层零感知`; `节奏塔防_Strudel理念适配性调研_v0.1.md :: §6.1`; `§6.2` |
| MUS-STEM-01 | Groove 必须拆成 `low / mid / high / fx`，并区分 fixed、stage、boss、phrase 角色。 | 固定层保身份，变动层表达阶段，phrase 层响应事件，FX 层做转场和爆发。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §2.1 Groove 层`; `节奏塔防_音源调研_v0.1.md :: §3.1-§3.4` |
| MUS-PHRASE-01 | Phrase 是量化乐句，不是孤立碰撞声堆叠。 | 挡板、墙、砖、连击、Boss warning 均应吸附到当前 chord/grid。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §2.2 Phrase 层`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §3 事件到乐句` |
| MUS-DENSE-01 | 允许音乐很密，但玩家只驱动少数 anchor。 | `template ⊇ anchors`，其余 autoFill 是自动音乐层，避免事件风暴。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §5 密音但低交互`; `节奏塔防_密音范式索引_v0.1.md :: §1 概念三件套`; `§3 关键点选点启发式` |
| MUS-CHORD-01 | 和弦/pad 是情绪核心，不能当普通背景铺底。 | 阶段和 intensity 选 progression；Boss/biome 选 mode、voicing、timbre、FX。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.2 和弦进行是情绪导演`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §3.1 音轨状态脑暴` |
| MUS-CHORD-02 | Pad/chord 变化应是 section 级情绪状态调度，不是逐小节随机换和弦。 | 先选 harmony state，再决定 pedal、shell、gate、density、FX；4/8 小节只做局部变体，8/16/32 小节才做明显换景。 | `PadChordDirector_SynthStringsDSharpPedalSectionArc.mid :: SynthStrings section windows`; `PadChordDirector_VoiceOohsGSharpMinorThirdArc.mid :: G#-B minor-third arc`; `PadChordDirector_VoiceOohsGOffbeatResolution.mid :: G offbeat resolution` |
| MUS-CHORD-03 | 情绪和弦可用 partial shell 表达，不强制每次给完整三和弦。 | 低强度用 root、fifth、minor/major third、半音邻接与少量 color tone；完整 chord 只在需要明确情绪转向时出现。 | `PadChordDirector_VoiceOohsGSharpMinorThirdArc.mid :: G#-B shell`; `PadChordDirector_SynthStringsDSharpPedalSectionArc.mid :: D# pedal + G / D-D#-F-G windows`; `PadChordDirector_VoiceOohsSparseCadenceCue.mid :: G -> D -> D-F sparse cue` |
| MUS-CHORD-04 | Pad 不一定是长音，也可以是被 gate 的和声运动层。 | pad/chord lane 可用 0.5/0.25 beat gate、滤波、phase、reverb 建立“流动的铺底”；但音高集合仍由 harmony state 锁定。 | `PadChordDirector_SynthStringsDSharpPedalSectionArc.mid :: 0.5 beat D# gate`; `PadChordDirector_MutedGuitarGRootMotor.mid :: G2 root motor`; `PadChordDirector_CleanGuitarGSharpChromaticCell.mid :: G/G#/B chromatic cell` |
| MUS-CHORD-05 | Chord director 可以调度 borrowed triad / partial shell family，而不是只调度一条完整和弦进行。 | 先选 section shell family，例如 `C-D#-G#`、`A#-D#-G`、`A#-C#-F`；再用 voicing/gate/density 表达情绪深浅。 | `PadChordDirector_SynthStringsBorrowedTriadSectionArc.mid :: clusters C-D#-G# / A#-D#-G`; `PadChordDirector_SynthStringsBorrowedTriadSectionArc_Duplicate.mid :: duplicate SHA1` |
| MUS-CHORD-06 | F-profile chord cloud 必须有 F/C root gravity，可用三度切换和 borrowed shell 改变明暗。 | F、C 是身体；G#、A、A#、D#、G 等是情绪色。F minor、F major、D# major-ish 等 shell 只能在 profile 边界内 section 级切换。 | `PadChordDirector_SynthStringsFChordCloudBody.mid :: F=603/C=260`; `PadChordDirector_SynthStringsFChordCloudBody.mid :: clusters C-F-F / A-C-F / A#-D#-G / C-F-G#` |
| MUS-CHORD-07 | 单音 cue/pedal lane 只提示情绪或 section handoff，不等价于完整和弦。 | G sparse cue 与 D# pedal gate 可作为悬浮、收束或仪式感提示；不能被合并成随机旋律池，也不能单独代表完整 progression。 | `PadChordDirector_VoiceOohsGSparseCue.mid :: G only sparse cue`; `PadChordDirector_VoiceOohsDSharpPedalGate.mid :: D#=119/G#=2` |
| MUS-KEY-01 | Dark psy 的根音中心必须来自 Boss/biome profile 或参考素材，不能硬编码成单一绝对音。 | F center 只适用于第一批 MIDI 的一个 profile；第二批 MIDI 证明 G# minor/bVII 也是可用暗色 profile。所有 motif bank 应用相对音程表达。 | `Untitled Project (2).mid :: String Ensembles 1，F=1024`; `Untitled Project (3).mid :: Lead 2，F=2067`; `Untitled Project (7).mid :: Electric Bass，G#=564/F#=427/D#=299`; `Untitled Project (5).mid :: Voice Oohs，B/D#/F#/G#/C#/A# 集合` |
| MUS-LEAD-01 | Dark psy lead 只做短手势或 chord-shard cloud，不做随机长旋律。 | Lead variation 只能改 rhythm、octave、gate、filter、bend、send、密度，不得随机漂移音高中心。**v0.1 修订**：受约束算法生成是既定实现路径（见 `music_algorithmic_generation_spec_v0.1.md :: MUS-GEN-*`）；被禁的是无约束随机漂移，不是算法本身。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.1 Dark Psytrance 音色参考`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §5.1 Lead 与 Phrase 变体补充`; `Untitled Project (3).mid :: Lead 2 (sawtooth)`; `Untitled Project (5).mid :: Voice Oohs Track 4，4042 notes` |
| MUS-SECTION-01 | 4/8 小节 phrase 是局部变化单位，8/16/32 小节 section 是编曲变化单位。 | 不要每小节随机换旋律；Boss 阶段、房间推进、强度成长应优先映射为 stem 进出与密度曲线。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3 乐句变体与过渡`; `Untitled Project (4).mid :: SynthStrings 1 多轨 bar windows`; `Untitled Project (7).mid :: Electric Bass bar 16-31/40-79/111-174/208-247`; `Untitled Project (8).mid :: Drums bar 15-79/103-175/190-247` |
| MUS-BASS-01 | Psy bass 需要 offbeat spine 与 section-level root motion。 | 低频可用 16 分 slot `2/6/10/14` 做离拍脊柱；根音变化按 8/16 小节段落发生，不跟每次碰撞走。 | `Untitled Project (7).mid :: Track 1，G#1 slots 2/6/10/14`; `Untitled Project (7).mid :: Track 2/3/5，G#/F#/D# section roots`; `PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid :: G#4 slots 2/6/10/14` |
| MUS-BASS-02 | Bass spine 应按密度阶梯升级，不应只有一种固定型。 | 低强度用 quarter anchors 或 offbeat spine；中强度用 even-slot motor；高压才打开 full 16th motor 或 stutter。 | `PsyBassSpine_DrumAnchorGrid.mid :: Drums slots 0/4/8/12`; `PsyBassSpine_ElectricBassRootMotor.mid :: Electric Bass even-slot/full 16th motor`; `PsyBassSpine_DrumMusicBoxDenseMotor.mid :: Music Box + drum dense motor`; `PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid :: G#4 offbeat spine` |
| MUS-BASS-03 | Bass spine 优先 root lock 与 octave/register 分层。 | pitch 变化少于 rhythm/density 变化；G# root 可在 G#1/G#2/G#3/G#4 等 register 间镜像，bVII/2 等只作回答或过渡。 | `PsyBassSpine_ElectricBassRootMotor.mid :: G#=796, G#2/G#1 dominant`; `PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid :: G#4=165`; `PsyBassSpine_VoiceOohsSparseCall.mid :: G#/A#/B/C# sparse voice`; `PsyBassSpine_VoiceOohsGSharpFSharpAnswer.mid :: G#/F# alternating voice` |
| MUS-DRUM-01 | Drum lane 用 quarter anchors 加少量 pickup/fill slots，而不是全随机打点。 | 主 pulse 锁定 slot `0/4/8/12`；transition/fill 可用 `2/6/10/14`、`14/15` 等临近点。 | `Untitled Project (8).mid :: Drums slot16Top 0/4/8/12`; `Untitled Project (6).mid :: D#6 drum fill bars 156-157 slots 2/6/10/14` |
| MUS-SHARD-01 | 高强度密音可以是 chord-shard cloud，但音高集合必须被 chord/profile 锁住。 | 玩家事件只触发 anchor 或 density bump；autoFill 可以很密，但只从当前 chord shell、bVII/III shell 或 profile tone set 取音。 | `Untitled Project (5).mid :: Voice Oohs Track 4，B=1005/D#=901/F#=717/G#=545/C#=439/A#=415`; `Untitled Project (5).mid :: dyads G#-B、B-D#、F#-A# 与 C#-F#-A# triad` |
| MUS-SHARD-02 | 高强度 cloud 必须拆分角色，不把所有密度压到一个 lane。 | 至少区分 drum grid、root density motor、cloud body、sparse cue/handoff；不同 lane 可同时密，但职责不能混成随机噪声。 | `ChordShardCloud_DrumHighIntensityPulseGrid.mid :: pulse grid`; `ChordShardCloud_FretlessBassGSharpDensityMotor.mid :: G# density motor`; `ChordShardCloud_CleanGuitarGSharpDenseCloud.mid :: dense cloud body`; `ChordShardCloud_VoiceOohsCtoGSectionCue.mid :: section cue` |
| MUS-SHARD-03 | Dense cloud 可以使用宽 pitch set，但必须有 root gravity 和 chord/profile 边界。 | G# profile 中，G# 可占绝对重心；D#/E/A#/B/G/C#/A/F# 是受控色彩，不允许全音阶随机漂移。 | `ChordShardCloud_CleanGuitarGSharpDenseCloud.mid :: G#=1042, D#/E/A#/B/G/C#/A/F# color set`; `ChordShardCloud_FretlessBassGSharpDensityMotor.mid :: G#=1160`; `ChordShardCloud_VoiceOohsGSharpOffbeatCue.mid :: G# only cue` |
| MUS-SHARD-04 | High-intensity cloud 的开关应由 section cue 和 density curve 控制。 | 稀疏 cue 可提示 cloud 开始/收束；重复素材只计一次，不能把 duplicate 当成额外证据放大规则权重。 | `ChordShardCloud_VoiceOohsGSharpLongAnchorCue.mid :: long G# anchors`; `ChordShardCloud_VoiceOohsCtoGSectionCue.mid :: C -> G handoff`; `ChordShardCloud_FretlessBassGSharpDensityMotor_Duplicate.mid :: duplicate SHA1` |
| MUS-SHARD-05 | Dense cloud 必须按 profile 分家，不把 G# profile 与 F profile 合并成全局音池。 | 每个 Boss/biome profile 单独声明 root、core shell、pressure colors 与禁用音；跨 profile 迁移只能保留结构，不复制绝对音高。 | `ChordShardCloud_CleanGuitarGSharpDenseCloud.mid :: G# profile`; `ChordShardCloud_VoiceOohsFRootDensityMotor.mid :: F root density`; `ChordShardCloud_SynthStringsFMajorShardSectionsWithDrums.mid :: F-A-C shard sections` |
| MUS-SHARD-06 | Dense cloud 可以是 dyad cell，不必总是宽音集或完整三和弦。 | A#-C 这类二音 cell 可以通过 gate、register、density 和 FX 形成高强度 cloud；音高少不等于强度低。 | `ChordShardCloud_PianoASharpCDyadDenseCloud.mid :: A#-C dyad dense cloud`; `ChordShardCloud_SynthStringsFMajorShardSectionsWithDrums.mid :: F-A-C triad shards`; `ChordShardCloud_VoiceOohsFRootDensityMotor.mid :: F/C# windows` |
| MUS-LOW-01 | 低强度暗房间不是“随机少音”，而是受限音集 + 稀疏开场 + section 级增密。 | 开局可用 sparse D#/G# voice/pad 建立悬浮，后续按 8/16/32 小节引入 bass、dense cloud、late motif；不要每小节重抽旋律。 | `Untitled Project (14).mid :: SynthStrings Track 1 bars 0-14`; `Untitled Project (15).mid :: Voice Oohs Track 1-3 bars 1-26`; `Untitled Project (17).mid :: Electric Bass Track 1 bars 16-31` |
| MUS-STEM-02 | 低强度 stem 可以分段入场和返场，制造长时间悬浮结构。 | Pad/voice 先建立身份，bass 先稀疏后增密，dense voice cloud 延迟进入，late top motif 只在后段点缀。 | `Untitled Project (14).mid :: SynthStrings section windows`; `Untitled Project (15).mid :: Voice Oohs Track 4 bars 31-243`; `Untitled Project (17).mid :: Electric Bass section windows`; `Untitled Project (18).mid :: Voice Oohs bars 207-224` |
| MUS-TEMPO-01 | 外部 MIDI 的 tempo meta 需要解析 intro/ramp，但运行层仍归一到单一拍序时钟。 | 新 MIDI 开头有 `165.821 -> 150.031 -> 149.998 BPM`；游戏可支持 intro ramp，但战斗网格不要跟随素材 meta 抖动。 | `Untitled Project (14).mid- (18).mid :: tempo metas 165.821/150.031/149.998`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §1.1`; `节奏塔防_音乐处理对比分析与优化_v0.1.md :: §1.3` |
| MUS-TEMPO-02 | Bass spine motif 必须按 beat slot 表达，可在不同 BPM profile 中重定时。 | Psy Bass Spine 专项素材是 120 BPM，但其 slot 逻辑可迁移到 150 BPM；实现时保留相对拍位，不硬绑定源文件 BPM。 | `PsyBassSpine_VoiceOohsSparseCall.mid`; `PsyBassSpine_VoiceOohsGSharpFSharpAnswer.mid`; `PsyBassSpine_* :: tempo 120 BPM`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §1.1` |
| MUS-PAUSE-01 | Pause Veil 关闭运动层，保留固定层并加效果器。 | hats、acid、roll、riser 停；pulse、root drone、pad 可留；低通、delay、reverb 加重。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4 强度分层 0-5`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §3.1 音轨状态脑暴`; `dark_alchemy_music_layer_demo.js :: updateFx/laneActive` |
| MUS-VALID-01 | 完整规则验证曲必须验证多角色协同，不把单个 stem 当作最终音乐。 | 至少检查 drum grid、fill/accent、root/shard stem、section coverage、duplicate guard；通过标准是角色分工成立，而不是某个音轨单独好听。 | `FullRuleValidation_DrumGridPercussionStem.mid`; `FullRuleValidation_DrumFillAccentStem.mid`; `FullRuleValidation_Lead2GRootShardStem.mid` |
| MUS-VALID-02 | 验证曲的 tempo/root/profile 只证明该 profile 可行，不自动覆盖其他 profile。 | 150 BPM 与 G-root validation 可作为一套 profile 验收；迁移到其他 Boss/biome 时只迁移结构，不复制绝对音高。 | `FullRuleValidation_Lead2GRootShardStem.mid :: G=331`; `FullRuleValidation_DrumGridPercussionStem.mid :: tempo 150 BPM`; `MUS-KEY-01`; `MUS-SHARD-05` |
| MUS-INTENSITY-01 | Intensity 0-5 必须优先实现为同一 profile 内的分层密度递进，而不是 6 首独立 loop。 | `intensityState` 驱动 drumDensity、bassDensity、cloudDensity、cueHandoff；房间身份不因强度切换而断裂。 | `IntensityLadder_DrumGridDensityRamp.mid`; `IntensityLadder_BassFRootDensityRamp.mid`; `IntensityLadder_VoiceOohsFCloudDensityRamp.mid`; `§12` |
| MUS-INTENSITY-02 | 强度变化优先改 role-specific density/gate/stem/effect send，再改音高集合。 | 低到中强度先增加鼓网格、root motor、pad/cloud gate 与 FX send；只有 section 或 Boss profile 变化时才扩大 pitch set。 | `IntensityLadder_BassFRootDensityRamp.mid :: F=987/F#=148`; `IntensityLadder_VoiceOohsFCloudDensityRamp.mid :: F=342 + controlled colors`; `IntensityLadder_DrumGridDensityRamp.mid :: density grows across sections` |
| MUS-INTENSITY-03 | 稀疏 cue/handoff 只负责提示强度或阶段边界，不能误当完整强度层。 | `VoiceOohsFGFinalCue`、`VoiceOohsGLongCueHandoff`、`DrumFillMidHighCue` 应触发/收束其他层，而不是单独代表 intensity 0/5。 | `IntensityLadder_VoiceOohsFGFinalCue.mid`; `IntensityLadder_VoiceOohsGLongCueHandoff.mid`; `IntensityLadder_DrumFillMidHighCue.mid` |
| MUS-FX-01 | Transition FX 必须挂在 phrase/section 边界，不能变成持续前景旋律。 | FX lane 负责连接、预告、爆发、收束；触发窗口优先是 4/8/16/32 小节边界或 Boss 技能前后。 | `FXTransition_DrumSectionFillGrid.mid`; `FXTransition_VoiceOohsSectionHandoffArc.mid`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3` |
| MUS-FX-02 | Tension ramp 可以用固定根音、半音摩擦、低频 stutter 增压，但不得随机走句。 | 失真 F/F# ramp、A# bass pickup/stutter 只能表达“下一段要来了”，不承担主题旋律。 | `FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid :: F=462/F#=75`; `FXTransition_ElectricBassASharpPickupStutter.mid :: A# only pickup` |
| MUS-FX-03 | Long-tail / handoff cue 必须给碰撞反馈留瞬态空间。 | voice-oohs handoff、long-tail cue 可送 reverb/delay/filter，但不能铺满整段高频，也不能和 brick/paddle one-shot 抢频段。 | `FXTransition_VoiceOohsSectionHandoffArc.mid`; `FXTransition_DrumImpactVoiceOohsLongTailCue.mid`; `.cursor/rules/audio.md :: Local sample preview layer` |

## 2. 变体决策树

音乐状态的优先级按下面顺序解析。后面的规则不能推翻前面的硬状态。

```text
Pause Veil?
  yes -> 保留 fixedPulse/fixedDrone/emotionPad，关闭运动 lane，套 pause FX
  no  -> 继续

Boss Profile
  -> 决定 BPM、mode、root、scale、pad timbre、FX 倾向、PhraseBook 候选池

Stage + Intensity
  -> 决定情绪 progression
  -> 决定 chord shell / pedal tone / pad voicing density / pad gate
  -> 对 pad/chord 选择 section shell family：pedal / partial triad / borrowed triad / chord cloud / sparse cue
  -> 决定 lane gate 与 effect send 深度
  -> 对 intensity ladder 选择递进状态：drumDensity / bassDensity / cloudDensity / cueHandoff
  -> 若 intensity <= 1，可进入 low-room sparse profile

4/8 小节 Phrase Window
  -> 在受限 motif bank 中抽下一个 variation
  -> 最后一小节生成 transition

8/16/32 小节 Section Window
  -> 控制 stem 进出、bass 密度、drum fill 家族、chord-shard cloud 开关
  -> 控制 pad/chord handoff、pedal tone、半音邻接 cell 与 voicing density
  -> 对 chord-shard cloud 选择 role split：drum grid / root motor / cloud body / sparse cue
  -> 对 FX/Transition 选择 bridge role：drum fill grid / tension ramp / bass pickup / voice handoff / impact tail
  -> 若是 validation song，检查各角色是否覆盖同一 section map
  -> 对 bass spine 选择 density tier：anchor / offbeat / even-slot / full motor
  -> Boss 阶段优先映射到 section，而不是每拍随机变化

Gameplay Event
  -> 量化到当前 grid/chord
  -> 触发 one-shot phrase 或 anchor
```

来源：

- `dark_alchemy_music_layer_demo.js :: selectEmotion/laneActive/rollVariation/transitionFill/updateFx`
- `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.2 和弦进行是情绪导演`
- `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3 乐句变体与过渡`
- `Untitled Project (4).mid :: SynthStrings 1 section windows`
- `Untitled Project (7).mid :: Electric Bass section windows`
- `Untitled Project (8).mid :: Drums section windows`
- `Untitled Project (14).mid- (18).mid :: low-room complete stem windows`
- `PsyBassSpine_* :: Psy Bass Spine density tiers`
- `PadChordDirector_* :: Pad / 和弦情绪导演 section states`
- `ChordShardCloud_* :: high-intensity shard cloud role split`
- `FullRuleValidation_* :: complete rule validation song`
- `IntensityLadder_* :: intensity 0-5 layered density ramp`
- `FXTransition_* :: section bridge roles`

## 3. 变体族规范

### 3.1 Stage 变体

| Stage | 音乐职责 | 允许打开的变化 | 来源 |
|---|---|---|---|
| Room | 普通房间基底，稳定暗色 groove。 | fixed pulse、root drone、emotion pad、少量 hat/stab；低 intensity 下不强行加 lead。 | `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §2 普通房间`; `dark_alchemy_music_layer_demo.js :: scheduleStep/laneActive` |
| Surge | 高压、连击、多球、危险前摇。 | pressure progression、acid、psy lead、riser、delay/reverb send 增加。 | `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §2 高压房`; `dark_alchemy_music_layer_demo.js :: selectEmotion/scheduleStep` |
| Boss | Boss 仪式与爆发，不只是强度 5。 | boss profile 接管 BPM/mode/effects；高强度进入 frenzy progression、impact、riser。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4.1 Boss 音乐身份`; `dark_alchemy_music_layer_demo_data.js :: styles` |

### 3.2 Intensity 变体

| Intensity | 当前规范 | 变体限制 | 来源 |
|---|---|---|---|
| 0 | 暗色脉冲、稀疏 voice/pad、root/drone。 | 反单调优先靠 gate、stem 进出、滤波/相位/混响；音集受限在当前 profile，不急着换完整和弦。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4 强度分层 0-5`; `Untitled Project (14).mid :: Track 1 G#3/G#2/D#5`; `Untitled Project (15).mid :: Track 1-3 D#5 sparse voice` |
| 1 | 加 low bass spine、短高音 ghost 或稀疏 fill。 | 高频短、轻、可限流；bass 可以先只跑 G# root offbeat，再在后续 section 增密。 | 同上；`.cursor/rules/audio.md :: Local sample preview layer`; `Untitled Project (17).mid :: Track 1 G#1 slots 2/6/10/14`; `Untitled Project (18).mid :: late top motif` |
| 2 | 加暗色 pad/snare/stab。 | 和声开始承担情绪，不靠 lead 填空。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.2`; `§4` |
| 3 | 连击层、acid、ghost perc。 | 只在里程碑或 stage 条件下显著变化。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4`; `§5` |
| 4 | 高频 roll、riser、滤波打开。 | Lead 进入但必须短手势化。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.1`; `§4` |
| 5 | Drop/Frenzy，全频爆发。 | 保留碰撞瞬态空间，混响尾巴不能糊住砖块反馈。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4`; `节奏塔防_音源调研_v0.1.md :: §2.3` |

MIDI-derived intensity ladder 限制：

| 规则 | 说明 | 来源 |
|---|---|---|
| Layered ramp, not song swap | Intensity 0-5 是同一 profile 内的层级递进；低强度保留稀疏 pulse/cue，中强度加 drum/bass motor，高强度加 cloud/fill，换档不能像切到另一首歌。 | `IntensityLadder_DrumGridDensityRamp.mid`; `IntensityLadder_BassFRootDensityRamp.mid`; `IntensityLadder_VoiceOohsFCloudDensityRamp.mid` |
| Density before pitch | 强度上升先改密度、gate、stem 进出、FX send。F profile 中 bass 以 F 为重心，F#、E、C# 等只作压力色；voice cloud 同理以 F 为重心。 | `IntensityLadder_BassFRootDensityRamp.mid :: F=987/F#=148/E=10`; `IntensityLadder_VoiceOohsFCloudDensityRamp.mid :: F=342 + colors` |
| Cue is a handoff lane | 稀疏 F/G/G long cue 与 drum fill 用来提示 section 或强度边界，不单独承担完整 groove。 | `IntensityLadder_VoiceOohsFGFinalCue.mid`; `IntensityLadder_VoiceOohsGLongCueHandoff.mid`; `IntensityLadder_DrumFillMidHighCue.mid` |

### 3.3 情绪和弦变体

| 情绪 ID | Progression | 触发逻辑 | 用途 | 来源 |
|---|---|---|---|---|
| suspended | `i5 drone` | pause 或 intensity <= 1 | 低强度、暂停、入房待机。 | `dark_alchemy_music_layer_demo_data.js :: emotions.suspended`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.2` |
| darkStable | `i - bII - i - VII` | room 且 intensity 2 左右 | 暗色稳定循环。 | `dark_alchemy_music_layer_demo_data.js :: emotions.darkStable` |
| pressure | `i - bII - i - V7` | surge 或 intensity >= 3 | 高压、多球、连击升温。 | `dark_alchemy_music_layer_demo.js :: selectEmotion`; `dark_alchemy_music_layer_demo_data.js :: emotions.pressure` |
| bossRitual | `i - bII - V7 - i` | boss 中低强度 | Boss 仪式感、阶段问答。 | `dark_alchemy_music_layer_demo_data.js :: emotions.bossRitual` |
| frenzy | `i - bII - dim - V7` | boss 且 intensity >= 4 | 爆发、濒危、Drop。 | `dark_alchemy_music_layer_demo.js :: selectEmotion`; `dark_alchemy_music_layer_demo_data.js :: emotions.frenzy` |

限制：

- Progression 由情绪轴决定，Boss profile 不应直接覆盖情绪轴，只改变风味。
- Pad 音色、voicing、滤波、phase/reverb 可以随 Boss 或 biome 改变。
- 低 intensity 反单调优先改 gate、滤波、phase、voicing 稀疏度，不随机换和弦。

MIDI-derived pad/chord 限制：

| 规则 | 说明 | 来源 |
|---|---|---|
| Section state first | 先决定情绪状态，再在该状态内生成 voicing/gate/filter 变体；不要把 chord progression 当每小节抽卡。 | `PadChordDirector_SynthStringsDSharpPedalSectionArc.mid :: bars 0-21 / 23-32 / 35-49 / 55-148 section windows`; `PadChordDirector_VoiceOohsGSharpMinorThirdArc.mid :: bars 68-147 G#-B shell` |
| Partial shell is valid | 低强度和暗色段落可以只露出 root、third、fifth 或两个邻接色彩音；玩家不需要一直听到完整和弦拼写。 | `PadChordDirector_VoiceOohsGSharpMinorThirdArc.mid :: G#-B minor third`; `PadChordDirector_VoiceOohsSparseCadenceCue.mid :: G / D / D-F sparse cue` |
| Chromatic cell means pressure | 半音邻接比大幅换和弦更适合表达不安、腐化、炼金反应临界。 | `PadChordDirector_CleanGuitarGSharpChromaticCell.mid :: G/G#/B`; `PadChordDirector_VoiceOohsGOffbeatResolution.mid :: B/C and D/D# windows`; `PadChordDirector_SynthStringsDSharpPedalSectionArc.mid :: D-D#-F-G windows` |
| Pad gate is an arrangement parameter | Pad 可以通过 0.5/0.25 beat gate 产生律动，不必总是无限长尾；但 gate 变化不能脱离同一拍序时钟。 | `PadChordDirector_SynthStringsDSharpPedalSectionArc.mid :: D# 0.5 beat gate`; `PadChordDirector_MutedGuitarGRootMotor.mid :: 0.25 beat G2 motor`; `PadChordDirector_DrumPulseGrid.mid :: shared pulse grid` |
| Borrowed triad section windows | 情绪导演可以在 section 级切换 borrowed triad / shell family，而不是逐小节随机重抽和弦。 | `PadChordDirector_SynthStringsBorrowedTriadSectionArc.mid :: C-D#-G# and A#-D#-G cluster windows` |
| F chord cloud with root gravity | F-profile 的 dense pad/chord body 可以很密，但 F/C 要保持身体重心；A/G#/D#/A#/G 等只作为明暗、腐化和借用色。 | `PadChordDirector_SynthStringsFChordCloudBody.mid :: F=603/C=260`; `PadChordDirector_SynthStringsFChordCloudBody.mid :: C-F-F / A-C-F / C-F-G# clusters` |
| Sparse cue is not a chord | G cue、D# pedal 这类单音层负责提示和交接，不直接替代 progression。 | `PadChordDirector_VoiceOohsGSparseCue.mid`; `PadChordDirector_VoiceOohsDSharpPedalGate.mid` |

### 3.4 Boss 风味变体

| Boss Profile | BPM / Mode | 风味职责 | 效果器与音色 | 来源 |
|---|---|---|---|---|
| Crucible | 128 / Phrygian | 炼金机器、金属循环。 | saw pad、filter、duck、短 rumble。 | `dark_alchemy_music_layer_demo_data.js :: styles.crucible`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4.1` |
| Venom | 140 / Aeolian Trap | 毒性、慢摆、腐蚀玻璃。 | bandpass、slime delay、filtered noise。 | `dark_alchemy_music_layer_demo_data.js :: styles.venom`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §4 毒晶温室` |
| Aether | 172 / Fast DnB | 多球狂暴、高速 sparkle。 | fast hats、短 delay、频闪式高通。 | `dark_alchemy_music_layer_demo_data.js :: styles.aether`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §4 以太锻炉` |
| Gothic | 140 / Harmonic Minor | 古堡仪式、Boss 宣判。 | organ-like pad、half-time verb、低频 impact。 | `dark_alchemy_music_layer_demo_data.js :: styles.gothic`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §4 古堡反应釜` |
| Dark Psy | 150 / Occult Phrygian | 夜场炼金阵、滚动低频、高压迷幻。 | light drive、reverb throw、resonant bandpass、FM/acid lead 手势。 | `dark_alchemy_music_layer_demo_data.js :: styles.darkpsy`; `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.1`; `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §4 夜场炼金阵` |

限制：

- Boss profile 至少控制 `tempo / mode / root / lane recipe / effect sends / PhraseBook`，不能只换一两个 one-shot。
- 同一情绪 progression 在不同 Boss 下应听起来像不同“风味”，但不能改变 stage/intensity 的情绪职责。

### 3.5 Lead 与 Phrase 变体

当前 demo 已有 `squelch / laser / throat / scrape` 四类 lead timbre gesture，但 MIDI 分析后需要把它们收束到更严格的 motif 规范中。

MIDI-derived 限制：

| 规则 | 说明 | 来源 |
|---|---|---|
| Transposable center | F center 只是一组参考，不是 dark psy 的唯一根音。所有 motif 必须用相对音程存储，再由 boss/biome profile 转调。 | `Untitled Project (2).mid :: F=1024`; `Untitled Project (3).mid :: F=2067`; `Untitled Project (7).mid :: G#=564/F#=427/D#=299`; `Untitled Project (5).mid :: B/D#/F#/G#/C#/A#` |
| F Phrygian-ish profile | 第一批 MIDI 可保留 F、F# 半音摩擦，C#/D# 结构过渡，G# pad 色彩。 | `Untitled Project (2).mid :: String Ensembles 1`; `Untitled Project (3).mid :: Lead 2`; `Untitled Project.mid :: Voice Oohs，G#3=479` |
| G# minor/bVII profile | 第二批 MIDI 更偏 G# minor / bVII / III：核心集合为 G#、A#、B、C#、D#、F#，E 几乎不用。 | `Untitled Project (7).mid :: Electric Bass`; `Untitled Project (5).mid :: Voice Oohs Track 4`; `Untitled Project (9).mid :: Voice Oohs late top motif` |
| Low-room G# profile | 完整低强度暗房间仍以 G# minor/bVII 集合为主，但开场使用 D#5 voice 与 G# pad 做稀疏悬浮。 | `Untitled Project (14).mid :: Track 1 G#3/G#2/D#5`; `Untitled Project (15).mid :: Track 1-3 D#5`; `Untitled Project (17).mid :: G#/F#/D#/B bass roots`; `Untitled Project (18).mid :: A#/D#/F#/G#/C#/B` |
| Psy bass spine study | 专项素材以 G# root lock 为主，120 BPM；G# 可在低频 bass 与中高频 ghost 中镜像，F#/A#/B/C# 作为回答色。 | `PsyBassSpine_ElectricBassRootMotor.mid :: G#=796`; `PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid :: G#4=165`; `PsyBassSpine_VoiceOohsSparseCall.mid :: G#/A#/B/C#`; `PsyBassSpine_VoiceOohsGSharpFSharpAnswer.mid :: G#/F#` |
| Offbeat bass spine | Psy bass 的稳定骨架可以是每拍后半的 `2/6/10/14` slot，而不是正拍长音。 | `Untitled Project (7).mid :: Track 1，G#1 slot16Top 2/6/10/14`; `Untitled Project (7).mid :: Track 5，slot16Top 2/6/10/14` |
| Spine density ladder | spine 有密度层级：`0/4/8/12` anchor、`2/6/10/14` offbeat、`0/2/4/6/8/10/12/14` even-slot motor、全 16 分 stutter。 | `PsyBassSpine_DrumAnchorGrid.mid :: drum anchors`; `PsyBassSpine_ElectricBassRootMotor.mid :: bass motor`; `PsyBassSpine_DrumMusicBoxDenseMotor.mid :: dense motor`; `PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid :: offbeat ghost` |
| Chord-shard cloud | 高强度 lead/voice 层可以极密，但音高应锁在 chord shell/dyad/triad，不走随机旋律。 | `Untitled Project (5).mid :: Track 4，4042 notes`; `Untitled Project (5).mid :: chords G#-B、D#-B、F#-A#、C#-F#-A#` |
| High-intensity shard role split | 高强度 cloud 至少拆为 pulse grid、root motor、dense cloud body 与 sparse cue/handoff；这些角色可以同时出现，但不能互相替代。 | `ChordShardCloud_DrumHighIntensityPulseGrid.mid`; `ChordShardCloud_FretlessBassGSharpDensityMotor.mid`; `ChordShardCloud_CleanGuitarGSharpDenseCloud.mid`; `ChordShardCloud_VoiceOohsCtoGSectionCue.mid` |
| Root-gravity dense cloud | Dense cloud 可使用宽色彩集，但仍要有 root gravity。G# profile 中，G# 是重心，D#/E/A#/B/G/C#/A/F# 是受控压力色。 | `ChordShardCloud_CleanGuitarGSharpDenseCloud.mid :: G#=1042`; `ChordShardCloud_FretlessBassGSharpDensityMotor.mid :: G#=1160`; `ChordShardCloud_VoiceOohsGSharpOffbeatCue.mid :: G# only` |
| Quarter drum anchors | 鼓组主落点锁在 `0/4/8/12`，transition 才加入 pickup/fill。 | `Untitled Project (8).mid :: Drums slot16Top 0/4/8/12`; `Untitled Project (6).mid :: Drum fill bars 156-157` |
| Rhythm over pitch | 变化主要来自 gate、密度、八度、slot、效果器和 stem 进出，而不是随机音级。 | `Untitled Project (3).mid :: Lead 2 common bar slots/durations`; `Untitled Project (5).mid :: Track 4 durTop 0.248/0.494`; `Untitled Project (8).mid :: Drums section windows` |

推荐 motif bank：

| Motif | 音高边界 | 可变项 | 用途 |
|---|---|---|---|
| offbeatRootSpine | `root` on slots `2/6/10/14` | gate、重复次数、低通开合、轻 saturation | low lane 的 psy 推进骨架 |
| spineDensityLadder | `root`，按 tier 切换 slot set | anchor/offbeat/even/full、gate、octave、filter | 从低强度到高压的 bass 推进曲线 |
| octaveMirrorGhost | `root` 在中高 register 镜像 | 音量、滤波、delay、短 gate | 不改变和声的情况下让 spine 更迷幻 |
| lowRoomSparseCall | `root / 5 / color tone` 的稀疏 call | register、gate、filter、phase、reverb、stem enter/exit | intensity 0-1 的房间待机与暗色悬浮 |
| minorChordShard | `root / b3 / 5` 与当前 chord shell | 密度、八度、stutter、delay/reverb send | 高强度 chord-shard cloud |
| chordShardCloudBody | profile pitch set，强 root gravity | density、cluster size、register spread、send、stutter | intensity 4-5 的密音主体，不由单次碰撞直接逐音触发 |
| shardRootMotor | `root / 5 / controlled color`，root 权重最高 | gate、density tier、filter、octave | 给 cloud body 提供低/中频重心，防止密音漂浮 |
| shardCueHandoff | `root` 或 `root -> 5` / `bVI -> root` 稀疏 cue | 8/16/32 小节进入点、reverb throw、尾音长度 | cloud 开始、收束、Boss 阶段切换提示 |
| bVIIAnswer | `bVII / 2 / 4` 或 bVII major shell | 8/16 小节段落切换、answer phrase | G# profile 中的 F# major 质感，或任意 profile 的 bVII 回答 |
| bVIbVIIPickup | `bVI -> bVII -> root` | 最后一小节位置、尾音 impact、reverb throw | 第一批 F profile 的 transition 语法 |
| b2Sting | `root -> b2 -> root` | 很短的 pitch bend、filter sweep、失真 | Phrygian profile 专用紧张刺点，不能全局滥用 |
| colorDroneGate | profile color tone，例如 F profile 的 G# 或 G# profile 的 B/D# | phaser/reverb/filter movement、门控节奏 | pad/voice 空灵迷幻质感 |

禁止项：

- 不用全音阶随机走句生成 psy lead。
- 不让 lead 在低 intensity 0-1 长时间占据前景。
- 不把 transition 当成新旋律入口，transition 只负责连接上一句和下一句。
- 不把所有碰撞都映射成 lead，碰撞优先触发短 one-shot phrase 或 density anchor。
- 不把某一批 MIDI 的绝对根音当成全局根音；只能把它注册成一个 profile。
- 不把 bass spine 写成固定数组后永远重复；至少要有 density tier 与 section 级切换。
- 不把 chord-shard cloud 写成“随机音雨”；它必须有 root gravity、受限 pitch set、role split 与限流。
- 不把 duplicate MIDI 当成额外样本重复加权；duplicate 只保留溯源，不增加规则可信度。

### 3.6 Transition 变体

| Transition | 触发 | 做法 | 来源 |
|---|---|---|---|
| Riser + pickup | 4/8 小节最后半小节 | noise sweep + `C# -> D# -> F` 或 `F# -> F` pickup。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3`; `Untitled Project (3).mid :: Lead 2`; `dark_alchemy_music_layer_demo.js :: transitionFill` |
| Delay/reverb throw | 上一句最后一个 stab/lead | 只把尾音送入 delay/reverb，不新增长旋律。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3`; `dark_alchemy_music_layer_demo.js :: out/updateFx` |
| Kick removal | 新 phrase 前半小节 | 暂时减少低频落点，让下一拍更重。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3`; 上游 `Trance music`/EDM tension 资料摘要见同章节 |
| Crash/impact | 新 phrase 第一拍 | impact 或低频 thump 接住新段落。 | `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.3`; `dark_alchemy_music_layer_demo.js :: impact` |
| Two-bar drum fill | section 末端或 Boss 技能前 | 少量高频/FX drum hit 放在 `2/6/10/14`，制造连续推进但不抢主 pulse。 | `Untitled Project (6).mid :: Track 1，D#6 bars 156-157 slots 2/6/10/14` |
| Chord-shell handoff | 新 section 前后 | 上一段 chord shell 逐步减少，新段 bVII/III/minor shell 接入。 | `Untitled Project (4).mid :: SynthStrings 1 section windows`; `Untitled Project (5).mid :: Voice Oohs dyad/triad cloud` |
| Drum section fill grid | 8/16/32 小节边界、强度提升或 Boss 技能前 | 用 drum lane 形成分段 fill grid；主锚点仍贴 `0/4/8/12`，局部加入细分和低鼓叠层。 | `FXTransition_DrumSectionFillGrid.mid :: A#5=441/A2=64/A#2=31` |
| Semitone tension ramp | drop、danger、boss warning 前 | 固定 F root，用 F/F# 半音摩擦和失真音色制造紧张；它是 ramp，不是 lead melody。 | `FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid :: F=462/F#=75` |
| Bass pickup stutter | 新 section 前 1-4 小节 | 单一 A# 低频 stutter/pickup 推向落点，可与 impact 或 kick 回归相连。 | `FXTransition_ElectricBassASharpPickupStutter.mid :: bars 111-123, A# only` |
| Voice section handoff | 和声状态切换前后 | voice-oohs 在 C/F、F#/C、F、B/F 等受控集合间桥接，负责空间和和声胶水，不响应单次碰撞逐音触发。 | `FXTransition_VoiceOohsSectionHandoffArc.mid :: section windows bars 0-129` |
| Impact + long tail | 新 section 第一拍或清场/危险提示 | drum impact 接落点，voice long-tail 负责尾部空间；尾音可送 reverb/delay，但必须给砖块反馈留空间。 | `FXTransition_DrumImpactVoiceOohsLongTailCue.mid :: A#4/A#5 impacts + D/E voice tails` |

## 4. 低强度反单调规则

低 intensity 的问题不是“东西太少”，而是“变化维度太单”。处理顺序如下：

1. 先锁 profile 音集：root、五度、b3/bVII 或当前 profile color tone，让房间“活着但没醒”。
2. 优先做音色微变：filter cutoff、pad phase/allpass、轻微 detune、noise texture。
3. 再做效果器微变：短 delay send、reverb size/wet、lowpass veil 深度。
4. 再做时值微变：gate 长短、休止、弱拍 ghost，不改变主 beat grid。
5. 再做 bass offbeat gate 变化：保留根音和 `2/6/10/14` 脊柱，只改长短、滤波和少量 ghost。
6. 再做 stem 分段入场：不要开局全层齐上，允许 dense voice cloud、bass 增密或 late top motif 在 16/32 小节后才出现。
7. 最后才做音高变化：只允许围绕当前 chord/root 的邻近音或固定 motif。

来源：

- `dark_alchemy_breakout_music_system_notes_v0.1.md :: §4 强度分层 0-5`
- `dark_alchemy_breakout_music_system_notes_v0.1.md :: §3.1 Dark Psytrance 音色参考`
- `dark_alchemy_breakout_music_brainstorm_v0.1.md :: §3.1 音轨状态脑暴`
- `dark_alchemy_music_layer_demo.js :: padChord/updateFx`
- `Untitled Project (7).mid :: Track 1/5 offbeat bass spine`
- `Untitled Project (14).mid- (18).mid :: low-room complete stems`

## 5. 当前 demo 与下一步差异

当前 demo 已验证：

- `styles` 可以承载 Boss 风味。
- `emotions` 可以承载 stage/intensity 情绪 progression。
- `laneDefs` 可以展示 fixed/stage/boss/phrase/fx 的分层。
- `pauseVeil` 可以作为独立音乐状态。
- 4/8 小节 phrase window 与 transition 已有雏形。

当前 demo 需要收束：

- `leadPatterns` 仍是通用 timbre gesture，下一版应替换或映射为 MIDI-derived motif bank。
- Dark Psy 当前 root 不应只校准到 F center；应支持 profile root，例如 `F Phrygian-ish` 与 `G# minor/bVII` 两组 dark psy profile。
- `rollVariation()` 应只在受限 motif pool 内改变 rhythm/octave/filter/effects，不再随机选择会改变旋律感的 pattern。
- `transitionFill()` 应优先使用 `C# -> D# -> F` 或 `F# -> F` 的固定转场语法。
- 需要新增或拆分 `bassSpine`、`chordShard`、`sectionWindow` 概念，否则 demo 只能展示短 phrase，不能展示第二批 MIDI 里的 8/16/32 小节编曲推进。
- 需要新增 `lowRoomSparse` 低强度 profile：支持 G# minor/bVII 受限音集、稀疏 D# voice/pad 开场、bass 分段增密、late top motif、tempo meta 归一化。

来源：

- `dark_alchemy_music_layer_demo_data.js :: leadPatterns/styles.darkpsy`
- `dark_alchemy_music_layer_demo.js :: rollVariation/transitionFill/psyLead`
- `Untitled Project (2).mid :: String Ensembles 1`
- `Untitled Project (3).mid :: Lead 2 (sawtooth)`
- `Untitled Project (5).mid :: Voice Oohs Track 4`
- `Untitled Project (7).mid :: Electric Bass`
- `Untitled Project (8).mid :: Drums`
- `Untitled Project (14).mid- (18).mid :: low-room complete stems`

## 6. 第二批 MIDI 分析摘录

第二批文件同样是 150 BPM psy trance 素材，但它与第一批的 F Phrygian-ish 参考不同，整体更接近 G# minor / bVII / III 的暗色语汇。

| 文件 | 轨道身份 | 关键观察 | 推导出的规范 |
|---|---|---|---|
| `Untitled Project (4).mid` | `SynthStrings 1` 多段 pad/chord stem | Track 1 bars 0-14 以 G#3/D#5 开场；Track 9 bars 131-167 集中 C#/F#/D#/A/G#；Track 13 bars 205-247 集中 F#/A#/C#/D#/G#。 | Pad/chord 变化按 section 进入，不应每小节乱换；可用 bVII/III/chord shell 做 Boss 阶段风味。 |
| `Untitled Project (5).mid` | `Voice Oohs` dense chord-shard / lead cloud | Track 4 bars 30-243 有 4042 notes；核心音集合 B、D#、F#、G#、C#、A#；常见 dyad/triad 包括 G#-B、D#-B、F#-A#、C#-F#-A#。 | 高强度“密”可以来自 chord-shard cloud，但 pitch set 必须受 profile/chord 锁定。 |
| `Untitled Project (6).mid` | 极短 drum fill | 仅 6 个 D#6 drum notes，bars 156-157，slot 2/6/10/14。 | transition fill 可以很少，但放在稳定 pickup slots 上会很有效。 |
| `Untitled Project (7).mid` | `Electric Bass (finger)` bass spine | Track 1 bars 16-31 是 G#1 offbeat slots 2/6/10/14；Track 2/3/5 在 G#/F#/D# 间做 section-level root motion。 | Psy bass 应保留 offbeat spine；根音变化是 section/phrase 级，不是碰撞级。 |
| `Untitled Project (8).mid` | Drums | 主落点高度集中在 slot 0/4/8/12；bars 15-79、103-175、190-247 分段进入；少数 fill 落在 2/6/10/14。 | Drum lane 应拆 main anchors 与 fill family；intensity 提升优先增加 fill 密度。 |
| `Untitled Project (9).mid` | late top motif / voice phrase | bars 207-224，高音集合 A#/D#/F#/G#/C#/B，时值多为 0.754、0.781、0.248、0.494 beat。 | 高音 phrase 可以作为 late-section garnish，少量进入，不应从开局常驻。 |

这批 MIDI 的总体结论：

- Tempo 元信息先有 `165.821 BPM @ tick 0`，随后在 `tick 480` 切到约 `150.031 BPM`，`tick 15360` 稳到 `149.998 BPM`。实现时要支持 intro tempo ramp 或至少不要假设第一个 tempo meta 就是最终主 BPM。
- 主体不是 Phrygian b2，而是 G# minor-ish：核心集合 `G# / A# / B / C# / D# / F#`，E 很少出现。
- 低频推进不是长 drone，而是 offbeat bass spine。
- 高强度 lead 更像 chord-shard cloud，不是 singable melody。
- 编曲变化依赖 stem windows：bass、drum、pad、voice cloud 在不同 bar 区间进入、退出和增密。

## 7. 低强度暗黑房间完整 MIDI 分析摘录

`Untitled Project (14).mid` 到 `(18).mid` 是当前有效的低强度暗黑房间 Loop 参考。它修正了上一次只看 drum/stem zip 时得到的误判：完整素材不是单根音 D# 场，而是一个 G# minor/bVII 语汇下的稀疏开场、分段增密和后段点缀。

| 文件 | 轨道身份 | 关键观察 | 推导出的规范 |
|---|---|---|---|
| `Untitled Project (14).mid` | `SynthStrings 1` pad/chord stem | Track 1 bars 0-14 以 G#3/G#2 与 D#5 建立悬浮；Track 5 在 bars 48/54 有全音级式 burst；Track 10 bars 131-172 偏 F#/C#/D#/A#；Track 14 bars 205-248 回到 F#/D#/C#/A#/G#。 | 低强度开场可以稀疏，但后续 pad/chord 仍要有 section 级色彩变化；不能把它简化成单根音 drone。 |
| `Untitled Project (15).mid` | `Voice Oohs` sparse call + dense cloud | Track 1-3 在 bars 1-26 只有 D#5 稀疏 call；Track 4 bars 31-243 有 3195 notes，核心音集合 D#、B、C#、G#、F#、A#；常见 dyad 包括 G#-B、G#-A#、C#-F#。 | 低强度可以先用极少 call 建身份，再延迟打开 dense chord-shard cloud；密音必须被 profile/chord shell 锁住。 |
| `Untitled Project (16).mid` | short drum fill | 仅 4 个 D#6 drum notes，bars 156-157，slot `6/10/14`。 | transition/fill 可以非常少，只要落在稳定 pickup slots 上就能提示段落变化。 |
| `Untitled Project (17).mid` | `Electric Bass (finger)` bass spine | Track 1 bars 16-31 是 G#1 offbeat slots `2/6/10/14`；Track 2 bars 40-80 变成密集 G#/D#/F#；Track 3 bars 111-174 以 F#/D#/G# 做 section root motion；Track 5 bars 208-247 回到 G#/F#/D# 的较稀疏 spine。 | 低强度 bass 不只是 root drone，而是从稀疏 offbeat spine 逐步走向 section-level 增密，再回到可读脊柱。 |
| `Untitled Project (18).mid` | late top motif | bars 207-224，高音集合 A#、D#、F#、G#、C#、B；slot 主要在 `0/4/8/12`，少量 `14/1/10`。 | 高音 motif 应作为 late-section garnish，不应在开局常驻；适合清房前、房间成熟或轻微危险提示。 |

这批 MIDI 的总体结论：

- 低强度不等于“只有少量鼓”或“单根音不动”，而是少层、慢入场、受限音集和 section 级密度变化。
- 开场可以非常克制：G#/D# pad 与 D# voice call 已足够建立暗房间身份。
- Bass 是低强度生命线：先用 G#1 offbeat spine，再在 section 中增密，最后回到可读脊柱。
- Dense cloud 可以存在，但它应延迟进入，并锁在 G# minor/bVII profile 的 pitch set 内。
- 这批 MIDI 同样包含 `165.821 -> 150.031 -> 149.998 BPM` 的 tempo meta。实现时可把它解释为 intro ramp，但战斗运行层仍以单一拍序网格为准。

## 8. Psy Bass Spine 专项 MIDI 分析摘录

这批样本不用于照抄旋律，而用于修正 bass spine、drum anchor、中高频 ghost mirror 与 section density 的生成规范。所有文件均解析为 `120 BPM`，后续运行时应按 beat slot 重定时到对应 Boss/biome profile。

| 文件 | 轨道身份 | 关键观察 | 推导出的规范 |
|---|---|---|---|
| `D:/Downloads/PsyBassSpine_VoiceOohsSparseCall.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `cab461699a78` | Voice Oohs sparse call | 60 notes；主音高为 G#、A#，少量 B/C#；主要分布在 bars 55-121；slot 以 `0/8/12/14/2/10` 等稀疏点为主。 | `MUS-BASS-03`：A#/B/C# 可作为根音周边的回答色彩，不应驱动低频根音持续游走。 |
| `D:/Downloads/PsyBassSpine_VoiceOohsGSharpFSharpAnswer.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `81332a3600e4` | Voice Oohs G#/F# answer | 68 notes；G# 与 F# 接近等量；多为 2 拍长音；bars 48-96；主要落在 `0/8` 与 `2/10`。 | `MUS-BASS-03`、`bVIIAnswer`：bVII 回答应是 section 级慢变化，而不是每拍旋律随机。 |
| `D:/Downloads/PsyBassSpine_DrumAnchorGrid.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `56838ed3d060` | Drum anchor grid | 398 drum notes；quarter anchor 明显集中在 slot `0/4/8/12`；后段加入 `2/6/10/14` pickup。 | `MUS-BASS-02`、`MUS-DRUM-01`：drum 先建立网格，bass density 切换应吸附到这个网格。 |
| `D:/Downloads/PsyBassSpine_ElectricBassRootMotor.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `9f7bd3ce895f` | Electric Bass root motor | 823 notes；G#=796；主要在 G#1/G#2；Track 2 覆盖 bars 16-127；包含 even-slot 与 full 16th motor。 | `MUS-BASS-02`、`MUS-BASS-03`：psy bass 的核心是 root lock + density ladder，而不是复杂音高旋律。 |
| `D:/Downloads/PsyBassSpine_TinyDrumFill.mid`<br>原始名：`Untitled Project (21).mid`<br>SHA1: `85ec6fcbed01` | Tiny drum fill | 4 drum notes；bars 117-119；slot `14/0/2`。 | `MUS-DRUM-01`、§3.6：过渡 fill 可以极小，只要落在 phrase 边界附近即可成立。 |
| `D:/Downloads/PsyBassSpine_DrumMusicBoxDenseMotor.mid`<br>原始名：`Untitled Project (22).mid`<br>SHA1: `b87e3e1d27e0` | Drum + Music Box dense motor | Drums 在 bars 0-17 提供 quarter anchors；Music Box 以 G#、D、B、A# 形成 0.25 拍密集 motor；后段 bars 97-105 返场。 | `MUS-SHARD-01`、`MUS-BASS-02`：中高频密音可镜像 bass spine，但必须锁在 profile tone set 内。 |
| `D:/Downloads/PsyBassSpine_VoiceOohsGSharp4OffbeatGhost.mid`<br>原始名：`Untitled Project (23).mid`<br>SHA1: `7dd5cd36c18f` | Voice Oohs G#4 offbeat ghost | 165 notes，全部 G#4；slot `2/6/10/14` 占主导，也有 `0/4/8/12` anchor；覆盖 bars 13-124。 | `MUS-BASS-01`、`MUS-BASS-03`：offbeat spine 可以在中高 register 做 ghost mirror，用来增加迷幻感而不改和声。 |

Bass spine density ladder 的当前推荐定义：

| Tier | Slot set | 用途 |
|---|---|---|
| Anchor | `0/4/8/12` | 低强度、暂停后恢复、房间开局，先建立身体感。 |
| Offbeat | `2/6/10/14` | 标准 psy 推进；适合 intensity 1-2 或暗色稳定 room。 |
| Even-slot motor | `0/2/4/6/8/10/12/14` | 中高压推进；适合连击、多球、Boss 阶段推进。 |
| Full motor/stutter | 16 分全 slot 或局部重复 | intensity 4-5、drop、frenzy；必须配合 sidechain、短 gate 与限流。 |
| Register mirror | root 的 G#3/G#4 等中高 register ghost | 不新增和声，只用短 gate、delay、filter、reverb 增加迷幻层。 |

实现约束：

- 这批素材的 `120 BPM` 是来源 tempo，不是项目全局 tempo。运行层只保留 beat slot 和 density tier。
- G# root lock 是这个专项 profile 的结论，不能推成所有 Boss 的固定根音；其他 Boss 需要自己的 root/profile。
- 中高频 ghost mirror 必须低音量、短 gate、可滤波，不能挤占 brick/paddle 的反馈空间。
- Bass spine 的变化优先级为 `density -> gate -> filter/effect -> octave/register -> pitch color`，pitch color 永远最后。

## 9. Pad / 和弦情绪导演专项 MIDI 分析摘录

这批样本用于补齐 `MUS-CHORD-*` 的来源。它们并不全是 pad/chord 本体，其中 drum 与 guitar cell 是情绪导演的支撑层：drum 提供 gate grid，guitar/motor 提供 tension cell，SynthStrings/Voice Oohs 提供和声状态。

| 文件 | 轨道身份 | 关键观察 | 推导出的规范 |
|---|---|---|---|
| `D:/Downloads/PadChordDirector_VoiceOohsGSharpMinorThirdArc.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `1039158f3c49` | Voice Oohs 情绪弧 | 120 BPM；151 notes；前段 bars 48-63 使用 D/F/C/B/G 等悬疑色彩，bars 68-147 长时间稳定到 G#-B minor-third shell。 | `MUS-CHORD-02`、`MUS-CHORD-03`：情绪可以从不稳定 color set 渐入稳定 partial shell，而不是直接完整和弦循环。 |
| `D:/Downloads/PadChordDirector_DrumPulseGrid.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `54d9230c5dc1` | Drum pulse grid | 120 BPM；972 drum notes；slot `0/4/8/12` 是主锚点，`6/7/10/11` 等细分点提供推进。 | `MUS-CHORD-04`：pad gate 与 chord stab 应依附共享 pulse grid，避免和战斗时钟脱钩。 |
| `D:/Downloads/PadChordDirector_MutedGuitarGRootMotor.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `0ecee6a995a5` | Muted guitar root motor | 120 BPM；1768 notes；G2=1711；少量 F、G#、B 作为色彩；多段 0.25/0.208 beat gate 覆盖 bars 16-147。 | `MUS-CHORD-04`：和声支撑层可以是被 gate 的 root motor，色彩音只在 section 节点上改变情绪。 |
| `D:/Downloads/PadChordDirector_CleanGuitarGSharpChromaticCell.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `1b6c7d242ff9` | Clean guitar chromatic cell | 120 BPM；284 notes；G# / G / B 构成半音邻接 + third color；bars 18-23、32-47、112-119 返场。 | `MUS-CHORD-03`：半音邻接 cell 可表达 pressure/corruption，不需要换成大段旋律。 |
| `D:/Downloads/PadChordDirector_CleanGuitarGSharpChromaticCell_Duplicate.mid`<br>原始名：`Untitled Project (21).mid`<br>SHA1: `1b6c7d242ff9` | Duplicate of chromatic cell | 与 `PadChordDirector_CleanGuitarGSharpChromaticCell.mid` 完全相同。 | 作为重复导出记录保留；后续训练或规则提炼只计一次，避免重复加权。 |
| `D:/Downloads/PadChordDirector_SynthStringsDSharpPedalSectionArc.mid`<br>原始名：`Untitled Project (22).mid`<br>SHA1: `03da0b54938d` | SynthStrings pad/chord section arc | 120 BPM；680 notes；D# pedal 占主导；bars 0-21 有 G/B/A#/G# 色彩，bars 23-32 出现 D-D#-F-G 窗口，bars 35-148 大量 D# gate/pedal 返场。 | `MUS-CHORD-02`、`MUS-CHORD-03`、`MUS-CHORD-04`：pad/chord 的核心是 section state、pedal tone 与 voicing density。 |
| `D:/Downloads/PadChordDirector_VoiceOohsSparseCadenceCue.mid`<br>原始名：`Untitled Project (23).mid`<br>SHA1: `adf5e1353970` | Sparse cadence cue | 120 BPM；6 notes；bars 18/36/54 分别给出 G、D、D-F。 | `MUS-CHORD-03`：极少量 sparse cue 可以承担低强度情绪提示，不必填满 pad。 |
| `D:/Downloads/PadChordDirector_VoiceOohsGOffbeatResolution.mid`<br>原始名：`Untitled Project (24).mid`<br>SHA1: `6f9ede213388` | Voice Oohs offbeat resolution | 120 BPM；119 notes；早段 D/F/D#/G#，中段 B/C 与 D#/F/G，后段 bars 100-132 收到 G offbeat `2/6/10/14`。 | `MUS-CHORD-02`、`MUS-CHORD-03`：情绪可从半音/邻音不稳定集合，收束到单一 root offbeat resolution。 |

Pad / 和弦情绪导演增量样本：

| 文件 | 轨道身份 | 关键观察 | 推导出的规范 |
|---|---|---|---|
| `D:/Downloads/PadChordDirector_SynthStringsBorrowedTriadSectionArc.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `082172a64028` | SynthStrings borrowed triad section arc | 120 BPM；186 notes；D#=44、F=38、C=29、A#=25、G#=24、G=22；cluster 以 `C-D#-G#`、`A#-D#-G` 为主，bars 48-130 多段进入。 | `MUS-CHORD-05`：情绪变化可以通过 borrowed shell family 在 section 级调度，不等于每 4 小节换完整和弦表。 |
| `D:/Downloads/PadChordDirector_SynthStringsBorrowedTriadSectionArc_Duplicate.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `082172a64028` | Duplicate of borrowed triad section arc | 与 `PadChordDirector_SynthStringsBorrowedTriadSectionArc.mid` 完全相同。 | 重复导出只保留溯源，不给 `MUS-CHORD-05` 重复加权。 |
| `D:/Downloads/PadChordDirector_DrumSynthStringsFRootGateRamp.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `15032b0c3382` | Drum + SynthStrings F-root gate ramp | 120 BPM；596 drum notes + 427 SynthStrings notes；鼓覆盖 bars 20.2-68.1；SynthStrings 以 F=385 为重心，D#/F#/G#/C# 为受控色，bars 60-129 加密。 | `MUS-CHORD-04`、`MUS-CHORD-06`：pad gate/cloud 可以被 drum grid 支撑，F-root 情绪层按 section 增密。 |
| `D:/Downloads/PadChordDirector_VoiceOohsGSparseCue.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `f917fc30da26` | Voice Oohs G sparse cue | 120 BPM；7 notes；全部 G；bars 26/28/74；短句化 cue。 | `MUS-CHORD-07`：G cue 是 section hint 或 resolution marker，不是完整和弦层。 |
| `D:/Downloads/PadChordDirector_SynthStringsFChordCloudBody.mid`<br>原始名：`Untitled Project (21).mid`<br>SHA1: `cb404efc8065` | SynthStrings F chord cloud body | 120 BPM；1141 notes；F=603、C=260；cluster 以 `C-F-F`、`C-F`、`A-C-F`、`A#-D#-G`、`F-G#`、`C-F-G#` 为主；bars 0-131 两段大覆盖。 | `MUS-CHORD-06`：F chord cloud 可在 F major、F minor、borrowed shell 间制造明暗，但 root gravity 与 profile 边界必须稳定。 |
| `D:/Downloads/PadChordDirector_VoiceOohsDSharpPedalGate.mid`<br>原始名：`Untitled Project (22).mid`<br>SHA1: `68b4e987e4ff` | Voice Oohs D# pedal gate | 120 BPM；121 notes；D#=119、G#=2；多段 0.5 beat gate 覆盖 bars 28-115。 | `MUS-CHORD-07`、`MUS-CHORD-04`：D# pedal 是悬浮/仪式 cue，可用 gate/phase/reverb 做迷幻运动，但不能扩成随机旋律。 |

当前可执行的 Pad / 和弦情绪导演模型：

1. `harmonyState`：由 stage、intensity、Boss/biome profile 选出，如 `suspendedShell`、`chromaticPressure`、`pedalRitual`、`offbeatResolution`。
2. `pitchSet`：每个 state 锁定 root、third/fifth、邻接色彩音与禁用音。
3. `voicingDensity`：决定只露 root、root+third、dyad/triad、还是 chord-shard cloud。
4. `padGate`：决定长音、0.5 beat gate、0.25 beat motor、offbeat gate。
5. `fxMotion`：用 filter、phase、reverb、delay 改变迷幻质感，但不改变 harmonyState。
6. `sectionHandoff`：8/16/32 小节层面换 state；4/8 小节只做 gate、voicing、FX 变体。
7. `shellFamily`：在当前 profile 内选择 pedal、minor/major shell、borrowed triad、dense chord cloud 或 sparse cue；同 SHA duplicate 只计一次。

## 10. 高强度 Chord-Shard Cloud 专项 MIDI 分析摘录

这批样本用于补齐 `MUS-SHARD-*`。它们说明高强度密音不是单一音轨的“炫技”，而是一套分工：drum grid 负责身体网格，bass/root motor 负责重心，dense cloud body 负责高压密度，sparse cue/handoff 负责 section 进出。

| 文件 | 轨道身份 | 关键观察 | 推导出的规范 |
|---|---|---|---|
| `D:/Downloads/ChordShardCloud_VoiceOohsGSharpOffbeatCue.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `a6bbc218e509` | Voice Oohs G# offbeat cue | 120 BPM；11 notes；全部 G#3；集中在 bars 100-105；slots `2/6/10/14`。 | `MUS-SHARD-04`：高强度 cloud 可以由极稀疏 root cue 触发或提示，不需要 cue 本身也很密。 |
| `D:/Downloads/ChordShardCloud_DrumHighIntensityPulseGrid.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `127203fd6369` | Drum high-intensity pulse grid | 120 BPM；738 drum notes；主锚点仍是 `0/4/8/12`，高强度段加入连续细分与 pickup。 | `MUS-SHARD-02`：dense cloud 需要共享 drum grid，否则高频密音会失去身体感。 |
| `D:/Downloads/ChordShardCloud_FretlessBassGSharpDensityMotor.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `60a19cd9eba4` | Fretless Bass G# density motor | 120 BPM；1259 notes；G#=1160；D#/E/A/F#/B 等只在 section 局部出现；bars 0-130 覆盖多段密度。 | `MUS-SHARD-02`、`MUS-SHARD-03`：高强度 cloud 下方需要 root density motor，色彩音只在受控窗口出现。 |
| `D:/Downloads/ChordShardCloud_FretlessBassGSharpDensityMotor_Duplicate.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `60a19cd9eba4` | Duplicate of Fretless Bass motor | 与 `ChordShardCloud_FretlessBassGSharpDensityMotor.mid` 完全相同。 | `MUS-SHARD-04`：重复导出只保留溯源，后续规则提炼只计一次。 |
| `D:/Downloads/ChordShardCloud_VoiceOohsGSharpLongAnchorCue.mid`<br>原始名：`Untitled Project (21).mid`<br>SHA1: `3e1b612fc626` | Voice Oohs long G# anchor cue | 120 BPM；5 notes；全部 G#3；bars 115/124/128，长音约 2-4 beats。 | `MUS-SHARD-04`：长 root anchor 可作为 cloud 收束或阶段落点，不必变成旋律。 |
| `D:/Downloads/ChordShardCloud_CleanGuitarGSharpDenseCloud.mid`<br>原始名：`Untitled Project (22).mid`<br>SHA1: `b06a88e1fe14` | Clean Guitar dense cloud body | 120 BPM；1602 notes；G#=1042；D#=123、E=120、A#=103、B=100、G=74、C#=23、A=12、F#=5；cluster 中有 dyad、triad 与单音密度混合。 | `MUS-SHARD-02`、`MUS-SHARD-03`：cloud body 可以宽、密、碎，但必须围绕 root gravity 与 profile color set。 |
| `D:/Downloads/ChordShardCloud_VoiceOohsCtoGSectionCue.mid`<br>原始名：`Untitled Project (23).mid`<br>SHA1: `392defd35646` | Voice Oohs C -> G section cue | 120 BPM；61 notes；bars 0-47 以 C cue 为主，bars 56 后切到 G，bars 96 附近出现 G/G# 邻接。 | `MUS-SHARD-04`：section handoff 可以用稀疏 cue 改变 root/pedal 感，再让 dense cloud 接管密度。 |

高强度 Chord-Shard Cloud 的当前推荐执行模型：

1. `drumGrid`：保持 `0/4/8/12` 主锚，允许局部 16 分 pickup，但不让高频 cloud 自己定义节拍。
2. `rootMotor`：root 权重最高，按 density tier 增密；色彩音只在 section 或 phrase 边界出现。
3. `cloudBody`：从 profile pitch set 中取音，允许 dyad/triad/cluster，但不允许全音阶随机。
4. `cueHandoff`：用 sparse root cue、long anchor 或 root/pedal handoff 控制 cloud 开始、收束和阶段转向。
5. `eventInterface`：玩家事件只触发 density bump、send bump、cluster accent 或 cue phrase，不逐音驱动 cloud。
6. `duplicateGuard`：相同 SHA1 的 MIDI 只作为重复导出记录，不提高统计权重。

## 11. 完整规则验证曲 MIDI 分析摘录

这批素材用于验证前面规则是否能组成完整曲，而不是单独新增某种曲风。判断重点是：统一拍序、分层职责、section coverage、dense/ sparse 互补、重复导出保护。

| 文件 | 轨道身份 | 关键观察 | 验证结论 |
|---|---|---|---|
| `D:/Downloads/FullRuleValidation_DrumGridPercussionStem.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `74ce772049e2` | Drum grid / percussion stem | 150 BPM；598 drum notes；T1 覆盖 bars 0-12.5，T2 覆盖 bars 13.7-114.9；主锚点集中在 `0/4/8/12`，同时有 `2/6/10/14` pickup；A#2、D2、C#3、F#1 等承担不同鼓位。 | 通过 `MUS-CLOCK-01`、`MUS-DRUM-01`、`MUS-VALID-01`：鼓网格能作为完整曲身体，不只是 fill。 |
| `D:/Downloads/FullRuleValidation_DrumFillAccentStem.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `1f5f363d8c33` | Drum fill / accent stem | 150 BPM；141 drum notes；bars 3.3-4.2 有短 fill，bars 32.1-37.5 与 56.4-75.0 有 A#5 accent/fill；slot 更偏奇数与临近点。 | 通过 `MUS-DRUM-01`、§3.6、`MUS-VALID-01`：fill/accent 独立于主 grid，适合做 section 提示。 |
| `D:/Downloads/FullRuleValidation_DrumFillAccentStem_Duplicate.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `1f5f363d8c33` | Duplicate of drum fill / accent stem | 与 `FullRuleValidation_DrumFillAccentStem.mid` 完全相同。 | 通过 `MUS-SHARD-04`、`MUS-VALID-01` 的 duplicate guard：保留溯源，但统计与规则提炼只计一次。 |
| `D:/Downloads/FullRuleValidation_Lead2GRootShardStem.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `06a8e9258b70` | Lead 2 G-root shard / root motor stem | 150 BPM；431 notes；G=331 是重心；开头 bars 4.2-15.2 用 G/A#/C# shard cell，bars 19.6-82.0 转为 G root motor，bars 84-115.8 加 D#/F/E/C#/D/B 等压力色。 | 通过 `MUS-KEY-01`、`MUS-SHARD-03`、`MUS-VALID-02`：验证 G-root profile 可行，但不能覆盖其他 Boss/biome profile。 |

重复导出校验记录：

| 重复导出文件 | 对应主文件 | SHA1 | 处理 |
|---|---|---|---|
| `D:/Downloads/FullRuleValidation_DrumGridPercussionStem_Redownload.mid`<br>原始名：`Untitled Project (12).mid` | `FullRuleValidation_DrumGridPercussionStem.mid` | `74ce772049e2` | 只保留溯源，不新增规则权重。 |
| `D:/Downloads/FullRuleValidation_DrumFillAccentStem_Redownload.mid`<br>原始名：`Untitled Project (13).mid` | `FullRuleValidation_DrumFillAccentStem.mid` | `1f5f363d8c33` | 只保留溯源，不新增规则权重。 |
| `D:/Downloads/FullRuleValidation_Lead2GRootShardStem_Redownload.mid`<br>原始名：`Untitled Project (19).mid` | `FullRuleValidation_Lead2GRootShardStem.mid` | `06a8e9258b70` | 只保留溯源，不新增规则权重。 |
| `D:/Downloads/FullRuleValidation_DrumFillAccentStem_Redownload2.mid`<br>原始名：`Untitled Project (22).mid` | `FullRuleValidation_DrumFillAccentStem.mid` | `1f5f363d8c33` | 只保留溯源，不新增规则权重。 |

完整规则验证曲检查清单：

1. `tempoGrid`：150 BPM 来源 tempo 与 beat/bar/slot 规则一致，不能用墙钟秒驱动音乐状态。
2. `roleCoverage`：至少有主 drum grid、fill/accent、root/shard stem；缺 pad/chord 或 FX 时标记为待补，不误判为完整制作完成。
3. `sectionMap`：drum grid 覆盖长段，fill/accent 在局部窗口进入，root/shard stem 覆盖 intro、motor、pressure 三类窗口。
4. `profileBoundary`：当前验证曲偏 G-root；只能证明 G-root profile 的一条路径，不能替代 F/G#/Boss-specific profile。
5. `eventInterface`：游戏事件只能映射到 density bump、accent、cue、send bump，不逐音控制 431-note shard stem。
6. `duplicateGuard`：相同 SHA1 的 stem 只计一次，避免素材导出重复造成规则误判。

当前验证结果：

- 已验证：`single beat clock`、`drum grid + fill 分离`、`root gravity shard stem`、`duplicate guard`。
- 待补验证：完整 pad/chord 情绪层、FX/riser/impact 层、pause veil 版本、Boss profile 变体版本。

## 12. Intensity 0-5 递进版 MIDI 分析摘录

这批素材用于补齐 `MUS-INTENSITY-*`。它说明强度递进不应该被理解为“六档随机换 loop”，而是同一音乐身份内的层级开关：鼓负责网格密度，bass 负责 F-root 推进，voice/pad cloud 负责中高频压力，稀疏 cue/fill 负责段落与强度交接。

| 文件 | 轨道身份 | 关键观察 | 规则结论 |
|---|---|---|---|
| `D:/Downloads/IntensityLadder_VoiceOohsFGFinalCue.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `a7f443227369` | Voice Oohs F/G final cue | 120 BPM；2 notes；F4/G4；bars 123.3-124.2；更像结尾提示或交接落点。 | `MUS-INTENSITY-03`：极稀疏 cue 只能做 handoff，不应被当作完整强度层。 |
| `D:/Downloads/IntensityLadder_VoiceOohsFPressureCue.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `7896049f2bca` | Voice Oohs F pressure cue | 120 BPM；89 notes；F 为主，E 与 A#/C/C#/G# 等少量色彩；T1 bars 46.2-51.0、T2 bars 54.1-57.0、T3 bars 66.1-74.0。 | `MUS-INTENSITY-02`：低中强度可用单一 root + 少量压力色制造紧张，不需要换一套旋律。 |
| `D:/Downloads/IntensityLadder_DrumGridDensityRamp.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `41562451d9be` | Drum grid density ramp | 120 BPM；562 drum notes；A#5 占主导；bars 0.3-158.5 多段覆盖，T7 bars 124.2-158.5 明显加密 pickup/细分。 | `MUS-INTENSITY-01`、`MUS-DRUM-01`：鼓层递进是 intensity 的独立维度，应按 section 增密，而不是随碰撞随机加点。 |
| `D:/Downloads/IntensityLadder_BassFRootDensityRamp.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `53708c793044` | Bass F-root density ramp | 120 BPM；1148 notes；F=987、F#=148、E=10、C#=2、C=1；T1 bars 0.3-4.0 F2 gate，T2 bars 4.0-11.3 F/F#，T4 bars 26.3-40.3 F3，T5/T7 延长并加压力色。 | `MUS-INTENSITY-01`、`MUS-INTENSITY-02`：bass 强度递进优先体现为 F-root 密度与 register/gate 变化，F# 等压力色受控进入。 |
| `D:/Downloads/IntensityLadder_DrumFillMidHighCue.mid`<br>原始名：`Untitled Project (21).mid`<br>SHA1: `a21d081ed8ad` | Drum fill mid/high cue | 120 BPM；28 drum notes；C3/A2；bars 93.2-105.9；更像中高强度提示或过渡 fill。 | `MUS-INTENSITY-03`、§3.6：fill 是强度边界提示层，应贴 section/phrase 边界，不替代主 drum grid。 |
| `D:/Downloads/IntensityLadder_VoiceOohsFCloudDensityRamp.mid`<br>原始名：`Untitled Project (22).mid`<br>SHA1: `cb7a2897e171` | Voice Oohs F-cloud density ramp | 120 BPM；452 notes；F=342，G#/G/E/A#/C/C# 为受控色；T1 bars 8.3-25.0、T2 bars 28.1-80.3 稀疏，T3 bars 82.1-106.9 加密，T5 bars 117.0-137.2 cloud body，T6-T8 稀疏返场。 | `MUS-INTENSITY-01`、`MUS-SHARD-03`：中高频 cloud 可以跟随强度开合，但必须保持 F root gravity 与 section 级密度曲线。 |
| `D:/Downloads/IntensityLadder_VoiceOohsGLongCueHandoff.mid`<br>原始名：`Untitled Project (23).mid`<br>SHA1: `ddabf5fa5ff9` | Voice Oohs G long cue / handoff | 120 BPM；35 notes；全部 G3；bars 37-158 稀疏长 cue。 | `MUS-INTENSITY-03`：长 cue 可提示转向或交接，不应把 G cue 合并进 F profile 的全局音池。 |

当前推荐的 intensity 实现模型：

1. `intensityState` 不直接选歌，而是选择 `drumDensity`、`bassDensity`、`cloudDensity`、`cueHandoff` 四组开关。
2. `drumDensity` 从 sparse anchor 到 pickup/细分逐步打开，维持同一拍序网格。
3. `bassDensity` 先锁 root，再加邻近压力色、register 与 gate 密度。
4. `cloudDensity` 延迟进入，高强度时加密；稀疏 cue/fill 只提示进入、收束或转场。
5. 同一房间或 Boss profile 内，强度切换必须共享 section map 与 root/profile 边界；不能每档变成新的独立曲子。

## 13. FX / Transition 专项 MIDI 分析摘录

这批素材用于补齐 `MUS-FX-*` 与 §3.6。它说明 transition 不只是一个 riser，而是一组桥接角色：鼓组 fill grid 做身体推进，失真半音 ramp 做心理张力，低频 pickup/stutter 做落点吸附，voice handoff/long-tail 做空间和和声延续。

| 文件 | 轨道身份 | 关键观察 | 规则结论 |
|---|---|---|---|
| `D:/Downloads/FXTransition_DrumSectionFillGrid.mid`<br>原始名：`Untitled Project (12).mid`<br>SHA1: `800249f5fdc8` | Drum section fill grid | 120 BPM；573 drum notes；A#5=441、A2=64、A#2=31、A#3=29；bars 8-129 多段窗口，早段有 16 分细分，后段以 `0/4/8/12` 与叠层鼓为主。 | `MUS-FX-01`、`MUS-DRUM-01`：转场鼓可以很密，但必须服务 section 边界和共享 pulse grid。 |
| `D:/Downloads/FXTransition_OverdrivenGuitarFFSharpTensionRamp.mid`<br>原始名：`Untitled Project (13).mid`<br>SHA1: `a6faf3029c16` | Overdriven Guitar F/F# tension ramp | 120 BPM；561 notes；F=462、F#=75、D#=16、A#=8；bars 4-128 多段进入，F/F# 半音摩擦是核心张力。 | `MUS-FX-02`：失真半音 ramp 是转场压力层，不应扩写成自由 lead。 |
| `D:/Downloads/FXTransition_ElectricBassASharpPickupStutter.mid`<br>原始名：`Untitled Project (19).mid`<br>SHA1: `200bc5bf884f` | Electric Bass A# pickup stutter | 120 BPM；60 notes；全部 A#2；bars 111-123；后段逐步缩短到完整 16 分 pickup。 | `MUS-FX-02`：低频 pickup/stutter 负责把下一段“吸”进来，音高必须受 profile 或 section handoff 控制。 |
| `D:/Downloads/FXTransition_VoiceOohsSectionHandoffArc.mid`<br>原始名：`Untitled Project (20).mid`<br>SHA1: `7432abf3b0b1` | Voice Oohs section handoff arc | 120 BPM；520 notes；F=178、C=170、B=92、F#=35；bars 0-129 多段窗口，从 C/F 身体、F#/C 张力、C pedal、F return 过渡到 B/F 尾段。 | `MUS-FX-03`、`MUS-CHORD-07`：voice handoff 是和声/空间桥，不应按碰撞逐音触发。 |
| `D:/Downloads/FXTransition_DrumImpactVoiceOohsLongTailCue.mid`<br>原始名：`Untitled Project (21).mid`<br>SHA1: `20920769939e` | Drum impact + Voice Oohs long-tail cue | 120 BPM；32 drum notes + 32 voice notes；drum 以 A#4/A#5 impact 为主，voice 以 D/E long-tail 为主，bars 9-129 稀疏窗口。 | `MUS-FX-03`：impact 接落点，long-tail 接空间；尾音需要受 reverb/delay send 控制，不能糊住砖块反馈。 |

FX / Transition 当前推荐模型：

1. `transitionRole`：先决定本次转场角色，是 `drumFillGrid`、`semitoneTensionRamp`、`bassPickupStutter`、`voiceHandoffArc` 还是 `impactLongTail`。
2. `triggerWindow`：优先在 4/8/16/32 小节边界、Boss warning、room clear、drop trigger 前后触发。
3. `pitchBoundary`：ramp/pickup/handoff 必须继承当前 profile 或明确 handoff 目标；不能把 transition 变成全局音池。
4. `tailBudget`：long-tail cue 必须有 send/wet 上限，给 brick/paddle/impact one-shot 留瞬态。
5. `eventInterface`：游戏事件只能触发 transition role 或 send bump，不直接逐音操纵 dense ramp。

## 14. 规范维护方式

后续修改规则时，优先按 ID 修改：

- 改时钟、事件、音频边界：先查 `MUS-CLOCK-*`、`MUS-LAYER-*`、`MUS-AUDIO-*`。
- 改 chord/pad：先查 `MUS-CHORD-01`、`MUS-CHORD-02`、`MUS-CHORD-03`、`MUS-CHORD-04`、`MUS-CHORD-05`、`MUS-CHORD-06`、`MUS-CHORD-07`、§3.3 与 §9。
- 改 high-intensity shard cloud：先查 `MUS-SHARD-01`、`MUS-SHARD-02`、`MUS-SHARD-03`、`MUS-SHARD-04`、§3.5 与 §10。
- 改完整规则验证曲：先查 `MUS-VALID-01`、`MUS-VALID-02` 与 §11。
- 改 intensity ladder：先查 `MUS-INTENSITY-01`、`MUS-INTENSITY-02`、`MUS-INTENSITY-03` 与 §12。
- 改 FX/transition：先查 `MUS-FX-01`、`MUS-FX-02`、`MUS-FX-03`、§3.6 与 §13。
- 改 Boss 风格：先查 §3.4，并同步 demo 的 `styles`。
- 改 lead 生成：先查 `MUS-LEAD-01` 和 §3.5。
- 改 transition：先查 §3.6。
- 改 dark psy 根音或调式：先查 `MUS-KEY-01`、§3.5 与 §6。
- 改 bass/drum 推进：先查 `MUS-BASS-01`、`MUS-BASS-02`、`MUS-BASS-03`、`MUS-DRUM-01`、§6 与 §8。
- 改低强度房间/暂停/悬浮态：先查 `MUS-LOW-01`、`MUS-STEM-02`、§4 与 §7。

外部 MIDI 命名规范：

- 新素材进入研究流时，优先改为 `MusicName_TrackRole.mid`。
- 文件名使用 ASCII；升降号写作 `Sharp` / `Flat`，例如 `GSharp`，避免路径与脚本转义问题。
- 如果源文件来自 `Untitled Project (...)` 这类临时导出名，专项分析表必须保留“原始名”字段，确保历史溯源不断。
- `TrackRole` 应描述音乐职责，而不只写乐器名，例如 `ElectricBassRootMotor`、`VoiceOohsGSharp4OffbeatGhost`、`DrumAnchorGrid`。

如果新增外部参考或新 MIDI，应在本文件中新增来源行，而不是只改结论。这样后续可以区分“规范改了”还是“素材参考换了”。
