const {
    SlashCommandBuilder,
    PermissionFlagsBits,
} = require('discord.js');
const { setCountingChannel } = require('../../../utils/storage');
const embeds = require('../../../constants/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('count')
        .setDescription('Setup counting game in current channel')
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('Enable counting in this channel')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.channel;

        // Show thinking state with random verb
        await interaction.reply({
            embeds: [embeds.thinking()],
            ephemeral: true
        });

        // Set this channel as the counting channel
        setCountingChannel(interaction.guild.id, channel.id);

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Update to success state
        await interaction.editReply({
            embeds: [embeds.success(
                `Counting game enabled in ${channel}!\n\n` +
                `**Rules:**\n` +
                `• Count from 1, 2, 3, etc.\n` +
                `• Each user must take turns (can't count twice in a row)\n` +
                `• If someone sends the wrong number, count resets to 0\n` +
                `• ✅ = Correct | ❌ = Wrong (resets count)`
            )]
        });
    }
};
