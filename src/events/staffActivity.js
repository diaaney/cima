const { Events, PermissionFlagsBits } = require('discord.js');
const { STAFF_ROLE_IDS } = require('../constants/tickets');
const activity = require('../utils/staffActivity');

async function reviewWeek(guild, start, goal) {
    let failed = false;
    for (const tracked of activity.trackedMembers(guild.id)) {
        if (tracked.eligible_week > start) continue;
        const member = await guild.members.fetch(tracked.user_id).catch(() => null);
        if (!member) {
            activity.forgetMember(guild.id, tracked.user_id);
            continue;
        }
        const roles = STAFF_ROLE_IDS.filter(id => member.roles.cache.has(id));
        if (!roles.length) {
            activity.forgetMember(guild.id, tracked.user_id);
            continue;
        }
        const weekly = activity.metrics(guild.id, member.id, start).weekly;
        const roleId = roles.map(id => guild.roles.cache.get(id)).filter(Boolean)
            .sort((a, b) => b.position - a.position)[0]?.id || roles[0];
        if (member.permissions.has(PermissionFlagsBits.Administrator)) {
            activity.review(guild.id, member.id, start, weekly, goal, roleId, 'exempt');
        } else if (activity.points(weekly) >= goal) {
            activity.review(guild.id, member.id, start, weekly, goal, roleId, 'ok');
        } else {
            try {
                await member.roles.remove(roles, `Actividad semanal: ${activity.points(weekly)}/${goal} puntos`);
                activity.review(guild.id, member.id, start, weekly, goal, roleId, 'removed');
                activity.forgetMember(guild.id, member.id);
                console.log(`[Staff activity] Removed inactive staff roles from ${member.id}`);
            } catch (error) {
                failed = true;
                activity.review(guild.id, member.id, start, weekly, goal, roleId, 'error');
                console.error(`[Staff activity] Could not remove roles from ${member.id}:`, error);
            }
        }
    }
    if (!failed) activity.markReviewed(guild.id, start);
    return !failed;
}

module.exports = client => {
    let reviewing = false;
    async function runReview() {
        if (reviewing) return;
        reviewing = true;
        try {
            const guild = client.guilds.cache.get(process.env.GUILD_ID?.trim());
            if (!guild) return;
            const config = activity.settings(guild.id);
            const current = activity.weekStart();
            const firstFullWeek = config.started_week + activity.WEEK_MS;
            let next = config.last_reviewed_week === null
                ? firstFullWeek : config.last_reviewed_week + activity.WEEK_MS;
            while (next < current) {
                if (!await reviewWeek(guild, next, config.goal)) break;
                next += activity.WEEK_MS;
            }
        } catch (error) {
            console.error('[Staff activity] Weekly review failed:', error);
        } finally {
            reviewing = false;
        }
    }

    client.once(Events.ClientReady, () => {
        const guild = client.guilds.cache.get(process.env.GUILD_ID?.trim());
        if (guild) activity.settings(guild.id);
        void (async () => {
            if (guild) {
                try {
                    const members = await guild.members.fetch();
                    for (const member of members.values()) activity.trackMember(member);
                } catch (error) {
                    console.error('[Staff activity] Could not load staff roster:', error);
                    return;
                }
            }
            await runReview();
        })();
        setInterval(() => { void runReview(); }, 60 * 60 * 1000);
    });
    client.on(Events.MessageCreate, message => {
        if (message.guild?.id !== process.env.GUILD_ID?.trim()) return;
        try { activity.countMessage(message); }
        catch (error) { console.error('[Staff activity] Could not count message:', error); }
    });
    client.on(Events.GuildMemberUpdate, (before, after) => {
        if (after.guild.id !== process.env.GUILD_ID?.trim()) return;
        const had = STAFF_ROLE_IDS.some(id => before.roles.cache.has(id));
        const has = STAFF_ROLE_IDS.some(id => after.roles.cache.has(id));
        try {
            if (!had && has) activity.trackMember(after);
            if (had && !has) activity.forgetMember(after.guild.id, after.id);
        } catch (error) { console.error('[Staff activity] Could not update staff membership:', error); }
    });
    client.on(Events.GuildMemberRemove, member => {
        if (member.guild.id === process.env.GUILD_ID?.trim()) activity.forgetMember(member.guild.id, member.id);
    });
};

module.exports.reviewWeek = reviewWeek;
