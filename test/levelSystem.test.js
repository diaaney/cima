const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-levels-'));
process.env.LEVEL_STORE_FILE = path.join(directory, 'levels.json');
process.env.ASPIRANTE_ROLE_ID = '1558422865085206648';
const levels = require('../src/utils/levelSystem');

function memberWithRoles(ids) {
    const roleIds = new Set(ids);
    const calls = [];
    return {
        roles: {
            cache: { has: id => roleIds.has(id) },
            add: async id => { calls.push(`add:${id}`); roleIds.add(id); },
            remove: async id => { calls.push(`remove:${id}`); roleIds.delete(id); },
        },
        roleIds,
        calls,
    };
}

test('level thresholds match the requested rank ladder', () => {
    assert.deepEqual(levels.RANKS.map(rank => rank.level), [0, 5, 10, 20, 30, 40, 50, 60]);
    for (const rank of levels.RANKS) {
        assert.equal(levels.rankForLevel(levels.levelFromXp(levels.xpForLevel(rank.level))).id, rank.id);
    }
    assert.equal(levels.rankForLevel(100).name, 'Leyenda Cimarrona');
});

test('messages earn XP once per minute and retain an existing rank as the starting level', () => {
    const member = memberWithRoles([levels.RANKS[2].id]);
    const first = levels.awardMessage('guild', 'student', member, 100_000);
    const blocked = levels.awardMessage('guild', 'student', member, 130_000);
    const second = levels.awardMessage('guild', 'student', member, 160_000);

    assert.equal(first.profile.level, 10);
    assert.equal(first.profile.xp, levels.xpForLevel(10) + 20);
    assert.equal(blocked.awarded, false);
    assert.equal(second.profile.xp, levels.xpForLevel(10) + 40);
});

test('rank synchronization keeps Booster and unrelated roles', async () => {
    const booster = 'booster';
    const unrelated = 'unrelated';
    const member = memberWithRoles([levels.RANKS[4].id, booster, unrelated]);
    const result = await levels.synchronizeRank(member, 40);

    assert.deepEqual(member.calls, [
        `add:${levels.RANKS[5].id}`,
        `remove:${levels.RANKS[4].id}`,
    ]);
    assert.equal(result.target.name, 'Cimarrón Veterano');
    assert.equal(member.roleIds.has(booster), true);
    assert.equal(member.roleIds.has(unrelated), true);
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
