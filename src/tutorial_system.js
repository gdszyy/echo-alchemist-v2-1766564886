/**
 * tutorial_system.js - 新手教程子系统
 *
 * 职责：
 * - 检测玩家是否为首次游玩，触发新手引导流程
 * - 以「步骤卡片 + 高亮遮罩」方式逐步引导玩家了解核心玩法
 * - 教程完成后写入 saveData.tutorialCompleted，不再重复触发
 * - 提供随时可重放教程的入口（设置面板）
 *
 * 架构规范：
 * - 遵循组合模式（Composition via bind），在 core.js 中注入
 * - 严禁直接修改全局 Game 状态，通过 eventBus 通信
 * - 所有 DOM 操作集中在本模块，不污染业务层
 *
 * 步骤按钮行为说明：
 * - waitForEvent 为 null：显示「下一步」按钮，玩家手动点击前进
 * - waitForEvent 有值 + actionLabel 有值：显示具体操作提示按钮（如「点击开始游戏」），
 *   按钮本身不前进教程，而是调用对应的游戏操作；教程在事件触发后自动前进
 * - waitForEvent 有值 + actionLabel 为 null：隐藏按钮，纯等待事件自动前进
 * - 「上一步」按钮已移除，教程只支持单向前进
 *
 * @module tutorial_system
 */

import { eventBus, EVENT_TYPES } from './event_bus.js';

// ==================== 教程步骤定义 ====================
/**
 * 每个步骤的结构：
 * {
 *   id: string,                    // 步骤唯一标识
 *   phase: string|null,            // 需要处于的游戏阶段（null 表示任意阶段）
 *   targetId: string|null,         // 高亮目标元素的 DOM id（null 表示无高亮）
 *   highlightSelector: string|null,// 优先使用的 CSS 选择器（覆盖 targetId）
 *   title: string,                 // 步骤标题
 *   content: string,               // 步骤说明文本（支持 HTML）
 *   position: string,              // 提示卡片位置：'top' | 'bottom' | 'center'
 *   noOverlay: boolean,            // 是否禁用遮罩（研磨阶段等需要玩家直接操作）
 *   waitForEvent: string|null,     // 等待某个 EventBus 事件后才自动前进
 *   waitForEventFilter: Function|null, // 过滤事件数据
 *   autoAdvance: boolean,          // 事件触发后是否自动前进
 *   actionLabel: string|null,      // 操作按钮文字（替代「下一步」，提示玩家执行具体操作）
 *   actionFn: string|null,         // 操作按钮点击时调用的 game 方法名（字符串形式）
 * }
 */
const TUTORIAL_STEPS = [
    // ── 第 0 步：欢迎 ────────────────────────────────────────────────────────
    {
        id: 'welcome',
        phase: 'meta',
        targetId: null,
        title: '欢迎来到《回声炼金师》！',
        content: `
            <p>这是一款融合了<strong>弹珠台</strong>与<strong>Roguelike</strong>的策略游戏。</p>
            <p class="mt-2">本教程将引导你完成第一局游戏，了解核心玩法。</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 可在主页底部「重新开始教程」按钮重播</p>
        `,
        position: 'center',
        noOverlay: false,
        waitForEvent: null,
        autoAdvance: false,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 1 步：开始游戏按鈕 ─────────────────────────────────────────────────────
    // 高亮「開始練成」按鈕，卡片固定在屏幕底部，不遮挡按钮，教程等待事件自动前进
    {
        id: 'start_run',
        phase: 'meta',
        targetId: null,
        highlightSelector: 'button[onclick="game.meta_startRun()"]',
        title: '开始一局游戏',
        content: `
            <p>点击高亮的「<strong>開始練成</strong>」按鈕，开始新的一局冒险。</p>
            <p class="mt-2">每一局都是独立的旅程，你需要收集弹珠、击败敌人。</p>
            <p class="mt-2 text-amber-300/80 text-xs">↑ 直接点击上方高亮按鈕，教程自动继续</p>
        `,
        position: 'bottom-fixed',
        noOverlay: false,
        waitForEvent: 'tutorial:relic_shown',
        waitForEventFilter: null,
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    }, // ── 第 2 步：遗物选择 ─────────────────────────────────────────────────────
    // 遗物面板全屏显示，卡片固定在底部中央，避免遮挡遗物
    {
        id: 'relic_selection',
        phase: 'relic',
        targetId: null,
        highlightSelector: null,
        title: '选择你的起始遗物',
        content: `
            <p><strong>遗物</strong>是强力的被动增益道具，将贯穿整局游戏。</p>
            <p class="mt-2">点击任意一个遗物卡片，即可选择并继续。</p>
            <p class="mt-2 text-cyan-300/80 text-xs">💡 不同遗物组合可以产生强大的协同效果</p>
        `,
        position: 'bottom-fixed',   // 特殊值：固定在屏幕底部，不跟随高亮元素
        noOverlay: true,            // 不遮罩，让玩家能点击遗物
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'selection' && (!window.game || typeof game.ui_isFateMomentPhase !== 'function' || !game.ui_isFateMomentPhase()),
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 3 步：弹珠选择 ──────────────────────────────────────────────────────────────────────────────────────
    // 选中3枚弹珠后自动推进，无「下一步」按鈕
    {
        id: 'marble_selection',
        phase: 'selection',
        targetId: 'phase-selection',
        highlightSelector: '#marble-selection-grid',
        title: '选择你的弹珠',
        content: `
            <p><strong>弹珠</strong>是你的主要攻击单位，每种弹珠有独特的属性和技能。</p>
            <p class="mt-2">选择 <strong>3 枚弹珠</strong>组成本局弹药库，选齐后教程自动继续。</p>
            <p class="mt-2 text-cyan-300/80 text-xs">💡 点击弹珠可预览详细属性，再次点击选中</p>
        `,
        position: 'bottom',
        noOverlay: false,
        waitForEvent: 'tutorial:marbles_ready',
        waitForEventFilter: null,
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 4 步：确认选择 ──────────────────────────────────────────────────────────────────────────────────────
    {
        id: 'confirm_selection',
        phase: 'selection',
        targetId: 'phase-selection',
        highlightSelector: '#confirm-selection-btn',
        title: '确认选择，开始研磨！',
        content: `
            <p>选好 3 枚弹珠后，点击高亮的「<strong>開始練金</strong>」按鈕进入研磨阶段。</p>
            <p class="mt-2">研磨阶段中，你的弹珠将在钉盘中弹跳，装载战斗子弹。</p>
            <p class="mt-2 text-amber-300/80 text-xs">↑ 直接点击上方按鈕，教程自动继续</p>
        `,
        position: 'top',
        noOverlay: false,
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'gathering',
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 5 步：研磨阶段说明 ─────────────────────────────────────────────────
    // 取消遮罩，让玩家能直接操作钉板
    {
        id: 'gathering_intro',
        phase: 'gathering',
        targetId: null,
        highlightSelector: null,
        title: '研磨阶段',
        content: `
            <p>点击<strong>钉板上方区域</strong>投入弹珠，让它在钉盘中弹跳。</p>
            <p class="mt-2">每枚弹珠会根据碰撞到的钉子属性，<strong>装载对应的子弹效果</strong>。</p>
            <p class="mt-2"><strong>💡 提示：左右倾斜手机可以让弹珠向左或向右移动。</strong></p>
            <p class="mt-2">三枚弹珠全部装载完毕后，自动进入<strong>战斗阶段</strong>！</p>
            <p class="mt-2 text-amber-300/80 text-xs">👆 现在试着点击上方区域投入弹珠吧！</p>
        `,
        position: 'bottom-fixed',   // 固定在底部，不遮挡钉板
        noOverlay: true,            // 取消遮罩，让玩家能操作
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'combat',
        autoAdvance: true,
        actionLabel: null,          // 纯等待玩家投入弹珠
        actionFn: null,
    },
    // ── 第 6 步：战斗阶段 ─────────────────────────────────────────────────────
    // noOverlay: true  → 不遮挡界面，玩家可直接操作
    // position: 'bottom-fixed' → 固定在底部，不遮挡战斗区域
    // waitForEvent: UI_AMMO_FIRED → 等玩家真正发射一颗子弹后自动推进
    {
        id: 'combat_intro',
        phase: 'combat',
        targetId: null,
        highlightSelector: null,
        title: '战斗阶段 — 发射子弹！',
        content: `
            <p>弹珠装载完毕，进入<strong>战斗阶段</strong>！</p>
            <p class="mt-2"><strong>🎯 如何发射子弹：</strong></p>
            <p class="mt-1 text-cyan-300">在画布上<strong>按住并拖拽</strong>，瞄准敌人后<strong>松手</strong>即可发射。</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 拖拽方向决定发射角度，消灭所有敌人后进入下一回合</p>
            <p class="mt-1 text-red-300/80 text-xs">⚠️ 若敌人到达底部，游戏结束！</p>
        `,
        position: 'bottom-fixed',
        noOverlay: true,
        waitForEvent: EVENT_TYPES.UI_AMMO_FIRED,
        waitForEventFilter: null,
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 7 步：教程完成 ─────────────────────────────────────────────────────
    {
        id: 'tutorial_complete',
        phase: null,
        targetId: null,
        highlightSelector: null,
        title: '教程完成！',
        content: `
            <p>你已掌握《回声炼金师》的基础玩法！</p>
            <p class="mt-2">继续探索更多遗物、符文词条和弹珠组合，解锁强大的协同效果。</p>
            <p class="mt-3 text-amber-400 font-bold text-center">祝你炼金愉快！⚗️</p>
        `,
        position: 'center',
        noOverlay: false,
        waitForEvent: null,
        autoAdvance: false,
        actionLabel: null,
        actionFn: null,
    },
];

// ==================== 教程子系统 ====================
export const tutorial_system = {

    // ── 内部状态 ──────────────────────────────────────────────────────────────
    _tutorialActive: false,
    _tutorialStepIndex: 0,
    _tutorialUnsubscribers: [],
    _tutorialOverlayEl: null,
    _tutorialCardEl: null,
    _tutorialHighlightEl: null,

    // ==================== 公开 API ====================

    /**
     * @method tutorial_checkAndStart
     * @description 检查是否需要触发新手教程（首次游玩时自动调用）。
     */
    tutorial_checkAndStart() {
        if (!this.saveData.tutorialCompleted) {
            setTimeout(() => this.tutorial_start(), 800);
        }
    },

    /**
     * @method tutorial_start
     * @description 启动新手教程（从第 0 步开始）。
     * 仅供游戏初始化时自动触发（tutorial_checkAndStart）调用。
     * 主页「重新开始教程」按钮请调用 tutorial_restartFromHome()。
     */
    tutorial_start() {
        if (this._tutorialActive) this.tutorial_end(false);
        this._tutorialActive = true;
        this._tutorialStepIndex = 0;
        // [爽游模式] 标记当前局为新手教程专属爽游局
        this._isTutorialRun = true;
        this._tutorial_createDOM();
        this._tutorial_showStep(0);
    },

    /**
     * @method tutorial_restartFromHome
     * @description 主页「重新开始教程」按钮的专属入口。
     * 先重置 tutorialCompleted 标志并切换到主页（meta 阶段），
     * 再延迟启动教程，确保整个流程从主页正确开始。
     */
    tutorial_restartFromHome() {
        // 1. 若当前有正在进行的教程，先清理
        this.tutorial_end(false);
        // 2. 重置「教程已完成」标志，使教程可以重新触发
        this.saveData.tutorialCompleted = false;
        this.sys_saveData();
        // 3. 清除局内存档，避免主页展示「继续游戏」按钮干扰教程流程
        this.sys_clearRunState();
        // 4. 切换到主页（meta 阶段），确保教程从主页流程开始
        this.phase_switchPhase('meta');
        // 5. 延迟启动教程（等待 meta 阶段 DOM 渲染完成）
        // [BUGFIX] 增加安全性检查，防止多次点击导致重复启动
        if (this._restartTimer) clearTimeout(this._restartTimer);
        this._restartTimer = setTimeout(() => {
            this.tutorial_start();
            this._restartTimer = null;
        }, 400);
    },

    /**
     * @method tutorial_end
     * @description 结束教程。
     * @param {boolean} [markCompleted=true]
     */
    tutorial_end(markCompleted = true) {
        this._tutorialActive = false;
        this._tutorial_cleanupListeners();
        this._tutorial_removeDOM();
        // [爽游模式] 注意：_isTutorialRun 不在此处清除，而是在 sys_resetGame 中清除
        // 这样可以确保整个 5 回合内爽游配置持续生效，不因教程卡片关闭而失效
        if (markCompleted) {
            this.saveData.tutorialCompleted = true;
            this.sys_saveData();
        }
    },

    /**
     * @method tutorial_nextStep
     * @description 前进到下一个教程步骤。
     */
    tutorial_nextStep() {
        if (!this._tutorialActive) return;
        const nextIndex = this._tutorialStepIndex + 1;
        if (nextIndex >= TUTORIAL_STEPS.length) {
            this.tutorial_end(true);
            return;
        }
        this._tutorial_showStep(nextIndex);
    },

    /**
     * @method tutorial_skipAll
     * @description 跳过全部教程。
     */
    tutorial_skipAll() {
        this.tutorial_end(true);
    },

    // ==================== 内部方法 ====================

    /**
     * @method _tutorial_createDOM
     * @description 创建教程所需的 DOM 元素。
     * @private
     */
    _tutorial_createDOM() {
        // [BUGFIX] 如果 DOM 已存在，先尝试重新绑定引用并确保可见，防止引用丢失或隐藏状态导致后续逻辑失效
        const existingOverlay = document.getElementById('tutorial-overlay');
        if (existingOverlay) {
            this._tutorialOverlayEl = existingOverlay;
            this._tutorialHighlightEl = document.getElementById('tutorial-highlight');
            this._tutorialCardEl = document.getElementById('tutorial-card');
            
            // 确保元素可见
            if (this._tutorialOverlayEl) this._tutorialOverlayEl.style.display = 'block';
            if (this._tutorialHighlightEl) this._tutorialHighlightEl.style.display = 'block';
            if (this._tutorialCardEl) this._tutorialCardEl.style.display = 'block';
            return;
        }

        // 1. 遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9000;
            pointer-events: none;
            background: rgba(2, 6, 23, 0.75);
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(overlay);
        this._tutorialOverlayEl = overlay;

        // 2. 高亮框
        const highlight = document.createElement('div');
        highlight.id = 'tutorial-highlight';
        highlight.style.cssText = `
            position: fixed; z-index: 9001;
            border: 2px solid rgba(245, 158, 11, 0.9);
            border-radius: 12px;
            box-shadow: 0 0 0 4000px rgba(2, 6, 23, 0.75), 0 0 20px rgba(245, 158, 11, 0.5);
            pointer-events: none;
            transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            display: none;
        `;
        document.body.appendChild(highlight);
        this._tutorialHighlightEl = highlight;

        // 3. 教程卡片
        const card = document.createElement('div');
        card.id = 'tutorial-card';
        card.style.cssText = `
            position: fixed; z-index: 9002;
            width: min(340px, 90vw);
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            border: 1px solid rgba(245, 158, 11, 0.4);
            border-radius: 16px;
            padding: 20px;
            box-shadow: 0 0 40px rgba(245, 158, 11, 0.15), 0 20px 60px rgba(0,0,0,0.5);
            font-family: 'Noto Serif TC', serif;
            color: #e2e8f0;
            pointer-events: auto;
            transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        card.innerHTML = `
            <div id="tutorial-card-inner">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div id="tutorial-step-indicator" style="
                        font-size: 10px; font-family: 'Cinzel', serif;
                        color: rgba(245,158,11,0.7); letter-spacing: 0.15em; text-transform: uppercase;
                    ">Step 1 / ${TUTORIAL_STEPS.length}</div>
                    <button id="tutorial-skip-btn" onclick="game.tutorial_skipAll()" style="
                        font-size: 11px; color: rgba(148,163,184,0.7);
                        background: none; border: none; cursor: pointer; padding: 2px 6px;
                        border-radius: 4px; transition: color 0.2s;
                    " onmouseover="this.style.color='#e2e8f0'" onmouseout="this.style.color='rgba(148,163,184,0.7)'">
                        跳过教程 ✕
                    </button>
                </div>
                <div style="
                    height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px;
                    margin-bottom: 16px; overflow: hidden;
                ">
                    <div id="tutorial-progress-bar" style="
                        height: 100%; background: linear-gradient(90deg, #f59e0b, #fbbf24);
                        border-radius: 2px; transition: width 0.4s ease;
                        width: ${(1 / TUTORIAL_STEPS.length) * 100}%;
                    "></div>
                </div>
                <h3 id="tutorial-title" style="
                    font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700;
                    color: #fbbf24; margin-bottom: 10px; line-height: 1.4;
                "></h3>
                <div id="tutorial-content" style="
                    font-size: 13px; line-height: 1.7; color: #cbd5e1;
                "></div>
                <div style="display:flex; justify-content:flex-end; margin-top:18px; gap:8px;">
                    <button id="tutorial-next-btn" style="
                        padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;
                        background: linear-gradient(135deg, #d97706, #f59e0b);
                        border: none; color: #0f172a; cursor: pointer;
                        transition: all 0.2s; box-shadow: 0 4px 12px rgba(245,158,11,0.3);
                        font-family: 'Noto Serif TC', serif;
                    " onmouseover="this.style.transform='scale(1.05)'"
                       onmouseout="this.style.transform='scale(1)'">
                        下一步 →
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(card);
        this._tutorialCardEl = card;
    },

    /**
     * @method _tutorial_removeDOM
     * @private
     */
    _tutorial_removeDOM() {
        ['tutorial-overlay', 'tutorial-highlight', 'tutorial-card', 'tutorial-launch-guide'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        this._tutorialOverlayEl = null;
        this._tutorialHighlightEl = null;
        this._tutorialCardEl = null;
    },

    /**
     * @method _tutorial_showStep
     * @param {number} index
     * @private
     */
    _tutorial_showStep(index) {
        this._tutorialStepIndex = index;
        const step = TUTORIAL_STEPS[index];
        if (!step) return;

        this._tutorial_cleanupListeners();
        // 移除上一步可能残留的钉盘引导框
        const oldGuide = document.getElementById('tutorial-launch-guide');
        if (oldGuide) oldGuide.remove();

        this._tutorial_updateCard(step, index);
        this._tutorial_updateHighlight(step);
        this._tutorial_positionCard(step);

        // 研磨阶段引导：在钉盘顶部创建点击引导框
        if (step.id === 'gathering_intro') {
            this._tutorial_createLaunchGuide();
        }

        if (step.waitForEvent) {
            this._tutorial_registerWaitEvent(step);
        }
    },

    /**
     * @method _tutorial_createLaunchGuide
     * @description 在钉盘顶部创建动态引导框，提示玩家点击上方区域投入弹珠。
     * 引导框占据 canvas 高度的上 40%（与游戏内部发射判断逻辑一致）。
     * @private
     */
    _tutorial_createLaunchGuide() {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const guideH = rect.height * 0.4;

        const guide = document.createElement('div');
        guide.id = 'tutorial-launch-guide';
        guide.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${rect.width}px;
            height: ${guideH}px;
            border: 2.5px dashed rgba(251,191,36,0.85);
            border-radius: 12px;
            pointer-events: none;
            z-index: 9998;
            box-sizing: border-box;
            animation: tutorial-pulse-border 1.2s ease-in-out infinite;
        `;

        // 内部文字提示
        guide.innerHTML = `
            <div style="
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(15,23,42,0.85);
                color: #fbbf24;
                font-size: 12px;
                font-weight: 700;
                padding: 4px 14px;
                border-radius: 20px;
                white-space: nowrap;
                font-family: 'Noto Serif TC', serif;
                letter-spacing: 0.05em;
                pointer-events: none;
            ">点击此区域投入弹珠 ↓</div>
        `;

        // 注入脉冲动画 CSS（如果尚未注入）
        if (!document.getElementById('tutorial-launch-guide-style')) {
            const style = document.createElement('style');
            style.id = 'tutorial-launch-guide-style';
            style.textContent = `
                @keyframes tutorial-pulse-border {
                    0%, 100% { border-color: rgba(251,191,36,0.85); box-shadow: 0 0 0 0 rgba(251,191,36,0); }
                    50% { border-color: rgba(251,191,36,1); box-shadow: 0 0 0 6px rgba(251,191,36,0.15); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(guide);
    },

    /**
     * @method _tutorial_updateCard
     * @description 更新卡片内容和按钮状态。
     *
     * 按钮逻辑：
     * - 最后一步：绿色「开始游戏」按钮，点击结束教程
     * - actionLabel 有值（需要玩家操作游戏）：
     *     显示具体操作提示按钮（如「点击开始游戏」），点击时调用 actionFn 对应的游戏方法，
     *     按钮本身不推进教程，教程由 waitForEvent 事件自动推进
     * - waitForEvent 有值但 actionLabel 为 null：
     *     隐藏按钮区域，显示等待提示文字
     * - 普通步骤：「下一步」按钮
     * - 「上一步」按钮已移除，教程只支持单向前进
     * @private
     */
    _tutorial_updateCard(step, index) {
        const card = this._tutorialCardEl;
        if (!card) return;

        const total = TUTORIAL_STEPS.length;
        const progress = ((index + 1) / total) * 100;
        const isLast = index === total - 1;

        const indicator = document.getElementById('tutorial-step-indicator');
        if (indicator) indicator.textContent = `Step ${index + 1} / ${total}`;

        const progressBar = document.getElementById('tutorial-progress-bar');
        if (progressBar) progressBar.style.width = `${progress}%`;

        const titleEl = document.getElementById('tutorial-title');
        if (titleEl) titleEl.textContent = step.title;

        const contentEl = document.getElementById('tutorial-content');
        if (contentEl) contentEl.innerHTML = step.content;

        const nextBtn = document.getElementById('tutorial-next-btn');
        if (!nextBtn) return;

        // 重置按钮样式
        nextBtn.style.color = '#0f172a';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.opacity = '1';
        nextBtn.onmouseover = () => { nextBtn.style.transform = 'scale(1.05)'; };
        nextBtn.onmouseout = () => { nextBtn.style.transform = 'scale(1)'; };

        if (isLast) {
            // 最后一步：完成教程
            nextBtn.textContent = '开始游戏 🎮';
            nextBtn.style.background = 'linear-gradient(135deg, #059669, #10b981)';
            nextBtn.style.display = 'inline-block';
            nextBtn.onclick = () => this.tutorial_end(true);

        } else if (step.actionLabel) {
            // 需要玩家操作游戏：显示操作提示按钮
            // 按钮点击时调用对应游戏方法（如 meta_startRun），但不推进教程
            // 教程由 waitForEvent 事件自动推进
            nextBtn.textContent = step.actionLabel;
            nextBtn.style.background = 'linear-gradient(135deg, #1d4ed8, #3b82f6)';
            nextBtn.style.color = '#fff';
            nextBtn.style.display = 'inline-block';
            nextBtn.onclick = () => {
                if (step.actionFn && typeof this[step.actionFn] === 'function') {
                    this[step.actionFn]();
                }
                // 按钮点击后变为等待状态
                nextBtn.textContent = '等待操作...';
                nextBtn.style.background = 'rgba(255,255,255,0.08)';
                nextBtn.style.color = '#94a3b8';
                nextBtn.style.cursor = 'default';
                nextBtn.onmouseover = null;
                nextBtn.onmouseout = null;
                nextBtn.onclick = null;
            };

        } else if (step.waitForEvent && !step.actionLabel) {
            // 纯等待事件，无操作按钮：隐藏按钮，显示等待提示
            nextBtn.style.display = 'none';

            // 在内容区下方追加等待提示（若尚未存在）
            const waitHint = document.getElementById('tutorial-wait-hint');
            if (!waitHint && contentEl) {
                const hint = document.createElement('p');
                hint.id = 'tutorial-wait-hint';
                hint.style.cssText = 'margin-top: 12px; font-size: 11px; color: rgba(148,163,184,0.6); text-align: center;';
                hint.textContent = '请按游戏提示操作，教程将自动继续…';
                contentEl.parentNode.insertBefore(hint, nextBtn.parentNode);
            }

        } else {
            // 普通步骤：下一步按钮
            nextBtn.textContent = '下一步 →';
            nextBtn.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
            nextBtn.style.display = 'inline-block';
            nextBtn.onclick = () => this.tutorial_nextStep();
        }

        // 清理等待提示（非等待步骤时移除）
        if (!step.waitForEvent || step.actionLabel) {
            const waitHint = document.getElementById('tutorial-wait-hint');
            if (waitHint) waitHint.remove();
        }
    },

    /**
     * @method _tutorial_updateHighlight
     * @description 更新高亮框和遮罩状态。
     * noOverlay 为 true 时完全禁用遮罩，让玩家能直接操作游戏。
     * @private
     */
    _tutorial_updateHighlight(step) {
        const highlight = this._tutorialHighlightEl;
        const overlay = this._tutorialOverlayEl;
        if (!highlight) return;

        // noOverlay 步骤：完全隐藏遮罩和高亮框
        if (step.noOverlay) {
            highlight.style.display = 'none';
            if (overlay) {
                overlay.style.background = 'transparent';
                overlay.style.pointerEvents = 'none';
            }
            return;
        }

        const selector = step.highlightSelector || (step.targetId ? `#${step.targetId}` : null);
        const targetEl = selector ? document.querySelector(selector) : null;

        if (!targetEl) {
            highlight.style.display = 'none';
            if (overlay) {
                overlay.style.background = 'rgba(2, 6, 23, 0.75)';
                overlay.style.pointerEvents = 'none';
            }
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const padding = 8;
        highlight.style.display = 'block';
        highlight.style.left = `${rect.left - padding}px`;
        highlight.style.top = `${rect.top - padding}px`;
        highlight.style.width = `${rect.width + padding * 2}px`;
        highlight.style.height = `${rect.height + padding * 2}px`;

        // 高亮框自带 box-shadow 遮罩效果，overlay 设为透明
        if (overlay) {
            overlay.style.background = 'transparent';
            overlay.style.pointerEvents = 'none';
        }
    },

    /**
     * @method _tutorial_positionCard
     * @description 定位教程卡片。
     * 支持 position: 'bottom-fixed'，将卡片固定在屏幕底部中央，
     * 适用于遗物选择、研磨阶段等需要玩家操作整个屏幕的步骤。
     * @private
     */
    _tutorial_positionCard(step) {
        const card = this._tutorialCardEl;
        if (!card) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardWidth = Math.min(340, vw * 0.9);

        // 重置
        card.style.left = '';
        card.style.right = '';
        card.style.top = '';
        card.style.bottom = '';
        card.style.transform = '';

        // 固定在屏幕底部中央（遗物选择、研磨阶段使用）
        if (step.position === 'bottom-fixed') {
            card.style.left = `${(vw - cardWidth) / 2}px`;
            card.style.bottom = '16px';
            return;
        }

        // 居中
        if (step.position === 'center') {
            card.style.left = `${(vw - cardWidth) / 2}px`;
            card.style.top = `${(vh - 320) / 2}px`;
            return;
        }

        const selector = step.highlightSelector || (step.targetId ? `#${step.targetId}` : null);
        const targetEl = selector ? document.querySelector(selector) : null;

        if (!targetEl) {
            card.style.left = `${(vw - cardWidth) / 2}px`;
            card.style.top = `${(vh - 320) / 2}px`;
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const cardLeft = Math.max(8, Math.min(rect.left, vw - cardWidth - 8));

        if (step.position === 'bottom') {
            const topPos = rect.bottom + 16;
            if (topPos + 320 > vh) {
                card.style.left = `${cardLeft}px`;
                card.style.top = `${Math.max(8, rect.top - 340)}px`;
            } else {
                card.style.left = `${cardLeft}px`;
                card.style.top = `${topPos}px`;
            }
        } else if (step.position === 'top') {
            const topPos = rect.top - 340;
            if (topPos < 8) {
                card.style.left = `${cardLeft}px`;
                card.style.top = `${rect.bottom + 16}px`;
            } else {
                card.style.left = `${cardLeft}px`;
                card.style.top = `${topPos}px`;
            }
        } else {
            card.style.left = `${(vw - cardWidth) / 2}px`;
            card.style.top = `${(vh - 320) / 2}px`;
        }
    },

    /**
     * @method _tutorial_registerWaitEvent
     * @description 注册等待 EventBus 事件的监听器。
     * @private
     */
    _tutorial_isStandardSelectionPhase() {
        return !window.game || typeof game.ui_isFateMomentPhase !== 'function' || !game.ui_isFateMomentPhase();
    },

    _tutorial_registerWaitEvent(step) {
        const unsubscribe = eventBus.on(step.waitForEvent, (data) => {
            if (step.waitForEventFilter && !step.waitForEventFilter(data)) return;

            unsubscribe();
            this._tutorialUnsubscribers = this._tutorialUnsubscribers.filter(fn => fn !== unsubscribe);

            if (step.autoAdvance) {
                setTimeout(() => {
                    if (this._tutorialActive) this.tutorial_nextStep();
                }, 600);
            } else {
                const nextBtn = document.getElementById('tutorial-next-btn');
                if (nextBtn) {
                    nextBtn.textContent = '下一步 →';
                    nextBtn.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
                    nextBtn.style.color = '#0f172a';
                    nextBtn.style.display = 'inline-block';
                    nextBtn.onclick = () => this.tutorial_nextStep();
                }
            }
        });
        this._tutorialUnsubscribers.push(unsubscribe);
    },

    /**
     * @method _tutorial_cleanupListeners
     * @private
     */
    _tutorial_cleanupListeners() {
        this._tutorialUnsubscribers.forEach(fn => {
            try { fn(); } catch (e) { /* ignore */ }
        });
        this._tutorialUnsubscribers = [];
    },

};
