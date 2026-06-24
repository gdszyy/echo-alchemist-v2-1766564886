# 游戏事件 → 音乐事件映射规格 v0.1

> 日期：2026-06-24
> 状态：P0-2，承接 `music_runtime_schema_v0.1.md :: §7 EventMapping`，把 13 个游戏事件逐条落成音乐意图。
> 一句话原则：**碰撞是 phrase，连击是编曲，肉鸽成长是加层，transition 是 section 桥接**——事件只能驱动 `phrase / anchor / densityBump / sendBump / transitionRole`，绝不逐碰撞生成随机旋律（`MUS-PHRASE-01`、`§3.5 禁止项`）。

---

## 0. 五类音乐意图

任一事件必须落到下面五类之一（`music_runtime_schema_v0.1.md :: §7`）：

| musicIntent | 含义 | 典型来源 |
|---|---|---|
| `phrase` | 吸附到当前 chord/grid 的量化短乐句（one-shot） | `MUS-PHRASE-01` |
| `anchor` | 节拍锚点击打（瞬态反馈，无旋律） | `MUS-DRUM-01`、`MUS-DENSE-01` |
| `densityBump` | 抬升 intensity 档 / 加 stem（编曲变化，不发单音） | `MUS-INTENSITY-01` |
| `sendBump` | 临时改效果器 send（reverb/delay/filter/distortion） | `MUS-FX-03`、`MUS-CHORD-04` |
| `transitionRole` | 触发一个 FXTransition 桥接角色 | `MUS-FX-01` |

> 取音来源（`pitchSource`）只能是 `rootOnly` / `currentChordShell` / `profilePitchSet`，**永远不是 random**（`MUS-SHARD-01`、`MUS-LEAD-01`）。

---

## 1. 聚合限流总则

高频碰撞（paddle/wall/brick、多球段）**必须聚合、限流、量化**，不逐事件全量发声（`MUS-AUDIO-02`、`MUS-DENSE-01`）：

- `throttle`：固定时间窗内最多发 N 次（节流），适合 paddle/wall。
- `debounce`：抖动合并，密集触发只在尾部发一次。
- `countToAnchor`：累积计数，达到阈值才落一个 anchor/phrase（密集碎砖段聚合成节奏锚点）。
- brick/paddle 反馈必须保留**瞬态空间**：高频混响/长尾不得糊住碰撞反馈（`MUS-FX-03`、`MUS-AUDIO-02`、`intensity 5 transientGuard`）。

---

## 2. 主映射表

### 2.1 路由（intent / lane / 量化 / 取音 / 转场）

| sourceEvent | musicIntent | targetLane | quantizeGrid | pitchSource | triggersTransition |
|---|---|---|---|---|---|
| `paddleHit` | `anchor` | `low` | `1/8` | `rootOnly` | — |
| `wallHit` | `anchor` | `high` | `1/16` | `rootOnly`(ghost) | — |
| `brickBreak` | `phrase` | `high` | `1/16` | `currentChordShell` | — |
| `armorHit` | `anchor` | `mid` | `1/8` | `rootOnly` | — |
| `crystalBreak` | `phrase` + `sendBump` | `high` / `fx` | `1/8` | `profilePitchSet`(color) | — |
| `poisonBreak` | `phrase` + `sendBump` | `mid` / `fx` | `1/8` | `currentChordShell`(chromatic cell) | — |
| `fireBreak` | `phrase` + `sendBump` | `high` / `fx` | `1/8` | `currentChordShell` | — |
| `comboUp` | `densityBump` | `all` | `1bar` | — | — |
| `multiBall` | `densityBump` + `sendBump` | `high` / `mid` | `1bar` | — | — |
| `danger` | `sendBump` + `transitionRole` | `fx` / `mid` | `1bar` | — | `fx.tensionRamp` |
| `bossWarning` | `transitionRole` | `fx` | `4barBoundary` | `handoffTo:targetProfile` | `fx.bossWarningPreRoll` |
| `dropTrigger` | `transitionRole` + `densityBump` | `fx` + `all` | `1barBoundary` | — | `fx.dropTrigger` |
| `roomClear` | `transitionRole` + `sendBump` | `fx` | `sectionBoundary` | — | `fx.roomClearTail` |

### 2.2 限流（冷却 / 优先级 / 叠加 / 聚合 / 追溯）

| sourceEvent | cooldownBeats | priority | maxStack | aggregate | ruleRefs |
|---|---|---|---|---|---|
| `paddleHit` | `0.25` | 2 | 1 | `throttle` | `MUS-AUDIO-02`、`MUS-PHRASE-01` |
| `wallHit` | `0.25` | 1 | 1 | `debounce` | `MUS-AUDIO-02`、`MUS-DENSE-01` |
| `brickBreak` | `0.25` | 4 | 3 | `countToAnchor` | `MUS-PHRASE-01`、`MUS-SHARD-01`、`MUS-AUDIO-02` |
| `armorHit` | `0.5` | 3 | 2 | `throttle` | `MUS-AUDIO-02`、`MUS-PHRASE-01` |
| `crystalBreak` | `0.5` | 5 | 2 | `throttle` | `MUS-SHARD-03`、`MUS-PHRASE-01`、`MUS-FX-03` |
| `poisonBreak` | `0.5` | 5 | 2 | `throttle` | `MUS-CHORD-03`、`§3.4 Venom`、`MUS-PHRASE-01` |
| `fireBreak` | `0.5` | 5 | 2 | `throttle` | `MUS-FX-02`、`MUS-PHRASE-01` |
| `comboUp` | `2` | 7 | 1 | `none` | `MUS-INTENSITY-01`、`MUS-INTENSITY-02`、`§3.2` |
| `multiBall` | `4` | 6 | 1 | `none` | `MUS-SHARD-01`、`MUS-INTENSITY-01`、`MUS-AUDIO-02` |
| `danger` | `4` | 8 | 1 | `debounce` | `MUS-FX-02`、`§3.3 pressure` |
| `bossWarning` | `once` | 9 | 1 | `none` | `MUS-FX-01`、`§3.6`、`§3.4` |
| `dropTrigger` | `once` | 10 | 1 | `none` | `MUS-FX-01`、`MUS-INTENSITY-01`、`§3.2`(intensity 5) |
| `roomClear` | `once` | 9 | 1 | `none` | `MUS-FX-03`、`§3.6`、`MUS-FX-01` |

> 优先级语义：高 `priority` 抢占低 `priority`。`dropTrigger`(10) > `bossWarning`/`roomClear`(9) > `danger`(8) > `comboUp`(7) > `multiBall`(6) > `crystal/poison/fire`(5) > `brickBreak`(4) > `armorHit`(3) > `paddleHit`(2) > `wallHit`(1)。瞬态结构性事件永远盖过零碎碰撞。

---

## 3. 高频事件聚合细则

- **paddleHit / wallHit**：默认只做 `anchor`，不进 phrase 池。节流窗口建议 1 拍内 paddle ≤4、wall ≤2；超出的只更新视觉，不再发声（`MUS-AUDIO-02`）。
- **brickBreak（密集碎砖）**：单发是 `phrase`，但连续碎砖用 `countToAnchor` 聚合——每累积 K 块落一个 chord-shard anchor，而不是每块一个音（`MUS-DENSE-01`、`MUS-SHARD-01`）。取音锁当前 chord shell，禁止随机。
- **multiBall 期间**：多球抬高整体碰撞频率，必须**临时收紧**下游 paddle/wall/brick 的 `maxStack` 与节流窗，避免事件风暴（`MUS-AUDIO-02`）。multiBall 自身只发一次 `densityBump`。
- **元素砖（crystal/poison/fire）**：phrase 取 profile 色彩音或半音 cell，配一次性 `sendBump`（crystal→reverb throw、poison→slime delay/filter、fire→distortion/impact），不堆长尾（`MUS-FX-03`）。

---

## 4. 事件 → FXTransition 触发关系

只有结构性事件可触发 transition；transition 只连接上一句与下一句，不开新旋律（`MUS-FX-01`、`§3.5 禁止项`）。详见 `music_transition_templates_v0.1.md`。

| 事件 | 触发的 transition 模板 | 触发窗口 | 说明 |
|---|---|---|---|
| `danger` | `4barRiser` / `fx.tensionRamp` | 进入危险态后最近 4 小节边界 | 固定根音半音摩擦增压，不是 lead（`MUS-FX-02`） |
| `bossWarning` | `bossWarningPreRoll` | Boss 出现前 4/8 小节 | pre-roll，随后 Boss profile swap（`§3.4`） |
| `dropTrigger` | `dropTrigger` | 下一个 downbeat | impact 接落点 + 抬到 intensity 5，留瞬态（`MUS-FX-03`） |
| `roomClear` | `roomClearTail` | section 边界 | impact + voice long-tail，尾音送 reverb/delay（`MUS-FX-03`、`§3.6`） |
| `comboUp`（里程碑） | `2barDrumFill`（可选） | 连击里程碑所在 phrase 末 | 仅在显著里程碑用 fill 过桥，平时只 densityBump |

---

## 5. 规则追溯小结

- 「事件只落五类意图、不发随机旋律」：`MUS-PHRASE-01`、`MUS-LAYER-01`、`MUS-LEAD-01`、`§3.5 禁止项`。
- 「高频必须聚合限流量化」：`MUS-AUDIO-02`、`MUS-DENSE-01`。
- 「连击/肉鸽成长 = 加层不是发音」：`MUS-INTENSITY-01`、`MUS-INTENSITY-02`、`§3.2`。
- 「transition 挂边界、不开新旋律、留瞬态」：`MUS-FX-01`、`MUS-FX-02`、`MUS-FX-03`、`§3.6`。
- 「取音锁 chord/profile」：`MUS-SHARD-01`、`MUS-SHARD-03`、`MUS-CHORD-03`、`MUS-CHORD-06`。

---

## 6. 边界与不做

- 不为任一碰撞绑定具体绝对音高；取音永远走 `currentChordShell` / `profilePitchSet` / `rootOnly`（`MUS-KEY-01`、`MUS-SHARD-05`）。
- 不让 paddle/wall 进 phrase 池或触发 transition；它们只是 anchor（`MUS-AUDIO-02`）。
- 不在本文件接入运行时代码；这是 `EventMapping` 的数据规格，实现时进音乐门面而非散落 `AudioContext`（`MUS-AUDIO-01`）。
- 事件名沿用玩法真相，音乐层只消费不重发（`MUS-EVENT-01`、`MUS-LAYER-01`）。
