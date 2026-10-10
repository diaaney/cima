const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

test('a member who leaves the generator is not moved and their empty room is removed', async t => {
    const storagePath = require.resolve('../src/utils/storage');
    const handlerPath = require.resolve('../src/events/voiceStateUpdate');
    const originalStorage = require(storagePath);
    const saved = [];
    const deleted = [];
    let tick;
    let now = 0;

    require.cache[storagePath].exports = {
        ...originalStorage,
        getVoicemasterConfig: () => ({ generator_id: 'generator' }),
        createRoom: id => saved.push(id),
        deleteRoom: id => deleted.push(id),
    };
    delete require.cache[handlerPath];
    t.mock.method(Date, 'now', () => now);
    t.mock.method(global, 'setInterval', callback => { tick = callback; return 1; });
    t.mock.method(global, 'clearInterval', () => {});

    try {
        const client = new EventEmitter();
        require(handlerPath)(client);

        let finishCreate;
        const creation = new Promise(resolve => { finishCreate = resolve; });
        let moved = false;
        let channelDeleted = false;
        const channel = {
            id: 'room',
            delete: async () => { channelDeleted = true; },
        };
        const guild = {
            id: 'guild',
            channels: { create: () => creation },
            voiceStates: { cache: {
                get: () => ({ channelId: null }),
                some: () => false,
            } },
        };
        const member = {
            id: 'member',
            displayName: 'member',
            voice: { setChannel: async () => { moved = true; } },
        };

        client.emit('voiceStateUpdate', { channelId: null }, {
            channelId: 'generator', guild, member, channel: { parent: null },
        });
        finishCreate(channel);
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(moved, false);
        assert.deepEqual(saved, ['room']);
        assert.equal(channelDeleted, false);

        now = 16000;
        await tick();
        assert.equal(channelDeleted, true);
        assert.deepEqual(deleted, ['room']);
    } finally {
        require.cache[storagePath].exports = originalStorage;
        delete require.cache[handlerPath];
    }
});
