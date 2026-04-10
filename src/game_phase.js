import { 
    META_SHOP_CONFIG, ATTRIBUTES_FOR_SHOP, setDeepValue, CONFIG, RELIC_DB, SKILL_DB 
} from './config.js';
import { 
    Vec2, MarbleDefinition, SpecialSlot, FortuneWheel, Peg, DropBall, Enemy, SwordQi, 
    SlashAnim, SonSword, Projectile, CloneSpore, Particle, SlashEffect, CollectionBeam, 
    Shockwave, LaserBeam, FloatingText, EnergyOrb, LightningBolt, FireWave, showToast, 
    rotateTowards, adjustColorBrightness, lerpColor, lerp, hexToRgba 
} from './entities.js';
import { UIManager, TrainingGround, TruthBook } from './systems.js';
import { audio } from './audio.js';
import { eventBus } from './event_bus.js';

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
        eventBus.emit('wave:advance', { round: this.round });
    },

/**
     * @method switchPhase
     * @description 切换游戏阶段。
     * @param {string} newPhase - **重要参数** 新阶段名称 ('selection', 'gathering', 'combat', 'gameover')。
     */
    phase_switchPhase(newPhase) {
        const oldPhase = this.phase;
        this.phase = newPhase;
        
        // 事件总线广播阶段切换
        eventBus.emit('phase:change', { from: oldPhase, to: newPhase });
        
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
        const cols = CONFIG.gameplay.cols || 10;
        // [修复] 获取间距配置
        const spacingX = CONFIG.gameplay.spacingX || 45;
        const spacingY = CONFIG.gameplay.spacingY || 45;
        
        // [监控] 打印初始化关键参数

        // [修复] 修正 width 引用
        // 确保 this.width 在初始化时已正确设置，否则使用默认值 400
        const canvasWidth = (this.width && this.width > 0) ? this.width : 400; 
        const canvasHeight = (this.height && this.height > 0) ? this.height : 600;
        
        const offsetX = (canvasWidth - (cols - 1) * spacingX) / 2;
        
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
            const isOddRow = r % 2 !== 0;
            const cols = isOddRow ? CONFIG.gameplay.cols - 1 : CONFIG.gameplay.cols;
            const rowOffsetX = isOddRow ? spacingX / 2 : 0;

            for (let c = 0; c < cols; c++) {
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
                // [继承逻辑] 如果继承，保留当前的冷却状态
                if (shouldInherit && previousPegs[pegIndex]) {
                     p.cooldownTimer = previousPegs[pegIndex].cooldownTimer;
                }
                
                this.pegs.push(p);
                pegIndex++;
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
            console.log(CONFIG.gameplay.initWindPegs,CONFIG.gameplay.initSwordPegs)
            replaceWithSpecial(CONFIG.gameplay.initWindPegs, 'wind');
            replaceWithSpecial(CONFIG.gameplay.initSwordPegs, 'flying_sword');
        }

        this.boardBottomY = maxPegY;
        const pinkCount = this.pinkPegCount;
        for (let i = 0; i < pinkCount; i++) {
            if (this.pegs.length > 0) {
                const idx = Math.floor(Math.random() * this.pegs.length);
                this.pegs[idx].type = 'pink';
            }
        }

        console.log(`[DEBUG] Starting special slot creation: unlockedSlots=${JSON.stringify(this.unlockedSlots)}, slotCount=${this.slotCount}`);
        if (this.unlockedSlots.length > 0 && this.slotCount > 0) {
            const slotTypes = this.unlockedSlots;
            
            // [重构] 不再使用随机坐标匹配，而是直接从合法候选钉子池中抽取
            // 1. 筛选出所有合法的候选钉子索引 (非粉色且未被占用)
            let validPegIndices = this.pegs
                .map((p, index) => ({ type: p.type, index }))
                .filter(item => item.type !== 'pink')
                .map(item => item.index);

            console.log(`[DEBUG] Found ${validPegIndices.length} valid candidate pegs for special slots`);

            let createdCount = 0;
            while (createdCount < this.slotCount && validPegIndices.length > 0) {
                // 2. 从候选池中随机抽取一个索引
                const randIdxInPool = Math.floor(Math.random() * validPegIndices.length);
                const pegIdx = validPegIndices.splice(randIdxInPool, 1)[0];
                
                const type = slotTypes[Math.floor(Math.random() * slotTypes.length)];
                const peg = this.pegs[pegIdx];
                
                // 3. 实例化 SpecialSlot
                const slot = new SpecialSlot(peg.pos.x, peg.pos.y, spacingX * 0.8, type);
                slot.pegIndex = pegIdx;
                this.specialSlots.push(slot);
                
                createdCount++;
                console.log(`[DEBUG] Created special slot: type=${type}, pegIdx=${pegIdx}, pos=(${peg.pos.x}, ${peg.pos.y})`);
            }
            
            console.log(`[DEBUG] Finished special slot creation: final count=${this.specialSlots.length}, target=${this.slotCount}`);
        } else {
            console.log(`[DEBUG] Skipping special slot creation: unlockedSlots.length=${this.unlockedSlots.length}, slotCount=${this.slotCount}`);
        }
        this.ui_updateGatheringQueueUI();
        this.ui_renderRecipeHUD();
    },

phase_gathering_getRandomPegType() { 
    // [BUGFIX #1] 恢复完整 pegTypes 数组，根据玩家已解锁属性动态过滤
    // 原 Bug: pegTypes 被硬编码为 ['bounce']，导致所有元素属性钉子无法生成
    const allPegTypes = ['bounce', 'pierce', 'scatter', 'damage', 'cryo', 'pyro', 'lightning', 'laser', 'wind'];
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
        
        // 初始化当前回合伤害记录
        this.shotDamageHistory = [];
        this.currentViewingRound = 0; 
        
        if (this.ui) {
            this.ui.updateSkillPoints(this.skillPoints);
            this.ui.updateSkillBar(this.skillPoints);
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

        // 处理 gameOver 状态的点击返回主界面
        if (this.gameOver) {
            this.phase_switchPhase('meta');
            // 注意：这里不再调用 sys_resetGame，因为重置逻辑应该在点击“开始炼成”时触发
            // 这样可以确保返回的是首页，而不是直接进入下一局
            return;
        }

        if (this.phase === 'combat') {
             const hitEnemy = this.input_checkEnemyHover(pos);
             if (hitEnemy) return; 
             if (this.ui.isOpen) {
                 this.ui.closeDrawer();
                 return;
             }
             if (this.ammoQueue.length > 0 && this.projectiles.length === 0 && this.burstQueue.length === 0) {
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
                this.dropBalls.push(new DropBall(pos.x, 30, marbleDef, this.currentSession));
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

        // --- 1. 溫度結算邏輯 ---
        if (e.temp < 0) {
            // 1. 深度冻结 (-100以下)：视觉上有冰块，逻辑上必须 100% 冻结
             // 2. 浅度冻结 (-50 ~ -99)：视觉上无冰块，逻辑上概率冻结
             
             let shouldFreeze = false;

             if (e.temp <= -100) {
                 shouldFreeze = true; // 强制冻结
             } else if (e.temp <= -50) {
                 // 概率计算：从 -50 的 0% 到 -100 的 100% 线性增加
                 const chance = (Math.abs(e.temp) - 50) / 50; 
                 if (Math.random() < chance) shouldFreeze = true;
             }

             if (shouldFreeze) { 
                 e.isFrozenCurrentTurn = true;
                 this.spawn_createExplosion(e.pos.x, e.pos.y, '#06b6d4');
                 audio.playEffect('freeze');
             } else {
                 e.isFrozenCurrentTurn = false;
             }
             
             // 温度衰减 (保持不变)
             e.temp = Math.ceil(e.temp / 2);
        }

        if (e.temp > 0) {
            if (e.temp < 100) {
                 e.temp = Math.max(0, e.temp - 5);
            } else {
                const dot = 5 + (e.temp - 100);
                e.takeDamage(dot); // <--- 敵人可能在這裡死亡 (active = false)
                
                // 记录火焰持续伤害
                this.combat_recordDamage(dot, 'pyro', 'main');
                
                // 觸發燃燒特效
                e.playBurnTickEffect(this, Math.floor(dot));
                
                const decay = Math.floor(e.temp / 20);
                e.temp = Math.max(0, e.temp - decay);
            }
        }

        // --- 2. 行動邏輯 ---
        // 只有活著的敵人才移動
        if (e.active && e.isFrozenCurrentTurn == false) {
            e.startTurnAction(this);
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

        // --- 以下保持原有的回合结算逻辑 ---
        
        // 生成新敌人
        const rowCountCurrent = uniqueRows.size;
        let spawnCount = 1;
        if (rowCountCurrent < 4) spawnCount = 3; // 稍微激进一点的生成
        this.spawn_spawnEnemyRow(spawnCount);

        // 重置倍率
        if (this.nextRoundHpMultiplier > 1) {
            showToast("強敵來襲！HP x" + this.nextRoundHpMultiplier);
            this.nextRoundHpMultiplier = 1;
        }

        // [修复] 回合切换时清空蝴蝶法阵和风刃，防止残留
        if (this.butterflyCircles) this.butterflyCircles = [];
        if (this.butterflyBlades) this.butterflyBlades = [];
        
        this.round++;
        this.prevRoundDamage = this.roundDamage;
        this.roundDamage = 0;
        document.getElementById("round-num").innerText = this.round;
        showToast(`Round ${this.round}`);

        // 检查失败
        if (this.input_checkDefeat()) {
            this.gameOver = true;
            return;
        }

        document.getElementById('combat-message').innerHTML = '';
        this.phase_gathering_initPachinko(true);

        this.isEnemyTurn = false;
        // 遗物事件检查
        if (this.round % CONFIG.gameplay.relicRoundInterval == 0) {
            showToast("✨ 命運的饋贈 ✨");
            this.phase = 'relic_event';
            setTimeout(() => { this.ui_showRelicSelection(); }, 500);
            return;
        }
        
        
        if (this.ammoQueue.length === 0) {
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
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.defeatLineY);
        this.ctx.lineTo(this.width, this.defeatLineY);
        this.ctx.stroke();
        this.ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        this.ctx.font = 'bold 10px monospace';
        this.ctx.fillText("⚠️ DEFENSE LINE", 10, this.defeatLineY - 6);
        const dangerGrad = this.ctx.createLinearGradient(0, this.defeatLineY, 0, this.height);
        dangerGrad.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
        dangerGrad.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
        this.ctx.fillStyle = dangerGrad;
        this.ctx.fillRect(0, this.defeatLineY, this.width, this.height - this.defeatLineY);
        this.ctx.restore();


        // ==========================================
        //  LAYER 1: 背景层 (网格 & 扫描波)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(bgShiftX, bgShiftY); 

            // A. 绘制背景网格
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(71, 85, 105, 0.15)';
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            const gridOffsetX = bgShiftX * 1.5;
            const gridOffsetY = bgShiftY * 1.5;
            for (let x = -50; x < this.width + 50; x += 40) {
                this.ctx.moveTo(x, -50); this.ctx.lineTo(x, this.height + 50);
            }
            for (let y = -50; y < this.height + 50; y += 40) {
                this.ctx.moveTo(-50, y); this.ctx.lineTo(this.width + 50, y);
            }
            this.ctx.stroke();
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
                this.ctx.lineWidth = 3;
                this.ctx.shadowColor = '#fef08a'; 
                this.ctx.shadowBlur = 15;
                for (let x = 0; x <= this.width; x += 10) {
                    const offset = Math.sin(x * 0.1 + time) * 2 + (Math.random() - 0.5) * 6;
                    const y = this.enemyWaveY + offset;
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
        this.ctx.restore(); 


        // ==========================================
        //  LAYER 2: 实体层 (墙壁 / 敌人 / 子弹)
        // ==========================================
        this.ctx.save();
        this.ctx.translate(entityShiftX, entityShiftY); 

            // --- [新增]：绘制可视化的边界墙壁 ---
            this.ctx.save();
            // 左墙 (半透明渐变)
            const wallGradLeft = this.ctx.createLinearGradient(0, 0, 20, 0);
            wallGradLeft.addColorStop(0, 'rgba(148, 163, 184, 0.2)');
            wallGradLeft.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradLeft;
            this.ctx.fillRect(0, -100, 20, this.height + 100);
            
            // 右墙 (半透明渐变)
            const wallGradRight = this.ctx.createLinearGradient(this.width, 0, this.width - 20, 0);
            wallGradRight.addColorStop(0, 'rgba(148, 163, 184, 0.2)');
            wallGradRight.addColorStop(1, 'rgba(148, 163, 184, 0)');
            this.ctx.fillStyle = wallGradRight;
            this.ctx.fillRect(this.width - 20, -100, 20, this.height + 100);

            // 墙壁发光边框 (明确反弹线)
            this.ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'; // Slate-400
            this.ctx.lineWidth = 2;
            this.ctx.shadowColor = '#94a3b8';
            this.ctx.shadowBlur = 10;
            this.ctx.beginPath();
            // 左边线
            this.ctx.moveTo(1, -100); this.ctx.lineTo(1, this.height);
            // 右边线
            this.ctx.moveTo(this.width - 1, -100); this.ctx.lineTo(this.width - 1, this.height);
            // 顶部线 (封顶)
            this.ctx.moveTo(0, 1); this.ctx.lineTo(this.width, 1);
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
                    // e.dropTargetY > 0 || 
                    if (e.pos.y > 0) {
                        activeEnemies++;
                    }
                    if (Math.abs(e.pos.y - e.dropTargetY) > 1) anyEnemyMoving = true;
                }
            });

            if (this.input_checkDefeat()) this.gameOver = true;

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

        this.ctx.restore(); // 结束实体层


        // --- UI Overlays ---
        if (this.gameOver) { 
            // [META] 结算货币并保存
            if (this.runCurrency > 0) {
                this.meta_addCurrency(this.runCurrency);
                this.runCurrency = 0;
            }

            document.getElementById('combat-message').innerHTML = '<span class="text-red-400 font-bold text-4xl">防線失守</span><br><span class="text-sm">點擊返回主界面</span>'; 
            return; 
        }

        if (activeEnemies === 0) {
            const hasLeftoverAmmo = this.ammoQueue.length > 0;
            if (hasLeftoverAmmo) {
                const leftoverCount = this.ammoQueue.length;
                const scoreMult = Math.pow(CONFIG.balance.unusedAmmoScoreMult, leftoverCount);
                this.score *= scoreMult;
                document.getElementById('score-num').innerText = this.smartScientific(this.score,3); 
                this.nextRoundHpMultiplier = CONFIG.balance.nextRoundDifficultyMult;
                showToast(`完美清場! 分數 x${scoreMult} | 下輪難度 UP!`);
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
                        this.phase_finalizeRound(); 
                    }
                    return;
                }
            }
            return;
        }

        if (this.ammoQueue.length === 0 && this.projectiles.length === 0 && this.burstQueue.length === 0 && !this.gameOver) { 
            // 回合结束，风暴核心能量衰减
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

        // --- [新增] 手机偏移提示强化：绘制边缘泛光和水平仪指示器 ---
        this.drawTiltVignette(this.ctx, this.boardTilt.current);
        this.drawTiltIndicator(this.ctx, this.boardTilt.current);
        
    },

/**
     * @method attemptCompleteGatheringTurn
     * @description 尝试完成收集回合。修复了最后一个能量球导致无法结算的BUG。
     */
    phase_gathering_attemptComplete() {
        if (this.isWheelSpinning) return;
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
        // 在 updateGathering 的末尾添加对 DOM 的操作
        //const container = document.getElementById('game-container');
        const tx = this.boardTilt.current.x * -10; // 负值产生视差
        const ty = this.boardTilt.current.y * -5;

        // 这里的 transform 会让整个 UI 产生微弱的悬浮感
        container.style.perspective = "1000px";
        // 甚至可以增加旋转感 (谨慎使用，可能会晕)
        container.style.transform = `rotateY(${tx * 0.2}deg) rotateX(${-ty * 0.2}deg)`;

        // --- [新增] 手机偏移提示强化：绘制边缘泛光和水平仪指示器 ---
        this.drawTiltVignette(this.ctx, this.boardTilt.current);
        this.drawTiltIndicator(this.ctx, this.boardTilt.current);

    },
};
