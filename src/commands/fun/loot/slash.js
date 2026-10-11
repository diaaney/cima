const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getUserStats, getCountingConfig } = require('../../../utils/storage');
const { ITEM_DEFS } = require('../../../utils/itemDrops');

function formatNumber(n) {
    return n.toLocaleString('es-MX');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loot')
        .setDescription('Consulta tu perfil del juego y tu inventario')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('Usuario que quieres consultar (por defecto, tú)')
                .setRequired(false)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('usuario') || interaction.user;
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
            statusBits.push(`🛡 escudo activo hasta el #${stats.protecting_through}`);
        }
        if (stats.primed?.perfect_aim) statusBits.push('🎯 puntería perfecta preparada');
        if (stats.primed?.oracle_eye) statusBits.push('🔮 ojo oráculo preparado');
        if (stats.sabotaged) statusBits.push('💣 saboteado');

        const description = [
            `📊 **${formatNumber(stats.total_count)}** puntos acumulados`,
            `🔢 **${formatNumber(stats.numbers_counted)}** números aportados`,
            '',
            '**Inventario**',
            inventoryLines.length > 0
                ? inventoryLines.join('\n')
                : '_Aún no tienes objetos. Aparecen al azar al contar en el canal de counting; resuelve el reto del premio para reclamarlo. Los puntos y números no se canjean automáticamente._',
            statusBits.length > 0 ? '\n**Estado**\n' + statusBits.map(s => `• ${s}`).join('\n') : '',
        ].filter(Boolean).join('\n');

        const embed = new EmbedBuilder()
            .setColor(embeds.NEUTRAL_COLOR)
            .setAuthor({ name: `Inventario de ${target.username}`, iconURL: target.displayAvatarURL({ size: 128 }) })
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setDescription(description);

        await interaction.editReply({ embeds: [embed] });
    }
};
