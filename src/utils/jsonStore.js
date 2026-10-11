const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

function atomicWrite(filename, content) {
    const temporary = `${filename}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(temporary, filename);
    } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
}

function readJsonWithBackup(filename, backupFilename) {
    try {
        return JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch (error) {
        if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error;

        let recovered;
        try {
            recovered = JSON.parse(fs.readFileSync(backupFilename, 'utf8'));
        } catch {
            throw new Error(`Neither ${filename} nor its backup contains valid JSON`, { cause: error });
        }

        atomicWrite(filename, JSON.stringify(recovered, null, 2));
        console.warn(`[Storage] Restored ${filename} from its backup after a read error.`);
        return recovered;
    }
}

function writeJsonWithBackup(filename, backupFilename, value) {
    const data = JSON.stringify(value, null, 2);
    atomicWrite(backupFilename, data);
    atomicWrite(filename, data);
}

module.exports = { atomicWrite, readJsonWithBackup, writeJsonWithBackup };
