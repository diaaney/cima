const { EmbedBuilder } = require('discord.js');
const embeds = require('../constants/embeds');
const { getAllUserStats } = require('./storage');
const { getAllLevelProfiles, levelFromXp } = require('./levelSystem');

const formatNumber = number => number.toLocaleString('es-MX');
const medals = ['🥇', '🥈', '🥉'];

function rankCounting(stats) {
    return Object.entries(stats)
        .map(([id, value]) => ({ id, counted: value.numbers_counted || 0, points: value.total_count || 0 }))
        .filter(entry => entry.counted > 0)
        .sort((a, b) => b.counted - a.counted || b.points - a.points || a.id.localeCompare(b.id));
}

function rankChat(profiles) {
    return Object.entries(profiles)
        .map(([id, value]) => ({ id, xp: value.xp || 0 }))
        .filter(entry => entry.xp > 0)
        .sort((a, b) => b.xp - a.xp || a.id.localeCompare(b.id));
}

function buildLeaderboard(type, guildId, viewerId = null) {
    const isCounting = type === 'counting';
    const ranked = isCounting ? rankCounting(getAllUserStats()) : rankChat(getAllLevelProfiles(guildId));
    const title = isCounting ? '🏆 Top de counting' : '🏆 Top de niveles';
    const lines = ranked.slice(0, 10).map((entry, index) => {
        const place = medals[index] || `**${index + 1}.**`;
        const score = isCounting
            ? `**${formatNumber(entry.counted)}** números · ${formatNumber(entry.points)} puntos`
            : `nivel **${levelFromXp(entry.xp)}** · ${formatNumber(entry.xp)} XP`;
        return `${place} <@${entry.id}> — ${score}`;
    });

    if (lines.length === 0) lines.push(isCounting ? 'Todavía nadie ha contado.' : 'Todavía nadie ha ganado XP.');
    const viewerIndex = viewerId ? ranked.findIndex(entry => entry.id === viewerId) : -1;
    if (viewerIndex >= 10) {
        const entry = ranked[viewerIndex];
        lines.push(`\nTu puesto: **#${viewerIndex + 1}** · ${formatNumber(isCounting ? entry.counted : entry.xp)} ${isCounting ? 'números' : 'XP'}`);
    }

    return new EmbedBuilder()
        .setColor(embeds.NEUTRAL_COLOR)
        .setTitle(title)
        .setDescription(lines.join('\n'));
}

module.exports = { rankCounting, rankChat, buildLeaderboard };
