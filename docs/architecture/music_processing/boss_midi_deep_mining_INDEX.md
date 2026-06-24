# Boss MIDI 深挖索引 · Music / MIDI Deep-Mining Index

> 状态：v1 进行中 · 日期：2026-06-25
> 目的：把 `Audio_sample/Boss/` 里每个 Boss 的**分轨 MIDI** 逐条解析（不是只取中位 BPM+调式直方图），
> 挖出真实的句法 / 节奏栅格 / 配音 / 力度动态 / 段落结构，用来**丰富 `dark_psy_engine_demo.html` 引擎**，解决「音乐太单调」。
> 这是音乐类文档的**专用索引号段 `M-`**（M-01..M-08，每 Boss 一个稳定编号），与 `INDEX.md` 的 1–17 号设计/规格文档并列。

---

## 0. 为什么需要这一轮（与上一轮的区别）

| | 上一轮（Suno 分段实测，已写入 `boss_music_design.md §3`） | 本轮（MIDI 逐分轨深挖，本索引） |
|---|---|---|
| 数据粒度 | 中位 BPM、root、相对根音级直方图 top-N、calm/rage 两段密度 | **每分轨**的 16 分栅格 onset 分布、力度 min/med/max、音符时值分布、register、CC、按时间的段落切分 |
| 产出 | 8 套**简化** profile（bpm/root/padChord/bassFill/leadNotes/sig） | 每 Boss **新增声部 / 段落编排 / per-step 句法**，落到引擎可调层 |
| 局限 | 织体多靠「density 阶梯」近似，听感偏单调、8 个 boss 共用一套节奏骨架 | 让每个 boss 有**自己的节奏栅格与配器签名**，拉开辨识度 |

工具：`tools/midi_mine.py`（截断防护 SMF 解析器，零依赖）。所有 42 个分轨已通过完整性校验（0 截断，div=480，format-1）。

---

## 1. 索引号段 M-01..M-08（Boss ↔ MIDI ↔ 引擎 key）

| 号 | Boss | MIDI 文件前缀 | 分轨 | 引擎 key | 深挖结论位置 | 状态 |
|---|---|---|---|---|---|---|
| **M-01** | 熔炉守卫·伊格尼斯 ignis | `熔炉之门` | Bass / Drums / FX / Percussion / Synth | `ignis` | `boss_music_design.md` §3.1 → 「深挖 v2」 | ✅ 完成（tom 四踩+温压脉冲+倒挂弧模态线） |
| **M-02** | 霜晶缝合怪·格拉西斯 glacies | `Glacies 冰骨` | Backing Vocals / Bass / Drums / FX / Synth | `glacies` | §3.2 → 「深挖 v2」 | ✅ 完成（保 kick 叠高 tom shimmer+大三度玻璃铃+b2 缝合 stutter+八度落差 bass） |
| **M-03** | 裂变母体·米克罗 mikro | `微裂母体` | Backing Vocals / Bass / Drums / FX / Guitar / Synth / Vocals | `mikro` | §3.3 → 「深挖 v2」 | ⬜ 待办 |
| **M-04** | 贪婪之渊·噬神者 devourer | `贪渊吞王` | Bass / Drums / FX / Synth | `devourer` | §3.4 → 「深挖 v2」 | ⬜ 待办 |
| M-05 | 翠绿共生体·维里迪斯 viridis | `Viridis 之茧` | Bass / Drums / FX / Percussion / Synth | `viridis` | §3.5 → 「深挖 v2」 | ⬜ 待办（大 Boss，本批不做） |
| M-06 | 雷霆幻影·特斯拉 tesla | `特斯拉雷影` | Bass / Drums / FX / Percussion / Synth | `tesla` | §3.6 → 「深挖 v2」 | ⬜ 待办（大 Boss） |
| M-07 | 混沌融合体·奇美拉 chimera | `混沌奇美拉` | Bass / Drums / FX / Percussion / Synth | `chimera` | §3.7 → 「深挖 v2」 | ⬜ 待办（大 Boss） |
| M-08 | 永恒回声·奥罗波罗斯 ouroboros | `衔尾终环` | Bass / Drums / FX / Percussion / Synth / Woodwinds | `ouroboros` | §3.8 → 「深挖 v2」 | ⬜ 待办（大 Boss·终） |

> 本批（用户指定）：先做完 4 个 mini（M-01..M-04）再停下评审，然后做 4 个大 Boss（M-05..M-08）。

---

## 2. 每个 Boss 深挖结论的统一骨架（写入 §3.x 的「深挖 v2」小节）

为保证可比、可回灌引擎，每个 Boss 的深挖结论固定记这几块：

1. **完整性**：字节数 / 分轨数 / 0 截断校验（防 CLAUDE.md 短读）。
2. **全局**：BPM 区间+中位、root、拍号、总时长。
3. **逐分轨实测**：每条 stem 的 音数 / 密度(音/秒) / register / 力度(min·med·max) / 中位时值 / 相对根音级 top / **16 分栅格 onset 向量**（这是上一轮没有的、最能去单调的东西）。
4. **段落结构**：按时间二分（前=calm / 后=rage）的密度与音级变化，必要时更细分。
5. **→ 引擎丰富落点 v2**：明确列出**新增声部 / 改的句法 / 段落编排**，对应 `dark_psy_engine_demo.html` 的 profile 字段或新方法；标注「新增 vs 调参」。
6. **撞味提醒**：与同根/同速 Boss 的区分手段。

---

## 3. 引擎侧改动登记（dark_psy_engine_demo.html）

> 每完成一个 Boss 就在此登记本轮新增的「引擎能力」，便于回看哪些是 v2 深挖带来的。

| 能力 | 引擎位置 | 来源 Boss | 新增/调参 | 说明 |
|---|---|---|---|---|
| `playFurnaceTom(t,gain)` | 方法（playTom 后） | M-01 ignis | 新增声部 | 炉腔低 tom 四踩：sine135→62 + 三角腔体泛音 + 噪声皮膜；走 drumBus |
| `playHeat(t,gain)` | 方法 | M-01 ignis | 新增声部 | 定根 E 温压金属脉冲：正弦芯 + 窄带噪声叮 → fxBus 进混响 |
| `playModal(t,freq,dur,gain)` | 方法 | M-01 ignis | 新增声部 | 模态张力线：失谐双锯+方波芯 → 谐振带通 → drive → leadBus |
| `playWood(t,gain)` | 方法 | M-01 ignis | 新增声部 | 木鱼 accent：极短三角咔 → drumBus |
| `_drumMode='tribalTom'` | 构造默认 + `_scheduleStep` | M-01 ignis | 新增句法 | tom 四踩取代 kick；rage 叠反拍 tom + 末小节 16 分连打 |
| `_heatPulse` | 构造默认 + `_scheduleStep` | M-01 ignis | 新增句法 | 温压脉冲层：calm 拍头疏(s%8) → rage 每八分(s%2) 线性加密 |
| `_modalLine`(per-section) | 构造默认 + `setSection` + `_scheduleStep` | M-01 ignis | 段落编排 | calm 反拍 8 分密集 Phrygian；rage 坍缩回根（倒挂弧） |
| `sig.woodAccent` | `_scheduleSignatures` | M-01 ignis | 新增句法 | rage 木鱼点缀（s===6/14） |
| `_applyIntensity` 的 `needLead` 地板 | `_applyIntensity` | M-01 ignis | 调参（全局收益） | 签名/模态层在低强度保底可闻；threat/intensity 拖动不被压没 |
| boss 清除复位补 3 字段 | UI `$('boss').onchange` else | M-01 ignis | 调参 | 切回通用 darkpsy 时复位 `_drumMode/_heatPulse/_modalLine` |
| `playGlassBell(t,freq,dur,gain)` | 方法（playModal 后） | M-02 glacies | 新增声部 | 大三度持续冰晶铃：非谐泛音串 `[1,2.76,5.4,8.93]` → fxBus 进混响 |
| `playStitch(t,gain)` | 方法 | M-02 glacies | 新增声部 | 定根 b2(`_noteFreq(25)`) 方波过 formant 带通 → leadBus，机械「缝针」 |
| `playChime(t,gain)` | 方法 | M-02 glacies | 新增声部 | 冰锥 chime：三角 2640→2200Hz 短下扫 → hatBus |
| `sig.glassBells`(升级) | `_scheduleSignatures` | M-02 glacies | 改句法 | 旧版借 playScreech；现走 `playGlassBell` + `bellDeg`，calm 密低 / rage 疏高 |
| `sig.tomShimmer` | `_scheduleSignatures` | M-02 glacies | 新增句法 | **保留四踩 kick**，其上叠 HiTom shimmer（calm s%4===3 / rage s%2===1） |
| `sig.chimeOff` | `_scheduleSignatures` | M-02 glacies | 新增句法 | 反拍冰锥叮（s%4===1） |
| `sig.stitchVox` | `_scheduleSignatures` | M-02 glacies | 新增句法 | 狂暴 s∈{6,12} 各 `stitchN` 连 b2 缝合 stutter |
| `bassFill:'frostMid'/'frostDrop'` | `_scheduleBass` | M-02 glacies | 新增句法 | bass 八度落差：calm 中音 pedal `_noteFreq(12)` → rage 跌低八度 `_noteFreq(0)`+b3 冰裂 |

---

## 4. 复现方式

```bash
# 单 Boss 全分轨深挖（root 可手动锁定，避免鼓轨干扰自动判根）
python3 tools/midi_mine.py "Audio_sample/Boss/熔炉之门 (Bass).mid" \
  "Audio_sample/Boss/熔炉之门 (Synth).mid" ... --root=E
```

输出 JSON：每分轨含 `grid`(16 分 onset 向量)、`deg`(相对根音级)、`calm`/`rage` 分段、`vmin/vmed/vmax`、`meddur`、`reg`。
