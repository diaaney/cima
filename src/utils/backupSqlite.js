const fs = require('node:fs');
const path = require('node:path');
const { backup, DatabaseSync } = require('node:sqlite');
const { database, filename } = require('./database');

async function createBackup(destination) {
    if (!destination) throw new Error('Backup destination is required');
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    if (fs.existsSync(destination)) throw new Error(`Backup already exists: ${destination}`);
    const temporary = `${destination}.${process.pid}.tmp`;
    if (fs.existsSync(temporary)) throw new Error(`Temporary backup already exists: ${temporary}`);
    try {
        await backup(database(), temporary);
        const copy = new DatabaseSync(temporary, { readOnly: true });
        try {
            if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') {
                throw new Error('SQLite backup integrity check failed');
            }
        } finally {
            copy.close();
        }
        fs.chmodSync(temporary, 0o600);
        fs.renameSync(temporary, destination);
        console.log(`SQLite backup created: ${path.basename(destination)} (${fs.statSync(destination).size} bytes)`);
    } catch (error) {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        throw error;
    }
}

function pruneDailyBackups(directory, now = Date.now()) {
    const oldest = now - 14 * 24 * 60 * 60 * 1000;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !/^daily-\d{8}T\d{6}Z\.sqlite$/.test(entry.name)) continue;
        const file = path.join(directory, entry.name);
        if (fs.statSync(file).mtimeMs < oldest) fs.unlinkSync(file);
    }
}

if (require.main === module) {
    const daily = !process.argv[2];
    const directory = process.env.CIMA_BACKUP_DIR || path.join(path.dirname(fs.realpathSync(filename)), 'backups');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const destination = process.argv[2] || path.join(directory, `daily-${stamp}.sqlite`);
    createBackup(destination)
        .then(() => { if (daily) pruneDailyBackups(directory); })
        .catch(error => { console.error(error); process.exitCode = 1; });
}

module.exports = { createBackup, pruneDailyBackups };
