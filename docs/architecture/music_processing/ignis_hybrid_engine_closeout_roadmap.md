# Ignis 混合编排引擎 · 版本收口 & 后续 Roadmap

> 日期：2026-06-29 · 范围：`ignis_midi_through_engine.html`（零采样 Web Audio · 乐句库+编排脑混合引擎）
> 一句话：**砖（人写/挖矿乐句）由编排脑选/移调/变奏，从不凭空生成音高；本版在此基础上补齐了「持续垫底」与「climax 炸点」两大缺口。**
> 配套规范见 [`clip_library_arranger_spec.md`](clip_library_arranger_spec.md)；可靠性铁律见根目录 [`CLAUDE.md`](../../../CLAUDE.md) / [`truncation-root-cause-analysis.md`](../../../truncation-root-cause-analysis.md)。
> 本文件取代 `music_system_next_todo_v0.1.md` 在「乐句库时代」的 roadmap 部分。

---

## 1. 这一版做成了什么

**核心范式**：乐句库（"砖"）+ 编排脑。砖是可移调的真实乐句，算法只负责选砖 / 移调 / 变奏 / 编排，绝不从零生成旋律。

**三个对照模式**（`MODE`）：
- `midi` —— 真实 MIDI 照抄第一个 Boss 的人工作曲，逐音喂给引擎音色（**天花板对照**）。
- `arr` —— 乐句库编排脑（主角）。子开关 `CLIPSRC`：`hand`（手写砖，naive 基线）vs `mined`（挖矿砖，真实 ignis MIDI 切片）做 A/B。
- `param` —— 引擎原生 `_scheduleStep`（根音锁死 + 单音 lead，纯基线对照）。

**编排脑 8 项能力**（arr 模式）：①动机发展（每 4 小节定动机 + 句内变奏）②相位解决（每 8 小节末 lead 落主音/五度）③bass↔lead 共享乐句种子联动 ④humanize（力度±8% + 音阶内偶发八度）⑤欧几里得 hat/perc 叠层（k 随能量 2→6）⑥climax 复音 ostinato（3 对 16）⑦**垫底层（本轮新增）** ⑧**炸点引擎（本轮新增）**。

**本轮两批增量**：

1. **垫底层（⑦，治"空旷"）** —— 修复 arr 模式此前**零持续层**的根因（`Arr.start` 从不触发 drone，ooh pad 也没排程）。
   - `Arr.start/stop` 接入引擎自带 `_startDrone/_stopDrone`（幂等，防与 param 模式双开）。
   - `_pad()` 一条按段落能量 ramp 的 ooh pad 云：潜行只根音持音 → 律动加五度 → 推进加八分碎切；**climax 跳过**（已满，只留低频 drone 防糊）。
   - hand + mined 两条路径都铺（垫底是编排地基，不是砖本身）。

2. **炸点引擎（⑧，治"不炸"）** —— 4 个方向（A–D，详见 §3）：A 复活段落 RTPC 联动；B drop 信号弹（crash / sub-boom / riser）；C 留 headroom + 段落响度对比；D climax 音色加重（kick/bass/lead）。

---

## 2. 架构现状 / 关键文件

| 文件 | 作用 |
|---|---|
| `ignis_midi_through_engine.html` | **唯一 demo**。内含引擎（`src/music_engine.js` 逐字注入）+ 编排脑 IIFE + UI。约 1860 行，>183KB。 |
| `clip_pack.json` / `clip_pack.embed.js` | 挖矿砖数据（按 stem 分类、强度分桶）。embed 版供 demo 内 `window.CLIP_PACK` 读取。 |
| `_mine/mine.js` `mine2.js` `gen_embed.js` | 挖矿管线：从 ignis MIDI 切片 → 分桶 → 八度归位 → 生成 clip_pack。 |
| `_mine/smoke_mined.js` | 无头行为测试（选砖/欧氏/vjit），PASS 115/115。 |
| `clip_library_arranger_spec.md` | 乐句库 + 编排脑规范。 |
| `music_boss_biome_profiles_v0.1.md` / `boss_music_design.md` / `boss_midi_deep_mining_INDEX.md` | **方向二的现成地基**：各 Boss 的 biome/音乐画像与 MIDI 深挖索引。 |

**关键代码定位（grep 锚点，遵循铁律不记行号）**：

- 引擎 voice：`playFurnaceKick(` `playCrash(` `playImpact(` `playRiser(` `playBass(` `playScreech(` `playOoh(` `playHeat(` `_startDrone(`
- 编排脑：`_planBar(bar,t0)` `STORY=[` `const SECTION` `_bassMined(` `_leadMined(` `_lead(mode` `_pad(secKey` `_ostinato(`
- 本轮锚点注释：`// —— A：复活段落 RTPC` `// —— B：drop 信号弹` `// —— C：段落响度对比` `// —— 垫底 pad 云` `const kg = secKey===` `炸点引擎`
- 母线：`this.musicComp` `this.masterSat` `this.bassDrive` `this.delaySend` `this._pumpDepth`

---

## 3. 信号链 / RTPC 现状（A–D 后）

**总线（构造器默认）**：drumBus 0.72（不被侧链，穿透）· bassBus 0.7 · hatBus 0.18（不被侧链）· leadBus 0.0（intensity 控制）· droneBus 0.13 · pumpBus 1.0（被 kick 侧链）· subBus 0.6 · fxBus 0.9 → 全部汇入 musicGain → masterEQ(300Hz −2.5dB) → musicComp → masterSat → out。

**段落能量表 `SECTION`**：stalk 0.18 · groove 0.48 · drive 0.74 · climax 0.98 · break_ 0.10。
**曲式 `STORY`（60 小节循环）**：stalk×8 · groove×8 · drive×8 · climax×8 · break_×4 · drive×8 · climax×8 · groove×8。

**A — 段落 RTPC 联动（根因修复）**：此前 `_planBar` 直写 `eng.intensity` 绕过 `_applyIntensity`，导致泵深/失真/回声全程钉死默认值（climax 只多音符、不加重量）。现每小节起点平滑重设：
- `bassDrive.gain = 0.9 + energy*1.3` → climax≈2.17 咆哮（默认 1.2）
- `delaySend.gain = 0.16 + energy*0.20` → climax≈0.36（默认 0.25）
- `_pumpDepth = max(0.10, 0.42 − energy*0.30)` → climax≈0.13 深泵（默认 0.36，越小压越狠）
- leadBus 仍由编排脑直控（不调 `setIntensity`，避免与 `leadBus.gain.value=S.leadGain` 冲突）。

**B — drop 信号弹**（仅 `auto` 曲式）：进 climax 当拍（bar 24/44）砸 `playCrash`+`playImpact`；climax 前一小节（bar 23/43）后 3 拍拉 `playRiser`。三个 voice 均新增，复用 `sm.noiseBuffer`。

**C — 留 headroom + 对比**：`musicGain = 0.36 + energy*0.26`（climax≈0.61 / 推进≈0.55 / 潜行≈0.40 / break≈0.39，默认 0.5）——非高潮段不去顶限制器，climax 推满时落差更明显；母线压缩 threshold −18→−15、ratio 2.8→2.4（少抓动态）。峰值交给 `masterSat` tanh 软削波吃（出谐波=更"炸"，非数字裁剪）。

**D — climax 音色加重**：kick gain 按段落（climax 1.18 / drive 1.04 / 其余 0.95）+ 咔点起始亮度随 intensity（climax≈2382Hz 脆 snap）；climax 强拍（`s%8===0`）补下八度 bass（地基更重，hand+mined 都加）；screech 主奏在 climax 失谐叠一层（`freq*1.006`，+7ms）= 厚墙。

**裁剪安全网**：所有增益上抬最终经 `masterSat` 软削波（2x 过采样）兜底；新增的下八度 sub（可低至 ~20Hz）未被 300Hz dip 削，是"体感"来源，可控但需试听确认不过载。

---

## 4. 验收口（待用户）

- **#30 听感 A/B 验收（pending）**：试听 `arr` 模式下 `hand` vs `mined` 两条路径的 climax 是否够炸、潜行/律动是否还空。若某处过载/糊，回收对应增益（首选降 `kg` climax 值或下八度 bass 的触发密度）。
- **自检方式**：因挂载读会截断 HTML 尾部（编排脑在 ~1600–1860 行，超出 ~162KB 挂载窗），**全文件 `node --check` 不可行**；本轮校验用 `/tmp` heredoc harness 暂存新代码片段 + `node --check` + 行为断言（信号弹触发位置、RTPC 数值单调性）。沿用此法。

---

## 5. 后续 Roadmap

### 方向一 · 音色优化与研究

目标：把"混音已不错、但单音色仍偏合成感"再往前推。抓手（按性价比）：
1. **参考对标**：选 2–3 首暗黑 psytrance 参照轨，对 kick / bass / screech / crash 做频谱与瞬态对比，列出差距清单（先量化再调）。
2. **crash/钹真实度**：当前 `playCrash` 是噪声+两枚峰，金属感偏弱 → 试非谐分音串（仿 `playVibraslap` 思路）或短 IR 卷积。
3. **bass/lead 波形升级**：失谐锯→wavetable/加法合成，给 screech 更"会咬"的谐波包络；评估 `bassDrive` 软削波曲线（当前 softclip(3.0)）是否换更激进的波形整形。
4. **空间**：算法混响 → 轻量卷积 IR（boss 厅堂感）；补 D 阶段暂缓的**立体声宽度**（lead/pad 的 Haas/相位展宽，注意单声道兼容）。
5. **母线**：评估三段串联限制（musicComp → SoundManager comp → masterSat）是否仍偏平，考虑多带/换序。

### 方向二 · 为所有 Boss 做特色挖矿砖版本

目标：把"ignis 专属"的混合引擎，推广成**每个 Boss 一套有性格的砖包 + 共享编排脑**。抓手：
1. **管线泛化**：把 `_mine/mine.js` 从 ignis 硬编码改为"输入某 Boss 的 MIDI 语料 → 输出该 Boss 的 `clip_pack.<boss>.json`"，沿用强度分桶 + 八度归位。
2. **砖包清单标准**：定义 `clip_pack` manifest（boss id / 调式 / BPM / 各 stem 砖 / 签名 voice），编排脑按 boss id 热切砖包，**引擎与编排脑不动**。
3. **Boss 性格旋钮**：复用 `music_boss_biome_profiles_v0.1.md` 的画像 → 每个 Boss 落：调式/音阶、tempo、groove 模板、签名音色、曲式 STORY 变体、垫底/炸点强度。
4. **逐个产出 + A/B**：每个 Boss 走 ignis 同一验收口（hand 基线 vs mined）；扩 `smoke_mined.js` 覆盖多砖包选砖。
5. **交付**：每 Boss 一份 embed 砖包 + 在 demo 里加 Boss 选择器（或各自 demo 页）。

---

## 6. 可靠性铁律（操作前必读）

- **文件工具（Read/Write/Edit）= 内容真值**；Bash 的挂载读 / `cp` / `zip` 可能短读截断 → 改文件一律用 Edit，校验用 `/tmp` harness `node --check`。
- demo 内 line ~120 有一段 ~76KB 单行 `IGNIS_MIDI` blob —— **永不直接 Read**。
- 编排脑是隔离 IIFE `(function(){…})();`；引擎 voice 是 class 方法。新增 voice 放 class 内、新增编排逻辑放 `_planBar`。
