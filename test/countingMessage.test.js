const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

test('count advances and gets a fallback confirmation when Discord rejects the reaction', async () => {
    const storagePath = require.resolve('../src/utils/storage');
    const handlerPath = require.resolve('../src/events/messageCreate');
    const originalStorage = require(storagePath);
    const steps = [];

    require.cache[storagePath].exports = {
        ...originalStorage,
        isAfk: () => null,
        getReactMessage: () => null,
        getCountingConfig: () => ({ channel_id: 'count-channel', current_number: 25, last_user_id: 'other-user' }),
        getUserStats: () => ({ sabotaged: false }),
        updateCount: () => { steps.push('count saved'); },
        addToTotalCount: () => {},
        armShield: () => {},
        getActiveBooster: () => ({}),
    };
    delete require.cache[handlerPath];

    try {
        const client = new EventEmitter();
        require(handlerPath)(client);

        let finish;
        const completed = new Promise(resolve => { finish = resolve; });
        const message = {
            id: 'count-message',
            author: { id: 'counter', bot: false },
            guild: { id: 'guild' },
            channel: { id: 'count-channel' },
            content: '26',
            mentions: { users: new Map() },
            react: async () => {
                steps.push('reaction failed');
                throw new Error('Discord timeout');
            },
            reply: async payload => {
                steps.push('fallback sent');
                assert.match(payload.content, /26.*27/);
                finish();
            },
        };

        const originalError = console.error;
        console.error = () => {};
        try {
            client.emit('messageCreate', message);
            await completed;
        } finally {
            console.error = originalError;
        }

        assert.deepEqual(steps, ['count saved', 'reaction failed', 'fallback sent']);
    } finally {
        require.cache[storagePath].exports = originalStorage;
        delete require.cache[handlerPath];
    }
});
