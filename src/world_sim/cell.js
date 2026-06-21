// 世界变迁模拟器 - 单元格数据结构
// 移植自 world-morphing-simulator/client/src/lib/simulation/engine.ts（Cell / BioAttributes / CellType）
// 原 TS interface 在此转为 JSDoc typedef + 工厂函数，运行时行为不变。

/**
 * 晶石/单元格状态枚举。
 * EMPTY 无、ALPHA 绿色（吸能）、BETA 蓝色（储能）、BIO 生物聚落。
 * @readonly
 * @enum {string}
 */
export const CELL_TYPE = {
    EMPTY: 'EMPTY',
    ALPHA: 'ALPHA',
    BETA: 'BETA',
    BIO: 'BIO',
};

/**
 * @typedef {Object} BioAttributes 生物属性，定义物种的生存、繁衍、扩张行为参数。
 * @property {number} minTemp          适宜生存的最低温度
 * @property {number} maxTemp          适宜生存的最高温度
 * @property {number} survivalMinTemp  极限生存最低温度（低于此开始死亡）
 * @property {number} survivalMaxTemp  极限生存最高温度（高于此开始死亡）
 * @property {number} prosperityGrowth 繁荣度自然增长率（每帧）
 * @property {number} prosperityDecay  繁荣度自然衰减率（环境不适宜时）
 * @property {number} expansionThreshold 触发扩张所需的繁荣度阈值
 * @property {number} miningReward      开采 Beta 晶石获得的繁荣度奖励
 * @property {number} migrationThreshold 触发迁移所需的繁荣度阈值
 * @property {number} alphaRadiationDamage Alpha 辐射造成的伤害值
 * @property {number} crystalDamageReduction 晶石伤害减免比例（0..1）
 * @property {number} civilizationLevel  聚落文明程度（0..1），默认参与晶石伤害减免
 * @property {number} settlementSize     初始聚落占地规模参考值
 * @property {number} speciesId         种群唯一标识（0 为人类）
 * @property {string} color             种群显示颜色（Hex 或 hsl 字符串）
 */

/**
 * @typedef {Object} Migrant 迁徙生物，独立于晶石/聚落层，可与任何方块共存。
 * @property {number} prosperity
 * @property {BioAttributes} attributes
 * @property {{x:number,y:number}} [target]
 */

/**
 * @typedef {Object} Cell 地图单元格，含地幔/气候/晶石/生物四层状态。
 * @property {number} x
 * @property {number} y
 * @property {boolean} exists            该地块是否存在（true 陆地 / false 虚空）
 * @property {number} terrainElevation   地势高度（0..1，越高越接近高原/山脊）
 * @property {number} terrainSlope       与邻格的最大高度差，用于迁徙阻力与天气抬升
 * @property {number} terrainBasinDepth  低于周边平均高度的程度，用于盆地防守/滞留
 * @property {number} terrainMoveCost    综合通行代价缓存，用于迁徙与扩张决策
 * @property {number} mantleEnergy       地幔能量值，决定地形扩张与缩减
 * @property {number} mantleSourceStrength 持续局部地幔源井下限（0 表示无源井）
 * @property {number} expansionPotential 扩张潜力值（暂未使用）
 * @property {number} expansionAccumulator 扩张累积值
 * @property {number} shrinkAccumulator  缩减累积值
 * @property {number} temperature        当前地表温度
 * @property {number} baseTemperature    基础温度（受地幔能量与季节影响）
 * @property {number} temperatureChange  温度变化量（用于可视化）
 * @property {number} climatePotential   Weather potential used to drive persistent wind.
 * @property {number} windX              Persistent local wind x component.
 * @property {number} windY              Persistent local wind y component.
 * @property {number} verticalMotion     Uplift / sinking proxy used by storm logic.
 * @property {number} crystalClimateCharge Crystal-induced climate anomaly.
 * @property {boolean} hasThunderstorm   是否存在雷暴天气
 * @property {string} crystalState       晶石状态（见 CELL_TYPE）
 * @property {number} crystalEnergy      当前帧获得的能量（仅用于可视化）
 * @property {number} storedEnergy       内部存储的能量
 * @property {boolean} isAbsorbing       是否正在从地幔吸收能量（仅 Alpha）
 * @property {{x:number,y:number,amount:number}[]} energyFlow 能量流向记录（用于绘制连线）
 * @property {number} humanEnergyDrain   当前帧被人类基地抽取的地幔能量
 * @property {boolean} isEnergySiphoned  当前帧是否处在人类基地吸能影响中
 * @property {number} prosperity         生物聚落繁荣度（仅 BIO 有效）
 * @property {boolean} isMining          是否正在开采相邻 Beta 晶石
 * @property {number} betaMiningProgress Beta 晶石开采进度（0..1，文明越高增长越快）
 * @property {BioAttributes} [bioAttributes] 生物聚落属性（仅 BIO 有效）
 * @property {Migrant|null} [migrant]    迁徙生物
 */

/**
 * 创建一个单元格，未指定的字段使用模拟初始默认值。
 * @param {number} x
 * @param {number} y
 * @param {{exists?:boolean, mantleEnergy?:number, crystalState?:string, terrainElevation?:number}} [opts]
 * @returns {Cell}
 */
export function createCell(x, y, opts = {}) {
    const {
        exists = false,
        mantleEnergy = 0,
        crystalState = CELL_TYPE.EMPTY,
        terrainElevation = exists ? Math.max(0.05, Math.min(0.95, 0.32 + mantleEnergy / 260)) : 0,
    } = opts;
    return {
        x, y,
        exists,
        terrainElevation,
        terrainSlope: 0,
        terrainBasinDepth: 0,
        terrainMoveCost: 1,
        mantleEnergy,
        mantleSourceStrength: 0,
        expansionPotential: 0,
        expansionAccumulator: 0,
        shrinkAccumulator: 0,
        temperature: 0,
        baseTemperature: 0,
        temperatureChange: 0,
        climatePotential: 0,
        windX: 0,
        windY: 0,
        verticalMotion: 0,
        crystalClimateCharge: 0,
        hasThunderstorm: false,
        crystalState,
        crystalEnergy: 0,
        storedEnergy: 10.0,
        isAbsorbing: false,
        energyFlow: [],
        humanEnergyDrain: 0,
        isEnergySiphoned: false,
        prosperity: 0,
        isMining: false,
        betaMiningProgress: 0,
        migrant: null,
    };
}
