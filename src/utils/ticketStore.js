const fs = require('node:fs');
const path = require('node:path');
const { readJsonWithBackup, writeJsonWithBackup } = require('./jsonStore');

const filename = process.env.TICKET_STORE_FILE || path.join(__dirname, '../../data/tickets.json');
const backup = `${filename}.backup.json`;

function read() {
    if (!fs.existsSync(filename) && !fs.existsSync(backup)) return { lastNumber: 0, tickets: {} };
    const data = readJsonWithBackup(filename, backup);
    return {
        lastNumber: Number.isSafeInteger(data.lastNumber) ? data.lastNumber : 0,
        tickets: data.tickets && typeof data.tickets === 'object' ? data.tickets : {},
    };
}

function save(data) {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    writeJsonWithBackup(filename, backup, data);
}

function reserveNumber() {
    const data = read();
    data.lastNumber += 1;
    save(data);
    return data.lastNumber;
}

function findOpenByOwner(ownerId) {
    return Object.entries(read().tickets).find(([, ticket]) =>
        ticket.ownerId === ownerId && ticket.status === 'open'
    ) || null;
}

function get(channelId) {
    return read().tickets[channelId] || null;
}

function add(channelId, ticket) {
    const data = read();
    data.tickets[channelId] = { ...ticket, status: 'open', claimedBy: null, invitedStaff: [] };
    save(data);
    return data.tickets[channelId];
}

function update(channelId, updater) {
    const data = read();
    const current = data.tickets[channelId];
    if (!current || current.status !== 'open') return null;
    const updated = updater(current);
    if (!updated) return null;
    data.tickets[channelId] = updated;
    save(data);
    return updated;
}

function claim(channelId, staffId) {
    return update(channelId, current => current.claimedBy ? null : { ...current, claimedBy: staffId });
}

function undoClaim(channelId, staffId) {
    return update(channelId, current => current.claimedBy === staffId ? { ...current, claimedBy: null } : null);
}

function invite(channelId, staffId) {
    return update(channelId, current => current.invitedStaff.includes(staffId)
        ? null
        : { ...current, invitedStaff: [...current.invitedStaff, staffId] });
}

function close(channelId, closedBy) {
    return update(channelId, current => ({ ...current, status: 'closed', closedBy, closedAt: new Date().toISOString() }));
}

module.exports = { read, reserveNumber, findOpenByOwner, get, add, claim, undoClaim, invite, close };
