# 伊格尼斯 demo 加花清单（fill inventory）

> 用途：把两个 demo 的「稳定节奏型 vs 加花」逐条拆开列出，便于人工指认哪处加花在引擎里听上去不对。
> 数据来源：`tools/` 解析两个 MIDI demo，16 分栅格对齐；GM 乐器直方图交叉校验。
> 关键纠正：**两个 demo 都不存在「一直循环的四踩 kick」。** 稳定脉冲另有其轨；kick 只在 drop 段出现（Demo2），或几乎不用（Demo1）。

---

## 0. 谁是「稳定节奏型」（不是 kick）

| demo | 稳定脉冲来源 | 四踩 KICK | 说明 |
|---|---|---|---|
| **Demo2**（引擎主依据） | **Vibraslap n58 ×360，bar 0–114 全程** | Kick n58→实为 n36，仅 **bar 32–88**（drop 段） | 全曲靠 vibraslap 嗡鼓打脉冲；kick 只在中段 drop 加入 |
| **Demo1** | **LoTom n41（bar 37–68）→ HiTom n50（bar 67–108）** | Drums 轨**无 kick**；Kick 仅在 Percussion 轨 bar 46–53 | tom 驱动的 groove，几乎不用 kick |

> 含义：引擎现在的 `playFurnaceKick` 四踩（即便按段落门控）相对 demo 仍**偏重 kick**。demo 的「地基」是 vibraslap / tom 脉冲，kick 是 drop 段的**加花层**之一。

---

## 1. 段落地图（Demo2，150.9 BPM，按 4 小节 phrase 的轨密度推得）

| 段落 | bars | 特征 |
|---|---|---|
| INTRO | 0–15 | synth 主题旋律 + 稀疏 vibraslap；bass 渐入；**无 kick** |
| BUILDUP | 16–31 | 滚动 bass 全开、synth 退场、snare 渐强（18–25）；**无 kick** |
| LIFT（pre-drop） | 32–38 | synth 答句回归 + bass 峰值；kick 于 bar 32 试探性首现 |
| DROP | 39–67 | bar 39 kick 滚奏砸入 → 四踩 kick + 滚动 bass + FX 全开 |
| SYNTH-LEAD | 68–75 | synth 再次冲高 + crash 涌动（72–77） |
| DROP-2 | 76–88 | 续 drop，kick 于 bar 88 退出 |
| OUTRO/break | 88–115 | vibraslap + tom 收尾加花；末 bar 113–114 tom 滚奏收 |

---

## 2. 加花清单（编号 F1..F18，按声部族归类）

### 鼓 / 打击加花（叠在稳定脉冲之上）
| # | demo bars | 加花 | 现引擎对应 |
|---|---|---|---|
| F1 | 18→25 | **snare 渐强**：反拍 → 四踩，冲向 drop 的张力坡 | 无独立 snare 渐强层 |
| F2 | **39** | **kick 滚奏砸入** drop（`....xxxxxxxxx...` 16 分） | 有 impact，但无 kick-roll |
| F3 | 42–47 | **手 tom 点缀**（Percussion 轨 n45 ×5），有机散拍 | 无 |
| F4 | 47 | **rim 单发**一击 | 无 |
| F5 | 62–63 / 84–88 / 100–102 | **段尾 tom 收句**（短 tom punctuation） | climax 才有 tom-roll |
| F6 | 72–77 | **crash 涌动**，标记 synth-lead 过渡 | 有 `_sampleCrash` 但触发点不同 |
| F7 | 113–114 | **结尾 tom 滚奏 + 收尾 crash** | 无收尾式 |
| F8 | 38 / 74 | **vibraslap 脉冲自身的 16 分爆发**（phrase 尾加密） | 脉冲未单列，无此加花 |

### Bass 加花（叠在滚动 F 根引擎上）
| # | demo bars | 加花 | 现引擎对应 |
|---|---|---|---|
| F9 | 12–14 | **直 8 分 ramp** 引入（pattern 锁定前） | buildup 有 ramp |
| F10 | 21 / 46 等 | 滚动 8 分里**插 16 分填充 / 切分** | furnaceRoll 有部分 |
| F11 | 22,26,28,30 → 49,51,53,54,56,58… | **半音邻音末拍**（F#2/C#3、D#3/F#3）= bass 招牌加花 | `_bassColor` 轮 [7,5,10,3] —**方向可能就是这里不对** |
| F12 | 48 | **register 抬升**：低 F2/C3/F3 三和弦 → F3 中心 = 段落变体 | groove rotate 有换层 |

### Synth / 旋律加花
| # | demo bars | 加花 | 现引擎对应 |
|---|---|---|---|
| F13 | 8–15 | **INTRO 主题动机**：B3 pedal 上 16 分琶音 A#3/C4/E4/G4 | emberLead 旋律，但 motif 不同 |
| F14 | 32–36 | **synth 答句 run**（F4 域），drop 前旋律抬升 | 无专门 pre-drop 答句 |
| F15 | 68–75 | **synth lead 再入**（drop 上的旋律段） | synthLead 段有 |
| F16 | 108–109 | **高音收尾刺**（F5/F6） | 无 |

### FX 加花
| # | demo bars | 加花 | 现引擎对应 |
|---|---|---|---|
| F17 | 46–66 | **riser 三和弦叠刺**（G3+C4+E4）密度递增 | riser 有，和弦化无 |
| F18 | 78–95 | **反拍 E4 脉冲**（drop 氛围铺底） | 无 |

---

## 3. Demo1 差异（仅记要点）
- 稳定地基是 **tom**（LoTom→HiTom），**Drums 轨完全无 kick**；synth 在 intro（bar 8–15）极密=主题陈述。
- bass 几乎恒为 **E 根**单音反拍滚动，加花靠**音数增减 + 偶发 F/G 邻音**（bar 54/56/68）。
- 收尾（bar 92–108）走 **2/14、10、6 步位的 tom call** 循环式收句。

---

## 4. 待确认的改法（用户指示）
- 「bass 音源可以去掉，改成加花 tab」→ 读作：把 bass 当前承担的加花职责**抽出**，改为**独立的加花层/轨**驱动；稳定地基（脉冲+锁定 bass）保持稳，加花层按段落投放 F1–F18。
- 等用户指认 **哪几条 F# 听上去不对**，再动引擎。
