const { getCountingConfig } = require('../utils/storage');
const {
    awardMessage,
    highestMemberRank,
    rankForLevel,
    synchronizeRank,
} = require('../utils/levelSystem');

module.exports = client => {
    client.on('messageCreate', async message => {
        if (!message.guild || message.guild.id !== process.env.GUILD_ID?.trim()) return;
        if (message.author.bot || !message.member) return;
        if (message.member.roles.cache.has(process.env.UNVERIFIED_ROLE_ID?.trim())) return;
        if (!highestMemberRank(message.member)) return;
        if (getCountingConfig(message.guild.id).channel_id === message.channelId) return;

        const content = message.content.trim();
        if (content.startsWith('!')) return;
        if (content.length < 5 && !message.attachments.size) return;

        try {
            const result = awardMessage(message.guild.id, message.author.id, message.member);
            const previousRank = rankForLevel(result.previousLevel);
            const currentRank = rankForLevel(result.profile.level);
            const { changed } = await synchronizeRank(message.member, result.profile.level);

            if (result.awarded && changed && previousRank.id !== currentRank.id) {
                await message.channel.send({
                    content: `🎉 ${message.author} llegó al nivel **${result.profile.level}** y ahora es **${currentRank.name}**.`,
                    allowedMentions: { users: [message.author.id] },
                }).catch(error => {
                    console.warn('[Levels] No pude anunciar el nuevo rango:', error?.message || error);
                });
            }
        } catch (error) {
            console.error(`[Levels] No pude procesar el mensaje de ${message.author.id}:`, error?.message || error);
        }
    });
};
