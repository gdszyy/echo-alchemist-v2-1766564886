// 世界变迁模拟器 - 聚落规模辅助
// 纯读工具：统计同物种连续聚落大小，供生物层限制单个聚落占地。

import { CELL_TYPE } from './cell.js';

function isSameSpeciesBio(cell, speciesId) {
    return cell?.crystalState === CELL_TYPE.BIO &&
        cell.bioAttributes?.speciesId === speciesId;
}

function countConnectedSpecies(engine, starts, speciesId, limit) {
    const queue = [...starts];
    const seen = new Set(queue.map(c => `${c.x},${c.y}`));
    let count = 0;

    while (queue.length > 0 && count < limit) {
        const cell = queue.shift();
        if (!isSameSpeciesBio(cell, speciesId)) continue;

        count++;
        for (const n of engine.getNeighbors(cell.x, cell.y)) {
            const key = `${n.x},${n.y}`;
            if (!seen.has(key) && isSameSpeciesBio(n, speciesId)) {
                seen.add(key);
                queue.push(n);
            }
        }
    }

    return count;
}

export function getSettlementSize(engine, x, y, speciesId, limit = Infinity) {
    const cell = engine.grid[y]?.[x];
    if (!isSameSpeciesBio(cell, speciesId)) return 0;
    return countConnectedSpecies(engine, [cell], speciesId, limit);
}

export function getSmallSettlementFactor(engine, x, y, speciesId) {
    const smallSize = Math.max(1, engine.params.bioSmallSettlementSize ?? 3);
    const size = getSettlementSize(engine, x, y, speciesId, smallSize + 1);
    return size > 0 && size <= smallSize ? (smallSize - size + 1) / smallSize : 0;
}

export function isSettlementAtCapacity(engine, x, y, speciesId) {
    const maxSize = engine.params.bioMaxSettlementCells ?? Infinity;
    if (!Number.isFinite(maxSize) || maxSize <= 0) return false;
    return getSettlementSize(engine, x, y, speciesId, Math.floor(maxSize)) >= Math.floor(maxSize);
}

export function canSettleWithinLimit(engine, cell, speciesId) {
    const maxSize = engine.params.bioMaxSettlementCells ?? Infinity;
    if (!Number.isFinite(maxSize) || maxSize <= 0) return true;

    const starts = engine.getNeighbors(cell.x, cell.y).filter(n => isSameSpeciesBio(n, speciesId));
    if (starts.length === 0) return true;

    return countConnectedSpecies(engine, starts, speciesId, Math.floor(maxSize)) + 1 <= Math.floor(maxSize);
}
