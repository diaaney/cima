const { EmbedBuilder } = require('discord.js');
const { getAllUserStats } = require('./storage');
const { getAllLevelProfiles, levelFromXp, rankForLevel, highestMemberRank } = require('./levelSystem');

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

function buildLeaderboard(type, guild, viewerId = null) {
    const isCounting = type === 'counting';
    const profiles = getAllLevelProfiles(guild.id);
    const ranked = isCounting ? rankCounting(getAllUserStats()) : rankChat(profiles);
    const title = isCounting ? '🏆 Top de counting' : '🏆 Top de chat y niveles';
    const levelOf = entry => {
        const saved = profiles[entry.id];
        if (saved) return levelFromXp(saved.xp || 0);
        const member = guild.members.cache.get(entry.id);
        return member ? highestMemberRank(member)?.level ?? 0 : 0;
    };
    const rankIcon = entry => {
        const name = rankForLevel(levelOf(entry))?.emoji;
        const emoji = guild.emojis.cache.find(item => item.name === name);
        return emoji ? `<:${emoji.name}:${emoji.id}> ` : '';
    };
    const row = (entry, index) => {
        const place = medals[index] || `**${index + 1}.**`;
        const score = isCounting
            ? `**${formatNumber(entry.counted)}** números · ${formatNumber(entry.points)} puntos`
            : `**Nv. ${levelOf(entry)}** · ${formatNumber(entry.xp)} XP`;
        return `${place} ${rankIcon(entry)}<@${entry.id}>  ·  ${score}`;
    };
    const top = ranked.slice(0, 10);
    const podium = top.slice(0, 3).map(row);
    const rest = top.slice(3).map((entry, index) => row(entry, index + 3));
    const sections = [];
    if (podium.length) sections.push(`**PODIO**\n${podium.join('\n')}`);
    if (rest.length) sections.push(`**CLASIFICACIÓN**\n${rest.join('\n')}`);
    if (!top.length) sections.push(isCounting ? 'Todavía nadie ha contado.' : 'Todavía nadie ha ganado XP.');

    const viewerIndex = viewerId ? ranked.findIndex(entry => entry.id === viewerId) : -1;
    if (viewerIndex >= 10) {
        const entry = ranked[viewerIndex];
        sections.push(`**TU POSICIÓN**\n${rankIcon(entry)}<@${entry.id}>  ·  **#${viewerIndex + 1}**  ·  ${formatNumber(isCounting ? entry.counted : entry.xp)} ${isCounting ? 'números' : 'XP'}`);
    }

    return new EmbedBuilder()
        .setColor(isCounting ? '#51B7AE' : '#E9AD50')
        .setTitle(title)
        .setDescription(sections.join('\n\n'))
        .setFooter({ text: isCounting ? 'Cada número cuenta para subir en el ranking' : 'Gana XP al participar en la comunidad' });
}

module.exports = { rankCounting, rankChat, buildLeaderboard };
