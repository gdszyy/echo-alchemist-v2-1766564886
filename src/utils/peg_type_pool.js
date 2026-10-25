/**
 * peg_type_pool.js - 可随机属性钉的**唯一**取值域（冻结单 v3 §6.3 第 3 步「收敛池」）。
 *
 * 口径（锁定）：
 *   - 运行期**类型名**是这一组：`normal`（无色 / 产电）、`pyro` / `cryo`（两色钉盘料）、`bounce`（反弹）。
 *     `damage` 不再单列（§6.3-3「damage 并入 bounce 之外的 T1 行为轴」，本单不改该映射）。
 *   - 权重**键**仍是共用字典 `game.unlockedWeights` 的键：`normal` 走 `white`（普通钉权重基准），
 *     `pyro` / `cryo` / `bounce` 走同名键。本文件只管「有哪些类型」，不持有任何权重数值。
 *   - 配置表键 `gray` / 死键 `lightning` 的去留是 §6.3 第 1、2 步（`[提案]`），**不在本单范围**，本单不动。
 *
 * 消费者（两处，**都只引用本文件，不得再无本地副本**）：
 *   1. `src/game_phase.js` → `phase_gathering_getRandomPegType()`（主钉盘随机钉）
 *   2. `src/pinboard_modules.js` → `getRandomPegTypeFromWeights()`（模块内随机钉）
 *
 * 注：`normal` 在加权循环里会被「权重键不存在」自然过滤掉（权重基准是 `white`，不是 `normal`），
 *     所以把它列进取值域不会造成普通钉被重复加权；它列在这里是为了让「运行期类型名」这一层可见、可枚举。
 */

/** 可随机属性钉的取值域（运行期类型名，冻结单 v3 §6.3-3）。 */
export const RANDOMIZABLE_PEG_TYPES = ['normal', 'pyro', 'cryo', 'bounce'];
