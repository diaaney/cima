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
    assert.deepEqual(levels.RANKS.map(rank => rank.level), [0, 2, 5, 8, 14, 20, 26, 32]);
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

    assert.equal(first.profile.level, 5);
    assert.equal(first.profile.xp, levels.xpForLevel(5) + 20);
    assert.equal(blocked.awarded, false);
    assert.equal(second.profile.xp, levels.xpForLevel(5) + 40);
});

test('ten accepted counting numbers grant one message worth of XP independently of chat cooldown', () => {
    const member = memberWithRoles([levels.RANKS[0].id]);
    for (let number = 1; number < 10; number++) {
        const result = levels.awardCountingNumber('guild', 'counter', member);
        assert.equal(result.awarded, false);
        assert.equal(result.profile.xp, 0);
    }

    const tenth = levels.awardCountingNumber('guild', 'counter', member);
    assert.equal(tenth.awarded, true);
    assert.equal(tenth.profile.xp, levels.XP_PER_MESSAGE);
    assert.equal(tenth.profile.countingNumbers, 10);

    const chat = levels.awardMessage('guild', 'counter', member, 100_000);
    assert.equal(chat.awarded, true);
    assert.equal(chat.profile.xp, levels.XP_PER_MESSAGE * 2);
    assert.equal(chat.profile.countingNumbers, 10);

    for (let number = 11; number <= 20; number++) levels.awardCountingNumber('guild', 'counter', member);
    const profile = levels.getProfile('guild', 'counter', member);
    assert.equal(profile.xp, levels.XP_PER_MESSAGE * 3);
    assert.equal(profile.countingNumbers, 20);
});

test('boosters earn triple XP from chat and each ten accepted counting numbers', () => {
    const member = memberWithRoles([levels.RANKS[0].id, levels.BOOSTER_ROLE_ID]);
    const first = levels.awardMessage('guild', 'boosting-student', member, 100_000);
    const blocked = levels.awardMessage('guild', 'boosting-student', member, 130_000);
    assert.equal(first.profile.xp, 60);
    assert.equal(blocked.profile.xp, 60);

    for (let number = 1; number <= 10; number++) {
        levels.awardCountingNumber('guild', 'boosting-student', member);
    }
    assert.equal(levels.getProfile('guild', 'boosting-student').xp, 120);
    assert.equal(levels.xpForMember(member), 60);
});

test('the visible UABC server tag earns double XP in chat and counting', () => {
    const member = memberWithRoles([levels.RANKS[0].id]);
    member.user = { primaryGuild: {
        identityEnabled: true,
        identityGuildId: '1512970933399195658',
        tag: 'UABC',
    } };
    assert.equal(levels.xpForMember(member), 40);
    levels.awardMessage('guild', 'tagged-student', member, 100_000);
    for (let number = 1; number <= 10; number++) {
        levels.awardCountingNumber('guild', 'tagged-student', member);
    }
    assert.equal(levels.getProfile('guild', 'tagged-student').xp, 80);
});

test('booster and tag bonuses do not stack, and a hidden or foreign tag earns no bonus', () => {
    const member = memberWithRoles([levels.RANKS[0].id]);
    member.user = { primaryGuild: {
        identityEnabled: false,
        identityGuildId: '1512970933399195658',
        tag: 'UABC',
    } };
    assert.equal(levels.xpForMember(member), 20);
    member.user.primaryGuild.identityEnabled = true;
    member.user.primaryGuild.identityGuildId = 'other-server';
    assert.equal(levels.xpForMember(member), 20);
    member.user.primaryGuild.identityGuildId = '1512970933399195658';
    member.roleIds.add(levels.BOOSTER_ROLE_ID);
    assert.equal(levels.xpForMember(member), 60);
});

test('rank synchronization keeps Booster and unrelated roles', async () => {
    const booster = 'booster';
    const unrelated = 'unrelated';
    const member = memberWithRoles([levels.RANKS[4].id, booster, unrelated]);
    const result = await levels.synchronizeRank(member, 20);

    assert.deepEqual(member.calls, [
        `add:${levels.RANKS[5].id}`,
        `remove:${levels.RANKS[4].id}`,
    ]);
    assert.equal(result.target.name, 'Cimarrón Veterano');
    assert.equal(member.roleIds.has(booster), true);
    assert.equal(member.roleIds.has(unrelated), true);
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
