/**
 * render3d/constants.js - 3D渲染系统常量配置
 * 
 * 职责：
 * - 集中管理所有3D渲染相关的常量
 * - 避免魔法数字分散在代码中
 * - 便于统一调整和维护
 */

/**
 * 场景配置
 */
export const SCENE_CONFIG = {
    // 背景颜色
    BACKGROUND_COLOR: 0x1a1a2e,
    
    // 光照配置
    AMBIENT_LIGHT_INTENSITY: 0.6,
    DIRECTIONAL_LIGHT_INTENSITY: 0.8,
    DIRECTIONAL_LIGHT_POSITION: { x: 5, y: 10, z: 7.5 },
    
    // 雾效果配置
    FOG_NEAR: 10,
    FOG_FAR: 50
};

/**
 * 摄像机配置
 */
export const CAMERA_CONFIG = {
    // 默认FOV
    DEFAULT_FOV: 75,
    
    // 裁剪面
    NEAR_PLANE: 0.1,
    FAR_PLANE: 1000,
    
    // 过渡动画时长（秒）
    TRANSITION_DURATION: 1.5,
    
    // 平滑插值速度
    LERP_SPEED: 0.1
};

/**
 * 坐标转换配置
 */
export const COORDINATE_CONFIG = {
    // 默认画布尺寸
    DEFAULT_CANVAS_WIDTH: 800,
    DEFAULT_CANVAS_HEIGHT: 600,
    
    // 2D到3D的缩放比例
    WORLD_SCALE: 0.05,
    
    // 旧版缩放因子（用于兼容现有代码）
    LEGACY_SCALE_FACTOR: 50
};

/**
 * 高度层级常量
 * 定义了3D场景中不同类型物体所在的Z轴高度
 */
export const HEIGHT_LAYERS = {
    BACKGROUND: -5,
    FLOOR: 0,
    ENEMY: 1,
    PLAYER: 1,
    PROJECTILE: 2,
    EFFECT: 3,
    UI: 5
};

/**
 * 元素颜色映射表
 * 用于子弹、粒子等元素的颜色配置
 */
export const ELEMENT_COLORS = {
    // 默认颜色
    DEFAULT: 0x00ff88,
    
    // 元素颜色
    PYRO: 0xff6b35,      // 火焰橙
    CRYO: 0x06b6d4,      // 冰霜青
    LIGHTNING: 0xfbbf24, // 闪电黄
    WIND: 0x34d399,      // 风绿
    LASER: 0xec4899,     // 激光粉
    
    // 敌人类型颜色
    ENEMY_NORMAL: 0x475569,  // 普通敌人 - 灰色
    ENEMY_ELITE: 0x581c87,   // 精英敌人 - 紫色
    ENEMY_BOSS: 0x7f1d1d,    // Boss - 深红色
    
    // 温度颜色
    TEMP_HOT: 0xea580c,      // 高温 - 橙红色
    TEMP_COLD: 0x0891b2      // 低温 - 青蓝色
};

/**
 * 动画配置
 */
export const ANIMATION_CONFIG = {
    // 敌人动画
    ENEMY_SPAWN_DURATION: 0.5,      // 生成动画时长（秒）
    ENEMY_DEATH_DURATION: 0.67,     // 死亡动画时长（秒）
    ENEMY_HIT_FLASH_DURATION: 0.3,  // 受击闪烁时长（秒）
    ENEMY_HIT_FLASH_FREQUENCY: 20,  // 受击闪烁频率
    
    // 粒子动画
    PARTICLE_FADE_SPEED: 0.02,      // 粒子淡出速度
    
    // 旋转速度
    PROJECTILE_ROTATION_SPEED: 0.1  // 子弹自旋速度
};

/**
 * 性能配置
 */
export const PERFORMANCE_CONFIG = {
    // 对象池初始大小
    SPRITE_POOL_INITIAL_SIZE: 100,
    
    // 最大粒子数量
    MAX_PARTICLES: 10000,
    
    // 纹理缓存大小限制
    TEXTURE_CACHE_MAX_SIZE: 256
};

/**
 * 调试配置
 */
export const DEBUG_CONFIG = {
    // 网格辅助线配置
    GRID_SIZE: 20,
    GRID_DIVISIONS: 20,
    GRID_COLOR_CENTER: 0x444444,
    GRID_COLOR_GRID: 0x222222,
    
    // 坐标轴辅助大小
    AXES_SIZE: 5
};

/**
 * 材质配置
 */
export const MATERIAL_CONFIG = {
    // 标准材质默认参数
    DEFAULT_METALNESS: 0.3,
    DEFAULT_ROUGHNESS: 0.4,
    
    // 发光强度
    DEFAULT_EMISSIVE_INTENSITY: 0.5,
    
    // 透明度
    MIN_OPACITY: 0.3,
    MAX_OPACITY: 1.0
};
