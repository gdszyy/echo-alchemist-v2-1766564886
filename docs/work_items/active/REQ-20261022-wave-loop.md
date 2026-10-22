# REQ-20261022-wave-loop

Status: done（M1 波次机制）；M2 视觉清晰度、M3 特效重构、M4 调参试玩 planning
Owner: Claude Code（按用户 2026-10-22 指令）
Started: 2026-10-22
Branch / worktree: `codex/REQ-20261022-wave-loop` @ `../echo-alchemist-REQ-20261022-wave-loop`

## 用户原文

> 当前整体美术风格可以改的再整体清晰明了一点，目前都糊在一起。特效也可以重构（但是要有识别度，有完整的反馈和特效）。然后机制上可以参考一下Dome keeper 的回合制，挖矿对应钉板，每波打怪就是 每一个波次，可以按照3个波次一个boss来做。

用户确认口径（2026-10-22）：3 个普通波后再打 Boss（4 波一循环）；钉板不加实时倒计时、用发射次数做预算并显式展示下一波；顺序 机制 → 美术 → 特效。

## 里程碑

| 站 | 交付物 | 到达判定 | 状态 |
|---|---|---|---|
| M1 波次循环 | Boss 波调度 + 波次 HUD + 横幅 + 挖掘阶段来袭预告 | `validate_wave_cycle.mjs` 全绿；R4 首 Boss、击杀后 +4；全量回归不新增红 | done |
| M1.5 核心循环重设计 | 设计稿 `docs/design/dig_build_defend_loop_v1.md` v1.2 | 两轮独立复核；用户 2026-10-22 拍板 D1–D7（D5 改为直接替换） | done（设计） |
| M1.6 直接替换实现 | S1 循环骨架 → S2 整备与经济 → S3 钉板分区/重抽/热条 → S4 设施与道具战斗 → S5 Boss/商人/遗物/教程收口 → S6 调参试玩 | 每阶段：游戏可开局打到 Boss、全量回归不新增红、提交检查点 | planning |
| M2 视觉清晰度 | 三层分离（背景退后 / 可交互中景 / 反馈前景）规范 + 色板 token + 背景降噪 + 钉子/敌人/弹道对比度 | 同场景前后截图 + 亮度对比读数；390 宽可读 | planning |
| M3 特效与反馈 | 必带反馈清单 + 元素可区分特效 + 反馈预算接入 `CONFIG.performance` | 每类事件视觉+听觉反馈；high/medium/low 三档 | planning |
| M4 调参试玩 | Boss 提前到 R4 后的血量/难度曲线复核；Boss 余波高压期与新节奏的冲突 | 3 局试玩记录 | planning |

## M1 改动

- `src/config.js`：`balance.bossRounds`（R5 首 Boss / 7–9 间隔 / 击杀速度延期）→ `balance.waveCycle.normalWavesPerBoss = 3`。
- `src/utils/boss_schedule_utils.js`：新增 `computeNextBossRound` / `getWaveInfo` / `findActiveBoss` 等唯一口径；Boss 在场时不预告下一个 Boss。
- `src/spawn_system.js`：`spawn_scheduleNextBoss` 改为波次循环；`spawn_checkBossRoundFor` 用 `>=` 匹配（读档不漏 Boss）且 Boss 在场/待生成时不触发；Boss 预教学按「第几个 Boss」取段落。
- `src/core.js`：`boss:defeated` 删除延期计算，直接重新排期。
- `src/game_phase.js`：Boss 生成后 `_nextBossRound = BOSS_WAVE_IN_PROGRESS`；刷新波次 HUD。
- `src/game_system.js`：`sys_updateWaveHud`、横幅「第 x 波 / 3」「Boss 波 · 第 n 回合」、Boss 预告改「n 波后」。
- `src/ui_system.js`：阶段标签 研磨/战斗 → 挖掘/守卫；挖掘阶段钉板左下角「来袭 N · 精英 M / Boss 来袭」；战斗中 Boss 预告改「n波」。
- `index.html` / `src/styles/bitmap_ui.css`：波次胶囊样式；商人旅程 dock 在移动端收窄，避免遮挡右侧胶囊。
- `tests/validate_wave_cycle.mjs`：推演 + 静态契约 27 条。

### 独立复核（2026-10-22）后修正

- **确认缺陷**：只有 `combat_damageEnemy` 广播 `boss:defeated`；燃烧/毒素 DoT、AoE 溅射、遗物连锁直接 `takeDamage()` 击杀 Boss 时不广播 → `_nextBossRound` 永远停在 9999、此后不再出 Boss，HUD 还会一直显示 Boss 波。修复：`spawn_reconcileBossWave()` 在回合结算检测时发现「Boss 波进行中但场上无存活 Boss」即补发同一事件（同时修正了该路径下音乐停留在 Boss 态的旧问题）；HUD 预告在该窗口按本回合击杀推算。
- **防串扰**：`boss:defeated` 处理器忽略不在本局 `enemies` 中的 Boss（真理之书演示共用全局事件总线）。
- **教程局显示**：R1 显示 `1/1`（唯一 Boss 在 R2），不再显示误导的 `3/3`。
- 实机复验：静默击杀于 R6 → 补发记录（ignis, R6）、下一个 Boss 波 R10、R7 不出 Boss、R10 出 Boss；外来 Boss 事件不改排期；存档读档 R9 Glacies 正常恢复。

## 验证

- 全量：`validate_wave_cycle` 27/27、`validate_scenarios` 128/128、`validate_enemy_spawn_runtime` 1093/1093、`validate_wave_presets` 501/501、其余 boss/potion/pinboard/world_sim 套件全绿；`validate_phase_contracts` 173/174（唯一失败为开工前既有红：gathering HUD 坐标转换正则）。
- 浏览器实机（375×812，worktree 起服务于 3003）：R3 胶囊 `3/3` 琥珀 → R4 Ignis 登场、胶囊 `BOSS` 红、横幅「Boss 波」→ R5「Boss 波 · 第 2 回合」不叠第二个 Boss → R5 击杀后排期 R9 → R6–R8 `1/3..3/3` → R9 Glacies 登场。无 JS 运行时错误。
- 实机推进方式：浏览器面板被遮挡时 rAF 不触发，用定时器手动驱动 `game.sys_loop()`；Boss 击杀通过发射同一 `boss:defeated` 事件（伤害路径本身未改动）。

## 已知问题 / 交接

- **口径更正（2026-10-22）**：钉板目前只在开局与购买弹珠包时进入，并非每回合；「每回合挖」与发射预算属于 M1.5 核心循环重设计（`docs/design/dig_build_defend_loop_v1.md`），待用户拍板后实现。

- HEAD（6f5a74e）的 `src/core.js` import 了未入库的 `src/music_clip_packs.js`，干净检出无法启动；本 worktree 为本地验证临时复制了该文件，**未提交**，归属原批次。
- `boss:defeated` 后「接下来 3 回合高压反扑」会覆盖整个下一轮普通波，与 Dome Keeper 的喘息节奏冲突 → M4 处理。
- 难度曲线、THEME_SEGMENTS 回合区间仍按旧节奏，Boss 平均提前约 1 回合 → M4 复核。
- 挖掘阶段顶栏中部归商人旅程 dock；顶栏拥挤属 M2 视觉层级问题。
