const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const {
    getUserStats,
    removeItem,
    primeItem,
    setSabotaged,
} = require('../../../utils/storage');
const { ITEM_DEFS_BY_TYPE } = require('../../../utils/itemDrops');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('use an item from your inventory')
        .addStringOption(option =>
            option
                .setName('item')
                .setDescription('item to use')
                .setRequired(true)
                .addChoices(
                    { name: 'perfect aim', value: 'perfect_aim' },
                    { name: 'oracle eye',  value: 'oracle_eye' },
                    { name: 'sabotage',    value: 'sabotage' },
                )
        )
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('target (required for sabotage)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const itemType = interaction.options.getString('item');
        const target = interaction.options.getUser('user');

        const stats = getUserStats(interaction.user.id);
        const owned = stats.items?.[itemType] || 0;
        if (owned < 1) {
            const def = ITEM_DEFS_BY_TYPE[itemType];
            return interaction.reply({
                embeds: [embeds.error(`you don't have any ${def?.emoji || ''} **${def?.label || itemType}** in your inventory`)],
                ephemeral: true,
            });
        }

        if (itemType === 'sabotage') {
            if (!target) {
                return interaction.reply({
                    embeds: [embeds.error('sabotage needs a target. pass `user:@someone`')],
                    ephemeral: true,
                });
            }
            if (target.bot) {
                return interaction.reply({
                    embeds: [embeds.error('can\'t sabotage a bot.')],
                    ephemeral: true,
                });
            }
            if (target.id === interaction.user.id) {
                return interaction.reply({
                    embeds: [embeds.error('sabotaging yourself? real one. but no.')],
                    ephemeral: true,
                });
            }
            removeItem(interaction.user.id, 'sabotage', 1);
            setSabotaged(target.id);
            return interaction.reply({
                content: `💣 ${interaction.user} just sabotaged ${target} — their next count attempt must be a math expression (e.g. \`5+3\` instead of \`8\`)`,
                allowedMentions: { parse: ['users'] },
            });
        }

        if (itemType === 'perfect_aim') {
            primeItem(interaction.user.id, 'perfect_aim');
            return interaction.reply({
                embeds: [embeds.success('🎯 **perfect aim** armed. your next booster claim auto-wins.')],
                ephemeral: true,
            });
        }

        if (itemType === 'oracle_eye') {
            primeItem(interaction.user.id, 'oracle_eye');
            return interaction.reply({
                embeds: [embeds.success('🔮 **oracle eye** armed. your next booster claim will whisper the answer to you.')],
                ephemeral: true,
            });
        }

        return interaction.reply({
            embeds: [embeds.error('unknown item.')],
            ephemeral: true,
        });
    }
};
