# 场景实体与状态需求清单

> 2026-10-06 只读代码审计（REQ-20261006-pixel-art 重设计输入）。基线：分支 codex/REQ-20261006-pixel-art @ d97d8ba；行号以该基线为准，后续改动会漂移。

## Sprite and state requirement list for in-world visuals (read-only audit)

The list below covers everything drawn in the game world and every state each thing must show. Each item has a file:line anchor to its current draw code.

**Path key** (root `D:\claude\echo-alchemist-REQ-20261006-pixel-art\src\`):
- E = `...\src\entities\enemy.js`
- EN = `...\src\entities.js`
- PR = `...\src\entities\projectile.js`
- P = `...\src\effects\particles.js`
- RS = `...\src\render_system.js`
- GP = `...\src\game_phase.js`
- C = `...\src\combat_system.js`
- SS = `...\src\spawn_system.js`
- CF = `...\src\config.js`
- EVA = `...\src\data\enemy_visual_assets.js`
- META = `...\src\data\enemy_v2_metadata.js`

---

### 1. Enemies

**Tiers and footprints**
- **Normal:** 1×1 "residue" (EVA:72).
- **Elite:** 1×1. Elites with any mix of armorSpore, berserk, haste or jump use a pre-baked "golem" composite sprite (15 combos, EVA:56-71). That sprite path skips the sigil and status badges.
- **Boss:** always 3×2. Each boss has its own collision polygon (SS:2712-2807):
  - ignis: trapezoid
  - glacies: pentagon
  - mikro: 12-sided ellipse
  - devourer: 8-sided maw
  - viridis: pentagon
  - tesla: diamond
  - chimera: pentagon
  - ouroboros: ring (arc shape) with 6 orbiting attachments

**Large base archetypes** (META:39-193, collision shapes at SS:3640-3729):

| id | footprint | affix |
|---|---|---|
| bastion | 3×1 | heavyArmor |
| maw | 2×2 | devour |
| deflector | 2×1 | deflectionWard |
| echoSpire | 1×2 | echoRelay |
| prism | 1×3 | prism |
| hive | 2×3 | hive |
| siege | 3×2 | siege |
| carrier | 3×2, 5 cells (⊓ shape, bottom-middle cell empty) | carrier |
| gravityWell | 3×3, circular | gravityWell |

- Their in-code body art is at E:10773-10989. Siege has no in-code body and relies on its sprite.

**Spawned sub-types that need their own sprites**
- Hive larva `_isHiveLarva` (E:11944)
- Carrier drone `_isCarrierDrone`, a hasty jumper (E:12131)
- Clones `isClone`
- Boss minions for all 8 bosses (role and tags at CF:914-923). Half of them use a boss-themed shape (SS:2937-3051): triangle, diamond, hexagon, cut-corner square, droplet, parallelogram, irregular pentagon, octagon. Each has a frame bitmap (E:260-301).
- Specific minion types: tesla conductor (E:1926), devourer and chimera feeders (E:2661, E:3084), and ouroboros orbit echoes in 6 slots — aegis, graft, brood, stride, maw, surge (E:4042, EVA:82-87).

**Confirmed affix list: 27 total** (your example list matches; `deflectShell` and `deflectionWard` are two different affixes)

*Random pool, 17 affixes* (CF:2705). For each: what the player must read, then the current draw code.
- **shield:** number of layers; reduces damage by 50%; hits from above bypass it ("BACKSTAB"); "BROKEN!" when it breaks. Hex grid inside the body (E:5828), with extra elite/boss versions (E:5871, E:5908).
- **radiantAegis:** a numeric shield value capped at 10% max HP (boss) or 5% (elite); refills each turn; broken state; spreads +1 shield layer to neighbors. Drawn at E:6153; the spread feedback is at E:5127.
- **energyArmor:** any single hit above 20% max HP is capped, and the overflow becomes a temporary shield value. Needs charged vs empty states. Drawn at E:11528.
- **phaseShield:** shield layers doubled; every 3rd enemy turn it is off ("相断" badge, yellow dashed outline plus an X). Drawn at E:11549.
- **livingArmor:** armor HP (10% of source); high/mid/low states plus a "stacked" variant; broken state. Drawn at E:11460.
- **armorSpore:** grants armor to others; shows an animated spore trail arrow. Drawn at E:11440 and E:11494.
- **lowDamageImmune:** any final hit under 5% max HP does nothing ("过低" text). Drawn at E:11517.
- **deflectShell:** rotates the bounce normal (1×1 only). Drawn at E:11640.
- **siegeBreaker:** ×2 damage to the defense line. Drawn at E:11592.
- **overloadReactor:** +1 action per 20% max HP of damage taken this turn, up to 3; 3-bar gauge plus "炉+N" badge. Drawn at E:11577.
- **regen:** E:6203
- **haste:** E:6292
- **devour:** E:6359
- **healer:** E:6402
- **jump:** E:6434
- **clone:** E:6471
- **berserk:** E:6579

*Base-only, 8 affixes*
- **heavyArmor:** double HP; moves every 2 turns; "⏳N" countdown. Drawn at E:6635 and E:6666.
- **deflectionWard:** a barrier of 10% max HP that absorbs pierce and bounce hits only; "屏N%" badge plus a bar (E:10852); "🔷BREAK" when it breaks.
- **echoRelay, prism, hive, siege** (siege is freeze-immune and pushes chains), **carrier, gravityWell** (pulls bullets within 220 px).

*Reward, 2 affixes*
- **runeBearer:** rolls a temporary affix from 7.
- **adaptiveRune:** shows its current element (one of 10).
- Both are drawn at E:9681.

**Gaps (no visual today):**
- hive and carrier spawn countdowns
- range of echoRelay, healer, devour and gravityWell
- siege's freeze immunity
- `swordMarks` (stored but never drawn)

**Stacked per-affix layers on each enemy**
- color tint per affix combination (E:5572, E:10995)
- geometric sigil, max 3 (E:11718)
- bitmap overlay, max 2 (E:11662)
- in-code fallback marks when the bitmap is missing (E:11283)

**Status effects applied by the player**

*Heat (temp > 0)*
- HP color shifts toward orange (E:5661).
- ≥24: "热" badge.
- ≥34: burning effect (P:1852) plus smoke (E:1117).
- ≥67: inner glow and white cracks (E:5713, E:6726).
- ≥100: glowing overheat border plus embers (E:7294, E:1141).
- On Ignis, heat is converted into furnace pressure instead.

*Cold (temp < 0)*
- HP shifts toward cyan.
- ≤-24: "冻" badge.
- ≤-34: mist overlay plus falling mist (E:5723, E:1165).
- ≤-67: ice cracks (E:6742).
- ≤-80: frozen — sprite animation and breathing stop (E:833, E:5411).
- ≤-100 or frozen this turn: ice shell that follows the AABB, polygon or arc shape (E:7325-7412).
- Potions and skills can also freeze for a number of turns (`frozenTurns`, C:1313); Frost Prison adds a damage-taken bonus ("❄️+%").

*Lightning* — electrocution effect (P:1992), refreshed on every lightning hit (C:3785).

*Venom* — stack count (badge "毒N"); inner glow plus drips (E:5760); venom effect (P:2142).

*Wind* — wind mark effect scaled by wind level (P:2279, C:3847).

*Brief hit effects*
- bounce arc (P:4768)
- scatter burst (P:4943)
- echo ripple (P:5064)

*Flying-sword states*
- stuck swords, colored by level 1/2/3 (E:7074)
- sword cracks (E:7042)
- son-sword lock-on reticle (E:6779)

**Per-enemy HUD**
- **HP:** the body fills like liquid from the bottom; a delayed red damage trail and a green heal-preview band sit behind it (E:5588-5708). Fill color by tier: normal slate, elite purple, boss uses its own theme color (E:209-258).
- **HP number:** red while HP is dropping. It sits in one row with the defense items — shield/phase layers, aegis, energy armor and living armor values, max 3 items (4 for bosses) (E:9758).
- **Status badges:** at most 3 shown, from about 20 possible: RUNE, A:xx, 屏, 压, 电, 导, 相断, 炉, 狂, 噬, 热核/寒核/流彩, 霜缝, 孢, 腐, 附, 断, 破, 隙, 毒, 热, 冻 (E:9871).
- **Tier tag:** 首领 / 精英 / archetype name / N×M (E:9211).
- **Footprint:** dashed outline plus cell dividers (E:9147).
- **Border by affix count:** iron (1), bronze (2), silver (3), gold (elite with 4+, or boss with fewer than 6), rainbow (boss with 6+); flashes white while the enemy telegraphs (E:6835, E:10227).
- **Elite crystal decoration:** E:9977.
- **Relic carrier:** gold frame (E:7449, E:5250).
- **Intent panel:** icon, label, 4 severity ticks and a countdown ring (E:7766-7895). Intents: berserk, healer×N, devourer maw×N, chimera thermal devour, devour×N, jump N rows, clone, regen, haste (E:1538-1604).
- **Ouroboros actions:** shield, heal, summon, haste, devour, charge (E:4084-4126).
- **Animation states:** idle, hit, cast, move (E:836-844).

*Hit reactions*
- squash and stretch (E:5425)
- white flash (E:7067)
- laser jitter (E:5433)
- jump with a shadow and fake height (E:5462)
- scan corner brackets (E:7897)
- battle cracks below 30% HP (E:6756)
- energy leak below 20% HP (E:1196)
- defense block and break effects for shield, phase, aegis and living armor (layered membrane images), plus ward, energy armor and low-damage immunity (E:4383-5127)
- floating texts from damage resolution (E:8626-8912)

**Bosses**
- **Mini bosses:** ignis, glacies, mikro, devourer. **Big bosses:** viridis, tesla, chimera, ouroboros (CF:680-884).
- **Phases:** entrance with drop-in, shockwave and name text (E:8351, SS:3741); normal; berserk below 20% HP (CF:677) with flicker and aura (E:7230-7291).
- **Move label:** moving this turn / berserk move / ⏳N turns left (E:8483).
- **Weak spot:** each boss has 2 counter attributes and fills by hit count or by damage. Visual states: 0/25/50/75%, break, exposed for 1 turn at ×1.35 damage, recover (E:9293, `boss_vulnerability_assets.js`). Ouroboros rotates its weak spot.
- **Per-boss gauges:** furnace pressure, frost seam, mikro's clone damage reduction, devourer feed, viridis spore bloom and corrosion, tesla field and grounded state, chimera heat/frost cores, ouroboros active/next/disabled slot.
- **Per-boss decorations:** E:10284-10770 and E:5937-6153; devourer at E:7922; ouroboros ring at E:8159 and E:9563.
- **Boss HP:** shown only by the liquid fill plus the number. There is no separate boss bar.

### 2. Gathering board

**Pegs** (EN:938, draw at EN:1213, diamond plate)

Peg types, with per-type icon code:

| type | draw code |
|---|---|
| normal | (base plate) |
| pink (bumper: higher bounce, no pickup) | EN:1861 |
| bounce | EN:1683 |
| damage | EN:1791 |
| cryo | EN:1630 |
| pyro | EN:1660 |
| pierce | EN:1718 |
| scatter | EN:1754 |
| wind | EN:1555 |
| flying_sword | EN:1511 |
| resonance | EN:1884 |
| venom | EN:1917 |
| laser (legacy) | EN:1824 |

- Random pegs are only normal, bounce or damage (GP:1508).
- **Peg states:**
  - lit on hit
  - cooldown pie slice (EN:1360)
  - level 1-3 shown as gold border plus pips (EN:1454, EN:2126)
  - spin on impact
  - rim light and ball-cast shadows (EN:1017)
  - halo
  - legacy frozen state (EN:1408)
  - barrier shape (EN:1164)
- **Layout roles** (EN:1970): diamond_mid, sparse_narrow, wide_edge, triangle_funnel, mirror_center, mirror_axis, bottom_reward_gate.
- **Ghost peg:** diamond layout only; fades over 3 s (EN:641).

**Board pieces**
- **Special slots** (EN:159, a glowing line between two pegs) — 9 types:
  - recall ↺
  - multicast +2
  - split ⑂
  - relic
  - giant
  - skill_point
  - wheel
  - launcher ↗ (spinning)
  - energy_wheel +3 (spinning rods)
- **Fortune wheel** (EN:336/476): slices per attribute with an ×N multiplier, pointer, chase lights, screen dim.
- **Triangle side wheels** (EN:735/823): slices 空/1x/2x/3x/5x; states idle-breathing, spinning, result, cooldown.
- **Bottom reward zones:** GP:436, GP:498.
- **Board modules:** 38 layouts at `...\src\pinboard_modules.js:427-1451`.

**Marbles** (EN:3423)
- Base types: white, bounce, pierce, scatter, damage, laser, wind, lightning, cryo, pyro, resonance, echo, venom, rainbow, matryoshka, explosive.
- Buff layers: glow from the strongest stack, pyro plasma, cryo frost, lightning arcs, laser aura, wind blades (3 to 6).
- Markers: mirror-clone ring and rainbow shards.

**Other board visuals**
- tilt tether line (GP:4117)
- tilt vignette (RS:1094)
- landing heatmap (GP:4444)
- collection beam (P:548)
- energy orb (P:1499)

### 3. Combat projectiles

Drawn in PR:1527; size and glow by damage at PR:123.

**Shape by attribute**
- pierce → arrow
- scatter / scatter child → star
- laser → orb
- wind → crystal plus 3-6 orbiting wind blades
- flying_sword → full sword with tassel
- matryoshka → falls back to a circle, plus a magenta dot and ring
- everything else → circle

**Visual encoding**
- **Casing and core colors:** PR:1339.
- **Accent dots:** one per attribute, up to 5 (PR:1846).
- **Lightning:** 1 + floor(level/2) arcs.
- **Pyro:** molten core.
- **Cryo:** hex frost.
- **Explosive:** strobing and shaking.
- **Durability:** remaining bounces/pierces darken the bullet and crack it below 60%.
- **Trail:** color per attribute (PR:1230); width grows every 8 total attribute levels; gold for the opening salvo; blue for echo copies.

**Gaps**
- venom, overcharge, echo, resonance and rainbow have color only, no unique silhouette
- the overcharge count is invisible

**Related sprites**
- sword qi (EN:3880)
- slash animation (EN:3935)
- son swords — flying / stuck / recalling, colored by level (EN:3976)
- clone spore lob (EN:4438)

### 4. Effects (31 classes in P)

| Family | Classes |
|---|---|
| Base particles | Particle (P:72), modes: spark, ember, mist, shard, smoke, venom, line, wind_slash |
| Impact (6) | SlashEffect (P:323), PierceCutEffect (P:403), SwordScar (P:3626), BounceArcEffect, ScatterBurstEffect, EchoRippleEffect |
| Waves / rings (6) | Shockwave (P:609), ImpactBlastWave (P:1007), AssimilationPulseWave (P:1013), FireWave (P:1745), IceWave (P:2387), BladeStormRing (P:3368) |
| Explosion | built by SS:1844 / 1869 / 1919 / 2041 |
| Beams (4) | LaserBeam (P:1324), CollectionBeam, MuzzleFlashV2 (P:4178), FiringBurst (P:4300) |
| Lightning (2) | LightningBolt (P:1644), ElectrocuteEffect |
| Persistent status (4) | Burn, Electrocute, Venom, WindMark |
| Heal | HealWave (P:3092) |
| Death | DeathExplosion (P:2463): normal/elite/boss tiers, plus a venom variant |
| Loot | RewardDropEffect (P:3709): relic, chaos, pure; EnergyOrb |
| Skill / relic (5) | AffixSkillVFX (P:4431), 8 types; GreedyWheelEffect (P:1021); DoomsdayClockEffect (P:1130); BladeStormVortex (P:3441) |
| Text | FloatingText (P:1399) |
| Wind spells | RS:228, RS:352 (tunnel / bowtie / cyclone / burst); C:2876, C:2919, C:3209 |
| Potions (9, CF:2402) | bottle shatter in 7 styles (C:289/447); spell forms orb, mine, orbit, slash, beam, meteor, sweeping laser, tower (C:525-781); orb carrier (C:884/966) |
| Skills | C:1466/1493, SS:2119 |

### 5. Launcher, walls, defeat line, aim guide, field loot

- **Launcher**
  - Drawn by GP:3712.
  - Emitter base RS:797: base, barrel and ring images; 6 charge frames; 4 muzzle-flash frames; firing embers (RS:761); reload recoil; enemy-turn idle pulse (GP:3768).
  - Readout RS:560: loaded-round preview, DMG number, burst ×N tube with 6 cells, 6-slot attribute magazine with stack numbers.
  - The old `Player` class (EN:4510) is unused.
- **Walls:** RS:107.
- **Defeat line:** RS:182, with states amber, danger red, and blue barrier showing a count.
- **Combat background:** grid and dust (GP:2916).
- **Aim guide:** main path plus scatter paths (GP:3398); nodes origin / wall / enemy / endpoint (RS:541).
- **Field loot**
  - `FieldLootItem` (EN:5097): relic, marble_pack, run_resource_pack, chaos_essence, pure_essence; pop-in, then floats.
  - `RuneLoot` (EN:5206): glow by rarity, 0/3/4/6 orbiting dots, spawn burst, picked up automatically when the board is cleared.
