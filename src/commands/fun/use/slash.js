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
        .setDescription('Usa un objeto de tu inventario')
        .addStringOption(option =>
            option
                .setName('objeto')
                .setDescription('Objeto que quieres usar')
                .setRequired(true)
                .addChoices(
                    { name: 'puntería perfecta', value: 'perfect_aim' },
                    { name: 'ojo oráculo',  value: 'oracle_eye' },
                    { name: 'sabotaje',    value: 'sabotage' },
                )
        )
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Objetivo (necesario para sabotaje)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const itemType = interaction.options.getString('objeto');
        const target = interaction.options.getUser('usuario');

        const stats = getUserStats(interaction.user.id);
        const owned = stats.items?.[itemType] || 0;
        if (owned < 1) {
            const def = ITEM_DEFS_BY_TYPE[itemType];
            return interaction.reply({
                embeds: [embeds.error(`No tienes ${def?.emoji || ''} **${def?.label || itemType}** en tu inventario.`)],
                ephemeral: true,
            });
        }

        if (itemType === 'sabotage') {
            if (!target) {
                return interaction.reply({
                    embeds: [embeds.error('El sabotaje necesita un objetivo. Indica `usuario:@alguien`.')],
                    ephemeral: true,
                });
            }
            if (target.bot) {
                return interaction.reply({
                    embeds: [embeds.error('No puedes sabotear a un bot.')],
                    ephemeral: true,
                });
            }
            if (target.id === interaction.user.id) {
                return interaction.reply({
                    embeds: [embeds.error('No puedes sabotearte a ti mismo.')],
                    ephemeral: true,
                });
            }
            removeItem(interaction.user.id, 'sabotage', 1);
            setSabotaged(target.id);
            return interaction.reply({
                content: `💣 ${interaction.user} saboteó a ${target}. Su próximo número debe escribirse como una operación (por ejemplo, \`5+3\` en vez de \`8\`).`,
                allowedMentions: { parse: ['users'] },
            });
        }

        if (itemType === 'perfect_aim') {
            primeItem(interaction.user.id, 'perfect_aim');
            return interaction.reply({
                embeds: [embeds.success('🎯 **Puntería perfecta** preparada. Ganarás automáticamente el próximo potenciador que reclames.')],
                ephemeral: true,
            });
        }

        if (itemType === 'oracle_eye') {
            primeItem(interaction.user.id, 'oracle_eye');
            return interaction.reply({
                embeds: [embeds.success('🔮 **Ojo oráculo** preparado. Verás la respuesta del próximo potenciador que reclames.')],
                ephemeral: true,
            });
        }

        return interaction.reply({
            embeds: [embeds.error('Objeto desconocido.')],
            ephemeral: true,
        });
    }
};
