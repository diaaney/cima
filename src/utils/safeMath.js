const ALLOWED = /^[\s0-9+\-*/×÷()]+$/;

function evaluateExpression(raw) {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (!ALLOWED.test(trimmed)) return null;
    if (/^[\d\s]+$/.test(trimmed)) return null; // pure number with no operators

    const normalized = trimmed.replace(/×/g, '*').replace(/÷/g, '/');

    try {
        const fn = new Function(`"use strict"; return (${normalized});`);
        const result = fn();
        if (typeof result !== 'number' || !Number.isFinite(result)) return null;
        if (!Number.isInteger(result)) return null;
        return result;
    } catch {
        return null;
    }
}

function isPureInteger(raw) {
    if (typeof raw !== 'string') return false;
    const trimmed = raw.trim();
    if (!trimmed) return false;
    if (!/^-?\d+$/.test(trimmed)) return false;
    return true;
}

module.exports = {
    evaluateExpression,
    isPureInteger,
};
