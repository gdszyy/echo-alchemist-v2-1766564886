# REQ-20260630-potion-tower-foundation

Status: Done

## Scope

- Finish the potion Tower foundation on top of the existing `potion_tower` active/death runtime.
- Cover blocking/damage intake, deterministic targeting, range/cooldown, lifecycle cleanup, active/death mutual exclusion, and illegal `spellTree` runtime rejection.
- Do not change C6 multi-node nesting UI, C8 alchemy assets polish, or C4 `spellContent` classification.

## Done Range

- `combat_spawnPotionTower()` creates a validated runtime tower with hp, lifetime, radius, active/death slot, hitbox, and contact-damage cooldown.
- `combat_updatePotionTower()` handles AABB blocking, tower damage from contact, active pulses, death release, and expiry cleanup.
- Combat rejects illegal potion trees before spawning carrier/tower runtime objects.
- Tests cover active/death, blocking/damage intake, targeting/range, lifecycle, Tower cannot spawn Tower, and active/death slot mixing.

## Remaining Debt

- C6 multi-node nesting UI.
- Dedicated Tower art/assets and C8 polish.
- Long-term multi-tower balance, count limits, and deep child-spell scheduling.

## Verification

- [x] `node --check src/combat_system.js`
- [x] `node --check src/potion_nesting.js`
- [x] `node tests/validate_potion_nesting.mjs`
- [x] `node tests/validate_potion_spell_tree_combat.mjs`
- [x] `node tests/validate_phase_contracts.mjs`
- [x] `node tests/validate_scenarios.js`
- [x] Auto index regenerated for `src/combat_system.js`
- [x] `git diff --check`
- [x] `git status --short --branch`
