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
 *   position: string,              // 卡片位置**偏好**：'top' | 'bottom' | 'center' | 'bottom-fixed' | 'narrow-safe'
 *                                  //   有高亮目标 / keepOutSelectors 时偏好可被推翻，见 _tutorial_positionCard
 *   keepOutSelectors: string[],    // 本步要求玩家点击、卡片绝不允许盖住的控件（可多选；无高亮框的步骤用它）
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
    // 高亮「開始練成」按鈕。position 只是**偏好**（优先贴底），实际落位由 _tutorial_positionCard 按
    // 目标矩形避让决定：硬贴底在 1280×800 会把按钮压住 54px、1254×700 直接整颗盖掉（B-1）。
    {
        id: 'start_run',
        phase: 'meta',
        targetId: null,
        highlightSelector: 'button[onclick="game.meta_startRun()"]',
        title: '开始一局游戏',
        content: `
            <p>点击高亮的「<strong>開始練成</strong>」按鈕，开始新的一局冒险。</p>
            <p class="mt-2">每一局都是独立的旅程，你需要收集弹珠、击败敌人。</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 直接点击高亮按鈕，教程自动继续</p>
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
        // [REQ-20261022-wave-loop S1] 遗物选完后直接进入每波挖掘（gathering），不再经过弹珠选择。
        waitForEventFilter: (data) => data && data.to === 'gathering',
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 3a 步：挖掘阶段 — 两批弹珠是什么 ───────────────────────────────────
    // [ux-20261025 P0-2] 原来挖掘说明是一张 5 段卡片，375 宽下高 435px，把批次按钮
    //   （y≈580–607）压在自己底下。拆成 3a/3b 两张：3a 只讲「两批是什么」，玩家自己翻页；
    //   3b 只讲「怎么发」，等挖完自动走。两张都按窄屏安全区定位（见 _tutorial_positionCard）。
    // noOverlay: true → 不遮挡，玩家可以先自己看钉板
    {
        id: 'dig_batches',
        phase: 'gathering',
        targetId: null,
        highlightSelector: null,
        title: '挖掘阶段 — 两批弹珠',
        content: `
            <p>每一波先挖一次，共<strong>两次发射</strong>，先发哪批由你决定。</p>
            <p class="mt-2">⚡ <strong>采集 ×5</strong>：5 颗弹珠从同一位置落下，每碰一次钉子得<strong>能量</strong>。</p>
            <p class="mt-2">🧪 <strong>炼成弹珠</strong>：只有它拾取钉子属性（最多 3 种 × 3 级），落地炼成 1 发<strong>炼成弹</strong>。</p>
        `,
        position: 'narrow-safe',    // 窄屏：贴在批次按钮上方，不压按钮
        narrowAnchor: 'above-dock',
        narrowDock: '.dig-launch-toggle',
        noOverlay: true,
        waitForEvent: null,         // 玩家自己点「下一步」翻页
        autoAdvance: false,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 3b 步：挖掘阶段 — 怎么发射 ─────────────────────────────────────────
    // 保留 id 'gathering_intro'：tests/validate_build_loop_s2.mjs:281 用它锚定「挖掘 → 整备」
    {
        id: 'gathering_intro',
        phase: 'gathering',
        targetId: null,
        highlightSelector: null,
        title: '挖掘阶段 — 怎么发射',
        content: `
            <p>先点<strong>右下角</strong>的按钮选好要发的那一批，再点<strong>钉板上方区域</strong>发射。</p>
            <p class="mt-2">两批都落定后进入<strong>整备</strong>。</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 战斗中点弹匣里的炼成弹，可把下一发主炮换成它。</p>
        `,
        position: 'narrow-safe',    // 窄屏：贴在投放区下沿，不压批次按钮
        narrowAnchor: 'below-launch',
        narrowDock: '.dig-launch-toggle',
        showLaunchGuide: true,      // 画出「点这里投放」的虚线投放区
        noOverlay: true,            // 取消遮罩，让玩家能操作
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        // [REQ-20261022-wave-loop S2] 挖完先进整备，不再直接进战斗
        waitForEventFilter: (data) => data && data.to === 'build',
        autoAdvance: true,
        actionLabel: null,          // 纯等待玩家投入弹珠
        actionFn: null,
    },
    // ── 第 3.5 步：整备阶段说明 ───────────────────────────────────────────────
    // [REQ-20261022-wave-loop S2] 高亮「开战」按钮；不遮罩，玩家可以先买再开战
    {
        id: 'build_intro',
        phase: 'build',
        targetId: null,
        highlightSelector: '#build-fight-btn',
        title: '整备阶段',
        content: `
            <p>挖到的<strong>能量 ⚡</strong>在这里花：升级主炮（伤害 / 射速 / 弹道）、建造设施、买道具。</p>
            <p class="mt-2">第 1 波只开放<strong>伤害轨</strong>，之后每波解锁新东西。没有时间限制。</p>
            <p class="mt-2">准备好后点<strong>「开战」</strong>。</p>
        `,
        position: 'top',
        // [ux-20261025 P0-2] 窄屏：卡片贴在「开战」按钮上方，不压开战
        narrowAnchor: 'above-dock',
        narrowDock: '#build-fight-btn',
        // [教程卡片避让高亮目标] 整备屏这两步都要求玩家点「开战」/选弹药配方，
        // 卡片一律不许压它们（build_facility 没有高亮框，靠这份清单兜住）。
        keepOutSelectors: ['#build-fight-btn', '#build-ammo button[data-recipe]'],
        noOverlay: true,
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => data && data.to === 'combat',
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 4 步：战斗阶段 ─────────────────────────────────────────────────────
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
            <p class="mt-2 text-amber-300/80 text-xs">💡 拖拽方向决定发射角度；没清完不算输，别让敌人越过底线</p>
            <p class="mt-1 text-red-300/80 text-xs">⚠️ 若敌人到达底部，游戏结束！</p>
        `,
        position: 'bottom-fixed',
        // [ux-20261025 P0-2] 窄屏：贴在战斗底部操作区上方，不压弹匣/发射器
        narrowAnchor: 'above-dock',
        narrowDock: '#combat-bottom-dock',
        noOverlay: true,
        waitForEvent: EVENT_TYPES.UI_AMMO_FIRED,
        waitForEventFilter: null,
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 4.5 步：击杀 → 掉料 ───────────────────────────────────────────────
    // [ux-20261025 P0-3] 教程原来在第一发子弹后就收尾，把「料从哪来」整段留空。
    // 这一步等第一次击杀（COMBAT_ENEMY_KILLED）才推进。
    {
        id: 'combat_kill',
        phase: 'combat',
        targetId: null,
        highlightSelector: null,
        title: '击杀 → 掉料',
        content: `
            <p>打倒的敌人会<strong>掉落材料</strong>：火料 / 冰料 / 兽料，三种<strong>互不通用</strong>。</p>
            <p class="mt-2">料只有两个去处：<strong>造弹</strong>（每发都扣料）和<strong>造设施</strong>。</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 这一波打完就进入下一波的挖掘，没清完不算输。</p>
        `,
        position: 'narrow-safe',
        narrowAnchor: 'above-dock',
        narrowDock: '#combat-bottom-dock',
        noOverlay: true,
        // [爽游模式] 教程专属排期/刷怪分支到此为止：与旧版「第一发子弹后清旗标」同一时刻，
        // 保证 spawn_system / boss_schedule_utils 的 _isTutorialRun 分支不越界（第 2 波不会再被
        // 强制排成一只大 Boss）。教学本身继续，改用 _isTutorialBuffRun 承接爽游通关窗口。
        clearTutorialRunFlag: true,
        waitForEvent: EVENT_TYPES.COMBAT_ENEMY_KILLED,
        waitForEventFilter: null,
        autoAdvance: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 4.6 步：第 2 波整备 — 建造一座设施（教程收尾条件）──────────────────
    // [ux-20261025 P0-3] 先隐藏卡片，等真正进到「第 2 波整备」再显示（preWaitEvent）。
    // 收尾判据二选一：①真的建了一座设施（轮询 facilities）；②直接点开战进第 2 波（waitForEvent）。
    {
        id: 'build_facility',
        phase: 'build',
        targetId: null,
        highlightSelector: null,
        title: '第 2 波整备 — 建造一座设施',
        content: `
            <p>整备屏里<strong>能量 ⚡</strong>用来升级主炮，<strong>料</strong>用来造设施。</p>
            <p class="mt-2">点设施卡上的<strong>建造</strong>：造好<strong>这一波就生效</strong>，不用等下一波。</p>
            <p class="mt-2 text-amber-300/80 text-xs">💡 造完（或直接开战）教程就结束了，后面自己玩。</p>
        `,
        position: 'narrow-safe',
        narrowAnchor: 'above-dock',
        narrowDock: '#build-fight-btn',
        // [教程卡片避让高亮目标] 整备屏这两步都要求玩家点「开战」/选弹药配方，
        // 卡片一律不许压它们（build_facility 没有高亮框，靠这份清单兜住）。
        keepOutSelectors: ['#build-fight-btn', '#build-ammo button[data-recipe]'],
        noOverlay: true,
        // 进到第 2 波整备才显示
        preWaitEvent: EVENT_TYPES.PHASE_CHANGED,
        preWaitFilter: (data) => !!(data && data.to === 'build' && (window.game ? window.game.round : 0) >= 2),
        // 走人（进入第 2 波战斗）也算完成，避免卡片盖在战斗屏上
        waitForEvent: EVENT_TYPES.PHASE_CHANGED,
        waitForEventFilter: (data) => !!(data && data.to === 'combat'),
        waitEndsTutorial: true,
        autoAdvance: true,
        // 建造成功没有事件（build_system.sys_buildPurchase 成功分支只回 {ok:true}），
        // 因此在教程侧轮询 facilities 是否已有设施 —— 不改 build_system。
        watchFacilities: true,
        actionLabel: null,
        actionFn: null,
    },
    // ── 第 5 步：教程完成 ─────────────────────────────────────────────────────
    // [ux-20261025 P0-3] 完成卡延到「第 2 波整备」。玩家点开战进第 2 波时自动收尾，
    // 不让完成卡跟着盖到战斗屏上。
    {
        id: 'tutorial_complete',
        phase: null,
        targetId: null,
        highlightSelector: null,
        title: '教程完成！',
        content: `
            <p>你已掌握《回声炼金师》的基础循环：<strong>挖 → 整备 → 守</strong>。</p>
            <p class="mt-2">后面每一波都重复这套；敌人越靠下越危险，尽量在它们到底之前清掉。</p>
            <p class="mt-3 text-amber-400 font-bold text-center">祝你炼金愉快！⚗️</p>
        `,
        position: 'center',
        noOverlay: false,
        // 进第 2 波战斗即自动收尾（玩家没点完成卡也不会挡住战斗屏）
        autoEndEvent: EVENT_TYPES.PHASE_CHANGED,
        autoEndFilter: (data) => !!(data && data.to === 'combat'),
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
    _tutorialTimers: [],
    _tutorialStepToken: 0,
    _tutorialRunWatchInstalled: false,
    // [ux-20261025 P0-3] 与 _isTutorialRun 拆开的「爽游通关窗口」旗标（见 tutorial_end 注释）
    _isTutorialBuffRun: false,
    _tutorialOverlayEl: null,
    _tutorialCardEl: null,
    _tutorialHighlightEl: null,
    // [教程卡片避让高亮目标] 视口尺寸变化后重算落位（卡片定位是「视口高度相关」的）
    _tutorialResizeHandler: null,
    _tutorialResizeRaf: null,

    // ==================== 公开 API ====================

    /**
     * @method tutorial_checkAndStart
     * @description 检查是否需要触发新手教程（首次游玩时自动调用）。
     */
    tutorial_checkAndStart() {
        // [ux-20261025 P0-3] 无论这次要不要起教程，都得先挂上「局作用域」监听：
        // 它决定新开的一局算不算爽游局（见 _tutorial_installRunScopeWatcher）。
        this._tutorial_installRunScopeWatcher();
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
        // [ux-20261025 P0-3] 与 _isTutorialRun 拆开的第二个旗标（见 tutorial_end 注释）
        this._isTutorialBuffRun = true;
        this._tutorial_installRunScopeWatcher();
        this._tutorial_createDOM();
        this._tutorial_showStep(0);
    },

    /**
     * @method _tutorial_installRunScopeWatcher
     * @description [ux-20261025 P0-3] 局作用域判定：新一局从 meta 进「遗物选择」时，
     * 只有教程正在进行的那一局才算爽游局（_isTutorialBuffRun）。这样：
     *   ① 教程局整局保留「第 6 回合爽游通关」窗口（不再因教程收尾而丢失）；
     *   ② 同一页面里后来开的普通局不会继承上一局的爽游通关资格。
     * 只装一次；不改 game_system.js 的 sys_resetGame（跨写不受权，见交回报告）。
     */
    _tutorial_installRunScopeWatcher() {
        if (this._tutorialRunWatchInstalled) return;
        this._tutorialRunWatchInstalled = true;
        eventBus.on(EVENT_TYPES.PHASE_CHANGED, (data) => {
            if (!data || data.to !== 'relic') return;   // 新一局只会从遗物选择开始
            this._isTutorialBuffRun = this._tutorialActive === true;
        });
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
        // [爽游模式] 教程结束即清旗标：爽游待遇只属于「正在看教程」的玩家。
        // 若不清，整局都会被当成教程局，第 2 波会被强制排入大 Boss（排期错误，玩家打不死）。
        this._isTutorialRun = false;
        // 注：此处清旗标不会与 tutorial_start() 冲突 —— 其首行会先走本方法清成 false，
        // 随后立刻由 tutorial_start 重新置 true，净效果不变。
        //
        // [ux-20261025 P0-3] 旗标已按职责拆分，这里是两个旗标的分工：
        //   _isTutorialRun     = 「本局套用教程专属排期 / 刷怪 / 钉子分支」（spawn_system.js、
        //                        utils/boss_schedule_utils.js 共 7 处读取点）。
        //                        教程一离开第 1 波战斗就清（见 combat_kill 步的 clearTutorialRunFlag），
        //                        时刻与旧版「第一发子弹后 tutorial_end」完全一致 —— 排期行为不变。
        //   _isTutorialBuffRun = 「本局有第 6 回合爽游通关窗口」（game_phase.js 的回合结算读它）。
        //                        教程收尾不再清它，因此「爽游通关」画面重新可达；
        //                        它由 _tutorial_installRunScopeWatcher 在新一局开始时重新判定。
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
                        font-size: 12px; color: rgba(148,163,184,0.7);
                        background: none; border: none; cursor: pointer; padding: 0 10px;
                        min-width: 44px; min-height: 44px;
                        display: inline-flex; align-items: center; justify-content: center;
                        border-radius: 8px; transition: color 0.2s;
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
                        padding: 0 18px; border-radius: 8px; font-size: 13px; font-weight: 700;
                        min-height: 44px; min-width: 44px;
                        display: inline-flex; align-items: center; justify-content: center;
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
        this._tutorial_installResizeReposition();
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
        if (this._tutorialResizeRaf) {
            cancelAnimationFrame(this._tutorialResizeRaf);
            this._tutorialResizeRaf = null;
        }
        if (this._tutorialResizeHandler) {
            window.removeEventListener('resize', this._tutorialResizeHandler);
            this._tutorialResizeHandler = null;
        }
        this._tutorialOverlayEl = null;
        this._tutorialHighlightEl = null;
        this._tutorialCardEl = null;
    },

    /**
     * @method _tutorial_showStep
     * @param {number} index
     * @param {{preSatisfied?: boolean}} [opts]
     * @private
     */
    _tutorial_showStep(index, opts = {}) {
        this._tutorialStepIndex = index;
        const step = TUTORIAL_STEPS[index];
        if (!step) return;

        this._tutorial_cleanupListeners();
        // 每一步一个 token：事件 + 轮询可能同时命中，靠它保证「同一步只推进一次」
        this._tutorialStepToken = (this._tutorialStepToken || 0) + 1;
        // 移除上一步可能残留的钉盘引导框
        const oldGuide = document.getElementById('tutorial-launch-guide');
        if (oldGuide) oldGuide.remove();

        // [爽游模式] 教程专属排期/刷怪分支到这一步为止（见 tutorial_end 的旗标分工注释）
        if (step.clearTutorialRunFlag) {
            this._isTutorialRun = false;
        }

        // [ux-20261025 P0-3] 有些步骤要「先等一个事件，到了才露卡片」：
        // 例如「第 2 波整备」不能在玩家还在第 1 波战斗时就弹出来讲建造。
        if (step.preWaitEvent && !opts.preSatisfied) {
            const card = this._tutorialCardEl;
            if (card) card.style.display = 'none';
            const unsubscribe = eventBus.on(step.preWaitEvent, (data) => {
                if (step.preWaitFilter && !step.preWaitFilter(data)) return;
                unsubscribe();
                this._tutorialUnsubscribers = this._tutorialUnsubscribers.filter(fn => fn !== unsubscribe);
                if (!this._tutorialActive || this._tutorialStepIndex !== index) return;
                this._tutorial_showStep(index, { preSatisfied: true });
            });
            this._tutorialUnsubscribers.push(unsubscribe);
            return;
        }

        const card = this._tutorialCardEl;
        if (card) card.style.display = 'block';

        this._tutorial_updateCard(step, index);
        this._tutorial_updateHighlight(step);
        this._tutorial_positionCard(step);

        // 研磨阶段引导：在钉盘顶部创建点击引导框
        if (step.showLaunchGuide || step.id === 'gathering_intro') {
            this._tutorial_createLaunchGuide();
        }

        if (step.waitForEvent) {
            this._tutorial_registerWaitEvent(step);
        }
        // 收尾型步骤：这个事件一到就直接结束教程（不是「下一步」）
        if (step.autoEndEvent) {
            this._tutorial_registerAutoEnd(step);
        }
        // 建造成功没有 EventBus 事件（build_system.sys_buildPurchase 成功分支只回 {ok:true}），
        // 教程侧轮询 facilities 判「建了一座设施」。
        if (step.watchFacilities) {
            this._tutorial_watchFacilityBuilt(step);
        }
    },

    /**
     * @method _tutorial_registerAutoEnd
     * @description 收尾型步骤：事件命中后直接 tutorial_end(true)。
     * @private
     */
    _tutorial_registerAutoEnd(step) {
        const unsubscribe = eventBus.on(step.autoEndEvent, (data) => {
            if (step.autoEndFilter && !step.autoEndFilter(data)) return;
            unsubscribe();
            this._tutorialUnsubscribers = this._tutorialUnsubscribers.filter(fn => fn !== unsubscribe);
            if (!this._tutorialActive) return;
            this.tutorial_end(true);
        });
        this._tutorialUnsubscribers.push(unsubscribe);
    },

    /**
     * @method _tutorial_watchFacilityBuilt
     * @description 轮询 game.facilities，已有任意一座设施即前进（成功建造无事件可用）。
     * @private
     */
    _tutorial_watchFacilityBuilt(step) {
        const token = this._tutorialStepToken;
        const timer = setInterval(() => {
            if (!this._tutorialActive || token !== this._tutorialStepToken) {
                clearInterval(timer);
                return;
            }
            const list = (window.game && Array.isArray(window.game.facilities)) ? window.game.facilities : [];
            if (!list.some(Boolean)) return;
            clearInterval(timer);
            this._tutorialAdvanceFrom(step, token);
        }, 400);
        this._tutorialTimers.push(timer);
    },

    /**
     * @method _tutorialAdvanceFrom
     * @description 统一推进入口：同一步骤只生效一次（事件 / 轮询共用）。
     * @private
     */
    _tutorialAdvanceFrom(step, token) {
        if (!this._tutorialActive) return;
        if (token !== this._tutorialStepToken) return;
        this._tutorialStepToken++;   // 吃掉本次 token，后续重复触发一律无效
        if (!step.autoAdvance) {
            const nextBtn = document.getElementById('tutorial-next-btn');
            if (nextBtn) {
                nextBtn.textContent = '下一步 →';
                nextBtn.style.background = 'linear-gradient(135deg, #d97706, #f59e0b)';
                nextBtn.style.color = '#0f172a';
                nextBtn.style.display = 'inline-block';
                nextBtn.onclick = () => this.tutorial_nextStep();
            }
            return;
        }
        setTimeout(() => {
            if (this._tutorialActive) this.tutorial_nextStep();
        }, 600);
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
     * @method _tutorial_applyCardMetrics
     * @description [ux-20261025 P0-2] 窄屏压缩卡片自身占位（内边距 / 字号 / 行高），
     * 让卡片能塞进「投放区」与「批次按钮」之间的空隙，而不是压住控件。
     * 触控目标不压缩：跳过/下一步仍 ≥44×44。
     * @private
     */
    _tutorial_applyCardMetrics() {
        const card = this._tutorialCardEl;
        if (!card) return;
        const compact = window.innerWidth <= 430;
        const titleEl = document.getElementById('tutorial-title');
        const contentEl = document.getElementById('tutorial-content');
        const indicator = document.getElementById('tutorial-step-indicator');

        card.style.padding = compact ? '12px 14px' : '20px';
        card.style.borderRadius = compact ? '14px' : '16px';
        if (titleEl) {
            titleEl.style.fontSize = compact ? '15px' : '16px';
            titleEl.style.marginBottom = compact ? '6px' : '10px';
            titleEl.style.lineHeight = compact ? '1.35' : '1.4';
        }
        if (contentEl) {
            contentEl.style.fontSize = compact ? '12px' : '13px';
            contentEl.style.lineHeight = compact ? '1.5' : '1.7';
        }
        if (indicator) indicator.style.fontSize = compact ? '9px' : '10px';
    },

    /**
     * @method _tutorial_positionCard
     * @description 定位教程卡片。
     * 两条优先级：
     *   ① 本步有「卡片不许压的东西」（高亮目标 / keepOutSelectors）→ 走 _tutorial_placeCardAvoiding，
     *      position 降级为偏好；卡片**永不覆盖当前步骤要求玩家点击的控件**。
     *   ② 没有禁压区 → 沿用旧语义（'bottom-fixed' 贴底 / 'center' 居中 / 窄屏 narrowAnchor / 'top'、'bottom'）。
     * @private
     */
    _tutorial_positionCard(step) {
        const card = this._tutorialCardEl;
        if (!card) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardWidth = Math.min(340, vw * 0.9);

        // 窄屏先压缩卡片自身占位，再按控件避让定位
        this._tutorial_applyCardMetrics();

        // 重置（含高度限制：上一步可能为了塞进窄缝压过正文并开了内部滚动）
        card.style.left = '';
        card.style.right = '';
        card.style.top = '';
        card.style.bottom = '';
        card.style.transform = '';
        card.style.width = '';
        this._tutorial_resetCardHeight();

        // [教程卡片避让高亮目标] 有禁压区就先避让：硬贴底 / 硬居中都会在「视口高度」变化时压住目标
        // （1280×800 压按钮 54px、1254×700 整颗盖掉），所以落位必须按实测矩形算，不能靠固定偏移。
        if (this._tutorial_placeCardAvoiding(step, card, vw, vh, cardWidth)) return;

        // [ux-20261025 P0-2] 窄屏专属排法：375 宽下列表/按钮全在屏幕下半，
        // 「居中 + 底对齐」的卡片必然压住玩家要点的控件，所以改为按控件避让。
        if (vw <= 430 && step.narrowAnchor) {
            this._tutorial_positionCardNarrow(step, card, vw, vh, cardWidth);
            return;
        }

        // 固定在屏幕底部中央（遗物选择、研磨阶段使用；这些步骤没有禁压区）
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
     * @method _tutorial_installResizeReposition
     * @description [教程卡片避让高亮目标] 落位是「视口尺寸相关」的：窗口一改（含 700↔800 切换、旋转屏），
     * 上一帧算好的位置可能正好压住目标。resize 后按当前步骤重算一次（rAF 合并连续抖动）。
     * @private
     */
    _tutorial_installResizeReposition() {
        if (this._tutorialResizeHandler) return;
        this._tutorialResizeHandler = () => {
            if (!this._tutorialActive) return;
            if (this._tutorialResizeRaf) return;
            this._tutorialResizeRaf = requestAnimationFrame(() => {
                this._tutorialResizeRaf = null;
                const step = TUTORIAL_STEPS[this._tutorialStepIndex];
                if (!step || !this._tutorialCardEl) return;
                this._tutorial_updateHighlight(step);
                this._tutorial_positionCard(step);
            });
        };
        window.addEventListener('resize', this._tutorialResizeHandler);
    },

    /**
     * @method _tutorial_getHighlightTarget
     * @description 取当前步骤的高亮目标元素；不存在 / 没有实测尺寸时返回 null。
     * @private
     */
    _tutorial_getHighlightTarget(step) {
        const selector = step.highlightSelector || (step.targetId ? `#${step.targetId}` : null);
        if (!selector) return null;
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return (rect.width > 0 && rect.height > 0) ? el : null;
    },

    /**
     * @method _tutorial_collectKeepouts
     * @description 收集「卡片绝不允许压住」的矩形。两类来源：
     *   ① 当前步骤的高亮目标（highlightSelector / targetId）——压住它，玩家就点不到教程让他点的东西；
     *   ② 步骤显式声明的 keepOutSelectors——没有高亮框、但同属本步要求玩家点击的控件
     *      （例：整备屏的「开战」与三条弹药配方）。
     * 只收实测宽高 > 0 的元素：display:none 的占位不参与，否则会把卡片挤到屏幕外。
     * @private
     */
    _tutorial_collectKeepouts(step) {
        const out = [];
        const push = (label, el) => {
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (!(rect.width > 0 && rect.height > 0)) return;
            out.push({ label, rect });
        };
        push('highlight', this._tutorial_getHighlightTarget(step));
        const selectors = Array.isArray(step.keepOutSelectors) ? step.keepOutSelectors : [];
        selectors.forEach((sel) => {
            let list = [];
            try { list = Array.from(document.querySelectorAll(sel)); } catch (e) { list = []; }
            list.forEach((el, idx) => push(`${sel}#${idx}`, el));
        });
        return out;
    },

    /**
     * @method _tutorial_rectsOverlap
     * @description 两矩形是否真重叠（贴边不算重叠）。
     * @private
     */
    _tutorial_rectsOverlap(a, b) {
        return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0
            && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0;
    },

    /**
     * @method _tutorial_resetCardHeight
     * @description 清掉上一步留下的高度限制，恢复卡片自然高度。
     * @private
     */
    _tutorial_resetCardHeight() {
        const card = this._tutorialCardEl;
        if (!card) return;
        card.style.maxHeight = '';
        card.style.overflowY = '';
        const contentEl = document.getElementById('tutorial-content');
        if (contentEl) {
            contentEl.style.maxHeight = '';
            contentEl.style.overflowY = '';
            contentEl.style.paddingRight = '';
        }
    },

    /**
     * @method _tutorial_limitCardHeight
     * @description [教程卡片避让高亮目标] 上下都塞不下整张卡片时，把卡片压进可用高度，
     * 并让**正文区**内部滚动——标题、跳过、下一步始终可见。
     * 明确不做：缩字号糊过去、干脆不显示卡片。
     * @param {number} availableH 允许的卡片最大高度（px）
     * @returns {number} 压缩后的实测卡片高度
     * @private
     */
    _tutorial_limitCardHeight(availableH) {
        const card = this._tutorialCardEl;
        if (!card) return 0;
        this._tutorial_resetCardHeight();
        const naturalH = card.getBoundingClientRect().height;
        const limit = Math.max(120, Math.floor(availableH));
        if (naturalH <= limit) return naturalH;

        const contentEl = document.getElementById('tutorial-content');
        const contentH = contentEl ? contentEl.getBoundingClientRect().height : 0;
        const chromeH = naturalH - contentH;          // 步骤行 / 进度条 / 按钮行 / 内边距
        const contentRoom = limit - chromeH;
        card.style.maxHeight = `${limit}px`;
        if (contentH > 0 && contentRoom >= 72) {
            contentEl.style.maxHeight = `${Math.floor(contentRoom)}px`;
            contentEl.style.overflowY = 'auto';
            contentEl.style.paddingRight = '6px';     // 给滚动条让位，避免压字
        } else {
            card.style.overflowY = 'auto';
        }
        return card.getBoundingClientRect().height;
    },

    /**
     * @method _tutorial_placeCardAvoiding
     * @description [教程卡片避让高亮目标] 按实测矩形落位，保证卡片不覆盖本步要求玩家点击的控件。
     * 顺序：
     *   ① 目标在下半屏 ⇒ 放上方；目标在上半屏 ⇒ 放下方（与任务定义一致）；上下都塞得下才用自然高度；
     *   ② 上下都不够 → 退到目标左右两侧空白；
     *   ③ 侧边也没有（窄屏必然如此）→ 贴到不重叠的一侧，把卡片压进那一侧可用高度，正文内部滚动；
     *   ④ 最后兜底：取上下空间较大的一侧，压到该侧可用量（宁压内容不压目标）。
     * @returns {boolean} true = 已落位；false = 本步没有禁压区 / 卡片当前不可量，交回既有分支
     * @private
     */
    _tutorial_placeCardAvoiding(step, card, vw, vh, cardWidth) {
        const keepouts = this._tutorial_collectKeepouts(step);
        if (!keepouts.length) return false;

        const GAP = 16;       // 卡片与目标之间的间距
        const MARGIN = 8;     // 视口安全边距
        const rects = keepouts.map(k => k.rect);
        const union = {
            left: Math.min(...rects.map(r => r.left)),
            top: Math.min(...rects.map(r => r.top)),
            right: Math.max(...rects.map(r => r.right)),
            bottom: Math.max(...rects.map(r => r.bottom)),
        };
        union.height = union.bottom - union.top;

        // 1) 先清掉上一步的压缩，再量自然高度（卡片隐藏时高度≈0，交回既有分支）
        this._tutorial_resetCardHeight();
        card.style.width = `${Math.min(cardWidth, vw - MARGIN * 2)}px`;
        const naturalH = card.getBoundingClientRect().height;
        if (naturalH < 20) return false;

        const w = Math.min(cardWidth, vw - MARGIN * 2);
        const clampLeft = (left) => Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
        const conflicts = (left, top, h) => {
            const probe = { left, top, right: left + w, bottom: top + h };
            return rects.some(r => this._tutorial_rectsOverlap(probe, r));
        };
        const inViewport = (left, top, h) =>
            left >= MARGIN - 0.5 && top >= MARGIN - 0.5
            && left + w <= vw - MARGIN + 0.5 && top + h <= vh - MARGIN + 0.5;
        const place = (left, top) => {
            card.style.left = `${Math.round(left)}px`;
            card.style.top = `${Math.round(top)}px`;
            card.style.right = '';
            card.style.bottom = '';
        };
        const candidateFor = (dir, h) => {
            if (dir === 'above') return { left: clampLeft(union.left), top: union.top - GAP - h };
            if (dir === 'below') return { left: clampLeft(union.left), top: union.bottom + GAP };
            if (dir === 'left') return { left: union.left - GAP - w, top: union.top };
            return { left: union.right + GAP, top: union.top };
        };

        // 2) 方向偏好：目标主体在下半屏 ⇒ 卡片放上方；在上半屏 ⇒ 放下方
        const targetMidY = union.top + union.height / 2;
        const DIRS = (targetMidY > vh / 2)
            ? ['above', 'below', 'right', 'left']
            : ['below', 'above', 'left', 'right'];

        // 3) 自然高度整张卡片
        for (const dir of DIRS) {
            const c = candidateFor(dir, naturalH);
            if (inViewport(c.left, c.top, naturalH) && !conflicts(c.left, c.top, naturalH)) {
                place(c.left, c.top);
                return true;
            }
        }

        // 4) 压进可用高度 + 正文内部滚动：可用空间从大到小择优
        const rooms = [
            { dir: 'above', room: union.top - GAP - MARGIN },
            { dir: 'below', room: vh - MARGIN - (union.bottom + GAP) },
        ].filter(s => s.room >= 150).sort((a, b) => b.room - a.room);
        for (const s of rooms) {
            const h = this._tutorial_limitCardHeight(s.room);
            const c = candidateFor(s.dir, h);
            if (inViewport(c.left, c.top, h) && !conflicts(c.left, c.top, h)) {
                place(c.left, c.top);
                return true;
            }
        }

        // 5) 兜底：上下空间较大的一侧，压到该侧可用量（宁压内容、不压目标）
        const aboveRoom = union.top - GAP - MARGIN;
        const belowRoom = vh - MARGIN - (union.bottom + GAP);
        const dir = aboveRoom >= belowRoom ? 'above' : 'below';
        const room = Math.max(120, Math.max(aboveRoom, belowRoom));
        const h = Math.min(this._tutorial_limitCardHeight(room), room);
        const c = candidateFor(dir, h);
        place(c.left, Math.max(MARGIN, Math.min(c.top, vh - MARGIN - h)));
        return true;
    },

    /**
     * @method _tutorial_positionCardNarrow
     * @description [ux-20261025 P0-2] 窄屏（≤430px）按控件避让定位卡片。
     * 两条锚法：
     *   - narrowAnchor: 'above-dock'  → 卡片底边贴在 narrowDock 控件上沿 8px（不压控件）
     *   - narrowAnchor: 'below-launch' → 卡片顶边贴在画布「上方 40% 投放区」下沿 8px
     * 最后统一夹回视口内；卡片高度按内容自适应，不做滚动容器。
     * @private
     */
    _tutorial_positionCardNarrow(step, card, vw, vh, cardWidth) {
        const canvas = document.querySelector('#gameCanvas');
        const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
        const launchBottom = canvasRect ? canvasRect.top + canvasRect.height * 0.4 : 0;
        const dock = step.narrowDock ? document.querySelector(step.narrowDock) : null;
        const dockRect = dock ? dock.getBoundingClientRect() : null;
        const dockTop = dockRect && dockRect.height > 0 ? dockRect.top : null;

        card.style.left = `${Math.max(8, (vw - cardWidth) / 2)}px`;
        card.style.width = `${Math.min(cardWidth, vw - 16)}px`;

        // 先按当前内容量高度（字体/内容已在 _tutorial_updateCard 落定）
        const cardH = card.getBoundingClientRect().height;
        const gap = 8;
        let top;

        if (step.narrowAnchor === 'below-launch') {
            top = launchBottom + gap;
            if (dockTop !== null && top + cardH > dockTop - gap) {
                // 放不下就退回到「控件上方」这一档，宁可少吃一点投放区
                top = dockTop - gap - cardH;
            }
        } else {
            top = dockTop !== null ? dockTop - gap - cardH : (vh - cardH) / 2;
        }

        top = Math.max(gap, Math.min(top, vh - gap - cardH));
        card.style.top = `${top}px`;
        card.style.bottom = '';
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
        const token = this._tutorialStepToken;
        const unsubscribe = eventBus.on(step.waitForEvent, (data) => {
            if (step.waitForEventFilter && !step.waitForEventFilter(data)) return;

            unsubscribe();
            this._tutorialUnsubscribers = this._tutorialUnsubscribers.filter(fn => fn !== unsubscribe);

            // [ux-20261025 P0-3] 「走人即收尾」型步骤：玩家没建造就直接开战也算教程结束，
            // 不让教程卡跟着盖到战斗屏上。
            if (step.waitEndsTutorial) {
                if (!this._tutorialActive || token !== this._tutorialStepToken) return;
                this._tutorialStepToken++;
                this.tutorial_end(true);
                return;
            }
            this._tutorialAdvanceFrom(step, token);
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
        // [ux-20261025 P0-3] 轮询计时器与监听器同生共死：切步骤/结束教程一律清掉
        (this._tutorialTimers || []).forEach(timer => {
            try { clearInterval(timer); } catch (e) { /* ignore */ }
        });
        this._tutorialTimers = [];
    },

};
