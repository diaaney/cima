const { database } = require('./database');
const { ChannelType } = require('discord.js');
const { CATEGORY_ID, STAFF_ROLE_IDS } = require('../constants/tickets');
const { getCountingConfig, getWelcomeConfig } = require('./storage');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MESSAGE_COOLDOWN_MS = 60_000;
const REPLY_COOLDOWN_MS = 5 * 60_000;
let initialized = false;

function weekStart(time = Date.now()) {
    const date = new Date(time);
    const day = (date.getUTCDay() + 6) % 7;
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day);
}

function setup() {
    const db = database();
    if (initialized) return db;
    db.exec(`
        CREATE TABLE IF NOT EXISTS staff_activity_settings (
            guild_id TEXT PRIMARY KEY,
            goal INTEGER NOT NULL DEFAULT 20 CHECK (goal BETWEEN 1 AND 500),
            started_week INTEGER NOT NULL,
            last_reviewed_week INTEGER,
            suggestions_forum_id TEXT
        );
        CREATE TABLE IF NOT EXISTS staff_activity_members (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            eligible_week INTEGER NOT NULL,
            last_message_at INTEGER NOT NULL DEFAULT 0,
            last_reply_at INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, user_id)
        );
        CREATE TABLE IF NOT EXISTS staff_activity_weeks (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            week_start INTEGER NOT NULL,
            messages INTEGER NOT NULL DEFAULT 0,
            replies INTEGER NOT NULL DEFAULT 0,
            welcomes INTEGER NOT NULL DEFAULT 0,
            suggestions INTEGER NOT NULL DEFAULT 0,
            claims INTEGER NOT NULL DEFAULT 0,
            closes INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (guild_id, user_id, week_start)
        );
        CREATE TABLE IF NOT EXISTS staff_activity_reviews (
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            week_start INTEGER NOT NULL,
            points INTEGER NOT NULL,
            goal INTEGER NOT NULL,
            role_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('ok', 'removed', 'exempt', 'error')),
            PRIMARY KEY (guild_id, user_id, week_start)
        );
        CREATE TABLE IF NOT EXISTS staff_activity_events (
            guild_id TEXT NOT NULL,
            event_key TEXT NOT NULL,
            PRIMARY KEY (guild_id, event_key)
        );
    `);
    const columns = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
    const settingColumns = columns('staff_activity_settings');
    if (!settingColumns.has('suggestions_forum_id')) db.exec('ALTER TABLE staff_activity_settings ADD COLUMN suggestions_forum_id TEXT');
    const memberColumns = columns('staff_activity_members');
    if (!memberColumns.has('last_reply_at')) db.exec('ALTER TABLE staff_activity_members ADD COLUMN last_reply_at INTEGER NOT NULL DEFAULT 0');
    const weekColumns = columns('staff_activity_weeks');
    for (const metric of ['replies', 'welcomes', 'suggestions']) {
        if (!weekColumns.has(metric)) db.exec(`ALTER TABLE staff_activity_weeks ADD COLUMN ${metric} INTEGER NOT NULL DEFAULT 0`);
    }
    initialized = true;
    return db;
}

function settings(guildId) {
    const db = setup();
    db.prepare('INSERT OR IGNORE INTO staff_activity_settings (guild_id, started_week) VALUES (?, ?)')
        .run(guildId, weekStart());
    return db.prepare('SELECT * FROM staff_activity_settings WHERE guild_id = ?').get(guildId);
}

function setGoal(guildId, goal) {
    settings(guildId);
    setup().prepare('UPDATE staff_activity_settings SET goal = ? WHERE guild_id = ?').run(goal, guildId);
}

function setSuggestionsForum(guildId, channelId) {
    settings(guildId);
    setup().prepare('UPDATE staff_activity_settings SET suggestions_forum_id = ? WHERE guild_id = ?')
        .run(channelId, guildId);
}

function trackMember(member, now = Date.now()) {
    if (member.user.bot || !STAFF_ROLE_IDS.some(id => member.roles.cache.has(id))) return;
    settings(member.guild.id);
    setup().prepare(`
        INSERT OR IGNORE INTO staff_activity_members (guild_id, user_id, eligible_week)
        VALUES (?, ?, ?)
    `).run(member.guild.id, member.id, weekStart(now) + WEEK_MS);
}

function forgetMember(guildId, userId) {
    setup().prepare('DELETE FROM staff_activity_members WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
}

function suggestionsForumId(guild) {
    return settings(guild.id).suggestions_forum_id || guild.channels.cache.find(channel =>
        channel.type === ChannelType.GuildForum && /sugerenc/i.test(channel.name))?.id || null;
}

function once(guildId, eventKey) {
    return Boolean(setup().prepare('INSERT OR IGNORE INTO staff_activity_events (guild_id, event_key) VALUES (?, ?)')
        .run(guildId, eventKey).changes);
}

async function countMessage(message) {
    if (!message.guild || message.author.bot || !message.member) return;
    if (!STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id))) return;
    if (message.content.trim().length < 5 || message.content.startsWith('!')) return;
    if (message.channel.parentId === CATEGORY_ID) return;
    if (getCountingConfig(message.guild.id).channel_id === message.channelId) return;
    const now = message.createdTimestamp;
    trackMember(message.member, now);
    const forumId = suggestionsForumId(message.guild);
    if (message.channel.isThread() && message.channel.parentId === forumId) {
        if (message.channel.ownerId === message.author.id || message.id === message.channel.id) return;
        const day = Math.floor(now / 86_400_000);
        if (once(message.guild.id, `suggestion:${message.author.id}:${message.channel.id}:${day}`)) {
            addMetric(message.guild.id, message.author.id, 'suggestions', now);
        }
        return;
    }
    if (message.channel.isThread()) return;

    if (message.reference?.messageId) {
        const repliedTo = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (repliedTo && !repliedTo.author.bot && repliedTo.author.id !== message.author.id) {
            const updated = setup().prepare(`
                UPDATE staff_activity_members SET last_reply_at = ?
                WHERE guild_id = ? AND user_id = ? AND last_reply_at <= ?
            `).run(now, message.guild.id, message.author.id, now - REPLY_COOLDOWN_MS);
            if (updated.changes && once(message.guild.id, `reply:${message.id}`)) {
                addMetric(message.guild.id, message.author.id, 'replies', now);
            }
            return;
        }
    }
    if (message.channelId === getWelcomeConfig(message.guild.id).channel_id) return;
    const db = setup();
    const updated = db.prepare(`
        UPDATE staff_activity_members SET last_message_at = ?
        WHERE guild_id = ? AND user_id = ? AND last_message_at <= ?
    `).run(now, message.guild.id, message.author.id, now - MESSAGE_COOLDOWN_MS);
    if (!updated.changes) return;
    addMetric(message.guild.id, message.author.id, 'messages', now);
}

function countWelcome(message, newcomerId) {
    if (!newcomerId || !message.guild || !message.member ||
        !STAFF_ROLE_IDS.some(id => message.member.roles.cache.has(id))) return;
    trackMember(message.member, message.createdTimestamp);
    const key = `welcome:${message.author.id}:${newcomerId}:${weekStart(message.createdTimestamp)}`;
    if (once(message.guild.id, key)) addMetric(message.guild.id, message.author.id, 'welcomes', message.createdTimestamp);
}

function addMetric(guildId, userId, metric, now = Date.now()) {
    if (!['messages', 'replies', 'welcomes', 'suggestions', 'claims', 'closes'].includes(metric)) {
        throw new Error('Invalid staff activity metric');
    }
    const db = setup();
    db.prepare(`
        INSERT INTO staff_activity_weeks (guild_id, user_id, week_start, ${metric}) VALUES (?, ?, ?, 1)
        ON CONFLICT(guild_id, user_id, week_start) DO UPDATE SET ${metric} = ${metric} + 1
    `).run(guildId, userId, weekStart(now));
}

function metrics(guildId, userId, start = weekStart()) {
    const db = setup();
    const weekly = db.prepare(`
        SELECT messages, replies, welcomes, suggestions, claims, closes FROM staff_activity_weeks
        WHERE guild_id = ? AND user_id = ? AND week_start = ?
    `).get(guildId, userId, start) || { messages: 0, replies: 0, welcomes: 0, suggestions: 0, claims: 0, closes: 0 };
    const total = db.prepare(`
        SELECT COALESCE(SUM(messages), 0) AS messages, COALESCE(SUM(claims), 0) AS claims,
               COALESCE(SUM(closes), 0) AS closes, COALESCE(SUM(replies), 0) AS replies,
               COALESCE(SUM(welcomes), 0) AS welcomes, COALESCE(SUM(suggestions), 0) AS suggestions
        FROM staff_activity_weeks WHERE guild_id = ? AND user_id = ?
    `).get(guildId, userId);
    return { weekly, total };
}

function points(value) {
    return value.messages + value.replies * 3 + value.welcomes * 3 +
        value.suggestions * 4 + value.claims * 2 + value.closes;
}

function trackedMembers(guildId) {
    return setup().prepare('SELECT * FROM staff_activity_members WHERE guild_id = ?').all(guildId);
}

function review(guildId, userId, start, value, goal, roleId, status) {
    setup().prepare(`
        INSERT INTO staff_activity_reviews (guild_id, user_id, week_start, points, goal, role_id, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id, week_start) DO UPDATE SET
            points = excluded.points, goal = excluded.goal, role_id = excluded.role_id, status = excluded.status
    `).run(guildId, userId, start, points(value), goal, roleId, status);
}

function reviews(guildId, start) {
    return setup().prepare('SELECT * FROM staff_activity_reviews WHERE guild_id = ? AND week_start = ?')
        .all(guildId, start);
}

function markReviewed(guildId, start) {
    setup().prepare('UPDATE staff_activity_settings SET last_reviewed_week = ? WHERE guild_id = ?')
        .run(start, guildId);
}

module.exports = {
    WEEK_MS, weekStart, settings, setGoal, setSuggestionsForum, suggestionsForumId,
    trackMember, forgetMember, countMessage, countWelcome, addMetric, metrics, points,
    trackedMembers, review, reviews, markReviewed,
};
