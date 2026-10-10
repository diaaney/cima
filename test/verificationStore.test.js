const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-verification-'));
process.env.VERIFICATION_STORE_FILE = path.join(directory, 'verification.json');
const store = require('../src/utils/verificationStore');

test('code expires, limits attempts and binds each email to one Discord account', () => {
    const now = Date.now();
    assert.equal(store.begin('one', 'student@uabc.edu.mx', '123456', now), null);
    assert.equal(store.inspect('two', 'student@uabc.edu.mx', now), 'email_pending');
    assert.equal(store.inspect('one', 'other@uabc.edu.mx', now), 'rate_limited');
    assert.equal(store.check('one', '000000', now), 'incorrect');
    assert.equal(store.check('one', '123456', now), null);
    store.complete('one');
    assert.equal(store.inspect('two', 'student@uabc.edu.mx', now + 60_000), 'email_used');

    assert.equal(store.begin('two', 'other@uabc.edu.mx', '654321', now + 60_000), null);
    assert.equal(store.check('two', '654321', now + 11 * 60_000), 'expired');
    assert.equal(store.begin('two', 'other@uabc.edu.mx', '654321', now + 11 * 60_000), null);
    for (let i = 0; i < 4; i++) assert.equal(store.check('two', '000000', now + 11 * 60_000), 'incorrect');
    assert.equal(store.check('two', '000000', now + 11 * 60_000), 'locked');
    assert.equal(store.check('two', '654321', now + 11 * 60_000), 'missing');
});

test.after(() => fs.rmSync(directory, { recursive: true, force: true }));
