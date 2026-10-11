const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readJsonWithBackup, writeJsonWithBackup } = require('../src/utils/jsonStore');

function removeTestDirectory(directory) {
    for (const filename of fs.readdirSync(directory)) fs.unlinkSync(path.join(directory, filename));
    fs.rmdirSync(directory);
}

test('a truncated config is restored from its valid backup', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-json-store-'));
    try {
        const config = path.join(directory, 'config.json');
        const backup = path.join(directory, 'config.backup.json');
        const original = { guilds: { test: { counting: { current_number: 42 } } } };
        writeJsonWithBackup(config, backup, original);
        fs.writeFileSync(config, '{"guilds":');

        assert.deepEqual(readJsonWithBackup(config, backup), original);
        assert.deepEqual(JSON.parse(fs.readFileSync(config, 'utf8')), original);
        assert.deepEqual(fs.readdirSync(directory).sort(), ['config.backup.json', 'config.json']);
    } finally {
        removeTestDirectory(directory);
    }
});

test('invalid main and backup files fail without replacing either file', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cima-json-store-'));
    try {
        const config = path.join(directory, 'config.json');
        const backup = path.join(directory, 'config.backup.json');
        fs.writeFileSync(config, '{');
        fs.writeFileSync(backup, '{');

        assert.throws(() => readJsonWithBackup(config, backup), /Neither .* nor its backup contains valid JSON/);
        assert.equal(fs.readFileSync(config, 'utf8'), '{');
        assert.equal(fs.readFileSync(backup, 'utf8'), '{');
    } finally {
        removeTestDirectory(directory);
    }
});
