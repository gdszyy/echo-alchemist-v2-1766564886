# REQ-20260630-potion-c8-polish

## Status

Done

## Objective

执行“药剂炼成 C8 资产与体验 polish”，只替换表现层，不改炼成规则。

## Scope

- 接入或明确 fallback：炼金炉、法阵稳定/排斥、坍塌反馈、药瓶槽、未知稳定节点。
- 提升炼金台黑箱仪式感，但保持投料、解析、封装、失败返还、`spellTree`、战斗释放规则不变。
- 同步资产清单、TODO、相关设计/规则文档。

## Non-Goals

- 不改 C4 `spellContent` 解析。
- 不改 C6 嵌套合法性。
- 不改 Tower 战斗逻辑。
- 不改伤害、装药、返还数值。

## Milestones

- [x] Intake：读取 AGENTS、全局/UI/性能/资产/药剂合同与计划入口。
- [x] Implementing：接入 C8 表现层资产或 fallback。
- [x] Docs Sync：更新资产清单、TODO、计划和 UI 规则。
- [x] Verifying：运行指定静态验证与必要浏览器检查。
- [x] Cleanup：检查索引、dev server、Git 状态和临时文件。

## Verification Plan

- `node --check src/ui/rune_launcher.js`
- `node tests/validate_potion_spell_content.mjs`
- `node tests/validate_potion_nesting.mjs`
- `node tests/validate_phase_contracts.mjs`
- `node tests/validate_scenarios.js`
- 如修改已索引大文件，运行对应 `scripts/generate_index.py`
- `git diff --check`
- `git status --short --branch`

## Verification Evidence

- `node --check src/ui/rune_launcher.js`：通过。
- `node tests/validate_potion_spell_content.mjs`：22/22 passed。
- `node tests/validate_potion_nesting.mjs`：10/10 passed。
- `node tests/validate_phase_contracts.mjs`：174/174 passed。
- `node tests/validate_scenarios.js`：128/128 passed。
- `python scripts/generate_index.py D:\claude\echo-alchemist-v2-1766564886 --file src/ui/rune_launcher.js`：已更新 auto index。
- 浏览器检查：临时启动 `npm start` 到 `http://localhost:3002`，用 headless Chrome CDP 生成 `desktop-potion-c8.png` 与 `mobile-potion-c8.png`；报告显示 `draftState=form_ready`，leaks 为空，主要元素横向 overflow 为 0。服务已关闭。

## Sync Gates

- Auto index：`src/ui/rune_launcher.js` 已通过 `scripts/generate_index.py` 更新。
- Module docs：已更新 `.cursor/rules/ui_system.md`。
- Progress docs：已更新 `TODO.md` 与 `docs/potion_alchemy_development_plan.md`。
- Assets：已更新 `docs/ui_asset_requirements.md`、`docs/asset_gap_index.md`、`design_spec_bitmap.md` 与 `docs/art_asset_generation_guidelines.md`。
- Process insights：未发现需要新增的隐性耦合洞察。
- Temporary files：截图、CDP 脚本和 serve 日志位于 `tmp/codex/REQ-20260630-potion-c8-polish/`，作为忽略目录下的验证产物。

## Notes

- 资产缺口优先用可复用运行时资产或 CSS fallback 收口。
- 所有封装前文案和视觉只能表达稳定、排斥、坍塌、未知节点，不得泄露具体药剂、词条、品质、装药或伤害。
