const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection, ApplicationCommandOptionType } = require('discord.js');
const command = require('../src/commands/server-configuration/role/slash');

function makeMember(id, roles, calls, { bot = false, failRemove = false } = {}) {
    const cache = new Collection(roles.map(role => [role.id, role]));
    return {
        id,
        user: { bot },
        roles: {
            cache,
            add: async role => {
                calls.push(`${id}:add:${role.id}`);
                cache.set(role.id, role);
            },
            remove: async role => {
                calls.push(`${id}:remove:${role.id}`);
                if (failRemove) throw new Error('remove failed');
                cache.delete(role.id);
            },
        },
    };
}

test('role convert swaps the source role only for matching people', async () => {
    const source = { id: 'source', name: 'old', toString: () => '<@&source>' };
    const target = { id: 'target', name: 'new', toString: () => '<@&target>' };
    const extra = { id: 'extra', name: 'extra' };
    const calls = [];
    const matching = makeMember('matching', [source, extra], calls);
    const alreadyHasTarget = makeMember('both', [source, target], calls);
    const unrelated = makeMember('unrelated', [extra], calls);
    const bot = makeMember('bot', [source], calls, { bot: true });
    const members = new Collection([matching, alreadyHasTarget, unrelated, bot].map(member => [member.id, member]));
    let reply;
    const interaction = {
        user: { id: 'owner' },
        guild: {
            id: 'guild',
            ownerId: 'owner',
            members: {
                me: { roles: { highest: { comparePositionTo: () => 1 } } },
                fetch: async () => members,
            },
        },
        options: {
            getSubcommand: () => 'convert',
            getRole: name => name === 'roltarget' ? source : target,
        },
        deferReply: async () => {},
        editReply: async value => { reply = value; },
    };

    const subcommands = command.data.toJSON().options;
    assert.equal(subcommands.find(option => option.name === 'convert').type, ApplicationCommandOptionType.Subcommand);
    await command.execute(interaction);

    assert.deepEqual(calls, [
        'matching:add:target',
        'both:remove:source',
        'matching:remove:source',
    ]);
    assert.equal(matching.roles.cache.has('target'), true);
    assert.equal(matching.roles.cache.has('source'), false);
    assert.equal(matching.roles.cache.has('extra'), true);
    assert.equal(bot.roles.cache.has('source'), true);
    assert.match(reply.embeds[0].data.description, /\*\*2\*\* de \*\*2\*\*/);
});

test('role convert reports a partial change if source removal fails', async t => {
    const source = { id: 'source', toString: () => '<@&source>' };
    const target = { id: 'target', toString: () => '<@&target>' };
    const calls = [];
    const member = makeMember('member', [source], calls, { failRemove: true });
    let reply;
    const interaction = {
        user: { id: 'owner' },
        guild: {
            id: 'guild',
            ownerId: 'owner',
            members: {
                me: { roles: { highest: { comparePositionTo: () => 1 } } },
                fetch: async () => new Collection([['member', member]]),
            },
        },
        options: {
            getSubcommand: () => 'convert',
            getRole: name => name === 'roltarget' ? source : target,
        },
        deferReply: async () => {},
        editReply: async value => { reply = value; },
    };
    t.mock.method(console, 'error', () => {});

    await command.execute(interaction);

    assert.deepEqual(calls, ['member:add:target', 'member:remove:source']);
    assert.equal(member.roles.cache.has('source'), true);
    assert.equal(member.roles.cache.has('target'), true);
    assert.match(reply.embeds[0].data.description, /recibieron el rol nuevo pero conservaron el anterior/);
});
