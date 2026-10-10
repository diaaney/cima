const { Events } = require('discord.js');

const EMOJI_SOURCE_GUILD_ID = '1488316694941401148';

module.exports = client => {
    async function leaveIfUnauthorized(guild) {
        const allowedId = process.env.GUILD_ID?.trim();
        if (!allowedId || guild.id === allowedId || guild.id === EMOJI_SOURCE_GUILD_ID) return;
        console.warn(`[SingleGuild] Leaving unauthorized guild ${guild.id}`);
        try { await guild.leave(); }
        catch (error) { console.error(`[SingleGuild] Could not leave guild ${guild.id}:`, error); }
    }

    client.once(Events.ClientReady, () => {
        for (const guild of client.guilds.cache.values()) void leaveIfUnauthorized(guild);
    });
    client.on(Events.GuildCreate, guild => { void leaveIfUnauthorized(guild); });
};
