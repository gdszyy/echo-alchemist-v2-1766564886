import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, TriangleSideWheel, GhostPeg, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { eventBus, EVENT_TYPES } from './event_bus.js';
import { RUNE_DB } from './rune_config.js';
import {
    calcDropDistribution,
    generateHeatmapData,
    adjustDistributionForEntry,
    getLayoutParams,
    getAllLayoutHints,
} from './plinko_physics.js';

export const game_phase = {
/**
     * @method advanceWave
     * @description [DEAD CODE] 此方法从未被调用，其职责已由 phase_finalizeRound 完全承担。
     * [fix] 移除了幽灵调用 this.resolveTemperatureAndAdvance()：
     *   - 该方法在整个项目历史中从未被实现（只有调用，没有定义）
     *   - 温度结算逻辑已完整实现于 phase_enemy_processTurn() 中
     *   - 此方法本身也是死代码（无调用者），保留仅作历史参考
     */
    phase_advanceWave() { 
        // [fix] 移除幽灵调用：this.resolveTemperatureAndAdvance() 从未被实现
        // 温度结算已在 phase_enemy_processTurn() 中逐敌处理，无需在此重复
        // 根据场上敌人行数决定生成多少行新敌人
        const rows = new Set(this.enemies.filter(e=>e.active).map(e => Math.floor(e.pos.y))); 
        let spawnCount = 1; 
        if (rows.size < 3) spawnCount = 2; // 如果敌人行数少于3，则生成2行
        this.spawn_spawnEnemyRow(spawnCount); 
        
        // [BUGFIX #5b] 删除此处的 round++，避免与 phase_finalizeRound 中的 round++ 重复执行
        // 原 Bug: round++ 在 phase_advanceWave 和 phase_finalizeRound 中均执行，导致回合计数异常
        // 回合计数的唯一执行位置保留在 phase_finalizeRound 中
        this.prevRoundDamage = this.roundDamage; // 记录上一回合伤害
        this.roundDamage = 0; // 重置本回合伤害
        // 事件总线广播波次推进（[BUGFIX #5b] 保留：不在此处更新 DOM，由 UI 监听 wave:advance 事件处理）
        eventBus.emit(EVENT_TYPES.WAVE_ADVANCED, { round: this.round });
    },

/**
     * @method switchPhase
     * @description 切换游戏阶段。
     * @param {string} newPhase - **重要参数** 新阶段名称 ('selection', 'gathering', 'combat', 'gameover')。
     */
    phase_switchPhase(newPhase) {
        const oldPhase = this.phase;
        this.phase = newPhase;

        // [DEBUG-LOG] 记录每次 phase 切换的来源和调用栈
        const runeLauncherPanel = document.getElementById('phase-rune-launcher');
        const launcherVisible = runeLauncherPanel && runeLauncherPanel.style.display !== 'none';
        if (launcherVisible) {
            console.warn('[phase_switchPhase] ⚠️ 符文发射器打开期间发生 phase 切换！' + oldPhase + ' -> ' + newPhase + '\n调用栈:', new Error().stack);
        } else {
            console.log('[phase_switchPhase] ' + oldPhase + ' -> ' + newPhase);
        }
        
        // 事件总线广播阶段切换
        eventBus.emit(EVENT_TYPES.PHASE_CHANGED, { from: oldPhase, to: newPhase });
        
        // [修复] 每次切换阶段时重置 container 的 3D 变换，防止研磨阶段的倾斜特效泄漏到其他阶段
        const container = document.getElementById('game-container');
        if (container) {
            container.style.transform = '';
            container.style.perspective = '';
            container.style.transition = '';
        }
        
        this.ui_updateUI(); // 更新 UI 界面
        // [重构] 将阶段标题的 DOM 操作集中到 ui_system.js 的 ui_onPhaseChange 方法中
        this.ui_onPhaseChange(newPhase);
    },

/**
     */
    phase_startGatheringPhase() {
        // 保存上一回合的伤害数据
        if (this.shotDamageHistory.length > 0) {
            this.roundDamageHistory.push({
                round: this.round,
                shots: JSON.parse(JSON.stringify(this.shotDamageHistory))
            });
        }
        
        this.phase_switchPhase('gathering');
        requestAnimationFrame(() => {
            this.ui_updateUICache();
        });
        // 确保每次进入收集阶段都初始化钉板，因为钉板可能在战斗阶段被清空
        // 或者在游戏重置后需要初始化。
        this.phase_gathering_initPachinko(this.round > 1);
        
        // --- 新增：初始化持久阈值变量 ---
        this.persistentThreshold = CONFIG.gameplay.initTriggerThreshold; 
        // -----------------------------
        this.ui.updateSkillPoints(this.skillPoints);
        this.ammoQueue = []; 
        this.dropBalls = []; 
        this.activeMarbleIndex = 0; 
        this.combat_updateHitProgress(0, this.persistentThreshold); 
        this.ui_updateGatheringQueueUI(); 
        this.ui_renderRecipeHUD(); 
        this.combat_updateMulticastDisplay(0);
        this.ui_renderRecipeHUD();
    },

/**
     */
    phase_gathering_initPachinko(shouldInherit = false) {
        // [修复] 使用动态行数
        const rows = this.currentRows || CONFIG.gameplay.rows;
        const baseCols = CONFIG.gameplay.cols || 10;
        const spacingX = CONFIG.gameplay.spacingX || 35;
        const spacingY = CONFIG.gameplay.spacingY || 32;
        // [钉盘形态遗物] 读取异型布局模式
        const boardLayout = this.boardLayout || 'default';
        
        // [修复] 修正 width 引用
        // 确保 this.width 在初始化时已正确设置，否则使用默认值 400
        const canvasWidth = (this.width && this.width > 0) ? this.width : 400; 
        const canvasHeight = (this.height && this.height > 0) ? this.height : 600;
        
        // [钉盘形态遗物] 使用 baseCols 计算水平居中偏移（布局基准宽度）
        const offsetX = (canvasWidth - (baseCols - 1) * spacingX) / 2;
        
        // [优化] 动态计算 offsetY，确保在矮屏幕下钉子不会被挤出屏幕
        // 预留顶部空间 (约占高度的 20%，但不超过 120px)
        const offsetY = Math.min(120, canvasHeight * 0.2);
        
        // [优化] 如果屏幕太矮，自动压缩垂直间距
        const adjustedSpacingY = (offsetY + rows * spacingY > canvasHeight - 50) 
            ? (canvasHeight - offsetY - 80) / rows 
            : spacingY;

        const previousPegs = [...this.pegs];
        this.pegs = [];
        this.specialSlots = [];
        let pegIndex = 0;
        let maxPegY = 0;

        for (let r = 0; r < rows; r++) {
            // ==================== [钉盘形态遗物] 异型布局逻辑 ====================
            // 根据 boardLayout 计算每行的列数和水平偏移
            let rowCols, rowOffsetX;
            const isOddRow = r % 2 !== 0;

            if (boardLayout === 'triangle') {
                // 三角形：顶行最宽，每行递减 1 列，最少保留 3 列
                const colsThisRow = Math.max(3, baseCols - r);
                rowCols = colsThisRow;
                // 水平居中：计算该行实际宽度，居中对齐
                const rowWidth = (colsThisRow - 1) * spacingX;
                rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                // 保持标准交错偏移
                rowOffsetX += isOddRow ? spacingX / 2 : 0;

            } else if (boardLayout === 'diamond') {
                // 菱形：前半段每行 +1 列，后半段每行 -1 列
                const half = Math.floor(rows / 2);
                const colsDelta = r <= half ? r : (rows - 1 - r);
                const colsThisRow = Math.max(3, (baseCols - half) + colsDelta);
                rowCols = colsThisRow;
                const rowWidth = (colsThisRow - 1) * spacingX;
                rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                rowOffsetX += isOddRow ? spacingX / 2 : 0;

            } else if (boardLayout === 'sparse') {
                // 稀疏间隔：偶数行正常列数，奇数行减 4 列居中
                // 设计意图：行与行之间不交错（奇数行纯居中），只有最后两行交错，
                // 以便弹珠顺利触发底部粉色陷阱效果并被底部反弹。
                const isLastTwoRows = (r >= rows - 2);
                if (!isOddRow) {
                    rowCols = baseCols;
                    rowOffsetX = 0; // 偶数行正常，不交错偏移
                } else {
                    const narrowCols = Math.max(3, baseCols - 4);
                    rowCols = narrowCols;
                    const rowWidth = (narrowCols - 1) * spacingX;
                    // 普通奇数行：纯居中，不加交错偏移（行间对齐，弹珠可直线穿越蓄力）
                    // 最后两行：加标准交错偏移，形成「底部粉色陷阱」必经区
                    const staggerOffset = isLastTwoRows ? spacingX / 2 : 0;
                    rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX + staggerOffset;
                }

            } else if (boardLayout === 'mirror_sync') {
                // 镜像同步：列数减 2，奇数行加标准交错偏移
                // [修复] 恢复奇偶行交错，防止弹珠直线穿透；镜像基于 x 坐标对称
                const syncCols = Math.max(3, baseCols - 2);
                rowCols = syncCols;
                const rowWidth = (syncCols - 1) * spacingX;
                rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                rowOffsetX += isOddRow ? spacingX / 2 : 0; // 恢复标准交错

            } else if (boardLayout === 'wide_narrow') {
                // 宽窄交替：偶数行 +2 列，奇数行 -2 列
                // [修复] 奇数行加标准交错偏移，防止弹珠直线穿透
                if (!isOddRow) {
                    const wideCols = baseCols + 2;
                    rowCols = wideCols;
                    const rowWidth = (wideCols - 1) * spacingX;
                    rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX;
                } else {
                    const narrowCols = Math.max(3, baseCols - 2);
                    rowCols = narrowCols;
                    const rowWidth = (narrowCols - 1) * spacingX;
                    rowOffsetX = (canvasWidth - rowWidth) / 2 - offsetX + spacingX / 2;
                }

            } else {
                // default：标准交错矩形
                rowCols = isOddRow ? baseCols - 1 : baseCols;
                rowOffsetX = isOddRow ? spacingX / 2 : 0;
            }

            for (let c = 0; c < rowCols; c++) {
                const x = offsetX + rowOffsetX + c * spacingX;
                const y = offsetY + r * adjustedSpacingY;
                maxPegY = Math.max(maxPegY, y);

                let type = 'normal';
                let level = 1;

                // [继承逻辑]
                if (shouldInherit && previousPegs[pegIndex]) {
                    const prevPeg = previousPegs[pegIndex];
                    // 排除粉色钉子（假设它是临时Buff）
                    if (prevPeg.type !== 'pink') {
                        type = prevPeg.type;
                        level = prevPeg.level || 1;
                    } else {
                        type = this.phase_gathering_getRandomPegType();
                    }
                } else {
                    type = this.phase_gathering_getRandomPegType();
                }

                let p = new Peg(x, y, type);
                p.level = level;
                p.row = r;
                p.col = c;
                // [继承逻辑] 如果继承，保留当前的冷却状态
                if (shouldInherit && previousPegs[pegIndex]) {
                     p.cooldownTimer = previousPegs[pegIndex].cooldownTimer;
                }
                
                this.pegs.push(p);
                pegIndex++;
            }
        }

        // ==================== [布局位置标记] ====================
        // 在所有钉子创建完成后，根据布局类型标记功能性位置的 layoutRole
        // 供 Peg.draw 方法绘制专属视觉样式
        if (boardLayout !== 'default') {
            const totalRows = rows;
            const rowQ1 = Math.floor(totalRows * 0.25);
            const rowQ3 = Math.floor(totalRows * 0.75);

            for (const p of this.pegs) {
                const r = p.row;
                const c = p.col;

                if (boardLayout === 'diamond') {
                    // 中段（25%~75% 行）：触发「中段爆发」效果的区域
                    if (r >= rowQ1 && r <= rowQ3) {
                        p.layoutRole = 'diamond_mid';
                    }

                } else if (boardLayout === 'sparse') {
                    // 奇数行（窄行）：弹珠穿越此行未碰撞则蓄力
                    if (r % 2 !== 0) {
                        p.layoutRole = 'sparse_narrow';
                    }

                } else if (boardLayout === 'wide_narrow') {
                    // 偶数行（宽行）的边缘钉子（列号 0/1 或倒数 0/1）：触发「边缘共振」
                    if (r % 2 === 0) {
                        const rowPegs = this.pegs.filter(rp => rp.row === r);
                        const rowLen = rowPegs.length;
                        if (c <= 1 || c >= rowLen - 2) {
                            p.layoutRole = 'wide_edge';
                        }
                    }

                } else if (boardLayout === 'triangle') {
                    // 下半段（50%~100% 行）：漏斗收窄区，触发「漏斗共鸣」
                    if (r >= Math.floor(totalRows * 0.5)) {
                        p.layoutRole = 'triangle_funnel';
                    }

                } else if (boardLayout === 'mirror_sync') {
                    // 中轴附近钉子（列号 0 或最后一列）：镜像同步的对称轴标识
                    const rowPegs = this.pegs.filter(rp => rp.row === r);
                    const rowLen = rowPegs.length;
                    if (c === 0 || c === rowLen - 1) {
                        p.layoutRole = 'mirror_center';
                    }
                    // [镜像裂分] 中轴线特殊钉子：距离中心最近的钉子标记为 mirror_axis
                    // 每行只标记一颗最靠近中轴的钉子（奇数列数取中间列，偶数列数取中间偏左）
                    const midCol = Math.floor((rowLen - 1) / 2);
                    if (c === midCol) {
                        p.layoutRole = 'mirror_axis';
                    }
                }
            }
        }

        // [镜像同步] 预计算钉子的镜像索引
        // [修复] 交错后奇偶行的 x 坐标不再简单对称于列号，改为基于 x 坐标对称于画布中心
        if (boardLayout === 'mirror_sync') {
            const centerX = (this.width && this.width > 0) ? this.width / 2 : 200;
            for (let i = 0; i < this.pegs.length; i++) {
                const p = this.pegs[i];
                // 镜像 x = 2 * centerX - p.x，在同行中寻找 x 最近的钉子作为镜像
                const mirrorX = 2 * centerX - p.pos.x;
                const samRowPegs = this.pegs.filter((mp, mi) => mi !== i && mp.row === p.row);
                let bestMirror = null;
                let bestDist = Infinity;
                for (const mp of samRowPegs) {
                    const dist = Math.abs(mp.pos.x - mirrorX);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestMirror = mp;
                    }
                }
                // 容差：半个钉子间距内才认为是有效镜像
                if (bestMirror && bestDist < spacingX * 0.6 && bestMirror !== p) {
                    p.mirrorIdx = this.pegs.indexOf(bestMirror);
                }
            }
        }

        if (this.round === 1 && !shouldInherit) {
            const replaceWithSpecial = (count, type) => {
                if (!count || count <= 0) return;
                const normalPegs = this.pegs.filter(p => p.type === 'normal');
                for (let i = normalPegs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [normalPegs[i], normalPegs[j]] = [normalPegs[j], normalPegs[i]];
                }
                for (let i = 0; i < Math.min(count, normalPegs.length); i++) {
                    normalPegs[i].type = type;
                    normalPegs[i].level = 1;
                }
            };
            // [爽游模式] 新手教程局使用专属字段的钉子数量，避免全局 CONFIG 被污染
            const windPegsCount = this._isTutorialRun && this._tutorialInitWindPegs
                ? this._tutorialInitWindPegs
                : CONFIG.gameplay.initWindPegs;
            const swordPegsCount = this._isTutorialRun && this._tutorialInitSwordPegs
                ? this._tutorialInitSwordPegs
                : CONFIG.gameplay.initSwordPegs;
            console.log('[PachinkoInit] wind:', windPegsCount, 'sword:', swordPegsCount);
            replaceWithSpecial(windPegsCount, 'wind');
            replaceWithSpecial(swordPegsCount, 'flying_sword');
            // [爽游模式] 新手教程局：将 wind/flying_sword 钉子等级提升到 3
            if (this._isTutorialRun) {
                this.pegs.forEach(p => {
                    if (p.type === 'wind' || p.type === 'flying_sword') {
                        p.level = 3;
                    }
                });
            }
        }

        this.boardBottomY = maxPegY;
        const pinkCount = this.pinkPegCount;
        for (let i = 0; i < pinkCount; i++) {
            if (this.pegs.length > 0) {
                const idx = Math.floor(Math.random() * this.pegs.length);
                this.pegs[idx].type = 'pink';
            }
        }

        // ==================== [sparse 布局专属] 最后两行强制交错粉色钉子 ====================
        // 设计意图：直道钉盘（sparse_interval）的最后两行永远有交错的粉色钉子，
        // 形成「底部粉色陷阱」，让弹珠在落底前必经一段高弹性区域，增加策略性。
        // 交错规则：倒数第2行（偶数列为粉色），倒数第1行（奇数列为粉色）
        if (boardLayout === 'sparse') {
            const lastRow = rows - 1;
            const secondLastRow = rows - 2;
            for (const p of this.pegs) {
                if (p.row === lastRow || p.row === secondLastRow) {
                    // 交错：最后一行奇数列粉色，倒数第二行偶数列粉色
                    const isLastRow = (p.row === lastRow);
                    const shouldBePink = isLastRow ? (p.col % 2 === 1) : (p.col % 2 === 0);
                    if (shouldBePink) {
                        p.type = 'pink';
                        p.level = 1;
                    }
                }
            }
        }

        // [技能系统迭代] 动态过滤 skill_point 槽：仅当玩家有已解锁技能时才生成技能点槽
        let effectiveSlots = [...this.unlockedSlots];
        if (!this.activeSkills || this.activeSkills.length === 0) {
            effectiveSlots = effectiveSlots.filter(t => t !== 'skill_point');
        }
        const effectiveSlotCount = Math.min(this.slotCount, effectiveSlots.length > 0 ? this.slotCount : 0);
        console.log(`[DEBUG] Starting special slot creation: effectiveSlots=${JSON.stringify(effectiveSlots)}, slotCount=${effectiveSlotCount}`);
        if (effectiveSlots.length > 0 && effectiveSlotCount > 0) {
            const slotTypes = effectiveSlots;
            
            // [重构] 不再使用随机坐标匹配，而是直接从合法候选钉子池中抽取
            // 1. 筛选出所有合法的候选钉子索引 (非粉色且未被占用)
            // [双钉子连线模式 v2] 基于行列坐标的严格相邻匹配
            // 相邻定义：
            //   同行水平相邻：同一行，列号相差 1
            //   上下行断对角相邻：行号相差 1，列号相差 0 或 1（奇偶行偏移导致）

            // 1. 筛选候选钉子（非粉色）
            const validPegIndices2 = this.pegs
                .map((p, i) => i)
                .filter(i => this.pegs[i].type !== 'pink');

            // 2. 构建严格相邻对列表：只允许同行相邻或上下行断对角
            const strictPairs = [];
            const addedPairKeys = new Set();

            for (const idxA of validPegIndices2) {
                const pegA = this.pegs[idxA];
                if (pegA.row === undefined) continue;

                for (const idxB of validPegIndices2) {
                    if (idxB <= idxA) continue;
                    const pegB = this.pegs[idxB];
                    if (pegB.row === undefined) continue;

                    const dr = Math.abs(pegA.row - pegB.row);
                    const dc = Math.abs(pegA.col - pegB.col);

                    const isSameRowAdj = (dr === 0 && dc === 1);
                    const isDiagAdj   = (dr === 1 && dc <= 1);

                    if (isSameRowAdj || isDiagAdj) {
                        const key = `${idxA}-${idxB}`;
                        if (!addedPairKeys.has(key)) {
                            strictPairs.push([idxA, idxB]);
                            addedPairKeys.add(key);
                        }
                    }
                }
            }

            console.log(`[DEBUG] Found ${strictPairs.length} strict adjacent peg pairs`);

            // 3. 打乱对列表，随机选取所需数量的对
            for (let i = strictPairs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [strictPairs[i], strictPairs[j]] = [strictPairs[j], strictPairs[i]];
            }

            let createdCount = 0;
            const usedPegs = new Set();

            for (const [idxA, idxB] of strictPairs) {
                if (createdCount >= effectiveSlotCount) break;
                if (usedPegs.has(idxA) || usedPegs.has(idxB)) continue;

                const pegA = this.pegs[idxA];
                const pegB = this.pegs[idxB];
                 // 按顺序分配类型：第 i 个槽使用 slotTypes[i]，确保类型确定性
                const type = slotTypes[createdCount % slotTypes.length];
                const slot = new SpecialSlot(pegA.pos.x, pegA.pos.y, pegB.pos.x, pegB.pos.y, type);
                slot.pegIndex  = idxA;
                slot.pegIndex2 = idxB;
                this.specialSlots.push(slot);
                createdCount++;
                usedPegs.add(idxA);
                usedPegs.add(idxB);

                // [镜像同步] 如果是镜像布局，尝试在镜像位置也生成一个
                if (boardLayout === 'mirror_sync') {
                    const mIdxA = pegA.mirrorIdx;
                    const mIdxB = pegB.mirrorIdx;
                    if (mIdxA !== -1 && mIdxB !== -1 && !usedPegs.has(mIdxA) && !usedPegs.has(mIdxB)) {
                        const mPegA = this.pegs[mIdxA];
                        const mPegB = this.pegs[mIdxB];
                        const mSlot = new SpecialSlot(mPegA.pos.x, mPegA.pos.y, mPegB.pos.x, mPegB.pos.y, type);
                        mSlot.pegIndex = mIdxA;
                        mSlot.pegIndex2 = mIdxB;
                        this.specialSlots.push(mSlot);
                        usedPegs.add(mIdxA);
                        usedPegs.add(mIdxB);
                        // 注意：镜像生成的槽位不计入 createdCount 限制，从而实现数量 x2
                    }
                }
            }

            // 如果严格对不够，退化为单钉子水平短连线
            if (createdCount < effectiveSlotCount) {
                const usedIdx = new Set(this.specialSlots.flatMap(s => [s.pegIndex, s.pegIndex2]));
                const remaining = validPegIndices2.filter(i => !usedIdx.has(i));
                for (const idxA of remaining) {
                    if (createdCount >= effectiveSlotCount) break;
                    const pegA = this.pegs[idxA];
                    // 按顺序分配类型，与主逻辑保持一致
                    const type = slotTypes[createdCount % slotTypes.length];
                    const halfW = spacingX * 0.35;
                    const slot = new SpecialSlot(pegA.pos.x - halfW, pegA.pos.y, pegA.pos.x + halfW, pegA.pos.y, type);
                    slot.pegIndex  = idxA;
                    slot.pegIndex2 = idxA;
                    this.specialSlots.push(slot);
                    createdCount++;
                    console.log(`[DEBUG] Created fallback single-peg slot: type=${type}, pegIdx=${idxA}`);
                }
            }

            console.log(`[DEBUG] Finished special slot creation: final count=${this.specialSlots.length}, target=${effectiveSlotCount}`);
        } else {
            console.log(`[DEBUG] Skipping special slot creation: effectiveSlots.length=${effectiveSlots.length}, effectiveSlotCount=${effectiveSlotCount}`);
        }
        this.ui_updateGatheringQueueUI();
        this.ui_renderRecipeHUD();

        // [概率分析] 存储当前布局类型，并初始化落点分布缓存
        this.currentLayout = boardLayout;
        this._dropDistribution = null;  // 待首次发射时计算
        this._heatmapData = null;
        console.log(`[Plinko] 布局初始化完成: ${boardLayout}，物理参数:`, getLayoutParams(boardLayout).distributionHint);

        // ==================== [diamond 布局专属] 清空虚影钉子数组 ====================
        this.ghostPegs = [];

        // ==================== [triangle 布局专属] 底部左右倍率转盘初始化 ====================
        // 设计：三角钉盘底部左右各放一个倍率转盘，弹珠落入后触发属性翻倍
        // 转盘位置：底部最后一行的左侧和右侧，紧贴三角形底部边缘
        this.triangleSideWheels = [];
        if (boardLayout === 'triangle') {
            const wheelY = maxPegY + 40; // 转盘在最后一行钉子下方 40px
            const wheelXLeft  = canvasWidth * 0.15; // 左侧转盘：距左边缘 15%
            const wheelXRight = canvasWidth * 0.85; // 右侧转盘：距右边缘 15%
            this.triangleSideWheels = [
                new TriangleSideWheel(wheelXLeft,  wheelY, 'left',  this),
                new TriangleSideWheel(wheelXRight, wheelY, 'right', this),
            ];
            console.log(`[Triangle] 侧边倍率转盘已初始化: left=(${wheelXLeft.toFixed(0)}, ${wheelY.toFixed(0)}), right=(${wheelXRight.toFixed(0)}, ${wheelY.toFixed(0)})`);
        }
    },

phase_gathering_getRandomPegType() { 
    // [BUGFIX #1] 恢复完整 pegTypes 数组，根据玩家已解锁属性动态过滤
    // 原 Bug: pegTypes 被硬编码为 ['bounce']，导致所有元素属性钉子无法生成
    // [设计约束] laser 已从钉子类型中移除：激光属性仅能通过弹珠本身或符文提供，不能由钉子给予。
    // 参考先例：lightning 属性同样不拥有对应钉子（见 .cursor/rules/config.md 第5节）。
    const allPegTypes = ['bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'wind'];
    const pegTypes = allPegTypes.filter(t => (this.unlockedWeights[t] || 0) > 0);
    // 1. 获取 normal 的基础权重
    // 我们手动从 unlockedWeights 中取 white 作为普通钉子的权重基准（默认 100）
    const normalWeight = this.unlockedWeights['white'] || 100; 

    // 2. 计算当前所有“已解锁”类型的总权重
    let totalWeight = normalWeight;
    pegTypes.forEach(t => {
        // 只有在 unlockedWeights 中权重 > 0 的才会被计入
        totalWeight += (this.unlockedWeights[t] || 0);
    });
    
    // 3. 生成 0 到 totalWeight 之间的随机数
    let r = Math.random() * totalWeight;
    
    // 4. 区间判定：首先判定是否落在 normal 区间
    if (r < normalWeight) return 'normal';
    r -= normalWeight;
    
    // 5. 依次判定落在哪个特殊属性区间
    for (const t of pegTypes) {
        const w = this.unlockedWeights[t] || 0;
        if (w > 0) {
            if (r < w) return t; // 落在当前属性的权重区间内
            r -= w;
        }
    }
    
    return 'normal'; // 兜底返回
},

/**
     * 开始战斗阶段
     */
    /**
     * @method startCombatPhase
     * @description 开始战斗阶段，初始化敌人和UI。
     */
    phase_startCombatPhase() { 
        this.isEnemyTurn = false;
        this.energyOrbs = [];
        this.sonSwordQueue = []; 
        this.sonSwordTimer = 0;
        this.phase_switchPhase('combat'); 
        // [BUGFIX #5a] 删除冗余的 this.phase = 'combat' 赋值
        // 原 Bug: phase_switchPhase 内部已赋值 this.phase = newPhase，此处重复赋值冗余
        // --- [核心修复 1]：修复属性访问错误 ---
        if (!this.ammoQueue) {
            this.ammoQueue = [];
        }

        // --- [核心修复 2]：UI 渲染 ---
        // 修复后，上面的代码不再报错，这一行将被正确执行，HUD 会在进入战斗时立即出现
        this.ui_updateUI();
        this.ui_renderRecipeHUD(); 

        this.sys_resetMultiplier(); 
        this.burstQueue = []; 
        this.pendingShots = [];
        // [照射词条] 每回合开始时重置持续照射状态
        this._continuousLaserFiring = false;
        this._continuousLaserState = null;
        // [修复] 每回合开始时清除激光相关的视觉效果锁和淡出计时器，
        // 防止上一回合的 setTimeout/帧计数残留导致本回合 isVisualEffectActive 永远为 true
        this.isVisualEffectActive = false;
        this._laserFadeOutFrames = 0;
        
        // [剑刃风暴] 重置回合首发子弹标记与更新定时器
        this._roundFirstShotId = null;
        this._bladeStormProjectile = null;
        this._bladeStormTimer = 0;
        
        // 初始化当前回合伤害记录
        this.shotDamageHistory = [];
        this.currentViewingRound = 0; 
        
        // [符文系统] 记录本回合开始时的敌人数量，用于动态掉落率计算
        this.spawnedEnemiesInRound = this.enemies.filter(e => e.active).length;

        // [词条 Hook] 每回合开始时重置敌人的回合状态标记
        // 包括元素聚变的火/冰/雷状态标记，以及绝对零度的命中计数器
        this.enemies.forEach(e => {
            e._pyroHitThisRound = false;
            e._cryoHitThisRound = false;
            e._lightningHitThisRound = false;
            e._absoluteZeroHitCount = 0;
            // [技能系统迭代] 重置技能相关状态标记
            e._forceFusionThisRound = false; // 棱光炮强制聚变标记
            if (e._frostPrisonAmp) e._frostPrisonAmp = 0; // 冰牢封印伤害加成每回合清除
        });
        
        // [充能符文系统] 初始化充能状态
        this.combat_runeCharge_init();
        
        if (this.ui) {
            this.ui.updateSkillPoints(this.skillPoints);
            this.ui.updateSkillBar(this.skillPoints, this.activeSkills);
        }

        // [演出时机修复] 在进入战斗阶段时，检测是否有待播放入场演出的 Boss。
        // 原来的 boss:spawned 事件和入场动画在 spawn_spawnBoss() 中立即触发，
        // 导致在研磨阶段就播放完毕而战斗时完全看不到演出。
        // 现在统一延迟到此处触发，确保玩家进入战斗阶段时能看到完整的 Boss 出场演出。
        const pendingBoss = this.enemies.find(e => e.active && e.type === 'boss' && e._pendingEntrance);
        if (pendingBoss) {
            pendingBoss._pendingEntrance = false;
            // 激活入场动画计时器
            pendingBoss.entranceTimer = 90;
            // 延迟一帧再触发事件，确保战斗阶段已完全切换后再播放全屏演出
            setTimeout(() => {
                eventBus.emit('boss:spawned', {
                    boss: pendingBoss,
                    bossId: pendingBoss.bossType,
                    bossName: pendingBoss.bossName,
                    isBigBoss: pendingBoss.isBigBoss,
                    round: this.round
                });
                showToast(`☠️ ${pendingBoss.bossName} 出现！`);
            }, 100);
        }
    },

/**
     * @method handleInputStart
     * @description 处理输入开始 (鼠标按下/触摸开始) - [修改版：直射模式]
     */
    phase_handleInputStart(pos) {
        audio.resume();
        const offset = this.input_getTiltOffset();
        const logicPos = pos.sub(offset); 
        
        this.lastMousePos = logicPos;

        // 处理 gameOver 状态的点击（gameover 阶段由其自身 UI 按鈕处理，此处直接忽略）
        if (this.gameOver) {
            return;
        }

        if (this.phase === 'combat') {
             const hitEnemy = this.input_checkEnemyHover(pos);
             if (hitEnemy) return; 
             if (this.ui.isOpen) {
                 this.ui.closeDrawer();
                 return;
             }
             if (!this.isEnemyTurn && this.ammoQueue.length > 0 && this.projectiles.length === 0 && this.burstQueue.length === 0) {
                this.isDragging = true; 
                this.dragStart = new Vec2(this.width / 2, this.height - 80); 
                this.dragCurrent = logicPos; 
                this.ui.closeDrawer();
            }
        }
        else if (this.phase === 'gathering') {
            if (this.isWheelSpinning) {
                showToast("請等待輪盤結算...");
                return;
            }
            if (this.dropBalls.length > 0 || this.energyOrbs.length > 0) {
                // showToast("充能中..."); // 移除正常情况下的提示
                return;
            }
            
            // ---  判断点击区域 ---
            if (pos.y < this.height * 0.4) {
                // 上方区域：发射弹珠
                if (this.activeMarbleIndex >= this.marbleQueue.length) return;
                const marbleDef = this.marbleQueue[this.activeMarbleIndex];
                
                // 使用之前修复过的持久化阈值逻辑
                this.currentSession = {
                    game: this, // [新增] 传入 game 实例引用
                    collected: [], multicast: 0, activeBalls: 1, currentHits: 0,
                    nextTriggerThreshold: this.persistentThreshold, // 确保这里用了 persistentThreshold
                    totalHits: 0, multicastAdded: [], isFinished: false
                };
                if (marbleDef.type === 'laser') {
                    this.currentSession.collected.push('laser');
                } else if (marbleDef.type === 'colored' && marbleDef.type) {
                    this.currentSession.collected.push(marbleDef.type);
                }
                this.combat_updateHitProgress(0, this.persistentThreshold);
                const newBall = new DropBall(pos.x, 30, marbleDef, this.currentSession);
                // [物理增强] 注入当前布局的物理参数，使弹珠具备布局专属的物理特性
                newBall.layoutParams = getLayoutParams(this.currentLayout || 'default');
                this.dropBalls.push(newBall);
                // [概率分析] 计算当前布局的落点分布，用于热力图显示
                this._updateDropDistribution(pos.x);
                this.ui_updateGatheringQueueUI();
                audio.playShoot();
                this.combat_updateMulticastDisplay(0);
            } else {
                // ---  下方区域：进入“抓取倾斜”模式，暂不报错 ---
                this.isTiltingGrip = true;
                this.gripStartPos = pos;
                // 这里不显示 toast，等到松开时如果没动才显示
            }
        } 
    },

//  处理单个敌人的回合逻辑 (当波扫到它时调用)
    /**
     * @param {any} e - TODO: Describe this parameter.
     */
    phase_enemy_processTurn(e) {
        if (!e.active || e.hasActedThisTurn) return;
        
        e.hasActedThisTurn = true; 
        
        //  只要觸發了結算，強迫掃描波在接下來的 45 幀內保持慢速
        // 這樣即使敵人被燒死消失了，波浪也會慢慢掃過屍體位置，展現"擊殺確認"的感覺
        this.waveMomentumTimer = 45; 

        // --- 1. 温度结算逻辑 ---
        // 封装单次温度结算逻辑为函数，便于 berserk 重复执行
        // --- [属性共鸣] 冰霜共鸣：读取 freezeTempThreshold，动态调整冰冻触发门槛 ---
        const _cryoRes = this.activeElementResonances && this.activeElementResonances['cryo'];
        const _cryoResParams = _cryoRes ? _cryoRes.params : null;
        // 一阶: -60, 二阶: -40, 三阶: -20（默认: -100 必冻 / -50~-100 概率冻）
        const _freezeHardThreshold = _cryoResParams ? (_cryoResParams.freezeTempThreshold || -100) : -100;
        const _freezeSoftThreshold = _freezeHardThreshold + 50; // 概率触发起始点（比必冻阈值高50度）
        const _processTempOnce = () => {
            if (e.temp < 0) {
                let shouldFreeze = false;
                if (e.temp <= _freezeHardThreshold) {
                    shouldFreeze = true;
                } else if (e.temp <= _freezeSoftThreshold) {
                    const chance = (Math.abs(e.temp) - Math.abs(_freezeSoftThreshold)) / 50;
                    if (Math.random() < chance) shouldFreeze = true;
                }
                if (shouldFreeze) {
                    e.isFrozenCurrentTurn = true;
                    e.frozenCount = (e.frozenCount || 0) + 1;
                    this.spawn_createExplosion(e.pos.x, e.pos.y, '#06b6d4');
                    audio.playEffect('freeze');
                } else {
                    e.isFrozenCurrentTurn = false;
                }
                e.temp = Math.ceil(e.temp / 2);
            }
            if (e.temp > 0 && e.active) {
                if (e.temp < 100) {
                    e.temp = Math.max(0, e.temp - 5);
                } else {
                    const dot = 5 + (e.temp - 100);
                    e.takeDamage(dot);
                    this.combat_recordDamage(dot, 'pyro', 'main');
                    e.playBurnTickEffect(this, Math.floor(dot));
                    const decay = Math.floor(e.temp / 20);
                    e.temp = Math.max(0, e.temp - decay);
                }
            }
        };

        // [改动] berserk 词条：先执行两次温度结算，再 +20℃
        _processTempOnce();
        if (e.affixes && e.affixes.includes('berserk')) {
            _processTempOnce();
            e.temp += 20;
            this.spawn_createFloatingText(e.pos.x, e.pos.y - 30, '+20℃', '#f97316');
        }

        // --- 2. Ignis 狂暴阶段：温度急升 + 火焰溅射 ---
        if (e.active && e.type === 'boss' && e.bossType === 'ignis' && e._berserkedTempRise) {
            // 每回合温度上升
            e.temp += e._berserkedTempRise;
            this.spawn_createFloatingText(e.pos.x, e.pos.y - 30, `+${e._berserkedTempRise}℃`, '#f97316');

            // 火焰溅射：对周围半径内的其他活跃敌人造成火焰伤害
            if (e._berserkedFireSplash) {
                const { radius, damage } = e._berserkedFireSplash;
                // 橙红色火焰粒子视觉反馈（在 Ignis 周围生成）
                for (let i = 0; i < 12; i++) {
                    const angle = (i / 12) * Math.PI * 2;
                    const px = e.pos.x + Math.cos(angle) * (radius * 0.5);
                    const py = e.pos.y + Math.sin(angle) * (radius * 0.5);
                    this.spawn_createParticle(px, py, '#ff4500', 'ember');
                }
                for (let i = 0; i < 8; i++) {
                    this.spawn_createParticle(e.pos.x, e.pos.y, '#ff6b00', 'spark');
                }

                // 对周围敌人造成火焰溅射伤害
                const activeEnemies = this.enemies.filter(other =>
                    other.active && other !== e
                );
                activeEnemies.forEach(other => {
                    const dx = other.pos.x - e.pos.x;
                    const dy = other.pos.y - e.pos.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        other.takeDamage(damage);
                        this.combat_recordDamage(damage, 'pyro', 'main');
                        // 被溅射敌人的火焰粒子特效
                        for (let i = 0; i < 4; i++) {
                            this.spawn_createParticle(other.pos.x, other.pos.y, '#ff4500', 'spark');
                        }
                        this.spawn_createFloatingText(other.pos.x, other.pos.y - 20, `🔥-${damage}`, '#f97316');
                    }
                });
            }
        }

        // --- 3. 行动逻辑 ---
        // 只有活着的敌人才移动
        if (e.active && e.isFrozenCurrentTurn == false) {
            // 奥罗波罗斯 Boss：回合开始时进行词缀轮转
            if (e.type === 'boss' && e.bossType === 'ouroboros' && typeof e._performOuroborosRotation === 'function') {
                e._performOuroborosRotation(this);
            }
            e.startTurnAction(this);
        }
    },

/**
     * @method phase_claimPendingRunes
     * @description 敌人动作后领取待入库符文：
     *   1. 充能符文（combo充能奖励）
     *   2. 场地掉落符文（回合结算自动拾取）
     * 对每个符文触发飞入背包动画，让玩家知道获得了这些符文。
     * 应在 phase_finalizeRound 之前调用（敌人动作后）。
     */
    phase_claimPendingRunes() {
        // 收集所有待领取符文（充能符文 + 掉落符文）
        const pendingRunes = [];

        // 1. 充能符文：如果充能有奖励，先入库再加入动画队列
        const chargeDef = this.runeChargeCurrentRune;
        if (chargeDef) {
            const chargeLevel = this.runeChargeCurrentLevel || 1;
            this.runeInventory.push({ id: chargeDef.id, level: chargeLevel });
            pendingRunes.push({ runeDef: chargeDef, level: chargeLevel, source: 'charge' });
            // 重置充能状态（不再在 combat_runeCharge_claimReward 中重复入库）
            this.runeChargeValue        = 0;
            this.runeChargeLevel        = 0;
            this.runeChargeCurrentRune  = null;
            this.runeChargeCurrentLevel = 1;
            // 音效
            try { if (audio?.playPowerup) audio.playPowerup(); } catch(e) {}
        }

        // 2. 掉落符文：将场地掉落符文入库，加入动画队列
        if (this.runeLootItems && this.runeLootItems.length > 0) {
            this.runeLootItems.forEach(loot => {
                if (!loot.active) return;
                const runeDef = RUNE_DB.find(r => r.id === loot.runeId);
                if (!runeDef) { loot.active = false; return; }
                const level = loot.level || 1;
                this.runeInventory.push({ id: loot.runeId, level });
                pendingRunes.push({ runeDef, level, source: 'loot', x: loot.x, y: loot.y });
                loot.active = false;
            });
            this.runeLootItems = [];
        }

        // 3. 如果有待领取符文，触发飞入背包动画事件
        if (pendingRunes.length > 0) {
            eventBus.emit(EVENT_TYPES.UI_RUNE_CLAIM_AFTER_ENEMY, { runes: pendingRunes });
            // 4. 延迟检测是否可以组成词条，如可以则展示气泡提示
            //    延迟 800ms 以等待符文飞入动画播放完毕
            setTimeout(() => {
                if (this._ui_checkRunewordBubble) {
                    // 重置气泡关闭标记（新符文入库应重新提示）
                    this._runewordBubbleDismissed = false;
                    this._ui_checkRunewordBubble();
                }
            }, 800);
        }
    },

/**
     * @method startEnemyTurnLogic
     * @description 启动敌人回合：锁定状态、显示UI提示、并计算所有敌人的移动与技能
     */
    phase_enemy_startLogic() {
        this.isEnemyTurn = true;
        this.enemyTurnTimer = 0;

        // 初始化扫描波
        this.enemyWaveActive = true;
        this.enemyWaveY = this.height + 50; // 从屏幕最下方开始
        this.waveSpeed = 8 * this.timeScale; // 根据倍速调整扫描速度
        // 重置所有敌人的行动标记
        this.enemies.forEach(e => {
            e.hasActedThisTurn = false;
            e.isFrozenCurrentTurn = false; // 重置上一轮的冰冻状态
            // [照射词条] 回合结束时清零照射叠加层数，防止残留到下一回合
            if (e._irradiationStacks) e._irradiationStacks = 0;

            // [Boss 移动提示预计算]
            // 在回合开始时预计算 Boss 本回合是否会移动，以便 UI 标签能在回合开始时就显示正确提示
            if (e.type === 'boss' && e.bossType && typeof e._moveCooldown !== 'undefined') {
                if (e.berserked) {
                    e._willMoveThisTurn = true;
                } else {
                    e._willMoveThisTurn = (e._moveCooldown === 0);
                }
            }
        });

        // UI 提示
        const msgEl = document.getElementById('combat-message');
        if (msgEl) {
            msgEl.innerHTML = '<span class="text-yellow-400 font-bold text-xl drop-shadow-md">⚠️ ENEMY TURN</span>';
            msgEl.classList.remove('opacity-0');
            msgEl.classList.add('pop-anim'); 
        }
    },

/**
     * @method finalizeRound
     * @description [修改版] 回合结算，包含劣势补偿机制(自动极速)
     */
    phase_finalizeRound() {
        // 1. 统计当前存活敌人数据
        const activeEnemies = this.enemies.filter(e => e.active);
        // [清屏检测] 记录本回合是否完成了清屏，供下一回合生成逻辑使用
        const clearedThisRound = activeEnemies.length === 0;
        // 使用 Set 统计有多少个不同的 Y 坐标（即有多少行）
        // Math.round 处理浮点误差，/50 是行高，确保归类准确
        const uniqueRows = new Set(activeEnemies.map(e => Math.round(e.pos.y / this.enemyHeight)));
        
        // 2. 触发条件判定：行数 <= 1 或 总数 <= 5
        if (uniqueRows.size <= 1 || activeEnemies.length <= 5) {
            let buffCount = 0;
            activeEnemies.forEach(e => {
                if (!e.affixes.includes('haste')) {
                    e.affixes.push('haste');
                    buffCount++;
                    // [视觉] 获得Buff的特效
                    this.spawn_createParticle(e.pos.x, e.pos.y, '#facc15', 'spark');
                }
            });
            
            if (buffCount > 0) {
                showToast("⚠️ 敵軍狂暴 (HASTE APPLIED) ⚠️");
                audio.playPowerup(); // 播放警示音
            }
        }

        // --- [符文领取] 充能符文和掉落符文的领取已提前到敌人动作后（phase_claimPendingRunes）执行
        // 仅将库存同步到存档（符文已在 phase_claimPendingRunes 中入库）
        this.saveData.runeInventory = (this.runeInventory || []).slice();
        this.sys_saveData();

        // --- [Glacies 狂暴] Peg 冻结回合数递减 ---
        if (this.pegs && Array.isArray(this.pegs)) {
            this.pegs.forEach(peg => {
                if (peg && peg.frozenTurns > 0) {
                    peg.frozenTurns--;
                }
            });
        }

        // --- 以下保持原有的回合结算逻辑 ---
        
        // =========================================
        // Boss 回合触发检测
        // =========================================
        // round++ 在下方执行，这里的 this.round 是即将到来的回合数
        const nextRound = this.round + 1;
        const bossCheck = this.spawn_checkBossRoundFor(nextRound);
        if (bossCheck.shouldSpawn) {
            // Boss 回合：不生成普通敌人行，改为生成 Boss
            const bossId = this.spawn_selectBossForRound(bossCheck.isBigBoss);
            // 延迟到回合切换后生成 Boss，确保 round++ 已执行
            this._pendingBossSpawn = { bossId, isBigBoss: bossCheck.isBigBoss };
        } else {
            // 普通回合：生成敌人行
            const rowCountCurrent = uniqueRows.size;
            let spawnCount = 1;
            if (rowCountCurrent < 4) spawnCount = 3;
            // [清屏奖励] 上一回合完成清屏，本回合至少推进 3 行敌人
            if (this._prevRoundCleared && spawnCount < 3) spawnCount = 3;
            this.spawn_spawnEnemyRow(spawnCount);
        }
        // [清屏状态] 将本回合清屏结果写入标志位，供下一回合读取
        this._prevRoundCleared = clearedThisRound;

        // 重置倍率
        if (this.nextRoundHpMultiplier > 1) {
            showToast("強敵來襲！HP x" + this.nextRoundHpMultiplier);
            this.nextRoundHpMultiplier = 1;
        }

        // [修复] 回合切换时清空蝶蝶法阵和风刃，防止残留
        if (this.butterflyCircles) this.butterflyCircles = [];
        if (this.butterflyBlades) this.butterflyBlades = [];

        // [难度平衡] 战后高压因子递减
        if (this.postBossSurgeRoundsLeft > 0) {
            this.postBossSurgeRoundsLeft--;
            this.postBossMultiplier = Math.max(1.0, this.postBossMultiplier - 0.1);
            if (this.postBossSurgeRoundsLeft === 0) {
                this.postBossMultiplier = 1.0;
                console.log('[DifficultyBalance] 战后高压因子已恢复正常');
            }
        }

        // [新增] 遗物效果递减：同化涌潮系列
        if (this.assimilationBoostRounds && typeof this.assimilationBoostRounds === 'object') {
            for (const mt of Object.keys(this.assimilationBoostRounds)) {
                if (this.assimilationBoostRounds[mt] > 0) {
                    this.assimilationBoostRounds[mt]--;
                    if (this.assimilationBoostRounds[mt] === 0) {
                        const display = CONFIG.ui?.attributeDisplay?.[mt]?.name ?? mt;
                        showToast(`${display}涌潮效果已結束。`);
                    }
                }
            }
        }
        
        this.round++;
        this.prevRoundDamage = this.roundDamage;
        this.roundDamage = 0;
        eventBus.emit(EVENT_TYPES.UI_ROUND_NUM_UPDATE, { round: this.round });
        document.getElementById("round-num").innerText = this.round;
        showToast(`Round ${this.round}`);

        // [爽游模式] 新手教程局：第 5 回合结算后触发胜利
        if (this._isTutorialRun && this.round > 5) {
            this.gameOver = true;
            this._isTutorialRunCleared = true; // 标记为胜利结局
            this._gameover_triggerPhase();
            return;
        }

        // 检查失败
        if (this.input_checkDefeat()) {
            this.gameOver = true;
            // [游戏结束] 切换到结算阶段
            this._gameover_triggerPhase();
            return;
        }

        document.getElementById('combat-message').innerHTML = '';
        this.phase_gathering_initPachinko(true);

        // =========================================
        // 待执行 Boss 生成（round++ 后执行）
        // =========================================
        if (this._pendingBossSpawn) {
            const { bossId, isBigBoss } = this._pendingBossSpawn;
            this._pendingBossSpawn = null;
            this.spawn_spawnBoss(bossId, isBigBoss);
            // [Boss 调度] 记录本次 Boss 生成回合，用于计算击杀用时
            this._lastBossSpawnRound = this.round;
            if (!this._bossSpawnCount) this._bossSpawnCount = 0;
            this._bossSpawnCount++;
            console.log(`[BossSchedule] Boss #${this._bossSpawnCount} 已在 Round ${this.round} 生成`);
        }

        this.isEnemyTurn = false;
        // 遗物事件检查：从第3回合起，每5回合触发一次（第3、8、13、18...回合）
        // 初始回合的遗物选择由 sys_initGameStart 直接调用 ui_showRelicSelection 处理
        const isRelicRound = this.round >= 3 && (this.round - 3) % 5 === 0;
        if (isRelicRound) {
            showToast("✨ 命魔的馈赠 ✨");
            this.phase = 'relic_event';
            setTimeout(() => { this.ui_showRelicSelection(); }, 500);
            return;
        }
        
        
        if (this.ammoQueue.length === 0) {
            // [局内存档] 每回合结算完毕后自动存档，防止刷新丢失进度
            this.sys_saveRunState();
            this.sys_initSelectionPhase();
        }
    },
    smartScientific(num, fractionDigits = 2) {
        // 1. 处理 0 和 非数字 的情况
        if (isNaN(num)) return "NaN";
        if (num === 0) return "0";

        const absVal = Math.abs(num);

        // 2. 设定阈值：绝对值 >= 10000 或 < 0.001 时使用科学计数法
        // 你可以根据需求修改这个范围
        if (absVal >= 10000 || absVal < 0.001) {
            // --- 方案 2 的美化逻辑 ---
            
            // 获取标准格式 (如 "1.23e+5")
            const str = num.toExponential(fractionDigits);
            
            // 分割底数和指数
            const [base, exponent] = str.split('e');
            
            // 去掉指数的正号 (如 "+5" -> "5")
            const cleanExponent = exponent.replace('+', '');
            
            // 返回美化格式
            return `${base} × 10^${cleanExponent}`;
        }

        // 3. 正常范围内的数字
        // 使用 parseFloat + toFixed 是为了处理 JS 浮点数精度问题 (如 0.1+0.2)
        // 并自动去掉末尾多余的 0 (例如 5.500 -> 5.5)
        return parseFloat(num.toFixed(fractionDigits)).toString();
    },
/**
     * @method updateCombat
     * @description 战斗阶段的游戏逻辑更新 (含可视化墙壁与分层视差)。
     */
    phase_combat_update(timeScale) {

        // === [新增] 处理子剑动态生成队列 ===
        if (this.sonSwordQueue.length > 0) {
            this.sonSwordTimer -= timeScale;
            
            if (this.sonSwordTimer <= 0) {
                // 取出一个生成请求
                const req = this.sonSwordQueue.shift();
                
                // 只要母剑还活着(或者没飞太远)，就生成子剑
                if (req.mother.active || !req.mother.destroyed) {
                    // 这里 startDelay 传 0，因为我们已经通过队列控制了时间
                    this.combat_flyingSword_addSon(req.x, req.y, req.mother, req.level, req.config, 0);
                    
                    // 播放一个轻微的生成音效 (可选)
                    // audio.playTone(600 + this.sonSwordQueue.length * 50, 'sine', 0.05, 0.1);
                }

                // [核心算法] 动态延迟计算
                // 剩余数量越多，延迟越短 (喷射而出)；剩余越少，延迟越长 (慢慢收尾)
                const fsCfg = CONFIG.mechanics.flying_sword;
                const remaining = this.sonSwordQueue.length;
                
                // 公式：基础延迟，每多一个排队减少 2帧，最快限制
                this.sonSwordTimer = Math.max(fsCfg.sonSwordDelayMin, fsCfg.sonSwordDelayBase - (remaining * 2));
            }
        }

        if (this.isChargingShot) {
            // 吸收速度：0.08 大约需要 12 帧 (0.2秒)，手感比较干脆
            this.chargeProgress += 0.08 * timeScale;
            
            if (this.chargeProgress >= 1.0) {
                // 动画结束，真正发射
                this.isChargingShot = false;
                this.chargeProgress = 0;
                if (this.pendingFireVelocity) {
                    this.combat_fireNextShot(this.pendingFireVelocity);
                    this.pendingFireVelocity = null;
                    // --- [新增] 发射后立即触发“能量注入”动画 ---
                    this.isReloading = true;
                    this.reloadProgress = 0;
                }
            }
        }
        // --- [修改] 2. 处理能量注入 (变慢 & 增加撞击反馈) ---
        if (this.isReloading) {
            // [修改点] 速度从 0.1 改为 0.035，让过程持续约 0.5秒，更具重量感
            this.reloadProgress += 0.035 * timeScale;
            
            if (this.reloadProgress >= 1.0) {
                this.isReloading = false;
                this.reloadProgress = 1.0;
                
                // [新增] 撞击时刻！给予轨道一个巨大的旋转初速度
                // 就像能量球狠狠砸在了轨道上，带动它疯狂旋转
                this.spinBoost = 0.002; 
            }
        }

        // --- [新增] 3. 计算轨道旋转物理 (惯性与阻力) ---
        // 基础旋转速度 (约为 0.5 rad/frame)
        const baseSpeed = 0.00012; 
        
        // 阻力衰减：每一帧速度乘以 0.92，快速慢下来
        this.spinBoost *= 0.95;
        if (this.spinBoost < 0.0001) this.spinBoost = 0;

        // 最终角度累加：基础速度 + 爆发速度
        // 在装填过程中(isReloading)，为了体现"未就位"，我们可以让轨道转得稍慢一点，或者反向转
        let currentFrameSpeed = baseSpeed + this.spinBoost;
        this.orbitalAngle += currentFrameSpeed * timeScale * 60; // *60 是为了适配 timeScale 的基准
        this.ui_updateSlowMotion();
        // [充能符文系统] 充能条自动衰减
        if (this.phase === 'combat' || this.phase === 'training') {
            this.combat_runeCharge_decay(timeScale);
        }
        const tilt = this.boardTilt.current;
        const container = document.getElementById('game-container');
        if (container) {
            container.style.perspective = "1200px";
            const rotateX = tilt.y * -8;
            const rotateY = tilt.x * 8;
            const translateZ = -20;
            // container.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
            container.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(0px)`;
        }

        // === 1. 计算视差参数 ===
        // 背景层 (地板)：正向移动
        const bgShiftX = tilt.x * 20;
        const bgShiftY = tilt.y * 15;

        // 实体层 (敌人/UI/墙壁)：反向移动
        const entityShiftX = tilt.x * -15;
        const entityShiftY = tilt.y * -10;

        // 应用 CSS 到 DOM UI
        // const skillBar = document.getElementById('skill-bar');
        // const hud = document.getElementById('recipe-hud-container');
        // const uiTransform = `translate3d(${entityShiftX}px, ${entityShiftY}px, 0)`;
        // if (skillBar) skillBar.style.transform = uiTransform;
        // if (hud) hud.style.transform = uiTransform;

        if (this.swordQis) {
            for (let i = this.swordQis.length - 1; i >= 0; i--) {
                const qi = this.swordQis[i];
                qi.update(timeScale, this.enemies, this); // 傳入 enemies 和 game 實例
                if (!qi.active) {
                    this.swordQis.splice(i, 1);
                }
            }
        }
        // --- 逻辑更新 ---
        for (let i = this.burstQueue.length - 1; i >= 0; i--) { 
            const shot = this.burstQueue[i]; 
            shot.delay -= timeScale; 
            if (shot.delay <= 0) { 
                this.spawn_spawnBullet(this.width/2, this.height-80, shot.vel, shot.recipe, shot.shotId, shot.isLast); 
                audio.playShoot(); 
                this.burstQueue.splice(i, 1); 
            } 
        }
        if (this.waveMomentumTimer > 0) this.waveMomentumTimer -= timeScale;

        // ==========================================
        //  LAYER 0: 固定 UI 层 (防线)
        // ==========================================
        this.ctx.save();
        const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
        this.ctx.shadowColor = 'rgba(239, 68, 68, 1)';
        this.ctx.shadowBlur = 8 + pulse * 12;
        this.ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + pulse * 0.35})`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.defeatLineY);
        this.ctx.lineTo(this.width, this.defeatLineY);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.fillText("⚠️ DEFENSE LINE", 10, this.defeatLineY - 6);
        const dangerGrad = this.ctx.createLinearGradient(0, this.defeatLineY, 0, this.height);
        dangerGrad.addColorStop(0, `rgba(239, 68, 68, ${0.08 + pulse * 0.08})`);
        dangerGrad.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
        this.ctx.fillStyle = dangerGrad;
        this.ctx.fillRect(0, this.defeatLineY, this.width, this.height - this.defeatLineY);
        this.ctx.restore();


        // ==========================================
        //  LAYER 1: 背景层 (网格 & 扫描波)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(bgShiftX, bgShiftY); 

            // A. 绘制背景网格 (双层刻线效果)
            this.ctx.save();
            const gridOffsetX = bgShiftX * 1.5;
            const gridOffsetY = bgShiftY * 1.5;
            this.ctx.beginPath();
            for (let x = -50; x < this.width + 50; x += 40) {
                this.ctx.moveTo(x, -50); this.ctx.lineTo(x, this.height + 50);
            }
            for (let y = -50; y < this.height + 50; y += 40) {
                this.ctx.moveTo(-50, y); this.ctx.lineTo(this.width + 50, y);
            }
            // 第一遍：沟槽阴影
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.stroke();
            // 第二遍：发光刻线
            this.ctx.lineWidth = 1;
            this.ctx.strokeStyle = 'rgba(94, 163, 184, 0.18)';
            this.ctx.stroke();
            // 网格交叉点微小发光点
            this.ctx.globalAlpha = 0.08;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 1)';
            for (let x = -50; x < this.width + 50; x += 40) {
                for (let y = -50; y < this.height + 50; y += 40) {
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
            this.ctx.globalAlpha = 1;
            this.ctx.restore();

            // B. 绘制扫描波
            if (this.isEnemyTurn && this.enemyWaveActive) {
                const currentSpeed = this.calc_calculateWaveSpeed();
                this.enemyWaveY -= currentSpeed;

                this.ctx.save();
                this.ctx.globalCompositeOperation = 'lighter';
                
                const trailHeight = 220; 
                const gridGrad = this.ctx.createLinearGradient(0, this.enemyWaveY, 0, this.enemyWaveY + trailHeight);
                gridGrad.addColorStop(0, 'rgba(251, 191, 36, 0.5)'); 
                gridGrad.addColorStop(0.3, 'rgba(217, 119, 6, 0.2)'); 
                gridGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');     
                this.ctx.strokeStyle = gridGrad;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                const cols = 8;
                for(let i=0; i<=cols; i++) {
                    const x = (this.width / cols) * i;
                    this.ctx.moveTo(x, this.enemyWaveY);
                    this.ctx.lineTo(x, this.enemyWaveY + trailHeight);
                }
                const gridSize = 40;
                const startGridY = Math.floor(this.enemyWaveY / gridSize) * gridSize;
                for(let y = startGridY; y < this.enemyWaveY + trailHeight; y += gridSize) {
                    if(y > this.enemyWaveY) { 
                        this.ctx.moveTo(0, y);
                        this.ctx.lineTo(this.width, y);
                    }
                }
                this.ctx.stroke();

                const time = Date.now() / 50; 
                this.ctx.beginPath();
                this.ctx.strokeStyle = '#ffffff'; 
                this.ctx.lineWidth = 4;
                this.ctx.shadowColor = '#fef08a'; 
                this.ctx.shadowBlur = 20;
                for (let x = 0; x <= this.width; x += 10) {
                    const offset = Math.sin(x * 0.1 + time) * 2 + (Math.random() - 0.5) * 6;
                    const y = this.enemyWaveY + offset;
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();

                // [T4-B] 余晖线：在前沿线下方 20px 处绘制一条淡金色余晖
                this.ctx.beginPath();
                this.ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
                this.ctx.lineWidth = 1.5;
                this.ctx.shadowBlur = 0;
                for (let x = 0; x <= this.width; x += 10) {
                    const offset = Math.sin(x * 0.1 + time) * 2 + (Math.random() - 0.5) * 6;
                    const y = this.enemyWaveY + offset + 20;
                    if (x === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                }
                this.ctx.stroke();
                
                this.ctx.fillStyle = '#fef3c7'; 
                for(let i=0; i<5; i++) {
                    const lx = Math.random() * this.width;
                    const ly = this.enemyWaveY + (Math.random() - 0.5) * 30;
                    const lw = Math.random() * 50 + 10;
                    this.ctx.fillRect(lx, ly, lw, 1);
                }
                this.ctx.restore();

                const triggerLine = this.enemyWaveY; 
                this.enemies.forEach(e => {
                    if (!e.active) return;
                    if (e.pos.y + e.height/2 >= triggerLine && !e.hasActedThisTurn) {
                        e.playScanFeedback();
                        this.phase_enemy_processTurn(e);
                    }
                });
                if (this.enemyWaveY < -50) {
                    this.enemyWaveActive = false;
                    this.enemyTurnTimer = 0;
                }
            }

        // [T4-A] 底部能量粉尘：基于时间的伪随机上升光点，增加场地空气感
        this.ctx.save();
        const dustTime = Date.now() / 60;
        for (let i = 0; i < 25; i++) {
            const baseX = (Math.sin(i * 137.508) * 0.5 + 0.5) * this.width;
            const speed = 0.6 + (i % 3) * 0.4;
            const dustY = this.defeatLineY - ((dustTime * speed + i * 91.3) % (this.defeatLineY * 0.8));
            const alpha = 0.08 + Math.sin(dustTime * 0.5 + i) * 0.04;
            const size = 1 + (i % 2) * 0.5;
            this.ctx.globalAlpha = Math.max(0, alpha);
            this.ctx.fillStyle = i % 3 === 0 ? '#38bdf8' : '#94a3b8';
            this.ctx.fillRect(baseX, dustY, size, size);
        }
        this.ctx.globalAlpha = 1;
        this.ctx.restore();

        this.ctx.restore(); 


        // ==========================================
        //  LAYER 2: 实体层 (墙壁 / 敌人 / 子弹)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(entityShiftX, entityShiftY); 

            // --- [修复]：绘制可视化的边界墙壁（从顶部栏下边界开始，不遥挡顶部栏内容）---
            this.ctx.save();
            // 顶部栏下边界 Y（combatGridTopY - enemyHeight/2 即第一行敌人上边界，也是顶部栏底部）
            const wallTopY = this.combatGridTopY - this.enemyHeight / 2;
            // 左墙 (玻璃质感渐变)
            const wallGradLeft = this.ctx.createLinearGradient(0, 0, 20, 0);
            wallGradLeft.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            wallGradLeft.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
            wallGradLeft.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradLeft;
            this.ctx.fillRect(0, wallTopY, 20, this.height - wallTopY);
            // 左墙反光线
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(0, wallTopY, 1, this.height - wallTopY);
            
            // 右墙 (玻璃质感渐变)
            const wallGradRight = this.ctx.createLinearGradient(this.width, 0, this.width - 20, 0);
            wallGradRight.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            wallGradRight.addColorStop(0.3, 'rgba(148, 163, 184, 0.1)');
            wallGradRight.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradRight;
            this.ctx.fillRect(this.width - 20, wallTopY, 20, this.height - wallTopY);
            // 右墙反光线
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fillRect(this.width - 1, wallTopY, 1, this.height - wallTopY);

            // 墙壁发光边框 (明确反弹线)
            this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // Slate-400
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#38bdf8';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            // 左边线（从顶部栏下边界开始）
            this.ctx.moveTo(1, wallTopY); this.ctx.lineTo(1, this.height);
            // 右边线（从顶部栏下边界开始）
            this.ctx.moveTo(this.width - 1, wallTopY); this.ctx.lineTo(this.width - 1, this.height);
            // 顶部线 (顶部栏下边界，不遥挡顶部栏)
            this.ctx.moveTo(0, wallTopY); this.ctx.lineTo(this.width, wallTopY);
            this.ctx.stroke();
            this.ctx.restore();
            // ------------------------------------

            // C. 绘制游戏实体
            let activeEnemies = 0; 
            let anyEnemyMoving = false;
            this.enemies.forEach(e => {
                if (e.active) {
                    e.update(this.timeScale, this);
                    e.draw(this.ctx);
                    // Boss 入场动画期间（pos.y 在屏幕外）也计入活跃敌人，防止误判完美清场
                    // [演出时机修复] 同时兼容 _pendingEntrance 状态（Boss 在屏幕外待机）
                    if (e.pos.y > 0 || (e.type === 'boss' && (e.entranceTimer > 0 || e._pendingEntrance))) {
                        activeEnemies++;
                    }
                    if (Math.abs(e.pos.y - e.dropTargetY) > 1) anyEnemyMoving = true;
                }
            });

            if (this.input_checkDefeat()) {
                this.gameOver = true;
                // [游戏结束] 切换到结算阶段
                this._gameover_triggerPhase();
            }

            // 更新和绘制弹丸
            for (let i = this.projectiles.length - 1; i >= 0; i--) { 
                const p = this.projectiles[i]; 
                if(p) { 
                    p.update(this.width, this.height, this.enemies, (spawnInfo) => { this.spawn_spawnBullet(spawnInfo.x, spawnInfo.y, spawnInfo.vel, spawnInfo.config, p.shotId); }, timeScale); 
                    p.draw(this.ctx); 
                    if (p.destroyed) {
                        // [修复] 当该shotId的所有子弹都销毁时，保存统计
                        if (p.shotId !== null && this.shotDamageMap.has(p.shotId)) {
                            const shotStats = this.shotDamageMap.get(p.shotId);
                            shotStats.destroyedCount++;
                            
                            // 当所有子弹都销毁时，保存统计
                            if (shotStats.destroyedCount >= shotStats.projectileCount && shotStats.total > 0) {
                                this.shotDamageHistory.push({
                                    total: shotStats.total,
                                    byAttr: JSON.parse(JSON.stringify(shotStats.byAttr))
                                });
                                // 增加容量到 10 发子弹，方便查看
                                if (this.shotDamageHistory.length > 10) {
                                    this.shotDamageHistory.shift();
                                }
                                this.ui_updateDamageStats();
                                this.shotDamageMap.delete(p.shotId);
                            }
                        }
                        this.projectiles.splice(i, 1);
                    } 
                } 
            }

            // 更新和绘制 FireWaves
            for (let i = this.fireWaves.length - 1; i >= 0; i--) {
                const fw = this.fireWaves[i];
                fw.update(timeScale);
                fw.draw(this.ctx);
                if (fw.life <= 0) this.fireWaves.splice(i, 1);
            }
            // 更新和绘制 IceWaves（冰冻状态死亡特效）
            if (this.iceWaves) {
                for (let i = this.iceWaves.length - 1; i >= 0; i--) {
                    const iw = this.iceWaves[i];
                    iw.update(timeScale);
                    iw.draw(this.ctx);
                    if (iw.life <= 0) this.iceWaves.splice(i, 1);
                }
            }
            // 更新和绘制 HealWaves（范围治疗扩散波特效）
            if (this.healWaves) {
                for (let i = this.healWaves.length - 1; i >= 0; i--) {
                    const hw = this.healWaves[i];
                    hw.update(timeScale);
                    hw.draw(this.ctx);
                    if (hw.life <= 0) this.healWaves.splice(i, 1);
                }
            }
            // 更新和绘制 DeathExplosions（分级死亡爆炸特效）
            if (this.deathExplosions) {
                for (let i = this.deathExplosions.length - 1; i >= 0; i--) {
                    const de = this.deathExplosions[i];
                    de.update(timeScale);
                    de.draw(this.ctx);
                    if (de.life <= 0) this.deathExplosions.splice(i, 1);
                }
            }

            // 更新和绘制特效
            for(let i=this.particles.length-1; i>=0; i--) { let p = this.particles[i]; if(p) { p.update(timeScale); p.draw(this.ctx); if(p.life <= 0) this.particles.splice(i,1); } } 
            for(let i=this.shockwaves.length-1; i>=0; i--) { let s = this.shockwaves[i]; if(s) { s.update(timeScale); s.draw(this.ctx); if(s.alpha <= 0) this.shockwaves.splice(i,1); } } 
            for(let i=this.lightningBolts.length-1; i>=0; i--) { let b = this.lightningBolts[i]; b.update(timeScale); b.draw(this.ctx); if(b.life <= 0) this.lightningBolts.splice(i,1); } 
            for(let i=this.spores.length-1; i>=0; i--) { let s = this.spores[i]; if(s) { s.update(timeScale); s.draw(this.ctx); if(!s.active) this.spores.splice(i,1); } }
            if (this.swordQis) {
                this.swordQis.forEach(qi => qi.draw(this.ctx));
            }
            // 蝴蝶法阵更新和绘制
            this.combat_wind_updateButterflyCircles(timeScale);
            this.combat_wind_drawButterflyCircles(this.ctx);
            this.combat_wind_updateButterflyBlades(timeScale);
            this.combat_wind_drawButterflyBlades(this.ctx);
            // 风暴核心更新和绘制
            this.combat_wind_updateStormCores(timeScale);
            this.combat_wind_drawStormCores(this.ctx);
            // 活跃大旋风更新（基于 Tick 的同步伤害与粒子）
            this.combat_wind_updateActiveCyclones(timeScale);
            // 活跃暴风绞杀更新（基于 Tick 的同步切割伤害）
            this.combat_wind_updateActiveStrangles(timeScale);
            // 活跃风道更新（基于 Tick 的同步切割伤害）
            this.combat_wind_updateActiveTunnels(timeScale);
            // [照射词条] 持续照射状态机驱动（每 0.5s 重算一次激光）
            // [修复] 当 _laserFadeOutFrames > 0 时也需要驱动，以处理淡出等待帧计数
            if (this._continuousLaserFiring || this._laserFadeOutFrames > 0) {
                this.combat_continuousLaser_update(timeScale);
            }
            
            // [剑刃风暴词条] 绑定首个子弹的周期性风斩更新
            if (this.combat_bladeStorm_update) {
                this.combat_bladeStorm_update(timeScale);
            }
            // 拖拽瞄准线
            if (this.isDragging && this.projectiles.length === 0 && this.ammoQueue.length > 0 && this.burstQueue.length === 0) {
                const start = new Vec2(this.width / 2, this.height - 80);
                let force = this.lastMousePos.sub(start);
                
                if (force.y < -20) {
                    const maxLen = 800; 
                    const radius = CONFIG.physics.bulletRadius;
                    let dir = force.norm(); 
                    
                    this.ctx.save();
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                    this.ctx.lineWidth = 2;
                    this.ctx.setLineDash([6, 6]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(start.x, start.y);

                    let distToX = Infinity;
                    let distToY = Infinity;
                    if (dir.x > 0) distToX = (this.width - radius - start.x) / dir.x;
                    else if (dir.x < 0) distToX = (radius - start.x) / dir.x;
                    if (dir.y < 0) distToY = (radius - start.y) / dir.y;

                    let hitDist = Math.min(distToX, distToY);
                    if (hitDist < maxLen) {
                        const hitPoint = start.add(dir.mult(hitDist));
                        this.ctx.lineTo(hitPoint.x, hitPoint.y);
                        const remainLen = maxLen - hitDist;
                        let reflectDir = new Vec2(dir.x, dir.y);
                        if (distToX < distToY) reflectDir.x *= -1; 
                        else reflectDir.y *= -1; 
                        const endPoint = hitPoint.add(reflectDir.mult(remainLen));
                        this.ctx.lineTo(endPoint.x, endPoint.y);
                        this.ctx.stroke();
                        this.ctx.beginPath();
                        this.ctx.setLineDash([]);
                        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                        this.ctx.arc(endPoint.x, endPoint.y, 3, 0, Math.PI * 2);
                        this.ctx.fill();
                    } else {
                        const end = start.add(dir.mult(maxLen));
                        this.ctx.lineTo(end.x, end.y);
                        this.ctx.stroke();
                    }
                    this.ctx.restore();

                    this.ctx.save();
                    this.ctx.translate(start.x, start.y);
                    this.ctx.rotate(Math.atan2(force.y, force.x));
                    this.ctx.fillStyle = '#6366f1';
                    this.ctx.beginPath();
                    this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.fillStyle = '#818cf8';
                    this.ctx.fillRect(10, -6, 12, 12); 
                    this.ctx.restore();
                }
            } else if (this.projectiles.length === 0) {
                const start = new Vec2(this.width / 2, this.height - 80);
                this.ctx.save();
                this.ctx.translate(start.x, start.y);
                this.ctx.rotate(-Math.PI / 2); 
                this.ctx.fillStyle = '#475569';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillRect(8, -4, 8, 8);
                this.ctx.restore();
            }

        this.sonSwords.forEach(s => s.update(timeScale, this.enemies, this));
        this.sonSwords.forEach(s => s.draw(this.ctx));
        // 清理不活跃的子剑
        this.sonSwords = this.sonSwords.filter(s => s.active);

        // --- 符文採落物渲染与自动拾取 ---
        if (this.runeLootItems && this.runeLootItems.length > 0) {
            for (let i = this.runeLootItems.length - 1; i >= 0; i--) {
                const loot = this.runeLootItems[i];
                if (!loot || !loot.active) {
                    this.runeLootItems.splice(i, 1);
                    continue;
                }
                // 绘制符文採落物
                loot.draw(this.ctx);
                // 当所有敌人被清除时，自动拾取尚在场地上的符文
                if (activeEnemies === 0 && loot.active) {
                    const runeDef = RUNE_DB.find(r => r.id === loot.runeId);
                    if (runeDef) {
                        // loot.level 由掉落生成时设置（Boss 掉落可能为 2+），默认为 1
                        const runeObj = { id: loot.runeId, level: loot.level || 1 };
                        this.runeInventory.push(runeObj);
                        loot.active = false;
                        const runeName = runeDef.icon ? `${runeDef.icon} ${runeDef.name}` : runeDef.name;
                        showToast(`拾取符文：${runeName}`);
                    }
                }
            }
            // 清理已拾取的採落物
            this.runeLootItems = this.runeLootItems.filter(l => l && l.active);
        }

        this.ctx.restore(); // 结束实体层


        // --- UI Overlays ---
        if (this.gameOver) { 
            // [游戏结束] 已切换到 gameover 阶段，combat 渲染循环直接返回
            return; 
        }

        if (activeEnemies === 0) {
            const hasLeftoverAmmo = this.ammoQueue.length > 0;
            if (hasLeftoverAmmo) {
                const leftoverCount = this.ammoQueue.length;
                const scoreMult = Math.pow(CONFIG.balance.unusedAmmoScoreMult, leftoverCount);
                this.score *= scoreMult;
                this.nextRoundHpMultiplier = CONFIG.balance.nextRoundDifficultyMult;
                showToast(`完美清場! 下輪難度 UP!`);
                audio.playPowerup();
                this.ammoQueue = []; 
                this.ui_updateAmmoUI();
                this.ui_renderRecipeHUD();
                this.data_clearProjectiles();
            }
        }

        const playerTurnFinished = this.ammoQueue.length === 0 && 
                                   this.projectiles.length === 0 && 
                                   this.burstQueue.length === 0 &&
                           !this.isVisualEffectActive;

        if (playerTurnFinished && !this.gameOver) {
            // 试炼场模式下，不自动进入敌人回合
            if (this.phase === 'training') {
                if (this.isEnemyTurn) {
                    if (this.enemyWaveActive) return;
                    if (anyEnemyMoving) {
                        this.enemyTurnTimer = 0; 
                        return;
                    }
                    this.enemyTurnTimer += this.timeScale;
                    if (this.enemyTurnTimer > 60) { 
                        this.isEnemyTurn = false;
                        this.enemyTurnTimer = 0;
                        this.enemies.forEach(e => e.hasActedThisTurn = false);
                        return;
                    }
                }
                return;
            }

            if (!this.isEnemyTurn) {
                this.phase_enemy_startLogic();
            } else {
                if (this.enemyWaveActive) return;
                if (anyEnemyMoving) {
                    this.enemyTurnTimer = 0; 
                    return;
                }
                this.enemyTurnTimer += this.timeScale;
                if (this.enemyTurnTimer > 60) { 
                    if (this.phase === 'training') {
                        // 试炼场不进入下一阶段，只重置敌人回合状态
                        this.isEnemyTurn = false;
                        this.enemyTurnTimer = 0;
                        this.enemies.forEach(e => e.hasActedThisTurn = false);
                    } else {
                        // [敌人动作后领取符文] 先领取待入库符文（飞入背包动画），再进入回合结算
                        // 使用 _runeClaimPending 标志防止重复触发
                        if (!this._runeClaimPending) {
                            this._runeClaimPending = true;
                            this.phase_claimPendingRunes();
                            // 延迟 600ms 让符文飞入动画播放完毕，再进入回合结算
                            setTimeout(() => {
                                this._runeClaimPending = false;
                                this.phase_finalizeRound();
                            }, 600);
                        }
                    }
                    return;
                }
            }
            return;
        }

        if (this.ammoQueue.length === 0 && this.projectiles.length === 0 && this.burstQueue.length === 0 && !this.gameOver) { 
            // 回合结束：先合并相交风暴核心，再衰减能量
            this.combat_wind_mergeStormCores();
            this.combat_wind_decayStormCoresEnergy();
            document.getElementById('combat-message').innerHTML = '<div class="bg-black/50 p-4 rounded-xl backdrop-blur-md border border-blue-500/50 pointer-events-none"><span class="text-blue-300 font-bold text-xl block mb-2">彈藥耗盡</span><span class="text-sm text-slate-300">點擊收集新彈药</span></div>'; 
        } else { 
            if (!this.gameOver) document.getElementById('combat-message').innerHTML = ''; 
        }
        // --- 修改开始：调整层级，先画轨道，再画炮台 ---
        this.ctx.save();
        // 应用与实体层相同的视差偏移
        this.ctx.translate(entityShiftX, entityShiftY);

        const startPos = new Vec2(this.width / 2, this.height - 80);
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.8)'; // 深色半透明底 (Slate-900 80%)
        this.ctx.beginPath();
        this.ctx.arc(startPos.x, startPos.y, 22, 0, Math.PI * 2); // 半径比子弹稍大
        this.ctx.fill();
        let nextAmmo = this.ammoQueue.length > 0 ? this.ammoQueue[0] : null;

        if (nextAmmo) {
            const params = Projectile.calculateVisualParams(nextAmmo, false);
            let previewRotation =  -Math.PI / 2;
            let deformation = {x: 1, y: 1};
            
            if (this.isDragging) {
                const force = this.dragStart.sub(this.dragCurrent);
                if (force.mag() > 10) {
                    previewRotation = Math.atan2(force.y, force.x) ;
                    deformation = {x: 1.15, y: 0.85}; 
                }
            }
            if (this.isChargingShot) {
                const shake = Math.random() * 2; // 吸收时的剧烈抖动
                startPos.x += (Math.random()-0.5) * shake;
                startPos.y += (Math.random()-0.5) * shake;
                // 核心随着能量吸收变大变亮
                const absorbScale = 1.0 + this.chargeProgress * 0.3;
                deformation.x *= absorbScale;
                deformation.y *= absorbScale;
            }

            //先绘制轨道 (Orbitals) -> 这样它就在炮台下面
            this.render_combat_launcherOrbitals(this.ctx, startPos.x, startPos.y, nextAmmo);

            //后绘制炮台核心 (Visuals) -> 这样它就在上面
            Projectile.drawVisuals(this.ctx, startPos.x, startPos.y, params.radius, nextAmmo, previewRotation, params.intensity, deformation);

        } else {
            // 空仓状态
            this.ctx.fillStyle = '#1e293b';
            this.ctx.beginPath();
            this.ctx.arc(startPos.x, startPos.y, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#475569';
            this.ctx.stroke();
        }
        this.ctx.restore();

        // --- [新增] 手机偏移提示强化：绘制边缘泛光 ---
        this.drawTiltVignette(this.ctx, this.boardTilt.current);
        // [移除] 删除底部倾斜指示条调用，设计上不够简洁且在战斗阶段会被结算 UI 遮挡
        // this.drawTiltIndicator(this.ctx, this.boardTilt.current);
        
    },

/**
     * @method attemptCompleteGatheringTurn
     * @description 尝试完成收集回合。修复了最后一个能量球导致无法结算的BUG。
     */
    phase_gathering_attemptComplete() {
        if (this.isWheelSpinning) return;
        // [修复] 检查底部侧边转盘（triangleSideWheels）是否还在旋转
        // Bug 根因：弹珠落底后立即触发结算，但底部转盘的回调（翻倍逻辑）尚未执行
        // 导致：1) 传给战斗子弹的属性是翻倍前的值；2) 最后一个转盘未停就进入战斗阶段
        if (this.triangleSideWheels && this.triangleSideWheels.some(w => w.spinning)) return;
        // 解决方法：只计算 active 为 true 的能量球。
        const activeOrbsCount = this.energyOrbs.filter(orb => orb.active).length;

        // 1. 基础检查：如果还有东西在动，绝对不能结算
        if (this.dropBalls.length > 0 || activeOrbsCount > 0 || this.currentSession.activeBalls > 0) {
            return;
        }

        // 2. 状态检查：防止重复结算
        // 如果当前 session 已经被标记为“已结算”或不存在，则直接返回
        if (!this.currentSession || this.currentSession.isFinished) return;

        // 3. 执行结算
        this.currentSession.isFinished = true; // 立即上锁

        const marbleDef = this.marbleQueue[this.activeMarbleIndex];
        // 兜底检查：如果此时 marbleDef 不存在（防止数组越界），直接停止
        if (!marbleDef) {
            this.currentSession = null;
            return;
        }
        marbleDef.collected = [...this.currentSession.collected];
        // --- [新增] 觸發倍率轉移特效 ---
        // 計算當前倍率 (1 + 額外)
        const totalMulticast = 1 + this.currentSession.multicast;
        // 只有倍率大於 1 時才播放特效，或者你想每次都播也可以
        if (totalMulticast > 0) {
            this.combat_playMulticastTransferEffect(totalMulticast);
        }
        const recipe = this.calc_compileCollectionToRecipe(marbleDef, this.currentSession.collected, this.currentSession.multicast > 0);
        recipe.finalHits = this.currentSession.totalHits;
        recipe.multicast = this.currentSession.multicast;
        this.ammoQueue.push(recipe);
        
        marbleDef.multicast = this.currentSession.multicast;
        marbleDef.finalHits = this.currentSession.totalHits;

        this.activeMarbleIndex++;
        this.ui_updateGatheringQueueUI();
        
        // [新增] 弹珠结算时，重置所有钉子的冷却
        this.pegs.forEach(p => p.resetCooldown());
        
        // 4. 状态流转
        if (this.activeMarbleIndex >= this.marbleQueue.length) {
            // 所有弹珠都扔完了，进入战斗
            setTimeout(() => this.phase_startCombatPhase(), 500);
        } else {
             // 准备下一回合，清空当前 session，允许玩家再次点击
             this.currentSession = null; 
        }
    },
    
// Gathering Phase Update
    /**
     * @method updateGathering
     * @description 收集階段的遊戲邏輯更新。
     * @param {number} [timeScale=1] - **重要參數** 時間縮放因子。
     */
    phase_gathering_update(timeScale = 1) {
        // [修复] 确保 Canvas 状态干净
        this.ctx.save();
        this.ctx.globalAlpha = 1.0;
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.shadowBlur = 0;
        this.ctx.shadowColor = 'transparent';

        // [修复] 移除 DOM 依赖的检查。如果遗物界面打开，phase 应该已经被切换到 'relic'
        // 并且主循环 (sys_loop) 会根据 phase 决定是否调用此函数。
        // 额外的 DOM 检查可能导致状态不同步。

        const tilt = this.boardTilt.current;


        const container = document.getElementById('game-container');
        if (container) {
            // 1. 设置透视距离，值越小 3D 感越强
            container.style.perspective = "1200px"; 
            
            // 2. 根据倾斜值旋转容器
            // rotateX 对应上下倾斜 (tilt.y)，rotateY 对应左右倾斜 (tilt.x)
            // 乘以 5 或 8 增加旋转角度的体感
            const rotateX = tilt.y * -8; 
            const rotateY = tilt.x * 8;
            const translateZ = -20; // 稍微向后退一点，防止边缘穿模

            container.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px)`;
            container.style.transition = "transform 0.1s ease-out"; // 平滑动画
        } else {
            console.warn("[DEBUG] phase_gathering_update: 未找到 game-container");
        }
        // 模拟板子边缘受光不均
        const grad = this.ctx.createRadialGradient(
            this.width / 2 + (tilt.x * 100), // 光心随倾斜移动
            this.height / 2 + (tilt.y * 100),
            this.width * 0.2,
            this.width / 2,
            this.height / 2,
            this.width * 0.8
        );
        grad.addColorStop(0, 'rgba(30, 41, 59, 0)');
        grad.addColorStop(1, `rgba(2, 6, 23, ${0.3 + Math.abs(tilt.x) * 0.2})`); // 倾斜越大边缘越暗

        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // [DEBUG] 确认渲染流程执行到此处

        // --- [新增] 绘制转盘 (在阴影和钉子之前) ---
        if (this.fortuneWheel.active) {
            this.fortuneWheel.update(timeScale);
            this.fortuneWheel.draw(this.ctx);
        }

        // --- [triangle 布局专属] 绘制底部侧边倍率转盘 ---
        if (this.triangleSideWheels && this.triangleSideWheels.length > 0) {
            for (const wheel of this.triangleSideWheels) {
                wheel.update(timeScale);
                wheel.draw(this.ctx);
            }
        }
        // 2.  计算动态光源位置
        // 假设光源在屏幕上方很远的地方。当板子向左倾斜 (tilt.x < 0) 时，
        // 阴影应该向左移动，或者说光源看起来像是在右边。
        // 这里的逻辑是：板子动，光不动 -> 相对运动
        const lightSourcePos = new Vec2(
            this.width / 2 - (tilt.x * 300), // X轴偏移：倾斜越大，光源相对位移越大
            -200 - (tilt.y * 100)            // Y轴偏移
        );
        const LIGHT_RADIUS = 150;
        const LIGHT_RADIUS_SQ = LIGHT_RADIUS * LIGHT_RADIUS;// 预计算平方，避免开根号
        // --- 绘制阴影 (传入动态光源) ---
        // DropBalls 发出的光
        this.dropBalls.forEach(ball => {
            if (!ball.active) return;
            this.pegs.forEach(p => {
                 // 这里是原有的小球光照阴影
                p.drawShadow(this.ctx, ball.pos, LIGHT_RADIUS);
            });
        });

        //  全局环境光阴影 (基于倾斜)
        // 让所有钉子都有一个基于板子倾斜的微弱基础阴影，增加立体感
        this.pegs.forEach(p => {
            // 我们利用 drawShadow 的逻辑，制造一个伪造的“太阳”
            p.drawShadow(this.ctx, lightSourcePos, 9999); // 半径很大，覆盖全屏
        });
        const lightSources = [...this.dropBalls];

        // --- 优化开始：只对范围内的钉子画阴影 ---
        lightSources.forEach(ball => {
            if (!ball.active) return;
            
            // 遍历所有钉子
            for (let i = 0; i < this.pegs.length; i++) {
                const p = this.pegs[i];
                // 简单的 AABB 预判或距离平方判断
                const dx = ball.pos.x - p.pos.x;
                const dy = ball.pos.y - p.pos.y;
                
                // 只有距离小于 LIGHT_RADIUS 时才绘制阴影
                // Math.abs 检查比乘法快，先做粗略筛选
                if (Math.abs(dx) < LIGHT_RADIUS && Math.abs(dy) < LIGHT_RADIUS) {
                    if ((dx*dx + dy*dy) < LIGHT_RADIUS_SQ) {
                        p.drawShadow(this.ctx, ball.pos, LIGHT_RADIUS);
                        p.calculateLight(ball.pos, LIGHT_RADIUS); // 光照计算也放这里
                    }
                }
            }
        });
        // 繪製釘子
        // [修复] 增加保底半径，防止 this.width 为 0 时钉子消失
        const pegRadius = Math.max(4, Math.min(8, (this.width || 400) / 60));
        
        // [防御性检查] 如果钉子数组为空，尝试自动恢复
        if (this.pegs.length === 0) {
            console.warn("[DEBUG] 收集阶段钉子数组为空，尝试自动恢复...");
            this.phase_gathering_initPachinko();
        }

        this.pegs.forEach((p, idx) => { 
            p.update(); // 更新冷却和动画
            p.draw(this.ctx, pegRadius); 
            p.resetLight();
            
            // 调试日志：检查是否有槽位叠加在当前钉子上
            const hasSlot = this.specialSlots.some(s => s.pegIndex === idx);
            if (hasSlot && Math.random() < 0.01) {
                console.log(`[DEBUG] Rendering peg ${idx} with overlaid special slot at (${p.pos.x.toFixed(1)}, ${p.pos.y.toFixed(1)})`);
            }
        });

        
        lightSources.forEach(ball => {
            // 优化：只检查垂直距离接近的行，或者直接遍历所有 (钉子数量不多，直接遍历性能没问题)
            this.pegs.forEach(p => {
                // 简单的性能优化：如果Y轴距离太远就不用算平方根了
                if (Math.abs(ball.pos.y - p.pos.y) < LIGHT_RADIUS) {
                    p.calculateLight(ball.pos, LIGHT_RADIUS);
                }
            });
        });
        this.specialSlots = this.specialSlots.filter(s => !s.hit);
        // 繪製特殊槽位
        this.specialSlots.forEach(s => s.draw(this.ctx));

        // --- [diamond 布局专属] 绘制裂变回响虚影钉子 ---
        if (this.ghostPegs && this.ghostPegs.length > 0) {
            for (let i = this.ghostPegs.length - 1; i >= 0; i--) {
                const gp = this.ghostPegs[i];
                gp.update(this.timeScale || 1);
                if (gp.active) {
                    gp.draw(this.ctx);
                } else {
                    this.ghostPegs.splice(i, 1);
                }
            }
        }

        // [修复] 结束收集阶段渲染，恢复 Canvas 状态
        this.ctx.restore();

        // --- 更新和绘制光柱 ---
        for (let i = this.collectionBeams.length - 1; i >= 0; i--) {
            const beam = this.collectionBeams[i];
            beam.update(timeScale);
            beam.draw(this.ctx);
            if (beam.life <= 0) this.collectionBeams.splice(i, 1);
        }
        // 更新和繪製下落的彈珠
        for (let i = this.dropBalls.length - 1; i >= 0; i--) {
            const ball = this.dropBalls[i];
            // **重要參數** result: 'finished' (落出屏幕), {type: 'collected', ...}, {type: 'slot', ...}, {action: 'split', ...}
            const result = ball.update(this.pegs, this.specialSlots, this.width, this.height, this.timeScale, tilt);
                
            //  绘制时也可以传入 tilt 做球体高光偏移 (可选)
            ball.draw(this.ctx, tilt);
            
            // --- [新增] 绘制球体牵徕线（仅在研磨阶段绘制）---
            if (ball.active && Math.abs(tilt.x) > 0.05) {
                const tiltStrength = Math.abs(tilt.x); // 0 ~ 1
                const lineAlpha = tiltStrength * 0.6;  // 透明度随倾斜增强
                const lineWidth = 1 + tiltStrength * 2; // 线宽随倾斜增强
                const dashLen = 6;
                const gapLen = 8;
                
                this.ctx.save();
                this.ctx.globalAlpha = lineAlpha;
                this.ctx.lineWidth = lineWidth;
                this.ctx.setLineDash([dashLen, gapLen]);
                this.ctx.lineDashOffset = -(Date.now() / 80) % (dashLen + gapLen); // 动态流动效果
                
                let edgeX, gradStart, gradEnd;
                if (tilt.x < 0) {
                    // 向左倾斜：牵徕线连到左边缘
                    edgeX = 0;
                    gradStart = this.ctx.createLinearGradient(ball.pos.x, ball.pos.y, edgeX, ball.pos.y);
                } else {
                    // 向右倾斜：牵徕线连到右边缘
                    edgeX = this.width;
                    gradStart = this.ctx.createLinearGradient(ball.pos.x, ball.pos.y, edgeX, ball.pos.y);
                }
                
                // 渐变颜色：球体中心为蓝紫色，边缘渐变透明
                gradStart.addColorStop(0, `rgba(139, 92, 246, ${lineAlpha})`);
                gradStart.addColorStop(0.5, `rgba(99, 102, 241, ${lineAlpha * 0.6})`);
                gradStart.addColorStop(1, 'rgba(99, 102, 241, 0)');
                
                this.ctx.strokeStyle = gradStart;
                this.ctx.shadowBlur = 4 + tiltStrength * 6;
                this.ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
                
                this.ctx.beginPath();
                this.ctx.moveTo(ball.pos.x, ball.pos.y);
                this.ctx.lineTo(edgeX, ball.pos.y);
                this.ctx.stroke();
                
                this.ctx.restore();
            }
            
            if (result) {
                // 處理彈珠落出屏幕
                if (result === 'finished') {
                    // 1. 生成光柱 (在球掉落的X轴位置，屏幕底部升起)
                    this.collectionBeams.push(new CollectionBeam(ball.pos.x, this.height));
                    
                    // 2. 触发 UI 卡片高亮
                    // 获取当前正在进行的配方卡片 DOM 元素
                    // 注意：nth-child 是从 1 开始的，activeMarbleIndex 是从 0 开始
                    const activeCardIdx = this.activeMarbleIndex + 1;
                    const activeCard = document.querySelector(`#gathering-hud-mount .recipe-card:nth-child(${activeCardIdx})`);
                    
                    if (activeCard) {
                        // 先移除可能存在的类（以防万一），强制重绘，再添加
                        activeCard.classList.remove('locked-anim');
                        void activeCard.offsetWidth; // 触发 Reflow
                        activeCard.classList.add('locked-anim');
                    }

                    // 3. 播放一个确认音效 (比如 reload 或 magic)
                    audio.playCollect(); // 或者 audio.playTone(800, 'sine', 0.2)
                    // 弹珠落出屏幕
                    this.dropBalls.splice(i, 1);
                    this.currentSession.activeBalls--;
                    
                    // --- ：不再直接結算，而是嘗試結算 ---
                    // 處理“能量球先落地，彈珠後死”的情況
                    this.phase_gathering_attemptComplete();

                } else if (result.type === 'collected') {
                    // 彈珠收集到材料
                    this.currentSession.collected.push(result.material);
                    // 这样 UI (renderRecipeCard) 才能读取到变化
                    if (this.marbleQueue[this.activeMarbleIndex]) {
                        this.marbleQueue[this.activeMarbleIndex].collected.push(result.material);
                    }
                    this.spawn_createHitFeedback(ball.pos.x, ball.pos.y, ball.vel, result.material); // 這裡也許要傳入屬性類型作為顏色依據
                    audio.playCollect();
                    this.ui_renderRecipeHUD();
                    
                } else if (result.type === 'slot') {
                    // 彈珠擊中特殊槽位
                    if (result.slotType === 'recall') {
                        // 回溯槽位：將彈珠傳送回頂部
                        ball.pos.y = 50;
                        ball.vel = new Vec2(0, 2);
                        showToast("回溯!");
                    } else if (result.slotType === 'multicast') {
                        // 多重發射槽位：增加多重發射次數
                        if (!this.currentSession.multicastAdded.includes(i)) {
                            this.currentSession.multicast++;
                            this.currentSession.multicastAdded.push(i);
                            showToast("+連射!");
                        }
                    } else if (result.slotType === 'split' && ball.canTriggerSplitSlot) {
                        // 分裂槽位：分裂彈珠
                        ball.canTriggerSplitSlot = false;
                        const newBall = new DropBall(ball.pos.x, ball.pos.y, ball.def, this.currentSession);
                        newBall.vel = new Vec2(-ball.vel.x, ball.vel.y);
                        newBall.canTriggerSplitSlot = false;
                        this.dropBalls.push(newBall);
                        this.currentSession.activeBalls++;
                        showToast("分裂!");
                    } else if (result.slotType === 'relic') {
                        // 調用遺物選擇
                        this.ui_showRelicSelection(); 
                        
                        // 將彈珠移除
                        this.dropBalls.splice(i, 1);
                        this.currentSession.activeBalls--;
                    }
                } else if (result.action === 'split') {
                    // 處理 DropBall 內部觸發的分裂
                    const newBall1 = new DropBall(result.pos.x - 10, result.pos.y, result.def, this.currentSession);
                    const newBall2 = new DropBall(result.pos.x + 10, result.pos.y, result.def, this.currentSession);
                    newBall1.vel = new Vec2(-Math.abs(result.vel.x) - 2, result.vel.y);
                    newBall2.vel = new Vec2(Math.abs(result.vel.x) + 2, result.vel.y);
                    newBall1.canTriggerSplitSlot = false;
                    newBall2.canTriggerSplitSlot = false;
                    this.dropBalls.push(newBall1, newBall2);
                    this.currentSession.activeBalls += 1; 
                    this.dropBalls.splice(i, 1);
                    showToast("分裂!");
                } else if (result.action === 'mirror_clone') {
                    // [镜像裂分] 处理镜像轴线钉子触发的弹珠复制
                    // 复制弹珠：仅复制当前速度，不复制属性
                    // 分身弹珠的后续收集属性归入原弹珠（共享同一 session 实现）
                    const originalBall = result.originalBall;
                    // 创建分身弹珠：使用原弹珠的 def（属性定义）和 session（共享收集属性）
                    const cloneBall = new DropBall(result.mirrorX, result.pos.y, originalBall.def, this.currentSession);
                    // 仅复制当前速度（水平分量取反，垂直分量相同）
                    cloneBall.vel = new Vec2(result.vel.x, result.vel.y);
                    // 分身弹珠不能再次触发镜像裂分，防止连锁增幅
                    cloneBall._mirrorAxisCooldown = 60; // 分身弹珠有更长冷却
                    cloneBall.canTriggerSplitSlot = false;
                    cloneBall.isMirrorClone = true; // 标记为镜像分身
                    this.dropBalls.push(cloneBall);
                    this.currentSession.activeBalls++;
                    this.ui_renderRecipeHUD();

                } else if (result.action === 'rainbow_split') {
                    // 處理彩虹彈珠分裂
                    const colors = ['bounce', 'pierce', 'scatter'];
                    if (this.marbleQueue[this.activeMarbleIndex]) {
                        colors.forEach(c => {
                            this.marbleQueue[this.activeMarbleIndex].collected.push(c);
                        });
                    }
                    colors.forEach((c, idx) => {
                        const shardDef = new MarbleDefinition(c);
                        const shard = new DropBall(result.pos.x + (idx - 1) * 20, result.pos.y, shardDef, this.currentSession);
                        shard.vel = new Vec2((idx - 1) * 3, result.vel.y);
                        shard.isRainbowShard = true;
                        this.dropBalls.push(shard);

                        // --- [新增修复]：分裂时直接将对应的材料加入收集列表 ---
                        this.currentSession.collected.push(c);
                    });
                    
                    this.currentSession.activeBalls += 2; // -1 (本体) + 3 (碎片) = +2
                    this.dropBalls.splice(i, 1);
                    
                    // --- [新增修复]：刷新 UI 以显示新收集到的材料 ---
                    this.ui_renderRecipeHUD();
                    
                    showToast("彩虹分裂!");
                }
            }
        } 
        
        // --- 更新和繪製能量球 ---
        for (let i = this.energyOrbs.length - 1; i >= 0; i--) {
            const orb = this.energyOrbs[i];
            orb.update(timeScale);
            orb.draw(this.ctx);
            if (!orb.active) this.energyOrbs.splice(i, 1);
        }
        // 繪製粒子
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(this.timeScale);
            p.draw(this.ctx);
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        // 更新和繪製 Shockwaves
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            let s = this.shockwaves[i];
            if (s) {
                s.update(timeScale);
                s.draw(this.ctx);
                if (s.alpha <= 0) this.shockwaves.splice(i, 1);
            }
        }
        // [注意] 研磨阶段的 container 3D 变换已在函数头部设置，此处不再重复设置（避免覆盖主要的 3D 旋转特效）
        // 之前的代码已在头部设置了正确的 rotateX/rotateY 特效

        // --- [新增] 手机偏移提示强化：绘制边缘泛光 ---
        this.drawTiltVignette(this.ctx, this.boardTilt.current);

        // --- [概率分析] 绘制落点热力图 ---
        // 只在没有弹珠正在运动时显示，避免干扰视觉
        if (this.dropBalls.length === 0 && this._heatmapData) {
            this._drawDropHeatmap(this.ctx);
        }

    },

    /**
     * [概率分析] 更新落点分布缓存
     * 在弹珠发射时调用，计算当前布局的落点概率分布
     *
     * @param {number} entryX - 弹珠入射 X 坐标
     */
    _updateDropDistribution(entryX) {
        const rows = this.currentRows || CONFIG.gameplay.rows;
        const cols = CONFIG.gameplay.cols || 10;
        const layout = this.currentLayout || 'default';
        const tiltBias = this.boardTilt ? this.boardTilt.current.x : 0;

        // 计算基础分布（基于当前布局和倾斜）
        const baseDistrib = calcDropDistribution(rows, cols, layout, tiltBias);

        // 根据入射位置修正分布
        this._dropDistribution = adjustDistributionForEntry(entryX, this.width, baseDistrib);

        // 生成热力图数据
        const boardBottomY = this.boardBottomY || (this.height * 0.7);
        this._heatmapData = generateHeatmapData(
            this._dropDistribution,
            this.width,
            boardBottomY,
            this.height,
            layout
        );
    },

    /**
     * [概率分析] 绘制落点热力图
     * 在钉盘底部显示概率分布可视化
     *
     * @param {CanvasRenderingContext2D} ctx
     */
    _drawDropHeatmap(ctx) {
        if (!this._heatmapData || this._heatmapData.length === 0) return;

        const layout = this.currentLayout || 'default';
        const hints = getAllLayoutHints();
        const hint = hints[layout] || hints.default;

        ctx.save();

        // 绘制分布柱状图
        for (const bar of this._heatmapData) {
            if (bar.height < 1) continue;

            // 渐变颜色：从底部向上渐变
            const grad = ctx.createLinearGradient(bar.x, bar.y + bar.height, bar.x, bar.y);
            grad.addColorStop(0, `${hint.color}00`);  // 底部透明
            grad.addColorStop(0.4, `${hint.color}${Math.round(bar.alpha * 0.6 * 255).toString(16).padStart(2, '0')}`);
            grad.addColorStop(1, `${hint.color}${Math.round(bar.alpha * 255).toString(16).padStart(2, '0')}`);

            ctx.fillStyle = grad;
            ctx.fillRect(bar.x, bar.y, bar.width, bar.height);

            // 高概率槽位添加光晕效果
            if (bar.alpha > 0.5) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = hint.color;
                ctx.fillStyle = `${hint.color}${Math.round(bar.alpha * 0.3 * 255).toString(16).padStart(2, '0')}`;
                ctx.fillRect(bar.x, bar.y, bar.width, 2);
                ctx.shadowBlur = 0;
            }
        }

        // 绘制布局分布特征标签
        const boardBottomY = this.boardBottomY || (this.height * 0.7);
        const labelY = boardBottomY + 8;
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = `${hint.color}99`;
        ctx.fillText(hint.hint, this.width / 2, labelY);

        ctx.restore();
    },
};
