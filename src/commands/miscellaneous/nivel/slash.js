const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const embeds = require('../../../constants/embeds');
const {
    getProfile,
    highestMemberRank,
    rankForLevel,
    xpForLevel,
} = require('../../../utils/levelSystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nivel')
        .setDescription('Muestra tu nivel y el progreso hacia el siguiente')
        .addUserOption(option => option
            .setName('usuario')
            .setDescription('Miembro cuyo nivel quieres ver')),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        if (interaction.guildId !== process.env.GUILD_ID?.trim()) {
            return interaction.editReply({ embeds: [embeds.error('Este comando solo funciona en Nexo UABC.')] });
        }

        const user = interaction.options.getUser('usuario') || interaction.user;
        const member = user.id === interaction.user.id
            ? interaction.member
            : await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member || !highestMemberRank(member)) {
            return interaction.editReply({ embeds: [embeds.info('Esta persona todavía no tiene un rango de niveles.')] });
        }

        const profile = getProfile(interaction.guildId, user.id, member);
        const rank = rankForLevel(profile.level);
        const current = xpForLevel(profile.level);
        const next = xpForLevel(profile.level + 1);
        const progress = profile.xp - current;
        const needed = next - current;
        const filled = Math.floor(progress / needed * 10);
        const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
        return interaction.editReply({
            embeds: [embeds.info(
                `**${user.username}** · nivel **${profile.level}**\n` +
                `Rango: **${rank.name}**\n` +
                `${bar} **${progress}/${needed} XP** para el nivel ${profile.level + 1}`
            )],
        });
    },
};
