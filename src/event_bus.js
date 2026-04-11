/**
 * event_bus.js - 轻量级事件总线
 * 
 * 职责：
 * - 提供发布/订阅模式的事件通信机制
 * - 解耦子系统之间的直接依赖
 * - 支持事件命名空间（如 'phase:change', 'damage:dealt'）
 * 
 * 公共接口：
 * - on(event, handler)   — 订阅事件
 * - off(event, handler)  — 取消订阅
 * - once(event, handler) — 订阅一次性事件
 * - emit(event, data)    — 触发事件
 * 
 * 设计原则：
 * 1. 零依赖，纯 ES Module
 * 2. 支持通配符 '*' 监听所有事件（用于调试）
 * 3. handler 异常不影响其他 handler 执行
 * 4. 提供事件历史记录（可选，用于调试）
 */

export const EVENT_TYPES = {
    // 阶段类事件
    PHASE_CHANGED: 'phase:change',
    WAVE_ADVANCED: 'wave:advance',

    // 战斗类事件
    COMBAT_DAMAGE_DEALT: 'damage:dealt',
    COMBAT_ENEMY_KILLED: 'enemy:killed',
    COMBAT_AMMO_FIRED: 'combat:ammo_fired',
    COMBAT_HIT_PROGRESS: 'combat:hit_progress',
    COMBAT_RUNE_CHARGE: 'combat:rune_charge',
    COMBAT_EFFECT_TRIGGER: 'combat:effect_trigger',

    // UI 类事件
    UI_HUD_UPDATE: 'ui:hud_update',
    UI_SHOP_UPDATE: 'ui:shop_update',
    UI_RUNE_UPDATE: 'ui:rune_update',

    // 战斗 UI 事件（Task 3.2：业务层 -> UI 层）
    UI_MULTICAST_UPDATE: 'ui:multicast_update',         // 更新连射倍率显示
    UI_MULTICAST_TRANSFER: 'ui:multicast_transfer',     // 播放倍率转移飞行特效
    UI_HIT_PROGRESS: 'ui:hit_progress',                // 更新命中进度条
    UI_AMMO_FIRED: 'ui:ammo_fired',                    // 弹药发射（触发动画+更新UI）
    UI_RUNE_CHARGE_INIT: 'ui:rune_charge_init',        // 初始化充能符文UI
    UI_RUNE_CHARGE_LEVEL_UP: 'ui:rune_charge_level_up', // 充能等级提升
    UI_RUNE_CHARGE_UPDATE: 'ui:rune_charge_update',    // 更新充能条
    UI_RUNE_CHARGE_BADGE: 'ui:rune_charge_badge',      // 显示翻倍徽章
    UI_CHROMATIC_ABERRATION: 'ui:chromatic_aberration', // CRT 色差特效
    UI_COMBAT_MESSAGE: 'ui:combat_message',            // 战斗消息文本
    UI_ROUND_NUM_UPDATE: 'ui:round_num_update',        // 更新回合数显示
    UI_FLASH_EFFECT: 'ui:flash_effect',                // 全屏闪光特效

    // 元数据类事件
    META_CURRENCY_CHANGED: 'meta:currency_changed',
    META_INVENTORY_CHANGED: 'meta:inventory_changed',
    META_RELIC_ACQUIRED: 'meta:relic_acquired',

    // 系统类事件
    SYSTEM_AUDIO_READY: 'audio:ready',
    SYSTEM_ERROR: 'system:error'
};

class EventBus {
    constructor(options = {}) {
        /** @type {Map<string, Set<Function>>} 事件 -> 处理函数集合 */
        this._listeners = new Map();

        /** @type {boolean} 是否启用调试模式 */
        this._debug = options.debug || false;

        /** @type {Array} 事件历史（调试模式下记录） */
        this._history = [];

        /** @type {number} 历史记录最大长度 */
        this._maxHistory = options.maxHistory || 100;
    }

    /**
     * 订阅事件
     * @param {string} event - 事件名称，支持命名空间（如 'phase:change'）
     * @param {Function} handler - 事件处理函数，接收 (data, event) 参数
     * @returns {Function} 取消订阅的函数（便于清理）
     */
    on(event, handler) {
        if (typeof handler !== 'function') {
            console.warn(`[EventBus] on('${event}'): handler is not a function`);
            return () => {};
        }
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(handler);

        // 返回取消订阅函数
        return () => this.off(event, handler);
    }

    /**
     * 取消订阅
     * @param {string} event - 事件名称
     * @param {Function} handler - 要移除的处理函数
     */
    off(event, handler) {
        const handlers = this._listeners.get(event);
        if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this._listeners.delete(event);
            }
        }
    }

    /**
     * 订阅一次性事件（触发一次后自动取消）
     * @param {string} event - 事件名称
     * @param {Function} handler - 事件处理函数
     * @returns {Function} 取消订阅的函数
     */
    once(event, handler) {
        const wrapper = (data, eventName) => {
            this.off(event, wrapper);
            handler(data, eventName);
        };
        wrapper._originalHandler = handler;
        return this.on(event, wrapper);
    }

    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit(event, data) {
        if (this._debug) {
            console.log(`[EventBus] emit('${event}')`, data);
            this._recordHistory(event, data);
        }

        // 触发精确匹配的 handler
        const handlers = this._listeners.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data, event);
                } catch (err) {
                    console.error(`[EventBus] Error in handler for '${event}':`, err);
                }
            }
        }

        // 触发通配符 '*' 监听器（用于调试/日志）
        if (event !== '*') {
            const wildcardHandlers = this._listeners.get('*');
            if (wildcardHandlers) {
                for (const handler of wildcardHandlers) {
                    try {
                        handler(data, event);
                    } catch (err) {
                        console.error(`[EventBus] Error in wildcard handler for '${event}':`, err);
                    }
                }
            }
        }
    }

    /**
     * 检查事件是否有监听器
     * @param {string} event - 事件名称
     * @returns {boolean}
     */
    hasListeners(event) {
        const handlers = this._listeners.get(event);
        return handlers ? handlers.size > 0 : false;
    }

    /**
     * 获取事件的监听器数量
     * @param {string} event - 事件名称
     * @returns {number}
     */
    listenerCount(event) {
        const handlers = this._listeners.get(event);
        return handlers ? handlers.size : 0;
    }

    /**
     * 移除某个事件的所有监听器，或移除所有事件的所有监听器
     * @param {string} [event] - 事件名称（不传则清除所有）
     */
    removeAllListeners(event) {
        if (event) {
            this._listeners.delete(event);
        } else {
            this._listeners.clear();
        }
    }

    /**
     * 获取事件历史记录（调试用）
     * @returns {Array}
     */
    getHistory() {
        return [...this._history];
    }

    /**
     * 清除事件历史
     */
    clearHistory() {
        this._history = [];
    }

    /**
     * 记录事件到历史
     * @private
     */
    _recordHistory(event, data) {
        this._history.push({
            event,
            data,
            timestamp: performance.now()
        });
        // 限制历史长度
        if (this._history.length > this._maxHistory) {
            this._history.shift();
        }
    }

    /**
     * 启用/禁用调试模式
     * @param {boolean} enabled
     */
    setDebug(enabled) {
        this._debug = enabled;
        if (!enabled) {
            this._history = [];
        }
    }
}

// ==================== 全局事件总线实例 ====================
// 单例模式：整个游戏共享一个事件总线
const eventBus = new EventBus();

// 为了兼容现有的直接导入
export { EventBus, eventBus };
