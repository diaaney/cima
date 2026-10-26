const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const filename = process.env.CIMA_DB_FILE || path.join(__dirname, '../../data/cima.sqlite');
let connection;

function database() {
    if (connection) return connection;
    if (!fs.existsSync(filename)) {
        throw new Error(`SQLite database missing at ${filename}. Run the data migration first.`);
    }
    const db = new DatabaseSync(filename, { timeout: 5000 });
    db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version !== 1) {
        db.close();
        throw new Error(`Unsupported SQLite schema version ${version}`);
    }
    connection = db;
    return connection;
}

function getDocument(name, fallback) {
    const row = database().prepare('SELECT value FROM documents WHERE name = ?').get(name);
    return row ? JSON.parse(row.value) : fallback;
}

function setDocument(name, value) {
    database().prepare(`
        INSERT INTO documents (name, value) VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET value = excluded.value
    `).run(name, JSON.stringify(value));
}

function transaction(work) {
    const db = database();
    db.exec('BEGIN IMMEDIATE');
    try {
        const result = work(db);
        db.exec('COMMIT');
        return result;
    } catch (error) {
        db.exec('ROLLBACK');
        throw error;
    }
}

module.exports = { database, getDocument, setDocument, transaction, filename };
