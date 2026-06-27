# 乐句库程序编排（Clip Library + Arranger）· 规范与扩展

> 版本 v1 · 2026-06-26
> 落地位置：`docs/architecture/music_processing/ignis_midi_through_engine.html` 第三个 `<script>` 块
> （grep 锚点：`Clip Library + Arranger Brain`）
> 配套引擎：`src/music_engine.js`（demo 内 block1 为其逐字注入副本）

---

## 1. 这是什么 / 为什么

引擎原生的程序化音乐（`_scheduleStep` 那套）本质是**一台参数化 16 步鼓机**：根音锁死、lead 一小节一个音、和声静止、结构只由一根强度滑杆驱动。把真实 Boss MIDI 喂给同一套音色后听起来好很多 —— 证明**音色/混音没大问题，差距在"编排"**。

乐句库模式的核心一句话：

> **不让算法去"作曲"，而是给它人写好的素材去"编排"。把算法从作曲家降级成 DJ / 编曲。**

- **人写的可移调乐句 = 砖**（rolling bass、lead 动机、鼓 groove、过门 fill）。
- **编排脑 = 只管结构与反应**（曲式段落、强度映射、挑砖、拼接、变奏、过门、转场）。
- **音色层完全复用引擎现有 voice**，与"真实 MIDI 照抄"共享同一套合成器与去糊混音 → 这是一个**只变编排、不变音色**的干净 A/B/C 对照。

demo 里三个模式：

| 模式 | 来源 | 作用 |
|---|---|---|
| 真实MIDI（天花板） | 人工作曲的 ignis MIDI，逐音符 | 上限参照 |
| **乐句库程序编排** | 本规范描述的系统 | 新方案 |
| 现版程序（基线） | 引擎原生 `_scheduleStep` | 改进前对照 |

---

## 2. 总体架构

```
人写乐句库（砖）            编排脑（结构 + 反应）            引擎 voice（音色，复用）
┌───────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│ GROOVE  鼓型   │        │ SECTION  段落配方      │        │ playFurnaceKick+duck │
│ BASS    贝斯   │──挑选→ │ STORY    自动剧情曲线   │──排程→ │ playHat / Shaker     │
│ BASS_COLOR 上色│  ↑     │ sectionFor 强度→段落    │  绝对  │ playSnare/FurnaceTom │
│ LEAD    主奏   │  │     │ _planBar 逐小节规划     │  时间  │ playBass             │
│ FILL    过门   │  │     │ 变奏：密度门/人性化/    │   t    │ playScreech/Modal/   │
└───────────────┘  │     │      call·answer/lift  │        │ EmberLead / playHeat │
                   └─────── lookahead 25ms 唤醒 ───────────┘
```

数据流：编排脑每唤醒一次，把"下一小节"整体规划出来 —— 决定用哪些砖、怎么移调、密度多少、要不要过门 —— 然后把每个音符以**绝对 AudioContext 时间** `t` 排程到引擎 voice 上。音色、侧链泵、失真、EQ、空间全部由引擎 voice 负责，编排脑不碰 DSP。

---

## 3. 核心契约（不变量）

写砖、加段落、改算法时必须守住的约定：

1. **时间用 16 分步**：一小节 = 16 步（`s` ∈ 0..15）。step 0 是小节头（落第一记 kick）。
2. **音高用"相对根音的半音数"**：所有 `p` 都是相对 `ROOT_HZ` 的半音偏移，因此**天生可移调**。频率 = `ROOT_HZ * 2^((p + lift + oct)/12)`。
3. **编排脑永不凭空生成音高**：它只能"挑砖 + 移调 + 变奏"。任何旋律/节奏的"原创性"都来自人写的砖。这是降级作曲为编排的硬边界。
4. **同一时刻只有一个 transport 在跑**：切模式/停止时 `stopAll()` 同时停 MIDI 播放器、编排脑、引擎原生 scheduler。
5. **音色不变**：编排脑只调用引擎 voice，不新增/修改合成器。与 MIDI 模式共享去糊混音。
6. **隔离**：整套放独立 `<script>` 块，开头 `typeof eng==='undefined'` 守卫；解析失败则原 MIDI 接线保留可用，页面不会被打砖。

---

## 4. 乐句库 schema（砖）

### 4.1 时间 / 音高常量

```js
BPM     = 148          // 对齐 ignis
ROOT_HZ = 41.2         // E1 根音
SPB     = 60/BPM/4     // 每 16 分音符秒长 ≈ 0.101s
BAR     = 16*SPB       // 每小节 ≈ 1.622s（4 拍）
semi(n) = ROOT_HZ * 2^(n/12)
```

### 4.2 鼓 GROOVE — `{kick, hatC, hatO, perc, clap}`，值为落点步数组

| groove | kick | hatC（闭镲） | hatO（开镲） | perc | clap |
|---|---|---|---|---|---|
| `stalk` | 0,8（半拍） | 4,12 | — | 14 | — |
| `groove` | 0,4,8,12 | 2,6,10,14（offbeat 8分） | 14 | 7,15 | — |
| `drive` | 0,4,8,12 | 2,3,6,7,10,11,14,15（16分滚） | 2,6,10,14 | 5,13 | 12 |
| `climax` | 0,4,8,12 | 1,2,3,5,6,7,9,10,11,13,14,15 | 2,6,10,14 | 3,7,11,15 | 4,12 |

四踩贯穿，hat 提供切分密度阶梯；开镲固定落"&"（psy 的招牌）。

### 4.3 BASS / BASS_COLOR — `[{s, p?}]`，`p` 缺省为 0（pluck 一下，引擎 voice 自带短衰减）

```js
BASS = {
  offbeat:  [2,6,10,14]                                   // 空灵 off
  roll8:    [2,3, 6,7, 10,11, 14,15]                      // 八分滚奏
  roll16:   [1,2,3, 5,6,7, 9,10,11, 13,14,15]             // 招牌 off-off-off（除下拍外全打）
  riff_oct: roll16，其中 s=3/11/15 跳 +12（八度 pop）
}
// 乐段末"上色"变体（制造内部旋律走向，仍在 pedal 根音之上）
BASS_COLOR = {
  b7:   roll16，重音处用 p=10（小七）
  b2:   roll16，重音处用 p=1（Phrygian 小二）
  walk: 末四步走句 p=3,5,7,10
}
```

> 设计取舍：**bass 走 pedal（根音不动）**。darkpsy 的语法就是 pedal/drone 贝斯 + 上方动 —— 静止根音不是 bug 而是体裁。"动"来自 `riff_oct` 的八度 pop、乐段末的 `BASS_COLOR`，以及上方 lead 的旋律，而**不**靠移低频根音（移根音容易糊 41Hz 低端）。

### 4.4 LEAD — `[{s, p, d, v}]`：步 / 相对根音半音 / 时值(步) / 力度

```js
call:    {2,+12}{5,+15}{8,+19,d2}{11,+17}   // 上行 acid cell（问）
ans:     {2,+17}{6,+15}{9,+12,d2}{12,+10,d2}// 下行落到 b7（答）
atmos:   {0,+0,d8}{8,+7,d8}                 // 长音根/五度，breakdown 铺底
screech: 八度跳的 FM 嘶吼，8 个 16 分，已在高音区
```

编排时再叠 `oct`（call/ans +24、atmos +12、screech +0）。

### 4.5 FILL — `{tom, snare, fx}`，小节边界触发

```js
small: tom 10,12,14                          // 每 4 小节
snare: snare 8,10,12,13,14,15（加速）
big:   tom 8,10,11,12,13,14,15 + fx 15        // 每 8 小节（乐段末）
```

---

## 5. 编排脑（结构与反应）

### 5.1 段落配方 SECTION

| 段落 | groove | bass | energy | leadGain | lead | 名 |
|---|---|---|---|---|---|---|
| `stalk` | stalk | offbeat | 0.18 | 0.0 | — | 潜行 |
| `groove` | groove | roll8 | 0.48 | 0.35 | call/ans | 律动 |
| `drive` | drive | roll16 | 0.74 | 0.6 | call/ans | 推进 |
| `climax` | climax | riff_oct | 0.98 | 0.85 | screech | 高潮 |
| `break_` | —（无鼓） | offbeat | 0.10 | 0.7 | atmos | 解构 |

`energy` 同时驱动 `eng.intensity`（bass 滤波亮度 + 失真/回声/泵深的 RTPC）与密度门 —— 与 MIDI 模式同一套 RTPC，所以高潮段音色自动更亮更猛。

### 5.2 强度来源：自动剧情 vs 手动

- **手动滑杆**：`sectionFor(intensity)` 量化 → `<0.26 stalk / <0.52 groove / <0.80 drive / else climax`。
- **自动剧情曲线 STORY**：固定 60 小节时间线，让 demo 自己讲故事再循环（`break_` 只在自动剧情里出现）：

```
stalk×8 → groove×8 → drive×8 → climax×8 → break_×4 → drive×8 → climax×8 → groove×8
（STORY_LEN = 60 小节 ≈ 97 秒 / 圈）
```

### 5.3 逐小节规划 `_planBar(bar, t0)`

每小节按顺序：

1. 定 `secKey`（自动用 `storySection(bar)`，手动用 `sectionFor(滑杆)`），取 `S = SECTION[secKey]`。
2. `eng.intensity = S.energy`；`eng.leadBus.gain.value = S.leadGain`。
3. 算 `phrasePos = bar%4`、`phrase8 = bar%8`、`lift = LEAD_LIFT[phrase8]`（`[0,0,0,0,0,0,0,5]` —— 仅乐段末把 **lead** 抬一个四度做转折，bass 不动）。
4. **鼓**：遍历 groove 各 voice 排程；`phrasePos===3` 触发过门（`phrase8===7` 用 `big`，否则 `small`）。breakdown（无 groove）只留一记低 FX + 半拍 kick 当心跳。
5. **bass**：取段落 bass 砖；`energy>0.4 && phrase8===7` 时换 `BASS_COLOR`（按 `['b7','b2','walk'][(bar/8|0)%3]` 轮换）；按密度门 `dens = min(1, 0.55 + energy*0.5)` 概率性丢音；逐音 `playBass`。
6. **lead**：`leadGain>0.001` 且（非 groove 段 或 groove 段的偶数小节）才进；call/answer 交替。
7. **转场**：自动模式下若下一小节切段，本小节 step 12 补一记 `playHeat` 扫掠铺垫。

### 5.4 变奏与人性化（让它不像 loop）

- **密度门**：低强度概率性丢 bass/hat/perc 音，高强度铺满。
- **人性化微移** `hum()`：每个音 ±4ms 时间抖动。
- **力度抖动**：hat/perc 在区间内随机 gain。
- **call ↔ answer 交替**：`leadTog` 奇偶切换问/答句。
- **八度 pop / 上色轮换**：`riff_oct` 与 `BASS_COLOR` 三选一轮换。
- **乐段末 lift**：每 8 小节末 lead 上抬四度 → 转折感后复位。

### 5.5 lookahead 调度

复用引擎/MIDI 同款"两个时钟"：`setTimeout` 每 25ms 唤醒（不精确，只管唤醒），把"起始时间落在 `now+0.18` 内"的整小节提前规划，所有音以 `ctx.currentTime` 锚定的绝对 `t` 排程（精确）。整小节一次性排出，末尾音超前约 1.6s 入队 —— Web Audio 精确执行。

---

## 6. 引擎 voice 接口（驱动层）

编排脑只依赖这些方法（签名与 MIDI 播放器一致）：

| 调用 | 用途 |
|---|---|
| `eng.playFurnaceKick(t, gain)` + `eng.duck(t)` | kick + 侧链泵 |
| `eng.playHat(t, open, gain)` | 闭/开镲 |
| `eng.playShaker(t)` / `eng.playSnare(t,g)` / `eng.playFurnaceTom(t,g)` | perc / clap / tom |
| `eng.playBass(t, freq)` | psy 短拨弦贝斯（自带 sub + 失谐锯齿咆哮 + 失真/EQ/泵） |
| `eng.playEmberLead/playModal/playScreech(t, freq, dur[, g])` | 主奏三态 |
| `eng.playHeat(t, gain)` | 熔炉 FX，进混响 |
| `eng.setBpm` / `eng.setIntensity` / `eng.start` / `eng.stop` | 走速 / 强度 / 原生 transport |
| `eng.intensity=` / `eng.leadBus.gain.value=` / `eng.ctx` | 直接骑参 |

---

## 7. 三模式分发与 UI

- `MODE ∈ {midi, arr, param}`，默认 `midi`（页面行为同改造前）。
- 本块**重写** `$('play').onclick` / `$('stop').onclick`：按 MODE 分发到 `player`（MIDI）/ `Arr`（编排脑）/ `eng`（原生）。重写只在本块解析成功后生效，失败则原接线保留。
- UI 新增：`#mode` 段控（三按钮）、`#isrc` 强度来源下拉（自动/手动）、`#modetip` 动态说明。播放进度区在 arr 模式复用为"段落名 · 第 N 小节"，进度条宽度映射当前 energy。

---

## 8. v1 已知边界

- arranger 内置乐句是**按 darkpsy 套路手写**的。真实 MIDI 自动挖矿现已完成（§9.1 ✅），产物 `clip_pack.json` 与手写砖同 schema，但**尚未接进 arranger**（下一步：加载 pack、按 Boss/段落选砖）。
- bass 走 pedal，无真正根音/和声进行（见 §9.2）。
- 选砖是确定性 + 概率门，非加权/马尔可夫（见 §9.3）。
- 手动模式把滑杆量化成 4 段，丢失连续性。
- 自动剧情是固定 60 小节循环，未与真实战斗事件挂钩（见 §9.5）。
- arr 模式无逐 voice mute；无 swing/摇摆。
- arranger 代码块当时靠 Read 逐行复核（VM 宕机）；VM 恢复后 `src/music_engine.js` 去糊移植已过 `node --check`（§9.6 ✅）。arranger 本身的无头 smoke test 仍待补（§9.8），最终音色验证靠浏览器实听。

---

## 9. 后续潜力扩展（路线图）

### 9.1 真实 MIDI 自动挖矿入库 ✅（已完成 v1）

把 `IGNIS_MIDI` 切成砖，喂进同一 schema。已落地的管道（`_mine/mine2.js`，跑 `node mine2.js` 即重生成）：

```
从 demo HTML 抽 window.IGNIS_MIDI → 量化到 16 分网格 → 按小节切段
→ bass/lead 音高归一为"相对根音半音"(根=最低显著主音八度,pedal floor)
→ 鼓按 onbeat 占比统计推断 kick 音高(非 GM) → groove 分轨
→ 完全相同模式去重 + 按出现次数排序 → 注入 GROOVE/BASS/LEAD/FILL
```

产物 `clip_pack.json`（与手写砖同 schema，运行时可加载；含 per-demo 根音 + 调式）。统计见 `node mine2.js` 输出，鼓诊断见 `_mine/drumdiag.js`，校验见 `_mine/inspect_pack.js`。

**挖出来的砖（v1）**：groove 10 / bass 36 / lead 32 / fill 1。

**关键发现（也回答了 task #11「量化真实编排结构」）**：

| 维度 | demo1 (E, 150bpm) | demo2 (F, 148bpm) | 含义 |
|---|---|---|---|
| groove 重复率 | 鼓被 bounce，无法分轨 | **67%**（kick=pitch58, 90% onbeat） | 骨架稳定、反复 |
| bass 每小节唯一率 | 93%（中位 2 音/小节） | 81%（中位 7 音/小节，滚奏） | 细节几乎每小节都变 |
| lead 每小节唯一率 | 88% | 89% | 同上 |
| 调式 | 0,1,2,3,6,7,10（近 Phrygian） | 0,1,7（纯 pedal+b2+5） | 暗系 |

→ 正是当初诊断的「稳定骨架 + 持续变化的细节」：真实编排里**鼓 reps 高、bass/lead 几乎每小节微变**；参数化引擎缺的就是这个。bass 多为根音 pedal（demo1 movement 全靠节奏；demo2 是 root+5+8 滚奏和弦 + 偶发 b7/b2 上色）。darkpsy 几乎不用鼓过门，转场靠 FX riser（故 fill 仅挖到 1 条 —— 是特征不是 bug）。这些 stem 非标准 GM，故鼓只有 demo2 可信分轨。

**下一步**（未做）：把 `clip_pack.json` 接进 arranger —— 加载 pack，按 Boss/段落/强度从中选砖（替换或混合手写砖），并做 A/B 对照（手写 vs 挖矿砖）。

### 9.2 和声 / 根音进行档位

当前是 pedal + lead 乐段末抬四度。可加可开关的档位：bass 根音进行表（每段一条）、调式互换（Phrygian↔自然小调）、每乐句的转位。低频移动要配低端管理（见去糊规范），避免糊。

### 9.3 加权 / 马尔可夫选砖 + 转场矩阵

给每块砖加权重与"后继概率"（哪块砖接哪块更顺），用马尔可夫/转场矩阵选砖，降低循环感；可从挖矿数据里学到真实作曲的转移规律。

### 9.4 8 个 Boss 各自 KIT

`_bossProfiles()` 已有 8 个 Boss（ignis/glacies/mikro/devourer/viridis/tesla/chimera/ouroboros）。为每个 Boss 配独立 KIT：调式、根音、groove 风味、lead 性格、专属 FX。编排脑通用，砖按 Boss 切换。

### 9.5 游戏状态反应（把"编排脑"真正接进战斗）

把段落选择和事件触发挂到真实游戏状态：

- `threat / HP / phase` → 段落选择（如 HP 跌破阈值进 climax，Boss 硬直进 break_）。
- 受击 → 即时小过门；阶段转换 → stinger / 扫掠；boss 出大招 → 预铺 riser。
- 复用引擎现有 `setIntensity` / `threat` 骑参通道。

### 9.6 移植进 src 生产引擎 + 去糊混音（去糊 ✅ / 编排路径未做）

**去糊混音已移植进 `src/music_engine.js`**（过 `node --check`，链路 `musicGain→masterEQ→musicComp→masterSat→out` 单路无旁通）：

- `leadHPF` highpass 120Hz Q0.7，leadBus 先高通再分进 delaySend / pumpBus / wet；
- `reverb` IR 2.2→1.5 收尾；wet gain 0.32→0.22；`_wetHPF` 250→320；新增 `_wetLPF` lowpass 6500（wet→HPF→LPF→reverb）；
- `masterEQ` peaking 300Hz Q1.0 −2.5dB 清"泥巴区"。

> 注：demo 专用的 stub 压缩器软化（thr −10/knee 4/ratio 3/release 0.15）只在 demo 的 SoundManagerStub 里，**未**进 src（生产 SoundManager 自有母线）。

**仍待做**：把编排脑作为 src 的生产编排路径（替换或旁路 `_scheduleStep`，原生参数化保留为 fallback）。

### 9.7 作者工作流 / 外部 clip pack

定义最简 clip 编写格式 + "怎么加一块砖"的流程；把库外置成 JSON pack，非工程师也能扩砖；可做一个小的可视化 step-grid 编辑器。

### 9.8 无头校验 harness（VM 恢复后）

用 mock AudioContext 在 node 里跑编排脑若干小节，断言：各段落事件数在合理区间、无异常、duck/setBpm 调用正确、不同强度下密度单调 —— 复刻早先 MIDI-through 的 smoke 测试，纳入 CI。

---

## 10. 文件地图 / 参考

- 实现：`docs/architecture/music_processing/ignis_midi_through_engine.html`
  - block0：`window.IGNIS_MIDI`（两版烘焙音符）
  - block1：`src/music_engine.js` 逐字注入（含去糊混音）
  - block2：`SoundManagerStub` + `MidiPlayer`（真实 MIDI 照抄）
  - block3：本规范的乐句库 + 编排脑（grep `Clip Library + Arranger Brain`）
- 引擎真值：`src/music_engine.js`
- 可靠性铁律：`CLAUDE.md` / `truncation-root-cause-analysis.md`
- 定位方式：grep 函数/锚点名（不依赖行号，行号随改动失效）。
