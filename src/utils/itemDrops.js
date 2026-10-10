const crypto = require('crypto');

const ITEM_DEFS = [
    { type: 'streak_shield', emoji: '🛡', label: 'streak shield', weight: 4 },
    { type: 'perfect_aim',  emoji: '🎯', label: 'perfect aim',  weight: 2 },
    { type: 'oracle_eye',   emoji: '🔮', label: 'oracle eye',   weight: 2 },
    { type: 'sabotage',     emoji: '💣', label: 'sabotage',     weight: 3 },
];

const ITEM_DEFS_BY_TYPE = Object.fromEntries(ITEM_DEFS.map(i => [i.type, i]));

function pickWeighted(items) {
    const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of items) {
        if (r < item.weight) return item;
        r -= item.weight;
    }
    return items[0];
}

function generateDrop(operation) {
    const def = pickWeighted(ITEM_DEFS);
    return {
        id: crypto.randomUUID(),
        item_type: def.type,
        emoji: def.emoji,
        label: def.label,
        expression: operation.expression,
        answer: operation.answer,
    };
}

module.exports = {
    ITEM_DEFS,
    ITEM_DEFS_BY_TYPE,
    generateDrop,
};
