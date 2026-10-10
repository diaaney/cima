const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');

// Regional indicator emojis for poll options
const POLL_EMOJIS = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('create a poll')
        .addStringOption(option =>
            option
                .setName('question')
                .setDescription('poll question')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('option1')
                .setDescription('first option')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('option2')
                .setDescription('second option')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('option3')
                .setDescription('third option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option4')
                .setDescription('fourth option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option5')
                .setDescription('fifth option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option6')
                .setDescription('sixth option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option7')
                .setDescription('seventh option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option8')
                .setDescription('eighth option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option9')
                .setDescription('ninth option')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('option10')
                .setDescription('tenth option')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Defer reply to prevent interaction timeout
        await interaction.deferReply();

        // Animation delay (1200ms)
        await new Promise(resolve => setTimeout(resolve, 1200));

        const question = interaction.options.getString('question');

        // Collect all provided options
        const options = [];
        for (let i = 1; i <= 10; i++) {
            const option = interaction.options.getString(`option${i}`);
            if (option) options.push(option);
        }

        // Build poll description
        let description = `**${question}**\n\n`;
        options.forEach((option, index) => {
            description += `${POLL_EMOJIS[index]} ${option}\n`;
        });

        const pollEmbed = embeds.success(description);

        const pollMessage = await interaction.editReply({
            embeds: [pollEmbed]
        });

        // Add reactions for each option
        for (let i = 0; i < options.length; i++) {
            await pollMessage.react(POLL_EMOJIS[i]);
        }
    }
};
