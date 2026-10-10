const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { setReactMessage } = require('../../../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reactmessage')
        .setDescription('react with an emoji to the next X messages from a user')
        .addStringOption(option =>
            option
                .setName('emoji')
                .setDescription('the emoji to react with')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName('number')
                .setDescription('how many messages to react to')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('the user whose messages to react to')
                .setRequired(true)
        ),

    async execute(interaction) {
        const emoji = interaction.options.getString('emoji');
        const count = interaction.options.getInteger('number');
        const user = interaction.options.getUser('user');

        if (user.bot) {
            return interaction.reply({
                embeds: [embeds.error('cannot track a bot')],
                ephemeral: true
            });
        }

        setReactMessage(user.id, emoji, count);

        await interaction.reply({
            embeds: [embeds.success(`got it, reacting with ${emoji} to the next **${count}** message${count === 1 ? '' : 's'} from ${user}`)]
        });
    }
};
