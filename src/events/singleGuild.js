const { Events } = require('discord.js');

module.exports = client => {
    async function leaveIfUnauthorized(guild) {
        const allowedId = process.env.GUILD_ID?.trim();
        if (!allowedId || guild.id === allowedId) return;
        console.warn(`[SingleGuild] Leaving unauthorized guild ${guild.id}`);
        try { await guild.leave(); }
        catch (error) { console.error(`[SingleGuild] Could not leave guild ${guild.id}:`, error); }
    }

    client.once(Events.ClientReady, () => {
        for (const guild of client.guilds.cache.values()) void leaveIfUnauthorized(guild);
    });
    client.on(Events.GuildCreate, guild => { void leaveIfUnauthorized(guild); });
};
