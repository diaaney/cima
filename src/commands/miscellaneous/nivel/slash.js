const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const {
    getProfile,
    highestMemberRank,
    rankForLevel,
    xpForLevel,
} = require('../../../utils/levelSystem');

async function editLevelReply(interaction, payload) {
    try {
        return await interaction.editReply(payload);
    } catch (error) {
        if (!/Connect Timeout Error/i.test(error?.message || '')) throw error;

        console.warn('[Level] Discord.js agotó el tiempo de conexión; intento enviar la respuesta directamente.');
        const response = await fetch(
            `https://discord.com/api/v10/webhooks/${interaction.applicationId}/${interaction.token}/messages/@original`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ embeds: payload.embeds.map(embed => embed.toJSON()) }),
                signal: AbortSignal.timeout(8000),
            },
        );
        if (!response.ok) throw new Error(`No pude publicar /nivel: Discord respondió ${response.status}`);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nivel')
        .setDescription('Muestra tu nivel y el progreso hacia el siguiente')
        .addUserOption(option => option
            .setName('usuario')
            .setDescription('Miembro cuyo nivel quieres ver')),

    async execute(interaction) {
        await interaction.deferReply();
        if (interaction.guildId !== process.env.GUILD_ID?.trim()) {
            return editLevelReply(interaction, { embeds: [embeds.error('Este comando solo funciona en Nexo UABC.')] });
        }

        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = user.id === interaction.user.id
            ? interaction.member
            : await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member || !highestMemberRank(member)) {
            return editLevelReply(interaction, { embeds: [embeds.info('Esta persona todavía no tiene un rango de niveles.')] });
        }

        const profile = getProfile(interaction.guildId, user.id, member);
        const rank = rankForLevel(profile.level);
        const current = xpForLevel(profile.level);
        const next = xpForLevel(profile.level + 1);
        const progress = profile.xp - current;
        const needed = next - current;
        const filled = Math.floor(progress / needed * 10);
        const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
        return editLevelReply(interaction, {
            embeds: [embeds.info(
                `**${user.username}** · nivel **${profile.level}**\n` +
                `Rango: **${rank.name}**\n` +
                `${bar} **${progress}/${needed} XP** para el nivel ${profile.level + 1}\n` +
                `Counting: **${profile.countingNumbers % 10}/10** números para +20 XP`
            )],
        });
    },
};
