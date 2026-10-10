const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getUserStats, getCountingConfig } = require('../../../utils/storage');
const { ITEM_DEFS } = require('../../../utils/itemDrops');

function formatNumber(n) {
    return n.toLocaleString('en-US');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loot')
        .setDescription('check your counting profile and inventory')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('user to inspect (default: you)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('user') || interaction.user;
        const stats = getUserStats(target.id);
        const counting = getCountingConfig(interaction.guild.id);
        const currentNumber = counting.current_number || 0;

        const inventoryLines = ITEM_DEFS
            .map(def => ({ def, qty: stats.items?.[def.type] || 0 }))
            .filter(({ qty }) => qty > 0)
            .map(({ def, qty }) => `${def.emoji} **${def.label}** × ${qty}`);

        const statusBits = [];
        if (
            stats.protecting_through !== null &&
            stats.protecting_through !== undefined &&
            currentNumber <= stats.protecting_through
        ) {
            statusBits.push(`🛡 protecting through #${stats.protecting_through}`);
        }
        if (stats.primed?.perfect_aim) statusBits.push('🎯 primed for perfect aim');
        if (stats.primed?.oracle_eye) statusBits.push('🔮 primed for oracle eye');
        if (stats.sabotaged) statusBits.push('💣 sabotaged');

        const description = [
            `📊 **${formatNumber(stats.total_count)}** total counted`,
            `🔢 **${formatNumber(stats.numbers_counted)}** numbers contributed`,
            '',
            '**inventory**',
            inventoryLines.length > 0 ? inventoryLines.join('\n') : '_empty_',
            statusBits.length > 0 ? '\n**status**\n' + statusBits.map(s => `• ${s}`).join('\n') : '',
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setColor(embeds.NEUTRAL_COLOR)
            .setAuthor({ name: `${target.username}'s loot`, iconURL: target.displayAvatarURL({ size: 128 }) })
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setDescription(description);

        await interaction.editReply({ embeds: [embed] });
    }
};
