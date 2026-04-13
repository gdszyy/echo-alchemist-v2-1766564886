/**
 * plinko_physics.js - 钉盘物理引擎与概率分析模块
 *
 * 理论基础：
 * ─────────────────────────────────────────────────────────────────────────────
 * 【Galton Board（高尔顿钉板）原理】
 *   由 Francis Galton 于 1889 年发明，用于演示二项分布趋近正态分布的过程。
 *   弹珠每经过一排钉子时，以概率 p 向右偏转，以概率 (1-p) 向左偏转。
 *   经过 n 排钉子后，落入第 k 个槽的概率服从二项分布：
 *
 *       P(X = k) = C(n, k) * p^k * (1-p)^(n-k)
 *
 *   当 p = 0.5（理想对称钉板）时，分布趋近于均值 μ = n/2、标准差 σ = √(n/4) 的正态分布。
 *   当 p ≠ 0.5（倾斜或非对称布局）时，分布出现偏斜（Skewness）。
 *
 * 【真实弹珠碰撞物理】
 *   1. 法向冲量（Normal Impulse）：沿碰撞法线方向的速度反转，由弹性系数 e 控制。
 *      v_n_after = -e * v_n_before
 *
 *   2. 切向摩擦（Tangential Friction）：钉子表面摩擦力减小切向速度，并产生角动量。
 *      v_t_after = v_t_before * (1 - μ_f)   （μ_f 为摩擦系数）
 *
 *   3. 角动量效应（Spin Effect）：弹珠自旋产生的 Magnus 效应，使轨迹产生曲率。
 *      F_magnus = ω × v * C_magnus
 *
 *   4. 速度依赖弹性（Velocity-Dependent Restitution）：
 *      高速碰撞时弹性系数接近理想值，低速碰撞时因材料形变损耗更多能量。
 *      e(v) = e_max - (e_max - e_min) * exp(-v / v_characteristic)
 *
 * 【布局专属概率特性】
 *   - default（标准交错）：标准二项分布，p ≈ 0.5，中心槽概率最高
 *   - triangle（三角形）：顶部宽底部窄，弹珠路径收敛，分布更集中
 *   - diamond（菱形）：中部最宽，弹珠在中部发散后收敛，双峰分布
 *   - sparse（稀疏间隔）：钉子密度低，弹珠受重力主导，分布更均匀
 *   - mirror_sync（镜像同步）：左右对称，分布严格对称于中轴
 *   - wide_narrow（宽窄交替）：交替行产生周期性偏转，分布出现多峰
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 职责：
 *   - 提供增强版碰撞物理计算（角动量、速度依赖弹性、表面摩擦）
 *   - 提供 Galton Board 概率分布计算（二项分布、布局偏斜修正）
 *   - 提供落点热力图数据生成（用于 UI 可视化）
 *   - 提供布局专属物理参数配置
 *
 * 注意：本模块为纯计算模块，不依赖任何 DOM 或游戏状态，便于单元测试。
 */

// ==================== 布局专属物理参数 ====================

/**
 * 每种钉盘布局的专属物理参数集。
 * 这些参数影响弹珠的碰撞行为，赋予每种布局独特的"手感"。
 *
 * @typedef {Object} LayoutPhysicsParams
 * @property {number} elasticity       - 弹性系数 (0~1)，1 = 完全弹性碰撞
 * @property {number} friction         - 表面摩擦系数 (0~1)，0 = 无摩擦
 * @property {number} spinTransfer     - 角动量转移系数 (0~1)，控制自旋产生量
 * @property {number} magnusStrength   - Magnus 效应强度，自旋对轨迹的影响
 * @property {number} deflectBias      - 偏转偏置 (-1~1)，正值偏右，负值偏左
 * @property {number} noiseAmplitude   - 随机扰动幅度，模拟钉子表面微观不规则
 * @property {number} binomialP        - 二项分布参数 p（向右偏转概率，0.5 = 对称）
 * @property {string} distributionHint - 分布特征描述（用于 UI 提示）
 */
export const LAYOUT_PHYSICS = {
    default: {
        elasticity: 0.89,
        friction: 0.08,
        spinTransfer: 0.35,
        magnusStrength: 0.018,
        deflectBias: 0.0,
        noiseAmplitude: 0.5,
        binomialP: 0.5,
        distributionHint: '正态分布 · 中心聚集',
        distributionColor: '#60a5fa',
    },
    triangle: {
        // 三角形：顶宽底窄，弹珠路径在下方收敛
        // 物理上等效于漏斗效应：弹珠越往下越受侧向约束
        elasticity: 0.92,       // 稍高弹性，路径更活跃
        friction: 0.05,         // 低摩擦，弹珠滑动感强
        spinTransfer: 0.28,
        magnusStrength: 0.022,
        deflectBias: 0.0,
        noiseAmplitude: 0.4,
        binomialP: 0.5,
        distributionHint: '收敛分布 · 中心极聚',
        distributionColor: '#f59e0b',
    },
    diamond: {
        // 菱形：中部最宽，弹珠在中部经历最多碰撞，然后收敛
        // 产生双峰分布：弹珠倾向于在中轴两侧各形成一个高概率区
        elasticity: 0.87,
        friction: 0.12,
        spinTransfer: 0.42,     // 高角动量转移，产生更多自旋
        magnusStrength: 0.025,
        deflectBias: 0.0,
        noiseAmplitude: 0.6,
        binomialP: 0.5,
        distributionHint: '双峰分布 · 两侧聚集',
        distributionColor: '#a78bfa',
    },
    sparse: {
        // 稀疏间隔：钉子少，弹珠受重力主导，路径更直
        // 分布更均匀，接近均匀分布
        elasticity: 0.85,
        friction: 0.15,
        spinTransfer: 0.20,
        magnusStrength: 0.010,
        deflectBias: 0.0,
        noiseAmplitude: 0.8,    // 高随机性，路径不可预测
        binomialP: 0.5,
        distributionHint: '均匀分布 · 全域随机',
        distributionColor: '#34d399',
    },
    mirror_sync: {
        // 镜像同步：左右对称，分布严格对称
        // 弹珠从中心入射时，左右概率完全相等
        elasticity: 0.90,
        friction: 0.09,
        spinTransfer: 0.38,
        magnusStrength: 0.020,
        deflectBias: 0.0,       // 严格无偏置
        noiseAmplitude: 0.35,   // 低噪声，保证对称性
        binomialP: 0.5,
        distributionHint: '对称分布 · 镜像均等',
        distributionColor: '#f472b6',
    },
    wide_narrow: {
        // 宽窄交替：偶数行宽、奇数行窄，产生周期性偏转
        // 弹珠在宽行发散，在窄行收敛，形成多峰分布
        elasticity: 0.88,
        friction: 0.11,
        spinTransfer: 0.32,
        magnusStrength: 0.016,
        deflectBias: 0.0,
        noiseAmplitude: 0.55,
        binomialP: 0.5,
        distributionHint: '多峰分布 · 周期波动',
        distributionColor: '#fb923c',
    },
};

// ==================== 增强版碰撞物理计算 ====================

/**
 * 计算速度依赖弹性系数。
 * 高速碰撞接近理想弹性，低速碰撞因材料形变损耗更多能量。
 *
 * @param {number} impactSpeed - 碰撞法向速度大小
 * @param {number} eMax        - 最大弹性系数（高速极限）
 * @param {number} eMin        - 最小弹性系数（低速极限）
 * @param {number} vChar       - 特征速度（决定过渡区间）
 * @returns {number} 当前弹性系数
 */
export function calcVelocityDependentElasticity(impactSpeed, eMax = 0.92, eMin = 0.72, vChar = 4.0) {
    // 指数衰减模型：速度越低，弹性越接近 eMin
    return eMax - (eMax - eMin) * Math.exp(-impactSpeed / vChar);
}

/**
 * 增强版弹珠-钉子碰撞解算。
 * 在原有法向反弹基础上，增加：
 *   1. 速度依赖弹性系数
 *   2. 切向摩擦力（减小切向速度，产生角动量）
 *   3. Magnus 效应（自旋影响后续轨迹）
 *   4. 微观噪声（模拟钉子表面不规则）
 *
 * @param {Object} ball    - 弹珠对象，含 vel (Vec2), spin (number)
 * @param {Object} peg     - 钉子对象，含 pos (Vec2), type (string)
 * @param {Object} params  - 布局物理参数（来自 LAYOUT_PHYSICS）
 * @returns {{ newVel: {x,y}, newSpin: number, impactSpeed: number }}
 */
export function resolveEnhancedCollision(ball, peg, params) {
    const dx = ball.pos.x - peg.pos.x;
    const dy = ball.pos.y - peg.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-6) {
        return { newVel: { x: ball.vel.x, y: ball.vel.y }, newSpin: ball.spin || 0, impactSpeed: 0 };
    }

    // 碰撞法线（从钉子指向弹珠）
    const nx = dx / dist;
    const ny = dy / dist;

    // 切线方向（法线旋转 90°）
    const tx = -ny;
    const ty = nx;

    // 分解速度到法向和切向分量
    const vn = ball.vel.x * nx + ball.vel.y * ny; // 法向速度（标量）
    const vt = ball.vel.x * tx + ball.vel.y * ty; // 切向速度（标量）

    // 仅处理接近碰撞（法向速度为负，即弹珠朝向钉子）
    if (vn >= 0) {
        return { newVel: { x: ball.vel.x, y: ball.vel.y }, newSpin: ball.spin || 0, impactSpeed: 0 };
    }

    const impactSpeed = Math.abs(vn);

    // 1. 速度依赖弹性系数
    const e = calcVelocityDependentElasticity(
        impactSpeed,
        params.elasticity,
        params.elasticity * 0.78,
        4.0
    );

    // 2. 法向速度反转（弹性碰撞）
    const newVn = -e * vn;

    // 3. 切向摩擦力（减小切向速度）
    // 摩擦力方向与切向速度相反
    const frictionImpulse = -params.friction * vt;
    const newVt = vt + frictionImpulse;

    // 4. 角动量转移：切向摩擦产生自旋
    // 自旋方向由切向速度方向决定
    const currentSpin = ball.spin || 0;
    const spinDelta = -params.spinTransfer * vt; // 切向速度转化为角速度
    const newSpin = currentSpin + spinDelta;

    // 5. 微观噪声（模拟钉子表面不规则）
    const noise = (Math.random() - 0.5) * params.noiseAmplitude;

    // 6. 重建速度向量
    const newVelX = newVn * nx + newVt * tx + noise;
    const newVelY = newVn * ny + newVt * ty;

    return {
        newVel: { x: newVelX, y: newVelY },
        newSpin: newSpin,
        impactSpeed: impactSpeed,
    };
}

/**
 * 计算 Magnus 效应产生的横向力。
 * 自旋弹珠在空气中受到与速度垂直的升力（Magnus Force）。
 *
 * @param {number} spin          - 当前角速度（正值 = 顺时针）
 * @param {{ x: number, y: number }} vel - 当前速度向量
 * @param {number} magnusStrength - Magnus 效应强度系数
 * @returns {{ fx: number, fy: number }} Magnus 力的分量
 */
export function calcMagnusForce(spin, vel, magnusStrength) {
    // Magnus 力 = ω × v（叉积，二维情况下为标量 * 垂直方向）
    // F_x = -magnusStrength * spin * vel.y
    // F_y =  magnusStrength * spin * vel.x
    return {
        fx: -magnusStrength * spin * vel.y,
        fy:  magnusStrength * spin * vel.x,
    };
}

/**
 * 自旋衰减（空气阻力导致角速度逐渐减小）。
 *
 * @param {number} spin      - 当前角速度
 * @param {number} decayRate - 每帧衰减率（0~1，越大衰减越快）
 * @returns {number} 衰减后的角速度
 */
export function decaySpin(spin, decayRate = 0.015) {
    return spin * (1.0 - decayRate);
}

// ==================== Galton Board 概率分布计算 ====================

/**
 * 计算二项分布概率质量函数 P(X = k)。
 * 使用对数域计算防止大数溢出。
 *
 * @param {number} n - 试验次数（钉子行数）
 * @param {number} k - 成功次数（向右偏转次数）
 * @param {number} p - 单次成功概率（向右偏转概率）
 * @returns {number} P(X = k)
 */
export function binomialPMF(n, k, p) {
    if (k < 0 || k > n) return 0;
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;

    // 使用对数域：log P = log C(n,k) + k*log(p) + (n-k)*log(1-p)
    const logProb = logBinomialCoeff(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
    return Math.exp(logProb);
}

/**
 * 计算对数二项式系数 log C(n, k)。
 * 使用 Stirling 近似或直接递推，避免大数溢出。
 *
 * @param {number} n
 * @param {number} k
 * @returns {number} log C(n, k)
 */
function logBinomialCoeff(n, k) {
    if (k === 0 || k === n) return 0;
    // 利用对称性减少计算量
    if (k > n - k) k = n - k;

    let result = 0;
    for (let i = 0; i < k; i++) {
        result += Math.log(n - i) - Math.log(i + 1);
    }
    return result;
}

/**
 * 生成 Galton Board 落点概率分布数组。
 * 考虑布局类型对概率分布的修正。
 *
 * @param {number} rows         - 钉子行数
 * @param {number} cols         - 槽位数量（通常为 cols + 1）
 * @param {string} layout       - 布局类型
 * @param {number} tiltBias     - 倾斜偏置（-1~1，来自 boardTilt.current.x）
 * @returns {number[]} 归一化概率数组，长度为 cols + 1
 */
export function calcDropDistribution(rows, cols, layout = 'default', tiltBias = 0) {
    const params = LAYOUT_PHYSICS[layout] || LAYOUT_PHYSICS.default;

    // 基础偏转概率：受倾斜影响
    // tiltBias > 0 表示向右倾斜，弹珠偏向右侧
    const tiltEffect = tiltBias * 0.15; // 倾斜对概率的影响系数
    const p = Math.max(0.05, Math.min(0.95, params.binomialP + tiltEffect));

    // 有效行数：不同布局的"等效碰撞行数"不同
    const effectiveRows = getEffectiveRows(rows, layout);

    // 槽位数 = 有效行数 + 1（Galton Board 的几何关系）
    const slotCount = cols + 1;

    // 计算原始二项分布
    const rawProbs = [];
    for (let k = 0; k <= effectiveRows; k++) {
        rawProbs.push(binomialPMF(effectiveRows, k, p));
    }

    // 将 effectiveRows+1 个概率插值到 slotCount 个槽位
    const probs = interpolateDistribution(rawProbs, slotCount);

    // 布局专属修正
    applyLayoutCorrection(probs, layout, rows);

    // 归一化
    const total = probs.reduce((s, v) => s + v, 0);
    return probs.map(v => v / total);
}

/**
 * 获取布局的等效碰撞行数。
 * 不同布局中弹珠经历的有效碰撞次数不同。
 *
 * @param {number} rows   - 实际行数
 * @param {string} layout - 布局类型
 * @returns {number} 等效行数
 */
function getEffectiveRows(rows, layout) {
    switch (layout) {
        case 'triangle':
            // 三角形：平均每行列数递减，等效行数约为实际行数的 0.7
            return Math.max(1, Math.round(rows * 0.7));
        case 'diamond':
            // 菱形：中部最宽，等效行数接近实际行数
            return rows;
        case 'sparse':
            // 稀疏：碰撞少，等效行数约为实际行数的 0.5
            return Math.max(1, Math.round(rows * 0.5));
        case 'mirror_sync':
            // 镜像同步：列数减少，等效行数约为实际行数的 0.8
            return Math.max(1, Math.round(rows * 0.8));
        case 'wide_narrow':
            // 宽窄交替：偶数行宽，等效行数接近实际行数
            return rows;
        default:
            return rows;
    }
}

/**
 * 将概率数组从一个长度插值到另一个长度。
 *
 * @param {number[]} src    - 源概率数组
 * @param {number}   dstLen - 目标长度
 * @returns {number[]} 插值后的概率数组
 */
function interpolateDistribution(src, dstLen) {
    if (src.length === dstLen) return [...src];

    const result = new Array(dstLen).fill(0);
    const scale = (src.length - 1) / (dstLen - 1);

    for (let i = 0; i < dstLen; i++) {
        const srcIdx = i * scale;
        const lo = Math.floor(srcIdx);
        const hi = Math.min(lo + 1, src.length - 1);
        const t = srcIdx - lo;
        result[i] = src[lo] * (1 - t) + src[hi] * t;
    }

    return result;
}

/**
 * 对概率分布施加布局专属修正。
 * 模拟不同布局结构对弹珠路径的系统性影响。
 *
 * @param {number[]} probs  - 概率数组（原地修改）
 * @param {string}   layout - 布局类型
 * @param {number}   rows   - 实际行数
 */
function applyLayoutCorrection(probs, layout, rows) {
    const n = probs.length;
    const center = (n - 1) / 2;

    switch (layout) {
        case 'triangle': {
            // 三角形收敛效应：增强中心概率，抑制边缘概率
            // 模拟弹珠在底部被漏斗形结构引导向中心
            for (let i = 0; i < n; i++) {
                const distFromCenter = Math.abs(i - center) / center;
                // 高斯型修正：中心增强，边缘衰减
                const correction = Math.exp(-2.5 * distFromCenter * distFromCenter);
                probs[i] *= (0.4 + 0.6 * correction);
            }
            break;
        }
        case 'diamond': {
            // 菱形双峰效应：在中轴两侧各增强一个峰
            // 模拟弹珠在菱形中部发散后，在两侧收敛
            const peakOffset = center * 0.35; // 双峰距中心的偏移
            for (let i = 0; i < n; i++) {
                const distFromLeftPeak  = Math.abs(i - (center - peakOffset));
                const distFromRightPeak = Math.abs(i - (center + peakOffset));
                const minDist = Math.min(distFromLeftPeak, distFromRightPeak);
                const correction = Math.exp(-1.8 * (minDist / center) * (minDist / center));
                probs[i] *= (0.5 + 0.5 * correction);
            }
            break;
        }
        case 'sparse': {
            // 稀疏均匀化：将分布向均匀分布靠拢
            // 模拟钉子少时弹珠路径更随机
            const uniform = 1.0 / n;
            const blendFactor = 0.45; // 45% 均匀化
            for (let i = 0; i < n; i++) {
                probs[i] = probs[i] * (1 - blendFactor) + uniform * blendFactor;
            }
            break;
        }
        case 'mirror_sync': {
            // 镜像对称化：强制左右对称
            for (let i = 0; i < Math.floor(n / 2); i++) {
                const j = n - 1 - i;
                const avg = (probs[i] + probs[j]) / 2;
                probs[i] = avg;
                probs[j] = avg;
            }
            break;
        }
        case 'wide_narrow': {
            // 宽窄交替多峰效应：在均匀间隔位置增强概率
            // 模拟宽行和窄行交替产生的周期性偏转
            const peakCount = Math.max(2, Math.floor(rows / 2));
            for (let i = 0; i < n; i++) {
                // 多峰修正：在 peakCount 个等间距位置增强
                let maxPeakEffect = 0;
                for (let p = 0; p < peakCount; p++) {
                    const peakPos = (p + 0.5) / peakCount * (n - 1);
                    const distFromPeak = Math.abs(i - peakPos);
                    const effect = Math.exp(-2.0 * (distFromPeak / (n / peakCount)) ** 2);
                    maxPeakEffect = Math.max(maxPeakEffect, effect);
                }
                probs[i] *= (0.6 + 0.4 * maxPeakEffect);
            }
            break;
        }
        // default: 不修正，保持标准二项分布
    }
}

// ==================== 落点热力图数据生成 ====================

/**
 * 生成落点热力图数据，用于在 Canvas 上可视化概率分布。
 *
 * @param {number[]} distribution  - 归一化概率数组
 * @param {number}   canvasWidth   - 画布宽度
 * @param {number}   boardBottomY  - 钉盘底部 Y 坐标
 * @param {number}   canvasHeight  - 画布高度
 * @param {string}   layout        - 布局类型（用于获取颜色）
 * @returns {Array<{x, y, width, height, alpha, color}>} 热力图矩形数组
 */
export function generateHeatmapData(distribution, canvasWidth, boardBottomY, canvasHeight, layout = 'default') {
    const params = LAYOUT_PHYSICS[layout] || LAYOUT_PHYSICS.default;
    const n = distribution.length;
    const slotWidth = canvasWidth / n;
    const maxProb = Math.max(...distribution);
    const heatmapHeight = Math.min(60, canvasHeight - boardBottomY - 20);

    return distribution.map((prob, i) => {
        const normalizedProb = maxProb > 0 ? prob / maxProb : 0;
        return {
            x: i * slotWidth,
            y: boardBottomY + 10,
            width: slotWidth - 2,
            height: heatmapHeight * normalizedProb,
            alpha: 0.15 + normalizedProb * 0.55,
            color: params.distributionColor,
            prob: prob,
            rank: 0, // 将在排序后填充
        };
    });
}

/**
 * 计算弹珠从给定入射位置的预期落点分布（考虑入射偏移）。
 *
 * @param {number}   entryX       - 弹珠入射 X 坐标
 * @param {number}   canvasWidth  - 画布宽度
 * @param {number[]} baseDistrib  - 基础概率分布（来自 calcDropDistribution）
 * @returns {number[]} 修正后的概率分布
 */
export function adjustDistributionForEntry(entryX, canvasWidth, baseDistrib) {
    const n = baseDistrib.length;
    const centerFraction = entryX / canvasWidth; // 0~1，入射位置相对画布的比例
    const centerSlot = centerFraction * (n - 1); // 对应的槽位索引

    // 以入射位置为中心，对基础分布施加偏移
    // 使用卷积方式：将基础分布向入射位置方向平移
    const shiftAmount = centerSlot - (n - 1) / 2; // 相对于中心的偏移量
    const result = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
        // 平移后的源索引（使用线性插值）
        const srcIdx = i - shiftAmount * 0.6; // 0.6 = 入射偏移的影响系数
        const lo = Math.floor(srcIdx);
        const hi = lo + 1;
        const t = srcIdx - lo;

        const loVal = (lo >= 0 && lo < n) ? baseDistrib[lo] : 0;
        const hiVal = (hi >= 0 && hi < n) ? baseDistrib[hi] : 0;
        result[i] = loVal * (1 - t) + hiVal * t;
    }

    // 归一化
    const total = result.reduce((s, v) => s + v, 0);
    if (total > 0) {
        for (let i = 0; i < n; i++) result[i] /= total;
    }

    return result;
}

// ==================== 物理参数查询接口 ====================

/**
 * 获取指定布局的物理参数（带默认值回退）。
 *
 * @param {string} layout - 布局类型
 * @returns {LayoutPhysicsParams}
 */
export function getLayoutParams(layout) {
    return LAYOUT_PHYSICS[layout] || LAYOUT_PHYSICS.default;
}

/**
 * 获取所有布局的分布特征描述（用于 UI 显示）。
 *
 * @returns {Object.<string, {hint: string, color: string}>}
 */
export function getAllLayoutHints() {
    const hints = {};
    for (const [key, params] of Object.entries(LAYOUT_PHYSICS)) {
        hints[key] = {
            hint: params.distributionHint,
            color: params.distributionColor,
        };
    }
    return hints;
}

/**
 * 计算当前布局下的"理论最优入射点"。
 * 即使落入最高概率槽位的入射 X 坐标。
 *
 * @param {string} layout      - 布局类型
 * @param {number} canvasWidth - 画布宽度
 * @param {number} cols        - 槽位数量
 * @returns {number} 最优入射 X 坐标
 */
export function calcOptimalEntryX(layout, canvasWidth, cols) {
    // 对于对称布局，最优入射点在中心
    // 对于非对称布局，根据分布峰值计算
    const distribution = calcDropDistribution(5, cols, layout, 0);
    const maxIdx = distribution.indexOf(Math.max(...distribution));
    return (maxIdx / cols) * canvasWidth;
}
