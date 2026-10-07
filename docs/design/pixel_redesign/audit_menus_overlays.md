# 菜单与弹层信息架构审计

> 2026-10-06 只读代码审计（REQ-20261006-pixel-art 重设计输入）。基线：分支 codex/REQ-20261006-pixel-art @ d97d8ba；行号以该基线为准，后续改动会漂移。

## Non-combat UI information-architecture audit (Echo Alchemist, pixel-art redesign prep)

I only read code. Nothing was run or changed. Everything below is grounded in code reading.

Root is `D:\claude\echo-alchemist-REQ-20261006-pixel-art\`. Anchors are shorthand for these files:
- `idx` = `index.html`
- `uis` = `src\ui_system.js`
- `gs` = `src\game_system.js`
- `gp` = `src\game_phase.js`
- `sp` = `src\spawn_system.js`
- `cfg` = `src\config.js`
- `rc` = `src\rune_config.js`
- `sys` = `src\systems.js`
- `tut` = `src\tutorial_system.js`
- `shop` = `src\ui\shop.js`
- `rs` = `src\ui\run_shop.js`
- `rl` = `src\ui\rune_launcher.js`
- `go` = `src\ui\game_over.js`
- `css` = `src\styles\bitmap_ui.css`

### 0. How phases switch (one fact matters a lot)
- `phase_switchPhase` (gp:596) calls `ui_updateUI` (uis:1996). That hides every `.ui-overlay` and shows `#phase-<phase>`.
- The top bar is hidden on meta/shop/truth/training/relic/selection/gameover (uis:2101).
- **The ⚙️ button is the only way into pause/settings, and it lives in that top bar.** So settings can't be reached from the home screen, the workshop, relic picks or replace-ammo.
- A dev comment says the player-facing term table `UI_TERMINOLOGY` (sys:36-43) is the only source of truth for names. In practice almost nothing uses it.

### 1. Screen by screen

**Meta home `#phase-meta` (idx:4956-5031)**
- **Decision:** new run or continue, then workshop, truth book, training ground, or replay the tutorial.
- **Shown:**
  - 🔮 count + label "局外符文碎片" ← `meta_getResourceCount('rune_fragments')` (uis:736-740, 1953)
  - Continue button "Round N" ← `sys_getRunStateSummary` (uis:2322-2340)
  - "Ver 9.2 (Meta Progression)" and "Initialize Sequence" (English)
- **Actions:**
  - `meta_startRun` (uis:2305) → `sys_initGameStart` (gs:703), which queues a relic pick and a marble pack (gs:767-769)
  - `meta_continueRun` (uis:2313)
  - `meta_openShop` (uis:2342)
  - `ui_openTruthBook` (uis:2435)
  - `trainingGround.enter` (sys:5902)
  - `tutorial_restartFromHome` (tut:229)
- **Problems:**
  - Mixed scripts in one line: "繼續上次游戲" (idx:4994).
  - Button says "開始煉成" (idx:4986), the tutorial calls it "開始練成" (tut:74), and selection says "開始煉金".
  - No settings, records or unlock progress anywhere on this screen.
  - The CSS reuses the relic background and its comment calls this page the "meta shop" (css:1017-1023).

**Workshop / meta shop `#phase-shop` "煉金工坊" (idx:5318-5346; `ui_renderShop` shop:881)**
- **Decision:** spend currencies on permanent or next-run upgrades.
- **Shown:**
  - Header 🔮 with no label (idx:5327)
  - 8-cell resource overview from `META_SHOP_CONFIG.resources` (cfg:18-27), laid out in a 4-column grid, so it always wraps to 2 rows (idx:5334)
  - Category tabs (cfg:196-202)
  - Cards: name, 临时强化/永久强化, LV, cost, buy button (shop:985-1081)
  - Preview panel (shop:933-959)
- **Exit:** ⬅️ → `phase_switchPhase('meta')` (idx:5321).
- **Problems:**
  - **The header 🔮 repeats the first overview cell, and the two use different names:** "符文碎片" (cfg:19) vs "局外符文碎片" on the home screen.
  - **The 7 element-rune currencies are counted from the run's `runeInventory` (uis:1942-1956), which is wiped every run (gs:893).** Their balances appear after a game over and disappear after the next run starts.
  - **Player-facing debug tab:** `debugShopDefaultEnabled: true` (cfg:271) shows the "测试工具" category and "测试遗物任选" to players.
  - **Description doesn't match effect:** `combo_mastery` says it slows charge decay, but it actually lowers `initTriggerThreshold` (cfg:175-183).
  - Typos and mixed scripts: "插升" (cfg:64), "値" (cfg:86, 108), "減少" (cfg:34), "穿透解鎖" (cfg:131), "陣地防御" (cfg:198).
  - Trad vs simplified on the same screen: preview says "已達上限 / 臨時強化" (shop:942, 951), cards say "已达最高等级 / 临时强化" (shop:1021, 1045).
  - Bracket names in descriptions don't match the attribute names used elsewhere ("[反弹]", cfg:96).

**Relic pick `#phase-relic` (idx:5588-5605; `ui_showRelicSelection` shop:139)**
- **Entry:** round-start reward resolver (run start or an enemy "relic clue" drop, gs:2245-2275), or the debug picker (uis:2372).
- **Shown:**
  - 3–4 cards: icon/name/desc/stack count, plus a "新手推荐" badge, tags and tip only in the first 3 picks (shop:321-362)
  - Preview panel shows rarity as the raw English key, e.g. "rare" (shop:306)
- **Actions:**
  - Select → `ui_selectRelic` (shop:473). On touch it needs two taps, and the hint toast for that is hidden behind the overlay (see §2).
  - Reroll (only with relic `relic_reroll_seal`, shop:414-427)
  - Skip → `ui_skipRelic` (shop:800) gives +12 碎片 (cfg:1002) and always opens the run shop
- **Problems:**
  - Cards never show rarity text.
  - Same label in two scripts: "当前层数" (shop:332) vs "當前層數" (shop:288).
  - HTML default "放棄遺物 → 進入局內商店" (idx:5602) is overwritten at runtime with the mixed "放棄遺物 → +N 碎片并进商店" (shop:409).
  - Weight table typo `relicRarityWright` has no `epic` entry, so epic falls back to 10 (cfg:553-558, shop:247). Its comment says cursed = 10, but the value is 5.
  - UI fallback is 3 choices (shop:228) but the config default is 4 (cfg:940).
  - Relic `stars_shines` says "[回响弹珠]" but its `marbleType` is `resonance` (共鳴) (cfg:1675).

**Marble / fate selection `#phase-selection` (idx:5348-5402)**
- **Reachability:**
  - **Marble packs skip this screen entirely.** `sys_startMarblePackGrind` goes straight to gathering, and its toast lists raw keys like "pyro / cryo" (gs:1905-1955, 1942).
  - Standard mode "胚珠包" is only a fallback (gp:1633-1643, shop:792).
  - **Chaos/pure essence ("命運時刻") are no longer queued by any current producer** (only relic/marble_pack/resource-pack exist: gs:767-769, 2245; rs:637). The chaos slot machine, "跳过研磨" and "跳过混沌" buttons (idx:5391-5399) are effectively legacy.
- **Shown:**
  - Cards: icon, name, 2 tags, and an S/A/B/C tier hard-coded by marble type (sp:1240-1318)
  - Preview: "真理之書" description and "鉤釘 / 子彈效果" text, hard-coded in Traditional (sp:1380-1396)
  - Choice strip with "待选择" chips (uis:1021-1084)
  - Mode label / subtitle / confirm text (uis:1866-1898)
  - Reroll button with relic `fate_reroll_token` (uis:1899-1912)
  - 炼金台 entry (idx:5382)
- **Problems:**
  - Mode strings in three registers in one function: "純淨精華 / 混沌精華" (Traditional), "保留胚珠并开始炼金" (Simplified), "晶石核心" (a new term) (uis:1866-1898).
  - The rune-slot panel is English ("MARBLE RUNE SLOTS / EMPTY / Select this marble…", uis:1175-1199), as are toasts like "Rune slots full." (uis:1098-1134).
  - **Dead code:** `ui_selectPureEssenceRune` returns on its second line (uis:1138-1139), and `ui_renderPureEssencePanel` early-returns (uis:1223-1226). The Traditional-Chinese injection UI below them is unreachable. As a result, `ui_confirmSelection` always toasts "未注入符文" even after the player fuses runes (uis:2271-2274).
- **Chaos slot machine** (`#chaos-slot-machine-overlay`, idx:5405; uis:1282):
  - **Shows the wrong number:** non-jackpot result reads "+2" (uis:1404), but the code applies +1 (gs:1686).
  - Its slot labels "伤害/反弹/冰/火/雷" (gs:1670-1674) don't match the attribute display names.
  - English title "CHAOS UPGRADE"; styling is all inline.

**Replace-ammo (same `#phase-selection` DOM; `sys_initReplaceAmmoPhase` gs:1287, called after every grind from gp:3892)**
- **Decision:** which 3 rounds go into combat — new grind ("✨ NEW GRIND", English) or carried-over charged ammo ("⚡ CHARGED", English).
- **Shown:** C/B/A/S tier computed from a stat sum (uis:1483-1530), dominant-attribute theme, up to 4 attribute rows from `CONFIG.ui.attributeDisplay`.
- **Actions:**
  - Toggle a card (uis:1761)
  - "确认（已选 n/m）" → `sys_confirmReplaceAmmo` (gs:1367)
  - "跳过，使用新研磨子弹" → `sys_skipReplaceAmmo` (gs:1457)
  - Default picks copy last round's choices (gs:1303-1338)
- **Problems:**
  - **The C/B/A/S letters mean something different from the marble cards' letters** (type-based, sp:1245 vs stat-based, uis:1483).
  - The layout hack rewrites the parent's inline styles (uis:1539-1544) and only gets cleaned up on confirm/skip (gs:1427-1442, 1492-1506).
  - It is the most-used selection screen but still inherits the "命運抉擇" scaffolding.

**Run shop `#run-shop-overlay` + offer `#run-shop-offer-overlay` + dock `#run-shop-status-dock` (rs; idx:4865-4876)**
- **Entry:** offer → `ui_showRunShop` (rs:287, 345); dock button "商店" (rs:704-709); relic skip.
- **Shown:**
  - "持有 N 🔮" ← `runFragments` (rs:379, 500)
  - Items: pack, module, skill, slot, rune (rs:110-177); rarity-colored borders (rs:475-477)
  - Refresh cost (rs:506); dock "商人旅程 / N 回合后到访 / 商人已到访" (rs:686-697)
- **Problems:**
  - **The in-run currency uses the same 🔮 icon and purple as the meta currency.**
  - Names change across views: "局内商人" (rs:376) / "局内商店" (rs:499) / dock "商店" / game-over "前往商店", which actually goes to the meta workshop (go:480).
  - **Rune items show "pyro 符文"** because `RUNE_DB` has no `desc` (rs:172).
  - Module meta shows the raw rarity key uppercased, e.g. "COMMON" (pinboard_modules.js:1664, rs:478).
  - Traditional strings plus a typo in Simplified context: "解鎖回溯槽…鑒池", "特殊槽數量 / 當前" (rs:38-41, 162, 591).
  - **When nothing is affordable, "进入商店" is disabled, so the player can't even browse** (rs:368-384). Choosing "继续" clears the stock, so the dock regenerates a fresh one (rs:401).
  - All inline styles; untouched by the bitmap theme.
  - Shield has three names in this one flow: "护盾" (rs:88) vs "防线屏障" (rs:278) vs "守护者结界" (idx:4922).

**炼金台 `#phase-rune-launcher` (idx:5034-5315; rl)**
- **Open/close:** `ui_openRuneLauncher` (rl:158) from three entries with three labels — "炼金台" in selection (idx:5382), ⚡ float button in gathering (idx:5447), "⚡ 符文" in the combat dock with title "符文配置" (idx:5471). `ui_closeRuneLauncher` (rl:337). On PC it stays docked in the right sidebar (uis:2215).
- **Header:**
  - **Shows meta "局外符文碎片" (rl:310-330), but the potion tab refunds "局内碎片" (rl:1998, 2494) and merge pays meta fragments (rl:1385).** Two currencies on one screen, only one visible.
  - **The in-run balance is never shown in any HUD.**
- **Tab "⚡ 符文配置" (configuration):**
  - 3×3 grid: clicking an empty cell opens the picker; **clicking a filled cell removes the rune instantly, with no confirm** (rl:438-464)
  - Inventory list shows the raw `element` key (rl:1002)
  - Hint text (rl:960-977); "一键排布" (rl:3162)
  - Active runewords with dynamic description and raw `k+v` stat keys (rl:1146-1147)
  - 钉板融合影响 (rl:2218-2271): its text says "发射器" and "采集"
  - 属性共鸣 at 3/6/9 layers (rl:1223-1285)
  - 属性加成汇总, including the redundant label "词条共鸣（词条共鸣加成）" (rl:1205)
- **Tab "⚗️ 仓库管理" (management):**
  - Hint says "熔炼或重铸" (idx:5132), but the button says "合成" and its panel is titled "合成爐" in Traditional (idx:5156), next to "重铸炉" in Simplified.
  - Merge button shows a raw id: "合成 → pyro Lv.2" (rl:1324).
  - Toast "最多選中 3 個符文" is Traditional (rl:1073).
- **Tab "🧪 药剂" (potion; hidden until relic 贤者药匣, idx:5054, rl:2585):**
  - Ledger count is English: "current node · in furnace" (rl:2169)
  - Native `window.confirm` dialogs (rl:2012, 2459)
- **Tab "📖 图鉴" (codex):** discovered/total count, filter by rune, Lv tabs (rl:2675-2833). Introduces another new term, "穿心法阵" (rl:2773).
- **Rune picker `#rune-picker-overlay`:**
  - Mixed script: "選擇符文放入格子 / 長按可預覽詞条效果 / 預覽新觸發詞條" (idx:5296-5305), "放入格子後" (rl:577)
  - Runeword detail popup mixes scripts: "符文組合 / 等級" (rl:2651, 2655)
- **Dead references:** `#meta-rune-active-badge` (rl:885).

**Skill editor `#skill-editor-overlay` (idx:5506-5518)**
- **Open:**
  - `ui_openSkillEditor` (rl:3396) from the combat dock button, whose text is "✎ 技能 n/4" but title is "技能装配" (combat_system.js:1910-1921)
  - Forced open when a new skill overflows the cap (combat_system.js:1931)
- **Close:** ✕ or backdrop (rl:3406-3411).
- **Shown:** "已装备 n/cap" (cap 4, cfg:1017); cards with icon/name/SP cost/description/source (基础/词条/遗物/商店) and an equip toggle (rl:3476-3509).
- **Problems:**
  - **Forced mode can be dismissed without resolving it.**
  - **No pause lease is taken, unlike relic (shop:162), run shop (rs:326) and pause (uis:2517).**
  - "Locked" cards stay clickable.
  - The potion lives on the skill bar (rl:2110) but doesn't appear here.

**Truth book `#phase-truth-book` (idx:5521-5586; `TruthBook` sys:6006)**
- **Open/close:** from home, or from the 炼金台 codex link "查看主解释" (idx:5271 → sys:6180). Close returns to the previous phase (uis:2471).
- **Shown:**
  - 6 category tabs: Boss / 敌人词缀 / "V2 基底" / 属性百科 / 主动技能 / 核心机制 (sys:522-529)
  - Search box; entry count "X · N 项"
  - Detail panel: icon/name/tags/description, optional "打开炼金台" button (sys:6230-6240), demo canvas, log, reset
- **Problems:**
  - **Dev jargon shown to players:** "V2" and raw `基底=${baseArchetype}` / affix keys (sys:61).
  - English chrome: "SELECT AN ENTRY TO ANALYZE", "SIMULATION MATRIX", "Liber Veritatis".
  - Entries are Traditional ("護盾魔像", sys:99) while category names are Simplified.
  - **No relic, rune, runeword or potion categories.** The runeword codex lives only in 炼金台.
  - **Attribute info is written three separate times:** here; in a hard-coded drawer "配方圖鑑" whose laser entry is called "光球 (Laser)" (idx:5647-5677); and in the marble preview (sp:1380).
  - Dead elements: `#truth-enemy-list` and `#truth-attr-list` (idx:5536-5537).

**Training ground `#phase-training` (built at runtime, sys:4075-4656)**
- **Open/close:** `enter` (sys:5902) and "退出" → `exit` (sys:4582, 5959).
- **Shown:**
  - Top: "Combat Simulation", "DPS / TOTAL", the combat-status panel (whose labels are English: uis:799-812)
  - Bottom tabs: 子弹编辑 / 敌人配置 / 技能测试
  - Right sidebar with 8 categories, including dev-only "V2" and "驗收" (sys:5237-5245)
- **Problems:**
  - Four names for one place: "試煉場" (idx:5018) / "试炼" (uis:2111) / "训练场" (sys:4582, 5228) / "训练配置" (idx:4838).
  - Attribute labels differ here: scatter "分裂", cryo "冰冻" (sys:4670-4680); chips abbreviated ATK/BNC/PRC (sys:5206-5214).
  - "技能" appears in both navigation layers; the "符文" tab is actually runewords.

**Pause `#phase-pause` (idx:5689-5780)**
- **Open/close:** `ui_openPause` (uis:2509) via ⚙️ (idx:5941-5948); `ui_closePause` (uis:2529).
- **Shown:**
  - Toggles: sound, damage numbers, CRT, pixel art (reloads the game)
  - Two volume sliders; render quality low/mid/high/auto (`ui_syncPauseSettings` uis:2562)
  - Relic list in inline styles, no rarity (uis:2623-2652)
  - "放弃本局" uses native `confirm()` (idx:5768)
- **Problems:**
  - Missing run context: no round, currencies, runes, potion or skills.
  - `.pause-relic-card` rarity CSS is never used (idx:3935-3952).

**Settings panel `#settings-panel` (idx:4930-4947)**
- **It's dead.** ⚙️ now opens pause (idx:5941-5946), but the panel still has CSS in three files (idx:1611; pixel_assets.css:148; css:901).
- CRT label: markup default says "关闭" (idx:4944), but the logic defaults to ON (idx:5861).

**Round-start banner (idx:4851-4863; `sys_showRoundStartBanner` gs:2637)**
- **Shown:** "第 N 回合開始" in Traditional (gs:2694), with a Simplified threat line from `_getRoundStartBossThreat` (gs:74-95).
- **Round format varies across screens:** "R N" (idx:4925) / "Round N" (uis:2332; gs:89) / "R{n}" and "共 N 回合" (go:263, 295).

**Game over `#phase-gameover` (go)**
- **Entry:** `_gameover_triggerPhase` (go:40).
- **Shown:**
  - Timeline (go:221-325)
  - Damage, kills, relics (go:333-383)
  - 4 currency cells: gained / leftover with 🧩 icon, carry-out 30% / settled with 🔮 icon (go:430-455)
  - Runes
- **Buttons:** 前往商店 / 再来一局 / 返回首页 (go:471-526).
- **Problems:**
  - **"获得符文" actually lists the end-of-run inventory, not runes gained** (go:153). Runes spent on merges or potions are missing.
  - **The tutorial victory still marks the last node red with legend "失守回合"** (go:267, 320 vs 193-203).
  - Rarity colors: cursed shows purple and epic shows grey (go:338-343).
  - Boss short names "炎核 / 冰晶 / 微核…" (go:20-31) don't match the banner's split full names like "伊格尼斯" (boss_schedule_utils.js:18-22). There's also a typo "燕炉守卫" in BOSS_DB (cfg:2559) vs "熔炉守卫" in bossConfigs (cfg:681).

**Tutorial (tut:46-177, DOM tut:347-453, z-index 9000-9002)**
- 6 steps covering only home → relic → gathering → combat. It never mentions replace-ammo, 炼金台 or the shops.
- Step 3 promises "自动进入战斗阶段" (tut:122), but the replace-ammo screen usually comes first.
- English "Step n / N" counter; font is Noto Serif TC (a Traditional-Chinese font) for Simplified copy (tut:400).

**Toasts (`showToast` src\utils\math_utils.js:133-142; `#toast` idx:4952, CSS idx:2856)**
- **Only one toast at a time, the last one wins, fixed at 1.5 s.** The duration argument is ignored (calc_utils.js:81 passes 2000), and the resolver's chained toasts overwrite each other.
- **z-index 200 inside `#game-container`, so toasts are hidden under:**
  - the relic overlay (200, later in DOM)
  - 炼金台 (300)
  - the run shop (244/245)
- **Toast language is all over the place:**
  - Traditional: "獲得遺物" (shop:517), "強敵來襲" (gp:2429)
  - Typo: "沒有敢人可攻擊" (combat_system.js:1760)
  - English: "Fused marble is locked…" (gs:2819), "HASTE APPLIED" (gp:2337)
  - Mixed: "放棄遗物，获得" (shop:816)

### 2. Cross-cutting layout and material problems
- **Overlay z-order** (no shared layer system):
  - toast and meta/selection/relic: 200
  - run-shop offer/shop: 244/245
  - 炼金台, workshop, truth book: 300
  - rune picker, game over: 400
  - chaos slot machine: 500
  - skill editor, runeword detail, info drawer: 600
  - pause: 900 (set from JS)
  - tutorial: 9000+
- **Four styling systems are layered:**
  - Tailwind utility classes
  - A large inline `<style>` in idx (e.g. relic rarity at idx:3255-3330 has no epic)
  - `bitmap_ui.css` with `!important` 9-slice borders that override it (css:85-125)
  - JS inline styles: run shop, chaos slot machine, runeword detail, pause relics, replace-ammo cards
- **Dead DOM/IDs:**
  - `#meta-currency-value` (uis:738), `#rune-count-value` (uis:743), `#shop-rune-count` (shop:915), `#slow-motion-overlay` (uis:725)
  - `#phase-title-container` "回聲煉金師 / 點擊開始" (idx:4879-4882)
  - `#settings-panel`, `.pause-relic-card`

### 3. Shared vocabulary as it stands today

**Currencies**

| Concept | Names in use | Icon / color |
|---|---|---|
| Meta fragments (`saveData.resources.rune_fragments`) | 局外符文碎片 (idx:4967; rl:326; go:448); 符文碎片 (cfg:19); unlabeled (idx:5327) | 🔮, purple `#a855f7` |
| In-run fragments (`runFragments`) | 局内碎片 (go:440); 碎片 (rs:480; shop:816); 持有 (rs:379); 局内资源包 (gs:2492) | 🔮 (rs, floating text sp:1123), 🧩 on game over (go:439), amber `#fbbf24` |
| Element runes used as meta currency | 火焰符文 … (cfg:20-26) | Colors conflict with attributes (see below) |
| Others | SP / 技能点 (cfg:64, 120); 装药 = potion charges (rl:2152) | — |

**Rarity**
- **Relics:** common/rare/epic/legendary/cursed, shown as raw English (shop:306) or not at all.
  - rare: blue `#3b82f6` (idx CSS) vs `#60a5fa` (go)
  - legendary: `#facc15` vs `#f59e0b`
  - cursed: red (idx/css) vs purple (go:342)
  - epic: missing in idx CSS and go
- **Runes (`RARITY_DISPLAY`, rc:537-542):** 普通/稀有/史诗/传说.
  - Colors there: `#aaa / #4a90d9 / #9b59b6 / #f39c12`
  - Run shop uses `#94a3b8 / #3b82f6 / #a855f7 / #facc15` (rs:475)
  - Game over uses `#94a3b8 / #60a5fa / #a855f7 / #f59e0b` (go:404-409)
- **Pinboard modules:** raw English, uppercased.
- **Marble cards:** S/A/B/C by type (sp:1245).
- **Ammo:** C/B/A/S by stats (uis:1525-1530): B green `#34d399`, A purple `#c084fc`, S yellow. Letter grades and word tiers are never mapped to each other.

**Attributes** — sources are `attributeDisplay` (cfg:293-313), `STAT_DISPLAY` (rc:518-530), chaos labels (gs:1670), training (sys:4670), truth book (sys:266-497) and meta resources (cfg:20-26):

| Attribute | Names | Icons | Colors |
|---|---|---|---|
| bounce | 彈性 / 弹跳 / 反弹 / 弹射符文 | ⤴️ / 🔄 | `#22c55e` vs `#a3e635` |
| pierce | 穿透 | ↗️ / 💠 | `#ef4444` vs resource `#f97316` vs resonance blue |
| scatter | 散射 / 分裂 | 🔱 / 🌟 | `#facc15` vs resource `#c084fc` (swapped with lightning) vs resonance pink |
| lightning | 閃電 / 闪电 / 雷 | ⚡ | `#c084fc` vs resource `#facc15` vs resonance yellow vs training blue |
| pyro / cryo | 火焰 / 火; 冰霜 / 冰 / 冰冻 | — | pyro `#f97316` vs resource `#ef4444` |
| laser | 光 / 激光 / 光球 | ☄️ / 🔦 | `#0ea5e9` vs resource `#34d399` vs resonance orange (rl:1239-1247) |
| damage | 增幅 / 伤害 / ATK | — | — |
| venom | 剧毒 / 毒素 / 毒 | — | — |
| echo | 回响 / 回響 | 🔊 / 🔁 | — |
| overcharge | 超载 | ⚡ / 💥 | — |
| resonance | 共鳴 (the relic calls it 回响弹珠) | — | — |

**Levels**
- Rune Lv.1-3 badge (rl:34-48); merging 3 identical runes gives +1 level.
- Runeword Lv.1-3, labeled "等级" or "等級".
- Resonance at 3/6/9 layers is called 一阶/二阶/三阶 (rl:1250) in 炼金台 and "T1 (3层)" / "1/2/3 階" in training (sys:5466, 5242).

**Other overloaded terms**
- **词条/詞條:** means runewords, enemy affixes (idx:5619 "特殊詞條"; sys:61 "专属词条"), *and* the "词条共鸣" bonus.
- **Gathering phase:** 研磨 / 收集阶段 / 采集 / 炼金.
- **Peg:** 钉子 / 釘子 / 鉤釘 / 钉板 / 钉盘.
- **Marble:** 弹珠 / 彈珠 / 胚珠 / 晶石核心.
- **Places:**
  - 炼金工坊 = meta shop vs 炼金台 = in-run rune screen, also called 符文配置 / 符文发射器 / 发射器
  - 商店 means both shops
  - 真理之书 / 真理之書 / Liber Veritatis
- **Shield:** 守护者结界 / 防线屏障 / 护盾.
- **⚡ icon:** used for lightning, overcharge, the 炼金台 entry, 一键排布 and the SP upgrades.

### 4. Priorities for the redesign
1. Lock one name, one icon and one color per concept, and actually wire `UI_TERMINOLOGY` into every screen.
2. Pick one script; Simplified is the majority today.
3. Show both currencies everywhere they matter, with distinct icons.
4. One rarity scale, with an explicit mapping to the letter tiers.
5. Decide what to do with the legacy fate-moment / chaos / pure-essence UI and the dead settings panel.
6. One overlay layer stack, with toasts above modals and a queue.
7. Make settings reachable from the home screen.
8. Hide debug and V2 developer content from players.
9. Fix the four places where the label doesn't match the data: chaos "+2" vs +1, `combo_mastery`, "获得符文", and the tutorial-clear timeline.
