const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-level-event-'));
process.env.LEVEL_STORE_FILE = path.join(directory, 'levels.json');
process.env.GUILD_ID = 'guild';
process.env.UNVERIFIED_ROLE_ID = 'unverified';
const levels = require('../src/utils/levelSystem');

test('unverified, counting and short messages do not earn XP', async () => {
    const storagePath = require.resolve('../src/utils/storage');
    const eventPath = require.resolve('../src/events/leveling');
    const originalStorage = require(storagePath);
    require.cache[storagePath].exports = {
        ...originalStorage,
        getCountingConfig: () => ({ channel_id: 'counting' }),
    };
    delete require.cache[eventPath];

    try {
        let handler;
        require(eventPath)({ on: (_, callback) => { handler = callback; } });
        const roleIds = new Set([levels.RANKS[0].id, 'unverified']);
        const base = {
            guild: { id: 'guild' },
            author: { id: 'student', bot: false },
            member: {
                roles: {
                    cache: { has: id => roleIds.has(id) },
                    add: async id => roleIds.add(id),
                    remove: async id => roleIds.delete(id),
                },
            },
            channel: { send: async () => {} },
            attachments: { size: 0 },
        };

        await handler({ ...base, channelId: 'general', content: 'Hola comunidad' });
        roleIds.delete('unverified');
        await handler({ ...base, channelId: 'counting', content: '12345' });
        await handler({ ...base, channelId: 'general', content: 'hola' });
        assert.equal(levels.getProfile('guild', 'student', base.member).xp, 0);

        await handler({ ...base, channelId: 'general', content: 'Hola comunidad' });
        assert.equal(levels.getProfile('guild', 'student', base.member).xp, 20);
    } finally {
        require.cache[storagePath].exports = originalStorage;
        delete require.cache[eventPath];
    }
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
