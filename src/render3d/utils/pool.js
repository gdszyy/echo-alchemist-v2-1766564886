/**
 * 对象池类 - 管理对象的重用，减少垃圾回收压力
 * 
 * 设计模式：
 * - 使用对象池模式（Object Pool Pattern）
 * - 支持泛型对象，通过工厂函数创建
 * - 自动调用对象的reset方法（如果存在）
 * 
 * 使用场景：
 * - 高频创建/销毁的对象（如子弹、粒子、Sprite等）
 * - 需要优化GC性能的场景
 * 
 * 使用示例：
 * ```javascript
 * // 创建对象池
 * const spritePool = new ObjectPool(
 *     () => new THREE.Sprite(),
 *     50  // 预创建50个对象
 * );
 * 
 * // 获取对象
 * const sprite = spritePool.acquire();
 * 
 * // 使用对象...
 * 
 * // 释放回池
 * spritePool.release(sprite);
 * ```
 */
export class ObjectPool {
    /**
     * 构造函数
     * @param {Function} factory - 用于创建新对象的工厂函数
     * @param {number} [initialSize=0] - 初始池大小（预创建对象数量）
     */
    constructor(factory, initialSize = 0) {
        this.factory = factory;
        this.pool = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * 从池中获取一个对象
     * 如果池为空，则动态创建一个新对象
     * @returns {*} 获取的对象
     */
    acquire() {
        return this.pool.length > 0 ? this.pool.pop() : this.factory();
    }

    /**
     * 将对象释放回池中以便重用
     * 如果对象有reset方法，会自动调用以重置状态
     * @param {*} obj - 要释放的对象
     */
    release(obj) {
        // 如果对象有 reset 方法，则调用它以重置状态
        if (obj && typeof obj.reset === 'function') {
            obj.reset();
        }
        this.pool.push(obj);
    }

    /**
     * 获取当前池中的对象数量
     * @returns {number} 池中可用对象数量
     */
    get size() {
        return this.pool.length;
    }

    /**
     * 清空对象池
     * 注意：此操作不会销毁对象，只是清空池的引用
     */
    clear() {
        this.pool = [];
    }
}
