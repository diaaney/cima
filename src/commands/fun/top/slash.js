const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const embeds = require('../../../constants/embeds');
const { getAllUserStats } = require('../../../utils/storage');

function formatNumber(n) {
    return n.toLocaleString('en-US');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('counting leaderboard — top 10 by total count'),

    async execute(interaction) {
        await interaction.deferReply();

        const allStats = getAllUserStats();
        const ranked = Object.entries(allStats)
            .map(([id, s]) => ({ id, total: s.total_count || 0, counted: s.numbers_counted || 0 }))
            .filter(e => e.total > 0)
            .sort((a, b) => b.total - a.total);

        if (ranked.length === 0) {
            const embed = new EmbedBuilder()
                .setColor(embeds.NEUTRAL_COLOR)
                .setDescription('nobody has counted yet. be the first.');
            return interaction.editReply({ embeds: [embed] });
        }

        const top = ranked.slice(0, 10);

        const medals = ['🥇', '🥈', '🥉'];
        const lines = await Promise.all(top.map(async (entry, idx) => {
            const prefix = idx < 3 ? medals[idx] : `**${idx + 1}.**`;
            const user = await interaction.client.users.fetch(entry.id).catch(() => null);
            const name = user ? user.username : `user-${entry.id.slice(-4)}`;
            return `${prefix} ${name} — **${formatNumber(entry.total)}** (${formatNumber(entry.counted)} counts)`;
        }));

        let footer = '';
        const myIndex = ranked.findIndex(e => e.id === interaction.user.id);
        if (myIndex >= 10) {
            const me = ranked[myIndex];
            footer = `\n\nyou: **#${myIndex + 1}** — ${formatNumber(me.total)} total`;
        }

        const embed = new EmbedBuilder()
            .setColor(embeds.NEUTRAL_COLOR)
            .setTitle('🏆 counting leaderboard')
            .setDescription(lines.join('\n') + footer);

        await interaction.editReply({ embeds: [embed] });
    }
};
