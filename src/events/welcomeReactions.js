const { Events } = require('discord.js');
const { getWelcomeConfig } = require('../utils/storage');
const { getAllLevelProfiles } = require('../utils/levelSystem');

const EMOJI_IDS = Object.freeze([
    '1559753243750309939', // esaaa
    '1559754318549229629', // SoloLegends_enamorao
    '1559754369803489421', // SoloLegends_aquiestoy
]);
const RECENT_JOIN_MS = 24 * 60 * 60 * 1000;
const RECENT_FIRST_MESSAGE_MS = 15 * 60 * 1000;
const CONTEXT_MS = 10 * 60 * 1000;
const recentFirstMessages = new Map();
const seenAuthors = new Set();

function saysWlc(content) {
    return /(?:^|[^\p{L}\p{N}])wlc(?:$|[^\p{L}\p{N}])/iu.test(content);
}

function isGreeting(content) {
    return /\b(?:bienvenid[oa]s?|hola+|holi|saludos|welcome|wlc)\b/iu.test(content);
}

function isExplicitWelcome(content) {
    return /\b(?:bienvenid[oa]s?|welcome|wlc)\b/iu.test(content);
}

function rememberFirstMessage(message, now) {
    if (seenAuthors.has(message.author.id)) return;
    seenAuthors.add(message.author.id);
    if (getAllLevelProfiles(message.guild.id)[message.author.id]) return;
    recentFirstMessages.set(message.author.id, { channelId: message.channelId, at: now });
}

async function greetedNewcomer(message, now) {
    const targetIds = new Set(message.mentions.users.keys());
    if (message.reference?.messageId) {
        const repliedTo = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (repliedTo) {
            targetIds.add(repliedTo.author.id);
            for (const id of repliedTo.mentions.users.keys()) targetIds.add(id);
        }
    }

    for (const id of targetIds) {
        if (id === message.author.id || id === message.client.user.id) continue;
        const first = recentFirstMessages.get(id);
        if (first && now - first.at <= RECENT_FIRST_MESSAGE_MS) return true;
        const member = await message.guild.members.fetch(id).catch(() => null);
        if (member?.joinedTimestamp && now - member.joinedTimestamp <= RECENT_JOIN_MS) return true;
    }

    const welcomeChannelId = getWelcomeConfig(message.guild.id).channel_id;
    if (message.channelId !== welcomeChannelId || !isExplicitWelcome(message.content)) return false;

    const recentFirst = [...recentFirstMessages].some(([id, first]) =>
        id !== message.author.id && first.channelId === message.channelId && now - first.at <= CONTEXT_MS
    );
    if (recentFirst) return true;
    return message.guild.members.cache.some(member =>
        member.id !== message.author.id && !member.user.bot &&
        member.joinedTimestamp && now - member.joinedTimestamp <= CONTEXT_MS
    );
}

async function reactToWelcome(message) {
    if (!message.guild || message.guild.id !== process.env.GUILD_ID?.trim() || message.author.bot) return;
    const now = Date.now();
    for (const [id, first] of recentFirstMessages) {
        if (now - first.at > RECENT_FIRST_MESSAGE_MS) recentFirstMessages.delete(id);
    }
    rememberFirstMessage(message, now);

    if (!saysWlc(message.content) &&
        (!isGreeting(message.content) || !await greetedNewcomer(message, now))) return;

    for (const emojiId of EMOJI_IDS) {
        await message.react(emojiId).catch(error => {
            console.warn(`[Welcome] No pude reaccionar con ${emojiId} al mensaje ${message.id}:`, error?.message || error);
        });
    }
}

module.exports = client => {
    client.on(Events.MessageCreate, message => {
        void reactToWelcome(message).catch(error => console.error('[Welcome] Reacciones fallaron:', error));
    });
};

module.exports.saysWlc = saysWlc;
module.exports.isGreeting = isGreeting;
