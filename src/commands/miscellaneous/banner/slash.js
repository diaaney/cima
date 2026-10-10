const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('banner')
        .setDescription('check someone\'s banner')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('user to view banner of')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        const targetUser = interaction.options.getUser('user') || interaction.user;

        // Fetch full user to get banner
        const fullUser = await targetUser.fetch();
        const bannerURL = fullUser.bannerURL({ dynamic: true, size: 2048 });

        if (!bannerURL) {
            return interaction.editReply({
                embeds: [embeds.error(`nah, ${targetUser.username} doesn't have a banner set`)]
            });
        }

        const bannerEmbed = new EmbedBuilder()
            .setColor(embeds.NEUTRAL_COLOR)
            .setDescription(`**${targetUser.username}'s banner**`)
            .setImage(bannerURL);

        await interaction.editReply({
            embeds: [bannerEmbed]
        });
    }
};
