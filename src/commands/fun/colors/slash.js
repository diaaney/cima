const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('colors')
        .setDescription('Pick your own personal color or gradient!'),

    async execute(interaction) {
        const solidBtn = new ButtonBuilder()
            .setCustomId('colors_pick_solid')
            .setLabel('just one color')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎨');

        const gradientBtn = new ButtonBuilder()
            .setCustomId('colors_pick_gradient')
            .setLabel('gradient (2 colors)')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🌈');

        const row = new ActionRowBuilder().addComponents(solidBtn, gradientBtn);

        await interaction.reply({
            embeds: [embeds.success('**what\'s your vibe today?**\n\nwanna keep it chill with one color, or go a lil extra with a gradient? pick whatever feels right ↓\n\n*just drop the hex code(s) in the next pop-up.*')],
            components: [row]
        });
    }
};
