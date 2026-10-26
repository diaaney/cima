const crypto = require('node:crypto');
const { database, getDocument, setDocument, transaction } = require('./database');

const EXPIRES_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function read() {
    const db = database();
    const pending = Object.fromEntries(db.prepare('SELECT * FROM verification_pending').all()
        .map(row => [row.user_id, {
            email: row.email, codeHash: row.code_hash, sentAt: row.sent_at,
            expires: row.expires, attempts: row.attempts,
        }]));
    const verified = Object.fromEntries(db.prepare('SELECT * FROM verification_verified').all()
        .map(row => [row.user_id, { email: row.email, verifiedAt: row.verified_at }]));
    const lastSent = Object.fromEntries(db.prepare('SELECT * FROM verification_last_sent').all()
        .map(row => [row.user_id, row.sent_at]));
    const selectedGameRoles = Object.fromEntries(db.prepare('SELECT * FROM verification_game_roles').all()
        .map(row => [row.user_id, JSON.parse(row.roles)]));
    const meta = getDocument('verification_meta', {});
    return { pending, verified, lastSent, selectedGameRoles, gameRolesRecoveredAt: meta.gameRolesRecoveredAt || null };
}

function digest(userId, code) {
    return crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function isVerified(userId) {
    return Boolean(database().prepare('SELECT 1 FROM verification_verified WHERE user_id = ?').get(userId));
}

function inspect(userId, email, now = Date.now()) {
    const db = database();
    if (isVerified(userId)) return 'verified';
    if (db.prepare('SELECT 1 FROM verification_verified WHERE email = ? AND user_id != ?').get(email, userId)) return 'email_used';
    if (db.prepare('SELECT 1 FROM verification_pending WHERE email = ? AND user_id != ? AND expires > ?')
        .get(email, userId, now)) return 'email_pending';
    const sent = db.prepare('SELECT sent_at FROM verification_last_sent WHERE user_id = ?').get(userId);
    if (sent && now - sent.sent_at < RESEND_MS) return 'rate_limited';
    return null;
}

function begin(userId, email, code, now = Date.now()) {
    const problem = inspect(userId, email, now);
    if (problem) return problem;
    transaction(db => {
        db.prepare(`
            INSERT INTO verification_pending (user_id, email, code_hash, sent_at, expires, attempts)
            VALUES (?, ?, ?, ?, ?, 0)
            ON CONFLICT(user_id) DO UPDATE SET
                email = excluded.email, code_hash = excluded.code_hash,
                sent_at = excluded.sent_at, expires = excluded.expires, attempts = 0
        `).run(userId, email, digest(userId, code), now, now + EXPIRES_MS);
        db.prepare(`
            INSERT INTO verification_last_sent (user_id, sent_at) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET sent_at = excluded.sent_at
        `).run(userId, now);
    });
    return null;
}

function check(userId, code, now = Date.now(), bypassCode = false) {
    const db = database();
    const pending = db.prepare('SELECT * FROM verification_pending WHERE user_id = ?').get(userId);
    if (!pending) return 'missing';
    if (pending.expires <= now) {
        db.prepare('DELETE FROM verification_pending WHERE user_id = ?').run(userId);
        return 'expired';
    }
    const supplied = Buffer.from(digest(userId, code), 'hex');
    const expected = Buffer.from(pending.code_hash, 'hex');
    if (!bypassCode && (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))) {
        const attempts = pending.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) db.prepare('DELETE FROM verification_pending WHERE user_id = ?').run(userId);
        else db.prepare('UPDATE verification_pending SET attempts = ? WHERE user_id = ?').run(attempts, userId);
        return attempts >= MAX_ATTEMPTS ? 'locked' : 'incorrect';
    }
    if (db.prepare('SELECT 1 FROM verification_verified WHERE email = ? AND user_id != ?')
        .get(pending.email, userId)) return 'email_used';
    return null;
}

function complete(userId) {
    transaction(db => {
        const pending = db.prepare('SELECT email FROM verification_pending WHERE user_id = ?').get(userId);
        if (!pending) throw new Error('Verification is no longer pending');
        db.prepare(`
            INSERT INTO verification_verified (user_id, email, verified_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, verified_at = excluded.verified_at
        `).run(userId, pending.email, new Date().toISOString());
        db.prepare('DELETE FROM verification_pending WHERE user_id = ?').run(userId);
    });
}

function cancel(userId) {
    transaction(db => {
        db.prepare('DELETE FROM verification_pending WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM verification_last_sent WHERE user_id = ?').run(userId);
    });
}

function getSelectedGameRoles(userId) {
    const row = database().prepare('SELECT roles FROM verification_game_roles WHERE user_id = ?').get(userId);
    return row ? JSON.parse(row.roles) : [];
}

function rememberGameRoles(userId, roleIds) {
    if (!roleIds.length) return;
    const current = getSelectedGameRoles(userId);
    const updated = [...new Set([...current, ...roleIds])];
    if (updated.length === current.length) return;
    database().prepare(`
        INSERT INTO verification_game_roles (user_id, roles) VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET roles = excluded.roles
    `).run(userId, JSON.stringify(updated));
}

function clearGameRoles(userId) {
    database().prepare('DELETE FROM verification_game_roles WHERE user_id = ?').run(userId);
}

function hasRecoveredGameRoles() {
    return Boolean(getDocument('verification_meta', {}).gameRolesRecoveredAt);
}

function markGameRolesRecovered() {
    setDocument('verification_meta', { gameRolesRecoveredAt: new Date().toISOString() });
}

module.exports = {
    inspect, begin, check, complete, cancel, read, isVerified,
    getSelectedGameRoles, rememberGameRoles, clearGameRoles,
    hasRecoveredGameRoles, markGameRolesRecovered,
};
