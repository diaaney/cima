const { getDocument, setDocument } = require('./database');

function read() {
    const data = getDocument('tickets', { lastNumber: 0, tickets: {} });
    return {
        lastNumber: Number.isSafeInteger(data.lastNumber) ? data.lastNumber : 0,
        tickets: data.tickets && typeof data.tickets === 'object' ? data.tickets : {},
    };
}

function save(data) {
    setDocument('tickets', data);
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
