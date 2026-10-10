const crypto = require('crypto');

const BOOSTER_TYPES = [
    { type: '+25', value: 25, weight: 4 },
    { type: '+50', value: 50, weight: 3 },
    { type: '+100', value: 100, weight: 2 },
    { type: '+200', value: 200, weight: 1 },
    { type: 'x2', value: 2, weight: 3 },
    { type: 'x3', value: 3, weight: 1 },
];

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let r = Math.random() * totalWeight;
    for (const item of items) {
        if (r < item.weight) return item;
        r -= item.weight;
    }
    return items[0];
}

function buildOperation() {
    const variant = Math.floor(Math.random() * 4);
    let a, b, c, expression, answer;

    if (variant === 0) {
        // (a±b)×c
        a = rand(2, 25);
        b = rand(2, 25);
        c = rand(2, 9);
        if (Math.random() < 0.5) {
            expression = `(${a}+${b})×${c}`;
            answer = (a + b) * c;
        } else {
            if (a < b) [a, b] = [b, a];
            expression = `(${a}-${b})×${c}`;
            answer = (a - b) * c;
        }
    } else if (variant === 1) {
        // a±(b×c)
        a = rand(20, 200);
        b = rand(2, 12);
        c = rand(2, 9);
        if (Math.random() < 0.5 && a > b * c) {
            expression = `${a}-(${b}×${c})`;
            answer = a - b * c;
        } else {
            expression = `${a}+(${b}×${c})`;
            answer = a + b * c;
        }
    } else if (variant === 2) {
        // (a×b)±c
        a = rand(2, 15);
        b = rand(2, 9);
        c = rand(5, 50);
        if (Math.random() < 0.5 && a * b > c) {
            expression = `(${a}×${b})-${c}`;
            answer = a * b - c;
        } else {
            expression = `(${a}×${b})+${c}`;
            answer = a * b + c;
        }
    } else {
        // (a+b)÷c, exact
        c = rand(2, 9);
        const result = rand(3, 30);
        const total = result * c;
        a = rand(1, total - 1);
        b = total - a;
        expression = `(${a}+${b})÷${c}`;
        answer = result;
    }

    return { expression, answer };
}

function generateOperation(avoidResult) {
    for (let i = 0; i < 50; i++) {
        const op = buildOperation();
        if (op.answer >= 10 && op.answer <= 500 && op.answer !== avoidResult) {
            return op;
        }
    }
    return { expression: '(10+5)×2', answer: 30 };
}

function generateBooster(currentCount) {
    const nextCount = currentCount + 1;
    const op = generateOperation(nextCount);
    const boosterType = pickWeighted(BOOSTER_TYPES);
    return {
        id: crypto.randomUUID(),
        expression: op.expression,
        answer: op.answer,
        type: boosterType.type,
        value: boosterType.value,
    };
}

function applyBoost(currentCount, boosterType, value) {
    if (boosterType.startsWith('x')) {
        return currentCount * value;
    }
    if (boosterType.startsWith('+')) {
        return currentCount + value;
    }
    return currentCount;
}

module.exports = {
    generateOperation,
    generateBooster,
    applyBoost,
};
