const test = require('node:test');
const assert = require('node:assert/strict');

const { rankCounting, rankChat } = require('../src/utils/leaderboards');
const { isIdleDue } = require('../src/events/countingIdle');

test('counting top ranks by accepted numbers, while level top ranks by XP', () => {
    assert.deepEqual(rankCounting({
        a: { numbers_counted: 2, total_count: 100 },
        b: { numbers_counted: 3, total_count: 6 },
    }).map(entry => entry.id), ['b', 'a']);
    assert.deepEqual(rankChat({ a: { xp: 20 }, b: { xp: 40 } }).map(entry => entry.id), ['b', 'a']);
});

test('counting idle notice is due once after three minutes and re-arms on a new count', () => {
    const state = { channel_id: 'channel', current_number: 42, last_count_at: 1000, idle_announced_for: null };
    assert.equal(isIdleDue(state, 180999), false);
    assert.equal(isIdleDue(state, 181000), true);
    state.idle_announced_for = state.last_count_at;
    assert.equal(isIdleDue(state, 500000), false);
    state.last_count_at = 500000;
    state.current_number = 43;
    assert.equal(isIdleDue(state, 680000), true);
    state.current_number = 0;
    assert.equal(isIdleDue(state, 900000), false);
});
