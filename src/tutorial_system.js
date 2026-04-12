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
 * @module tutorial_system
 */

import { eventBus, EVENT_TYPES } from './event_bus.js';

// ==================== 教程步骤定义 ====================
/**
 * 每个步骤的结构：
 * {
 *   id: string,            // 步骤唯一标识
 *   phase: string,         // 需要处于的游戏阶段（用于步骤过滤）
 *   targetId: string|null, // 高亮目标元素的 DOM id（null 表示全屏遮罩）
 *   title: string,         // 步骤标题
 *   content: string,       // 步骤说明文本（支持 HTML）
 *   position: string,      // 提示卡片位置：'top' | 'bottom' | 'center'
 *   waitForEvent: string|null, // 等待某个 EventBus 事件后才允许继续（null 表示手动点击继续）
 *   autoAdvance: boolean,  // 事件触发后是否自动前进（否则等用户点击）
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
            <p class="mt-2 text-amber-300/80 text-xs">💡 随时可在设置中重播教程</p>
        `,
        position: 'center',
        waitForEvent: null,
        autoAdvance: false,
    },
    // ── 第 1 步：开始游戏按钮 ─────────────────────────────────────────────────
    {
        id: 'start_run',
        phase: 'meta',
        targetId: 'phase-meta',
        highlightSelector: 'button[onclick="game.meta_startRun()"]',
        title: '开始一局游戏',
        content: `
            <p>点击「<strong>開始煉成</strong>」按钮开始新的一局。</p>
            <p class="mt-2">每一局都是独立的冒险，你需要收集弹珠、击败敌人。</p>
        `,
        position: 'bottom',
        waitForEvent: null,
        autoAdvance: false,
    },
    // ── 第 2 步：遗物选择 ─────────────────────────────────────────────────────
    {
        id: 'relic_selection',
        phase: 'relic',
        targetId: null,
        title: '选择你的起始遗物',
        content: `
            <p><strong>遗物</strong>是强力的被动增益道具，将贯穿整局游戏。</p>
            <p class="mt-2">每个遗物都有独特的效果，请仔细阅读说明后做出选择。</p>
            <p class="mt-2 text-cyan-300/80 text-xs">💡 不同遗物组合可以产生强大的协同效果</p>
        `,
        position: 'top',
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'selection',
        autoAdvance: true,
    },
    // ── 第 3 步：弹珠选择 ─────────────────────────────────────────────────────
    {
        id: 'marble_selection',
        phase: 'selection',
        targetId: 'phase-selection',
        highlightSelector: '#marble-selection-grid',
        title: '选择你的弹珠',
        content: `
            <p><strong>弹珠</strong>是你的主要攻击单位，每种弹珠有独特的属性和技能。</p>
            <p class="mt-2">你需要选择 <strong>3 枚弹珠</strong>组成本局的弹药库。</p>
            <p class="mt-2 text-cyan-300/80 text-xs">💡 点击弹珠可预览详细属性，再次点击选中</p>
        `,
        position: 'bottom',
        waitForEvent: null,
        autoAdvance: false,
    },
    // ── 第 4 步：确认选择 ─────────────────────────────────────────────────────
    {
        id: 'confirm_selection',
        phase: 'selection',
        targetId: 'phase-selection',
        highlightSelector: '#confirm-selection-btn',
        title: '确认选择，开始研磨！',
        content: `
            <p>选好 3 枚弹珠后，点击「<strong>開始煉金</strong>」进入研磨阶段。</p>
            <p class="mt-2">研磨阶段是收集魔力、触发连锁效果的核心环节。</p>
        `,
        position: 'top',
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'gathering',
        autoAdvance: true,
    },
    // ── 第 5 步：研磨阶段说明 ─────────────────────────────────────────────────
    {
        id: 'gathering_intro',
        phase: 'gathering',
        targetId: null,
        title: '研磨阶段',
        content: `
            <p>点击屏幕上方区域，<strong>释放弹珠</strong>让它在钉盘中弹跳。</p>
            <p class="mt-2">弹珠碰到不同颜色的钉子会触发不同效果：</p>
            <ul class="mt-1 text-sm space-y-1">
                <li>⚪ <strong>白色钉</strong>：基础伤害</li>
                <li>🔵 <strong>反弹钉</strong>：弹珠加速反弹</li>
                <li>🔴 <strong>伤害钉</strong>：额外伤害加成</li>
            </ul>
        `,
        position: 'center',
        waitForEvent: null,
        autoAdvance: false,
    },
    // ── 第 6 步：命中进度条 ───────────────────────────────────────────────────
    {
        id: 'hit_progress',
        phase: 'gathering',
        targetId: 'phase-gathering',
        highlightSelector: '#hit-bar-container',
        title: '命中进度条',
        content: `
            <p>底部的<strong>命中进度条</strong>记录弹珠触碰钉子的次数。</p>
            <p class="mt-2">当进度条满格时，会触发一次<strong>战斗回合</strong>，向敌人发动攻击！</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 尽量让弹珠多碰钉子来快速积累进度</p>
        `,
        position: 'top',
        waitForEvent: null,
        autoAdvance: false,
    },
    // ── 第 7 步：进入战斗 ─────────────────────────────────────────────────────
    {
        id: 'combat_intro',
        phase: 'combat',
        targetId: null,
        title: '战斗阶段',
        content: `
            <p>进度条满后自动进入<strong>战斗阶段</strong>！</p>
            <p class="mt-2">你积累的伤害将对敌人造成攻击。消灭所有敌人后进入下一回合。</p>
            <p class="mt-2 text-red-300/80 text-xs">⚠️ 若敌人到达底部，游戏结束！</p>
        `,
        position: 'center',
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'gathering',
        autoAdvance: true,
    },
    // ── 第 8 步：技能点 ───────────────────────────────────────────────────────
    {
        id: 'skill_points',
        phase: 'gathering',
        targetId: 'phase-gathering',
        highlightSelector: '#sp-panel',
        title: '技能点（SP）',
        content: `
            <p>顶部的绿色宝石是<strong>技能点（SP）</strong>。</p>
            <p class="mt-2">特殊钉子触发时会消耗 SP，释放强力技能效果。</p>
            <p class="mt-2 text-cyan-300/80 text-xs">💡 合理分配 SP 是取胜的关键</p>
        `,
        position: 'bottom',
        waitForEvent: null,
        autoAdvance: false,
    },
    // ── 第 9 步：教程完成 ─────────────────────────────────────────────────────
    {
        id: 'tutorial_complete',
        phase: null, // 任意阶段
        targetId: null,
        title: '教程完成！',
        content: `
            <p>你已掌握《回声炼金师》的基础玩法！</p>
            <p class="mt-2">继续探索更多遗物、符文词条和弹珠组合，解锁强大的协同效果。</p>
            <p class="mt-3 text-amber-400 font-bold text-center">祝你炼金愉快！⚗️</p>
        `,
        position: 'center',
        waitForEvent: null,
        autoAdvance: false,
    },
];

// ==================== 教程子系统 ====================
export const tutorial_system = {

    // ── 内部状态 ──────────────────────────────────────────────────────────────
    _tutorialActive: false,
    _tutorialStepIndex: 0,
    _tutorialUnsubscribers: [], // 存储 eventBus.on 返回的取消订阅函数
    _tutorialOverlayEl: null,
    _tutorialCardEl: null,
    _tutorialHighlightEl: null,

    // ==================== 公开 API ====================

    /**
     * @method tutorial_checkAndStart
     * @description 检查是否需要触发新手教程（首次游玩时自动调用）。
     * 在 sys_loadSaveData 之后调用。
     */
    tutorial_checkAndStart() {
        if (!this.saveData.tutorialCompleted) {
            // 延迟 800ms，等待主界面渲染完毕
            setTimeout(() => this.tutorial_start(), 800);
        }
    },

    /**
     * @method tutorial_start
     * @description 启动新手教程（从第 0 步开始）。
     * 可从设置面板手动调用以重播教程。
     */
    tutorial_start() {
        if (this._tutorialActive) this.tutorial_end(false);
        this._tutorialActive = true;
        this._tutorialStepIndex = 0;
        this._tutorial_createDOM();
        this._tutorial_showStep(0);
    },

    /**
     * @method tutorial_end
     * @description 结束教程，可选择是否标记为已完成。
     * @param {boolean} [markCompleted=true] - 是否写入 saveData.tutorialCompleted
     */
    tutorial_end(markCompleted = true) {
        this._tutorialActive = false;
        this._tutorial_cleanupListeners();
        this._tutorial_removeDOM();
        if (markCompleted) {
            this.saveData.tutorialCompleted = true;
            this.sys_saveData();
        }
    },

    /**
     * @method tutorial_nextStep
     * @description 前进到下一个教程步骤（由「下一步」按钮调用）。
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
     * @description 创建教程所需的 DOM 元素（遮罩 + 高亮框 + 卡片）。
     * @private
     */
    _tutorial_createDOM() {
        // 防止重复创建
        if (document.getElementById('tutorial-overlay')) return;

        // 1. 遮罩层（半透明背景）
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

        // 2. 高亮框（用于圈出目标元素）
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
                <!-- 顶部：步骤指示 + 跳过按钮 -->
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
                <!-- 步骤进度条 -->
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
                <!-- 标题 -->
                <h3 id="tutorial-title" style="
                    font-family: 'Cinzel', serif; font-size: 16px; font-weight: 700;
                    color: #fbbf24; margin-bottom: 10px; line-height: 1.4;
                "></h3>
                <!-- 内容 -->
                <div id="tutorial-content" style="
                    font-size: 13px; line-height: 1.7; color: #cbd5e1;
                "></div>
                <!-- 底部按钮区 -->
                <div style="display:flex; justify-content:flex-end; margin-top:18px; gap:8px;">
                    <button id="tutorial-prev-btn" onclick="game._tutorial_prevStep()" style="
                        display: none;
                        padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700;
                        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                        color: #94a3b8; cursor: pointer; transition: all 0.2s;
                        font-family: 'Noto Serif TC', serif;
                    " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                       onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        ← 上一步
                    </button>
                    <button id="tutorial-next-btn" onclick="game.tutorial_nextStep()" style="
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
     * @description 移除教程 DOM 元素。
     * @private
     */
    _tutorial_removeDOM() {
        ['tutorial-overlay', 'tutorial-highlight', 'tutorial-card'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        this._tutorialOverlayEl = null;
        this._tutorialHighlightEl = null;
        this._tutorialCardEl = null;
    },

    /**
     * @method _tutorial_showStep
     * @description 显示指定步骤的教程内容。
     * @param {number} index - 步骤索引
     * @private
     */
    _tutorial_showStep(index) {
        this._tutorialStepIndex = index;
        const step = TUTORIAL_STEPS[index];
        if (!step) return;

        // 清理上一步的事件监听
        this._tutorial_cleanupListeners();

        // 更新卡片内容
        this._tutorial_updateCard(step, index);

        // 更新高亮
        this._tutorial_updateHighlight(step);

        // 定位卡片
        this._tutorial_positionCard(step);

        // 注册等待事件（如有）
        if (step.waitForEvent) {
            this._tutorial_registerWaitEvent(step);
        }
    },

    /**
     * @method _tutorial_updateCard
     * @description 更新教程卡片的文字内容和进度。
     * @private
     */
    _tutorial_updateCard(step, index) {
        const card = this._tutorialCardEl;
        if (!card) return;

        const total = TUTORIAL_STEPS.length;
        const progress = ((index + 1) / total) * 100;
        const isLast = index === total - 1;
        const isFirst = index === 0;

        // 步骤指示
        const indicator = document.getElementById('tutorial-step-indicator');
        if (indicator) indicator.textContent = `Step ${index + 1} / ${total}`;

        // 进度条
        const progressBar = document.getElementById('tutorial-progress-bar');
        if (progressBar) progressBar.style.width = `${progress}%`;

        // 标题
        const titleEl = document.getElementById('tutorial-title');
        if (titleEl) titleEl.textContent = step.title;

        // 内容
        const contentEl = document.getElementById('tutorial-content');
        if (contentEl) contentEl.innerHTML = step.content;

        // 上一步按钮
        const prevBtn = document.getElementById('tutorial-prev-btn');
        if (prevBtn) prevBtn.style.display = isFirst ? 'none' : 'inline-block';

        // 下一步按钮文字
        const nextBtn = document.getElementById('tutorial-next-btn');
        if (nextBtn) {
            if (isLast) {
                nextBtn.textContent = '开始游戏 🎮';
                nextBtn.style.background = 'linear-gradient(135deg, #059669, #10b981)';
            } else if (step.waitForEvent && !step.autoAdvance) {
                nextBtn.textContent = '下一步 →';
                nextBtn.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
            } else if (step.waitForEvent) {
                // 等待游戏事件自动前进，禁用按钮
                nextBtn.textContent = '请按游戏提示操作...';
                nextBtn.style.background = 'rgba(255,255,255,0.1)';
                nextBtn.style.color = '#94a3b8';
                nextBtn.onclick = null;
            } else {
                nextBtn.textContent = '下一步 →';
                nextBtn.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
                nextBtn.style.color = '#0f172a';
                nextBtn.onclick = () => this.tutorial_nextStep();
            }
        }
    },

    /**
     * @method _tutorial_updateHighlight
     * @description 更新高亮框位置，圈出目标 DOM 元素。
     * @private
     */
    _tutorial_updateHighlight(step) {
        const highlight = this._tutorialHighlightEl;
        if (!highlight) return;

        // 优先使用 highlightSelector，其次使用 targetId
        const selector = step.highlightSelector || (step.targetId ? `#${step.targetId}` : null);
        const targetEl = selector ? document.querySelector(selector) : null;

        if (!targetEl) {
            highlight.style.display = 'none';
            // 全屏遮罩模式：显示半透明背景
            if (this._tutorialOverlayEl) {
                this._tutorialOverlayEl.style.pointerEvents = 'none';
                this._tutorialOverlayEl.style.background = 'rgba(2, 6, 23, 0.75)';
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

        // 遮罩层透明（高亮框自带 box-shadow 遮罩效果）
        if (this._tutorialOverlayEl) {
            this._tutorialOverlayEl.style.background = 'transparent';
        }
    },

    /**
     * @method _tutorial_positionCard
     * @description 根据步骤配置定位教程卡片。
     * @private
     */
    _tutorial_positionCard(step) {
        const card = this._tutorialCardEl;
        if (!card) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardWidth = Math.min(340, vw * 0.9);

        // 重置位置
        card.style.left = '';
        card.style.right = '';
        card.style.top = '';
        card.style.bottom = '';
        card.style.transform = '';

        const selector = step.highlightSelector || (step.targetId ? `#${step.targetId}` : null);
        const targetEl = selector ? document.querySelector(selector) : null;

        if (!targetEl || step.position === 'center') {
            // 居中显示
            card.style.left = `${(vw - cardWidth) / 2}px`;
            card.style.top = `${(vh - 300) / 2}px`;
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const cardLeft = Math.max(8, Math.min(rect.left, vw - cardWidth - 8));

        if (step.position === 'bottom') {
            const topPos = rect.bottom + 16;
            if (topPos + 300 > vh) {
                // 空间不足，改为上方
                card.style.left = `${cardLeft}px`;
                card.style.top = `${Math.max(8, rect.top - 320)}px`;
            } else {
                card.style.left = `${cardLeft}px`;
                card.style.top = `${topPos}px`;
            }
        } else if (step.position === 'top') {
            const topPos = rect.top - 320;
            if (topPos < 8) {
                // 空间不足，改为下方
                card.style.left = `${cardLeft}px`;
                card.style.top = `${rect.bottom + 16}px`;
            } else {
                card.style.left = `${cardLeft}px`;
                card.style.top = `${topPos}px`;
            }
        } else {
            card.style.left = `${(vw - cardWidth) / 2}px`;
            card.style.top = `${(vh - 300) / 2}px`;
        }
    },

    /**
     * @method _tutorial_registerWaitEvent
     * @description 注册等待特定 EventBus 事件的监听器，事件触发后自动前进。
     * @private
     */
    _tutorial_registerWaitEvent(step) {
        const unsubscribe = eventBus.on(step.waitForEvent, (data) => {
            // 如果有过滤条件，检查是否满足
            if (step.waitForEventFilter && !step.waitForEventFilter(data)) return;

            // 清理监听
            unsubscribe();
            this._tutorialUnsubscribers = this._tutorialUnsubscribers.filter(fn => fn !== unsubscribe);

            if (step.autoAdvance) {
                // 自动前进到下一步（延迟 600ms 让用户看到阶段切换动画）
                setTimeout(() => {
                    if (this._tutorialActive) this.tutorial_nextStep();
                }, 600);
            } else {
                // 恢复「下一步」按钮
                const nextBtn = document.getElementById('tutorial-next-btn');
                if (nextBtn) {
                    nextBtn.textContent = '下一步 →';
                    nextBtn.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
                    nextBtn.style.color = '#0f172a';
                    nextBtn.onclick = () => this.tutorial_nextStep();
                }
            }
        });
        this._tutorialUnsubscribers.push(unsubscribe);
    },

    /**
     * @method _tutorial_cleanupListeners
     * @description 清理所有已注册的 EventBus 监听器。
     * @private
     */
    _tutorial_cleanupListeners() {
        this._tutorialUnsubscribers.forEach(fn => {
            try { fn(); } catch (e) { /* ignore */ }
        });
        this._tutorialUnsubscribers = [];
    },

    /**
     * @method _tutorial_prevStep
     * @description 返回上一个教程步骤。
     * @private
     */
    _tutorial_prevStep() {
        if (!this._tutorialActive || this._tutorialStepIndex <= 0) return;
        this._tutorial_showStep(this._tutorialStepIndex - 1);
    },
};
