const { SlashCommandBuilder } = require('discord.js');
const { buildLeaderboard } = require('../../../utils/leaderboards');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Muestra los 10 primeros de niveles o counting')
        .addStringOption(option => option
            .setName('tipo')
            .setDescription('Clasificación que quieres ver')
            .setRequired(true)
            .addChoices(
                { name: 'Chat y niveles', value: 'chat' },
                { name: 'Counting', value: 'counting' },
            )),

    async execute(interaction) {
        await interaction.deferReply();

        const type = interaction.options.getString('tipo', true);
        await interaction.editReply({
            embeds: [buildLeaderboard(type, interaction.guild, interaction.user.id)],
            allowedMentions: { parse: [] },
        });
    }
};
