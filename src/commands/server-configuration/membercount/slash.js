const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { setMembercountCategory } = require('../../../utils/storage');
const { updateCategoryName } = require('../../../events/memberCount');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('membercount')
        .setDescription('show the live member count on a category name')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('setup')
                .setDescription('pick the category that displays this server\'s member count')
                .addChannelOption(opt =>
                    opt.setName('category')
                        .setDescription('the category channel to display the count on')
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'setup') return;

        const category = interaction.options.getChannel('category');

        await interaction.reply({ embeds: [embeds.thinking()], ephemeral: true });

        setMembercountCategory(interaction.guild.id, category.id);
        await updateCategoryName(interaction.guild);

        await interaction.editReply({
            embeds: [embeds.success(
                `member count is now shown on **${category.name}** ✨\n` +
                `it updates whenever someone joins or leaves.`
            )]
        });
    }
};
