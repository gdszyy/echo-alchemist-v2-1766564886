# Suno 参考 · 钢琴演绎 Boss 战 prompt 集

> 目的：用 Suno 生成「钢琴主导的 boss 战」参考音频，供我提炼成引擎合成参数，给 `playPiano` 另调一版**撑得起 boss 战、不呆**的钢琴变体（不覆盖 §3.13 的冻结快照）。
> 用法：把下面 **Style** 整段贴进 Suno 的曲风框；**Lyrics** 框留空或贴对应的结构标签（纯器乐）。每条跑 1–2 次，挑最贴的回传给我。
> 对齐引擎：dark psytrance boss 底，**~150 BPM、E 小调 / E 弗里几亚（暗）、4/4**。三条变体各探一个方向，方便 A/B。

---

## 变体 A — 暗黑新古典钢琴 boss（钢琴 + 管弦 + 鼓，最接近“战斗”）

**Style：**
```
Dark neoclassical boss battle, aggressive percussive grand piano leading, fast driving left-hand ostinato in E minor, low register power octaves, staccato stabs answered by sweeping runs, cinematic strings and brass swells underneath, pounding war drums and taiko, tense diminished and phrygian harmony, relentless 150 BPM, building from sparse menacing intro to full climax, instrumental, epic, villainous, hybrid orchestral
```
**结构（贴进 Lyrics 框，纯器乐）：**
```
[Intro: lone low piano ostinato, sparse]
[Build: add strings, snare rolls]
[Drop: full drums + power-octave piano theme]
[Bridge: virtuosic piano run, half-time]
[Climax: piano + brass + taiko, maximum intensity]
[Outro: ostinato fades]
```

---

## 变体 B — 钢琴 × 电子混血（贴合本作 dark psy 引擎）

**Style：**
```
Hybrid dark psytrance boss fight with grand piano lead, gritty detuned piano stabs over a rolling 16th-note bassline, pounding four-on-the-floor kick, acid FX and risers, E phrygian, dark and hypnotic, prepared-piano percussive attacks, piano arpeggios doubling the synth motif, 152 BPM, aggressive and driving, instrumental, cyber-occult, climactic drops
```
**结构：**
```
[Intro: kick + drone + single piano note pulses]
[Build: piano arpeggio + riser]
[Drop: rolling bass + percussive piano stabs + acid lead]
[Break: exposed dark piano melody]
[Drop 2: heavier, piano power chords + screech FX]
```

---

## 变体 C — 独奏/特写反派钢琴主题（看“钢琴单独怎么演”）

**Style：**
```
Solo dark virtuoso piano villain theme, dramatic and menacing, rapid left-hand tremolo and ostinato, thunderous low octaves, fast chromatic and phrygian runs, sudden dynamic swells from whisper to fortissimo, sparse reverberant space, minor key, rubato into strict tempo around 150 BPM, instrumental, gothic, intense, cinematic
```
**结构：**
```
[Intro: rubato, single ominous motif]
[Theme: left-hand ostinato + right-hand melody]
[Development: octave runs, rising tension]
[Climax: full-range fortissimo hammering]
[Resolve: motif returns soft]
```

---

## 回传后我会提炼这些（→ 翻成引擎参数）

- **音域 / 声部密度**：钢琴主要落在哪几个八度、和弦几音、左手 ostinato 还是柱式。
- **节奏型**：主导节奏动机（16 分滚动？切分？八度跳？三连？）——对应引擎 `_scheduleSignatures` 的 step 网格。
- **力度与起音**：是软触叙事还是锤击 staccato——对应 `vel`、`atk`、是否加锤击噪声瞬态。
- **音色处理**：是否 prepared/失真/暗化、有无延音踏板长尾——对应叠暗八度、`bassShaper`/低通、`_wet` 送量。
- **与鼓/bass 的叠法**：钢琴是顶在 kick 上还是错拍、是否被泵——对应 `pumpBus` 路由与 step 对齐。
- **段落动态**：calm→rage 怎么加码——对应 `setSection` 下的密度/音域/失真阶梯。

> 注：本作引擎是**纯实时合成（零采样）**，所以不会塞 Suno 音频，而是把上面这些「演绎手法」翻译成 `playPiano` 的 boss 变体（暂记 `playBossPiano`）＋调度句法。Suno 成品仅作风格基准。
