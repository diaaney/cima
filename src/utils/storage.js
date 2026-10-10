const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const BACKUP_FILE = path.join(DATA_DIR, 'config.backup.json');
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
function defaultGuildConfig() {
    return {
        voicemaster: { generator_id: null, category_id: null, panel_id: null },
        counting: {
            channel_id: null,
            current_number: 0,
            last_user_id: null,
            active_booster: null,
            active_drop: null,
        },
        welcome: { channel_id: null, featured_channels: [], image_url: null },
        autorole: { role_id: null },
        membercount: { category_id: null },
        personal_colors: {},
    };
}

function defaultGlobal() {
    return {
        user_stats: {},
        afk_users: {},
        react_messages: {},
    };
}

function emptyConfig() {
    return { guilds: {}, global: defaultGlobal() };
}

// Initialize files if they don't exist
if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(emptyConfig(), null, 2));
}

if (!fs.existsSync(ROOMS_FILE)) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify([], null, 2));
}

// ---------------------------------------------------------------------------
// Migration: flat single-guild config -> { guilds: { <id>: {...} }, global: {...} }
// ---------------------------------------------------------------------------
const HOME_MEMBERCOUNT_CATEGORY_ID = '1488847019475730442';

function homeGuildId() {
    return (process.env.GUILD_ID || '')
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)[0] || null;
}

function isLegacyShape(config) {
    // Legacy flat config has no `guilds` key but has top-level feature blocks.
    return config && typeof config === 'object' && !('guilds' in config);
}

function migrateLegacy(legacy) {
    const migrated = emptyConfig();

    // Move global data out
    migrated.global.user_stats = legacy.user_stats || {};
    migrated.global.afk_users = legacy.afk_users || {};
    migrated.global.react_messages = legacy.react_messages || {};

    // Wrap the remaining (guild-scoped) data under the configured home guild
    const gid = homeGuildId();
    if (gid) {
        const g = defaultGuildConfig();
        if (legacy.voicemaster) g.voicemaster = { ...g.voicemaster, ...legacy.voicemaster };
        if (legacy.counting) g.counting = { ...g.counting, ...legacy.counting };
        if (legacy.welcome) g.welcome = { ...g.welcome, ...legacy.welcome };
        if (legacy.autorole) g.autorole = { ...g.autorole, ...legacy.autorole };
        if (legacy.personal_colors) g.personal_colors = legacy.personal_colors;
        // Preserve the previously hardcoded member-count category for the home guild
        g.membercount = { category_id: HOME_MEMBERCOUNT_CATEGORY_ID };
        migrated.guilds[gid] = g;
    }

    return migrated;
}

// ---------------------------------------------------------------------------
// Read / write helpers
// ---------------------------------------------------------------------------
function readConfig() {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    let config = JSON.parse(data);

    if (isLegacyShape(config)) {
        // Back up the legacy file before rewriting it
        fs.writeFileSync(BACKUP_FILE, data);
        config = migrateLegacy(config);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    }

    return config;
}

function writeConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(config, null, 2));
}

function readRooms() {
    const data = fs.readFileSync(ROOMS_FILE, 'utf8');
    return JSON.parse(data);
}

function writeRooms(rooms) {
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
}

// ---------------------------------------------------------------------------
// Guild / global accessors
// ---------------------------------------------------------------------------
// Ensures config.guilds[guildId] exists and has every default sub-key.
// Returns { guild, changed }.
function ensureGuild(config, guildId) {
    if (!config.guilds) config.guilds = {};
    let changed = false;

    if (!config.guilds[guildId]) {
        config.guilds[guildId] = defaultGuildConfig();
        return { guild: config.guilds[guildId], changed: true };
    }

    const g = config.guilds[guildId];
    const d = defaultGuildConfig();
    for (const key of Object.keys(d)) {
        if (g[key] === undefined || g[key] === null) { g[key] = d[key]; changed = true; }
    }
    // Backfill nested fields added over time
    if (!('active_booster' in g.counting)) { g.counting.active_booster = null; changed = true; }
    if (!('active_drop' in g.counting)) { g.counting.active_drop = null; changed = true; }
    if (!Array.isArray(g.welcome.featured_channels)) { g.welcome.featured_channels = []; changed = true; }
    if (!('image_url' in g.welcome)) { g.welcome.image_url = null; changed = true; }

    return { guild: g, changed };
}

function ensureGlobal(config) {
    if (!config.global) { config.global = defaultGlobal(); return { global: config.global, changed: true }; }
    let changed = false;
    if (!config.global.user_stats) { config.global.user_stats = {}; changed = true; }
    if (!config.global.afk_users) { config.global.afk_users = {}; changed = true; }
    if (!config.global.react_messages) { config.global.react_messages = {}; changed = true; }
    return { global: config.global, changed };
}

// ---------------------------------------------------------------------------
// VoiceMaster Config Functions
// ---------------------------------------------------------------------------
function getVoicemasterConfig(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.voicemaster;
}

function setVoicemasterConfig(guildId, generator_id, category_id, panel_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.voicemaster = { generator_id, category_id, panel_id };
    writeConfig(config);
}

// ---------------------------------------------------------------------------
// Active Rooms Functions (keyed by globally-unique channel id, no guild scope)
// ---------------------------------------------------------------------------
function createRoom(channel_id, owner_id) {
    const rooms = readRooms();
    rooms.push({
        channel_id,
        owner_id,
        created_at: new Date().toISOString(),
        claimed_at: null,
    });
    writeRooms(rooms);
}

function deleteRoom(channel_id) {
    const rooms = readRooms();
    const filtered = rooms.filter(room => room.channel_id !== channel_id);
    writeRooms(filtered);
}

function getRoom(channel_id) {
    const rooms = readRooms();
    return rooms.find(room => room.channel_id === channel_id) || null;
}

function isOwner(channel_id, user_id) {
    const room = getRoom(channel_id);
    return room ? room.owner_id === user_id : false;
}

function claimRoom(channel_id, new_owner_id) {
    const rooms = readRooms();
    const room = rooms.find(r => r.channel_id === channel_id);
    if (room) {
        room.owner_id = new_owner_id;
        room.claimed_at = new Date().toISOString();
        writeRooms(rooms);
        return true;
    }
    return false;
}

function getAllRooms() {
    return readRooms();
}

// ---------------------------------------------------------------------------
// Counting Functions (per-guild game state)
// ---------------------------------------------------------------------------
function getCountingConfig(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.counting;
}

function setCountingChannel(guildId, channel_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting = {
        channel_id,
        current_number: 0,
        last_user_id: null,
        active_booster: null,
        active_drop: null,
    };
    writeConfig(config);
}

function updateCount(guildId, new_number, user_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.current_number = new_number;
    guild.counting.last_user_id = user_id;
    writeConfig(config);
}

function resetCount(guildId) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.current_number = 0;
    guild.counting.last_user_id = null;
    guild.counting.active_booster = null;
    writeConfig(config);
}

function getActiveBooster(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.counting.active_booster || null;
}

function setActiveBooster(guildId, booster) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.active_booster = booster;
    writeConfig(config);
}

function clearActiveBooster(guildId) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.active_booster = null;
    writeConfig(config);
}

function applyBoostToCount(guildId, newCount) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.current_number = newCount;
    guild.counting.active_booster = null;
    writeConfig(config);
}

// Item drop functions
function getActiveDrop(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.counting.active_drop || null;
}

function setActiveDrop(guildId, drop) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.active_drop = drop;
    writeConfig(config);
}

function clearActiveDrop(guildId) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.counting.active_drop = null;
    writeConfig(config);
}

// ---------------------------------------------------------------------------
// User stats functions (GLOBAL — inventory + leaderboard span all guilds)
// ---------------------------------------------------------------------------
const DEFAULT_USER_STATS = {
    total_count: 0,
    numbers_counted: 0,
    items: {
        streak_shield: 0,
        perfect_aim: 0,
        sabotage: 0,
        oracle_eye: 0,
    },
    protecting_through: null,
    primed: {
        perfect_aim: false,
        oracle_eye: false,
    },
    sabotaged: false,
};

function defaultStats() {
    return JSON.parse(JSON.stringify(DEFAULT_USER_STATS));
}

function ensureUserStatsObject(config, user_id) {
    const { global } = ensureGlobal(config);
    if (!global.user_stats[user_id]) {
        global.user_stats[user_id] = defaultStats();
        return true;
    }
    // Migrate missing fields
    const stats = global.user_stats[user_id];
    let changed = false;
    if (typeof stats.total_count !== 'number') { stats.total_count = 0; changed = true; }
    if (typeof stats.numbers_counted !== 'number') { stats.numbers_counted = 0; changed = true; }
    if (!stats.items) { stats.items = { ...DEFAULT_USER_STATS.items }; changed = true; }
    for (const key of Object.keys(DEFAULT_USER_STATS.items)) {
        if (typeof stats.items[key] !== 'number') { stats.items[key] = 0; changed = true; }
    }
    if (!('protecting_through' in stats)) { stats.protecting_through = null; changed = true; }
    if (!stats.primed) { stats.primed = { ...DEFAULT_USER_STATS.primed }; changed = true; }
    for (const key of Object.keys(DEFAULT_USER_STATS.primed)) {
        if (typeof stats.primed[key] !== 'boolean') { stats.primed[key] = false; changed = true; }
    }
    if (typeof stats.sabotaged !== 'boolean') { stats.sabotaged = false; changed = true; }
    return changed;
}

function getUserStats(user_id) {
    const config = readConfig();
    const created = ensureUserStatsObject(config, user_id);
    if (created) writeConfig(config);
    return config.global.user_stats[user_id];
}

function getAllUserStats() {
    const config = readConfig();
    const { changed } = ensureGlobal(config);
    if (changed) writeConfig(config);
    return config.global.user_stats || {};
}

function addToTotalCount(user_id, n) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    config.global.user_stats[user_id].total_count += n;
    config.global.user_stats[user_id].numbers_counted += 1;
    writeConfig(config);
}

function addItem(user_id, item_type, qty = 1) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    config.global.user_stats[user_id].items[item_type] =
        (config.global.user_stats[user_id].items[item_type] || 0) + qty;
    writeConfig(config);
}

function removeItem(user_id, item_type, qty = 1) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    const current = config.global.user_stats[user_id].items[item_type] || 0;
    if (current < qty) return false;
    config.global.user_stats[user_id].items[item_type] = current - qty;
    writeConfig(config);
    return true;
}

function primeItem(user_id, item_type) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    config.global.user_stats[user_id].primed[item_type] = true;
    writeConfig(config);
}

function unprimeItem(user_id, item_type) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    config.global.user_stats[user_id].primed[item_type] = false;
    writeConfig(config);
}

function setSabotaged(target_id) {
    const config = readConfig();
    ensureUserStatsObject(config, target_id);
    config.global.user_stats[target_id].sabotaged = true;
    writeConfig(config);
}

function clearSabotaged(target_id) {
    const config = readConfig();
    ensureUserStatsObject(config, target_id);
    config.global.user_stats[target_id].sabotaged = false;
    writeConfig(config);
}

function armShield(user_id, current_number) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    const stats = config.global.user_stats[user_id];
    if (stats.items.streak_shield > 0) {
        stats.protecting_through = current_number + 25;
        writeConfig(config);
        return true;
    }
    return false;
}

function findShieldSaver(current_number) {
    const config = readConfig();
    const { global } = ensureGlobal(config);
    const candidates = [];
    for (const [user_id, stats] of Object.entries(global.user_stats)) {
        if (
            stats.protecting_through !== null &&
            stats.protecting_through !== undefined &&
            current_number <= stats.protecting_through &&
            (stats.items?.streak_shield || 0) >= 1
        ) {
            candidates.push(user_id);
        }
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function consumeShield(user_id) {
    const config = readConfig();
    ensureUserStatsObject(config, user_id);
    const stats = config.global.user_stats[user_id];
    if (stats.items.streak_shield > 0) {
        stats.items.streak_shield -= 1;
        stats.protecting_through = null;
        writeConfig(config);
        return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// AFK Functions (GLOBAL)
// ---------------------------------------------------------------------------
function getAfkUsers() {
    const config = readConfig();
    const { changed } = ensureGlobal(config);
    if (changed) writeConfig(config);
    return config.global.afk_users;
}

function setAfk(user_id, reason) {
    const config = readConfig();
    ensureGlobal(config);
    config.global.afk_users[user_id] = {
        reason: reason || 'no reason provided',
        since: Date.now(),
    };
    writeConfig(config);
}

function removeAfk(user_id) {
    const config = readConfig();
    ensureGlobal(config);
    if (config.global.afk_users[user_id]) {
        delete config.global.afk_users[user_id];
        writeConfig(config);
        return true;
    }
    return false;
}

function isAfk(user_id) {
    const afkUsers = getAfkUsers();
    return afkUsers[user_id] || null;
}

// ---------------------------------------------------------------------------
// Personal Color Roles (per-guild)
// ---------------------------------------------------------------------------
function getPersonalColor(guildId, user_id) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.personal_colors[user_id] || null;
}

function setPersonalColor(guildId, user_id, role_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.personal_colors[user_id] = role_id;
    writeConfig(config);
}

// ---------------------------------------------------------------------------
// Autorole Functions (per-guild)
// ---------------------------------------------------------------------------
function getAutoroleConfig(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.autorole;
}

function setAutoroleConfig(guildId, role_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.autorole = { role_id };
    writeConfig(config);
}

// ---------------------------------------------------------------------------
// Welcome Functions (per-guild)
// ---------------------------------------------------------------------------
function getWelcomeConfig(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.welcome;
}

function setWelcomeChannel(guildId, channel_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.welcome.channel_id = channel_id;
    writeConfig(config);
}

function setWelcomeFeaturedChannels(guildId, channel_ids) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.welcome.featured_channels = (channel_ids || []).filter(Boolean);
    writeConfig(config);
}

function setWelcomeImage(guildId, image_url) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.welcome.image_url = image_url || null;
    writeConfig(config);
}

// ---------------------------------------------------------------------------
// Member Count Functions (per-guild)
// ---------------------------------------------------------------------------
function getMembercountConfig(guildId) {
    const config = readConfig();
    const { guild, changed } = ensureGuild(config, guildId);
    if (changed) writeConfig(config);
    return guild.membercount;
}

function setMembercountCategory(guildId, category_id) {
    const config = readConfig();
    const { guild } = ensureGuild(config, guildId);
    guild.membercount = { category_id };
    writeConfig(config);
}

// ---------------------------------------------------------------------------
// React Messages Functions (GLOBAL)
// ---------------------------------------------------------------------------
function setReactMessage(user_id, emoji, count) {
    const config = readConfig();
    ensureGlobal(config);
    config.global.react_messages[user_id] = { emoji, remaining: count };
    writeConfig(config);
}

function getReactMessage(user_id) {
    const config = readConfig();
    const { changed } = ensureGlobal(config);
    if (changed) writeConfig(config);
    return config.global.react_messages[user_id] || null;
}

function decrementReactMessage(user_id) {
    const config = readConfig();
    ensureGlobal(config);
    if (!config.global.react_messages[user_id]) return;
    config.global.react_messages[user_id].remaining -= 1;
    if (config.global.react_messages[user_id].remaining <= 0) {
        delete config.global.react_messages[user_id];
    }
    writeConfig(config);
}

module.exports = {
    getVoicemasterConfig,
    setVoicemasterConfig,
    createRoom,
    deleteRoom,
    getRoom,
    isOwner,
    claimRoom,
    getAllRooms,
    getCountingConfig,
    setCountingChannel,
    updateCount,
    resetCount,
    getActiveBooster,
    setActiveBooster,
    clearActiveBooster,
    applyBoostToCount,
    getActiveDrop,
    setActiveDrop,
    clearActiveDrop,
    getUserStats,
    getAllUserStats,
    addToTotalCount,
    addItem,
    removeItem,
    primeItem,
    unprimeItem,
    setSabotaged,
    clearSabotaged,
    armShield,
    findShieldSaver,
    consumeShield,
    getAfkUsers,
    setAfk,
    removeAfk,
    isAfk,
    getWelcomeConfig,
    setWelcomeChannel,
    setWelcomeFeaturedChannels,
    setWelcomeImage,
    getMembercountConfig,
    setMembercountCategory,
    setReactMessage,
    getReactMessage,
    decrementReactMessage,
    getAutoroleConfig,
    setAutoroleConfig,
    getPersonalColor,
    setPersonalColor,
    // exposed for tests
    _isLegacyShape: isLegacyShape,
    _migrateLegacy: migrateLegacy,
    _defaultGuildConfig: defaultGuildConfig,
};
