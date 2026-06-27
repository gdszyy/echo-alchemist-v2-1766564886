# Health Phase 2 Delivery Boundaries

本文档记录 2026-06-27 工作区交付边界整理结论。目标是把当前混合改动拆成可审查提交，避免把运行时代码、生成资产、归档材料和个人实验文件揉成一个大提交。

## 当前基线

- `git status --porcelain=v1 -uall` 总条目：781。
- tracked 改动：114。
- untracked 文件：667。
- untracked 主要来源：`docs` 436、`assets` 217。
- tracked 主要来源：`.cursor` 47、`src` 27、`docs` 16、`tests` 5。

## 建议提交分组

### 1. Infra 小提交

建议包含：

- `package.json` 中 `npm start` 固定到 `-l 3002`。
- `.gitignore` 中本地预览日志和个人 scratch 目录规则。
- 与本地服务端口规范直接相关的少量文档更新。

不建议包含：

- 玩法代码。
- 大体量图片资产。
- `.cursor/rules/auto_index/` 大批量索引更新。

### 2. 敌人视觉 Runtime 提交

建议包含：

- `assets/sprites/enemies/enemy_sprite_manifest.json`。
- manifest 实际引用的最终 runtime composites：`assets/sprites/enemies/composites/*.png` 与对应 `.json`。
- 必要的最终 overlay / affix icon runtime 资源。
- `src/data/enemy_visual_assets.js` 中资源解析和默认 manifest fallback。

暂缓或需确认：

- `*_raw.png`、`*_source_magenta*`、review/contact sheet。
- 旧 pass 候选图，除非 manifest 仍引用。
- `docs/archive/**` 中大体量 PNG。

### 3. 敌人行为与波次提交

建议包含：

- `src/entities/enemy.js`。
- `src/spawn_system.js`。
- `src/wave_presets.js`。
- `tests/validate_enemy_spawn_runtime.mjs`。
- `tests/validate_wave_presets.mjs`。
- 对应敌人/导演/性能/测试规则文档。

注意：

- 该组涉及敌人、Boss、词缀、波次，必须配套运行敌人生成与波次验证。
- 若修改粒子、发光、blend mode 或动态渐变，按 AGENTS.md 添加 `@perf-impact` 与总结评估。

### 4. 药剂与符文法术提交

建议包含：

- `docs/rune_potion_spell_contract.md`。
- `docs/spell_vfx_design.md`。
- `tests/validate_rune_spell_forms.mjs`。
- `tests/validate_potion_vfx_contract.mjs`。
- `tests/validate_spell_vfx_design.mjs`。
- 对应 `src/rune_system.js`、`src/combat_system.js`、`src/effects/particles.js`、`src/ui/rune_launcher.js`、`index.html`、`src/styles/bitmap_ui.css` 中确属该功能的改动。

注意：

- 不要和敌人视觉/波次提交混在一起。
- 视觉特效改动需补性能自适应影响说明。

### 5. 文档归档提交

建议包含：

- 已确认迁移到 `docs/archive/` 的旧设计文档。
- `docs/archive/README.md` 或局部 README，说明归档原因和替代入口。

需用户确认：

- 是否保留大体量历史 PNG。
- 是否只保留 README、最终决策记录和少量代表性 contact sheet。
- 是否将完整历史美术迭代迁移到外部资产仓或 LFS。

### 6. Music R&D 提交

建议包含：

- `docs/architecture/music_processing/` 中正式文档、demo、manifest。
- `tools/midi_interlock.py`、`tools/smoke_ignis.js` 等若确认为正式工具。

默认不包含：

- `docs/architecture/music_processing/_mine/` 个人实验脚本。
- 临时调试日志。

## 忽略策略

本阶段建议忽略：

- `tmp*_preview_server*.log`。
- `docs/architecture/music_processing/_mine/`。
- `docs/archive/**/*.png` 与 `docs/archive/**/*.json`，默认不把历史美术迭代大图和中间数据放进普通提交；需要保留代表性 contact sheet 时使用 `git add -f` 显式加入。

当前不建议全局忽略：

- `*.png`，因为运行时资产需要入库。
- `assets/**/raw*`，因为部分 raw 资源可能仍是美术交付物，需要逐批确认。

## 提交前验证

每个功能提交至少运行：

```bash
git diff --check
node --check src/core.js
node --check src/game_system.js
node --check src/combat_system.js
node --check src/entities/enemy.js
node tests/validate_scenarios.js
node tests/validate_phase_contracts.mjs
node tests/validate_wave_presets.mjs
node tests/validate_enemy_spawn_runtime.mjs
```

药剂与符文法术提交额外运行：

```bash
node tests/validate_rune_spell_forms.mjs
node tests/validate_potion_vfx_contract.mjs
node tests/validate_spell_vfx_design.mjs
```

## 未决策项

- `docs/archive/**` 中大体量历史 PNG 的保留方式。
- manifest 未引用但可能仍有美术追溯价值的旧 pass 资源。
- 是否为大体量二进制资产启用 Git LFS 或外部资产仓。
- 是否单独处理 LF/CRLF 警告，避免后续 diff 噪声。
