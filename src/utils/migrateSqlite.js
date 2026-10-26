require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { readJsonWithBackup } = require('./jsonStore');
const { filename } = require('./database');

const dataDir = process.env.CIMA_DATA_DIR || path.join(__dirname, '../../data');

function readRequired(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readOptional(file, fallback) {
    return fs.existsSync(file) ? readRequired(file) : fallback;
}

function migrate() {
    if (fs.existsSync(filename)) {
        const existing = new DatabaseSync(filename, { readOnly: true });
        try {
            const version = existing.prepare('PRAGMA user_version').get().user_version;
            if (version !== 1) throw new Error(`Existing database has schema version ${version}`);
            console.log('SQLite database already exists; migration skipped.');
        } finally {
            existing.close();
        }
        return;
    }

    const configFile = path.join(dataDir, 'config.json');
    const config = readJsonWithBackup(configFile, path.join(dataDir, 'config.backup.json'));
    if (!config.guilds || !config.global) throw new Error('Unsupported config.json format');
    const stats = config.global.user_stats || {};
    const configWithoutStats = structuredClone(config);
    configWithoutStats.global.user_stats = {};

    const rooms = readOptional(path.join(dataDir, 'rooms.json'), []);
    const ticketFile = process.env.TICKET_STORE_FILE || path.join(dataDir, 'tickets.json');
    const tickets = fs.existsSync(ticketFile) || fs.existsSync(`${ticketFile}.backup.json`)
        ? readJsonWithBackup(ticketFile, `${ticketFile}.backup.json`)
        : { lastNumber: 0, tickets: {} };
    const verificationFile = process.env.VERIFICATION_STORE_FILE || path.join(
        dataDir,
        process.env.GUILD_ID ? `verification-${process.env.GUILD_ID.trim()}.json` : 'verification.json',
    );
    const verification = readOptional(verificationFile, {});
    const levelFiles = new Map(fs.readdirSync(dataDir)
        .filter(name => /^levels-\d+\.json$/.test(name))
        .map(name => [name.slice(7, -5), path.join(dataDir, name)]));
    if (process.env.LEVEL_STORE_FILE && process.env.GUILD_ID) {
        levelFiles.set(process.env.GUILD_ID.trim(), process.env.LEVEL_STORE_FILE);
    }

    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${process.pid}.new`;
    if (fs.existsSync(temporary)) throw new Error(`Temporary database already exists: ${temporary}`);
    const db = new DatabaseSync(temporary);
    try {
        db.exec(`
            CREATE TABLE documents (
                name TEXT PRIMARY KEY,
                value TEXT NOT NULL CHECK (json_valid(value))
            );
            CREATE TABLE user_stats (
                user_id TEXT PRIMARY KEY,
                value TEXT NOT NULL CHECK (json_valid(value))
            );
            CREATE TABLE level_profiles (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                xp INTEGER NOT NULL,
                last_awarded_at INTEGER NOT NULL DEFAULT 0,
                counting_numbers INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );
            CREATE TABLE verification_pending (
                user_id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                code_hash TEXT NOT NULL,
                sent_at INTEGER NOT NULL,
                expires INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE verification_verified (
                user_id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                verified_at TEXT NOT NULL
            );
            CREATE TABLE verification_last_sent (
                user_id TEXT PRIMARY KEY,
                sent_at INTEGER NOT NULL
            );
            CREATE TABLE verification_game_roles (
                user_id TEXT PRIMARY KEY,
                roles TEXT NOT NULL CHECK (json_valid(roles))
            );
            CREATE INDEX verification_pending_email ON verification_pending(email);
        `);
        db.exec('BEGIN IMMEDIATE');
        const document = db.prepare('INSERT INTO documents (name, value) VALUES (?, ?)');
        document.run('config', JSON.stringify(configWithoutStats));
        document.run('rooms', JSON.stringify(rooms));
        document.run('tickets', JSON.stringify(tickets));
        document.run('verification_meta', JSON.stringify({ gameRolesRecoveredAt: verification.gameRolesRecoveredAt || null }));

        const stat = db.prepare('INSERT INTO user_stats (user_id, value) VALUES (?, ?)');
        for (const [userId, value] of Object.entries(stats)) stat.run(userId, JSON.stringify(value));

        const level = db.prepare(`
            INSERT INTO level_profiles (guild_id, user_id, xp, last_awarded_at, counting_numbers)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const [guildId, levelFile] of levelFiles) {
            for (const [userId, profile] of Object.entries(readRequired(levelFile))) {
                level.run(guildId, userId, profile.xp || 0, profile.lastAwardedAt || 0, profile.countingNumbers || 0);
            }
        }

        const pending = db.prepare(`
            INSERT INTO verification_pending (user_id, email, code_hash, sent_at, expires, attempts)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const [userId, value] of Object.entries(verification.pending || {})) {
            pending.run(userId, value.email, value.codeHash, value.sentAt, value.expires, value.attempts || 0);
        }
        const verified = db.prepare('INSERT INTO verification_verified (user_id, email, verified_at) VALUES (?, ?, ?)');
        for (const [userId, value] of Object.entries(verification.verified || {})) {
            verified.run(userId, value.email, value.verifiedAt);
        }
        const lastSent = db.prepare('INSERT INTO verification_last_sent (user_id, sent_at) VALUES (?, ?)');
        for (const [userId, value] of Object.entries(verification.lastSent || {})) lastSent.run(userId, value);
        const roles = db.prepare('INSERT INTO verification_game_roles (user_id, roles) VALUES (?, ?)');
        for (const [userId, value] of Object.entries(verification.selectedGameRoles || {})) {
            roles.run(userId, JSON.stringify(value));
        }

        db.exec('PRAGMA user_version = 1; COMMIT');
        const check = db.prepare('PRAGMA integrity_check').get().integrity_check;
        if (check !== 'ok') throw new Error(`SQLite integrity check failed: ${check}`);
        db.close();
        fs.chmodSync(temporary, 0o600);
        fs.renameSync(temporary, filename);
        console.log(`Migrated ${Object.keys(stats).length} user stats and ${levelFiles.length} level files to SQLite.`);
    } catch (error) {
        if (db.isOpen) db.close();
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        throw error;
    }
}

if (require.main === module) migrate();
module.exports = { migrate };
