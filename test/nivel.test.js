const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

process.env.GUILD_ID = 'guild';
process.env.LEVEL_STORE_FILE = path.join(os.tmpdir(), `cima-nivel-test-${process.pid}.json`);

const command = require('../src/commands/miscellaneous/nivel/slash');
const { RANKS } = require('../src/utils/levelSystem');

test('/nivel stays public and publishes through a fallback after a connection timeout', async t => {
    let deferOptions = 'not called';
    let fallback;
    t.mock.method(console, 'warn', () => {});
    t.mock.method(global, 'fetch', async (url, options) => {
        fallback = { url, options };
        return { ok: true, status: 200 };
    });

    const interaction = {
        applicationId: 'application',
        token: 'test-token',
        guildId: 'guild',
        user: { id: 'student', username: 'student' },
        member: { roles: { cache: { has: id => id === RANKS[0].id } } },
        options: { getUser: () => null },
        deferReply: async options => { deferOptions = options; },
        editReply: async () => { throw new Error('Connect Timeout Error'); },
    };

    await command.execute(interaction);

    assert.equal(deferOptions, undefined);
    assert.match(fallback.url, /\/webhooks\/application\/test-token\/messages\/@original$/);
    assert.equal(fallback.options.method, 'PATCH');
    const body = JSON.parse(fallback.options.body);
    assert.match(body.embeds[0].description, /nivel \*\*0\*\*/);
});
