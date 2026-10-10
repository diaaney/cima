const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Events } = require('discord.js');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-verification-roles-'));
process.env.VERIFICATION_STORE_FILE = path.join(directory, 'verification.json');
process.env.GUILD_ID = 'guild-uabc';
process.env.VERIFIED_ROLE_ID = 'verified';
process.env.UNVERIFIED_ROLE_ID = 'unverified';
process.env.RESEND_API_KEY = 'test-key';
process.env.RESEND_FROM_EMAIL = 'Cima <test@example.com>';

const store = require('../src/utils/verificationStore');
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

test('confirming the email grants verified and removes unverified', async () => {
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

    assert.deepEqual(member.calls, ['add:verified', 'remove:unverified']);
    assert.deepEqual([...member.roleIds], ['verified']);
    assert.equal(store.read().verified.student.email, 'student@uabc.edu.mx');
    assert.match(replies[0].embeds[0].data.description, /Correo verificado/);
});

test('a returning verified member receives only the verified role', async () => {
    const member = makeMember('student', ['unverified']);
    const { handlers } = setup(member);

    await handlers[Events.GuildMemberAdd](member);

    assert.deepEqual(member.calls, ['add:verified', 'remove:unverified']);
    assert.deepEqual([...member.roleIds], ['verified']);
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
