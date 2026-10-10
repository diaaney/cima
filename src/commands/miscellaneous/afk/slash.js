const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { setAfk } = require('../../../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('set yourself as afk')
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('reason for being afk')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        const reason = interaction.options.getString('reason') || 'no reason provided';

        // Set user as AFK
        setAfk(interaction.user.id, reason);

        await interaction.editReply({
            embeds: [embeds.success(`aight, set you as afk: **${reason}**`)]
        });
    }
};
