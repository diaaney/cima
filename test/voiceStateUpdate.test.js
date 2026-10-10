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

test('saved voice rooms resume cleanup after restart and ignore music bots', async t => {
    const storagePath = require.resolve('../src/utils/storage');
    const handlerPath = require.resolve('../src/events/voiceStateUpdate');
    const originalStorage = require(storagePath);
    const deleted = [];
    const intervals = [];
    let now = 0;
    let humanPresent = true;

    require.cache[storagePath].exports = {
        ...originalStorage,
        getAllRooms: () => [{ channel_id: 'saved-room' }],
        deleteRoom: id => deleted.push(id),
    };
    delete require.cache[handlerPath];
    t.mock.method(Date, 'now', () => now);
    t.mock.method(global, 'setInterval', callback => { intervals.push(callback); return intervals.length; });
    t.mock.method(global, 'clearInterval', () => {});

    try {
        const client = new EventEmitter();
        let channelDeleted = false;
        const channel = {
            id: 'saved-room',
            guild: { id: 'guild' },
            members: { some: predicate => [
                { user: { bot: true } },
                ...(humanPresent ? [{ user: { bot: false } }] : []),
            ].some(predicate) },
            delete: async () => { channelDeleted = true; },
        };
        client.channels = { cache: { get: () => channel }, fetch: async () => channel };
        require(handlerPath)(client);
        client.emit('ready');
        await new Promise(resolve => setImmediate(resolve));

        now = 16_000;
        await intervals[0]();
        assert.equal(channelDeleted, false);

        humanPresent = false;
        await intervals[0]();
        assert.equal(channelDeleted, true);
        assert.deepEqual(deleted, ['saved-room']);
    } finally {
        require.cache[storagePath].exports = originalStorage;
        delete require.cache[handlerPath];
    }
});
