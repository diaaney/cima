const fs = require('node:fs');
const path = require('node:path');

const RANKS = Object.freeze([
    { level: 0, id: process.env.ASPIRANTE_ROLE_ID?.trim() || '1558422865085206648', name: 'Aspirante', emoji: 'level_aspirante' },
    { level: 2, id: '1558422919565156442', name: 'Nuevo Ingreso', emoji: 'level_nuevo_ingreso' },
    { level: 5, id: '1558422939450212513', name: 'Cimarrón Novato', emoji: 'level_cimarron_novato' },
    { level: 8, id: '1558422961181163531', name: 'Cimarrón Aplicado', emoji: 'level_cimarron_aplicado' },
    { level: 14, id: '1558422983024840814', name: 'Cimarrón Avanzado', emoji: 'level_cimarron_avanzado' },
    { level: 20, id: '1558423003807621160', name: 'Cimarrón Veterano', emoji: 'level_cimarron_veterano' },
    { level: 26, id: '1558423025777377320', name: 'Orgullo Cimarrón', emoji: 'level_orgullo_cimarron' },
    { level: 32, id: '1558423056899248179', name: 'Leyenda Cimarrona', emoji: 'level_leyenda_cimarrona' },
]);

const XP_PER_MESSAGE = 20;
const BOOSTER_ROLE_ID = process.env.BOOSTER_ROLE_ID?.trim() || '1517433768045183132';
const BOOSTER_XP_MULTIPLIER = 3;
const UABC_GUILD_ID = '1512970933399195658';
const UABC_TAG_XP_MULTIPLIER = 2;
const COOLDOWN_MS = 60_000;

function hasUabcTag(member) {
    const primaryGuild = member?.user?.primaryGuild;
    return primaryGuild?.identityEnabled === true
        && primaryGuild.identityGuildId === UABC_GUILD_ID
        && primaryGuild.tag?.toUpperCase() === 'UABC';
}

function xpForMember(member) {
    const multiplier = member?.roles.cache.has(BOOSTER_ROLE_ID)
        ? BOOSTER_XP_MULTIPLIER
        : hasUabcTag(member) ? UABC_TAG_XP_MULTIPLIER : 1;
    return XP_PER_MESSAGE * multiplier;
}

function xpForLevel(level) {
    return 50 * level * (level + 1);
}

function levelFromXp(xp) {
    let level = 0;
    while (xp >= xpForLevel(level + 1)) level++;
    return level;
}

function rankForLevel(level) {
    return [...RANKS].reverse().find(rank => level >= rank.level);
}

function highestMemberRank(member) {
    return [...RANKS].reverse().find(rank => member.roles.cache.has(rank.id)) || null;
}

function storePath(guildId) {
    if (process.env.LEVEL_STORE_FILE) return process.env.LEVEL_STORE_FILE;
    if (!/^\d+$/.test(guildId)) throw new Error('Invalid guild ID for level storage');
    return path.join(__dirname, '../../data', `levels-${guildId}.json`);
}

function readStore(guildId) {
    try {
        return JSON.parse(fs.readFileSync(storePath(guildId), 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

function writeStore(guildId, data) {
    const filename = storePath(guildId);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data, null, 2));
    fs.renameSync(temporary, filename);
}

function getProfile(guildId, userId, member = null) {
    const saved = readStore(guildId)[userId];
    const baseline = member ? highestMemberRank(member) : null;
    const xp = saved?.xp ?? xpForLevel(baseline?.level ?? 0);
    return {
        xp,
        level: levelFromXp(xp),
        lastAwardedAt: saved?.lastAwardedAt ?? 0,
        countingNumbers: saved?.countingNumbers ?? 0,
    };
}

function getAllLevelProfiles(guildId) {
    return readStore(guildId);
}

function awardMessage(guildId, userId, member, now = Date.now()) {
    const data = readStore(guildId);
    const current = data[userId] || {
        xp: xpForLevel(highestMemberRank(member)?.level ?? 0),
        lastAwardedAt: 0,
        countingNumbers: 0,
    };
    const previousLevel = levelFromXp(current.xp);
    if (current.lastAwardedAt && now - current.lastAwardedAt < COOLDOWN_MS) {
        return { awarded: false, previousLevel, profile: { ...current, level: previousLevel } };
    }

    const updated = { ...current, xp: current.xp + xpForMember(member), lastAwardedAt: now };
    data[userId] = updated;
    writeStore(guildId, data);
    return {
        awarded: true,
        previousLevel,
        profile: { ...updated, level: levelFromXp(updated.xp) },
    };
}

function awardCountingNumber(guildId, userId, member) {
    const data = readStore(guildId);
    const current = data[userId] || {
        xp: xpForLevel(highestMemberRank(member)?.level ?? 0),
        lastAwardedAt: 0,
        countingNumbers: 0,
    };
    const previousLevel = levelFromXp(current.xp);
    const countingNumbers = (current.countingNumbers || 0) + 1;
    const awarded = countingNumbers % 10 === 0;
    const updated = {
        ...current,
        countingNumbers,
        xp: current.xp + (awarded ? xpForMember(member) : 0),
    };
    data[userId] = updated;
    writeStore(guildId, data);
    return { awarded, previousLevel, profile: { ...updated, level: levelFromXp(updated.xp) } };
}

async function synchronizeRank(member, level) {
    const target = rankForLevel(level);
    const previous = highestMemberRank(member);
    if (!member.roles.cache.has(target.id)) {
        await member.roles.add(target.id, `Cima: nivel ${level}`);
    }
    for (const rank of RANKS) {
        if (rank.id !== target.id && member.roles.cache.has(rank.id)) {
            await member.roles.remove(rank.id, `Cima: nivel ${level}`);
        }
    }
    return { target, changed: previous?.id !== target.id };
}

module.exports = {
    RANKS,
    XP_PER_MESSAGE,
    BOOSTER_ROLE_ID,
    BOOSTER_XP_MULTIPLIER,
    UABC_TAG_XP_MULTIPLIER,
    hasUabcTag,
    xpForMember,
    COOLDOWN_MS,
    xpForLevel,
    levelFromXp,
    rankForLevel,
    highestMemberRank,
    getProfile,
    getAllLevelProfiles,
    awardMessage,
    awardCountingNumber,
    synchronizeRank,
};
