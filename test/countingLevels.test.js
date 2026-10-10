const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-counting-levels-'));
process.env.LEVEL_STORE_FILE = path.join(directory, 'levels.json');
process.env.GUILD_ID = 'guild';
process.env.UNVERIFIED_ROLE_ID = 'unverified';
process.env.ASPIRANTE_ROLE_ID = 'aspirante';

const levels = require('../src/utils/levelSystem');

test('only accepted counting numbers advance each member toward the ten-number reward', async () => {
    const storagePath = require.resolve('../src/utils/storage');
    const handlerPath = require.resolve('../src/events/messageCreate');
    const originalStorage = require(storagePath);
    const count = { channel_id: 'counting', current_number: 0, last_user_id: null };
    require.cache[storagePath].exports = {
        ...originalStorage,
        isAfk: () => null,
        getReactMessage: () => null,
        getCountingConfig: () => count,
        getUserStats: () => ({ sabotaged: false }),
        updateCount: (_, number, userId) => {
            count.current_number = number;
            count.last_user_id = userId;
        },
        resetCount: () => {
            count.current_number = 0;
            count.last_user_id = null;
        },
        addToTotalCount: () => {},
        armShield: () => {},
        findShieldSaver: () => null,
        getActiveBooster: () => ({}),
    };
    delete require.cache[handlerPath];

    try {
        let handler;
        require(handlerPath)({ on: (_, callback) => { handler = callback; } });
        const message = (userId, value) => ({
            guild: { id: 'guild' },
            author: { id: userId, bot: false, toString: () => `<@${userId}>` },
            member: { roles: { cache: { has: id => id === 'aspirante' } } },
            channel: { id: 'counting', send: async () => {} },
            content: String(value),
            mentions: { users: new Map() },
            react: async () => {},
            reply: async () => {},
        });

        for (let number = 1; number <= 18; number++) {
            await handler(message(number % 2 ? 'student' : 'peer', number));
        }
        assert.equal(levels.getProfile('guild', 'student').xp, 0);
        assert.equal(levels.getProfile('guild', 'peer').xp, 0);

        await handler(message('student', 999));
        assert.equal(levels.getProfile('guild', 'student').countingNumbers, 9);
        await handler(message('student', 1));
        assert.equal(levels.getProfile('guild', 'student').xp, levels.XP_PER_MESSAGE);
        assert.equal(levels.getProfile('guild', 'student').countingNumbers, 10);
        assert.equal(levels.getProfile('guild', 'peer').xp, 0);

        const unverified = message('unverified-student', 2);
        unverified.member.roles.cache.has = id => id === 'aspirante' || id === 'unverified';
        await handler(unverified);
        assert.equal(levels.getProfile('guild', 'unverified-student').countingNumbers, 0);
    } finally {
        require.cache[storagePath].exports = originalStorage;
        delete require.cache[handlerPath];
    }
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
