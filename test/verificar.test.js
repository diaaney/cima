const test = require('node:test');
const assert = require('node:assert/strict');
const command = require('../src/commands/miscellaneous/verificar/slash');

test('verificar acknowledges the interaction before sending a DM', async () => {
    const previousGuildId = process.env.GUILD_ID;
    process.env.GUILD_ID = 'test-guild';
    const calls = [];
    const interaction = {
        guildId: 'test-guild',
        guild: { name: 'Comunidad UABC' },
        user: { send: async () => { calls.push('dm'); } },
        deferReply: async () => { calls.push('defer'); },
        editReply: async () => { calls.push('edit'); },
    };

    try {
        await command.execute(interaction);
        assert.deepEqual(calls, ['defer', 'dm', 'edit']);
    } finally {
        if (previousGuildId === undefined) delete process.env.GUILD_ID;
        else process.env.GUILD_ID = previousGuildId;
    }
});

test('verificar explains when Discord blocks the DM', async () => {
    const previousGuildId = process.env.GUILD_ID;
    const previousWarn = console.warn;
    process.env.GUILD_ID = 'test-guild';
    console.warn = () => {};
    const calls = [];
    const interaction = {
        guildId: 'test-guild',
        guild: { name: 'Comunidad UABC' },
        user: { id: 'test-user', send: async () => { throw Object.assign(new Error('Cannot send messages to this user'), { code: 50007 }); } },
        deferReply: async () => { calls.push('defer'); },
        editReply: async payload => { calls.push('edit'); assert.match(payload.embeds[0].data.description, /Discord bloqueó mi MD/); },
    };

    try {
        await command.execute(interaction);
        assert.deepEqual(calls, ['defer', 'edit']);
    } finally {
        console.warn = previousWarn;
        if (previousGuildId === undefined) delete process.env.GUILD_ID;
        else process.env.GUILD_ID = previousGuildId;
    }
});
