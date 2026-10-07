# 局内 HUD（研磨 / 战斗）信息架构审计

> 2026-10-06 只读代码审计（REQ-20261006-pixel-art 重设计输入）。基线：分支 codex/REQ-20261006-pixel-art @ d97d8ba；行号以该基线为准，后续改动会漂移。

# In-run HUD audit: GATHERING and COMBAT

## Files and conventions
- **Root:** `D:\claude\echo-alchemist-REQ-20261006-pixel-art\`
- **Anchors below are relative to that root:** `index.html`, `src/ui/hud.js`, `src/ui_system.js`, `src/systems.js` (UIManager), `src/render_system.js`, `src/game_phase.js`, `src/game_system.js`, `src/combat_system.js`, `src/spawn_system.js`, `src/entities.js`, `src/entities/enemy.js`, `src/utils/ammo_readability.js`, `src/ui/run_shop.js`, `src/styles/bitmap_ui.css`, `src/styles/pixel_assets.css`.
- **Refresh paths:**
  - `ui_updateUI` (ui_system.js:1996) runs only when the phase changes.
  - `ui_updateCombatStatusPanel` runs every frame, throttled to 180 ms (game_system.js:533, ui_system.js:769).

---

## A. GATHERING (phase `gathering`)

### A1. What is on screen

**Top bar** (`#unified-top-bar.is-gathering`, index.html:4885)
- `#top-phase-label`: shows "研磨" (ui_system.js:2107-2115).
- `#sp-panel` SP gems:
  - Data: `skillPoints`, drawn by `UIManager.updateSkillPoints` (systems.js:1237).
  - Called at gathering start (game_phase.js:694).
  - Made visible in gathering by combat_system.js:1899-1907.
- `#shield-pill` "🔰N": `playerShield`, written by ui_system.js:747-757. It is only refreshed from `ui_updateUI` (ui_system.js:2046).
- `.round-pill` "R N" (`#round-num`): `round`, written at game_phase.js:2490 and game_system.js:908/4456.
- `#speed-btn` "1x/2x/3x/慢": `baseTimeScale` (game_system.js:1118-1144).

**Merchant dock** (`#run-shop-status-dock`, index.html:4865)
- Shows "商人旅程 · N 回合后到访" plus a progress fill and a 商店 button (run_shop.js:659-711).
- Data: `sys_getRunShopScheduleState()`.
- Refreshed only from `ui_updateUI` (ui_system.js:2047) and game_system.js:1966.
- Sits top-centre (index.html:1759).

**Static hint:** "點擊上方區域釋放" (index.html:5418). It never changes.

**`#hero-gauge-container`** has a static header "AMMO CHARGE" (index.html:5422) and two modes:
- **Legacy mode (one marble):**
  - `#hit-text` "cur/target" and `#hit-bar` show `session.currentHits / nextTriggerThreshold`.
  - Updated through the `UI_HIT_PROGRESS` event (spawn_system.js:2379, 2458 → hud.js:1282).
  - `#multicast-ui` "SHOTS xN" = 1 + `currentSession.multicast` (combat_system.js:1437 → hud.js:1224).
- **Panel mode (more than one marble):** up to 3 `.gathering-ammo-panel` in `#session-charge-stack` (hud.js:857-988). Each shows:
  - "弹 N" and the marble name;
  - "cur/target" (`session.currentHits` against `nextTriggerThreshold` or `persistentThreshold`);
  - attribute chips that sum **levels** from `session.collected`, or "待收集" if empty;
  - "x(1+multicast)".
  - The whole stack is rebuilt on every hit event (hud.js:1225, 1283).

**`.bottom-panel`** (mobile only)
- `#gathering-queue` dots (hud.js:1074) and `#gathering-hud-mount` recipe cards (hud.js:740-748, 762-855).
- Data: `marbleQueue[i].collected`, counting **occurrences**.
- Hidden whenever the panels are shown (index.html:564).
- On PC both are moved into the left sidebar and stay visible (ui_system.js:2210-2213).

**Buttons**
- `.rune-launcher-float-btn` ⚡ (index.html:5447).
- `.me-edit-entry` "编辑钉板 库存 N" (ui_system.js:2674-2690; shown from game_phase.js:712).

**Canvas**
- Peg level "L{n}" (entities.js:5387).
- Special-slot labels (entities.js:576-582, 878).
- Bottom reward zones "+label" (game_phase.js:521).
- Drop heatmap plus layout hint text (game_phase.js:4444-4483).
- Fortune wheel.
- "LEVEL UP!" floating text (spawn_system.js:2457).
- Toast "充能！下一次: N" (entities.js:3104).

### A2. Problems

1. **The same collection is shown twice, counted two different ways.**
   - The panels sum levels from `session.collected` (hud.js:948-952).
   - The recipe cards count occurrences in `marbleDef.collected`.
   - `marbleDef.collected` receives bare type strings with no level (entities.js:3189, 3257, 3332).
   - Synthesis (cryo + pyro → lightning) removes the ingredient from the session list only (entities.js:3271-3285). The card therefore shows 熱 + 雷 while the panel shows only 雷.
   - The two are only reconciled at the end of gathering (game_phase.js:3848).
   - From round 2 on, `marbleDef.collected` holds `{type, level}` objects. `ui_renderRecipeCard` uses the raw item as its map key (hud.js:782-785), so those entries are silently dropped from the card.
   - On PC both views are visible at once.
2. **The labels don't say what the bar measures.**
   - "AMMO CHARGE", "SHOTS" and "LEVEL UP!" all actually mean "+1 multicast shot".
   - In panel mode the "x1" has no label at all.
   - The target grows by 8 after each level-up (spawn_system.js:2430) and resets to 15 at the start of each gathering (game_phase.js:692; config.js:970-971). None of this is explained.
   - The HTML placeholder says "0/5" (index.html:5440); the real starting value is 15.
3. **"AMMO CHARGE" is left orphaned.** In panel mode only the gauge shell and the multicast badge are hidden (hud.js:892-895); the header stays above the 3 panels.
4. **SP is shown in the wrong phase.** SP gems appear in the gathering top bar (combat_system.js:1901), but SP can't be earned or spent there: the skill-point slots were removed (combat_system.js:1883-1888) and SP now comes only from the combat charge bar.
5. **Multicast shows different numbers in the two phases.** Gathering shows the uncapped "x(1+multicast)" (hud.js:981). The combat launcher clamps the display to x6 (ammo_readability.js:83).
6. **Highlight and dot order are wrong during a batch drop.** `activeMarbleIndex` stays at 0 while all three marbles drop together (game_phase.js:1789). So recipe card 1 is always highlighted as "current" (hud.js:743), and the dots are drawn starting from index 0 (hud.js:1083).
7. **Wrong currency is visible; the right one is missing.**
   - The in-run currency `runFragments` (局内碎片) is never shown on the HUD in either phase; it only appears inside the shop overlay (run_shop.js:351, 468).
   - The ⚡ alchemy-table header shows the **meta** fragments, labelled "局外符文碎片" (rune_launcher.js:311-325).
8. **Dead button.** `#skill-editor-open-btn` is switched on during gathering (combat_system.js:1912), but it sits inside `#phase-combat` (index.html:5495), which is hidden in gathering.

### A3. Player decisions and the state they need

| Decision (logic anchor) | State needed | Priority |
|---|---|---|
| Where to tap: the X position for the batch drop; 3 marbles fan out left-to-right by index (game_phase.js:1784-1805, 1857) | Peg types and levels, special slots, reward zones, drop-distribution hint, which ball is 弹1/2/3 | Primary |
| Tilt nudge during the fall: grip at bottom-centre or device tilt (game_system.js:3197-3203, 3237-3243; physics entities.js:2535-2554) | The balls and board; current tilt amount | Primary / secondary |
| Spin the fortune wheel (game_system.js:3193-3196) | Wheel position and state | Primary while it exists |
| Edit board modules / fuse runes before the drop | Inventory count | Secondary (button) |
| Track the result of each marble | Collected attributes (as the projected recipe), multicast progress cur/target, current xN | Primary, compact |
| | The threshold growth rule | Secondary (tooltip) |
| Strategic planning | Round, boss countdown, merchant countdown, `runFragments` | Secondary |
| | SP, skill bar, enemy counts, damage stats | Not needed |

---

## B. COMBAT (phase `combat`)

### B1. What is on screen

**Top bar** (`.is-combat`)
- "战斗" label.
- `#combat-status-panel` (ui_system.js:759-872), from left to right:
  - 敌 = active enemies;
  - 精英 = elite count;
  - Boss = boss count;
  - 威 = boss silhouette plus a label: "未知 4", "<名> N", "交战" or "本回合" (ui_system.js:52-89);
  - enemy shield layers;
  - 弹 = `ammoQueue.length`.
- `#combat-threat-pill` and `#combat-status-note` are written to but hidden with `display:none` (index.html:1194, 1203).
- `#sp-panel` is hidden by CSS (bitmap_ui.css:1883).
- Shield pill, R N, speed and settings work the same as in gathering.

**Merchant dock** `.is-combat-top`: top-centre (bitmap_ui.css:1887).

**Round banner** `#round-start-banner`
- "第 N 回合開始", with threat lines "下一威胁 / 未知 Boss · N 回合后 / Round X · 剪影预告".
- Written by game_system.js:2637-2730; formatter at game_system.js:74-95.

**Left dock wing** (`#recipe-hud-container`, hud.js:611-727)
- NEXT slot = `ammoQueue[1]`: icon, "NEXT", shape label, an unlabelled damage number, and 4 attribute chips.
- Queue chip = `ammoQueue[2]`, labelled by CSS `::after` "NEXT 2" (bitmap_ui.css:4706).
- Also: "+N" overflow, "NO QUEUE", "QUEUE EMPTY".
- Buttons: 📊 damage stats and ⚡ 符文.

**Right dock wing**
- `#skill-bar` (systems.js:1093-1235):
  - title "技能" or "技能 / 药剂";
  - SP gems, at most 5 drawn;
  - 3–4 skill buttons with a bare cost number;
  - disabled reasons "SP不足 / 仅战斗可用 / 敌方行动中";
  - potion button showing "charges/max".
- Charge bar `#combat-rune-charge-ui` (actual + temporary charge):
  - Events: `UI_SKILL_CHARGE_*` (combat_system.js:5821-5936 → hud.js:1322-1446).
  - The "技能充能" label and the "SP" slot are hidden (bitmap_ui.css:3012-3016, 3654-3658).

**Centre message** `#combat-message`: "⚠️ ENEMY TURN" (game_phase.js:2295-2300) and "彈藥耗盡 / 點擊收集新彈药" (game_phase.js:3580).

**`#info-drawer`** (on demand when an enemy is tapped; permanently docked on PC)
- Shows "HP: x/max", temperature, statuses, affixes (systems.js:1257-1351) and the damage tab (hud.js:342-551).

**Canvas**
- **Launcher readout** of `ammoQueue[0]`: "DMG" + value, multicast cells + "xN", 6 attribute icons with values (render_system.js:560-712, called from game_phase.js:3725/3804). Hidden while idle.
- **Aim guide** for `ammoQueue[0]` (game_phase.js:3395-3451).
- **Defeat-line label:** "警戒线", "警戒线 危险" or "防线屏障 N" (render_system.js:182-226).
- **On each enemy:**
  - liquid HP fill (enemy.js:5588);
  - HP number, using `displayHp` with no max (enemy.js:9799);
  - defense icon + value cluster (enemy.js:9758-9869);
  - up to 3 status badges, e.g. 毒N, 热/冻, 屏%, 破N, 隙% (enemy.js:9871-9967);
  - tier tag 首领 / 精英 / archetype / 2×2 (enemy.js:9211-9266);
  - heavyArmor "⏳N" (enemy.js:6667-6675);
  - boss move label (enemy.js:8483-8579);
  - intent panel, shown only while telegraphing (enemy.js:7766-7895);
  - chimera "热N 寒N 流N" (enemy.js:6148);
  - frost seam "减伤X%" (enemy.js:6035).

### B2. Problems

1. **Every damage readout is the raw, pre-fire value.**
   - The launcher DMG / xN, the dock damage number, the aim guide and the status note all read the unmodified recipe.
   - Changes applied at fire time are never shown:
     - flat bonus, bandolier and opening salvo (combat_system.js:4836-4855);
     - runeword transforms, including multicast→scatter and focused fire (combat_system.js:4860-4932);
     - thunder_coil, desperation, attribute_protocol, greedy_wheel and chaos_pact ×2 (combat_system.js:5012-5066).
   - The only place that lists these bonuses, `_buildInheritanceCard` (hud.js:1595), is built every render but hidden by `#combat-bottom-dock .recipe-card:not(.ammo-readout){display:none}` (bitmap_ui.css:2140).
2. **"Next" means different things in different places, and the current shot has no label.**
   - The launcher draws `ammoQueue[0]`, but the code calls it "next": the variable `nextAmmo` (game_phase.js:3725) and the doc comment "下一发" (render_system.js:557).
   - The hidden status note says "Next {ammoQueue[0]}" (ui_system.js:800-802).
   - The dock's "NEXT" is `ammoQueue[1]` (hud.js:625, 656), and its "NEXT 2" is `ammoQueue[2]`.
   - With one shot left, the dock says "NO QUEUE" while 弹 still reads 1 (hud.js:631-635 vs ui_system.js:852).
   - A matryoshka shot swallows the following ammo as its payload (combat_system.js:4811-4813), yet the dock still lists that ammo as a separate NEXT.
   - "+N" (hud.js:714) can't really trigger, because the queue is capped at 3 (game_phase.js:1595-1597).
3. **Top-bar numbers have no labels on phones.** At ≤720px the labels are hidden (index.html:1314-1322), and the 精英 and shield counts are hidden too (index.html:1323-1329). The result is the "12 0 未知4 3" the owner sees: 4 is "turns until the boss", with no unit.
4. **Boss countdown is formatted two different ways, and the round is written three ways.**
   - ui_system.js:52-89 produces "未知 4" / "交战"; game_system.js:74-95 produces "未知 Boss · 4 回合后".
   - The round appears as "R 1", "第 1 回合開始" and "Round 5".
   - While a boss is on the field, it shows twice: "Boss 1" and "威 交战".
5. **SP is shown twice, with different rules, and the charge bar has no label.**
   - `#sp-panel` (systems.js:1237) has an unbounded max; it is still updated in combat but hidden there.
   - The skill-bar gems are capped at 5 (systems.js:1119-1124).
   - Empty gems are drawn at opacity 0.18 (bitmap_ui.css:3553-3560), so the player can't see capacity.
   - The cost badge is a bare number (systems.js:1167).
   - The charge bar is a 5–7 px strip with no label.
   - The "+N SP" feedback is written into a hidden slot (hud.js:1408).
   - At the SP cap the bar stays pinned full with no "MAX" (combat_system.js:5887-5891).
   - After a level-up the bar is forced to 0% after 400 ms even if charge remains (hud.js:1371-1386).
6. **The barrier pill goes stale and its tooltip is wrong.**
   - The pill only refreshes on phase change, but `playerShield` drops during the enemy turn (enemy.js:1517).
   - The canvas "防线屏障 N" label is live (render_system.js:193), so the two disagree.
   - The tooltip says each impact costs 1 layer (ui_system.js:755). Actual damage is footprint cells, ×2 with siegeBreaker (enemy.js:1255-1260).
7. **The player never sees enemy intent while aiming.**
   - Intent is chosen during the enemy turn (enemy.js:3286-3310) and drawn only while telegraphing (enemy.js:7768).
   - Move countdowns are drawn only for heavyArmor (enemy.js:6636-6675) and bosses (enemy.js:8485).
   - Spawn also gives `_moveInterval` to siege, carrier, gravityWell and large enemies (spawn_system.js:3425-3429), but only boss and heavyArmor logic reads it (enemy.js:3504-3511, 3823-3833). Confirm the intended behaviour before designing a move-countdown widget.
8. **Enemy HP has no max, and the drawer goes stale.** The HP number has no max. The drawer is a snapshot taken at tap time (systems.js:1271) and never refreshed. On PC it is always on screen (ui_system.js:2206-2208).
9. **Duplicated and overlapping text on enemies.**
   - Chimera stacks are drawn twice: "热N 寒N 流N" at y = −h/2−18 (enemy.js:6148) and the "热核/寒核/流彩" badges at −h/2−12 (enemy.js:9910-9912).
   - "减伤X%" (enemy.js:6035) duplicates the badge "霜缝N-X%" (enemy.js:9916).
   - The tier tag (left, y −h/2−19; enemy.js:9254-9255) and the status badges (right, y −h/2−12±7; enemy.js:9951-9952) share one strip, so they collide on 1-cell enemies.
   - The tier tag is drawn before the boss sprite (enemy.js:7032 vs 7144), so boss art can cover it.
10. **The dock likely overlaps itself on phones.** This is computed from the CSS and needs a screenshot to confirm.
    - The mobile action column is top 10px, 44px wide, two 44px rows (bitmap_ui.css:4496-4502), plus right 8.2% (bitmap_ui.css:4780). That is about x 59–92%, y 10–104px of a ~135×120 wing.
    - Under the 📊/⚡ buttons fall:
      - the queue strip (y ≈30–52, x 24–93%; bitmap_ui.css:4664-4672);
      - the damage badge (x 62.5%, y ≈52–67; bitmap_ui.css:4599-4607);
      - attribute chips 3–4 (x 25–77%, y ≈89–111; bitmap_ui.css:4610-4618).
11. **The empty-ammo message gives a wrong instruction.** "點擊收集新彈药" asks for a click, but the enemy turn starts on its own (game_phase.js:3630-3631). The UI also mixes traditional and simplified Chinese with English ("ENEMY TURN", "NEXT", "DMG", "NO QUEUE", and "Combat/Clear/Boss/Elite" at ui_system.js:799-812).
12. **The potion can disappear.** The skill bar is hidden when there are no skills (ui_system.js:2088-2089; combat_system.js:1897), even though a potion-only bar is rendered (systems.js:1114).
13. **The rune-claim animation flies to the wrong place on phones.** Its target, `#rune-inventory-count`, is inside the hidden alchemy overlay (hud.js:1492). The element has a 0,0 rect, so runes fly to the top-left corner.

### B3. Player decisions and the state they need

| Decision (logic anchor) | State needed | Priority |
|---|---|---|
| Aim direction; speed is fixed at 12 (game_system.js:3124) | Current shot's **final** stats (damage, pierce/bounce/scatter/multicast, elements); aim guide; enemy positions, HP, shield layers | Primary |
| | Shields can be bypassed by hitting from above (enemy.js:8753-8770) | Primary |
| Sequencing the remaining shots (order is fixed; opening_salvo rewards a strong first shot) | Next 1–2 shots with final stats, matryoshka nesting, shots left | Primary |
| When to use a skill or potion | SP count and capacity, skill cost and availability | Primary |
| | Charge toward the next SP, potion charges | Secondary |
| Defensive threat | Each enemy's distance to the defeat line, barrier layers, which enemies move this turn | Primary |
| | Next intent (needs a logic change to compute it before the player's turn) | Secondary |
| Strategic planning | Round, boss countdown and identity, merchant countdown, `runFragments` | Secondary |
| On-demand detail | Max HP, temperature, statuses, affix text, damage analytics | Secondary |
| | Enemy / elite / boss counts as numbers (already visible on the board); a separate ammo-count number if the queue is shown; a separate "inheritance" card (fold it into the final numbers) | Not needed |
| | Speed toggle | Utility |

---

## C. Cross-cutting: dead code and material inconsistency

**Dead functions and elements**
- `ui_updateMultiplierUI`, `ui_updateRoundDamage` and `ui_updateAmmoUI` (hud.js:210, 252, 1099) target ids that don't exist in index.html: `#multiplier-*`, `#round-damage-*`, `#current-ammo-render`, `#next-ammo-render`, `#current-bullet-stats`.
- `#phase-title-container` is never written and stays at opacity 0 (index.html:527-537, 4879).
- `#top-bar-center-slot` is always empty.
- The `Player` class and its `drawOrbitals` are never instantiated (entities.js:4510, 4855).

**CSS layering**
- `bitmap_ui.css` has 42 `.ammo-readout` selectors with no JS that produces that class.
- It has 279 `#combat-bottom-dock` rules stacked across passes Pass6–Pass12 (bitmap_ui.css:1877, 2441, 2803, 3089, 3341, 4457).
- `--combat-console-height` is redefined 9 times.

**Art assets**
- There are two asset roots: `assets/ui/*` (bitmap_ui.css) and `assets/px/*` (pixel_assets.css, which overrides only part of the UI).
- Each of the two stylesheets references 15 assets with "runtime_candidate" in the filename (placeholder art).
- Emoji glyphs (🔰 ⚡ 📊 ⏳) are mixed in with the bitmap sprites.
