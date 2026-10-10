const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = process.env.VERIFICATION_STORE_FILE || path.join(__dirname, '../../data/verification.json');
const EXPIRES_MS = 10 * 60 * 1000;
const RESEND_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function read() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return { pending: data.pending || {}, verified: data.verified || {}, lastSent: data.lastSent || {} };
    } catch (error) {
        if (error.code === 'ENOENT') return { pending: {}, verified: {}, lastSent: {} };
        throw error;
    }
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const temporary = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, FILE);
}

function digest(userId, code) {
    return crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');
}

function inspect(userId, email, now = Date.now()) {
    const data = read();
    if (data.verified[userId]) return 'verified';
    if (Object.entries(data.verified).some(([id, value]) => id !== userId && value.email === email)) return 'email_used';
    if (Object.entries(data.pending).some(([id, value]) => id !== userId && value.email === email && value.expires > now)) return 'email_pending';
    if (data.lastSent[userId] && now - data.lastSent[userId] < RESEND_MS) return 'rate_limited';
    return null;
}

function begin(userId, email, code, now = Date.now()) {
    const problem = inspect(userId, email, now);
    if (problem) return problem;
    const data = read();
    data.pending[userId] = {
        email,
        codeHash: digest(userId, code),
        sentAt: now,
        expires: now + EXPIRES_MS,
        attempts: 0,
    };
    data.lastSent[userId] = now;
    save(data);
    return null;
}

function check(userId, code, now = Date.now()) {
    const data = read();
    const pending = data.pending[userId];
    if (!pending) return 'missing';
    if (pending.expires <= now) {
        delete data.pending[userId];
        save(data);
        return 'expired';
    }
    const supplied = Buffer.from(digest(userId, code), 'hex');
    const expected = Buffer.from(pending.codeHash, 'hex');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
        pending.attempts += 1;
        if (pending.attempts >= MAX_ATTEMPTS) delete data.pending[userId];
        save(data);
        return pending.attempts >= MAX_ATTEMPTS ? 'locked' : 'incorrect';
    }
    if (Object.entries(data.verified).some(([id, value]) => id !== userId && value.email === pending.email)) return 'email_used';
    return null;
}

function complete(userId) {
    const data = read();
    const pending = data.pending[userId];
    if (!pending) throw new Error('Verification is no longer pending');
    data.verified[userId] = { email: pending.email, verifiedAt: new Date().toISOString() };
    delete data.pending[userId];
    save(data);
}

function cancel(userId) {
    const data = read();
    delete data.pending[userId];
    delete data.lastSent[userId];
    save(data);
}

module.exports = { inspect, begin, check, complete, cancel, read };
