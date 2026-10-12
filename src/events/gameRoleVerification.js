const { Events } = require('discord.js');
const gameRoleIds = require('../constants/gameRoles');
const { RANKS, highestMemberRank } = require('../utils/levelSystem');
const verificationStore = require('../utils/verificationStore');

const watchedRoleIds = new Set([...gameRoleIds, ...RANKS.map(rank => rank.id)]);

async function removeUnverifiedGameRoles(member) {
    const guildId = process.env.GUILD_ID?.trim();
    const unverifiedRoleId = process.env.UNVERIFIED_ROLE_ID?.trim();
    if (member.user.bot || member.guild.id !== guildId || !unverifiedRoleId) return;
    const verified = !member.roles.cache.has(unverifiedRoleId) &&
        (highestMemberRank(member) || verificationStore.read().verified[member.id]);
    if (verified) return;

    for (const roleId of gameRoleIds) {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId, 'Los roles de juego requieren verificación UABC');
        }
    }
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
            for (const member of members.values()) {
                if (gameRoleIds.some(id => member.roles.cache.has(id))) schedule(member);
            }
        } catch (error) {
            console.error('[Game roles] Could not check existing members:', error);
        }
    });
};

module.exports.removeUnverifiedGameRoles = removeUnverifiedGameRoles;
