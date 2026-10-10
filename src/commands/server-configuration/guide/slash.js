const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getCountingConfig } = require('../../../utils/storage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('guide')
        .setDescription('server guide and rules management')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('send the server guide to the current channel')
                .addIntegerOption(option =>
                    option
                        .setName('embeds')
                        .setDescription('how many embeds to send (1 = guidelines only, 2 = + commands, 3 = + welcome). default: all')
                        .setMinValue(1)
                        .setMaxValue(3)
                )
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'setup') {
            // Check for admin permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    embeds: [embeds.error('nah, you need administrator permissions to use this command')],
                    ephemeral: true
                });
            }

            // How many embeds to send (default: all 3)
            const embedCount = interaction.options.getInteger('embeds') ?? 3;

            // Defer reply to prevent interaction timeout
            await interaction.deferReply({ ephemeral: true });

            // Animation delay (1200ms)
            await new Promise(resolve => setTimeout(resolve, 1200));

            // Resolve the counting channel dynamically from config
            const countingChannelId = getCountingConfig(interaction.guild.id).channel_id;
            const countingMention = countingChannelId ? `<#${countingChannelId}>` : 'the counting channel';

            // First embed - Guidelines and TOS
            const guidelinesEmbed = new EmbedBuilder()
                .setColor(embeds.NEUTRAL_COLOR)
                .setDescription(`**use your common sense and follow [guidelines](https://discord.com/guidelines) & [tos](https://discord.com/terms)**`);

            // Second embed - Bot commands
            const commandsEmbed = new EmbedBuilder()
                .setColor(embeds.NEUTRAL_COLOR)
                .setTitle('bot commands')
                .setDescription(
                    `**utility**\n` +
                    `• \`/afk\` - set yourself as afk with a reason\n` +
                    `• \`/avatar\` - view someone's avatar\n` +
                    `• \`/banner\` - view someone's banner\n` +
                    `• \`/serverinfo\` - view server information\n` +
                    `• \`/poll\` - create a poll with up to 10 options\n\n` +
                    `**fun**\n` +
                    `• \`/colors\` - get a color role for your profile\n` +
                    `• counting game in ${countingMention}\n\n` +
                    `**voicemaster**\n` +
                    `• join the generator to create your own voice channel\n` +
                    `• use the panel buttons to customize your room`
                );

            // Third embed - Welcome message
            const welcomeEmbed = new EmbedBuilder()
                .setColor(embeds.NEUTRAL_COLOR)
                .setDescription(
                    `welcome to ${interaction.guild.name}! we're happy to have you here ♡\n\n` +
                    `this is a chill place to hang out, chat, and make friends. ` +
                    `feel free to explore the channels, join voice rooms, and participate in our counting game. ` +
                    `if you need help with anything, don't hesitate to ask the staff or use our bot commands!\n\n` +
                    `grab some color roles, customize your voice channel, and most importantly - enjoy your stay! ✧˖°`
                );

            // Send only the requested number of embeds (in order)
            const allEmbeds = [guidelinesEmbed, commandsEmbed, welcomeEmbed];
            await interaction.channel.send({
                embeds: allEmbeds.slice(0, embedCount)
            });

            // Confirm to user
            await interaction.editReply({
                embeds: [embeds.success(`guide sent to ${interaction.channel}! ✨`)]
            });
        }
    }
};
