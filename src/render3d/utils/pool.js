/**
 * ObjectPool 类用于管理对象的重用，减少垃圾回收压力。
 * 支持泛型对象池，通过构造函数传入工厂函数。
 */
export class ObjectPool {
    /**
     * @param {Function} factory - 用于创建新对象的工厂函数
     * @param {number} [initialSize=0] - 初始池大小
     */
    constructor(factory, initialSize = 0) {
        this.factory = factory;
        this.pool = [];
        
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.factory());
        }
    }

    /**
     * 从池中获取一个对象。如果池为空，则创建一个新对象。
     * @returns {*} 获取的对象
     */
    acquire() {
        return this.pool.length > 0 ? this.pool.pop() : this.factory();
    }

    /**
     * 将对象释放回池中以便重用。
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
     * 获取当前池中的对象数量。
     * @returns {number}
     */
    get size() {
        return this.pool.length;
    }

    /**
     * 清空对象池。
     */
    clear() {
        this.pool = [];
    }
}
