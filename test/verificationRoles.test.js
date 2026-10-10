const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Events } = require('discord.js');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-verification-roles-'));
process.env.VERIFICATION_STORE_FILE = path.join(directory, 'verification.json');
process.env.LEVEL_STORE_FILE = path.join(directory, 'levels.json');
process.env.GUILD_ID = 'guild-uabc';
process.env.UNVERIFIED_ROLE_ID = 'unverified';
process.env.ASPIRANTE_ROLE_ID = 'aspirante';
process.env.RESEND_API_KEY = 'test-key';
process.env.RESEND_FROM_EMAIL = 'Cima <test@example.com>';

const store = require('../src/utils/verificationStore');
const levels = require('../src/utils/levelSystem');
const registerVerification = require('../src/events/verification');

function setup(member) {
    const handlers = {};
    const client = {
        on: (event, handler) => { handlers[event] = handler; },
        guilds: { fetch: async () => ({ members: { fetch: async () => member } }) },
    };
    registerVerification(client);
    return { handlers, client };
}

function makeMember(id, initialRoles = []) {
    const roleIds = new Set(initialRoles);
    const calls = [];
    return {
        id,
        guild: { id: 'guild-uabc', name: 'Comunidad UABC' },
        user: { bot: false, send: async () => { calls.push('dm'); } },
        roles: {
            cache: { has: roleId => roleIds.has(roleId) },
            add: async roleId => { calls.push(`add:${roleId}`); roleIds.add(roleId); },
            remove: async roleId => { calls.push(`remove:${roleId}`); roleIds.delete(roleId); },
        },
        roleIds,
        calls,
    };
}

test('new members receive the unverified role before the DM', async () => {
    const member = makeMember('new-member');
    const { handlers } = setup(member);

    await handlers[Events.GuildMemberAdd](member);

    assert.deepEqual(member.calls, ['add:unverified', 'dm']);
    assert.deepEqual([...member.roleIds], ['unverified']);
});

test('confirming the email gives aspirante before removing unverified', async () => {
    const member = makeMember('student', ['unverified']);
    const { handlers, client } = setup(member);
    assert.equal(store.begin('student', 'student@uabc.edu.mx', '123456'), null);
    const replies = [];
    const interaction = {
        client,
        customId: 'cima_verify_code_modal',
        user: { id: 'student' },
        fields: { getTextInputValue: () => '123456' },
        isButton: () => false,
        isModalSubmit: () => true,
        deferReply: async () => {},
        editReply: async payload => { replies.push(payload); },
    };

    await handlers[Events.InteractionCreate](interaction);

    assert.deepEqual(member.calls, ['add:aspirante', 'remove:unverified']);
    assert.deepEqual([...member.roleIds], ['aspirante']);
    assert.equal(store.read().verified.student.email, 'student@uabc.edu.mx');
    assert.match(replies[0].embeds[0].data.description, /Correo verificado/);
});

test('a returning verified member receives aspirante and loses unverified', async () => {
    const member = makeMember('student', ['unverified']);
    const { handlers } = setup(member);

    await handlers[Events.GuildMemberAdd](member);

    assert.deepEqual(member.calls, ['add:aspirante', 'remove:unverified']);
    assert.deepEqual([...member.roleIds], ['aspirante']);
});

test('a returning verified member regains their earned rank instead of aspirante', async () => {
    const veteran = levels.RANKS.find(rank => rank.level === 40);
    const original = makeMember('veteran', [veteran.id]);
    levels.awardMessage('guild-uabc', 'veteran', original, 100_000);
    assert.equal(store.begin('veteran', 'veteran@uabc.edu.mx', '123456'), null);
    store.complete('veteran');

    const returning = makeMember('veteran', ['unverified']);
    const { handlers } = setup(returning);
    await handlers[Events.GuildMemberAdd](returning);

    assert.deepEqual(returning.calls, [`add:${veteran.id}`, 'remove:unverified']);
    assert.deepEqual([...returning.roleIds], [veteran.id]);
});

test('a verified member can retry role assignment without receiving aspirante twice', async () => {
    const member = makeMember('student', ['unverified', 'aspirante']);
    const { handlers, client } = setup(member);
    const replies = [];
    const interaction = {
        client,
        customId: 'cima_verify_email',
        user: { id: 'student' },
        isButton: () => true,
        isModalSubmit: () => false,
        reply: async payload => { replies.push(payload); },
    };

    await handlers[Events.InteractionCreate](interaction);

    assert.deepEqual(member.calls, ['remove:unverified']);
    assert.deepEqual([...member.roleIds], ['aspirante']);
    assert.match(replies[0].embeds[0].data.description, /ya está verificado/);
});

test('a failed aspirante grant leaves the unverified role in place', async t => {
    const member = makeMember('grant-failure', ['unverified']);
    member.roles.add = async () => { throw new Error('Discord unavailable'); };
    const { handlers, client } = setup(member);
    assert.equal(store.begin('grant-failure', 'grant-failure@uabc.edu.mx', '123456'), null);
    const replies = [];
    const interaction = {
        client,
        customId: 'cima_verify_code_modal',
        user: { id: 'grant-failure' },
        fields: { getTextInputValue: () => '123456' },
        isButton: () => false,
        isModalSubmit: () => true,
        deferReply: async () => {},
        editReply: async payload => { replies.push(payload); },
    };
    t.mock.method(console, 'error', () => {});

    await handlers[Events.InteractionCreate](interaction);

    assert.deepEqual([...member.roleIds], ['unverified']);
    assert.equal(store.read().verified['grant-failure'].email, 'grant-failure@uabc.edu.mx');
    assert.match(replies[0].embeds[0].data.description, /no pude actualizar tus roles/);
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
