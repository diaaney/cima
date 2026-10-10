const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

test('booster answer acknowledges before fetching its Discord message', async () => {
    const storagePath = require.resolve('../src/utils/storage');
    const handlerPath = require.resolve('../src/events/interactionCreate');
    const originalStorage = require(storagePath);
    const steps = [];
    const booster = {
        id: 'booster-1', channel_id: 'channel-1', message_id: 'message-1',
        expression: '1+1', answer: 2, type: '+25', value: 25,
    };

    require.cache[storagePath].exports = {
        ...originalStorage,
        getActiveBooster: () => booster,
        getCountingConfig: () => ({ current_number: 1 }),
        applyBoostToCount: () => {},
    };
    delete require.cache[handlerPath];

    try {
        const client = new EventEmitter();
        client.channels = {
            fetch: async () => {
                steps.push('fetch');
                return { messages: { fetch: async () => null } };
            },
        };
        require(handlerPath)(client);

        let finish;
        const completed = new Promise(resolve => { finish = resolve; });
        const interaction = {
            client,
            customId: 'booster_answer:booster-1',
            guildId: 'guild-1',
            user: { id: 'user-1' },
            fields: { getTextInputValue: () => '2' },
            isCommand: () => false,
            isButton: () => false,
            isModalSubmit: () => true,
            isStringSelectMenu: () => false,
            deferReply: async () => { steps.push('defer'); interaction.deferred = true; },
            editReply: async () => { steps.push('edit'); finish(); },
            reply: async () => { throw new Error('unexpected reply'); },
        };

        client.emit('interactionCreate', interaction);
        await completed;
        assert.deepEqual(steps, ['defer', 'fetch', 'edit']);
    } finally {
        require.cache[storagePath].exports = originalStorage;
        delete require.cache[handlerPath];
    }
});
