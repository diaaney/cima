const { AuditLogEvent, Events } = require('discord.js');
const gameRoleIds = require('../constants/gameRoles');
const { RANKS, highestMemberRank } = require('../utils/levelSystem');
const verificationStore = require('../utils/verificationStore');

const gameRoleSet = new Set(gameRoleIds);
const watchedRoleIds = new Set([...gameRoleIds, ...RANKS.map(rank => rank.id)]);
const HISTORICAL_ROLE_REMOVALS_SINCE = Date.parse('2026-10-12T00:00:00Z');
const restoring = new Map();

function isVerified(member) {
    const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID?.trim();
    return !member.roles.cache.has(unverifiedRoleId) &&
        Boolean(highestMemberRank(member) || verificationStore.read().verified[member.id]);
}

function restoreGameRoles(member) {
    if (restoring.has(member.id)) return restoring.get(member.id);
    const task = (async () => {
        if (member.user.bot || member.guild.id !== process.env.GUILD_ID?.trim() || !isVerified(member)) return;
        const saved = verificationStore.read().selectedGameRoles[member.id] || [];
        for (const roleId of saved.filter(id => gameRoleSet.has(id))) {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId, 'Rol de juego elegido antes de la verificación UABC');
            }
        }
        verificationStore.clearGameRoles(member.id);
    })();
    restoring.set(member.id, task);
    task.finally(() => { if (restoring.get(member.id) === task) restoring.delete(member.id); }).catch(() => {});
    return task;
}

async function removeUnverifiedGameRoles(member) {
    const guildId = process.env.GUILD_ID?.trim();
    const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID?.trim();
    if (member.user.bot || member.guild.id !== guildId || !unverifiedRoleId) return;
    if (isVerified(member)) {
        await restoreGameRoles(member);
        return;
    }

    const selected = gameRoleIds.filter(roleId => member.roles.cache.has(roleId));
    verificationStore.rememberGameRoles(member.id, selected);
    for (const roleId of selected) {
        await member.roles.remove(roleId, 'Los roles de juego requieren verificación UABC');
    }
}

async function recoverHistoricalSelections(guild, members) {
    if (verificationStore.read().gameRolesRecoveredAt) return;
    const recovered = new Map();
    let before;
    for (;;) {
        const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 100, before });
        const entries = [...logs.entries.values()];
        if (!entries.length) break;
        for (const entry of entries) {
            if (entry.createdTimestamp < HISTORICAL_ROLE_REMOVALS_SINCE) continue;
            const member = members.get(entry.targetId);
            if (entry.executorId !== guild.client.user.id || !member ||
                (member.joinedTimestamp && entry.createdTimestamp < member.joinedTimestamp)) continue;
            const removed = entry.changes?.find(change => change.key === '$remove')?.new || [];
            const gameRoles = removed.map(role => role.id).filter(id => gameRoleSet.has(id));
            if (!gameRoles.length) continue;
            const selected = recovered.get(entry.targetId) || new Set();
            gameRoles.forEach(id => selected.add(id));
            recovered.set(entry.targetId, selected);
        }
        if (entries.length < 100 || entries.at(-1).createdTimestamp < HISTORICAL_ROLE_REMOVALS_SINCE) break;
        before = entries.at(-1).id;
    }

    for (const [userId, roles] of recovered) {
        verificationStore.rememberGameRoles(userId, [...roles]);
    }
    verificationStore.markGameRolesRecovered();
    for (const userId of recovered.keys()) {
        const member = members.get(userId);
        if (member && isVerified(member)) {
            await restoreGameRoles(member).catch(error =>
                console.error(`[Game roles] Could not restore historical roles for ${userId}:`, error)
            );
        }
    }
    console.log(`[Game roles] Recovered historical selections for ${recovered.size} members.`);
}

module.exports = client => {
    const inFlight = new Map();
    const schedule = member => {
        const previous = inFlight.get(member.id) || Promise.resolve();
        const current = previous.catch(() => {}).then(() =>
            removeUnverifiedGameRoles(member.guild.members.cache.get(member.id) || member)
        );
        inFlight.set(member.id, current);
        current.catch(error => console.error(`[Game roles] Failed for ${member.id}:`, error))
            .finally(() => { if (inFlight.get(member.id) === current) inFlight.delete(member.id); });
    };

    client.on(Events.GuildMemberAdd, member => schedule(member));
    client.on(Events.GuildMemberUpdate, (before, after) => {
        if (after.guild.id !== process.env.GUILD_ID?.trim()) return;
        const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID?.trim();
        const newlySelected = gameRoleIds.filter(id => !before.roles.cache.has(id) && after.roles.cache.has(id));
        if (newlySelected.length && !isVerified(after)) {
            verificationStore.rememberGameRoles(after.id, newlySelected);
        }
        const changed = [unverifiedRoleId, ...watchedRoleIds].some(id =>
            id && before.roles.cache.has(id) !== after.roles.cache.has(id)
        );
        if (changed) schedule(after);
    });

    client.once(Events.ClientReady, async () => {
        const guild = client.guilds.cache.get(process.env.GUILD_ID?.trim());
        if (!guild) return;
        try {
            const members = await guild.members.fetch();
            const saved = verificationStore.read().selectedGameRoles;
            for (const member of members.values()) {
                if (gameRoleIds.some(id => member.roles.cache.has(id)) || saved[member.id]?.length) schedule(member);
            }
            await recoverHistoricalSelections(guild, members);
        } catch (error) {
            console.error('[Game roles] Could not check existing members:', error);
        }
    });
};

module.exports.removeUnverifiedGameRoles = removeUnverifiedGameRoles;
module.exports.restoreGameRoles = restoreGameRoles;
