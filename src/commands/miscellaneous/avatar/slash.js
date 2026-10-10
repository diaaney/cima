const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('check someone\'s avatar')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('user to view avatar of')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const avatarURL = targetUser.displayAvatarURL({ dynamic: true, size: 2048 });

        // Create buttons with different sizes
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('128px')
                .setStyle(ButtonStyle.Link)
                .setURL(targetUser.displayAvatarURL({ size: 128 })),
            new ButtonBuilder()
                .setLabel('256px')
                .setStyle(ButtonStyle.Link)
                .setURL(targetUser.displayAvatarURL({ size: 256 })),
            new ButtonBuilder()
                .setLabel('512px')
                .setStyle(ButtonStyle.Link)
                .setURL(targetUser.displayAvatarURL({ size: 512 })),
            new ButtonBuilder()
                .setLabel('1024px')
                .setStyle(ButtonStyle.Link)
                .setURL(targetUser.displayAvatarURL({ size: 1024 })),
            new ButtonBuilder()
                .setLabel('2048px')
                .setStyle(ButtonStyle.Link)
                .setURL(targetUser.displayAvatarURL({ size: 2048 }))
        );

        const avatarEmbed = new EmbedBuilder()
            .setColor(embeds.NEUTRAL_COLOR)
            .setDescription(`**${targetUser.username}'s avatar**`)
            .setImage(avatarURL);

        await interaction.editReply({
            embeds: [avatarEmbed],
            components: [row]
        });
    }
};
